/**
 * Presentational Play modal: Continue / New Game / Cancel.
 *
 * Owns no app state — the parent passes `open`, `hasSave`, and the three
 * callbacks. Closes on Escape or backdrop click.
 */

import { useEffect, useRef } from 'react';
import { Play, RotateCw, X } from 'lucide-react';
import { RewardButton } from './RewardButton';

export interface PlayModeDialogProps {
  /** Stable id for `aria-controls` from the title hub Play button. */
  dialogId?: string;
  open: boolean;
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onClose: () => void;
}

export function PlayModeDialog({
  dialogId = 'play-mode-dialog',
  open,
  hasSave,
  onContinue,
  onNewGame,
  onClose,
}: PlayModeDialogProps) {
  const continueBtnRef = useRef<HTMLButtonElement>(null);
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
    // Prefer Continue when a save exists; otherwise land on New Game.
    if (hasSave) continueBtnRef.current?.focus();
    else newGameBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, hasSave]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playModeTitle"
        aria-describedby="playModeDesc"
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
          <h2 className="island-title mt-1 text-3xl">Choose your path</h2>
          <p id="playModeDesc" className="island-statusText mx-auto mt-3 max-w-xs text-sm">
            Continue your current run or begin fresh with a new difficulty.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <RewardButton
              ref={continueBtnRef}
              type="button"
              className="island-btnShell"
              microReward="normal"
              disabled={!hasSave}
              onClick={onContinue}
              aria-label={hasSave ? 'Continue saved Island Run' : 'Continue (no save yet)'}
              title={hasSave ? undefined : 'No saved run yet'}
            >
              <RotateCw className="size-4" />
              Continue
            </RewardButton>
            <RewardButton
              ref={newGameBtnRef}
              type="button"
              className="island-btnShell"
              microReward="normal"
              aria-label="Start a new game"
              onClick={onNewGame}
            >
              <Play className="size-4" />
              New Game
            </RewardButton>
            <RewardButton
              type="button"
              className="island-btnShell"
              aria-label="Close and return to title"
              onClick={onClose}
            >
              Cancel
            </RewardButton>
          </div>

          {!hasSave ? (
            <p className="island-hintText mt-4">
              Continue unlocks after you start your first run.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
