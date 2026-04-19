/**
 * Presentational difficulty picker.
 *
 * Data-driven from `DIFFICULTIES` in `@/ui/menu/gameFlow`. Pure
 * controlled component: owner passes `value` and `onChange`.
 */

import { Check } from 'lucide-react';
import {
  DIFFICULTIES,
  type DifficultyId,
  type DifficultyOption,
} from '@/ui/menu/gameFlow';

export interface DifficultySelectProps {
  value: DifficultyId;
  onChange: (next: DifficultyId) => void;
}

export function DifficultySelect({ value, onChange }: DifficultySelectProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Difficulty"
      className="grid gap-3 sm:grid-cols-3"
    >
      {DIFFICULTIES.map((opt) => (
        <DifficultyCard
          key={opt.id}
          option={opt}
          selected={opt.id === value}
          onSelect={() => onChange(opt.id)}
        />
      ))}
    </div>
  );
}

interface DifficultyCardProps {
  option: DifficultyOption;
  selected: boolean;
  onSelect: () => void;
}

function DifficultyCard({ option, selected, onSelect }: DifficultyCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={[
        'island-paperCard relative rounded-2xl p-4 text-left transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--island-color-title)]/60',
        selected
          ? 'ring-2 ring-[var(--island-color-title)]'
          : 'opacity-90 hover:opacity-100',
      ].join(' ')}
    >
      {selected ? (
        <span className="absolute right-3 top-3 inline-flex size-6 items-center justify-center rounded-full bg-[var(--island-color-title)] text-white">
          <Check className="size-3.5" />
        </span>
      ) : null}
      <p className="text-base font-semibold text-[var(--island-color-title)]">
        {option.label}
      </p>
      <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
        {option.description}
      </p>
    </button>
  );
}
