import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import validator from "validator"
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
 * Validate email address
 * 
 * Rules:
 * - Must be a valid email format
 * - Normalizes to lowercase
 * - Recommend to use PolyU email (e.g. name@connect.polyu.hk)
 * 
 * @param email - The email to validate
 * @returns ValidationResult with sanitized value or error message
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return {
      isValid: false,
      error: 'validation.email.required',
    };
  }

  // Normalize and sanitize email
  const sanitized =
    validator.normalizeEmail(email, {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }) || email.trim().toLowerCase();

  // Validate email format
  if (!validator.isEmail(sanitized)) {
    return {
      isValid: false,
      error: 'validation.email.invalid',
    };
  }

  return {
    isValid: true,
    sanitizedValue: sanitized,
  };
}

/**
 * Validate and sanitize nickname
 * 验证和消毒昵称
 * 
 * Rules / 规则:
 * - Strip leading/trailing whitespace / 去除首尾空格
 * - Max length: 15 characters / 最长15个字符
 * - No HTML tags (< >) allowed / 不允许HTML标签
 * - At least 1 non-whitespace character / 至少包含1个非空字符
 * - Remove control characters / 移除控制字符
 * 
 * @param value - The nickname to validate
 * @returns ValidationResult with sanitized value or error message
 */
export function validateNickname(value: string): ValidationResult {
  // Check if empty
  // 检查是否为空
  if (!value) {
    return {
      isValid: false,
      error: 'validation.nickname.required',
    };
  }

  // Use validator.js to sanitize
  // 使用 validator.js 消毒
  let sanitized = validator.trim(value);  // 去除首尾空格
  sanitized = validator.stripLow(sanitized);  // 移除控制字符（包括 \x00-\x1F 和 \x7F-\x9F）

  // Check minimum length (after stripping)
  // 检查最小长度（去除空格后）
  if (!sanitized) {
    return {
      isValid: false,
      error: 'validation.nickname.onlyWhitespace',
    };
  }

  // Check maximum length
  // 检查最大长度
  if (sanitized.length > 15) {
    return {
      isValid: false,
      error: 'validation.nickname.tooLong',
    };
  }

  // Check for HTML tags and suspicious characters
  // 检查HTML标签和可疑字符
  if (/<|>/.test(sanitized)) {
    return {
      isValid: false,
      error: 'validation.nickname.invalidCharacters',
    };
  }

  return {
    isValid: true,
    sanitizedValue: sanitized,
  };
}
