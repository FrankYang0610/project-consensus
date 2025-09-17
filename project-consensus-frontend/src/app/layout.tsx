import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "@/lib/i18n"; // Initialize i18n
import "./globals.css";

import { ThemeProvider } from "@/components/ThemeProvider";
import Watermark from "@/components/Watermark";
import { AppProvider } from "@/contexts/AppContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "project-consensus",
  description: "project-consensus main page",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" suppressHydrationWarning>
      <head>
        <Script id="init-language" strategy="beforeInteractive">{`
          try {
            if (typeof window !== 'undefined') {
              var key = 'language';
              if (!window.localStorage.getItem(key)) {
                window.localStorage.setItem(key, 'zh-HK');
              }
            }
          } catch (e) {}
        `}</Script>
      </head>
      {/**
       * 主题说明：ThemeProvider（next-themes）会在客户端根据系统/存储设置注入 html 的 class/style，
       * SSR 无法预知这些值，因此首屏可能与客户端不一致。使用 suppressHydrationWarning 抑制此类
       * 不可避免的初始属性差异，属于 Next 官方推荐用法之一。
       * 
       * Note: ThemeProvider (next-themes) sets html class/style on the client based on
       * system/storage. SSR can't know these values ahead of time, so the initial
       * attributes may differ. suppressHydrationWarning avoids hydration warnings for
       * this expected difference, per Next's recommendation.
       */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AppProvider>
            {children}
            <Watermark />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
