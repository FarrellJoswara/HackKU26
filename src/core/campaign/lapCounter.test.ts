import { describe, expect, it } from 'vitest';
import { advanceHops, NUM_SQUARES } from './lapCounter';

describe('advanceHops', () => {
  it('does not flip lap on the very first step at hop 0', () => {
    const r = advanceHops(0, 1);
    expect(r.totalHops).toBe(1);
    expect(r.laps).toBe(0);
    expect(r.lapCompletedThisStep).toBe(false);
  });

  it('flips lap exactly once at hop NUM_SQUARES', () => {
    const r = advanceHops(NUM_SQUARES - 1, 1);
    expect(r.totalHops).toBe(NUM_SQUARES);
    expect(r.laps).toBe(1);
    expect(r.lapCompletedThisStep).toBe(true);
  });

  it('does not double-fire on the next step after a lap', () => {
    const r = advanceHops(NUM_SQUARES, 1);
    expect(r.lapCompletedThisStep).toBe(false);
    expect(r.laps).toBe(1);
  });

  it('handles a 2-lap multi-hop step (e.g. roll skips past wrap)', () => {
    const r = advanceHops(NUM_SQUARES - 2, NUM_SQUARES + 3);
    expect(r.totalHops).toBe(2 * NUM_SQUARES + 1);
    expect(r.laps).toBe(2);
    expect(r.lapCompletedThisStep).toBe(true);
  });

  it('treats negative or NaN inputs as 0', () => {
    expect(advanceHops(NaN, NaN).totalHops).toBe(0);
    expect(advanceHops(-5, -2).totalHops).toBe(0);
    expect(advanceHops(0, -1).lapCompletedThisStep).toBe(false);
  });

  it('runs cleanly through 24 hops with one fire per lap', () => {
    let total = 0;
    let fires = 0;
    for (let i = 0; i < 24; i += 1) {
      const r = advanceHops(total, 1);
      total = r.totalHops;
      if (r.lapCompletedThisStep) fires += 1;
    }
    expect(fires).toBe(2);
  });
});
