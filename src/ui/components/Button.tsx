/**
 * Tailwind primitive button. Variants are tuned for the tropical theme:
 * `coral` (default primary), `turquoise`, `sand`, plus the legacy
 * `primary` / `ghost` kept for back-compat with older screens.
 *
 * Opt-in micro-reward: pass `microReward` (level) to add the standard
 * UI click feedback (visual flash + soft SFX). Defaults to `'subtle'`
 * for the strong `coral` / `primary` variants and `false` for ghost
 * variants so existing screens stay quiet by default.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  useMicroReward,
  type MicroRewardLevel,
} from '@/ui/hooks/useMicroReward';

type Variant = 'coral' | 'turquoise' | 'sand' | 'primary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leadingIcon?: ReactNode;
  children: ReactNode;
  /**
   * Micro-reward intensity on click. Pass `false` to disable, or a level
   * to opt in. Falls back to a per-variant default when omitted.
   */
  microReward?: MicroRewardLevel | false;
}

const variantClass: Record<Variant, string> = {
  coral: 'tropic-pill tropic-pill--coral',
  turquoise: 'tropic-pill tropic-pill--turquoise',
  sand: 'tropic-pill tropic-pill--sand',
  primary: 'tropic-pill tropic-pill--coral',
  ghost: 'tropic-pill tropic-pill--turquoise opacity-95 backdrop-blur',
};

const defaultRewardForVariant: Record<Variant, MicroRewardLevel | false> = {
  coral: 'subtle',
  primary: 'subtle',
  turquoise: 'subtle',
  sand: 'subtle',
  ghost: false,
};

export function Button({
  variant = 'coral',
  leadingIcon,
  className = '',
  children,
  microReward,
  onClick,
  disabled,
  ...rest
}: ButtonProps) {
  const resolvedReward =
    microReward === undefined ? defaultRewardForVariant[variant] : microReward;
  const rewardEnabled = resolvedReward !== false;

  const { overlayRef, onClick: wrapClick } = useMicroReward({
    level: rewardEnabled ? resolvedReward : 'subtle',
    disabled: !rewardEnabled || disabled === true,
  });

  return (
    <button
      className={[
        variantClass[variant],
        'text-sm',
        rewardEnabled ? 'ui-reward-host' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={wrapClick(onClick ?? undefined)}
      {...rest}
    >
      {rewardEnabled ? (
        <span ref={overlayRef} className="ui-reward-overlay" aria-hidden />
      ) : null}
      {leadingIcon}
      {children}
    </button>
  );
}
