import { describe, expect, it } from 'vitest';
import { buildBirdsSeed } from './seedFromBox';

describe('buildBirdsSeed', () => {
  it('returns hasInvestments=false on empty allocations', () => {
    const seed = buildBirdsSeed({ allocations: {}, hasCdsLane: true });
    expect(seed.hasInvestments).toBe(false);
    expect(seed.shares.etfs).toBe(0);
  });

  it('normalizes a four-way split to sum exactly 1', () => {
    const seed = buildBirdsSeed({
      allocations: {
        indexFunds: 1000,
        individualStocks: 1000,
        bonds: 1000,
        crypto: 1000,
      },
      hasCdsLane: true,
    });
    const sum = seed.shares.etfs + seed.shares.stocks + seed.shares.bonds + seed.shares.crypto + seed.shares.cds;
    expect(sum).toBeCloseTo(1, 12);
    expect(seed.shares.etfs).toBeCloseTo(0.25, 6);
    expect(seed.shares.cds).toBe(0);
  });

  it('keeps the CDs share when the Birds CDs lane exists', () => {
    const seed = buildBirdsSeed({
      allocations: { indexFunds: 100, cds: 100 },
      hasCdsLane: true,
    });
    expect(seed.shares.cds).toBeCloseTo(0.5, 6);
    expect(seed.shares.etfs).toBeCloseTo(0.5, 6);
  });

  it('drops the CDs share (does not silently merge into bonds) when lane missing', () => {
    const seed = buildBirdsSeed({
      allocations: { indexFunds: 100, bonds: 100, cds: 100 },
      hasCdsLane: false,
    });
    expect(seed.shares.cds).toBe(0);
    expect(seed.shares.bonds).toBeCloseTo(0.5, 6);
    expect(seed.shares.etfs).toBeCloseTo(0.5, 6);
  });

  it('ignores negative / NaN allocations', () => {
    const seed = buildBirdsSeed({
      allocations: { indexFunds: -100, individualStocks: 100, crypto: Number.NaN },
      hasCdsLane: true,
    });
    expect(seed.shares.stocks).toBeCloseTo(1, 6);
    expect(seed.hasInvestments).toBe(true);
  });
});
