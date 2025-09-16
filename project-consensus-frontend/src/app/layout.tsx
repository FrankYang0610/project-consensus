import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
    <html lang="en">
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
