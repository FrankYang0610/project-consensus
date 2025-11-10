// Utility helpers for displaying department names consistently

const SMALL_WORDS = new Set([
  "of",
  "and",
  "in",
  "on",
  "for",
  "at",
  "by",
  "to",
  "from",
  "with",
  "the",
  "a",
  "an",
  "or",
  "nor",
  "but",
  "as",
]);

/**
 * Convert raw department names (often UPPERCASE) to human-friendly Title Case.
 * - Keeps small connector words (e.g. "of", "and") lowercase unless first word
 * - Title-cases after common separators (hyphen, slash, parentheses, en/em dashes, ampersand, apostrophe)
 */
export function formatDepartmentTitle(raw: string): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim().replace(/\s+/g, " ");
  const titled = lower
    .split(" ")
    .map((token, index) => {
      const core = token.replace(/^[^a-z]+|[^a-z]+$/g, "");
      if (index !== 0 && SMALL_WORDS.has(core)) {
        return token;
      }
      return token.replace(/(^|[-\/(\u2013\u2014&'])[a-z]/g, (m) => m.toUpperCase());
    })
    .join(" ");
  // Abbreviate full word "Department" to "Dept." (e.g., "Department of X" -> "Dept. of X")
  return titled.replace(/\bDepartment\b/g, "Dept.");
}


