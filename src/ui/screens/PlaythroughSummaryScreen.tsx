/**
 * Playthrough summary — shown once the Mountain Success cinematic finishes.
 *
 * This is the end-of-campaign recap. It currently renders **placeholder
 * data** so the layout can land before the real run-tracking hooks ship;
 * swap the `FAKE_SUMMARY` constants for live `playerData` reads when the
 * Year Controller starts persisting per-year stats.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Coins,
  ExternalLink,
  Home,
  Loader2,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { eventBus } from '@/core/events';
import {
  postSummaryToSolana,
  type PostSummaryResult,
} from '@/core/solana/postSummary';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import './titleHub.css';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface Highlight {
  id: string;
  label: string;
  value: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: 'turquoise' | 'coral' | 'sand' | 'gold';
}

interface MilestoneRow {
  year: number;
  title: string;
  detail: string;
}

const FAKE_SUMMARY = {
  yearsPlayed: 9,
  startingDebt: 38_500,
  startingSalary: 52_000,
  finalSalary: 88_400,
  finalNetWorth: 312_750,
  winGoal: 250_000,
  totalInvested: 184_200,
  employerMatchEarned: 24_600,
  debtFreeYear: 6,
  freedomYear: 9,
  topChoice: 'Index Funds',
} as const;

const HIGHLIGHTS: ReadonlyArray<Highlight> = [
  {
    id: 'networth',
    label: 'Final net worth',
    value: fmt.format(FAKE_SUMMARY.finalNetWorth),
    hint: `Target was ${fmt.format(FAKE_SUMMARY.winGoal)} — you cleared it.`,
    Icon: Trophy,
    tone: 'gold',
  },
  {
    id: 'debt',
    label: 'Debt-free in',
    value: `Year ${FAKE_SUMMARY.debtFreeYear}`,
    hint: `Cleared ${fmt.format(FAKE_SUMMARY.startingDebt)} of high-interest debt.`,
    Icon: Coins,
    tone: 'coral',
  },
  {
    id: 'invested',
    label: 'Total invested',
    value: fmt.format(FAKE_SUMMARY.totalInvested),
    hint: `Plus ${fmt.format(FAKE_SUMMARY.employerMatchEarned)} in employer match.`,
    Icon: TrendingUp,
    tone: 'turquoise',
  },
  {
    id: 'salary',
    label: 'Salary growth',
    value: `${fmt.format(FAKE_SUMMARY.startingSalary)} → ${fmt.format(FAKE_SUMMARY.finalSalary)}`,
    hint: 'Eight raises and a side hustle later.',
    Icon: PiggyBank,
    tone: 'sand',
  },
];

const MILESTONES: ReadonlyArray<MilestoneRow> = [
  {
    year: 1,
    title: 'Started the climb',
    detail: 'Built first emergency fund and tackled the high-interest cards.',
  },
  {
    year: 3,
    title: 'Cracked the side hustle',
    detail: 'Funded $4,200 of investments while still paying down debt.',
  },
  {
    year: 6,
    title: 'Officially debt-free',
    detail: 'Last credit-card payment cleared — investments unlocked.',
  },
  {
    year: 8,
    title: 'Crossed $200k invested',
    detail: 'Index funds and employer match did the heavy lifting.',
  },
  {
    year: 9,
    title: 'Reached financial freedom',
    detail: 'Net worth passed the win goal. Mountain summit unlocked.',
  },
];

const toneClass: Record<Highlight['tone'], string> = {
  turquoise: 'bg-[#5ed6d9]/25 text-[#1a4d5c]',
  coral: 'bg-[#ff8b6b]/25 text-[#b94530]',
  sand: 'bg-[#fbe6be]/80 text-[#8b6914]',
  gold: 'bg-[#ffd58a]/40 text-[#a8854a]',
};

type SolanaPostStatus =
  | { phase: 'idle' }
  | { phase: 'posting' }
  | { phase: 'success'; result: PostSummaryResult }
  | { phase: 'error'; message: string };

/**
 * Compact serializable snapshot of the run we put on chain. Kept
 * intentionally small so the whole payload fits inside the 566-byte
 * SPL Memo limit.
 */
function buildOnChainSummary() {
  return {
    app: 'IslandRun',
    v: 1,
    ts: new Date().toISOString(),
    years: FAKE_SUMMARY.yearsPlayed,
    netWorth: FAKE_SUMMARY.finalNetWorth,
    winGoal: FAKE_SUMMARY.winGoal,
    startingDebt: FAKE_SUMMARY.startingDebt,
    salary: {
      start: FAKE_SUMMARY.startingSalary,
      end: FAKE_SUMMARY.finalSalary,
    },
    invested: FAKE_SUMMARY.totalInvested,
    employerMatch: FAKE_SUMMARY.employerMatchEarned,
    debtFreeYear: FAKE_SUMMARY.debtFreeYear,
    freedomYear: FAKE_SUMMARY.freedomYear,
    topChoice: FAKE_SUMMARY.topChoice,
  };
}

function shortSig(sig: string): string {
  if (sig.length <= 16) return sig;
  return `${sig.slice(0, 8)}…${sig.slice(-8)}`;
}

