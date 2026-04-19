import { Vector2 } from 'three';
import { useMemo } from 'react';
import { eventBus } from '@/core/events';
import { categoryAccent, GAME_CONFIG } from './config';
import { useFrustum } from './frustumContext';
import { worldToScreen } from './projection';
import { InvestingBirdsOverlay } from './ui';
import type { Dispatch } from 'react';
import type { Allocation, InvestingBirdsAction, RunState, Settings } from './types';

interface OverlayProps {
  state: RunState;
  hasLaunchedOnce: boolean;
  dispatch: Dispatch<InvestingBirdsAction>;
}

/**
 * Plain-DOM overlay layer. Lives as a sibling of `<Canvas>` inside the
 * ib2-root container, so it's never reconciled by R3F's renderer.
 */
export function Overlay(props: OverlayProps) {
  const { state, hasLaunchedOnce, dispatch } = props;
  const { frustum, viewport } = useFrustum();

  const projectWorld = useMemo(
    () => (wx: number, wy: number) => {
      const p = worldToScreen(wx, wy, frustum, viewport);
      return { leftPx: p.x, topPx: p.y };
    },
    [frustum, viewport],
  );

  const currentLevel =
    state.state === 'PLAYING' || state.state === 'ROUND_END'
      ? state.levels[state.currentLevelIndex] ?? null
      : null;
  const nextLevel = state.levels[state.currentLevelIndex + 1] ?? null;
  const accent = currentLevel ? categoryAccent(currentLevel.type) : '#ffffff';

  // Tower multiplier label — projected from world coords.
  const standing = state.blocks.filter(
    (b) =>
      !b.knockedOff &&
      !b.toppled &&
      !b.shattered &&
      !isSettledGroundDebris(b) &&
      b.position.y > 0.15,
  );
  let towerLabelScreen: { leftPx: number; topPx: number } | null = null;
  if (standing.length > 0) {
    let sumX = 0;
    let maxTop = -Infinity;
    for (const b of standing) {
      sumX += b.position.x;
      const t = b.position.y + b.height / 2;
      if (t > maxTop) maxTop = t;
    }
    const avgX = sumX / standing.length;
    towerLabelScreen = projectWorld(avgX, maxTop + 1.0);
  }

  const pullRatio =
    state.state === 'PLAYING' && state.dragStart && state.dragEnd
      ? Math.min(
          1,
          new Vector2(
            state.dragEnd.x - state.dragStart.x,
            state.dragEnd.y - state.dragStart.y,
          ).length() / GAME_CONFIG.maxDrag,
        )
      : 0;

  const showAimHint =
    state.state === 'PLAYING' && !hasLaunchedOnce && state.elapsedSec < 6;

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: 'none', zIndex: 10 }}
    >
      {/* Tower multiplier label — projected via world-to-screen */}
      {currentLevel && towerLabelScreen ? (
        <div
          className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1"
          style={{ left: towerLabelScreen.leftPx, top: towerLabelScreen.topPx }}
        >
          <div
            className="rounded-full px-3 py-1 text-sm font-bold tabular-nums text-white shadow-lg"
            style={{ background: accent }}
          >
            {currentLevel.multiplier.toFixed(2)}x
          </div>
          <div className="rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium tracking-wide text-white backdrop-blur-sm">
            {currentLevel.label}
          </div>
        </div>
      ) : null}

      <InvestingBirdsOverlay
        state={state.state}
        allocation={state.allocation}
        levels={state.levels}
        currentLevelIndex={state.currentLevelIndex}
        currentLevel={currentLevel}
        nextLevel={nextLevel}
        birdsRemaining={state.birdsRemaining}
        birdsForRound={state.birdsForRound}
        score={state.score}
        scoreByType={state.scoreByType}
        outcome={state.outcome}
        roundOutcome={state.roundOutcome}
        elapsedSec={state.elapsedSec}
        scoreFloaters={state.scoreFloaters}
        damageFloaters={state.damageFloaters}
        dustPuffs={state.dustPuffs}
        lastHeavyHitAtSec={state.lastHeavyHitAtSec}
        combo={state.combo}
        lastComboAtSec={state.lastComboAtSec}
        paused={state.paused}
        settingsOpen={state.settingsOpen}
        settings={state.settings}
        initialPortfolioTotal={state.initialPortfolioTotal}
        investmentValueByType={state.investmentValueByType}
        lastRoundAppliedReturnPct={state.lastRoundAppliedReturnPct}
        roundStartBlockCount={state.roundStartBlockCount}
        simScoredBlockCount={state.simScoredBlockCount}
        roundStartTotalMaxHealth={state.roundStartTotalMaxHealth}
        blocks={state.blocks}
        pullRatio={pullRatio}
        showAimHint={showAimHint}
        onAllocationChange={(payload: Allocation) =>
          dispatch({ type: 'SET_ALLOCATION', payload })
        }
        onStart={() => dispatch({ type: 'START_GAME' })}
        onReturnMenu={() =>
          eventBus.emit('navigate:request', { to: 'menu', module: null })
        }
        onTogglePause={() =>
          dispatch({ type: 'SET_PAUSED', payload: !state.paused })
        }
        onOpenSettings={(open: boolean) =>
          dispatch({ type: 'OPEN_SETTINGS', payload: open })
        }
        onUpdateSettings={(patch: Partial<Settings>) =>
          dispatch({ type: 'UPDATE_SETTINGS', payload: patch })
        }
        projectWorld={projectWorld}
      />
    </div>
  );
}

function normalizeAngle(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function isSettledGroundDebris(b: RunState['blocks'][number]): boolean {
  const bottom = b.position.y - b.height / 2;
  const grounded = bottom <= 0.08;
  const settled = b.velocity.lengthSq() < 0.08 && !b.falling;
  const visiblyFallen =
    Math.abs(normalizeAngle(b.rotation)) > 0.45 ||
    b.initialY - b.position.y > b.height * 0.28;
  return grounded && settled && visiblyFallen;
}
