/**
 * In-game HUD shell. Lives over the R3F canvas during the `game` app state.
 *
 * The DebtRunner HUD is fully re-skinned to the tropical palette:
 *   - rounded sand-pill panels (`tropic-hudPill` + `tropic-hudPill--contrast`)
 *   - turquoise stamina, coral debt-pressure, sun-gold timer (`tropic-hudBar--*`)
 *   - lives shown as a row of seashell hearts (`tropic-shell`)
 *   - morale + chase-gap bars, collector stage badge, transient control hints
 */

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Flame,
  Footprints,
  Pause,
  Skull,
  Smile,
  Timer,
  Umbrella,
  Volume2,
  Waves,
} from 'lucide-react';
import { eventBus } from '@/core/events';
import { audio } from '@/audio/AudioManager';
import { useAppStore } from '@/core/store';
import { GAME_IDS } from '@/games/registry';
import type { RunnerHudState } from '@/core/runner/hudTypes';

function ShellHearts({ lives, max }: { lives: number; max: number }) {
  const slots = Array.from({ length: Math.max(max, lives) });
  return (
    <div className="flex items-center gap-1.5">
      {slots.map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`tropic-shell ${i < lives ? '' : 'tropic-shell--lost'}`}
        />
      ))}
      <span className="ml-2 text-xs font-semibold text-[#481b10]/80">
        {lives}/{max}
      </span>
    </div>
  );
}

const COLLECTOR_STAGE_UI: Record<
  RunnerHudState['monsterStage'],
  { Icon: typeof Umbrella; pill: string; iconClass: string }
> = {
  manageable: { Icon: Umbrella, pill: 'bg-teal-600/18 text-teal-950', iconClass: 'text-teal-700' },
  threatening: { Icon: AlertCircle, pill: 'bg-amber-500/22 text-amber-950', iconClass: 'text-amber-700' },
  dangerous: { Icon: Flame, pill: 'bg-orange-600/22 text-orange-950', iconClass: 'text-orange-700' },
  overwhelming: { Icon: Skull, pill: 'bg-red-600/24 text-red-950', iconClass: 'text-red-700' },
};

const STAGE_ORDER: Record<RunnerHudState['monsterStage'], number> = {
  manageable: 0,
  threatening: 1,
  dangerous: 2,
  overwhelming: 3,
};

