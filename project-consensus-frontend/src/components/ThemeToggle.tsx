"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  // Determine current theme selection (system/light/dark)
  const currentTheme = (theme ?? "system") as "system" | "light" | "dark";
  const effectiveTheme = currentTheme === "system" ? resolvedTheme : currentTheme;
  
  const nextTheme = (t: "system" | "light" | "dark") =>
    t === "system" ? "light" : t === "light" ? "dark" : "system";
  
  const ariaLabel =
    currentTheme === "system"
      ? "Switch to light theme"
      : currentTheme === "light"
      ? "Switch to dark theme"
      : "Switch to system theme";

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" aria-label="Toggle theme" className="h-9 px-3">
        <Laptop className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      className="h-9 px-3"
      onClick={() => setTheme(nextTheme(currentTheme))}
    >
      {currentTheme === "system" ? (
        <Laptop className="size-4" />
      ) : effectiveTheme === "dark" ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </Button>
  );
}


