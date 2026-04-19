/**
 * "The Box" — zero-based budgeting UI (Financial Freedom / GAME_DESIGN.md).
 *
 * Architecture (AGENTS.md):
 * - Lives under `src/ui/` only — no imports from `src/games/**`.
 * - Reads/writes `playerData` via Zustand; announces confirmation on the
 *   typed Event Bus (`box:budget:submit`) for logic / map / mini-games.
 *
 * Layout: browser-style tabs:
 *   - "Essentials & Cash Flow" (default)
 *   - "Investments" (locked until high-interest debt = $0)
 *
 * Strict zero-based: `total(allocations) == annualSalary` to confirm.
 * The legacy `investments` aggregate field is recomputed from the five
 * investment subcategories at submit time so older consumers still work.
 *
 * TODO: wire difficulty (Easy/Medium/Hard) to `[VAR_STARTING_INCOME]`.
 * TODO: logic layer should subscribe to `box:budget:submit` and advance to "The Grind".
 */

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
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

  // If debt re-appears mid-session, scrub locked Investments rows + bounce
  // the tab. Employer Match stays — it lives on Essentials and is always
  // available (paycheck-deducted contribution).
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
    <div className="island-pageBg absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8 pb-28">
        <div className="island-hudBottle mb-6">
          <div className="island-hudInner p-5">
            <header className="flex flex-col gap-4 border-b border-[rgba(120,90,50,0.2)] pb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
                    Financial Freedom · Year {currentYear}
                  </p>
                  <h1 className="island-title mt-1 text-3xl">The Box</h1>
                  <p className="island-statusText mt-3 max-w-md text-sm">
                    Allocate <strong>every dollar</strong> of salary across your categories.
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="island-paperCard rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Annual salary
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-[var(--island-color-title)]">
                    {fmt.format(annualSalary)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                    {pendingCash > EPS ? (
                      <>
                        +{' '}
                        <span className="font-mono text-[#8b6914]">
                          {fmt.format(pendingCash)}
                        </span>{' '}
                        pending cash
                      </>
                    ) : (
                      <>[VAR_STARTING_INCOME]</>
                    )}
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
                    Unlock Investments at $0
                  </p>
                </div>
                <div className="island-paperCard rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Inflation (this year)
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-[#8b6914]">
                    {pct.format(inflationRate)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                    Costs scale by (1 + inflation)
                  </p>
                </div>
              </div>
            </header>

            {/* Browser-style tabs */}
            <nav className="mt-5 flex flex-wrap gap-2" aria-label="Box sections">
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
        </div>

        {/* Investments tab — locked notice */}
        {activeTab === 'investments' && !investmentsUnlocked ? (
          <div className="island-hudBottle mb-3">
            <div className="island-hudInner p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 size-5 text-[#8b6914]" />
                <div>
                  <p className="font-medium text-[var(--island-color-ink)]">Investments locked</p>
                  <p className="mt-1 text-sm text-[var(--island-color-ink-muted)]">
                    Pay your high-interest debt down to $0 to unlock Index Funds, Individual
                    Stocks, Bonds, CDs, and Crypto. (Employer Match contributions still happen
                    on the Essentials tab — match dollars are held until you unlock here.)
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Essentials tab — employer match projection card (always available) */}
        {activeTab === 'essentials' ? (
          <div className="island-hudBottle mb-3">
            <div className="island-hudInner flex items-start gap-3 p-4">
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
                  Your contribution in the <strong>Employer Match</strong> row deducts from salary
                  (counts in zero-based). Later in the year you also get{' '}
                  <strong>{pct.format(matchRate)}</strong> match on top, capped at{' '}
                  {pct.format(matchCapPct)} of salary ({fmt.format(matchCapPct * annualSalary)}).
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="flex flex-col gap-3" aria-label={`Budget rows — ${activeTab}`}>
          {visibleRows.map((cat) => {
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
                          Locked until high-interest debt hits $0.
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

        {/* Investing total readout */}
        {activeTab === 'investments' && investmentsUnlocked ? (
          <p className="mt-3 text-right text-xs text-[var(--island-color-ink-muted)]">
            Investing this year: <span className="font-mono">{fmt.format(investingTotal)}</span>
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
