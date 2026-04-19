import {
  BarChart3,
  Bitcoin,
  Flame,
  Heart,
  HelpCircle,
  Pause,
  Play,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  birdsForLevelType,
  categoryAccent,
  categoryLabel,
  CATEGORY_META,
  NOTIONAL_PORTFOLIO_BASE,
  portfolioReturnPct,
  shareOf,
  SLICE_RETURN_BOUNDS,
  sliceReturnRangeLabel,
  sumAllocation,
  sumPortfolioValue,
  towerHeightFromShare,
} from './config';
import type {
  Allocation,
  Block,
  DamageFloater,
  DustPuff,
  InvestingBirdsState,
  LevelDef,
  LevelType,
  ScoreFloater,
  Settings,
} from './types';

interface InvestingBirdsOverlayProps {
  state: InvestingBirdsState;
  allocation: Allocation;
  levels: LevelDef[];
  currentLevelIndex: number;
  currentLevel: LevelDef | null;
  nextLevel: LevelDef | null;
  birdsRemaining: number;
  birdsForRound: number;
  score: number;
  scoreByType: Record<LevelType, number>;
  outcome: 'win' | 'loss' | null;
  roundOutcome: 'cleared' | 'failed' | null;
  elapsedSec: number;
  scoreFloaters: ScoreFloater[];
  damageFloaters: DamageFloater[];
  dustPuffs: DustPuff[];
  lastHeavyHitAtSec: number | null;
  combo: number;
  lastComboAtSec: number | null;
  paused: boolean;
  settingsOpen: boolean;
  settings: Settings;
  initialPortfolioTotal: number;
  investmentValueByType: Record<LevelType, number>;
  lastRoundAppliedReturnPct: number | null;
  roundStartBlockCount: number;
  /** Same source as `ROUND_END` payload: `sim.scoredBlocks.size` (portfolio return fraction). */
  simScoredBlockCount: number;
  /** Sum of max HP at tower spawn — keeps the bar from jumping when blocks are removed. */
  roundStartTotalMaxHealth: number;
  blocks: Block[];
  pullRatio: number;
  showAimHint: boolean;
  onAllocationChange: (next: Allocation) => void;
  onStart: () => void;
  onReturnMenu: () => void;
  onTogglePause: () => void;
  onOpenSettings: (open: boolean) => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  /** V2: convert world coords to CSS (left, top) strings for floaters. */
  projectWorld: (worldX: number, worldY: number) => { leftPx: number; topPx: number };
}

const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300/80 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white shadow-lg shadow-indigo-900/30';
const btnGhost =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium tracking-wide select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300/80 bg-white/10 hover:bg-white/20 text-white/95 border border-white/25 backdrop-blur';
const chipBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors bg-white/10 hover:bg-white/20 border border-white/20 text-white/95 focus:outline-none focus:ring-2 focus:ring-indigo-300/80';

function CategoryIcon({ type, className = '' }: { type: LevelType; className?: string }) {
  if (type === 'stocks') return <Target className={className} />;
  if (type === 'etfs') return <BarChart3 className={className} />;
  if (type === 'bonds') return <Shield className={className} />;
  return <Bitcoin className={className} />;
}

function CategoryBadge({ type, label }: { type: LevelType; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: categoryAccent(type) }}
    >
      <CategoryIcon type={type} className="size-3" />
      {label ?? categoryLabel(type)}
    </span>
  );
}

