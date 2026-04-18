/**
 * "The Box" ? zero-based budgeting UI (Financial Freedom / GAME_DESIGN.md).
 *
 * Architecture (AGENTS.md):
 * - Lives under `src/ui/` only ? no imports from `src/games/**`.
 * - Reads/writes `playerData` via Zustand; announces confirmation on the
 *   typed Event Bus (`box:budget:submit`) for logic / map / mini-games.
 *
 * TODO: wire difficulty (Easy/Medium/Hard) to `[VAR_STARTING_INCOME]`.
 * TODO: logic layer should subscribe to `box:budget:submit` and advance to "The Grind".
 */

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  Car,
  Check,
  CreditCard,
  Home,
  Lock,
  PiggyBank,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Utensils,
  Wallet,
} from 'lucide-react';
import { eventBus } from '@/core/events';
import {
  BOX_CATEGORIES,
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  emptyAllocations,
  readAllocations,
  readNumber,
  type BudgetCategoryId,
} from '@/core/budgetTypes';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const EPS = 0.01;

function sumAllocations(a: Record<BudgetCategoryId, number>): number {
  return (Object.keys(a) as BudgetCategoryId[]).reduce((s, k) => s + (a[k] ?? 0), 0);
}

const categoryIcon = {
  emergencyFund: PiggyBank,
  rent: Home,
  food: Utensils,
  transportation: Car,
  miscFun: Sparkles,
  highInterestDebt: CreditCard,
  investments: TrendingUp,
  medical: Stethoscope,
  personal: Wallet,
} as const satisfies Record<BudgetCategoryId, ComponentType<{ className?: string }>>;

