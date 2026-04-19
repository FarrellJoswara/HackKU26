import {
  BarChart3,
  Bitcoin,
  Heart,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  birdsFromShare,
  categoryAccent,
  categoryLabel,
  multiplierForType,
  ORDERED_LEVEL_TYPES,
  sumAllocation,
  towerHeightFromShare,
} from './config';
import { CAMERA_DESIGN } from './config';
import { computeFrustum, worldToScreen } from './projection';
import { normalizedAllocation, startRoundsFromAllocation } from './uiState';
import type { Allocation, LevelType, UiAction, UiState } from './types';
import type { Dispatch } from 'react';

const chipBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10';
const btnPrimary =
  'rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-400';
const btnGhost =
  'rounded-xl border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10';

const PRESETS: Array<{ id: string; label: string; emoji: string; alloc: Allocation }> = [
  { id: 'aggressive', label: 'Aggressive', emoji: '🚀', alloc: { stocks: 50, etfs: 20, bonds: 5, crypto: 25 } },
  { id: 'balanced', label: 'Balanced', emoji: '⚖️', alloc: { stocks: 30, etfs: 40, bonds: 25, crypto: 5 } },
  { id: 'conservative', label: 'Conservative', emoji: '🛡️', alloc: { stocks: 15, etfs: 35, bonds: 45, crypto: 5 } },
  { id: 'crypto', label: 'Crypto-Heavy', emoji: '🪙', alloc: { stocks: 15, etfs: 15, bonds: 5, crypto: 65 } },
];

const TOOLTIPS: Record<LevelType, string> = {
  stocks:
    'Individual stocks: high reward, high volatility. Biggest per-block score multiplier.',
  etfs: 'ETFs: diversified buckets — many smaller towers. Easier to clear multiple.',
  bonds: 'Bonds: steady, low risk. Short, dense towers and a modest multiplier.',
  crypto: 'Crypto: wild swings. Fewer blocks, steep rewards if you clear.',
};

const DID_YOU_KNOW: string[] = [
  'Diversified ETFs reduce risk by spreading across many companies.',
  'Historically, bonds move inversely to stocks, cushioning portfolios.',
  'Crypto is volatile — allocate only what you can afford to lose.',
];