export default function PlaythroughSummaryScreen(_props: UIProps<unknown>) {
  const [solanaStatus, setSolanaStatus] = useState<SolanaPostStatus>({
    phase: 'idle',
  });
  // Guard against React StrictMode's double-invoke in dev — without
  // this we'd burn two airdrops + two memo txs every time the screen
  // mounts.
  const postedRef = useRef(false);

  useEffect(() => {
    if (postedRef.current) return;
    postedRef.current = true;
    let cancelled = false;
    setSolanaStatus({ phase: 'posting' });
    postSummaryToSolana(buildOnChainSummary())
      .then((result) => {
        if (cancelled) return;
        setSolanaStatus({ phase: 'success', result });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Unknown error posting to Solana.';
        setSolanaStatus({ phase: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRetryPost = () => {
    setSolanaStatus({ phase: 'posting' });
    postSummaryToSolana(buildOnChainSummary())
      .then((result) => setSolanaStatus({ phase: 'success', result }))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Unknown error posting to Solana.';
        setSolanaStatus({ phase: 'error', message });
      });
  };

  // Background is the rotating Mountain Success scene mounted by
  // `App.tsx` (lives in `src/games/`, so the UI layer doesn't have
  // to import it directly per AGENTS.md §1.1). We only need to
  // override the title-hub gradient bg so the 3D scene shows
  // through, and add a soft top-to-bottom scrim for legibility.
  return (
    <div
      className="th-titleHub th-scrollRoute text-[var(--island-color-ink)]"
      style={{ background: 'transparent' }}
    >
      {/* Fixed (not absolute) so the scrim stays glued to the
          viewport while the recap content scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(12,32,52,0.22) 0%, rgba(12,32,52,0) 28%, rgba(12,32,52,0) 62%, rgba(12,32,52,0.45) 100%)',
        }}
      />

      <div className="th-content">
        <div className="th-heroCard w-full max-w-3xl">
          <div className="island-hudBottle w-full">
            <div className="island-hudInner island-hudInner--titleHero px-6 py-8 sm:px-10">
              <div className="text-center">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#5ed6d9]/25 px-4 py-2 text-[#1a4d5c]">
                  <Sparkles className="size-5" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-[0.22em]">
                    Playthrough complete
                  </span>
                </div>
                <h1
                  className="island-title th-titleGradient mt-4 text-4xl md:text-[2.5rem]"
                  style={{ fontFamily: 'var(--island-font-display)' }}
                >
                  {FAKE_SUMMARY.yearsPlayed} years to open sky.
                </h1>
                <div className="th-titleDivider mx-auto mt-4" role="presentation" />
                <p className="island-statusText th-subtitle mx-auto mt-3 max-w-lg text-[#3d3428]/88">
                  Here&apos;s how your run shook out — every dollar, every
                  budget call, and the choices that got you to the summit.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {HIGHLIGHTS.map(({ id, label, value, hint, Icon, tone }) => (
                  <div
                    key={id}
                    className="tropic-card flex items-start gap-3 p-4 text-left"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}
                      aria-hidden
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a4d5c]/70">
                        {label}
                      </p>
                      <p className="mt-0.5 font-mono text-base font-semibold text-[#1a4d5c]">
                        {value}
                      </p>
                      <p className="mt-1 text-xs text-[#3d3428]/80">{hint}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="tropic-card mt-6 p-5 text-left">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-[#1a4d5c]" aria-hidden />
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a4d5c]/80">
                    Milestones along the way
                  </h2>
                </div>
                <ol className="mt-4 space-y-3">
                  {MILESTONES.map((m) => (
                    <li
                      key={m.year}
                      className="flex items-start gap-3 rounded-2xl border border-[#fbe6be] bg-[#fff7e8]/85 p-3"
                    >
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a4d5c]/10 text-xs font-bold text-[#1a4d5c]">
                        Y{m.year}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1a4d5c]">
                          {m.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[#3d3428]/80">
                          {m.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-[#3d3428]/70">
                  Favorite allocation across the run:{' '}
                  <span className="font-semibold text-[#1a4d5c]">
                    {FAKE_SUMMARY.topChoice}
                  </span>
                </p>
              </div>

              <SolanaReceipt status={solanaStatus} onRetry={handleRetryPost} />

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  variant="turquoise"
                  leadingIcon={<Home className="size-4" />}
                  onClick={() =>
                    eventBus.emit('navigate:request', {
                      to: 'menu',
                      module: null,
                    })
                  }
                >
                  Back to main menu
                </Button>
                <Button
                  variant="coral"
                  leadingIcon={<ArrowRight className="size-4" />}
                  onClick={() =>
                    eventBus.emit('navigate:request', {
                      to: 'newGameDifficulty',
                      module: null,
                    })
                  }
                >
                  Start a new run
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SolanaReceipt({
  status,
  onRetry,
}: {
  status: SolanaPostStatus;
  onRetry: () => void;
}) {
  return (
    <div className="tropic-card mt-6 p-4 text-left">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[#1a4d5c]" aria-hidden />
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a4d5c]/80">
          On-chain receipt
        </h2>
      </div>

      {status.phase === 'idle' || status.phase === 'posting' ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-[#3d3428]/85">
          <Loader2 className="size-4 animate-spin text-[#1a4d5c]" aria-hidden />
          <span>Posting your run summary to the Solana test network…</span>
        </div>
      ) : null}

      {status.phase === 'success' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-[#3d3428]/85">
            Your run summary is recorded on-chain via the SPL Memo program (
            <span className="font-semibold capitalize text-[#1a4d5c]">
              {status.result.cluster}
            </span>
            , {status.result.memoBytes} bytes).
          </p>
          <a
            href={status.result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1a4d5c] px-3 py-2 font-mono text-xs font-semibold text-white transition hover:bg-[#15414f] focus:outline-none focus:ring-2 focus:ring-[#5ed6d9]"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span>View transaction {shortSig(status.result.signature)}</span>
          </a>
        </div>
      ) : null}

      {status.phase === 'error' ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-[#b94530]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Couldn&apos;t post to Solana ({status.message}).</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1a4d5c]/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#1a4d5c] transition hover:bg-white"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
