/**
 * Pronouns utilities
 * Hardcoded pronouns options (no i18n needed per requirements)
 */

export type PronounOption = {
  value: string;
  label: string;
};

/**
 * Get preset pronoun options
 * Alphabetical order
 */
export function getPresetPronouns(): PronounOption[] {
  return [
    { value: 'any/all', label: 'any/all' },
    { value: 'ey/em/eirs', label: 'ey/em/eirs' },
    { value: 'fae/faer/faers', label: 'fae/faer/faers' },
    { value: 'he/him/his', label: 'he/him/his' },
    { value: 'he/they', label: 'he/they' },
    { value: 'it/its', label: 'it/its' },
    { value: 'per/pers', label: 'per/pers' },
    { value: 'she/her/hers', label: 'she/her/hers' },
    { value: 'she/they', label: 'she/they' },
    { value: 'they/them/theirs', label: 'they/them/theirs' },
    { value: 've/ver/vers', label: 've/ver/vers' },
    { value: 'xe/xem/xyrs', label: 'xe/xem/xyrs' },
    { value: 'ze/hir/hirs', label: 'ze/hir/hirs' },
    { value: 'ze/zir/zirs', label: 'ze/zir/zirs' },
  ];
}

/**
 * Get special pronoun options (not pronouns per se, but meta-options)
 */
export function getSpecialPronounOptions(): PronounOption[] {
  return [
    { value: 'unknown', label: 'Unknown' },
    { value: 'not_specified', label: 'Not Specified' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];
}

/**
 * Determine the selection type from a pronouns value
 * Returns 'custom' if not in presets or specials, otherwise the value itself
 */
export function getPronounsChoiceFromValue(value: string | undefined): string {
  if (!value || value.trim() === '') return 'not_specified';
  
  const allPresets = [...getPresetPronouns(), ...getSpecialPronounOptions()];
  const found = allPresets.find((p) => p.value === value);
  
  return found ? value : 'custom';
}

/**
 * Format pronouns for display in the profile page
 * - Maps special values to friendly labels
 * - Trims whitespace and handles empty/undefined
 */
export function formatPronounsForProfilePageDisplay(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'not_specified') return 'Pronoun Not Specified';
  if (trimmed === 'unknown') return 'Pronoun Unknown';
  if (trimmed === 'prefer_not_to_say') return 'Pronoun Prefer Not To Say';
  return trimmed;
}

/**
 * Check if pronouns should be displayed publicly
 * - Returns false if user chooses "prefer_not_to_say" or "not_specified"
 * - Returns false for empty/undefined values
 * - Otherwise returns true (show pronouns)
 */
export function shouldDisplayPronouns(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== 'prefer_not_to_say' && trimmed !== 'not_specified');
}
