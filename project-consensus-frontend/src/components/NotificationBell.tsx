"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { fetchUnreadCount, openNotificationSSE } from "@/lib/api/notification";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { t } = useI18n();
  const { isLoggedIn } = useApp();
  const [unread, setUnread] = React.useState<number>(0);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    let es: EventSource | null = null;
    let cancelled = false;
    (async () => {
      try {
        const n = await fetchUnreadCount();
        if (!cancelled) setUnread(n);
      } catch {
        // ignore
      }
      try {
        // Session cookie-based SSE
        es = await openNotificationSSE();
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data || "{}");
            if (data && data.type === "notification" && typeof data.unreadCount === "number") {
              setUnread(data.unreadCount);
            }
          } catch {
            // Ignore JSON parse errors from malformed or irrelevant SSE data.
            // Only well-formed notification messages are processed; others can be safely ignored.
          }
        };
        es.onerror = () => {
          // Browser may auto-reconnect. We don't need special handling.
        };
      } catch {
        // ignore SSE failure in non-HTTP environments
      }
    })();
    return () => {
      cancelled = true;
      try { es?.close(); } catch {}
    };
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative inline-flex items-center justify-center w-9 h-9 rounded-md",
        "hover:bg-accent transition-colors"
      )}
      aria-label={t("notifications.bell") || "Notifications"}
      title={t("notifications.bell") || "Notifications"}
    >
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1",
            "bg-red-600 text-white text-[11px] font-medium rounded-full",
            "flex items-center justify-center"
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
