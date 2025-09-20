/**
 * ClientOnlyTime Component / 客户端专用时间显示组件
 * 
 * Purpose / 用途:
 * This component is designed to solve hydration mismatch errors in Next.js SSR applications.
 * It displays relative time (e.g., "2 hours ago") only on the client side, preventing
 * server-client rendering inconsistencies that occur when time calculations differ between
 * server and client render cycles.
 * 
 * 此组件旨在解决 Next.js SSR 应用中的 hydration 不匹配错误。
 * 它仅在客户端显示相对时间（如"2小时前"），防止服务端和客户端渲染周期中
 * 时间计算差异导致的渲染不一致问题。
 * 
 * Key Features / 主要特性:
 * - Client-side only rendering for time-sensitive content / 仅客户端渲染时间敏感内容
 * - Server-side placeholder with loading animation / 服务端占位符带加载动画
 * - Prevents hydration errors / 防止 hydration 错误
 * - Supports internationalization / 支持国际化
 * 
 * Usage / 使用方法:
 * <ClientOnlyTime dateString="2024-01-01T10:00:00Z" />
 */

"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/lib/time-utils";

/**
 * ClientOnlyTime component props / ClientOnlyTime 组件属性
 */
interface ClientOnlyTimeProps {
  dateString: string; // ISO date string / ISO 日期字符串
  className?: string; // Optional CSS class name / 可选的 CSS 类名
}

/**
 * Client-only time display component to prevent hydration errors
 * 客户端专用时间显示组件，避免 hydration 错误
 * 
 * Only renders on the client side, shows placeholder on server side
 * 仅在客户端渲染，服务端显示占位符
 */
export function ClientOnlyTime({ dateString, className }: ClientOnlyTimeProps) {
  // i18n translation hook / 国际化翻译钩子
  const { t } = useI18n();
  
  // Client-side rendering state / 客户端渲染状态
  const [isClient, setIsClient] = React.useState(false);

  // Set client flag after component mounts / 组件挂载后设置客户端标志
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Show placeholder during server-side rendering to prevent hydration mismatch
  // 服务端渲染时显示占位符，避免 hydration 不匹配
  if (!isClient) {
    return (
      <div className={`flex items-center text-xs text-muted-foreground ${className}`}>
        <Calendar className="w-3 h-3 mr-1" />
        <span className="animate-pulse bg-muted-foreground/20 rounded w-16 h-3"></span>
      </div>
    );
  }

  // Render actual time on client side / 客户端渲染实际时间
  return (
    <div className={`flex items-center text-xs text-muted-foreground ${className}`}>
      <Calendar className="w-3 h-3 mr-1" />
      {formatRelativeTime(dateString, t)}
    </div>
  );
}

export default ClientOnlyTime;
