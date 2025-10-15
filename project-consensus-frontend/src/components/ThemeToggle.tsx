"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Laptop, Moon, Sun, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentTheme = (theme ?? "system") as "system" | "light" | "dark";
  const effectiveTheme = currentTheme === "system" ? resolvedTheme : currentTheme;

  const renderIcon = () => {
    if (!mounted) return <Laptop className="size-4" />;
    if (currentTheme === "system") return <Laptop className="size-4" />;
    if (effectiveTheme === "dark") return <Moon className="size-4" />;
    return <Sun className="size-4" />;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3">
          {renderIcon()}
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={currentTheme}
          onValueChange={(val) => setTheme(val as "system" | "light" | "dark")}
        >
          <DropdownMenuRadioItem value="system">
            <span className="mr-2 inline-flex items-center justify-center"><Laptop className="size-4" /></span>
            <span>System</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <span className="mr-2 inline-flex items-center justify-center"><Sun className="size-4" /></span>
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <span className="mr-2 inline-flex items-center justify-center"><Moon className="size-4" /></span>
            <span>Dark</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


