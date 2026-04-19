/**
 * "The Box" as an overlay panel on top of Island Run.
 *
 * This keeps the AGENTS.md contract:
 * - UI stays in `src/ui/` and does not import game implementations.
 * - The overlay is enabled by a `playerData` flag set by the menu.
 *
 * Island Run lives in `src/games/IslandRun/` (no iframe). When the game
 * needs to mutate budget allocations, it emits `island:scenarioChoice`
 * on the typed `eventBus`; the IslandRun React shell applies it to
 * `playerData`, and this overlay re-syncs from `data` automatically.
 */

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Check,
  Lock,
  PanelLeftOpen,
  PanelRightClose,
  PiggyBank,
  Home,
  Utensils,
  Car,
  Sparkles,
  CreditCard,
  TrendingUp,
  Stethoscope,
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
const BOX_OVERLAY_FLAG = 'ui:boxOverlay';

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

export default function TheBoxOverlay({ data }: UIProps<Record<string, unknown>>) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const enabled = Boolean((data as Record<string, unknown>)[BOX_OVERLAY_FLAG]);

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

  // Deterministic sync rule: reload allocations from store each time the
  // overlay opens, so panel state always reflects persisted playerData.
  useEffect(() => {
    if (!enabled) return;
    const saved = readAllocations(data);
    setAllocations(saved ?? emptyAllocations());
  }, [enabled, data]);

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

  const close = () => {
    mergePlayerData({ [BOX_OVERLAY_FLAG]: false });
  };
  const open = () => mergePlayerData({ [BOX_OVERLAY_FLAG]: true });

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
    <div className="pointer-events-none absolute inset-0 z-30">
      {!enabled ? (
        <div className="island-hudBottle pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2">
          <button className="island-boxLauncher" onClick={open} aria-label="Open The Box">
            <PanelLeftOpen className="size-4" />
            The Box
          </button>
        </div>
      ) : null}

      {enabled ? <div className="island-overlayScrim" /> : null}

      {enabled ? (
      <aside className="pointer-events-auto absolute right-4 top-4 h-[calc(100%-2rem)] w-[min(520px,calc(100%-2rem))] overflow-hidden island-hudBottle">
        <div className="island-hudInner flex h-full flex-col">
          <div className="border-b border-[rgba(120,90,50,0.2)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
                  Financial Freedom
                </p>
                <h2 className="island-title mt-1 text-2xl">The Box</h2>
                <p className="island-statusText mt-2 text-sm">
                  Budget while viewing the map. Confirm to emit{' '}
                  <code className="rounded bg-black/10 px-1">box:budget:submit</code>.
                </p>
              </div>
              <button className="island-btnShell" onClick={close} aria-label="Close The Box overlay">
                <PanelRightClose className="size-4" />
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="island-paperCard rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                  Annual salary
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-[var(--island-color-title)]">
                  {fmt.format(annualSalary)}
                </p>
              </div>
              <div className="island-paperCard rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                  Debt
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#c44b36]">
                  {fmt.format(debtBalance)}
                </p>
              </div>
            </div>

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

          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-3">
              {BOX_CATEGORIES.map((cat) => {
                const Icon = categoryIcon[cat.id];
                const locked = cat.lockedUntilDebtFree && !investmentsUnlocked;
                const value = locked ? 0 : allocations[cat.id];

                return (
                  <div key={cat.id} className="island-paperCard rounded-2xl p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                              Locked until high-interest debt is $0.
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
            </div>
          </div>

          <div className="border-t border-[rgba(120,90,50,0.2)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    <span className="text-[#1a7a8c]">Zero-based - every dollar assigned.</span>
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
              <button className="island-btnShell" disabled={!canSubmit} onClick={handleSubmit}>
                <Check className="size-4" />
                Confirm
              </button>
            </div>
          </div>
        </div>
      </aside>
      ) : null}
    </div>
  );
}
