import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook for debouncing values
 * Useful for search inputs and other controlled inputs
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns The debounced value
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   // This will only run when debouncedSearchTerm changes
 *   searchAPI(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay expires
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debouncing callback functions
 * Useful for preventing rapid consecutive function calls (e.g. API requests, button clicks)
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced version of the callback
 * 
 * @example
 * const debouncedSave = useDebounceCallback((data: FormData) => {
 *   saveAPI(data);
 * }, 500);
 * 
 * // Multiple rapid calls will only execute the last one after 500ms
 * debouncedSave(formData);
 */
export function useDebounceCallback<Args extends unknown[], Return>(
  callback: (...args: Args) => Return,
  delay: number = 300
): (...args: Args) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  callbackRef.current = callback;

  return useCallback(
    (...args: Args) => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
