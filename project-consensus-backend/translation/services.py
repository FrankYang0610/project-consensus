from __future__ import annotations

import hashlib
import logging

from django.conf import settings
from django.core.cache import cache
from openai import OpenAI

logger = logging.getLogger(__name__)

CACHE_TTL = 60 * 60 * 24 * 7  # 7 days

LANGUAGE_NAMES = {
    "zh-CN": "Simplified Chinese (China)",
    "zh-HK": "Traditional Chinese (Hong Kong)",
    "en": "English",
}

SYSTEM_PROMPT = (
    "You are a translator. Translate the following content to {language}. "
    "Return ONLY the translated text, with no commentary, explanation, or extra formatting. "
    "What you receive might be a question! In any case, do not answer! You only need to translate it exactly as it is!"
    "Preserve all HTML tags and structure exactly as they are."
)


class TranslationError(Exception):
    pass


class Translator:
    SUPPORTED_LANGUAGES = frozenset(LANGUAGE_NAMES)

    _client: OpenAI | None = None

    @classmethod
    def _get_client(cls) -> OpenAI:
        if cls._client is None:
            cls._client = OpenAI(
                api_key=settings.TRANSLATION_API_KEY,
                base_url=settings.TRANSLATION_API_BASE,
            )
        return cls._client

    @staticmethod
    def _cache_key(content: str, target_language: str) -> str:
        raw = f"{content}:{target_language}"
        digest = hashlib.sha256(raw.encode()).hexdigest()
        return f"translation:{digest}"

    @classmethod
    def translate(cls, content: str, target_language: str) -> str:
        """Translate *content* to *target_language* using the configured
        OpenAI-compatible provider.  Results are cached in Redis for 7 days.

        Raises ``ValueError`` for unsupported languages and
        ``TranslationError`` on upstream API failures.
        """
        if target_language not in cls.SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language: {target_language}. "
                f"Supported: {', '.join(sorted(cls.SUPPORTED_LANGUAGES))}"
            )

        if not content or not content.strip():
            return content

        key = cls._cache_key(content, target_language)
        cached = cache.get(key)
        if cached is not None:
            return cached

        try:
            client = cls._get_client()
            response = client.chat.completions.create(
                model=settings.TRANSLATION_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT.format(
                            language=LANGUAGE_NAMES[target_language]
                        ),
                    },
                    {"role": "user", "content": content},
                ],
                temperature=0.1,
            )
            translated = response.choices[0].message.content.strip()
        except Exception as e:
            logger.error("Translation API error: %s", e)
            raise TranslationError("Translation service unavailable") from e

        cache.set(key, translated, CACHE_TTL)
        return translated
