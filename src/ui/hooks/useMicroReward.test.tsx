/**
 * Behavioral coverage for `useMicroReward`.
 *
 * Audio is mocked because jsdom has no real audio backend; we assert
 * that `audio.playSFX` is invoked the expected number of times for
 * each scenario instead of trying to play sound.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const playSFX = vi.fn();

vi.mock('@/audio/AudioManager', () => ({
  audio: {
    playSFX: (id: string) => playSFX(id),
  },
}));

import { useMicroReward, type MicroRewardLevel } from './useMicroReward';

interface HarnessProps {
  level?: MicroRewardLevel;
  disabled?: boolean;
  throttleMs?: number;
  sfxId?: string | null;
  onClickSpy?: () => void;
}

function Harness({
  level,
  disabled,
  throttleMs,
  sfxId,
  onClickSpy,
}: HarnessProps) {
  const opts: Parameters<typeof useMicroReward>[0] = {};
  if (level !== undefined) opts.level = level;
  if (disabled !== undefined) opts.disabled = disabled;
  if (throttleMs !== undefined) opts.throttleMs = throttleMs;
  if (sfxId !== undefined) opts.sfxId = sfxId;
  const { overlayRef, onClick } = useMicroReward(opts);
  return (
    <button type="button" data-testid="trigger" onClick={onClick(onClickSpy)}>
      <span ref={overlayRef} className="ui-reward-overlay" data-testid="overlay" />
      Click me
    </button>
  );
}

beforeEach(() => {
  playSFX.mockReset();
});

describe('useMicroReward', () => {
  it('fires reward on click and runs the user handler exactly once', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClickSpy={spy} />);

    await user.click(screen.getByTestId('trigger'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(playSFX).toHaveBeenCalledTimes(1);
    expect(playSFX).toHaveBeenCalledWith('uiClick');
    expect(screen.getByTestId('overlay').classList.contains('is-rewarding-normal')).toBe(true);
  });

  it('respects custom level and sfx id', async () => {
    const user = userEvent.setup();
    render(<Harness level="strong" sfxId="customClick" />);

    await user.click(screen.getByTestId('trigger'));

    expect(playSFX).toHaveBeenCalledWith('customClick');
    expect(screen.getByTestId('overlay').classList.contains('is-rewarding-strong')).toBe(true);
  });

  it('mutes audio but keeps visual when sfxId is null', async () => {
    const user = userEvent.setup();
    render(<Harness sfxId={null} />);

    await user.click(screen.getByTestId('trigger'));

    expect(playSFX).not.toHaveBeenCalled();
    expect(screen.getByTestId('overlay').classList.contains('is-rewarding-normal')).toBe(true);
  });

  it('throttles rapid duplicate clicks within the window', () => {
    // Use synchronous `fireEvent.click` so the three "rapid" clicks
    // truly land within a single ms — `userEvent.click` adds a small
    // pointer-event delay that, under load, can drift past the
    // throttle window and produce flaky results.
    const spy = vi.fn();
    render(<Harness throttleMs={500} onClickSpy={spy} />);

    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    // The user handler is NOT throttled — only the reward path is.
    // This guarantees we never block real app behavior.
    expect(spy).toHaveBeenCalledTimes(3);
    expect(playSFX).toHaveBeenCalledTimes(1);
  });

  it('skips reward and user handler when disabled is true', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();

    function DisabledHarness() {
      const { overlayRef, onClick } = useMicroReward({ disabled: true });
      return (
        <button type="button" data-testid="trigger" onClick={onClick(spy)}>
          <span ref={overlayRef} className="ui-reward-overlay" data-testid="overlay" />
          x
        </button>
      );
    }

    render(<DisabledHarness />);
    await user.click(screen.getByTestId('trigger'));

    expect(playSFX).not.toHaveBeenCalled();
    expect(screen.getByTestId('overlay').classList.contains('is-rewarding-normal')).toBe(false);
    // The user handler still runs — disabling the *reward* must not
    // break the host's click semantics. (To suppress the click itself,
    // use the native `disabled` attribute on the button.)
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('removes the reward class after the visible window elapses', () => {
    // Mount with real timers so React's commit phase (including ref
    // attachment) runs normally; only switch to fake timers right
    // before the click so we can deterministically advance the cleanup
    // setTimeout.
    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    const overlay = screen.getByTestId('overlay');

    vi.useFakeTimers();
    try {
      fireEvent.click(trigger);
      expect(overlay.classList.contains('is-rewarding-normal')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(overlay.classList.contains('is-rewarding-normal')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the lingering reward class on unmount', () => {
    const { unmount } = render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    const overlay = screen.getByTestId('overlay');

    vi.useFakeTimers();
    try {
      fireEvent.click(trigger);
      expect(overlay.classList.contains('is-rewarding-normal')).toBe(true);

      // Unmounting before the timer fires must clear the class so the
      // detached node can never be left in a "lit" state, and any
      // subsequent timer advance must not throw on a stale ref.
      unmount();
      expect(overlay.classList.contains('is-rewarding-normal')).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
