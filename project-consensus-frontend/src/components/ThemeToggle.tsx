"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = (theme ?? resolvedTheme) === "dark";

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" aria-label="Toggle theme" className="h-9 px-3">
        <Sun className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Toggle theme"
      className="h-9 px-3"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}


