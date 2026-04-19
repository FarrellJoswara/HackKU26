/**
 * "The Box" as an overlay panel on top of Island Run.
 *
 * This keeps the AGENTS.md contract:
 * - UI stays in `src/ui/` and does not import game implementations.
 * - The overlay is enabled by a `playerData` flag set by the menu.
 *
 * Mirrors `TheBoxScreen.tsx`:
 *   - browser-style tabs (Essentials / Investments)
 *   - investment subcategories (Index Funds / Stocks / Bonds / CDs / Crypto)
 *   - employer match info card (bonus, not from salary)
 *   - inflation header chip
 *
 * Island Run lives in `src/games/IslandRun/` (no iframe). When the game
 * needs to mutate budget allocations, it emits `island:scenarioChoice`
 * on the typed `eventBus`; the IslandRun React shell applies it to
 * `playerData`, and this overlay re-syncs from `data` automatically.
 */

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Banknote,
  Bitcoin,
  Briefcase,
  Building2,
  Car,
  Check,
  CreditCard,
  Gem,
  Home,
  Landmark,
  LineChart,
  Lock,
  PanelLeftOpen,
  PanelRightClose,
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
  effectiveCashToAllocate,
  emptyAllocations,
  isInvestmentSubcategory,
  projectEmployerMatch,
  readAllocations,
  readNumber,
  sumInvestmentSubcategories,
  sumZeroBasedAllocations,
  type BoxTabId,
  type BudgetCategoryId,
} from '@/core/budgetTypes';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const pct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const EPS = 0.01;
const BOX_OVERLAY_FLAG = 'ui:boxOverlay';

