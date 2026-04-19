/**
 * Settings hub. Placeholder sections for audio + controls so future
 * teammates have a clear home to extend, plus a Back button that
 * returns to the title hub.
 */

import { useState } from 'react';
import { ArrowLeft, Gamepad2, Volume2, VolumeX } from 'lucide-react';
import { audio } from '@/audio/AudioManager';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';

export default function SettingsScreen(_props: UIProps<unknown>) {
  const [muted, setMuted] = useState(false);

  const handleBack = () => {
    eventBus.emit('navigate:request', { to: 'menu', module: null });
  };

  const toggleMute = () => {
    const next = !muted;
    audio.mute(next);
    setMuted(next);
  };

  return (
    <div className="island-pageBg absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-10">
        <div className="island-hudBottle">
          <div className="island-hudInner px-6 py-7">
            <header className="flex flex-col gap-3 border-b border-[rgba(120,90,50,0.2)] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
                  Configuration
                </p>
                <h1 className="island-title mt-1 text-3xl">Settings</h1>
                <p className="island-statusText mt-3 max-w-md text-sm">
                  Tweak how the game sounds and plays. More options coming soon.
                </p>
              </div>
              <button
                type="button"
                className="island-btnShell shrink-0"
                onClick={handleBack}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </header>

            <section className="mt-6 space-y-4" aria-label="Audio settings">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--island-color-ink-muted)]">
                Audio
              </h2>
              <div className="island-paperCard flex items-center justify-between rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(26,77,92,0.12)] text-[var(--island-color-title)]">
                    {muted ? (
                      <VolumeX className="size-5" />
                    ) : (
                      <Volume2 className="size-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--island-color-ink)]">
                      Mute all audio
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--island-color-ink-muted)]">
                      Silences music and sound effects.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="island-btnShell"
                  onClick={toggleMute}
                  aria-pressed={muted}
                >
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            </section>

            <section className="mt-6 space-y-4" aria-label="Controls settings">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--island-color-ink-muted)]">
                Controls
              </h2>
              <div className="island-paperCard flex items-start gap-3 rounded-2xl p-4">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(26,77,92,0.12)] text-[var(--island-color-title)]">
                  <Gamepad2 className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-[var(--island-color-ink)]">
                    Keyboard &amp; mouse
                  </p>
                  <p className="mt-1 text-xs text-[var(--island-color-ink-muted)]">
                    Rebinding is not available yet. Default controls are used
                    for every mini-game.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