interface OverlayProps {
  ui: UiState;
  dispatch: Dispatch<UiAction>;
  onQuit: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  towerWorldRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

function shareOf(a: Allocation, t: LevelType): number {
  const s = sumAllocation(a);
  if (s <= 0) return 0;
  return a[t] / s;
}

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

export function Overlay({
  ui,
  dispatch,
  onQuit,
  containerRef,
  towerWorldRef,
}: OverlayProps) {
  const cur = ui.rounds[ui.roundIndex] ?? null;
  const accent = cur ? categoryAccent(cur.type) : '#6366f1';
  const accentSoft = `${accent}22`;
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (ui.phase !== 'playing') return;
    const id = window.setInterval(() => bump(), 100);
    return () => window.clearInterval(id);
  }, [ui.phase]);

  const [dykIdx, setDykIdx] = useState(0);
  useEffect(() => {
    if (ui.phase !== 'allocate') return;
    const t = setInterval(() => setDykIdx((i) => (i + 1) % DID_YOU_KNOW.length), 5000);
    return () => clearInterval(t);
  }, [ui.phase]);

  const projectWorld = useMemo(() => {
    return (wx: number, wy: number) => {
      const el = containerRef.current;
      if (!el) return { leftPx: 0, topPx: 0 };
      const frustum = computeFrustum(
        { width: el.clientWidth, height: el.clientHeight },
        {
          left: CAMERA_DESIGN.left,
          right: CAMERA_DESIGN.right,
          top: CAMERA_DESIGN.top,
          bottom: CAMERA_DESIGN.bottom,
        },
      );
      const p = worldToScreen(wx, wy, frustum, {
        width: el.clientWidth,
        height: el.clientHeight,
      });
      return { leftPx: p.x, topPx: p.y };
    };
  }, [containerRef, viewport.w, viewport.h]);

  const tw = towerWorldRef.current;
  const towerLabelScreen =
    tw && cur && ui.phase === 'playing' ? projectWorld(tw.x, tw.y) : null;
  void bump;

  const totalAllocation = sumAllocation(ui.allocation);
  const activePresetId = matchPreset(ui.allocation);
  const normalized =
    totalAllocation > 0
      ? normalizedAllocation(ui.allocation)
      : null;

  const previewRows = useMemo(() => {
    let roundIndex = 0;
    return ORDERED_LEVEL_TYPES.map((t) => ({ type: t, share: shareOf(ui.allocation, t) }))
      .filter((r) => r.share > 0)
      .map((r) => ({
        ...r,
        multiplier: multiplierForType(r.type, roundIndex++, r.share),
        birds: birdsFromShare(r.share),
        height: towerHeightFromShare(r.share),
        label: categoryLabel(r.type),
      }));
  }, [ui.allocation]);

  const applyPreset = (alloc: Allocation) => {
    dispatch({ type: 'SET_ALLOCATION', payload: alloc });
  };

  const normalizeTo100 = () => {
    if (!normalized) return;
    dispatch({ type: 'SET_ALLOCATION', payload: normalized });
  };

  if (ui.phase === 'allocate') {
    return (
      <div
        className="pointer-events-auto absolute inset-0 z-10 overflow-y-auto"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="absolute inset-x-0 top-10 mx-auto w-[min(680px,calc(100vw-24px))] rounded-2xl border border-white/25 bg-slate-950/95 p-6 shadow-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-5 text-amber-300" />
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Investing Birds</h2>
          </div>
          <p className="text-sm text-white/80">
            Build your portfolio. Each allocation becomes a tower. More investment ⇒ taller tower,
            more birds, bigger multiplier.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  chipBtn +
                  (activePresetId === p.id ? ' !border-indigo-300/70 !bg-indigo-500/40' : '')
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
              base points × current tower multiplier
            </span>
            . Bonds 1.0×, ETFs ~1.5×, Stocks ~2.0×, Crypto volatile.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ['stocks', 'Individual Stocks', <Target key="i" className="size-4" />, 'text-red-400'] as const,
                  ['etfs', 'ETFs', <BarChart3 key="e" className="size-4" />, 'text-sky-400'] as const,
                  ['bonds', 'Bonds', <Shield key="b" className="size-4" />, 'text-emerald-400'] as const,
                  ['crypto', 'Crypto', <Bitcoin key="c" className="size-4" />, 'text-amber-400'] as const,
                ] as const
              ).map(([key, label, icon, colorClass]) => (
                <label key={key} className="block rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className={`flex items-center justify-between text-sm font-semibold ${colorClass}`}>
                    <span className="inline-flex items-center gap-2">
                      {icon}
                      {label}
                    </span>
                    <span className="tabular-nums text-white">
                      {ui.allocation[key as keyof Allocation].toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    title={TOOLTIPS[key as LevelType]}
                    value={ui.allocation[key as keyof Allocation]}
                    className="mt-2 w-full accent-indigo-400"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      dispatch({
                        type: 'SET_ALLOCATION',
                        payload: { ...ui.allocation, [key]: v },
                      });
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-col items-center gap-3 sm:w-36">
              <PortfolioDonut allocation={ui.allocation} />
              <TowerMinimap allocation={ui.allocation} />
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
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-2.5 py-1.5 text-white/90"
                  >
                    <span className="font-medium">{r.label}</span>
                    <span className="tabular-nums">
                      {r.height} blocks • {r.birds} birds •{' '}
                      <span className="font-bold text-white">{r.multiplier.toFixed(2)}x</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            key={dykIdx}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/85"
          >
            <Sparkles className="size-3.5 text-amber-300" />
            Did you know? {DID_YOU_KNOW[dykIdx]}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm tabular-nums text-white/85">
              Total:{' '}
              <span
                className={`font-bold ${totalAllocation === 100 ? 'text-emerald-300' : 'text-white'}`}
              >
                {totalAllocation}%
              </span>
              {totalAllocation !== 100 && totalAllocation > 0 && normalized ? (
                <button
                  type="button"
                  onClick={normalizeTo100}
                  className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold hover:bg-white/20"
                >
                  Normalize
                </button>
              ) : null}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={onQuit}
              >
                Back
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  const norm = normalizedAllocation(ui.allocation);
                  dispatch({
                    type: 'START_RUN',
                    payload: { rounds: startRoundsFromAllocation(norm) },
                  });
                }}
              >
                Start run
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hud = ui.phase === 'playing';

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ pointerEvents: hud ? 'none' : 'auto' }}
    >
      {cur && towerLabelScreen ? (
        <div
          className="pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1"
          style={{ left: towerLabelScreen.leftPx, top: towerLabelScreen.topPx }}
        >
          <div
            className="rounded-full px-3 py-1 text-sm font-bold tabular-nums text-white shadow-lg"
            style={{ background: accent }}
          >
            {cur.multiplier.toFixed(2)}x
          </div>
          <div className="rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium tracking-wide text-white backdrop-blur-sm">
            {cur.label}
          </div>
        </div>
      ) : null}

      {hud ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-start gap-3 px-4 pt-5"
          style={{
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <div className="pointer-events-auto flex min-w-0 shrink items-center gap-2">
            <div
              className="flex items-center gap-2.5 rounded-2xl border border-white/25 px-3.5 py-2 shadow-lg backdrop-blur-md"
              style={{
                background: `linear-gradient(90deg, ${accentSoft}, rgba(15,23,42,0.85))`,
              }}
            >
              <Trophy className="size-5 shrink-0 text-amber-300" />
              <span className="text-xl font-extrabold tabular-nums leading-none tracking-tight text-white">
                {Math.round(ui.score).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/25 bg-slate-950/80 px-3 py-2 shadow backdrop-blur-md">
              <Heart className="size-4.5 fill-red-500 text-red-500" />
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(ui.birdsRemaining, 8) }).map((_, i) => (
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
                {ui.birdsRemaining > 8 ? (
                  <span className="ml-1 text-[11px] font-bold tabular-nums text-white/90">
                    +{ui.birdsRemaining - 8}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ui.phase === 'round_end_win' || ui.phase === 'round_end_loss' ? (
        <div
          className="flex min-h-full items-center justify-center px-4"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/25 bg-slate-950/95 p-6 text-center text-white shadow-2xl">
            <h2 className="text-xl font-bold" style={{ color: accent }}>
              {ui.phase === 'round_end_win' ? 'Round cleared' : 'Round lost'}
            </h2>
            <p className="mt-2 text-sm text-white/75">{ui.banner}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {ui.phase === 'round_end_win' ? (
                <button type="button" className={btnPrimary} onClick={() => dispatch({ type: 'NEXT_ROUND' })}>
                  Next category
                </button>
              ) : (
                <button type="button" className={btnPrimary} onClick={() => dispatch({ type: 'RETRY_ROUND' })}>
                  Retry round
                </button>
              )}
              <button
                type="button"
                className={btnGhost}
                onClick={() => dispatch({ type: 'GAME_LOST' })}
              >
                End run
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ui.phase === 'game_win' || ui.phase === 'game_loss' ? (
        <div
          className="flex min-h-full items-center justify-center px-4"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/25 bg-slate-950/95 p-6 text-center text-white shadow-2xl">
            <h2 className="text-xl font-bold text-indigo-300">
              {ui.phase === 'game_win' ? 'Portfolio challenge complete!' : 'Run ended'}
            </h2>
            <p className="mt-2 text-sm text-white/75">{ui.banner}</p>
            <p className="mt-3 text-lg font-semibold tabular-nums">
              Final score: {Math.round(ui.score).toLocaleString()}
            </p>
            <div className="mt-5 flex justify-center">
              <button type="button" className={btnPrimary} onClick={onQuit}>
                Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PortfolioDonut({ allocation }: { allocation: Allocation }) {
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
  const stops = order
    .filter((t) => allocation[t] > 0)
    .map((t) => {
      const p = (allocation[t] / total) * 100;
      const from = cursor;
      cursor += p;
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
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Total</div>
          <div className="text-lg font-extrabold tabular-nums text-white">{total}%</div>
        </div>
      </div>
    </div>
  );
}

function TowerMinimap({ allocation }: { allocation: Allocation }) {
  const order: LevelType[] = ['stocks', 'etfs', 'bonds', 'crypto'];
  const rows = order
    .map((t) => ({ type: t, share: shareOf(allocation, t) }))
    .filter((r) => r.share > 0);
  if (rows.length === 0) return null;
  return (
    <div className="relative flex w-full items-end justify-around gap-1 overflow-hidden rounded-lg border border-white/10 bg-black/25 p-2">
      {rows.map((r) => {
        const h = 10 + towerHeightFromShare(r.share) * 4;
        return (
          <div key={r.type} className="flex flex-col items-center gap-1">
            <div
              className="w-4 rounded-sm"
              style={{
                height: h,
                background: categoryAccent(r.type),
                boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.25)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
