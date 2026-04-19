/**
 * Tailwind primitive button. Variants are tuned for the tropical theme:
 * `coral` (default primary), `turquoise`, `sand`, plus the legacy
 * `primary` / `ghost` kept for back-compat with older screens.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'coral' | 'turquoise' | 'sand' | 'primary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leadingIcon?: ReactNode;
  children: ReactNode;
}

// `tropic-pill` carries the rounded "candy" feel + ease-back hover.
// We compose modifier classes for the color story; `primary`/`ghost`
// still exist so older screens keep working without a refactor.
const variantClass: Record<Variant, string> = {
  coral: 'tropic-pill tropic-pill--coral',
  turquoise: 'tropic-pill tropic-pill--turquoise',
  sand: 'tropic-pill tropic-pill--sand',
  primary: 'tropic-pill tropic-pill--coral',
  ghost:
    'tropic-pill tropic-pill--turquoise opacity-95 backdrop-blur',
};

export function Button({
  variant = 'coral',
  leadingIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[variantClass[variant], 'text-sm', className].join(' ')}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
