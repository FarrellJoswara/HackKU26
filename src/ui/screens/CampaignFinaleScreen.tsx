import { PartyPopper, Home } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { TitleHubDecor } from '../components/TitleHubDecor';
import './titleHub.css';
import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  emptyAllocations,
  readAllocations,
  readNumber,
} from '@/core/budgetTypes';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const ROW_LABELS: Record<string, string> = {
  rent: 'Rent',
  food: 'Food',
  highInterestDebt: 'High-interest debt',
  emergencyFund: 'Emergency fund',
  investments: 'Investments',
};

export default function CampaignFinaleScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);
  const debt = readNumber(
    props.data,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    BOX_DEFAULTS.highInterestDebtBalance,
  );
  const year = readNumber(props.data, CAMPAIGN_KEYS.year, 1);
  const birds = readNumber(props.data, CAMPAIGN_KEYS.investingBirdsYearsPlayed, 0);
  const salary = readNumber(props.data, BOX_PLAYER_DATA_KEYS.annualSalary, 0);
  const allocations = readAllocations(props.data) ?? emptyAllocations();
  const topRows = (['rent', 'food', 'highInterestDebt', 'emergencyFund', 'investments'] as const).map(
    (id) => ({
      id,
      label: ROW_LABELS[id] ?? id,
      amount: allocations[id] ?? 0,
    }),
  );

  return (
    <div className="th-titleHub th-scrollRoute text-[var(--island-color-ink)]">
      <TitleHubDecor />

      <div className="th-content">
        <div className="th-heroCard">
          <div className="island-hudBottle w-full">
            <div className="island-hudInner island-hudInner--titleHero px-6 py-8 text-center sm:px-8">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#5ed6d9]/25 px-4 py-2 text-[#1a4d5c]">
                <PartyPopper className="size-5" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-[0.22em]">Campaign complete</span>
              </div>
              <h1
                className="island-title th-titleGradient mt-4 text-4xl md:text-[2.5rem]"
                style={{ fontFamily: 'var(--island-font-display)' }}
              >
                You paid the tide forward
              </h1>
              <div className="th-titleDivider mx-auto mt-4" role="presentation" />
              <p className="island-statusText th-subtitle mx-auto mt-3 max-w-lg text-[#3d3428]/88">
                High-interest debt is clear, you finished your investing seasons, and the island
                remembers every choice in your box.
              </p>

              <div className="mx-auto mt-8 grid w-full max-w-xl gap-4 text-left">
                <div className="tropic-card p-5">
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a4d5c]/80">
                    Snapshot
                  </h2>
                  <dl className="mt-3 space-y-2 text-sm text-[#2a2418]">
                    <div className="flex justify-between gap-3">
                      <dt>Campaign year</dt>
                      <dd className="font-mono font-semibold text-[#1a4d5c]">{year}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Debt balance</dt>
                      <dd className="font-mono font-semibold text-[#1a4d5c]">{fmt.format(debt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Investing Birds seasons</dt>
                      <dd className="font-mono font-semibold text-[#1a4d5c]">{birds} / 3</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Annual salary (budget)</dt>
                      <dd className="font-mono font-semibold text-[#1a4d5c]">{fmt.format(salary)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="tropic-card p-5">
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a4d5c]/80">
                    Key allocations
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {topRows.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 text-[#2a2418]">
                        <span>{r.label}</span>
                        <span className="font-mono text-[#1a4d5c]">{fmt.format(r.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {lastRun ? (
                  <div className="tropic-card p-5">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a4d5c]/80">
                      Last Debt Runner
                    </h2>
                    <p className="mt-2 text-sm text-[#3d3428]/85">
                      Outcome:{' '}
                      <span className="font-semibold capitalize text-[#1a4d5c]">{lastRun.outcome}</span>
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-10 flex flex-col items-center justify-center gap-3">
                <Button
                  variant="turquoise"
                  leadingIcon={<Home className="size-4" />}
                  onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
                >
                  Back to main menu
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
