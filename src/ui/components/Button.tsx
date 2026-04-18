/**
 * Tailwind primitive button. Keep variants minimal — UI screens compose
 * this into whatever look they need.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leadingIcon?: ReactNode;
  children: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white shadow-lg shadow-indigo-900/30',
  ghost:
    'bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 backdrop-blur',
};

export function Button({
  variant = 'primary',
  leadingIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
        'text-sm font-medium tracking-wide select-none',
        'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