function SliderRow({
  type,
  label,
  value,
  icon,
  colorClass,
  onChange,
  tooltip,
  focusId,
}: {
  type: LevelType;
  label: string;
  value: number;
  icon: ReactNode;
  colorClass: string;
  onChange: (v: number) => void;
  tooltip: string;
  focusId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="flex flex-col gap-1" id={focusId}>
      <span className="flex items-center justify-between text-xs uppercase tracking-wide text-white/80">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className={colorClass}>{icon}</span>
          {label}
          <button
            type="button"
            className="text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
            aria-label={`${label} info`}
            onClick={(e) => {
              e.preventDefault();
              setOpen((x) => !x);
            }}
            onBlur={() => setOpen(false)}
          >
            <HelpCircle className="size-3" />
          </button>
        </span>
        <span className="font-bold tabular-nums text-white">{value}%</span>
      </span>
      {open ? (
        <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium leading-snug text-white/85">
          {tooltip}
        </span>
      ) : null}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label={`${label} allocation`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        style={{ colorScheme: 'dark' }}
        data-category={type}
      />
    </label>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    return Array.from({ length: 48 }).map((_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 1.4 + Math.random() * 1.1,
      size: 6 + Math.random() * 8,
      color: ['#22c55e', '#facc15', '#ef4444', '#38bdf8', '#ffffff', '#f472b6'][
        Math.floor(Math.random() * 6)
      ],
      rot: Math.random() * 360,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.key}
          className="absolute top-[-8%] block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animation: `ibConfettiFall ${p.dur}s ease-in forwards`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes ibConfettiFall {
          to { transform: translateY(110vh) rotate(720deg); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

function useTweenedNumber(value: number, ms = 450): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    fromRef.current = shown;
    startRef.current = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setShown(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
  return Math.round(shown);
}

/** Animated donut using conic-gradient (P16 via CSS transition). */
function PortfolioDonut({
  allocation,
  onFocusCategory,
}: {
  allocation: Allocation;
  onFocusCategory?: (t: LevelType) => void;
}) {
  const total = sumAllocation(allocation);
  if (total <= 0) {
    return (
      <div className="flex size-28 items-center justify-center rounded-full border border-dashed border-white/20 text-center text-[10px] font-medium leading-tight text-white/60">
        Move the sliders
      </div>
    );
  }
  const order: LevelType[] = ['stocks', 'etfs', 'bonds', 'crypto'];
  let cursor = 0;
  const labelAngles: Array<{ t: LevelType; mid: number; p: number }> = [];
  const stops = order
    .filter((t) => allocation[t] > 0)
    .map((t) => {
      const p = (allocation[t] / total) * 100;
      const from = cursor;
      cursor += p;
      labelAngles.push({ t, mid: (from + cursor) / 2, p });
      return `${categoryAccent(t)} ${from}% ${cursor}%`;
    })
    .join(', ');
  const sum = cursor;
  const bg = `conic-gradient(${stops}${sum < 100 ? `, rgba(255,255,255,0.08) ${sum}% 100%` : ''})`;
  return (
    <div className="relative size-32">
      <div
        className="size-32 rounded-full shadow-inner"
        style={{ background: bg, transition: 'background 0.4s ease-out' }}
        aria-hidden
      />
      <div className="absolute inset-3 rounded-full bg-slate-950/85" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
            Total
          </div>
          <div className="text-lg font-extrabold tabular-nums text-white">{total}%</div>
        </div>
      </div>
      {/* U12: small label chips around donut */}
      {labelAngles.map((seg) => {
        const rad = (seg.mid / 100) * Math.PI * 2 - Math.PI / 2;
        const r = 72;
        const x = 64 + Math.cos(rad) * r;
        const y = 64 + Math.sin(rad) * r;
        return (
          <button
            key={seg.t}
            type="button"
            onClick={() => onFocusCategory?.(seg.t)}
            className="pointer-events-auto absolute inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white shadow"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              background: categoryAccent(seg.t),
            }}
            aria-label={`${categoryLabel(seg.t)} ${Math.round(seg.p)}%`}
          >
            {Math.round(seg.p)}%
          </button>
        );
      })}
    </div>
  );
}

function TowerMinimap({
  allocation,
  onFocusCategory,
}: {
  allocation: Allocation;
  onFocusCategory?: (t: LevelType) => void;
}) {
  const order: LevelType[] = ['stocks', 'etfs', 'bonds', 'crypto'];
  const rows = order
    .map((t) => ({ type: t, share: shareOf(allocation, t) }))
    .filter((r) => r.share > 0);
  if (rows.length === 0) return null;
  return (
    <div className="relative flex items-end justify-around gap-1 overflow-hidden rounded-lg border border-white/10 bg-black/25 p-2">
      {/* G21: tiny animated bird sprite hopping across the minimap. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1 top-2 inline-block size-3 rounded-full bg-red-500"
        style={{
          animation: 'ibBirdHop 3.2s ease-in-out infinite',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
        }}
      >
        <span
          className="absolute right-[1px] top-[2px] block size-[3px] rounded-full bg-white"
          aria-hidden
        />
      </span>
      {rows.map((r) => {
        const h = 10 + towerHeightFromShare(r.share) * 4;
        return (
          <button
            key={r.type}
            type="button"
            onClick={() => onFocusCategory?.(r.type)}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label={`Focus ${categoryLabel(r.type)}`}
          >
            <div
              className="w-4 rounded-sm"
              style={{
                height: h,
                background: categoryAccent(r.type),
                boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.25)',
              }}
            />
            <CategoryIcon type={r.type} className="size-3 text-white/85" />
          </button>
        );
      })}
    </div>
  );
}

const PRESETS: Array<{ id: string; label: string; emoji: string; alloc: Allocation }> = [
  { id: 'aggressive', label: 'Aggressive', emoji: '🚀', alloc: { stocks: 50, etfs: 20, bonds: 5, crypto: 25 } },
  { id: 'balanced', label: 'Balanced', emoji: '⚖️', alloc: { stocks: 30, etfs: 40, bonds: 25, crypto: 5 } },
  { id: 'conservative', label: 'Conservative', emoji: '🛡️', alloc: { stocks: 15, etfs: 35, bonds: 45, crypto: 5 } },
  { id: 'crypto', label: 'Crypto-Heavy', emoji: '🪙', alloc: { stocks: 15, etfs: 15, bonds: 5, crypto: 65 } },
];

const TOOLTIPS: Record<LevelType, string> = {
  stocks:
    'Individual stocks: high reward, high volatility. Wide return range — clear more to push toward the upside.',
  etfs:
    'ETFs: five mini-towers. Each roll gets a random difficulty (height + ice/wood/stone mix from easy to hard).',
  bonds: 'Bonds: steady, low risk. Short, dense towers — the slice always earns +4% (no ramp).',
  crypto:
    'Crypto: wild swings — tall narrow ice tower with a few stone anchors. One bird; slice return ramps −100% to +100%.',
};

const DID_YOU_KNOW: string[] = [
  'Diversified ETFs reduce risk by spreading across many companies.',
  'Historically, bonds move inversely to stocks, cushioning portfolios.',
  'Crypto is volatile — allocate only what you can afford to lose.',
  'Dollar-cost averaging beats most market-timing strategies.',
  'The S&P 500 has returned ~7–8% real annualized over the long run.',
];

function matchPreset(a: Allocation): string | null {
  for (const p of PRESETS) {
    if (
      p.alloc.stocks === a.stocks &&
      p.alloc.etfs === a.etfs &&
      p.alloc.bonds === a.bonds &&
      p.alloc.crypto === a.crypto
    ) {
      return p.id;
    }
  }
  return null;
}

/** Compute a 1-3 star rating based on birds remaining. */
function computeStars(birdsRemaining: number, birdsForRound: number): 0 | 1 | 2 | 3 {
  if (birdsForRound <= 0) return 1;
  const ratio = birdsRemaining / birdsForRound;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
}

/** Letter grade from final portfolio vs starting notional (G12). */
function computeLetterGrade(score: number, initialPortfolio: number): string {
  if (initialPortfolio <= 0) return 'F';
  const ratio = score / initialPortfolio;
  if (ratio >= 1.12) return 'S';
  if (ratio >= 1.05) return 'A';
  if (ratio >= 1.0) return 'B';
  if (ratio >= 0.95) return 'C';
  return 'D';
}

function normalizeAngle(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function isSettledGroundDebris(b: Block): boolean {
  const bottom = b.position.y - b.height / 2;
  const grounded = bottom <= 0.08;
  const settled = b.velocity.lengthSq() < 0.08 && !b.falling;
  const visiblyFallen =
    Math.abs(normalizeAngle(b.rotation)) > 0.45 ||
    b.initialY - b.position.y > b.height * 0.28;
  return grounded && settled && visiblyFallen;
}

function riskLabel(type: LevelType): string {
  switch (type) {
    case 'bonds':
      return 'stable';
    case 'etfs':
      return 'steady';
    case 'stocks':
      return 'high risk';
    case 'crypto':
      return 'volatile';
  }
}

export function InvestingBirdsOverlay(props: InvestingBirdsOverlayProps) {
  const {
    state,
    allocation,
    levels,
    currentLevel,
    nextLevel,
    birdsRemaining,
    birdsForRound,
    score,
    scoreByType,
    outcome,
    roundOutcome,
    elapsedSec,
    scoreFloaters,
    damageFloaters,
    dustPuffs,
    lastHeavyHitAtSec,
    combo,
    lastComboAtSec,
    paused,
    settingsOpen,
    settings,
    initialPortfolioTotal,
    investmentValueByType,
    lastRoundAppliedReturnPct,
    roundStartBlockCount,
    simScoredBlockCount,
    roundStartTotalMaxHealth,
    blocks,
    pullRatio,
    showAimHint,
    onAllocationChange,
    onStart,
    onReturnMenu,
    onTogglePause,
    onOpenSettings,
    onUpdateSettings,
  } = props;

  const totalAllocation = sumAllocation(allocation);
  const accent = currentLevel ? categoryAccent(currentLevel.type) : '#6366f1';
  const accentSoft = accent + '22';

  const [viewportW, setViewportW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );
  useEffect(() => {
    const on = () => {
      setViewportW(window.innerWidth);
      setViewportH(window.innerHeight);
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const isMobile = viewportW < 640;
  const isTablet = viewportW >= 640 && viewportW < 900;
  const isPortrait = viewportH > viewportW && viewportW < 720;

  // Did-you-know rotating pill (G22).
  const [dykIdx, setDykIdx] = useState(0);
  useEffect(() => {
    if (state !== 'ALLOCATE') return;
    const t = setInterval(() => setDykIdx((i) => (i + 1) % DID_YOU_KNOW.length), 5000);
    return () => clearInterval(t);
  }, [state]);

  const previewRows = useMemo(() => {
    const types: LevelType[] = ['stocks', 'etfs', 'bonds', 'crypto'];
    return types
      .map((t) => ({ type: t, share: shareOf(allocation, t) }))
      .filter((r) => r.share > 0)
      .map((r) => ({
        ...r,
        rangeLabel: sliceReturnRangeLabel(r.type),
        birds: birdsForLevelType(r.type, r.share),
        height: towerHeightFromShare(r.share),
        label: categoryLabel(r.type),
      }));
  }, [allocation]);

  // Tower readouts: settled ground debris also counts as cleared so players
  // don't need to clean up flat rubble to finish a tower.
  const totalBlocks = blocks.length;
  const clearedBlocks = blocks.filter(
    (b) => b.knockedOff || b.toppled || b.shattered || isSettledGroundDebris(b),
  ).length;
  const activeBlocks = Math.max(0, totalBlocks - clearedBlocks);
  // U17: HP bar uses round-start total max as denominator so removing a damaged
  // block never makes the *percentage* go up (only down as damage/removals accrue).
  const towerHpPct = useMemo(() => {
    if (roundStartTotalMaxHealth <= 0) return 1;
    let remainingHp = 0;
    for (const b of blocks) {
      if (b.knockedOff || b.toppled || b.shattered || isSettledGroundDebris(b)) continue;
      remainingHp += Math.max(0, b.health);
    }
    return Math.max(0, Math.min(1, remainingHp / roundStartTotalMaxHealth));
  }, [blocks, roundStartTotalMaxHealth]);

  const vignetteAge =
    lastHeavyHitAtSec != null ? elapsedSec - lastHeavyHitAtSec : 999;
  const vignetteOpacity = vignetteAge < 0.6 ? (1 - vignetteAge / 0.6) * 0.55 : 0;

  // U28: auto-dismiss round intro faster on subsequent rounds.
  const [objectiveShown, setObjectiveShown] = useState<string | null>(null);
  useEffect(() => {
    if (state === 'PLAYING' && currentLevel) {
      const key = `${currentLevel.type}-${props.currentLevelIndex}`;
      setObjectiveShown(key);
      const dur = props.currentLevelIndex === 0 ? 2800 : 1500;
      const t = setTimeout(() => setObjectiveShown(null), dur);
      return () => clearTimeout(t);
    }
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, props.currentLevelIndex, currentLevel?.type]);

  const totalAllocationOk = totalAllocation > 0;

  function applyPreset(p: Allocation) {
    onAllocationChange(p);
  }
  const normalized = useMemo(() => {
    if (totalAllocation <= 0) return null;
    const scale = 100 / totalAllocation;
    const next: Allocation = {
      stocks: Math.round(allocation.stocks * scale),
      etfs: Math.round(allocation.etfs * scale),
      bonds: Math.round(allocation.bonds * scale),
      crypto: Math.round(allocation.crypto * scale),
    };
    const s = sumAllocation(next);
    const diff = 100 - s;
    if (diff !== 0) {
      const key = (['stocks', 'etfs', 'bonds', 'crypto'] as LevelType[])
        .sort((a, b) => next[b] - next[a])[0]!;
      next[key] = Math.max(0, next[key] + diff);
    }
    return next;
  }, [allocation, totalAllocation]);

  function normalizeTo100() {
    if (!normalized) return;
    onAllocationChange(normalized);
  }

  const activePresetId = matchPreset(allocation);

  // Combo ring remaining time (G16).
  const comboProgress = useMemo(() => {
    if (lastComboAtSec == null || combo < 2) return 0;
    const age = elapsedSec - lastComboAtSec;
    const remain = Math.max(0, 1 - age / 0.75);
    return remain;
  }, [combo, elapsedSec, lastComboAtSec]);

  // Confirm abandon (U16).
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const tryReturnMenu = () => {
    if (state === 'PLAYING' && score > 0) {
      setConfirmAbandon(true);
    } else {
      onReturnMenu();
    }
  };

  const roundStars = currentLevel
    ? computeStars(birdsRemaining, birdsForRound || currentLevel.birds)
    : 0;

  // Tween round-end score too (P10).
  const tweenedEndScore = useTweenedNumber(state === 'ROUND_END' ? score : score, 650);

  /** Last completed slice: positive / negative / flat — drives round-end banner copy & tint. */
  const roundEndSliceReturnSign = useMemo(() => {
    const r = lastRoundAppliedReturnPct;
    if (r == null) return null;
    if (r > 0) return 'positive' as const;
    if (r < 0) return 'negative' as const;
    return 'flat' as const;
  }, [lastRoundAppliedReturnPct]);

  const totalReturnPct = useMemo(
    () => (initialPortfolioTotal > 0 ? (score / initialPortfolioTotal - 1) * 100 : 0),
    [score, initialPortfolioTotal],
  );

  // Scroll a slider category into view when minimap/donut clicked (P17).
  function focusCategory(t: LevelType) {
    const el = document.getElementById(`ib-slider-${t}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { boxShadow: '0 0 0 0 rgba(99,102,241,0.8)' },
        { boxShadow: '0 0 0 8px rgba(99,102,241,0)' },
      ],
      { duration: 800 },
    );
  }

  const cbAttr = settings.colorblind ? { 'data-cb': '1' } : {};
  const towerBlockDenom = roundStartBlockCount > 0 ? roundStartBlockCount : totalBlocks;

  const livePortfolioReturnPct = useMemo(() => {
    if (initialPortfolioTotal <= 0) return 0;
    if (state === 'PLAYING' && currentLevel && towerBlockDenom > 0) {
      // Must match `ROUND_END` in fsm + SimDriver: `min(roundStart, sim.scoredBlocks.size) / roundStart`.
      // Do not use `clearedBlocks` here — scored blocks stay counted after pruned shards leave `blocks[]`.
      const clearedForReturn = Math.min(towerBlockDenom, simScoredBlockCount);
      const frac =
        towerBlockDenom > 0 ? Math.min(1, Math.max(0, clearedForReturn / towerBlockDenom)) : 0;
      const { low, high } = SLICE_RETURN_BOUNDS[currentLevel.type];
      const appliedReturnPct = portfolioReturnPct(frac, low, high);
      const nextInv = { ...investmentValueByType };
      nextInv[currentLevel.type] *= 1 + appliedReturnPct;
      return (sumPortfolioValue(nextInv) / initialPortfolioTotal - 1) * 100;
    }
    return (score / initialPortfolioTotal - 1) * 100;
  }, [
    state,
    currentLevel,
    towerBlockDenom,
    simScoredBlockCount,
    investmentValueByType,
    initialPortfolioTotal,
    score,
  ]);

  /**
   * Top-bar "Return" shows this **slice's** return % (range low → high with clears),
   * not portfolio-weighted % — so at round start it reads the downside for that asset.
   */
  const sliceReturnPctForHud = useMemo(() => {
    if (state === 'ROUND_END' && lastRoundAppliedReturnPct != null) {
      return lastRoundAppliedReturnPct * 100;
    }
    if (state === 'PLAYING' && currentLevel) {
      const { low, high } = SLICE_RETURN_BOUNDS[currentLevel.type];
      if (towerBlockDenom > 0) {
        const clearedForReturn = Math.min(towerBlockDenom, simScoredBlockCount);
        const frac = Math.min(1, Math.max(0, clearedForReturn / towerBlockDenom));
        return portfolioReturnPct(frac, low, high) * 100;
      }
      return portfolioReturnPct(0, low, high) * 100;
    }
    return null;
  }, [
    state,
    lastRoundAppliedReturnPct,
    currentLevel,
    towerBlockDenom,
    simScoredBlockCount,
  ]);

  const displayReturnPct =
    sliceReturnPctForHud != null ? sliceReturnPctForHud : livePortfolioReturnPct;

  const hueForPct = (v: number) =>
    v > 0.01 ? 'text-emerald-300' : v < -0.01 ? 'text-rose-300' : 'text-white/80';

  const returnRowColor = hueForPct(displayReturnPct);
  const projectedRowColor = hueForPct(livePortfolioReturnPct);

  const projectedGainDollars = Math.round(
    (initialPortfolioTotal * livePortfolioReturnPct) / 100,
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 text-white"
      {...cbAttr}
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(10px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(10px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Vignette pulse */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,1) 110%)',
          opacity: vignetteOpacity,
          transition: 'opacity 0.12s linear',
        }}
        aria-hidden
      />

      {/* G17: chromatic aberration during slow-mo (fires alongside vignette). */}
      {!settings.reducedMotion && vignetteAge < 0.35 ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[6] mix-blend-screen"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,0,64,0.12) 0%, transparent 55%)',
              transform: 'translate(3px, 0)',
              opacity: (1 - vignetteAge / 0.35) * 0.85,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[6] mix-blend-screen"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0,160,255,0.12) 0%, transparent 55%)',
              transform: 'translate(-3px, 0)',
              opacity: (1 - vignetteAge / 0.35) * 0.85,
            }}
            aria-hidden
          />
        </>
      ) : null}

      {/* Portrait mobile warning (U25) */}
      {isPortrait && state === 'PLAYING' ? (
        <div className="pointer-events-none absolute inset-x-4 top-20 z-40 rounded-2xl border border-amber-300/50 bg-amber-500/25 px-4 py-2 text-center text-xs font-semibold text-amber-50 backdrop-blur">
          Rotate your phone sideways for the best experience.
        </div>
      ) : null}
      {state === 'PLAYING' && birdsRemaining === 0 ? (
        <div className="pointer-events-none absolute inset-x-4 top-24 z-40 rounded-2xl border border-rose-300/55 bg-rose-500/25 px-4 py-2 text-center text-sm font-semibold text-rose-50 backdrop-blur">
          Out of birds. Resolving tower state...
        </div>
      ) : null}

      {/* ===== Unified Top Bar (C6 / C7) ===== */}
      {state !== 'ALLOCATE' ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex w-full min-w-0 max-w-full items-start gap-2 px-4 pt-5 sm:gap-3"
          style={{
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          {/* Left group: portfolio + birds + combo */}
          <div className="pointer-events-auto flex min-w-0 shrink items-center gap-2">
            <div
              className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-white/25 px-3.5 py-2 shadow-lg backdrop-blur-md"
              style={{
                background: `linear-gradient(90deg, ${accentSoft}, rgba(15,23,42,0.85))`,
              }}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/65">
                  Invested
                </span>
                <span
                  className="font-extrabold tabular-nums leading-none tracking-tight text-white"
                  style={{
                    fontSize: isMobile ? '1.1rem' : 'clamp(1.15rem, 2vw, 1.55rem)',
                  }}
                >
                  ${initialPortfolioTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/65">
                  Return
                </span>
                <span
                  className={`font-extrabold tabular-nums leading-none tracking-tight ${returnRowColor}`}
                  style={{
                    fontSize: isMobile ? '1rem' : 'clamp(1.05rem, 1.7vw, 1.35rem)',
                  }}
                >
                  {displayReturnPct >= 0 ? '+' : ''}
                  {displayReturnPct.toFixed(2)}%
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0 border-t border-white/10 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/65">
                  Projected
                </span>
                <span
                  className={`font-extrabold tabular-nums leading-none tracking-tight ${projectedRowColor}`}
                  style={{
                    fontSize: isMobile ? '0.95rem' : 'clamp(1rem, 1.5vw, 1.2rem)',
                  }}
                >
                  {projectedGainDollars < 0 ? '-' : '+'}$
                  {Math.abs(projectedGainDollars).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Birds */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/25 bg-slate-950/80 px-3 py-2 shadow backdrop-blur-md">
              <Heart className="size-4.5 fill-red-500 text-red-500" />
              {isMobile ? (
                <span className="text-sm font-bold tabular-nums">{birdsRemaining}</span>
              ) : (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(birdsRemaining, 8) }).map((_, i) => (
                    <span
                      key={i}
                      className="inline-block size-2.5 rounded-full"
                      style={{
                        background: i === 0 ? '#ef4444' : '#b91c1c',
                        boxShadow:
                          i === 0 ? '0 0 0 1.5px rgba(253,230,138,0.85)' : undefined,
                      }}
                    />
                  ))}
                  {birdsRemaining > 8 ? (
                    <span className="ml-1 text-[11px] font-bold tabular-nums text-white/90">
                      +{birdsRemaining - 8}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {combo >= 2 ? (
              <div
                key={combo}
                className="relative inline-flex items-center gap-1 rounded-full border border-rose-300/60 bg-rose-600/95 px-2 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg"
                style={{ animation: 'ibComboPop 0.35s ease-out' }}
              >
                <Flame className="size-3" />x{combo}
                {/* G16: shrinking progress ring */}
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(rgba(255,255,255,0.75) ${comboProgress * 360}deg, transparent 0)`,
                    WebkitMask: 'radial-gradient(circle, transparent 64%, black 66%)',
                    mask: 'radial-gradient(circle, transparent 64%, black 66%)',
                  }}
                  aria-hidden
                />
              </div>
            ) : null}
          </div>

          {/* Center group: tower HP — takes remaining space (min-w-0 so flex can shrink). */}
          {state === 'PLAYING' && totalBlocks > 0 ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div
                className="pointer-events-none mx-auto flex w-full min-w-0 max-w-full flex-col rounded-2xl border border-white/25 bg-slate-950/75 px-2 py-1.5 shadow-lg backdrop-blur-md sm:max-w-[min(100%,42rem)]"
              >
                <div className="relative h-2.5 w-full min-w-0 max-w-full overflow-hidden rounded-full bg-black/40 sm:h-3">
                  <div
                    className="absolute inset-y-0 left-0 max-w-full rounded-full transition-[width] duration-200 ease-out"
                    style={{
                      width: `${towerHpPct * 100}%`,
                      background: `linear-gradient(90deg, ${accent}, #ffffff)`,
                      boxShadow: `0 0 10px ${accent}99`,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex w-full min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <span className="inline-flex min-w-0 shrink items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide text-white/90 sm:text-[11px]">
                    <CategoryIcon type={currentLevel?.type ?? 'stocks'} className="size-3 shrink-0" />
                    Tower
                  </span>
                  <span className="shrink-0 text-right text-[10px] font-semibold tabular-nums tracking-wide text-white/90 sm:text-[11px]">
                    {activeBlocks} active · {clearedBlocks}/{totalBlocks}
                    <span className="ml-1.5 inline-block rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold sm:text-[10px]">
                      HP {Math.round(towerHpPct * 100)}%
                    </span>
                  </span>
                </div>
                    <div className="mt-1 line-clamp-2 text-center text-[9px] font-medium leading-snug tracking-wide text-white/75 sm:text-left sm:text-[10px]">
                      Return range (this slice):{' '}
                      <span className="tabular-nums text-white/95">
                        {currentLevel ? sliceReturnRangeLabel(currentLevel.type) : '—'}
                      </span>
                  {isMobile ? null : (
                    <span className="text-white/60"> — scales with blocks cleared</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          {/* Right group: round + pause */}
          {currentLevel ? (
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              <div
                className={
                  'pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl border border-white/25 px-3 py-1.5 shadow-lg backdrop-blur-md ' +
                  (isMobile ? 'text-xs' : 'text-sm')
                }
                style={{
                  background: `linear-gradient(-90deg, ${accentSoft}, rgba(15,23,42,0.85))`,
                }}
              >
                <div
                  className={
                    'flex items-center justify-center rounded-full text-white ' +
                    (isMobile ? 'size-6' : 'size-7')
                  }
                  style={{ background: accent }}
                >
                  <CategoryIcon
                    type={currentLevel.type}
                    className={isMobile ? 'size-3.5' : 'size-4'}
                  />
                </div>
                {isMobile ? (
                  <span
                    className="font-bold tracking-wide"
                    style={{
                      animation:
                        combo >= 2 ? 'ibPulse 0.4s ease-in-out' : undefined,
                    }}
                  >
                    {currentLevel.label}
                  </span>
                ) : isTablet ? (
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/75">
                      {props.currentLevelIndex + 1}/{levels.length}
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{
                        animation:
                          combo >= 2 ? 'ibPulse 0.4s ease-in-out' : undefined,
                      }}
                    >
                      {currentLevel.label}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/75">
                      Round {props.currentLevelIndex + 1} / {levels.length}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        animation:
                          combo >= 2 ? 'ibPulse 0.4s ease-in-out' : undefined,
                      }}
                    >
                      {currentLevel.label}
                    </span>
                  </div>
                )}
                {!isMobile ? (
                  <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                    {riskLabel(currentLevel.type)}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-2xl border border-white/25 bg-slate-950/85 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300/80"
                onClick={onTogglePause}
                aria-label={paused ? 'Resume' : 'Pause'}
              >
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Power meter — bottom center */}
      {state === 'PLAYING' && pullRatio > 0.05 ? (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-white/25 bg-slate-950/80 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <Zap className="size-3.5 text-amber-300" />
            <div className="relative h-2 w-36 overflow-hidden rounded-full bg-black/50">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
                style={{
                  width: `${pullRatio * 100}%`,
                  background:
                    pullRatio < 0.5
                      ? '#22c55e'
                      : pullRatio < 0.85
                      ? '#f59e0b'
                      : '#ef4444',
                  boxShadow: '0 0 8px rgba(255,255,255,0.35)',
                }}
              />
            </div>
            <span className="text-[11px] font-bold tabular-nums text-white/90">
              {Math.round(pullRatio * 100)}%
            </span>
          </div>
        </div>
      ) : null}

      {/* Score floaters (dithered Y) */}
      {scoreFloaters.map((f, i) => {
        const age = elapsedSec - f.atSec;
        if (age > 1.2) return null;
        const dither = ((i * 37) % 5) * 0.03;
        const proj = props.projectWorld(f.worldX, f.worldY);
        const pxLeft = `${proj.leftPx}px`;
        const pxTop = `${proj.topPx - dither * 80}px`;
        const tint = f.levelType ? categoryAccent(f.levelType) : '#22c55e';
        // U29: small glyph per category so floaters carry context at a glance.
        const icon = !f.levelType
          ? null
          : f.levelType === 'stocks'
          ? '↗'
          : f.levelType === 'etfs'
          ? '◆'
          : f.levelType === 'bonds'
          ? '■'
          : '⟐';
        return (
          <div
            key={f.id}
            className="pointer-events-none absolute z-20 -translate-x-1/2 text-2xl font-black tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
            style={{
              left: pxLeft,
              top: pxTop,
              color: tint,
              animation: 'ibFloater 1.15s ease-out forwards',
            }}
          >
            {icon ? <span className="mr-1 text-[18px]">{icon}</span> : null}
            +${Math.round(f.delta).toLocaleString()}
          </div>
        );
      })}

      {/* Damage floaters — smaller + red (U7) */}
      {damageFloaters.map((f) => {
        const age = elapsedSec - f.atSec;
        if (age > 0.9) return null;
        const proj = props.projectWorld(f.worldX, f.worldY);
        const pxLeft = `${proj.leftPx}px`;
        const pxTop = `${proj.topPx}px`;
        return (
          <div
            key={`dmg-${f.id}`}
            className="pointer-events-none absolute z-20 -translate-x-1/2 text-[11px] font-black tabular-nums text-rose-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{
              left: pxLeft,
              top: pxTop,
              animation: 'ibDamage 0.85s ease-out forwards',
            }}
          >
            -{f.delta}
          </div>
        );
      })}

      {/* Dust puffs (tinted — U18) */}
      {dustPuffs.map((p) => {
        const age = elapsedSec - p.atSec;
        if (age > 0.7) return null;
        const proj = props.projectWorld(p.worldX, p.worldY);
        const pxLeft = `${proj.leftPx}px`;
        const pxTop = `${proj.topPx}px`;
        const tint = p.tint ?? '#d8d1c4';
        return (
          <span
            key={`dust-${p.id}`}
            className="pointer-events-none absolute z-[15] block rounded-full"
            style={{
              left: pxLeft,
              top: pxTop,
              width: 32 * p.size,
              height: 32 * p.size,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${tint}cc 0%, ${tint}66 45%, rgba(0,0,0,0) 75%)`,
              animation: 'ibDust 0.7s ease-out forwards',
            }}
          />
        );
      })}

      {/* Objective card */}
      {state === 'PLAYING' && objectiveShown && currentLevel ? (
        <div
          key={objectiveShown}
          className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-2xl border border-white/25 bg-slate-950/85 px-4 py-2 shadow-xl backdrop-blur-md"
          style={{ animation: 'ibObjective 2.8s ease-in-out forwards' }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-white/75">Objective:</span>
            <span className="inline-flex items-center gap-1.5">
              Clear the
              <CategoryBadge type={currentLevel.type} />
              tower
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums text-white"
              style={{ background: categoryAccent(currentLevel.type) }}
            >
              {sliceReturnRangeLabel(currentLevel.type)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Aim hint (P11) */}
      {state === 'PLAYING' && showAimHint ? (
        <div
          className="pointer-events-none absolute bottom-36 left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/25 bg-black/70 px-4 py-3 text-center text-sm leading-snug text-white/95 shadow-lg backdrop-blur"
          style={{ animation: 'ibPulse 1.8s ease-in-out infinite' }}
        >
          Drag the bird back from the pouch and release to launch.
          <br />
          <span className="mt-1 inline-block text-[11px] text-white/75">
            ESC = pause · Space = ability mid-air · Tap bird in flight = ability
          </span>
        </div>
      ) : null}

      {/* ===== Pause menu (P7/U3) ===== */}
      {paused && state === 'PLAYING' ? (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-slate-950/95 p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <Pause className="size-5" />
              <h2 className="text-xl font-bold tracking-tight">Paused</h2>
            </div>
            <p className="mt-1 text-sm text-white/75">Take a breath. Your score is safe.</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button type="button" className={btnPrimary} onClick={onTogglePause}>
                <Play className="size-4" /> Resume
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => onOpenSettings(true)}
              >
                <Settings2 className="size-4" /> Settings
              </button>
              <button type="button" className={btnGhost} onClick={tryReturnMenu}>
                <X className="size-4" /> Quit to menu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Settings modal */}
      {settingsOpen ? (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-slate-950/95 p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <Settings2 className="size-5" />
              <h2 className="text-xl font-bold tracking-tight">Settings</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span>Reduced motion</span>
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) =>
                    onUpdateSettings({ reducedMotion: e.target.checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Colorblind-friendly</span>
                <input
                  type="checkbox"
                  checked={settings.colorblind}
                  onChange={(e) =>
                    onUpdateSettings({ colorblind: e.target.checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Music</span>
                <input
                  type="checkbox"
                  checked={settings.musicOn}
                  onChange={(e) => onUpdateSettings({ musicOn: e.target.checked })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex justify-between">
                  <span>Volume</span>
                  <span className="tabular-nums text-white/70">
                    {Math.round(settings.volume * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.volume * 100)}
                  onChange={(e) =>
                    onUpdateSettings({ volume: Number(e.target.value) / 100 })
                  }
                  className="accent-indigo-400"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => onOpenSettings(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm abandon (U16) */}
      {confirmAbandon ? (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-slate-950/95 p-6 shadow-2xl">
            <h2 className="text-lg font-bold">Abandon run?</h2>
            <p className="mt-1 text-sm text-white/75">
              You'll lose this session's score and allocation progress.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setConfirmAbandon(false)}
              >
                Keep playing
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={onReturnMenu}
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Allocate panel (U14 hero) ===== */}
      {false ? (
        <div className="pointer-events-auto absolute inset-x-0 top-10 mx-auto w-[min(680px,calc(100vw-24px))] rounded-2xl border border-white/25 bg-slate-950/95 p-6 shadow-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-5 text-amber-300" />
            <h2 className="text-2xl font-extrabold tracking-tight">Investing Birds</h2>
          </div>
          <p className="text-sm text-white/80">
            Build your portfolio. Each allocation becomes a tower. More investment ⇒ taller tower and more birds. Except bonds (+4% fixed on that slice), each round starts at the slice downside and ramps toward the upside as you clear more blocks.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  chipBtn +
                  (activePresetId === p.id
                    ? ' !bg-indigo-500/40 !border-indigo-300/70'
                    : '')
                }
                onClick={() => applyPreset(p.alloc)}
                aria-pressed={activePresetId === p.id}
              >
                <span aria-hidden>{p.emoji}</span>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-white/70">
            Score model:{' '}
            <span className="font-semibold text-white">
              bonds {sliceReturnRangeLabel('bonds')}; other towers interpolate from downside (no clears) to
              upside (full clear): ETFs {sliceReturnRangeLabel('etfs')}, stocks{' '}
              {sliceReturnRangeLabel('stocks')}, crypto {sliceReturnRangeLabel('crypto')} — by share of
              blocks cleared
            </span>
            . Starting notional:{' '}
            <span className="font-semibold text-white">
              ${NOTIONAL_PORTFOLIO_BASE.toLocaleString()}
            </span>
            .
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SliderRow
                type="stocks"
                focusId="ib-slider-stocks"
                label="Individual Stocks"
                value={allocation.stocks}
                icon={<Target className="size-4" />}
                colorClass="text-red-400"
                onChange={(v) => onAllocationChange({ ...allocation, stocks: v })}
                tooltip={TOOLTIPS.stocks}
              />
              <SliderRow
                type="etfs"
                focusId="ib-slider-etfs"
                label="ETFs"
                value={allocation.etfs}
                icon={<BarChart3 className="size-4" />}
                colorClass="text-sky-400"
                onChange={(v) => onAllocationChange({ ...allocation, etfs: v })}
                tooltip={TOOLTIPS.etfs}
              />
              <SliderRow
                type="bonds"
                focusId="ib-slider-bonds"
                label="Bonds"
                value={allocation.bonds}
                icon={<Shield className="size-4" />}
                colorClass="text-emerald-400"
                onChange={(v) => onAllocationChange({ ...allocation, bonds: v })}
                tooltip={TOOLTIPS.bonds}
              />
              <SliderRow
                type="crypto"
                focusId="ib-slider-crypto"
                label="Crypto"
                value={allocation.crypto}
                icon={<Bitcoin className="size-4" />}
                colorClass="text-amber-400"
                onChange={(v) => onAllocationChange({ ...allocation, crypto: v })}
                tooltip={TOOLTIPS.crypto}
              />
            </div>
            <div className="flex flex-col items-center justify-start gap-3 sm:w-36">
              <PortfolioDonut
                allocation={allocation}
                onFocusCategory={focusCategory}
              />
              <TowerMinimap
                allocation={allocation}
                onFocusCategory={focusCategory}
              />
            </div>
          </div>

          {previewRows.length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/15 bg-black/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/75">
                <TrendingUp className="size-3.5" />
                Tower preview
              </div>
              <ul className="space-y-1.5 text-xs">
                {previewRows.map((r) => (
                  <li
                    key={r.type}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-2.5 py-1.5"
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <CategoryIcon type={r.type} className="size-3.5" />
                      {r.label}
                    </span>
                    <span className="tabular-nums text-white/85">
                      {r.height} blocks • {r.birds} birds •{' '}
                      <span className="font-bold text-white">{r.rangeLabel}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* G22: did-you-know pill */}
          <div
            key={dykIdx}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/85"
            style={{ animation: 'ibPopIn 0.5s ease-out' }}
          >
            <Sparkles className="size-3.5 text-amber-300" />
            Did you know? {DID_YOU_KNOW[dykIdx]}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span
              className="text-sm tabular-nums text-white/85"
              title={
                totalAllocation === 100
                  ? 'Perfectly allocated'
                  : 'Total can be any sum; normalize if you want 100%'
              }
            >
              Total:{' '}
              <span
                className={`font-bold ${
                  totalAllocation === 100 ? 'text-emerald-300' : 'text-white'
                }`}
              >
                {totalAllocation}%
              </span>
              {totalAllocation !== 100 && totalAllocation > 0 && normalized ? (
                <button
                  type="button"
                  onClick={normalizeTo100}
                  className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold hover:bg-white/20"
                >
                  Normalize →{' '}
                  {normalized?.stocks ?? 0}/{normalized?.etfs ?? 0}/{normalized?.bonds ?? 0}/
                  {normalized?.crypto ?? 0}
                </button>
              ) : null}
            </span>
            <button
              type="button"
              className={btnPrimary}
              onClick={onStart}
              disabled={!totalAllocationOk}
              title={
                !totalAllocationOk
                  ? 'Allocate at least one category'
                  : 'Start the run'
              }
            >
              Start game
            </button>
          </div>
        </div>
      ) : null}

      {/* ===== Round transition ===== */}
      {state === 'ROUND_END' && roundOutcome ? (
        <div
          key={`${currentLevel?.type}-${roundOutcome}`}
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center"
          style={{
            background:
              roundEndSliceReturnSign === 'positive'
                ? 'radial-gradient(circle at center, rgba(34,197,94,0.45), rgba(5,46,22,0.75))'
                : roundEndSliceReturnSign === 'negative'
                  ? 'radial-gradient(circle at center, rgba(220,38,38,0.4), rgba(60,10,10,0.8))'
                  : 'radial-gradient(circle at center, rgba(100,116,139,0.4), rgba(15,23,42,0.88))',
            animation:
              roundEndSliceReturnSign === 'negative'
                ? 'ibShake 0.55s ease-in-out'
                : 'ibBgFlash 0.55s ease-out',
          }}
        >
          {roundEndSliceReturnSign === 'positive' ? <Confetti /> : null}
          <div className="relative flex flex-col items-center gap-3 px-4 text-center">
            <h1
              className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] sm:text-6xl"
              style={{ animation: 'ibPopIn 0.35s ease-out' }}
            >
              {roundEndSliceReturnSign === 'positive'
                ? 'You made returns'
                : roundEndSliceReturnSign === 'negative'
                  ? 'Negative returns'
                  : roundEndSliceReturnSign === 'flat'
                    ? 'Flat returns'
                    : 'Round complete'}
            </h1>
            {/* P1: stars */}
            {roundOutcome === 'cleared' ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    className={
                      'size-7 ' +
                      (n <= roundStars
                        ? 'fill-amber-300 text-amber-300'
                        : 'text-white/30')
                    }
                    style={{
                      animation: `ibPopIn 0.35s ease-out ${0.1 + n * 0.1}s both`,
                    }}
                  />
                ))}
              </div>
            ) : null}
            {roundOutcome === 'cleared' &&
            currentLevel &&
            birdsRemaining >= Math.ceil((birdsForRound || currentLevel.birds) * 0.66) ? (
              <div
                className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-400/20 px-4 py-1 text-sm font-black uppercase tracking-wider text-amber-100 shadow-lg"
                style={{ animation: 'ibPopIn 0.5s ease-out 0.1s both' }}
              >
                <Flame className="size-4" />
                Perfect clear — birds to spare
              </div>
            ) : null}

            {/* G11: score breakdown */}
            {currentLevel ? (
              <div
                className="mt-2 grid gap-1 rounded-xl border border-white/25 bg-black/55 px-4 py-3 text-sm font-semibold backdrop-blur-sm"
                style={{ animation: 'ibPopIn 0.55s ease-out 0.2s both' }}
              >
                <div className="flex items-center justify-between gap-8">
                  <span className="text-white/80">Blocks cleared</span>
                  <span className="tabular-nums">
                    {clearedBlocks}/{towerBlockDenom || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-white/80">Return range</span>
                  <span className="tabular-nums">
                    {sliceReturnRangeLabel(currentLevel.type)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-white/80">This slice return</span>
                  <span className="tabular-nums">
                    {lastRoundAppliedReturnPct != null
                      ? `${(lastRoundAppliedReturnPct * 100).toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-white/80">Birds remaining</span>
                  <span className="tabular-nums">{birdsRemaining}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-8 border-t border-white/20 pt-1 text-base">
                  <span>Portfolio</span>
                  <span className="tabular-nums">
                    ${tweenedEndScore.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : null}

            <p className="text-xs text-white/75">
              {nextLevel
                ? 'Moving on to the next tower…'
                : 'Wrapping up your run…'}
            </p>

            {nextLevel ? (
              <div
                className="mt-4 flex items-center gap-3 rounded-2xl border border-white/35 bg-black/60 px-5 py-3 text-base font-semibold text-white shadow-2xl backdrop-blur-md"
                style={{ animation: 'ibSlideIn 0.6s ease-out 0.25s both' }}
              >
                <span className="text-white/85">Next Up:</span>
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon type={nextLevel.type} className="size-5" />
                  {nextLevel.label}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums text-white"
                  style={{ background: categoryAccent(nextLevel.type) }}
                >
                  {sliceReturnRangeLabel(nextLevel.type)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ===== Game end screen ===== */}
      {state === 'GAME_END' ? (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/25 bg-slate-950/95 p-6 shadow-2xl">
            <h2 className="text-2xl font-bold tracking-tight">
              {outcome === 'win'
                ? `Your returns ended up — $${Math.round(score).toLocaleString()}`
                : `Your returns ended down — $${Math.round(score).toLocaleString()}`}
            </h2>
            <p className="mt-2 text-sm text-white/80">
              {outcome === 'loss'
                ? `Total return about ${totalReturnPct.toFixed(1)}% — portfolio below your starting notional.`
                : `Total return about ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}% vs. where you started.`}
            </p>
            {/* G12: grade + per-category bar chart */}
            <div className="mt-4 flex items-start gap-4 rounded-xl border border-white/15 bg-black/40 p-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Grade
                </span>
                <span
                  className="text-4xl font-black"
                  style={{
                    color:
                      outcome === 'win'
                        ? '#fbbf24'
                        : '#f87171',
                  }}
                >
                  {computeLetterGrade(score, initialPortfolioTotal)}
                </span>
              </div>
              <div className="flex-1 space-y-1.5">
                {(['stocks', 'etfs', 'bonds', 'crypto'] as LevelType[]).map((t) => {
                  const val = scoreByType[t] ?? 0;
                  const max = Math.max(1, ...Object.values(scoreByType));
                  const pct = Math.max(0, Math.min(1, val / max));
                  if (val <= 0) return null;
                  return (
                    <div key={t} className="text-xs">
                      <div className="flex justify-between">
                        <span className="inline-flex items-center gap-1.5">
                          <CategoryIcon type={t} className="size-3" />
                          {CATEGORY_META[t].label}
                        </span>
                        <span className="tabular-nums">
                          {Math.round(val).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct * 100}%`,
                            background: categoryAccent(t),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wider">
              <span className="text-white/70">Projected gain (at current return): </span>
              <span className={projectedRowColor}>
                {projectedGainDollars < 0 ? '-' : '+'}$
                {Math.abs(projectedGainDollars).toLocaleString()}
              </span>
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" className={btnPrimary} onClick={onReturnMenu}>
                <X className="size-4" />
                Main menu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Colorblind-mode overrides: add a corner badge using patterns. */}
      {settings.colorblind ? (
        <div className="pointer-events-none absolute bottom-2 right-2 z-30 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
          CB mode
        </div>
      ) : null}

      <style>{`
        @keyframes ibFloater {
          0% { opacity:0; transform: translate(-50%, 10px) scale(0.85); }
          20% { opacity:1; transform: translate(-50%, 0) scale(1.05); }
          100% { opacity:0; transform: translate(-50%, -40px) scale(1); }
        }
        @keyframes ibDamage {
          0% { opacity:0; transform: translate(-50%, -6px) scale(0.8); }
          20% { opacity:1; transform: translate(-50%, -14px) scale(1); }
          100% { opacity:0; transform: translate(-50%, -32px) scale(0.95); }
        }
        @keyframes ibDust {
          0% { opacity:0.7; transform: translate(-50%, -50%) scale(0.5); }
          100% { opacity:0; transform: translate(-50%, calc(-50% - 18px)) scale(1.4); }
        }
        @keyframes ibPopIn {
          0% { opacity:0; transform: scale(0.85); }
          60% { opacity:1; transform: scale(1.04); }
          100% { opacity:1; transform: scale(1); }
        }
        @keyframes ibSlideIn {
          0% { opacity:0; transform: translateX(120%); }
          100% { opacity:1; transform: translateX(0); }
        }
        @keyframes ibBgFlash {
          0% { opacity:0; }
          40% { opacity:1; }
          100% { opacity:0.85; }
        }
        @keyframes ibShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(12px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
        @keyframes ibComboPop {
          0% { opacity:0; transform: scale(0.7); }
          60% { opacity:1; transform: scale(1.1); }
          100% { opacity:1; transform: scale(1); }
        }
        @keyframes ibObjective {
          0% { opacity:0; transform: translate(-50%, 10px); }
          10% { opacity:1; transform: translate(-50%, 0); }
          85% { opacity:1; transform: translate(-50%, 0); }
          100% { opacity:0; transform: translate(-50%, -8px); }
        }
        @keyframes ibPulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes ibBirdHop {
          0% { transform: translate(0, 0); }
          25% { transform: translate(32px, -10px); }
          50% { transform: translate(64px, 0); }
          75% { transform: translate(32px, -6px); }
          100% { transform: translate(0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ibConfettiFall"], [style*="ibShake"], [style*="ibBgFlash"],
          [style*="ibComboPop"], [style*="ibDust"], [style*="ibDamage"],
          [style*="ibFloater"], [style*="ibObjective"], [style*="ibSlideIn"],
          [style*="ibPopIn"], [style*="ibPulse"] {
            animation: none !important;
          }
        }
        [data-cb="1"] [style*="background: #DC2626"],
        [data-cb="1"] [style*="background:#DC2626"] {
          background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.25) 0 3px, transparent 3px 6px) !important;
        }
      `}</style>
    </div>
  );
}
