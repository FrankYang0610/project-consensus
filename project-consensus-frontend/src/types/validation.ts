/**
 * Validation-related types
 * 验证相关类型定义
 */

/**
 * Validation result type
 * 验证结果类型
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: string;
  error?: string;
}

