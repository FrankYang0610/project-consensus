from __future__ import annotations

import json
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Iterator, Optional

from django.conf import settings

try:  # Optional Redis publish for cross-process SSE fanout
    import redis  # type: ignore
    _redis_import_ok = True
except Exception:
    _redis_import_ok = False

# Simple in-process pub/sub keyed by user_id (string)
# Not persistent; suitable for single-process development/demo.

_lock = threading.Lock()
_subscribers: Dict[str, set["_Subscriber"]] = defaultdict(set)

# Lazy Redis client, created on first use.
_redis_client: Optional["redis.Redis"] = None  # type: ignore


def _get_redis_client() -> Optional["redis.Redis"]:  # type: ignore
    global _redis_client
    if not _redis_import_ok:
        return None
    url = getattr(settings, "NOTIFICATIONS_REDIS_URL", None)
    if not url:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        # decode_responses ensures str payloads for pub/sub
        _redis_client = redis.Redis.from_url(url, decode_responses=True)  # type: ignore
    except Exception:
        _redis_client = None
    return _redis_client


class _Subscriber:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self._queue: Deque[dict] = deque()
        self._cv = threading.Condition()
        self._closed = False

    def put(self, msg: dict) -> None:
        with self._cv:
            if self._closed:
                return
            self._queue.append(msg)
            self._cv.notify()

    def close(self) -> None:
        with self._cv:
            self._closed = True
            self._cv.notify_all()

    def __iter__(self) -> Iterator[str]:
        return self.listen()

    def listen(self, keepalive_seconds: int = 25) -> Iterator[str]:
        """Yield SSE-formatted strings for events and periodic keepalive comments."""
        last = time.time()
        try:
            while True:
                with self._cv:
                    # Wait for new message or keepalive timeout
                    now = time.time()
                    timeout = max(0.1, keepalive_seconds - (now - last))
                    if not self._queue and not self._closed:
                        self._cv.wait(timeout=timeout)
                    if self._closed:
                        break
                    if self._queue:
                        msg = self._queue.popleft()
                        payload = json.dumps(msg, ensure_ascii=False)
                        yield f"data: {payload}\n\n"
                        last = time.time()
                        continue
                # Timeout: send keepalive comment
                now = time.time()
                if now - last >= keepalive_seconds:
                    yield ": keep-alive\n\n"
                    last = now
        finally:
            # Ensure cleanup
            unsubscribe(self)


def subscribe(user_id: str) -> _Subscriber:
    sub = _Subscriber(user_id)
    with _lock:
        _subscribers[user_id].add(sub)
    return sub


def unsubscribe(sub: _Subscriber) -> None:
    with _lock:
        subs = _subscribers.get(sub.user_id)
        if subs and sub in subs:
            subs.remove(sub)
        if subs is not None and len(subs) == 0:
            _subscribers.pop(sub.user_id, None)


def publish(user_id: str, msg: dict) -> None:
    """Publish a message to all subscribers of a user.

    This function fans out via two transports:
    - In-process subscribers (development single-process server)
    - Redis pub/sub (production multi-process or separate SSE service)
    """
    # 1) In-process fanout (dev / unit tests)
    try:
        with _lock:
            targets = list(_subscribers.get(user_id, ()))
        for sub in targets:
            try:
                sub.put(msg)
            except Exception:
                try:
                    unsubscribe(sub)
                except Exception:
                    pass
    except Exception:
        # Never fail caller on local fanout issues
        pass

    # 2) Redis pub/sub fanout (production)
    try:
        client = _get_redis_client()
        if client is not None:
            channel = f"notifications:{user_id}"
            payload = json.dumps(msg, ensure_ascii=False)
            client.publish(channel, payload)
    except Exception:
        # Silent best-effort; callers should not depend on pub/sub
        pass
