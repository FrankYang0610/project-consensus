import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
