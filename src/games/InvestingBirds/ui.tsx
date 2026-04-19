import {
  BarChart3,
  Bitcoin,
  Heart,
  Shield,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  birdsFromShare,
  categoryAccent,
  categoryLabel,
  multiplierFromShare,
  shareOf,
  sumAllocation,
  towerHeightFromShare,
} from './config';
import type {
  Allocation,
  InvestingBirdsState,
  LevelDef,
  LevelType,
  ScoreFloater,
} from './types';

interface InvestingBirdsOverlayProps {
  state: InvestingBirdsState;
  allocation: Allocation;
  levels: LevelDef[];
  currentLevelIndex: number;
  currentLevel: LevelDef | null;
  nextLevel: LevelDef | null;
  birdsRemaining: number;
  score: number;
  scoreByType: Record<LevelType, number>;
  outcome: 'win' | 'loss' | null;
  roundOutcome: 'cleared' | 'survived' | null;
  elapsedSec: number;
  scoreFloaters: ScoreFloater[];
  showAimHint: boolean;
  onAllocationChange: (next: Allocation) => void;
  onStart: () => void;
  onRestart: () => void;
  onReturnMenu: () => void;
}

const btnPrimary =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tracking-wide select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300/60 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white shadow-lg shadow-indigo-900/30';

const btnGhost =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium tracking-wide select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300/60 bg-white/10 hover:bg-white/20 text-white/95 border border-white/20 backdrop-blur';

function CategoryIcon({ type, className = '' }: { type: LevelType; className?: string }) {
  if (type === 'stocks') return <Target className={className} />;
  if (type === 'etfs') return <BarChart3 className={className} />;
  if (type === 'bonds') return <Shield className={className} />;
  return <Bitcoin className={className} />;
}

function SliderRow({
  label,
  value,
  icon,
  colorClass,
  onChange,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  colorClass: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs uppercase tracking-wide text-white/75">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className={colorClass}>{icon}</span>
          {label}
        </span>
        <span className="font-bold tabular-nums text-white">{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      />
    </label>
  );
}

function HeartsRow({ count }: { count: number }) {
  const max = Math.min(count, 12);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Heart key={i} className="size-3.5 fill-red-500 text-red-500" />
      ))}
      {count > max ? (
        <span className="ml-1 text-xs font-semibold tabular-nums text-white/80">
          +{count - max}
        </span>
      ) : null}
    </div>
  );
}

/** Confetti rendered once per mount using randomized CSS vars. */
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

