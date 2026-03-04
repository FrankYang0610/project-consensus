'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { HttpError } from '@/lib/api/api-utils';

/**
 * Reusable hook for translating content via the backend translation API.
 *
 * - First click: fetches translation, caches it, shows translated content.
 * - Toggle back to original without an API call.
 * - Subsequent translate clicks reuse the cached result.
 * - When `key` changes (e.g. language switch), cached data is cleared so the
 *   next translate click fetches a fresh translation.
 * - On failure, `error` contains an i18n key for inline display;
 *   toggling back clears the error and a subsequent click retries.
 */
export function useTranslation<T>(
  fetchTranslation: () => Promise<T>,
  key?: string,
) {
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRef = useRef(fetchTranslation);
  fetchRef.current = fetchTranslation;

  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      setData(null);
      setIsTranslated(false);
      setError(null);
    }
  }, [key]);

  const handleTranslate = useCallback(async () => {
    if (isTranslating) return;

    if (isTranslated) {
      setIsTranslated(false);
      setError(null);
      return;
    }

    if (data !== null) {
      setIsTranslated(true);
      return;
    }

    setIsTranslating(true);
    setError(null);
    try {
      const result = await fetchRef.current();
      setData(result);
      setIsTranslated(true);
    } catch (err) {
      let errorCode = 'translation.serviceUnavailable';
      if (err instanceof HttpError) {
        try { errorCode = JSON.parse(err.body).detail || errorCode; } catch { /* use default */ }
      }
      setError(errorCode);
      setIsTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  }, [isTranslating, isTranslated, data]);

  return { isTranslated, isTranslating, data, error, handleTranslate } as const;
}
