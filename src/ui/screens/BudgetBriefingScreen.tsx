import { AlertTriangle, CheckCircle2, Play, Sparkles } from 'lucide-react';
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

// Notes from the resolver currently look like:
//   "Rent / Housing: Rent was AVERAGE: route difficulty stays near baseline."
// The category label and rating are both already shown on the card / chip,
// so we strip those two redundant prefixes and just render the consequence.
function stripNotePrefix(text: string): string {
  // Strip the prepended "<Category Label>: "
  const firstColon = text.indexOf(': ');
  let body = firstColon >= 0 ? text.slice(firstColon + 2) : text;
  // Strip the inline "<Category> was <RATING>: "
  body = body.replace(/^[^:]+\swas\s[A-Z]+:\s*/, '');
  return body.charAt(0).toUpperCase() + body.slice(1);
}

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
    <div className="absolute inset-0 overflow-auto bg-gradient-to-b from-[#0d2438] via-[#103a4f] to-[#1c1431] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 pb-32">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/85">
          Year-end · Debt Runner briefing
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          Your budget just turned into a route.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
          Each category below sets one knob on the run — hazards, stamina, lives, healing,
          Debt Collector pressure, and morale. Keep an eye on anything flagged as high risk.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ORDER.map((id) => {
            const rating = profile[id];
            const note = session.notes.find((entry) => entry.categoryId === id);
            const consequence = note ? stripNotePrefix(note.text) : null;
            const chipLabel =
              rating === 'bad' ? 'High risk' : rating === 'average' ? 'Baseline' : 'Strength';
            const chipClass =
              rating === 'bad'
                ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-300/30'
                : rating === 'average'
                  ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-300/30'
                  : 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-300/30';
            return (
              <div
                key={id}
                className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white/90">{CATEGORY_LABELS[id]}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${chipClass}`}>
                    {chipLabel}
                  </span>
                </div>
                {consequence ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/80">{consequence}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-rose-300/15 bg-rose-950/30 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-100">
              <AlertTriangle className="size-4 text-rose-200" aria-hidden /> Risk warnings
            </p>
            {warnings.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-emerald-200/90">
                <CheckCircle2 className="size-4" aria-hidden />
                No red flags this run — nice work.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                {warnings.map((item) => (
                  <li key={`${item.categoryId}-${item.text}`} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-200" aria-hidden />
                    <span>
                      <span className="font-semibold">{CATEGORY_LABELS[item.categoryId]}</span>
                      {' — '}
                      {stripNotePrefix(item.text)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-emerald-300/15 bg-emerald-950/25 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <Sparkles className="size-4 text-emerald-200" aria-hidden /> Strengths
            </p>
            {strengths.length === 0 ? (
              <p className="mt-3 text-sm text-white/70">
                No strengths flagged yet — fund a category fully next year for a kinder run.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-white/85">
                {strengths.map((item) => (
                  <li key={`${item.categoryId}-${item.text}`} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-200" aria-hidden />
                    <span>
                      <span className="font-semibold">{CATEGORY_LABELS[item.categoryId]}</span>
                      {' — '}
                      {stripNotePrefix(item.text)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            leadingIcon={<Play className="size-4" />}
            onClick={() =>
              eventBus.emit('navigate:request', { to: 'game', module: GAME_IDS.debtRunner })
            }
          >
            Start the run
          </Button>
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

