import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ValidationResult } from "@/types/validation"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates if rich text content is empty or contains only empty HTML tags
 * @param content - The content string to validate
 * @returns true if content is empty or contains only empty HTML tags
 */
export function isContentEmpty(content: string | null | undefined): boolean {
  const trimmedContent = (content ?? "").trim();
  return !trimmedContent || trimmedContent === '<p></p>' || trimmedContent === '<p><br></p>';
}

/**
 * Validate and sanitize display name
 * 验证和消毒显示名称
 * 
 * Rules / 规则:
 * - Strip leading/trailing whitespace / 去除首尾空格
 * - Max length: 15 characters / 最长15个字符
 * - No HTML tags (< >) allowed / 不允许HTML标签
 * - At least 1 non-whitespace character / 至少包含1个非空字符
 * 
 * @param value - The display name to validate
 * @returns ValidationResult with sanitized value or error message
 */
export function validateDisplayName(value: string): ValidationResult {
  // Check if empty
  // 检查是否为空
  if (!value) {
    return {
      isValid: false,
      error: 'validation.displayName.required',
    };
  }

  // Strip whitespace
  // 去除首尾空格
  const sanitized = value.trim();

  // Check minimum length (after stripping)
  // 检查最小长度（去除空格后）
  if (!sanitized) {
    return {
      isValid: false,
      error: 'validation.displayName.onlyWhitespace',
    };
  }

  // Check maximum length
  // 检查最大长度
  if (sanitized.length > 15) {
    return {
      isValid: false,
      error: 'validation.displayName.tooLong',
    };
  }

  // Check for HTML tags and suspicious characters
  // 检查HTML标签和可疑字符
  if (/<|>/.test(sanitized)) {
    return {
      isValid: false,
      error: 'validation.displayName.invalidCharacters',
    };
  }

  // Remove control characters (additional sanitization)
  // 移除控制字符（额外消毒）
  // eslint-disable-next-line no-control-regex
  const finalValue = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  return {
    isValid: true,
    sanitizedValue: finalValue,
  };
}
