import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";
import "ckeditor5/ckeditor5.css";

import { ThemeProvider } from "@/components/ThemeProvider";
import Watermark from "@/components/Watermark";
import { AppProvider } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { LoginModal } from "@/components/LoginModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PolyU Life - 香港理工大學學生論壇與課程評價社區 | PolyU Student Forum & Course Review Community",
    template: "%s | PolyU Life",
  },
  description:
    "PolyU Life 是香港理工大學學生的綜合社區平台，提供課程評價、教師評分、校園論壇等功能。PolyU Life is a student community platform for The Hong Kong Polytechnic University, offering course reviews, teacher ratings, and campus forums.",
  keywords: [
    "PolyU",
    "香港理工大學",
    "理大",
    "課程評價",
    "教師評分",
    "學生論壇",
    "Hong Kong Polytechnic University",
    "course review",
    "teacher rating",
    "student forum",
    "campus life",
    "PolyU courses",
    "PolyU teachers",
  ],
  authors: [{ name: "PolyU Life Team" }],
  openGraph: {
    type: "website",
    locale: "zh_HK",
    alternateLocale: ["en_US"],
    url: "https://www.polyu.life",
    siteName: "PolyU Life",
    title: "PolyU Life - 香港理工大學學生論壇與課程評價社區 | PolyU Student Forum & Course Review Community",
    description:
      "香港理工大學學生論壇與課程評價社區 - 課程評價、教師評分、校園論壇 | PolyU student forum & course review community - course reviews, teacher ratings, campus forums.",
    images: [
      {
        url: "/project-consensus-icon.svg",
        alt: "PolyU Life Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "PolyU Life - 香港理工大學學生論壇與課程評價社區 | PolyU Student Forum & Course Review Community",
    description:
      "香港理工大學學生論壇與課程評價社區 - 課程評價、教師評分、校園論壇 | PolyU student forum & course review community - course reviews, teacher ratings, campus forums.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" suppressHydrationWarning>
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
        className={cn(geistSans.variable, geistMono.variable, "antialiased")}
      >
        <ThemeProvider>
          <AppProvider>
            {children}
            <Watermark />
            <LoginModal />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
