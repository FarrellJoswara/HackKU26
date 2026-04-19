/**
 * @file "The Box" as an overlay panel on top of Island Run.
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
  AlertTriangle,
  Banknote,
  Bitcoin,
  Briefcase,
  Building2,
  Car,
  Check,
  CreditCard,
  FastForward,
  Gem,
  Home,
  Landmark,
  LineChart,
  Lock,
  Mountain,
  PanelLeftOpen,
  PanelRightClose,
  Pause,
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
import { composeBoxSubmit } from '@/core/finance/boxSubmit';
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
  DEFAULT_WIN_GOAL_USD,
  INVESTED_BALANCE_KEY,
  WIN_GOAL_KEY,
} from '@/core/finance/boxGoalRail';
import { GAME_IDS } from '@/games/registry';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { BoxGoalRail } from '@/ui/components/BoxGoalRail';
import { InfoMark } from '@/ui/components/InfoMark';
import {
  DEFAULT_DIFFICULTY,
  selectIslandRunDifficulty,
} from '@/ui/menu/gameFlow';
import { useBoxValidation } from '@/ui/hooks/useBoxValidation';

import '@/ui/screens/titleHub.css';

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
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);

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
  const difficulty: DifficultyId = selectIslandRunDifficulty(data) ?? DEFAULT_DIFFICULTY;
  const winGoalUsd = readNumber(data, WIN_GOAL_KEY, Number.NaN);
  const investedBalanceUsd = readNumber(data, INVESTED_BALANCE_KEY, 0);

  const [allocations, setAllocations] = useState<Record<BudgetCategoryId, number>>(() => {
    const saved = readAllocations(data);
    return saved ?? emptyAllocations();
  });
  const [activeTab, setActiveTab] = useState<BoxTabId>('essentials');
  const validation = useBoxValidation();

  // Deterministic sync rule: reload allocations from store each time the
  // overlay opens, so panel state always reflects persisted playerData.
  useEffect(() => {
    if (!enabled) return;
    setPauseMenuOpen(false);
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

  // Locked Investments rows would otherwise inflate the denominator
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
      validation.markEditing(id);
    },
    [debtBalance, validation],
  );

  const close = () => {
    mergePlayerData({ [BOX_OVERLAY_FLAG]: false });
  };
  const open = () => mergePlayerData({ [BOX_OVERLAY_FLAG]: true });
  const closePauseMenu = () => setPauseMenuOpen(false);

  /**
   * Demo / playtest shortcut: collapse the player straight into the
   * "financial freedom" state with a sensible seeded portfolio so judges
   * can jump to the late-game economy without grinding early rounds.
   *
   * Concretely:
   *  - zeros high-interest debt and clears the debt-row allocation so
   *    `hasReachedFinancialFreedom` flips true and the Investments tab
   *    unlocks on the next overlay open;
   *  - bumps the running invested balance up to (but not past) the win
   *    goal so the Goal Rail reads "almost home" rather than "complete";
   *  - seeds a richer salary + investment-heavy allocation so Investing
   *    Birds reads non-trivial subcategory funding when it computes
   *    portfolio shares from `playerData`.
   *
   * Navigation is intentionally separate via `startInvestingBirdsDemo`
   * so "Skip to debt free" does not auto-launch a mini-game.
   */
  const SKIP_DEMO_SALARY_USD = 78_000;
  const skipToDebtFree = () => {
    closePauseMenu();
    const goal = Number.isFinite(winGoalUsd) ? winGoalUsd : DEFAULT_WIN_GOAL_USD;
    // Land just shy of the win goal so the Investing Birds round still
    // feels like it's pushing the player over the line.
    const investedTarget = Math.max(investedBalanceUsd, Math.round(goal * 0.85));
    const nextAllocations = {
      ...(readAllocations(data) ?? emptyAllocations()),
      highInterestDebt: 0,
      rent: 22_000,
      food: 8_400,
      emergencyFund: 6_000,
      indexFunds: 18_000,
      individualStocks: 6_000,
      bonds: 9_000,
      cds: 3_600,
      crypto: 5_000,
    };

    mergePlayerData({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
      [BOX_PLAYER_DATA_KEYS.annualSalary]: SKIP_DEMO_SALARY_USD,
      [INVESTED_BALANCE_KEY]: investedTarget,
      [WIN_GOAL_KEY]: goal,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: nextAllocations,
      [BOX_OVERLAY_FLAG]: false,
    });
    setAllocations(nextAllocations);

  };

  const startInvestingBirdsDemo = () => {
    closePauseMenu();
    // Use a fixed seed so the demo plays the same level set every time —
    // judges/devs can rehearse it without surprise board layouts.
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.investingBirds,
    });
  };

  const skipToEnding = () => {
    closePauseMenu();
    mergePlayerData({ [BOX_OVERLAY_FLAG]: false });
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.mountainSuccess,
    });
  };

  const isDebtFree = debtBalance <= EPS;

  const handleSubmit = () => {
    if (!canSubmit) {
      validation.markConfirmAttemptFailed();
      return;
    }
    const { payload, playerDataPatch } = composeBoxSubmit({
      allocations,
      annualSalary,
      debtBalance,
      inflationRate,
      employerMatchProjected,
      currentYear,
      pendingCash,
    });
    eventBus.emit('box:budget:submit', payload);
    mergePlayerData(playerDataPatch);
    validation.reset();
  };

  const tabs: ReadonlyArray<{ id: BoxTabId; label: string; locked: boolean }> = [
    { id: 'essentials', label: 'Essentials & Cash Flow', locked: false },
    { id: 'investments', label: 'Investments', locked: !investmentsUnlocked },
  ];
  const visibleRows = BOX_CATEGORIES.filter((c) => c.tab === activeTab);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 text-[var(--island-color-ink)]">
      {!enabled ? (
        <button
          type="button"
          className="island-openBoxBtn pointer-events-auto absolute bottom-5 left-5"
          onClick={open}
          aria-label="Open The Box — edit your annual budget"
        >
          <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
          <span className="island-openBoxBtn__label">
            <span className="island-openBoxBtn__title">The Box</span>
            <span className="island-openBoxBtn__sub">Edit annual budget</span>
          </span>
        </button>
      ) : null}

      {/*
        Demo shortcuts — anchored top-right of the map so they don't
        overlap the Box panel (right-side aside) once the player opens
        it. The "Skip to ending" button only appears once the player is
        debt-free, mirroring the in-game freedom gate.
      */}
      {!enabled ? (
        <div className="pointer-events-auto absolute right-4 top-4 z-40 flex flex-col items-end gap-2">
          <div className="flex items-center justify-end gap-2">
            {!isDebtFree ? (
              <button
                type="button"
                onClick={skipToDebtFree}
                aria-label="Shortcut: clear high-interest debt"
                className="island-openBoxBtn shrink-0 py-2"
              >
                <FastForward className="size-3.5" aria-hidden />
                <span className="island-openBoxBtn__label">
                  <span className="island-openBoxBtn__title">Skip to debt free</span>
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startInvestingBirdsDemo}
                  aria-label="Shortcut: start Investing Birds"
                  className="island-openBoxBtn shrink-0 py-2"
                >
                  <TrendingUp className="size-3.5" aria-hidden />
                  <span className="island-openBoxBtn__label">
                    <span className="island-openBoxBtn__title">Start investing game</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={skipToEnding}
                  aria-label="Shortcut: skip to the ending cinematic"
                  className="island-openBoxBtn shrink-0 py-2"
                >
                  <Mountain className="size-3.5" aria-hidden />
                  <span className="island-openBoxBtn__label">
                    <span className="island-openBoxBtn__title">Skip to ending</span>
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setPauseMenuOpen((prev) => !prev)}
              aria-expanded={pauseMenuOpen}
              aria-haspopup="dialog"
              aria-label="Open pause menu"
              className="island-openBoxBtn shrink-0 py-2"
            >
              <Pause className="size-3.5" aria-hidden />
              <span className="island-openBoxBtn__label">
                <span className="island-openBoxBtn__title">Pause</span>
              </span>
            </button>
          </div>
          {pauseMenuOpen ? (
            <div
              role="dialog"
              aria-label="Pause menu"
              className="island-paperCard w-[min(280px,90vw)] rounded-2xl border border-[rgba(26,77,92,0.12)] p-3 shadow-lg"
            >
              <p className="px-1 text-[11px] uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                Pause menu
              </p>
              <button
                type="button"
                onClick={closePauseMenu}
                className="island-openBoxBtn mt-2 w-full justify-between py-2"
              >
                <span className="island-openBoxBtn__label">
                  <span className="island-openBoxBtn__title">Resume</span>
                </span>
                <Pause className="size-4 shrink-0" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        Per Box-UI spec: the IslandRun map must remain visible behind the
        overlay. Scrim is now scoped to the right side panel area only
        (with a soft fade leftwards) instead of the full viewport.
      */}
      {enabled ? <div className="island-overlayScrim island-overlayScrim--panel" /> : null}

      {enabled ? (
        <aside
          className="th-hubShell island-hudBottle pointer-events-auto absolute right-4 top-4 h-[calc(100%-2rem)] w-[min(560px,calc(100%-2rem))] overflow-hidden"
          aria-labelledby="thBoxOverlayTitle"
        >
          <div className="island-hudInner island-hudInner--titleHero flex h-full min-h-0 flex-col">
            <div className="border-b border-[rgba(26,77,92,0.12)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="th-eyebrow th-menuEyebrow text-left">
                    Financial freedom · Year {currentYear}
                  </p>
                  <h2
                    id="thBoxOverlayTitle"
                    className="island-title th-titleGradient mt-1 text-left text-2xl"
                  >
                    The Box
                  </h2>
                  <p className="island-statusText th-subtitle mt-2 max-w-md text-left text-sm">
                    {HEADER_STRAPLINE.short}
                  </p>
                </div>
                <button
                  type="button"
                  className="th-btnSettings shrink-0"
                  onClick={close}
                  aria-label="Close The Box overlay"
                >
                  <PanelRightClose className="size-4 shrink-0" aria-hidden />
                  Close
                </button>
              </div>

              <div className="th-titleDivider th-menuDivider my-4" role="presentation" />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="island-paperCard rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--island-color-ink-muted)]">
                    Salary
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#0a6fa3]">
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
                  <p className="mt-1 font-mono text-lg font-semibold text-[#b91c1c]">
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

              <div className="mt-4">
                <BoxGoalRail
                  variant="compact"
                  highInterestDebtBalance={debtBalance}
                  highInterestDebtAllocation={allocations.highInterestDebt ?? 0}
                  winGoalUsd={Number.isFinite(winGoalUsd) ? winGoalUsd : undefined}
                  investedBalanceUsd={investedBalanceUsd}
                />
              </div>

              <nav className="mt-3 flex flex-wrap gap-2" aria-label="Box sections">
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {activeTab === 'investments' && !investmentsUnlocked ? (
                <div className="island-paperCard mb-3 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-5 text-[#8b6914]" aria-hidden />
                    <div>
                      <p className="font-medium text-[var(--island-color-ink)]">
                        {INVESTMENTS_LOCKED.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                        {INVESTMENTS_LOCKED.short}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'essentials' ? (
                <div className="island-paperCard mb-3 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Briefcase className="mt-0.5 size-5 text-[var(--island-color-title)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium text-[var(--island-color-ink)]">
                          {EMPLOYER_MATCH_COPY.title}
                          <InfoMark
                            className="ml-2 align-middle"
                            label="About employer match"
                            placement="bottom"
                            popoverWidth={260}
                          >
                            {EMPLOYER_MATCH_COPY.hint} Match{' '}
                            <strong>{pct.format(matchRate)}</strong>, capped{' '}
                            {pct.format(matchCapPct)}.
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

              <div className="flex flex-col gap-3">
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

            <div className="border-t border-[rgba(26,77,92,0.12)] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  className="th-btnPlay w-full shrink-0 sm:w-auto"
                  aria-disabled={!canSubmit}
                  // Stays clickable while not zero-based so the failed-attempt
                  // path can fire row-level nudges. Re-checks `canSubmit` in
                  // `handleSubmit` before emitting `box:budget:submit`.
                  onClick={handleSubmit}
                  title={canSubmit ? undefined : CONFIRM_COPY.disabledHint}
                  data-state={canSubmit ? 'ready' : 'pending'}
                  style={!canSubmit ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  {CONFIRM_COPY.enabledShort}
                </button>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
