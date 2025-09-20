/**
 * Time formatting utilities / 时间格式化工具函数
 * 
 * This module provides shared time formatting functions to avoid code duplication
 * across components that need to display relative time (e.g., "2 hours ago").
 * 
 * 此模块提供共享的时间格式化函数，避免在需要显示相对时间（如"2小时前"）
 * 的组件中出现代码重复。
 */

/**
 * Format a date string to relative time display
 * 将日期字符串格式化为相对时间显示
 * 
 * @param dateString - ISO date string / ISO 日期字符串
 * @param t - Translation function from useI18n hook / 来自 useI18n hook 的翻译函数
 * @param locale - Optional locale string, defaults to 'en-US' / 可选的区域设置字符串，默认为 'en-US'
 * @returns Formatted time string / 格式化的时间字符串
 */
export function formatRelativeTime(dateString: string, t: (key: string) => string, locale: string = 'en-US'): string {
  // Validate input date string
  if (!dateString || typeof dateString !== 'string') {
    return t('post.invalidDate') || 'Invalid date'; // Fallback for invalid input
  }

  const date = new Date(dateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return t('post.invalidDate') || 'Invalid date'; // Fallback for invalid date
  }

  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) {
    return t('post.justNow'); // "Just now" / "刚刚"
  } else if (diffInHours < 24) {
    return `${diffInHours} ${t('post.hoursAgo')}`; // "X hours ago" / "X小时前"
  } else if (diffInHours < 168) {
    // 7 days / 7天
    return `${Math.floor(diffInHours / 24)} ${t('post.daysAgo')}`; // "X days ago" / "X天前"
  } else {
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Format a date string to relative time display (alternative name for backward compatibility)
 * 将日期字符串格式化为相对时间显示（向后兼容的替代名称）
 * 
 * @param dateString - ISO date string / ISO 日期字符串
 * @param t - Translation function from useI18n hook / 来自 useI18n hook 的翻译函数
 * @returns Formatted time string / 格式化的时间字符串
 */
export const formatTime = formatRelativeTime;
export const formatDate = formatRelativeTime;
