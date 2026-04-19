import { AlertTriangle, Play } from 'lucide-react';
import { Button } from '../components/Button';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { CATEGORY_LABELS, parseBudgetProfile, type BudgetCategoryId } from '@/core/finance/budgetTypes';
import { resolveBudgetEffects } from '@/core/finance/budgetEffectResolver';
import { GAME_IDS } from '@/games/registry';

const ORDER: BudgetCategoryId[] = [
  'rent',
  'food',
  'transportation',
  'emergencyFund',
  'medical',
  'debtRepayment',
  'miscFun',
];

export default function BudgetBriefingScreen(_props: UIProps<Record<string, unknown>>) {
  const data = useAppStore((s) => s.playerData);
  const profile = parseBudgetProfile(data['runner.profile']);

  if (!profile) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-900 via-blue-950 to-slate-950 text-white">
        <div className="mx-4 w-full max-w-xl rounded-2xl border border-white/10 bg-black/35 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold">Missing budget profile</h2>
          <p className="mt-2 text-sm text-white/70">
            No backend-style profile is loaded. Go back to menu and start again.
          </p>
          <div className="mt-6">
            <Button
              variant="ghost"
              onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
            >
              Back to menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const session = resolveBudgetEffects(profile);
  const warnings = session.notes.filter((item) => item.rating === 'bad');
  const strengths = session.notes.filter((item) => item.rating === 'good');

  return (
    <div className="absolute inset-0 overflow-auto bg-gradient-to-b from-sky-700 via-cyan-900 to-slate-950 text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Budget Consequence Briefing</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          Profile received from backend. These ratings directly control hazards, stamina, lives, injuries,
          Debt Collector pressure, and burnout during the run.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ORDER.map((id) => (
            <div key={id} className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur">
              <p className="text-sm text-white/65">{CATEGORY_LABELS[id]}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-lg font-semibold uppercase">{profile[id]}</p>
                <span
                  className={
                    profile[id] === 'bad'
                      ? 'rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-200'
                      : profile[id] === 'average'
                        ? 'rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-200'
                        : 'rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200'
                  }
                >
                  {profile[id] === 'bad' ? 'High Risk' : profile[id] === 'average' ? 'Baseline' : 'Strength'}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/75">
                {session.notes.find((entry) => entry.categoryId === id)?.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-semibold text-white/90">Risk warnings</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              {warnings.map((item) => (
                <li key={`${item.categoryId}-${item.text}`} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-rose-200" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-semibold text-white/90">Strengths</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              {strengths.map((item) => (
                <li key={`${item.categoryId}-${item.text}`}>{item.text}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            leadingIcon={<Play className="size-4" />}
            onClick={() =>
              eventBus.emit('navigate:request', { to: 'game', module: GAME_IDS.debtRunner })
            }
          >
            Start Run
          </Button>
          <Button
            variant="ghost"
            onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}