export function InvestingBirdsOverlay(props: InvestingBirdsOverlayProps) {
  const {
    state,
    allocation,
    levels,
    currentLevel,
    nextLevel,
    birdsRemaining,
    score,
    scoreByType,
    outcome,
    roundOutcome,
    elapsedSec,
    scoreFloaters,
    showAimHint,
    onAllocationChange,
    onStart,
    onRestart,
    onReturnMenu,
  } = props;

  const totalAllocation = sumAllocation(allocation);
  const accent = currentLevel ? categoryAccent(currentLevel.type) : '#ffffff';

  const previewRows = useMemo(() => {
    const types: LevelType[] = ['stocks', 'etfs', 'bonds', 'crypto'];
    return types
      .map((t) => ({ type: t, share: shareOf(allocation, t) }))
      .filter((r) => r.share > 0)
      .map((r) => ({
        ...r,
        multiplier: multiplierFromShare(r.share),
        birds: birdsFromShare(r.share),
        height: towerHeightFromShare(r.share),
        label: categoryLabel(r.type),
      }));
  }, [allocation]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 text-white"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Top-left HUD: score + birds */}
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/70 px-4 py-2.5 shadow-xl backdrop-blur-md">
          <Trophy className="size-6 text-amber-300" />
          <span
            className="font-extrabold tabular-nums leading-none tracking-tight"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}
          >
            {Math.round(score).toLocaleString()}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-slate-950/60 px-3 py-1.5 shadow-lg backdrop-blur-md">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
            Birds
          </span>
          <HeartsRow count={birdsRemaining} />
        </div>
      </div>

      {/* Top-right: current tower badge */}
      {currentLevel && state !== 'ALLOCATE' ? (
        <div className="absolute right-4 top-4 flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/70 px-4 py-2.5 shadow-xl backdrop-blur-md">
          <div
            className="flex size-9 items-center justify-center rounded-full text-white"
            style={{ background: accent }}
          >
            <CategoryIcon type={currentLevel.type} className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Round {Math.min(props.currentLevelIndex + 1, levels.length)} / {levels.length}
            </span>
            <span className="text-base font-semibold">{currentLevel.label}</span>
          </div>
          <div
            className="ml-2 rounded-full px-3 py-1 text-sm font-bold tabular-nums text-white shadow"
            style={{ background: accent }}
          >
            {currentLevel.multiplier.toFixed(2)}x
          </div>
        </div>
      ) : null}

      {/* Bird queue (bottom-left) */}
      {state === 'PLAYING' && currentLevel ? (
        <div className="absolute bottom-5 left-4 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 shadow-lg backdrop-blur-md">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
            Shots
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(birdsRemaining, 10) }).map((_, i) => (
              <span
                key={i}
                className="size-3.5 rounded-full"
                style={{ background: '#ef4444', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
              />
            ))}
            {birdsRemaining > 10 ? (
              <span className="ml-1 text-xs font-semibold tabular-nums text-white/85">
                +{birdsRemaining - 10}
              </span>
            ) : null}
            {birdsRemaining === 0 ? (
              <span className="text-xs font-semibold text-white/75">Empty</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Score floaters - green "+points" */}
      {scoreFloaters.map((f) => {
        const age = elapsedSec - f.atSec;
        if (age > 1.2) return null;
        const pxLeft = `${(f.ndcX + 1) * 50}%`;
        const pxTop = `${(1 - (f.ndcY + 1) / 2) * 100}%`;
        return (
          <div
            key={f.id}
            className="pointer-events-none absolute z-20 -translate-x-1/2 text-2xl font-black tabular-nums text-emerald-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
            style={{
              left: pxLeft,
              top: pxTop,
              animation: 'ibFloater 1.15s ease-out forwards',
            }}
          >
            +{Math.round(f.delta)}
            <style>{`@keyframes ibFloater {
              0% { opacity:0; transform: translate(-50%, 10px) scale(0.85); }
              20% { opacity:1; transform: translate(-50%, 0) scale(1.05); }
              100% { opacity:0; transform: translate(-50%, -40px) scale(1); }
            }`}</style>
          </div>
        );
      })}

      {/* Aim hint */}
      {state === 'PLAYING' && showAimHint ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/20 bg-black/60 px-4 py-3 text-center text-sm leading-snug text-white/95 shadow-lg backdrop-blur">
          Pull back from the pouch and release. The dotted arc previews your shot.
        </div>
      ) : null}

      {/* Allocate panel */}
      {state === 'ALLOCATE' ? (
        <div className="pointer-events-auto absolute inset-x-0 top-24 mx-auto w-[min(560px,calc(100vw-24px))] rounded-2xl border border-white/20 bg-slate-950/92 p-6 shadow-2xl">
          <h2 className="text-xl font-bold tracking-tight">Build your portfolio</h2>
          <p className="mt-1 text-sm text-white/75">
            Each category becomes a tower. More investment ⇒ taller tower, more birds, bigger multiplier.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SliderRow
              label="Individual Stocks"
              value={allocation.stocks}
              icon={<Target className="size-4" />}
              colorClass="text-red-400"
              onChange={(v) => onAllocationChange({ ...allocation, stocks: v })}
            />
            <SliderRow
              label="ETFs"
              value={allocation.etfs}
              icon={<BarChart3 className="size-4" />}
              colorClass="text-sky-400"
              onChange={(v) => onAllocationChange({ ...allocation, etfs: v })}
            />
            <SliderRow
              label="Bonds"
              value={allocation.bonds}
              icon={<Shield className="size-4" />}
              colorClass="text-emerald-400"
              onChange={(v) => onAllocationChange({ ...allocation, bonds: v })}
            />
            <SliderRow
              label="Crypto"
              value={allocation.crypto}
              icon={<Bitcoin className="size-4" />}
              colorClass="text-amber-400"
              onChange={(v) => onAllocationChange({ ...allocation, crypto: v })}
            />
          </div>

          {previewRows.length > 0 ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/65">
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
                      <CategoryIcon
                        type={r.type}
                        className="size-3.5"
                      />
                      {r.label}
                    </span>
                    <span className="tabular-nums text-white/80">
                      {r.height} blocks • {r.birds} birds •{' '}
                      <span className="font-bold text-white">{r.multiplier.toFixed(2)}x</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-sm tabular-nums text-white/75">
              Total allocated: <span className="font-bold text-white">{totalAllocation}%</span>
            </span>
            <button
              type="button"
              className={btnPrimary}
              onClick={onStart}
              disabled={totalAllocation <= 0}
            >
              Start game
            </button>
          </div>
        </div>
      ) : null}

      {/* Round transition overlay */}
      {state === 'ROUND_END' && roundOutcome ? (
        <div
          key={`${currentLevel?.type}-${roundOutcome}`}
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center"
          style={{
            background:
              roundOutcome === 'cleared'
                ? 'radial-gradient(circle at center, rgba(34,197,94,0.45), rgba(5,46,22,0.75))'
                : 'radial-gradient(circle at center, rgba(220,38,38,0.4), rgba(60,10,10,0.8))',
            animation:
              roundOutcome === 'cleared'
                ? 'ibBgFlash 0.55s ease-out'
                : 'ibShake 0.55s ease-in-out',
          }}
        >
          {roundOutcome === 'cleared' ? <Confetti /> : null}
          <div className="relative flex flex-col items-center gap-3 px-4 text-center">
            <h1
              className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] sm:text-6xl"
              style={{ animation: 'ibPopIn 0.35s ease-out' }}
            >
              {roundOutcome === 'cleared' ? 'Tower Cleared!' : 'Tower Survived…'}
            </h1>
            <p
              className="text-lg font-semibold text-white/85"
              style={{ animation: 'ibPopIn 0.45s ease-out' }}
            >
              {roundOutcome === 'cleared'
                ? `Score so far: ${Math.round(score).toLocaleString()}`
                : 'You ran out of birds before the tower fell.'}
            </p>
            {nextLevel ? (
              <div
                className="mt-6 flex items-center gap-3 rounded-2xl border border-white/30 bg-black/50 px-5 py-3 text-base font-semibold text-white shadow-2xl backdrop-blur-md"
                style={{ animation: 'ibSlideIn 0.6s ease-out 0.25s both' }}
              >
                <span className="text-white/80">Next Up:</span>
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon type={nextLevel.type} className="size-5" />
                  {nextLevel.label}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                  style={{ background: categoryAccent(nextLevel.type) }}
                >
                  {nextLevel.multiplier.toFixed(2)}x
                </span>
              </div>
            ) : null}
          </div>
          <style>{`
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
          `}</style>
        </div>
      ) : null}

      {/* Game end modal */}
      {state === 'GAME_END' ? (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl">
            <h2 className="text-2xl font-bold tracking-tight">
              {outcome === 'win' ? 'Portfolio cleared!' : 'No birds left'}
            </h2>
            <p className="mt-2 text-sm text-white/75">
              {outcome === 'loss'
                ? 'Some towers still stand. Rebalance your portfolio and try again.'
                : 'You knocked every stack off the ground.'}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/55">
              Final score
            </p>
            <p className="text-3xl font-black tabular-nums text-white">
              {Math.round(score).toLocaleString()}
            </p>
            <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm text-white/85">
              {(['stocks', 'etfs', 'bonds', 'crypto'] as LevelType[]).map((t) =>
                scoreByType[t] > 0 ? (
                  <li key={t} className="flex justify-between gap-4 tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon type={t} className="size-3.5" />
                      {categoryLabel(t)}
                    </span>
                    <span>{Math.round(scoreByType[t]).toLocaleString()}</span>
                  </li>
                ) : null,
              )}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className={btnPrimary} onClick={onRestart}>
                Play again
              </button>
              <button type="button" className={btnGhost} onClick={onReturnMenu}>
                Main menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
