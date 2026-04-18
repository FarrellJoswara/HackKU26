/**
 * Generic in-game HUD shell. Sits on top of the R3F canvas during the
 * `game` app state. Keep it free of game-specific logic — instead, read
 * `playerData` from the store or subscribe to `eventBus` for whatever
 * the active game emits.
 *
 * TODO: customise per-game (e.g. score, timer, mini-map). One option:
 *       look up `activeModule` and render a per-game HUD slice.
 */

import { Heart, Pause, Volume2 } from 'lucide-react';
import { eventBus } from '@/core/events';
import { audio } from '@/audio/AudioManager';

export function HUD() {
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
