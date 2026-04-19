/**
 * Integration coverage for the `RewardButton` raw-button wrapper.
 *
 * These tests guarantee that:
 *   1. user `onClick` callbacks still run exactly once,
 *   2. keyboard activation (Enter / Space) does NOT double-fire the
 *      reward (a real risk if anyone adds an `onKeyDown` shortcut),
 *   3. opt-out (`microReward={false}`) behaves like a vanilla button.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const playSFX = vi.fn();
vi.mock('@/audio/AudioManager', () => ({
  audio: { playSFX: (id: string) => playSFX(id) },
}));

import { RewardButton } from './RewardButton';

beforeEach(() => playSFX.mockReset());

describe('<RewardButton />', () => {
  it('invokes the user handler exactly once on click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<RewardButton onClick={onClick}>Press</RewardButton>);

    await user.click(screen.getByRole('button', { name: 'Press' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(playSFX).toHaveBeenCalledTimes(1);
  });

  it('does not double-fire the reward on keyboard activation', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<RewardButton onClick={onClick}>Press</RewardButton>);

    const button = screen.getByRole('button', { name: 'Press' });
    button.focus();
    await user.keyboard('{Enter}');

    // Native button dispatches one synthetic click for Enter.
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(playSFX).toHaveBeenCalledTimes(1);
  });

  it('skips reward visuals + sfx when microReward={false}', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardButton onClick={onClick} microReward={false}>
        Quiet
      </RewardButton>,
    );

    const button = screen.getByRole('button', { name: 'Quiet' });
    expect(button.className).not.toContain('ui-reward-host');
    expect(button.querySelector('.ui-reward-overlay')).toBeNull();

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(playSFX).not.toHaveBeenCalled();
  });

  it('respects native disabled (no click, no reward)', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardButton onClick={onClick} disabled>
        Off
      </RewardButton>,
    );

    await user.click(screen.getByRole('button', { name: 'Off' }));

    expect(onClick).not.toHaveBeenCalled();
    expect(playSFX).not.toHaveBeenCalled();
  });

  it('forwards refs so consumers can manage focus', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <RewardButton ref={ref} onClick={() => {}}>
        Focusable
      </RewardButton>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
