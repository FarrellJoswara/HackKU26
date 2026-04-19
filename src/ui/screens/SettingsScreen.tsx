/**
 * Settings hub — audio + controls placeholders. Matches the title hub
 * shell (beach backdrop + glass card) and shared menu layout tokens.
 */

import { useState } from 'react';
import { ArrowLeft, Gamepad2, Volume2, VolumeX } from 'lucide-react';
import { audio } from '@/audio/AudioManager';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { TitleHubDecor } from '../components/TitleHubDecor';

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
    <div className="th-titleHub th-menuScreen absolute inset-0 overflow-y-auto text-[var(--island-color-ink)]">
      <TitleHubDecor />

      <div className="th-content">
        <div className="th-heroCard">
          <div className="island-hudBottle w-full">
            <div
              className="island-hudInner island-hudInner--titleHero px-6 py-8 text-left sm:px-8"
              role="region"
              aria-labelledby="settingsTitle"
              aria-describedby="settingsIntro"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="th-eyebrow th-menuEyebrow">Configuration</p>
                  <h1 id="settingsTitle" className="island-title th-titleGradient mt-1 text-3xl md:text-[2rem]">
                    Settings
                  </h1>
                </div>
                <button type="button" className="th-btnSettings shrink-0" onClick={handleBack}>
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  Back
                </button>
              </div>

              <div className="th-titleDivider th-menuDivider" role="presentation" />

              <p id="settingsIntro" className="island-statusText th-subtitle mt-3 max-w-xl">
                Tweak how the game sounds and plays. More options coming soon.
              </p>

              <section className="mt-8 space-y-4" aria-label="Audio settings">
                <h2 className="th-sectionKicker">Audio</h2>
                <div className="island-paperCard flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(26,77,92,0.12)] text-[var(--island-color-title)]"
                      aria-hidden
                    >
                      {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--island-color-title)]">Mute all audio</p>
                      <p className="mt-0.5 text-sm text-[var(--island-color-ink-muted)]">
                        Silences music and sound effects.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="th-btnSettings shrink-0 self-stretch sm:self-center"
                    onClick={toggleMute}
                    aria-pressed={muted}
                  >
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                </div>
              </section>

              <section className="mt-8 space-y-4" aria-label="Controls settings">
                <h2 className="th-sectionKicker">Controls</h2>
                <div className="island-paperCard flex items-start gap-3 rounded-2xl p-4">
                  <div
                    className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(26,77,92,0.12)] text-[var(--island-color-title)]"
                    aria-hidden
                  >
                    <Gamepad2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--island-color-title)]">Keyboard &amp; mouse</p>
                    <p className="mt-1 text-sm text-[var(--island-color-ink-muted)]">
                      Rebinding is not available yet. Default controls are used for every mini-game.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
