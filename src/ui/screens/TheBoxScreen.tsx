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
 * Difficulty seeds `annualSalary` + `highInterestDebtBalance` via
 * `NewGameDifficultyScreen` (see `DIFFICULTY_INCOME_USD` /
 * `DIFFICULTY_DEBT_USD` in `core/campaign/campaignKeys.ts`). The campaign
 * router (`core/campaign/initCampaign`) listens for `box:budget:submit`
 * and advances to Island Run.
 */

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  AlertTriangle,
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
import {
  CONFIRM_COPY,
  EMPLOYER_MATCH_COPY,
  FOOTER_STATUS,
  HEADER_STRAPLINE,
  INVESTMENTS_LOCKED,
  ROW_BELOW_BAND,
  ROW_INFO,
} from '@/core/finance/boxCopy';
import {
  evaluateBand,
  type DifficultyId,
  type GuidedCategoryId,
} from '@/core/finance/budgetGuides';
import {
  INVESTED_BALANCE_KEY,
  WIN_GOAL_KEY,
} from '@/core/finance/boxGoalRail';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { BoxGoalRail } from '@/ui/components/BoxGoalRail';
import { InfoMark } from '@/ui/components/InfoMark';
import { TitleHubDecor } from '@/ui/components/TitleHubDecor';
import { useBoxValidation } from '@/ui/hooks/useBoxValidation';
import {
  DEFAULT_DIFFICULTY,
  PLAYER_KEYS,
  selectIslandRunDifficulty,
} from '@/ui/menu/gameFlow';

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
  const difficulty: DifficultyId = selectIslandRunDifficulty(data) ?? DEFAULT_DIFFICULTY;
  const winGoalUsd = readNumber(data, WIN_GOAL_KEY, Number.NaN);
  const investedBalanceUsd = readNumber(data, INVESTED_BALANCE_KEY, 0);

  const [allocations, setAllocations] = useState<Record<BudgetCategoryId, number>>(() => {
    const saved = readAllocations(data);
    return saved ?? emptyAllocations();
  });
  const [activeTab, setActiveTab] = useState<BoxTabId>('essentials');
  const validation = useBoxValidation();

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

  // "Funded" only counts categories the player can actually fund right
  // now. Locked Investments rows would otherwise inflate the denominator
  // (15) while only 10 are reachable, which read as broken progress.
  const fundableCategories = useMemo(
    () =>
      BOX_CATEGORIES.filter(
        (c) =>
          c.id !== 'investments' &&
          !(c.lockedUntilDebtFree && !investmentsUnlocked),
      ),
    [investmentsUnlocked],
  );
  const fundedCount = useMemo(
    () => fundableCategories.filter((c) => (allocations[c.id] ?? 0) > EPS).length,
    [fundableCategories, allocations],
  );
  const fundableCount = fundableCategories.length;

  const setCategory = useCallback(
    (id: BudgetCategoryId, raw: string) => {
      const n = Math.max(0, Number.parseFloat(raw) || 0);
      setAllocations((prev) => {
        if (isInvestmentSubcategory(id) && debtBalance > EPS) return prev;
        return { ...prev, [id]: n };
      });
      // Editing re-arms blur — don't nag while the user is fixing a row.
      validation.markEditing(id);
    },
    [debtBalance, validation],
  );

  const handleSubmit = () => {
    if (!canSubmit) {
      // Surface row-level + banner nudges after first failed Confirm.
      validation.markConfirmAttemptFailed();
      return;
    }
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
      // Belt-and-suspenders: any successful Box submit means there is
      // definitely a save in progress. Setting this here covers older
      // saves that predate the `NewGameDifficultyScreen` fix and any
      // future entry path that bypasses the difficulty picker (dev
      // shortcuts, deep links, debug toggles). Once true, the next time
      // the user opens the site the title hub's Continue button is
      // enabled and resumes from this exact persisted state.
      [PLAYER_KEYS.islandRunHasSave]: true,
    });
    validation.reset();
  };

  const tabs: ReadonlyArray<{ id: BoxTabId; label: string; locked: boolean }> = [
    { id: 'essentials', label: 'Essentials & Cash Flow', locked: false },
    { id: 'investments', label: 'Investments', locked: !investmentsUnlocked },
  ];

  const visibleRows = BOX_CATEGORIES.filter((c) => c.tab === activeTab);

  return (
    <div className="th-titleHub th-menuScreen th-boxRoute absolute inset-0 overflow-y-auto text-[var(--island-color-ink)]">
      <TitleHubDecor />

      <div className="th-content pb-28">
        <div className="th-heroCard">
          <div className="island-hudBottle w-full">
            <div
              className="island-hudInner island-hudInner--titleHero px-6 py-8 text-left sm:px-8"
              role="region"
              aria-labelledby="thBoxTitle"
            >
              <header className="flex flex-col gap-4 border-b border-[rgba(26,77,92,0.12)] pb-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="th-eyebrow th-menuEyebrow">
                      Financial freedom · Year {currentYear}
                    </p>
                    <h1
                      id="thBoxTitle"
                      className="island-title th-titleGradient mt-1 text-3xl md:text-[2rem]"
                    >
                      The Box
                    </h1>
                  </div>
                  <button
                    type="button"
                    className="th-btnSettings shrink-0"
                    onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
                  >
                    <ArrowLeft className="size-4 shrink-0" aria-hidden />
                    Menu
                  </button>
                </div>

                <div className="th-titleDivider th-menuDivider" role="presentation" />

                <p className="island-statusText th-subtitle max-w-xl">
                  {HEADER_STRAPLINE.full}
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="island-paperCard rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                      Annual salary
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-[#0a6fa3]">
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
                        <>
                          Difficulty:{' '}
                          <span className="font-medium capitalize text-[var(--island-color-ink)]">
                            {difficulty}
                          </span>{' '}
                          · this year's pay to allocate
                        </>
                      )}
                    </p>
                  </div>
                  <div className="island-paperCard rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                      High-interest debt
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-[#b91c1c]">
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

              <div className="mt-5">
                <BoxGoalRail
                  highInterestDebtBalance={debtBalance}
                  highInterestDebtAllocation={allocations.highInterestDebt ?? 0}
                  winGoalUsd={Number.isFinite(winGoalUsd) ? winGoalUsd : undefined}
                  investedBalanceUsd={investedBalanceUsd}
                />
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
                      {t.locked ? <Lock className="size-4" aria-hidden /> : null}
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
                  {fundableCategories.map((cat) => (
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

              {activeTab === 'investments' && !investmentsUnlocked ? (
                <div className="island-paperCard mt-5 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-5 shrink-0 text-[#8b6914]" aria-hidden />
                    <div>
                      <p className="font-medium text-[var(--island-color-ink)]">
                        {INVESTMENTS_LOCKED.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--island-color-ink-muted)]">
                        {INVESTMENTS_LOCKED.long}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'essentials' ? (
                <div className="island-paperCard mt-3 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Briefcase className="mt-0.5 size-5 shrink-0 text-[var(--island-color-title)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <p className="font-medium text-[var(--island-color-ink)]">
                          {EMPLOYER_MATCH_COPY.title}
                          <InfoMark
                            className="ml-2 align-middle"
                            label="About employer match"
                            placement="bottom"
                            popoverWidth={280}
                          >
                            {EMPLOYER_MATCH_COPY.hint} Match rate{' '}
                            <strong>{pct.format(matchRate)}</strong>, capped at{' '}
                            {pct.format(matchCapPct)} of salary (
                            {fmt.format(matchCapPct * annualSalary)}).
                          </InfoMark>
                        </p>
                        <p className="font-mono text-sm text-[var(--island-color-title)]">
                          +{fmt.format(employerMatchProjected)} / yr
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                        {EMPLOYER_MATCH_COPY.hintShort}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <section className="mt-6 flex flex-col gap-3" aria-label={`Budget rows — ${activeTab}`}>
                {visibleRows.map((cat) => {
                  const Icon = categoryIcon[cat.id];
                  const locked = cat.lockedUntilDebtFree && !investmentsUnlocked;
                  const value = locked ? 0 : allocations[cat.id];
                  const info = ROW_INFO[cat.id];
                  const bandStatus = evaluateBand(
                    cat.id,
                    value ?? 0,
                    { cashToAllocate, isLocked: locked },
                    difficulty,
                  );
                  const showWarn =
                    !locked &&
                    bandStatus === 'below' &&
                    validation.shouldShowFor(cat.id);
                  const warnCopy = showWarn
                    ? ROW_BELOW_BAND[cat.id as GuidedCategoryId]
                    : null;

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
                            {locked ? <Lock className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium leading-tight text-[var(--island-color-ink)]">
                                {cat.label}
                              </p>
                              {info ? (
                                <InfoMark
                                  label={`About ${cat.label}`}
                                  placement="bottom"
                                >
                                  {info}
                                </InfoMark>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--island-color-ink-muted)]">
                              {cat.short}
                            </p>
                            {locked ? (
                              <p className="mt-2 text-xs text-[#8b6914]">
                                {INVESTMENTS_LOCKED.rowSuffix}
                              </p>
                            ) : null}
                            {warnCopy ? (
                              <p className="mt-2 flex items-center gap-1 text-xs text-[#8b6914]">
                                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                                <span>{warnCopy}</span>
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
                            onBlur={() => validation.markBlurred(cat.id)}
                            className={['island-field w-full rounded-xl px-3 py-2 font-mono text-sm outline-none transition', locked ? 'cursor-not-allowed opacity-60' : ''].join(' ')}
                            aria-label={`Dollars for ${cat.label}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

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

              <div className="mt-8 flex flex-col gap-4 border-t border-[rgba(26,77,92,0.12)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Allocated
                  </p>
                  <p className="font-mono text-lg text-[var(--island-color-ink)]">
                    <span className={isZeroBased ? 'font-semibold text-[var(--island-color-title)]' : ''}>
                      {fmt.format(total)}
                    </span>
                    <span className="opacity-35"> / </span>
                    <span>{fmt.format(cashToAllocate)}</span>
                  </p>
                  <p className="island-statusText mt-1 text-sm">
                    {isZeroBased ? (
                      <span className="text-[#1a7a8c]">
                        {pendingCash > EPS
                          ? FOOTER_STATUS.zeroBasedWithPending
                          : FOOTER_STATUS.zeroBased}
                      </span>
                    ) : remainder > 0 ? (
                      <>
                        <span className="text-[#8b6914]">{fmt.format(remainder)}</span>{' '}
                        {FOOTER_STATUS.remainingPrefix}
                        {pendingCash > EPS ? (
                          <> · {FOOTER_STATUS.pendingNote} {fmt.format(pendingCash)}</>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="text-[#c44b36]">{fmt.format(-remainder)}</span>{' '}
                        {FOOTER_STATUS.overPrefix}
                      </>
                    )}
                  </p>
                  {!canSubmit ? (
                    <p className="island-hintText mt-1 text-xs">{CONFIRM_COPY.disabledHint}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="th-btnPlay w-full shrink-0 sm:w-auto sm:self-end"
                  aria-disabled={!canSubmit}
                  // Note: button stays clickable while disabled-looking so the
                  // failed-Confirm path can fire row-level nudges. We re-check
                  // `canSubmit` inside `handleSubmit` before emitting.
                  onClick={handleSubmit}
                  title={canSubmit ? undefined : CONFIRM_COPY.disabledHint}
                  data-state={canSubmit ? 'ready' : 'pending'}
                  style={!canSubmit ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  {CONFIRM_COPY.enabled}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
