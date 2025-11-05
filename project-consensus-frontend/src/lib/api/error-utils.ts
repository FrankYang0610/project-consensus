import { ErrorResponse } from '@/types';

/**
 * Extract user-friendly error message from API error response
 * 从 API 错误响应中提取用户友好的错误信息
 * 
 * Handles various error formats:
 * - Direct message: { message: "error" }
 * - Detail field: { detail: "error" }
 * - Field-level errors: { field_name: ["error1", "error2"] }
 * - Non-field errors: { non_field_errors: ["error"] }
 * - I18n error codes: "validation.field.errorType" -> returned as-is for i18n lookup
 * 
 * @param errorData - Error response from API
 * @param fallbackMessage - Default message if no error found
 * @returns Extracted error message or i18n error code
 */
export function extractErrorMessage(
  errorData: ErrorResponse,
  fallbackMessage: string = 'An error occurred'
): string {
  // First try direct message or detail fields
  if (errorData.message) return errorData.message;
  if (errorData.detail) return errorData.detail;
  
  // Try to extract from non_field_errors (common DRF pattern)
  if (errorData.non_field_errors) {
    const errors = Array.isArray(errorData.non_field_errors) 
      ? errorData.non_field_errors 
      : [errorData.non_field_errors];
    if (errors.length > 0 && errors[0]) return errors[0];
  }
  
  // Try to extract from any field-level validation error
  for (const key in errorData) {
    // Skip known non-error fields
    if (key === 'success' || key === 'user') continue;
    
    const value = errorData[key];
    if (value && typeof value !== 'boolean') {
      const errors = Array.isArray(value) ? value : [value];
      if (errors.length > 0 && errors[0]) {
        // If error is a string, return it; if it's an object, try to stringify
        return typeof errors[0] === 'string' ? errors[0] : JSON.stringify(errors[0]);
      }
    }
  }
  
  // Fallback to default message
  return fallbackMessage;
}
