/**
 * @file RewardButton — opt-in micro-reward wrapper for raw `<button>` elements.
 *
 * Why this exists: most high-traffic buttons in the app use bespoke
 * classes (`th-btnPlay`, `th-btnSettings`, `island-btnShell`, …) rather
 * than the shared `Button` primitive. Refactoring every screen to use
 * `Button` would force a visual rewrite. This component instead keeps
 * the host's existing class names intact and only injects the reward
 * overlay + click wrapper, so adding feedback to a screen is a 1-line
 * change with zero risk of regressing the existing look.
 *
 *   <RewardButton className="th-btnPlay" onClick={handlePlay}>Play</RewardButton>
 *
 * Forwards `ref` so consumers (e.g. `PlayModeDialog`) can manage focus.
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  useMicroReward,
  type MicroRewardLevel,
} from '@/ui/hooks/useMicroReward';

export interface RewardButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Reward intensity. Default `'subtle'`. Pass `false` to disable. */
  microReward?: MicroRewardLevel | false;
  /** Override the SFX id; pass `null` to mute audio for this button. */
  sfxId?: string | null;
}

export const RewardButton = forwardRef<HTMLButtonElement, RewardButtonProps>(
  function RewardButton(
    {
      className = '',
      children,
      microReward = 'subtle',
      sfxId,
      onClick,
      disabled,
      ...rest
    },
    ref,
  ) {
    const enabled = microReward !== false;
    const { overlayRef, onClick: wrapClick } = useMicroReward({
      level: enabled ? microReward : 'subtle',
      disabled: !enabled || disabled === true,
      ...(sfxId !== undefined ? { sfxId } : {}),
    });

    return (
      <button
        ref={ref}
        className={[enabled ? 'ui-reward-host' : '', className]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        onClick={wrapClick(onClick ?? undefined)}
        {...rest}
      >
        {enabled ? (
          <span ref={overlayRef} className="ui-reward-overlay" aria-hidden />
        ) : null}
        {children}
      </button>
    );
  },
);
