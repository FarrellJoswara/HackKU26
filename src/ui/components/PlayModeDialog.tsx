/**
 * Presentational Play modal: Continue / New Game / Cancel.
 *
 * Owns no app state — the parent passes `open`, `hasSave`, and the three
 * callbacks. Closes on Escape or backdrop click.
 */

import { useEffect, useRef } from 'react';
import { Play, RotateCw, X } from 'lucide-react';

export interface PlayModeDialogProps {
  open: boolean;
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onClose: () => void;
}

export function PlayModeDialog({
  open,
  hasSave,
  onContinue,
  onNewGame,
  onClose,
}: PlayModeDialogProps) {
  const newGameBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    // Move focus into the dialog for keyboard users.
    newGameBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playModeTitle"
        className="island-hudBottle w-[min(92vw,28rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="island-hudInner relative px-6 py-6 text-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1 text-[var(--island-color-ink-muted)] hover:bg-black/10"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>

          <p
            id="playModeTitle"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80"
          >
            Play
          </p>
          <h2 className="island-title mt-1 text-3xl">Choose a mode</h2>
          <p className="island-statusText mx-auto mt-3 max-w-xs text-sm">
            Pick up where you left off, or start fresh with a new difficulty.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className="island-btnShell"
              disabled={!hasSave}
              onClick={onContinue}
              title={hasSave ? undefined : 'No saved run yet'}
            >
              <RotateCw className="size-4" />
              Continue
            </button>
            <button
              ref={newGameBtnRef}
              type="button"
              className="island-btnShell"
              onClick={onNewGame}
            >
              <Play className="size-4" />
              New Game
            </button>
            <button
              type="button"
              className="island-btnShell"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>

          {!hasSave ? (
            <p className="island-hintText mt-4">
              Continue unlocks once you have an in-progress run.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
