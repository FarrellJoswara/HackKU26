/**
 * Generic in-game HUD shell. Sits on top of the R3F canvas during the
 * `game` app state. Keep it free of game-specific logic — instead, read
 * `playerData` from the store or subscribe to `eventBus` for whatever
 * the active game emits.
 *
 * TODO: customise per-game (e.g. score, timer, mini-map). One option:
 *       look up `activeModule` and render a per-game HUD slice.
 */

import { Heart, Pause, Volume2, Timer, Flame, BatteryCharging } from 'lucide-react';
import { eventBus } from '@/core/events';
import { audio } from '@/audio/AudioManager';
import { useAppStore } from '@/core/store';
import { GAME_IDS } from '@/games/registry';
import type { RunnerHudState } from '@/core/runner/hudTypes';

export function HUD() {
  const activeModule = useAppStore((s) => s.activeModule);
  const data = useAppStore((s) => s.playerData);

  if (activeModule === GAME_IDS.debtRunner) {
    const hud = (data['runner.hud'] as RunnerHudState | undefined) ?? null;
    if (!hud) return null;

    return (
      <div className="pointer-events-none absolute inset-0 p-4 text-white">
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-xl bg-black/45 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Timer className="size-5 text-cyan-200" />
            <span>{Math.ceil(hud.timerSeconds)}s</span>
          </div>
        </div>

        <div className="pointer-events-none mt-12 flex justify-between">
          <div className="space-y-2">
            <div className="rounded-xl bg-black/40 px-3 py-2 text-sm backdrop-blur">
              Lives: <span className="font-semibold">{hud.lives}</span> / {hud.maxLives}
            </div>
            <div className="w-52 rounded-xl bg-black/40 px-3 py-2 backdrop-blur">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1">
                  <BatteryCharging className="size-3.5 text-emerald-200" />
                  Stamina
                </span>
                <span>{Math.round(hud.stamina)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-400"
                  style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
                />
              </div>
            </div>
            <div className="w-52 rounded-xl bg-black/40 px-3 py-2 backdrop-blur">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-3.5 text-rose-200" />
                  Debt Pressure
                </span>
                <span>{Math.round(hud.debtPressure * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-rose-400"
                  style={{ width: `${Math.max(0, Math.min(100, hud.debtPressure * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex h-fit flex-col items-end gap-2">
            <div className="rounded-xl bg-black/40 px-3 py-2 text-sm backdrop-blur">
              Collector: <span className="font-semibold uppercase">{hud.monsterStage}</span>
            </div>
            <div className="rounded-xl bg-black/40 px-3 py-2 text-sm backdrop-blur">
              Chase Gap: {hud.chaseDistance.toFixed(1)}m
            </div>
            <button
              className="rounded-lg bg-black/40 p-2 backdrop-blur hover:bg-black/60"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}
              aria-label="Pause"
              type="button"
            >
              <Pause className="size-4" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 flex gap-2">
          {hud.debuffs.map((debuff) => (
            <div key={debuff} className="rounded-full bg-amber-500/25 px-3 py-1 text-xs text-amber-100">
              {debuff}
            </div>
          ))}
        </div>

        {hud.paused ? (
          <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center">
              <h3 className="text-2xl font-semibold">Paused</h3>
              <p className="mt-2 text-sm text-white/70">Press Esc to resume the run.</p>
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                type="button"
                onClick={() =>
                  eventBus.emit('navigate:request', { to: 'menu', module: null })
                }
              >
                <Heart className="size-4" />
                Quit to menu
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeModule === GAME_IDS.islandRun) {
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-end justify-start p-4 text-white">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            className="rounded-lg bg-black/50 px-3 py-2 text-sm font-medium backdrop-blur hover:bg-black/70"
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

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 backdrop-blur">
          <Heart className="size-4 text-rose-400" />
          {/* TODO: bind to playerData.health */}
          <span className="text-sm font-medium">100</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            className="rounded-lg bg-black/40 p-2 backdrop-blur hover:bg-black/60"
            onClick={() => audio.mute(false)}
            aria-label="Audio"
          >
            <Volume2 className="size-4" />
          </button>
          <button
            className="rounded-lg bg-black/40 p-2 backdrop-blur hover:bg-black/60"
            onClick={() =>
              eventBus.emit('navigate:request', { to: 'menu', module: null })
            }
            aria-label="Pause / quit"
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>

      <div className="text-xs opacity-60">
        {/* TODO: subtitles, toasts, debug info, ... */}
      </div>
    </div>
  );
}