const categoryIcon: Record<BudgetCategoryId, ComponentType<{ className?: string }>> = {
  emergencyFund: PiggyBank,
  rent: Home,
  food: Utensils,
  transportation: Car,
  miscFun: Sparkles,
  highInterestDebt: CreditCard,
  medical: Stethoscope,
  personal: Wallet,
  savings: Banknote,
  investments: TrendingUp,
  indexFunds: LineChart,
  individualStocks: Building2,
  bonds: Landmark,
  cds: Gem,
  crypto: Bitcoin,
  employerMatch: Briefcase,
};

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
  const inflationRate = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.currentInflationRate,
    BOX_DEFAULTS.currentInflationRate,
  );
  const matchRate = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.employerMatchRate,
    BOX_DEFAULTS.employerMatchRate,
  );
  const matchCapPct = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary,
    BOX_DEFAULTS.employerMatchCapPctSalary,
  );
  const currentYear = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.currentYear,
    BOX_DEFAULTS.currentYear,
  );
  const pendingCash = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.pendingCashToAllocate,
    BOX_DEFAULTS.pendingCashToAllocate,
  );
  const cashToAllocate = effectiveCashToAllocate({
    annualSalary,
    pendingCashToAllocate: pendingCash,
  });
  const investmentsUnlocked = debtBalance <= EPS;

  const [allocations, setAllocations] = useState<Record<BudgetCategoryId, number>>(() => {
    const saved = readAllocations(data);
    return saved ?? emptyAllocations();
  });
  const [activeTab, setActiveTab] = useState<BoxTabId>('essentials');

  // Deterministic sync rule: reload allocations from store each time the
  // overlay opens, so panel state always reflects persisted playerData.
  useEffect(() => {
    if (!enabled) return;
    const saved = readAllocations(data);
    setAllocations(saved ?? emptyAllocations());
  }, [enabled, data]);

  useEffect(() => {
    if (investmentsUnlocked) return;
    setAllocations((a) => ({
      ...a,
      indexFunds: 0,
      individualStocks: 0,
      bonds: 0,
      cds: 0,
      crypto: 0,
    }));
    if (activeTab === 'investments') setActiveTab('essentials');
  }, [investmentsUnlocked, activeTab]);

  const total = useMemo(() => sumZeroBasedAllocations(allocations), [allocations]);
  const remainder = cashToAllocate - total;
  const isZeroBased = Math.abs(remainder) < EPS;
  const canSubmit = isZeroBased && cashToAllocate > 0;

  const investingTotal = useMemo(
    () => sumInvestmentSubcategories(allocations),
    [allocations],
  );
  const employerMatchProjected = useMemo(
    () =>
      projectEmployerMatch({
        allocations,
        annualSalary,
        matchRate,
        capPctSalary: matchCapPct,
      }),
    [allocations, annualSalary, matchRate, matchCapPct],
  );

  const fundedCount = useMemo(
    () =>
      BOX_CATEGORIES.filter(
        (c) => c.id !== 'investments' && (allocations[c.id] ?? 0) > EPS,
      ).length,
    [allocations],
  );
  const fundableCount = BOX_CATEGORIES.filter((c) => c.id !== 'investments').length;

  const setCategory = useCallback(
    (id: BudgetCategoryId, raw: string) => {
      const n = Math.max(0, Number.parseFloat(raw) || 0);
      setAllocations((prev) => {
        if (isInvestmentSubcategory(id) && debtBalance > EPS) return prev;
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
    const investmentsAggregate = sumInvestmentSubcategories(allocations);
    const finalAllocations: Record<BudgetCategoryId, number> = {
      ...allocations,
      investments: investmentsUnlocked ? investmentsAggregate : 0,
    };
    if (!investmentsUnlocked) {
      finalAllocations.indexFunds = 0;
      finalAllocations.individualStocks = 0;
      finalAllocations.bonds = 0;
      finalAllocations.cds = 0;
      finalAllocations.crypto = 0;
    }
    const payload = {
      allocations: finalAllocations,
      annualSalary,
      highInterestDebtBalanceAtSubmit: debtBalance,
      inflationRate,
      employerMatchProjected,
      year: currentYear,
      pendingCashConsumed: pendingCash,
    };
    eventBus.emit('box:budget:submit', payload);
    mergePlayerData({
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: payload.allocations,
      [BOX_PLAYER_DATA_KEYS.pendingCashToAllocate]: 0,
      boxBudgetSubmittedAt: Date.now(),
    });
  };

  const tabs: ReadonlyArray<{ id: BoxTabId; label: string; locked: boolean }> = [
    { id: 'essentials', label: 'Essentials & Cash Flow', locked: false },
    { id: 'investments', label: 'Investments', locked: !investmentsUnlocked },
  ];
  const visibleRows = BOX_CATEGORIES.filter((c) => c.tab === activeTab);

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
        <aside className="pointer-events-auto absolute right-4 top-4 h-[calc(100%-2rem)] w-[min(560px,calc(100%-2rem))] overflow-hidden island-hudBottle">
          <div className="island-hudInner flex h-full flex-col">
            <div className="border-b border-[rgba(120,90,50,0.2)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
                    Financial Freedom · Year {currentYear}
                  </p>
                  <h2 className="island-title mt-1 text-2xl">The Box</h2>
                  <p className="island-statusText mt-2 text-sm">
                    Every dollar of salary lands somewhere. Confirm to emit{' '}
                    <code className="rounded bg-black/10 px-1">box:budget:submit</code>.
                  </p>
                </div>
                <button className="island-btnShell" onClick={close} aria-label="Close The Box overlay">
                  <PanelRightClose className="size-4" />
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="island-paperCard rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Salary
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[var(--island-color-title)]">
                    {fmt.format(annualSalary)}
                  </p>
                  {pendingCash > EPS ? (
                    <p className="mt-1 text-[10px] text-[#8b6914]">
                      + {fmt.format(pendingCash)} pending
                    </p>
                  ) : null}
                </div>
                <div className="island-paperCard rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Debt
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#c44b36]">
                    {fmt.format(debtBalance)}
                  </p>
                </div>
                <div className="island-paperCard rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Inflation
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#8b6914]">
                    {pct.format(inflationRate)}
                  </p>
                </div>
              </div>

              <nav className="mt-4 flex flex-wrap gap-2" aria-label="Box sections">
                {tabs.map((t) => {
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={t.locked}
                      aria-pressed={isActive}
                      onClick={() => !t.locked && setActiveTab(t.id)}
                      className={[
                        'island-btnShell',
                        isActive ? 'ring-2 ring-[var(--island-color-title)]' : 'opacity-80',
                        t.locked ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                    >
                      {t.locked ? <Lock className="size-4" /> : null}
                      {t.label}
                    </button>
                  );
                })}
              </nav>

              <div className="island-paperCard mt-4 rounded-xl p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--island-color-ink-muted)]">
                  Funding progress
                </p>
                <div className="island-progressStrip">
                  {BOX_CATEGORIES.filter((c) => c.id !== 'investments').map((cat) => (
                    <span
                      key={cat.id}
                      className={['island-progressSeg', (allocations[cat.id] ?? 0) > EPS ? 'is-active' : ''].join(' ')}
                    />
                  ))}
                </div>
                <p className="island-hintText mt-2">
                  Funded categories: {fundedCount} / {fundableCount}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'investments' && !investmentsUnlocked ? (
                <div className="island-paperCard mb-3 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-5 text-[#8b6914]" />
                    <div>
                      <p className="font-medium text-[var(--island-color-ink)]">Investments locked</p>
                      <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                        Clear high-interest debt to unlock Index Funds, Stocks, Bonds, CDs, Crypto.
                        Employer Match still works from Essentials.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'essentials' ? (
                <div className="island-paperCard mb-3 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Briefcase className="mt-0.5 size-5 text-[var(--island-color-title)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium text-[var(--island-color-ink)]">
                          Employer Match — projected bonus
                        </p>
                        <p className="font-mono text-sm text-[var(--island-color-title)]">
                          +{fmt.format(employerMatchProjected)} / yr
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                        Contribution row deducts from salary; later you also get{' '}
                        {pct.format(matchRate)} match, capped at{' '}
                        {pct.format(matchCapPct)} of salary.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                {visibleRows.map((cat) => {
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

              {activeTab === 'investments' && investmentsUnlocked ? (
                <p className="mt-3 text-right text-xs text-[var(--island-color-ink-muted)]">
                  Investing this year:{' '}
                  <span className="font-mono">{fmt.format(investingTotal)}</span>
                  {employerMatchProjected > 0 ? (
                    <>
                      {' '}+{' '}
                      <span className="font-mono text-[var(--island-color-title)]">
                        {fmt.format(employerMatchProjected)}
                      </span>{' '}
                      match
                    </>
                  ) : null}
                </p>
              ) : null}
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
                    <span>{fmt.format(cashToAllocate)}</span>
                  </p>
                  <p className="island-statusText mt-1 text-sm">
                    {isZeroBased ? (
                      <span className="text-[#1a7a8c]">
                        Zero-based — every dollar assigned
                        {pendingCash > EPS ? ' (incl. pending cash)' : ''}.
                      </span>
                    ) : remainder > 0 ? (
                      <>
                        <span className="text-[#8b6914]">{fmt.format(remainder)}</span> left to assign
                        {pendingCash > EPS ? (
                          <> · includes {fmt.format(pendingCash)} pending</>
                        ) : null}
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