export default function TheBoxScreen({ data }: UIProps<Record<string, unknown>>) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const annualSalary = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.annualSalary,
    BOX_DEFAULTS.annualSalary,
  );
  const debtBalance = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    BOX_DEFAULTS.highInterestDebtBalance,
  );
  const investmentsUnlocked = debtBalance <= EPS;

  const [allocations, setAllocations] = useState<Record<BudgetCategoryId, number>>(() => {
    const saved = readAllocations(data);
    return saved ?? emptyAllocations();
  });

  useEffect(() => {
    if (!investmentsUnlocked && allocations.investments > EPS) {
      setAllocations((a) => ({ ...a, investments: 0 }));
    }
  }, [investmentsUnlocked, allocations.investments]);

  const total = useMemo(() => sumAllocations(allocations), [allocations]);
  const remainder = annualSalary - total;
  const isZeroBased = Math.abs(remainder) < EPS;
  const canSubmit =
    isZeroBased &&
    (investmentsUnlocked || allocations.investments <= EPS) &&
    annualSalary > 0;
  const fundedCount = useMemo(
    () => BOX_CATEGORIES.filter((c) => (allocations[c.id] ?? 0) > EPS).length,
    [allocations],
  );

  const setCategory = useCallback(
    (id: BudgetCategoryId, raw: string) => {
      const n = Math.max(0, Number.parseFloat(raw) || 0);
      setAllocations((prev) => {
        if (id === 'investments' && debtBalance > EPS) {
          return { ...prev, investments: 0 };
        }
        return { ...prev, [id]: n };
      });
    },
    [debtBalance],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;

    const payload = {
      allocations: { ...allocations, investments: investmentsUnlocked ? allocations.investments : 0 },
      annualSalary,
      highInterestDebtBalanceAtSubmit: debtBalance,
    };

    eventBus.emit('box:budget:submit', payload);

    mergePlayerData({
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: payload.allocations,
      boxBudgetSubmittedAt: Date.now(),
    });
  };

  return (
    <div className="island-pageBg absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8 pb-28">
        <div className="island-hudBottle mb-6">
          <div className="island-hudInner p-5">
            <header className="flex flex-col gap-4 border-b border-[rgba(120,90,50,0.2)] pb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
                    Financial Freedom
                  </p>
                  <h1 className="island-title mt-1 text-3xl">The Box</h1>
                  <p className="island-statusText mt-3 max-w-md text-sm">
                    Allocate your entire salary across nine categories before you roll on the map.
                    Investments stay locked until high-interest debt is paid off.
                  </p>
                </div>
                <button
                  className="island-btnShell shrink-0"
                  onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
                >
                  <ArrowLeft className="size-4" />
                  Menu
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="island-paperCard rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Annual salary
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-[var(--island-color-title)]">
                    {fmt.format(annualSalary)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                    Placeholder for [VAR_STARTING_INCOME]
                  </p>
                </div>
                <div className="island-paperCard rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    High-interest debt
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-[#c44b36]">
                    {fmt.format(debtBalance)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                    Unlock Investments at $0 ? [VAR_STARTING_DEBT]
                  </p>
                </div>
              </div>
            </header>

            <div className="island-paperCard mt-4 rounded-xl p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--island-color-ink-muted)]">
                Funding progress
              </p>
              <div className="island-progressStrip">
                {BOX_CATEGORIES.map((cat) => (
                  <span
                    key={cat.id}
                    className={['island-progressSeg', (allocations[cat.id] ?? 0) > EPS ? 'is-active' : ''].join(' ')}
                  />
                ))}
              </div>
              <p className="island-hintText mt-2">
                Funded categories: {fundedCount} / {BOX_CATEGORIES.length}
              </p>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-3" aria-label="Budget categories">
          {BOX_CATEGORIES.map((cat) => {
            const Icon = categoryIcon[cat.id];
            const locked = cat.lockedUntilDebtFree && !investmentsUnlocked;
            const value = locked ? 0 : allocations[cat.id];

            return (
              <div key={cat.id} className="island-hudBottle">
                <div className="island-hudInner flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={[
                        'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg',
                        locked
                          ? 'bg-[rgba(196,75,54,0.12)] text-[#8b6914]'
                          : 'bg-[rgba(26,77,92,0.12)] text-[var(--island-color-title)]',
                      ].join(' ')}
                    >
                      {locked ? <Lock className="size-5" /> : <Icon className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight text-[var(--island-color-ink)]">{cat.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--island-color-ink-muted)]">{cat.short}</p>
                      {locked ? (
                        <p className="mt-2 text-xs text-[#8b6914]">
                          Progression lock: fund debt on the map until this balance hits $0.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:w-44">
                    <span className="text-sm text-[var(--island-color-ink-muted)]">$</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      disabled={locked}
                      value={Number.isFinite(value) ? value : 0}
                      onChange={(e) => setCategory(cat.id, e.target.value)}
                      className={['island-field w-full rounded-xl px-3 py-2 font-mono text-sm outline-none transition', locked ? 'cursor-not-allowed opacity-60' : ''].join(' ')}
                      aria-label={`Dollars for ${cat.label}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <footer className="island-hudBottle sticky bottom-0 z-10 mt-8">
          <div className="island-hudInner flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                Allocated
              </p>
              <p className="font-mono text-lg text-[var(--island-color-ink)]">
                <span className={isZeroBased ? 'text-[var(--island-color-title)]' : ''}>
                  {fmt.format(total)}
                </span>
                <span className="opacity-35"> / </span>
                <span>{fmt.format(annualSalary)}</span>
              </p>
              <p className="island-statusText mt-1 text-sm">
                {isZeroBased ? (
                  <span className="text-[#1a7a8c]">Zero-based ? every dollar assigned.</span>
                ) : remainder > 0 ? (
                  <>
                    <span className="text-[#8b6914]">{fmt.format(remainder)}</span> left to assign
                  </>
                ) : (
                  <>
                    <span className="text-[#c44b36]">{fmt.format(-remainder)}</span> over budget
                  </>
                )}
              </p>
            </div>
            <button className="island-btnShell sm:self-end" disabled={!canSubmit} onClick={handleSubmit}>
              <Check className="size-4" />
              Confirm budget
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
