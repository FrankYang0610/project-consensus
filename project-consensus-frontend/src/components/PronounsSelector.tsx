'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Info } from 'lucide-react';
import {
  getPresetPronouns,
  getSpecialPronounOptions,
  getPronounsChoiceFromValue,
} from '@/lib/pronouns-utils';
import useI18n from '@/hooks/useI18n';

export interface PronounsSelectorProps {
  /**
   * Current pronouns value (e.g., "she/her/hers", "custom string", "not_specified")
   */
  value: string;
  /**
   * Callback when pronouns value changes
   */
  onChange: (newValue: string) => void;
  /**
   * Optional label for the selector
   */
  label?: string;
  /**
   * Optional ID for the label/input
   */
  id?: string;
}

/**
 * PronounsSelector: A dropdown menu with common pronouns + special options + custom input
 */
export function PronounsSelector({
  value,
  onChange,
  label = 'Pronouns',
  id = 'pronouns-selector',
}: PronounsSelectorProps) {
  const { t } = useI18n();
  const [choice, setChoice] = useState<string>(() => getPronounsChoiceFromValue(value));
  const [customInput, setCustomInput] = useState<string>(() => {
    const detectedChoice = getPronounsChoiceFromValue(value);
    return detectedChoice === 'custom' ? value : '';
  });

  // Sync with external value changes
  useEffect(() => {
    const detectedChoice = getPronounsChoiceFromValue(value);
    setChoice(detectedChoice);
    if (detectedChoice === 'custom') {
      setCustomInput(value);
    }
  }, [value]);

  const handleChoiceChange = (newChoice: string) => {
    setChoice(newChoice);
    if (newChoice === 'custom') {
      return;
    }
    onChange(newChoice);
  };

  const handleCustomInputChange = (newCustom: string) => {
    setCustomInput(newCustom);
    if (choice === 'custom') {
      onChange(newCustom.trim());
    }
  };

  const presets = getPresetPronouns();
  const specials = getSpecialPronounOptions();

  // Display label in dropdown trigger
  const getDisplayLabel = () => {
    if (choice === 'custom') {
      return 'Custom...';
    }
    const found = [...presets, ...specials].find((p) => p.value === choice);
    return found ? found.label : 'Not Specified';
  };

  return (
    <div className="grid gap-2">
      {label && (
        <div className="inline-flex items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Pronouns info"
                className="h-6 w-6 p-0 text-muted-foreground"
              >
                <Info className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={4} className="w-64">
              <div className="p-2 text-xs text-muted-foreground">
                {t('pronouns.info')}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="flex gap-2">
        {/* Dropdown menu takes half width */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className="flex-1 justify-between text-sm font-normal"
            >
              <span className="truncate">{getDisplayLabel()}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
            {/* Preset pronouns */}
            {presets.map((p) => (
              <DropdownMenuItem
                key={p.value}
                onClick={() => handleChoiceChange(p.value)}
                className={choice === p.value ? 'bg-accent' : ''}
              >
                {p.label}
                {choice === p.value && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Special options */}
            {specials.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => handleChoiceChange(s.value)}
                className={choice === s.value ? 'bg-accent' : ''}
              >
                {s.label}
                {choice === s.value && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Custom option */}
            <DropdownMenuItem
              onClick={() => handleChoiceChange('custom')}
              className={choice === 'custom' ? 'bg-accent' : ''}
            >
              Custom...
              {choice === 'custom' && <span className="ml-auto text-xs">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom input (right half, only visible when custom is selected) */}
        {choice === 'custom' && (
          <Input
            id={`${id}-custom-input`}
            placeholder="e.g., they/them, xe/xem, fae/faer"
            value={customInput}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
