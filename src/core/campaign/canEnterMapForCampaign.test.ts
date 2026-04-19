import { describe, expect, it } from 'vitest';
import { canEnterMapForCampaign } from './canEnterMapForCampaign';
import { CAMPAIGN_KEYS } from './campaignKeys';
import { BOX_PLAYER_DATA_KEYS } from '@/core/budgetTypes';

describe('canEnterMapForCampaign', () => {
  it('always allows entry in DEV regardless of state', () => {
    const r = canEnterMapForCampaign({}, { isDev: true });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('devBuild');
  });

  it('allows entry when explicit bypass flag is set', () => {
    const r = canEnterMapForCampaign(
      { [CAMPAIGN_KEYS.bypassBoxGate]: true },
      { isDev: false },
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('bypassFlag');
  });

  it('blocks entry when no boxReadyForYear is set in production', () => {
    const r = canEnterMapForCampaign({}, { isDev: false });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('needsBudget');
  });

  it('allows entry when boxReadyForYear matches currentYear', () => {
    const r = canEnterMapForCampaign(
      {
        [CAMPAIGN_KEYS.boxReadyForYear]: 2,
        [BOX_PLAYER_DATA_KEYS.currentYear]: 2,
      },
      { isDev: false },
    );
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('budgetFresh');
  });

  it('blocks entry when boxReadyForYear is stale (lags currentYear)', () => {
    const r = canEnterMapForCampaign(
      {
        [CAMPAIGN_KEYS.boxReadyForYear]: 2,
        [BOX_PLAYER_DATA_KEYS.currentYear]: 3,
      },
      { isDev: false },
    );
    expect(r.allowed).toBe(false);
  });
});
