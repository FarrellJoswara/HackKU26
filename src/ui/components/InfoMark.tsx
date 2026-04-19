/**
 * InfoMark — small inline help affordance.
 *
 * Behavior:
 *  - **Desktop (mouse):** hover the mark → popover appears; leaving mark
 *    or popover hides it. Focus + Enter / Space also toggles for keyboard.
 *  - **Touch:** tap the mark to toggle the popover; tap outside (or the
 *    mark again) dismisses. We rely on `pointerdown` outside-detection
 *    rather than `click` so it works inside scroll containers.
 *  - **Keyboard:** mark is a real `<button>`. Enter/Space toggles, Escape
 *    closes and restores focus to the mark.
 *
 * Accessibility:
 *  - Mark exposes `aria-expanded` + `aria-controls` referencing the
 *    popover id (auto-generated per instance).
 *  - Popover is `role="tooltip"` and labelled by `aria-label` on the mark.
 *  - When the popover holds rich content (not just a sentence), pass
 *    `popoverRole="dialog"` and the mark gets `aria-haspopup="dialog"`.
 *
 * The component owns its open state. If you need controlled mode later,
 * promote `open` to a prop pair — keep the API minimal for now.
 *
 * Architecture (AGENTS.md): pure DOM, no Three.js, no game imports.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Info } from 'lucide-react';

export type InfoMarkPlacement = 'top' | 'bottom' | 'left' | 'right';
export type InfoMarkTone = 'neutral' | 'warn';

export interface InfoMarkProps {
  /** Short descriptive label for the affordance itself (e.g. "About Emergency Fund"). */
  label: string;
  /** Popover content. Plain text or rich nodes — keep it short, ~120 chars per line. */
  children: ReactNode;
  /** Where to anchor the popover relative to the mark. Default: `top`. */
  placement?: InfoMarkPlacement;
  /** Visual tone. `warn` switches the icon ring to the soft-amber palette. */
  tone?: InfoMarkTone;
  /** Optional preferred popover width in pixels. Defaults to 240. */
  popoverWidth?: number;
  /** If true, rendered popover gets `role="dialog"` for richer content. */
  popoverRole?: 'tooltip' | 'dialog';
  /** Extra className for the trigger button. */
  className?: string;
}

const ICON_TONE_CLASS: Record<InfoMarkTone, string> = {
  neutral:
    'text-[var(--island-color-title)] hover:text-[#0a3d45] focus-visible:text-[#0a3d45]',
  warn: 'text-[#8b6914] hover:text-[#5c4410] focus-visible:text-[#5c4410]',
};

export function InfoMark({
  label,
  children,
  placement = 'top',
  tone = 'neutral',
  popoverWidth = 240,
  popoverRole = 'tooltip',
  className = '',
}: InfoMarkProps) {
  const id = useId();
  const popoverId = `${id}-pop`;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Tracks whether hover *just* opened the popover. This avoids the
  // hover-then-click race: when a mouse user enters the trigger and
  // immediately clicks, `pointerenter` opens it, then `click` would
  // otherwise toggle it shut. We swallow the next click in that window.
  const hoverJustOpenedRef = useRef(false);

  const toggle = useCallback(() => {
    if (hoverJustOpenedRef.current) {
      hoverJustOpenedRef.current = false;
      // Already open from hover — keep it open instead of toggling shut.
      setOpen(true);
      return;
    }
    setOpen((v) => !v);
  }, []);

  // Hover timing — small leave-delay so cursor can travel from the mark
  // into the popover without flicker. Touch users don't trigger hover.
  const hideTimer = useRef<number | null>(null);
  const cancelHide = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setOpen(false), 120);
  }, [cancelHide]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  // Outside dismiss — pointerdown so it fires before scroll containers
  // swallow the event. Escape closes + restores focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', handlePointer, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const onTriggerKey = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  const popoverStyle = useMemo<CSSProperties>(() => {
    return { width: popoverWidth, maxWidth: 'min(80vw, 320px)' };
  }, [popoverWidth]);

  const placementClass: Record<InfoMarkPlacement, string> = {
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
    left: 'right-full top-1/2 mr-2 -translate-y-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  };

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(e) => {
        // Only hover-open for fine pointers (mouse). Touch should require tap.
        if (e.pointerType === 'mouse') {
          cancelHide();
          setOpen(true);
          hoverJustOpenedRef.current = true;
          window.setTimeout(() => {
            hoverJustOpenedRef.current = false;
          }, 300);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') scheduleHide();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup={popoverRole === 'dialog' ? 'dialog' : undefined}
        onClick={toggle}
        onKeyDown={onTriggerKey}
        onBlur={(e) => {
          // Don't auto-open on focus — that would conflict with click-toggle
          // (focus fires before click, so the click would immediately
          // re-close). Keyboard users open via Enter/Space (`onTriggerKey`).
          // We still hide on blur so a popover left open via keyboard
          // dismisses naturally when focus leaves.
          const next = e.relatedTarget as Node | null;
          if (next && popoverRef.current?.contains(next)) return;
          scheduleHide();
        }}
        className={[
          'info-mark-btn',
          'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
          'border border-transparent transition focus:outline-none',
          'hover:border-current focus-visible:border-current focus-visible:ring-2 focus-visible:ring-[var(--island-color-title)]/55',
          ICON_TONE_CLASS[tone],
          className,
        ].join(' ')}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          ref={popoverRef}
          id={popoverId}
          role={popoverRole}
          style={popoverStyle}
          onPointerEnter={cancelHide}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') scheduleHide();
          }}
          className={[
            'absolute z-50 rounded-xl border border-[rgba(120,90,50,0.28)]',
            'bg-[rgba(255,252,245,0.98)] px-3 py-2 text-left text-xs',
            'leading-snug text-[var(--island-color-ink)] shadow-[0_10px_24px_rgba(20,60,80,0.22)]',
            'backdrop-blur',
            placementClass[placement],
          ].join(' ')}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

export default InfoMark;
