/**
 * @file Presentational difficulty picker.
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
import {
  DIFFICULTY_DEBT_USD,
  DIFFICULTY_INCOME_USD,
  type DifficultyIncomeId,
} from '@/core/campaign/campaignKeys';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function startingLineFor(id: DifficultyId): string {
  const incomeKey = id as DifficultyIncomeId;
  const income = DIFFICULTY_INCOME_USD[incomeKey];
  const debt = DIFFICULTY_DEBT_USD[incomeKey];
  return `Start: ${usd.format(income)} salary - ${usd.format(debt)} debt`;
}

export interface DifficultySelectProps {
  value: DifficultyId;
  onChange: (next: DifficultyId) => void;
  /** `parchment` = recessed beige cards for the New Game difficulty screen. */
  layout?: 'default' | 'parchment';
}

export function DifficultySelect({
  value,
  onChange,
  layout = 'default',
}: DifficultySelectProps) {
  const isParchment = layout === 'parchment';
  return (
    <div
      role="radiogroup"
      aria-label="Difficulty"
      className={isParchment ? 'ngd-diffGrid' : 'grid gap-3 sm:grid-cols-3'}
    >
      {DIFFICULTIES.map((opt) => (
        <DifficultyCard
          key={opt.id}
          option={opt}
          selected={opt.id === value}
          layout={layout}
          onSelect={() => onChange(opt.id)}
        />
      ))}
    </div>
  );
}

interface DifficultyCardProps {
  option: DifficultyOption;
  selected: boolean;
  layout: 'default' | 'parchment';
  onSelect: () => void;
}

function DifficultyCard({ option, selected, layout, onSelect }: DifficultyCardProps) {
  if (layout === 'parchment') {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={[
          'difficulty-card-btn',
          'ngd-diffCard',
          selected ? 'ngd-diffCard--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {selected ? (
          <span className="ngd-diffCard__check" aria-hidden>
            <Check className="size-3.5" strokeWidth={2.5} />
          </span>
        ) : null}
        <p className="ngd-diffCard__label">{option.label}</p>
        <p className="ngd-diffCard__desc">{option.description}</p>
        <p className="ngd-diffCard__desc opacity-80">{startingLineFor(option.id)}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={[
        'difficulty-card-btn',
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
      <p className="mt-1 font-mono text-[11px] text-[var(--island-color-ink-muted)] opacity-80">
        {startingLineFor(option.id)}
      </p>
    </button>
  );
}
