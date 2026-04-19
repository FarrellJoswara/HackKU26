# Playtest checklist

Per-phase manual checks. Run `npm run typecheck`, `npm test`, then walk
the phase's checklist on a fresh dev session. Tick a box when verified.

## Phase 0 — Test harness

- [x] `npm test` passes 50+ unit/component tests.
- [x] `npm run typecheck` is clean.

## Phase A — Box UX, goals, soft benchmarks

- [x] Open The Box: per-row `InfoMark` opens on click and closes on Escape.
- [x] Confirm is "ready" only when total === salary; click while disabled
      surfaces row-level + footer nudges.
- [x] Goal Rail switches between debt-runway and FI-progress when
      `highInterestDebtBalance` flips.
- [x] Soft benchmarks render under-band warnings; Confirm still allowed
      with `0` allocations across every soft-warning row (zero-based
      satisfied).
- [x] Overlay version: panel scrim does not hide the IslandRun map.

## Phase B — Campaign path is contiguous

- [x] First "New Game" routes through `onboarding` → `newGameDifficulty`
      → `budget` (Box) → Island.
- [x] Subsequent "New Game" skips onboarding once
      `campaign.onboardingComplete` is `true`.
- [x] Difficulty picker seeds `annualSalary` and `highInterestDebtBalance`
      from `DIFFICULTY_INCOME_USD` / `DIFFICULTY_DEBT_USD`.
- [x] Box submit writes `runner.profile`, sets
      `campaign.boxReadyForYear`, and (when on the standalone Box screen)
      navigates to Island Run.
- [x] Persist migration: open with a v1 `localStorage` snapshot — no
      lock-out, `campaign.*` defaults backfilled.
- [x] StrictMode dev: `box:budget:submit` emits **once** per Confirm.

## Phase C — Map and runners see real data

- [x] Funding ratios bridge: edit Box → enter Island → land on a tile;
      copy reflects the new ratios (re-read, no stale closure).
- [x] DebtRunner reads derived `runner.profile` (no TitleHub mock on the
      campaign path).
- [x] InvestingBirds seed builder maps Box rows correctly; CDs lane
      flag drops `cds` shares without merging into bonds.

## Phase D — Year end + tutorials

- [x] Roll until cumulative hops cross `NUM_SQUARES`. `island:yearComplete`
      fires **exactly once**; routes to DebtRunner or Investing Birds based
      on `highInterestDebtBalance`.
- [x] First time DebtRunner is routed, `DebtRunnerTutorialScreen` shows.
      Second time it is bypassed (briefing only).
- [x] Re-entrant year-complete emits in the same tick are ignored
      (in-flight latch).