function DebtRunnerHudLayer({ hud }: { hud: RunnerHudState }) {
  const [showHints, setShowHints] = useState(true);
  const [stageToast, setStageToast] = useState<string | null>(null);
  const prevStageRef = useRef<RunnerHudState['monsterStage']>(hud.monsterStage);

  useEffect(() => {
    const t = window.setTimeout(() => setShowHints(false), 14000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = prevStageRef.current;
    if (STAGE_ORDER[hud.monsterStage] > STAGE_ORDER[prev]) {
      const lines: Record<RunnerHudState['monsterStage'], string> = {
        manageable: '',
        threatening: 'Collector is picking up the pace.',
        dangerous: 'They are gaining — protect your gap!',
        overwhelming: 'Debt pressure is overwhelming — sprint!',
      };
      const msg = lines[hud.monsterStage];
      if (msg) {
        setStageToast(msg);
        const clear = window.setTimeout(() => setStageToast(null), 2300);
        prevStageRef.current = hud.monsterStage;
        return () => window.clearTimeout(clear);
      }
      prevStageRef.current = hud.monsterStage;
      return undefined;
    }
    prevStageRef.current = hud.monsterStage;
    return undefined;
  }, [hud.monsterStage]);

  const stamina = Math.max(0, Math.min(100, hud.stamina));
  const debtPct = Math.max(0, Math.min(100, hud.debtPressure * 100));
  const morale = Math.max(0, Math.min(100, hud.morale));
  const timerLow = Math.ceil(hud.timerSeconds) <= 10 && hud.timerSeconds > 0;
  const stage = COLLECTOR_STAGE_UI[hud.monsterStage];
  const StageIcon = stage.Icon;

  return (
    <div className="pointer-events-none absolute inset-0 p-4 text-[#2a2418]">
      {/* Static frame vignette — gives the screen a soft tropical edge
          without the chase-pressure pulsing that previously animated here. */}
      <div
        className="tropic-chase-vignette pointer-events-none absolute inset-0"
        style={{ opacity: 0.18 }}
        aria-hidden
      />

      <span className="sr-only" aria-live="polite">
        {timerLow ? `${Math.ceil(hud.timerSeconds)} seconds remaining` : ''}
      </span>

      {stageToast ? (
        <div
          className="tropic-chase-stage-toast pointer-events-none absolute left-1/2 top-20 z-30 max-w-sm -translate-x-1/2 rounded-2xl border border-[#b94530]/40 bg-gradient-to-b from-[#fff7e8] to-[#ffd9c4] px-4 py-2 text-center text-xs font-bold text-[#481b10] shadow-lg"
          role="status"
        >
          {stageToast}
        </div>
      ) : null}

      {/* Top center: timer + lives in a single combined pill so the focal
          point of the screen is one tight HUD anchor instead of two. */}
      <div
        className={`absolute left-1/2 top-3 -translate-x-1/2 tropic-hudPill tropic-hudPill--contrast tropic-pop flex items-center gap-3 px-4 py-2 ${
          timerLow ? 'tropic-timer-urgent' : ''
        }`}
      >
        <span
          className="grid place-items-center rounded-full bg-gradient-to-b from-[#ffe7a8] to-[#f59f3a] p-1.5 shadow-inner"
          aria-hidden
        >
          <Timer className="size-4 text-[#4a3514]" />
        </span>
        <span
          className={`text-2xl font-semibold tabular-nums leading-none ${
            timerLow ? 'text-[#b94530]' : 'text-[#1a4d5c]'
          }`}
          style={{ fontFamily: 'var(--island-font-display)' }}
        >
          {Math.ceil(hud.timerSeconds)}s
        </span>
        <span className="h-7 w-px bg-[#b8895f]/40" aria-hidden />
        <ShellHearts lives={hud.lives} max={hud.maxLives} />
      </div>

      <div className="pointer-events-none mt-16 flex items-start justify-between gap-3">
        {/* Left: a single frosted stat card grouping all three bars. Sharing
            one container reduces the visual noise of three stacked pills. */}
        <div className="tropic-hudPill tropic-hudPill--contrast w-64 space-y-2.5 px-4 py-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#0e3a40]">
              <span className="inline-flex items-center gap-1.5">
                <Waves className="size-3.5 text-[#2aa6b0]" />
                Stamina
              </span>
              <span className="tabular-nums">{Math.round(stamina)}</span>
            </div>
            <div className="tropic-hudBar tropic-hudBar--turquoise">
              <span className="tropic-hudBarFill--shimmer" style={{ width: `${stamina}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#481b10]">
              <span className="inline-flex items-center gap-1.5">
                <Flame className="size-3.5 text-[#e8624a]" />
                Debt Pressure
              </span>
              <span className="tabular-nums">{Math.round(debtPct)}%</span>
            </div>
            <div className="tropic-hudBar tropic-hudBar--coral">
              <span style={{ width: `${debtPct}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#3d5c1a]">
              <span className="inline-flex items-center gap-1.5">
                <Smile className="size-3.5 text-[#6ba32a]" />
                Morale
              </span>
              <span className="tabular-nums">{Math.round(morale)}</span>
            </div>
            <div className="tropic-hudBar tropic-hudBar--sun">
              <span style={{ width: `${morale}%` }} />
            </div>
          </div>
        </div>

        {/* Right: compact stage badge + pause. Chase-gap pill removed — the
            collector is hidden during normal play, so showing the literal gap
            in metres is redundant noise. The stage badge already conveys
            escalation, and the screen vignette conveys urgency. */}
        <div className="pointer-events-auto flex h-fit flex-col items-end gap-2">
          <div
            className={`tropic-hudPill tropic-hudPill--contrast flex items-center gap-2 px-3 py-1.5 text-xs ${stage.pill}`}
            title={`Collector: ${hud.monsterStage} (gap ${hud.chaseDistance.toFixed(1)}m)`}
          >
            <StageIcon className={`size-3.5 shrink-0 ${stage.iconClass}`} aria-hidden />
            <span className="font-semibold capitalize">{hud.monsterStage}</span>
          </div>

          <button
            className="tropic-pill tropic-pill--turquoise px-3 py-2"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}
            aria-label="Pause"
            type="button"
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>

      {showHints ? (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 w-[min(92vw,28rem)] -translate-x-1/2">
          <div className="tropic-hudPill tropic-hudPill--contrast px-4 py-2 text-center text-xs font-semibold text-[#2a2418]/90 shadow-md">
            <span className="inline-flex items-center gap-1.5">
              <Footprints className="size-3.5 shrink-0 text-[#2aa6b0]" aria-hidden />
              <span>
                <kbd className="rounded bg-[#fbe6be] px-1 py-0.5 font-mono text-[10px]">A</kbd> /{' '}
                <kbd className="rounded bg-[#fbe6be] px-1 py-0.5 font-mono text-[10px]">←</kbd> left ·{' '}
                <kbd className="rounded bg-[#fbe6be] px-1 py-0.5 font-mono text-[10px]">D</kbd> /{' '}
                <kbd className="rounded bg-[#fbe6be] px-1 py-0.5 font-mono text-[10px]">→</kbd> right ·{' '}
                <kbd className="rounded bg-[#fbe6be] px-1 py-0.5 font-mono text-[10px]">↑</kbd> /{' '}
                <kbd className="rounded bg-[#fbe6be] px-1 py-0.5 font-mono text-[10px]">Space</kbd> jump
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2">
        {hud.debuffs.map((debuff) => (
          <div
            key={debuff}
            className="tropic-pop rounded-full border border-white/70 bg-gradient-to-b from-[#ffd9c4] to-[#ff8b6b] px-3 py-1 text-xs font-semibold text-[#481b10] shadow"
          >
            {debuff}
          </div>
        ))}
      </div>

      {hud.paused ? (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-[rgba(15,40,50,0.45)] backdrop-blur-sm">
          <div className="tropic-pause-wave-top mb-0 max-w-md" aria-hidden />
          <div className="tropic-card tropic-pop w-full max-w-md rounded-t-none border-t-0 px-7 pb-7 pt-5 text-center shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1a4d5c]/75">
              Paradise paused
            </p>
            <h3
              className="mt-1 text-3xl font-semibold text-[#1a4d5c]"
              style={{ fontFamily: 'var(--island-font-display)' }}
            >
              Catch your breath
            </h3>
            <p className="mt-2 text-sm text-[#3d3428]/85">
              Press <kbd className="rounded bg-[#fbe6be] px-1.5 py-0.5 text-[11px] font-semibold">Esc</kbd> to
              resume, or return to the menu when you are ready.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                className="tropic-pill tropic-pill--turquoise"
                type="button"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}
              >
                Resume
              </button>
              <button
                className="tropic-pill tropic-pill--coral"
                type="button"
                onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
              >
                Quit to menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HUD() {
  const activeModule = useAppStore((s) => s.activeModule);
  const data = useAppStore((s) => s.playerData);

  if (activeModule === GAME_IDS.debtRunner) {
    const hud = (data['runner.hud'] as RunnerHudState | undefined) ?? null;
    if (!hud) return null;
    return <DebtRunnerHudLayer hud={hud} />;
  }

  if (activeModule === GAME_IDS.islandRun) {
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-end justify-start p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            className="tropic-pill tropic-pill--turquoise px-4 py-2 text-sm"
            type="button"
            onClick={() =>
              eventBus.emit('navigate:request', { to: 'menu', module: null })
            }
          >
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  // Fallback HUD for any other game module (e.g. TemplateGame).
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
      <div className="flex items-center justify-end gap-2">
        <button
          className="pointer-events-auto tropic-pill tropic-pill--turquoise px-3 py-2"
          onClick={() => audio.mute(false)}
          aria-label="Audio"
        >
          <Volume2 className="size-4" />
        </button>
        <button
          className="pointer-events-auto tropic-pill tropic-pill--coral px-3 py-2"
          onClick={() =>
            eventBus.emit('navigate:request', { to: 'menu', module: null })
          }
          aria-label="Pause / quit"
        >
          <Pause className="size-4" />
        </button>
      </div>
    </div>
  );
}
