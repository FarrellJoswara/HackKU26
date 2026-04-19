import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, PerspectiveCamera } from 'three';
import { Color, MathUtils, Vector3 } from 'three';
import { audio } from '@/audio/AudioManager';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { GameProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';
import { parseBudgetProfile } from '@/core/finance/budgetTypes';
import { resolveBudgetEffects } from '@/core/finance/budgetEffectResolver';
import type { RunnerFinishedPayload } from '@/core/runner/runnerTypes';
import type { RunnerHudState } from '@/core/runner/hudTypes';
import { generateTrackTiles, validateTrackTurnClearance } from './pathGenerator';
import type { TrackTile } from './types';
import BeachCharacter from './scene/BeachCharacter';
import BeachObstacle from './scene/BeachObstacle';
import DebtCollector from './scene/DebtCollector';
import DebtCollectorPaperTrail from './scene/DebtCollectorPaperTrail';
import BeachDecor from './scene/BeachDecor';
import BeachSand from './scene/BeachSand';
import Ocean from './scene/Ocean';
import OceanInlets from './scene/OceanInlets';
import ParadiseSkydomeMesh from './scene/ParadiseSkydomeMesh';
import SandPuff from './scene/SandPuff';
import ShorelineDecor from './scene/ShorelineDecor';

const UP = new Vector3(0, 1, 0);
const TILE_SIZE = 8;
const TURN_INPUT_BUFFER_SECONDS = 0.5;
const BASE_SPEED = 10;
/** Lateral offset for lane -1 / 0 / +1; must match obstacle mesh `obs.lane * LANE_SPACING`. */
const LANE_SPACING = 2.2;
/**
 * Lane-shift smoothing — bigger = snappier, smaller = floatier. We separate
 * lateral easing from the forward-motion lerp so the player no longer
 * "teleports" between lanes; movement reads as a satisfying glide.
 */
const LANE_SMOOTH_SPEED = 9;
/** Maximum character bank (radians) when shifting lanes. Visual-only. */
const LANE_TILT_MAX = 0.35;
/** Camera follow smoothing — position is slow (cinematic), look is fast (responsive). */
const CAM_POS_SMOOTH = 3.2;
const CAM_LOOK_SMOOTH = 9;
/**
 * Smoothing rate for the forward basis vector. Without this, crossing a turn
 * tile rotates `forward` ~90deg in one frame and the camera + lane basis
 * snap. This rate is fast enough to stay responsive but slow enough to mask
 * the discrete tile boundary.
 */
const FORWARD_SMOOTH_SPEED = 8;
/** Tilt smoothing — controls how quickly the character settles back to upright. */
const TILT_SMOOTH_SPEED = 12;
/** Camera follow offsets — Y is height, Z is distance behind player. */
const CAMERA_HEIGHT = 4.4;
const CAMERA_DISTANCE = 9.5;
/** Vertical offset from `pos.y = 0` ground baseline up to the BeachCharacter inner pivot. */
const GROUND_Y = 0;
const JUMP_Y = 0.6;

/**
 * Frame-rate independent exponential damping factor.
 * Equivalent to `1 - Math.exp(-speed * dt)` — gives identical visual smoothing
 * regardless of FPS, unlike `Math.min(1, dt * speed)` which gets whippy at low FPS.
 */
function damp(speed: number, dt: number): number {
  return 1 - Math.exp(-speed * dt);
}

// Module-level scratch vectors. Reused every frame to avoid GC pressure /
// micro-stutters from `new Vector3(...)` allocations inside useFrame.
const _forward = new Vector3();
const _smoothForwardTarget = new Vector3();
const _lateral = new Vector3();
const _pos = new Vector3();
const _lookAhead = new Vector3();
const _cameraTarget = new Vector3();
const _desiredLook = new Vector3();
const _collectorTarget = new Vector3();
const _playerWorldPos = new Vector3();
const _collectorWobble = new Vector3();
const _cornerIn = new Vector3();
const _cornerOut = new Vector3();
const _cornerBis = new Vector3();

/** Plank segment length past chord — larger at turns to close outer-corner gaps. */
const PLANK_OVERLAP_STRAIGHT = 0.42;
const PLANK_OVERLAP_TURN = 1.12;
/** Debt Collector mesh only during intro and when chase is critical. */
// "Only at the very beginning" — small window after the run starts. After that,
// the collector is hidden until the player is decisively about to die.
const INTRO_COLLECTOR_VISIBLE_SEC = 3.2;
// Hysteresis: show the collector only when conditions are clearly critical,
// hide it once the player has recovered comfortably. Prevents the chase
// silhouette from flickering on/off around the threshold while a player
// hovers on the edge of "dangerous".
const NEAR_DEATH_CHASE_GAP_SHOW = 4.0; // gap (m) below which we reveal
const NEAR_DEATH_CHASE_GAP_HIDE = 6.5; // gap (m) above which we hide again
const NEAR_DEATH_PRESSURE_SHOW = 0.9;
const NEAR_DEATH_PRESSURE_HIDE = 0.74;

interface ActiveSandPuff {
  id: number;
  position: [number, number, number];
}

function createEmptyHud(maxLives: number): RunnerHudState {
  return {
    timerSeconds: 30,
    stamina: 100,
    lives: maxLives,
    maxLives,
    morale: 55,
    debtPressure: 0.2,
    chaseDistance: 16,
    monsterStage: 'manageable',
    collectorPressure01: 0.22,
    debuffs: [],
    paused: false,
  };
}

function buildHudForSession(session: ReturnType<typeof resolveBudgetEffects>): RunnerHudState {
  const base = createEmptyHud(session.effects.startingLives);
  base.morale += session.effects.moraleStartBoost;
  return base;
}

/** Cubic ease-out — used for lane motion so it feels natural (not linear). */
function easeOutCubic(t: number) {
  const c = MathUtils.clamp(t, 0, 1);
  return 1 - (1 - c) ** 3;
}

export default function DebtRunnerGame(_props: GameProps) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);
  // CRITICAL: subscribe to the raw profile value via a selector so its
  // reference is stable across unrelated store mutations (the HUD pump
  // re-merges `runner.hud` every 120ms, which would otherwise re-render the
  // component and recompute `profile`/`session`/`initialHud` each tick —
  // resetting `timerSeconds` back to 30 ten times a second and freezing
  // the visible countdown). Memoizing the parse on the raw input keeps
  // `profile` referentially stable for as long as the store value is.
  const profileInput = useAppStore((s) => s.playerData['runner.profile']);
  const profile = useMemo(
    () => parseBudgetProfile(profileInput) ?? MOCK_BUDGET_PROFILE,
    [profileInput],
  );
  const session = useMemo(() => resolveBudgetEffects(profile), [profile]);
  const tiles = useMemo(() => {
    const generated = generateTrackTiles(260, session.effects);
    // Runtime self-check: every game-start asserts the turn-clearance rule
    // holds for the freshly generated track. In dev this surfaces any
    // regression as a console error the moment it happens; in prod it's a
    // cheap O(n) walk that's effectively free at this scale (~260 tiles).
    if (import.meta.env.DEV) {
      const result = validateTrackTurnClearance(generated);
      if (!result.ok) {
        console.error(
          '[DebtRunner] Turn-clearance rule violated by generated track:',
          result.violations,
        );
      }
    }
    return generated;
  }, [session.effects]);

  const initialHud = useMemo(() => buildHudForSession(session), [session]);

  /**
   * `player` is the OUTER yaw group — owns world position + faces along the path
   * via `lookAt`. `playerTilt` is the inner BeachCharacter ref — owns ONLY the
   * banking roll (`rotation.z`). They are intentionally split so `lookAt` and
   * the manual roll write don't fight on the same Object3D's quaternion/Euler
   * (which previously caused per-frame flicker at turn tiles).
   */
  const player = useRef<Group>(null);
  const playerTilt = useRef<Group>(null);
  const collector = useRef<Group>(null);
  const collectorVisualWrap = useRef<Group>(null);
  /**
   * Smoothed forward basis. `forward = next - active` rotates ~90deg in a
   * single frame at turn tiles; using the raw vector for the lateral basis
   * and the camera target snaps the view. We lerp this vector toward the raw
   * forward every frame so the camera + lane basis transition smoothly across
   * tile boundaries. Path math itself still uses raw tile positions.
   */
  const smoothedForwardRef = useRef(new Vector3(0, 0, -1));
  const hudRef = useRef<RunnerHudState>(initialHud);
  const [jumping, setJumping] = useState(false);
  const [hud, setHud] = useState<RunnerHudState>(initialHud);
  const [puffs, setPuffs] = useState<ActiveSandPuff[]>([]);
  const puffIdRef = useRef(0);

  const elapsed = useRef(0);
  const tileIndex = useRef(2);
  const tileProgress = useRef(0);
  const stumbleTimer = useRef(0);
  const injuryTimer = useRef(0);
  const hitLock = useRef(0);
  const hitFlashRef = useRef(0);
  const cameraKickRef = useRef(0);
  /** Prior-frame chase gap — detects sharp closes for camera punch. */
  const prevChaseDistanceRef = useRef(16);
  const lastSfxFootRef = useRef(0);
  const lastSfxRustleRef = useRef(0);
  const lastSfxRingRef = useRef(0);
  // Latched visibility for the chaser, with hysteresis so the mesh doesn't
  // flicker on/off when the gap or pressure hovers near the threshold.
  // Initialized to true because the intro window starts visible.
  const collectorShownRef = useRef(true);
  const pauseRef = useRef(false);
  const finishedRef = useRef(false);
  const pendingTurn = useRef<{ direction: 'left' | 'right'; atSeconds: number } | null>(null);
  const consumedTurnTile = useRef<string | null>(null);
  const wrongTurnPenaltyTileId = useRef<string | null>(null);
  const playerLaneRef = useRef<-1 | 0 | 1>(0);
  /** Smoothed lateral offset (independent from forward path math). */
  const laneOffsetRef = useRef(0);
  const jumpingRef = useRef(false);
  const wasGroundedRef = useRef(true);
  const camLookTarget = useRef(new Vector3(0, 1, 0));
  const [hurtFlash, setHurtFlash] = useState(false);

  useEffect(() => {
    hudRef.current = initialHud;
    setHud(initialHud);
  }, [initialHud]);

  // Publish session info ONCE on mount / whenever the session resolves. The
  // live HUD snapshot is published separately by the fixed-rate interval
  // below — keeping `hud` out of this dep array prevents this effect from
  // re-firing on every HUD tick.
  useEffect(() => {
    mergePlayerData({
      'runner.session': session,
      'runner.hud': initialHud,
    });
  }, [mergePlayerData, session, initialHud]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        pauseRef.current = !pauseRef.current;
        setHud((prev) => {
          const next = { ...prev, paused: pauseRef.current };
          hudRef.current = next;
          return next;
        });
        return;
      }
      if (pauseRef.current) return;

      const goLeft = () => {
        if (!event.repeat) {
          playerLaneRef.current = Math.max(-1, playerLaneRef.current - 1) as -1 | 0 | 1;
        }
        pendingTurn.current = { direction: 'left', atSeconds: elapsed.current };
      };
      const goRight = () => {
        if (!event.repeat) {
          playerLaneRef.current = Math.min(1, playerLaneRef.current + 1) as -1 | 0 | 1;
        }
        pendingTurn.current = { direction: 'right', atSeconds: elapsed.current };
      };

      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        goLeft();
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        goRight();
      } else if (
        event.code === 'Space' ||
        event.code === 'ArrowUp' ||
        event.code === 'KeyW'
      ) {
        // Jump on Space, ArrowUp, or W — three common runner-game conventions.
        // ArrowUp specifically requested by the player so the arrow cluster is
        // self-contained for jumping and turning without reaching for Space.
        event.preventDefault();
        if (!jumpingRef.current) {
          jumpingRef.current = true;
          setJumping(true);
          window.setTimeout(() => {
            jumpingRef.current = false;
            setJumping(false);
          }, 460);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const finishRun = (payload: Omit<RunnerFinishedPayload, 'moduleId'>) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    eventBus.emit('runner:finished', {
      moduleId: GAME_IDS.debtRunner,
      ...payload,
    });
  };

  const getTile = (index: number): TrackTile => {
    const safe = ((index % tiles.length) + tiles.length) % tiles.length;
    return tiles[safe]!;
  };

  const spawnSandPuff = (position: [number, number, number]) => {
    puffIdRef.current += 1;
    const id = puffIdRef.current;
    setPuffs((prev) => [...prev, { id, position }]);
  };

  const removeSandPuff = (id: number) => {
    setPuffs((prev) => prev.filter((p) => p.id !== id));
  };

  useFrame((state, dt) => {
    if (finishedRef.current) return;
    if (pauseRef.current) return;

    elapsed.current += dt;
    hitLock.current = Math.max(0, hitLock.current - dt);
    injuryTimer.current = Math.max(0, injuryTimer.current - dt);
    stumbleTimer.current = Math.max(0, stumbleTimer.current - dt);
    hitFlashRef.current = Math.max(0, hitFlashRef.current - dt);
    cameraKickRef.current = Math.max(0, cameraKickRef.current - dt);
    if (hurtFlash && hitFlashRef.current <= 0) setHurtFlash(false);

    let h = hudRef.current;

    const debtPressure = Math.min(
      1.4,
      0.2 + (elapsed.current / 60) * session.effects.debtPressureGrowthPerMinute,
    );
    const injuryPenalty = injuryTimer.current > 0 ? 0.72 / session.effects.injurySlowMultiplier : 1;
    const speed = BASE_SPEED * session.effects.movementResponseMultiplier * injuryPenalty;

    tileProgress.current += dt * speed;
    while (tileProgress.current >= TILE_SIZE) {
      tileProgress.current -= TILE_SIZE;
      tileIndex.current += 1;
      if (tileIndex.current > tiles.length - 8) tileIndex.current = 6;
    }

    const activeTile = getTile(tileIndex.current);
    const nextTile = getTile(tileIndex.current + 1);

    // Raw forward from the path graph — flips ~90deg in one frame at a turn
    // tile. Used ONLY for path math (active->next interpolation, turn checks).
    _smoothForwardTarget
      .set(nextTile.x - activeTile.x, 0, nextTile.z - activeTile.z)
      .normalize();

    // Smoothed forward — used for the lateral basis and camera follow so the
    // basis doesn't jump at the tile boundary. Plain exp-damp toward raw.
    smoothedForwardRef.current.lerp(_smoothForwardTarget, damp(FORWARD_SMOOTH_SPEED, dt));
    if (smoothedForwardRef.current.lengthSq() < 1e-6) {
      // Degenerate guard — should never trigger in practice.
      smoothedForwardRef.current.copy(_smoothForwardTarget);
    } else {
      smoothedForwardRef.current.normalize();
    }
    _forward.copy(smoothedForwardRef.current);

    // Lateral basis from the SMOOTHED forward — eliminates the lane-snap at
    // turn boundaries (Fix E in stabilize_debt_runner plan).
    _lateral.crossVectors(UP, _forward).normalize();

    // Smooth the lateral lane offset toward the discrete target lane.
    // Forward path position is exact; lane shifts ease toward their target
    // with frame-rate-independent exponential damping.
    const targetLaneOffset = playerLaneRef.current * LANE_SPACING;
    const blend = easeOutCubic(damp(LANE_SMOOTH_SPEED, dt));
    laneOffsetRef.current += (targetLaneOffset - laneOffsetRef.current) * blend;

    const t = tileProgress.current / TILE_SIZE;
    // pos.y here is the WORLD y of the player root group (`player` ref). The
    // BeachCharacter mesh adds an internal +0.7 offset, so ground = 0 and
    // jump = 0.6 keeps the rendered character at the same heights as before.
    _pos.set(
      activeTile.x + (nextTile.x - activeTile.x) * t + _lateral.x * laneOffsetRef.current,
      jumping ? JUMP_Y : GROUND_Y,
      activeTile.z + (nextTile.z - activeTile.z) * t + _lateral.z * laneOffsetRef.current,
    );

    if (player.current) {
      // Forward position is set directly (no lerp) so the run never feels rubbery.
      player.current.position.copy(_pos);
      // Face along the SMOOTHED forward so the camera/character don't snap at turns.
      _lookAhead.copy(_pos).add(_forward);
      player.current.lookAt(_lookAhead);
    }

    if (playerTilt.current) {
      // Banking roll lives on a SEPARATE object so it doesn't fight `lookAt`'s
      // quaternion writes (Fix C in plan). lookAt = yaw, this = roll. Only.
      const laneDelta = targetLaneOffset - laneOffsetRef.current;
      const tilt = MathUtils.clamp(laneDelta / LANE_SPACING, -1, 1) * LANE_TILT_MAX;
      playerTilt.current.rotation.z = MathUtils.lerp(
        playerTilt.current.rotation.z,
        -tilt,
        damp(TILT_SMOOTH_SPEED, dt),
      );
    }

    // Detect landing -> spawn sand puff (one per land event).
    if (wasGroundedRef.current && jumping) {
      wasGroundedRef.current = false;
    } else if (!wasGroundedRef.current && !jumping) {
      wasGroundedRef.current = true;
      spawnSandPuff([_pos.x, 0.05, _pos.z]);
    }

    // Path turns: geometry already defines the route — no loss for silence.
    // Correct arrow near a bend gives a small morale bump; wrong arrow costs stamina once per tile.
    if (activeTile.turn !== 'straight' && t > 0.64) {
      const turnInput = pendingTurn.current;
      const inputIsFresh =
        !!turnInput && elapsed.current - turnInput.atSeconds <= TURN_INPUT_BUFFER_SECONDS;
      const alreadyResolved = consumedTurnTile.current === activeTile.id;

      if (!alreadyResolved) {
        if (inputIsFresh) {
          if (turnInput.direction === activeTile.turn) {
            consumedTurnTile.current = activeTile.id;
            pendingTurn.current = null;
            wrongTurnPenaltyTileId.current = null;
            h = { ...h, morale: Math.min(100, h.morale + 2) };
          } else if (wrongTurnPenaltyTileId.current !== activeTile.id) {
            wrongTurnPenaltyTileId.current = activeTile.id;
            stumbleTimer.current = Math.max(stumbleTimer.current, 0.9);
            injuryTimer.current = Math.max(injuryTimer.current, 0.5);
            h = {
              ...h,
              stamina: Math.max(0, h.stamina - 10 * session.effects.burnoutDrainMultiplier),
              morale: Math.max(0, h.morale - 4),
            };
            pendingTurn.current = null;
          }
        }
        if (t > 0.98) {
          consumedTurnTile.current = activeTile.id;
          pendingTurn.current = null;
          wrongTurnPenaltyTileId.current = null;
        }
      }
    } else if (activeTile.turn === 'straight' && t > 0.92) {
      consumedTurnTile.current = null;
      if (pendingTurn.current && elapsed.current - pendingTurn.current.atSeconds > TURN_INPUT_BUFFER_SECONDS) {
        pendingTurn.current = null;
      }
    }

    // Obstacle collision checks.
    if (t > 0.35 && t < 0.7 && hitLock.current <= 0) {
      for (const obstacle of activeTile.obstacles) {
        if (obstacle.lane !== playerLaneRef.current) continue;
        const blockedLow = obstacle.kind === 'low' && !jumping;
        const blockedHigh = obstacle.kind === 'high' && !jumping;
        const blockedSolid = obstacle.kind === 'block' || obstacle.kind === 'hazard';
        if (blockedLow || blockedHigh || blockedSolid) {
          hitLock.current = 0.7;
          injuryTimer.current = 1.6 * session.effects.injuryDurationMultiplier;
          // Visual feedback: red flash on character + brief camera kick.
          hitFlashRef.current = 0.35;
          setHurtFlash(true);
          cameraKickRef.current = 0.3;
          h = {
            ...h,
            lives: h.lives - 1,
            stamina: Math.max(0, h.stamina - 12 * session.effects.injurySlowMultiplier),
            chaseDistance: Math.max(0.3, h.chaseDistance - 3.6 * session.effects.debtCollectorAggression),
          };
        }
      }
    }

    // Misc/fun stumble behavior.
    if (stumbleTimer.current <= 0 && Math.random() < session.effects.stumbleChancePerSecond * dt) {
      stumbleTimer.current = 1.2;
      injuryTimer.current = Math.max(injuryTimer.current, 0.7);
      h = {
        ...h,
        stamina: Math.max(0, h.stamina - 8 * session.effects.burnoutDrainMultiplier),
        morale: Math.max(0, h.morale - 5),
      };
    }

    const staminaDrain = (4.8 * session.effects.staminaDrainMultiplier + debtPressure * 1.8) * dt;
    const staminaGain = 7 * session.effects.staminaRecoveryMultiplier * dt;
    const recovering = injuryTimer.current <= 0 && !jumping;
    const nextStamina = Math.min(100, Math.max(0, h.stamina + (recovering ? staminaGain : -staminaDrain)));
    const chaseDelta = ((debtPressure * session.effects.debtCollectorAggression) - nextStamina / 140) * dt;
    const nextChaseDistance = Math.min(24, Math.max(0, h.chaseDistance - chaseDelta));
    const timerSeconds = Math.max(0, session.durationSeconds - elapsed.current);
    const debuffs: string[] = [];
    if (injuryTimer.current > 0) debuffs.push('Injured');
    if (stumbleTimer.current > 0) debuffs.push('Stumble');
    if (profile.food === 'bad') debuffs.push('Low Fuel');
    if (profile.miscFun === 'bad') debuffs.push('Burnout');

    const chaseSpan = 23.7;
    const chaseProx01 = 1 - MathUtils.clamp((nextChaseDistance - 0.3) / chaseSpan, 0, 1);
    const debtNorm01 = MathUtils.clamp(debtPressure / 1.4, 0, 1);
    const moraleStress01 = 1 - MathUtils.clamp(h.morale / 100, 0, 1);
    const collectorPressure01 = MathUtils.clamp(
      0.5 * chaseProx01 + 0.3 * debtNorm01 + 0.22 * moraleStress01,
      0,
      1,
    );

    const prevCh = prevChaseDistanceRef.current;
    if (prevCh - nextChaseDistance > 0.45) {
      cameraKickRef.current = Math.max(
        cameraKickRef.current,
        0.12 + Math.min(0.14, (prevCh - nextChaseDistance) * 0.06),
      );
    }
    prevChaseDistanceRef.current = nextChaseDistance;

    const monsterStage =
      nextChaseDistance > 14
        ? 'manageable'
        : nextChaseDistance > 9
          ? 'threatening'
          : nextChaseDistance > 5
            ? 'dangerous'
            : 'overwhelming';

    h = {
      ...h,
      timerSeconds,
      stamina: nextStamina,
      debtPressure: debtPressure / 1.4,
      chaseDistance: nextChaseDistance,
      morale: Math.max(0, h.morale - (profile.miscFun === 'bad' ? 0.9 : 0.35) * dt),
      monsterStage,
      collectorPressure01,
      debuffs,
    };

    // Publish to the per-frame ref ONLY. A separate fixed-rate interval
    // (mounted once below) copies hudRef -> React state + the player store
    // every ~120ms. Calling setHud(h) here would re-render the entire R3F
    // subtree at 60fps and was the dominant cause of visible jitter.
    hudRef.current = h;

    // Win/loss gates (use same-frame HUD snapshot — not stale React state).
    if (h.lives <= 0) {
      finishRun({
        outcome: 'loss',
        failReason: 'noLives',
        endedAtMs: Date.now(),
        config: {
          profile,
          durationSeconds: session.durationSeconds,
          totalDebtPressureTier: session.totalDebtPressureTier,
        },
        stats: {
          timeSurvivedSeconds: elapsed.current,
        },
        effectsTriggered: session.notes,
      });
      return;
    }
    if (h.chaseDistance <= 0.3) {
      finishRun({
        outcome: 'loss',
        failReason: 'caught',
        endedAtMs: Date.now(),
        config: {
          profile,
          durationSeconds: session.durationSeconds,
          totalDebtPressureTier: session.totalDebtPressureTier,
        },
        stats: {
          timeSurvivedSeconds: elapsed.current,
        },
        effectsTriggered: session.notes,
      });
      return;
    }
    if (elapsed.current >= session.durationSeconds) {
      finishRun({
        outcome: 'win',
        endedAtMs: Date.now(),
        config: {
          profile,
          durationSeconds: session.durationSeconds,
          totalDebtPressureTier: session.totalDebtPressureTier,
        },
        stats: {
          timeSurvivedSeconds: elapsed.current,
        },
        effectsTriggered: session.notes,
      });
      return;
    }

    const chaseVisualInt = MathUtils.clamp(1 - nextChaseDistance / 16, 0, 1);

    // Visibility rule: show the collector during the brief intro window so
    // the player learns there's a chaser, then hide it. Re-reveal ONLY when
    // the player is decisively in trouble — using hysteresis so the
    // silhouette doesn't strobe on/off near the boundary.
    const inIntroWindow = elapsed.current < INTRO_COLLECTOR_VISIBLE_SEC;
    const decisivelyDying =
      h.chaseDistance < NEAR_DEATH_CHASE_GAP_SHOW ||
      h.monsterStage === 'overwhelming' ||
      h.collectorPressure01 >= NEAR_DEATH_PRESSURE_SHOW;
    const decisivelySafe =
      h.chaseDistance > NEAR_DEATH_CHASE_GAP_HIDE &&
      h.monsterStage !== 'overwhelming' &&
      h.collectorPressure01 < NEAR_DEATH_PRESSURE_HIDE;

    if (inIntroWindow) {
      collectorShownRef.current = true;
    } else if (decisivelyDying) {
      collectorShownRef.current = true;
    } else if (decisivelySafe) {
      collectorShownRef.current = false;
    }
    const collectorVisible = collectorShownRef.current;

    if (collectorVisualWrap.current) {
      collectorVisualWrap.current.visible = collectorVisible;
    }

    if (collector.current && player.current) {
      _playerWorldPos.copy(player.current.position);
      _collectorTarget
        .copy(_playerWorldPos)
        .addScaledVector(_forward, -Math.max(1, h.chaseDistance));
      const wobbleAmp = 0.09 * chaseVisualInt * session.effects.debtCollectorAggression;
      _collectorWobble.copy(_lateral).multiplyScalar(Math.sin(elapsed.current * 6.2) * wobbleAmp);
      _collectorTarget.add(_collectorWobble);

      const followSpeed =
        3.2 +
        chaseVisualInt * 9.2 +
        session.effects.debtCollectorAggression * 2.35 +
        collectorPressure01 * 1.8;
      collector.current.position.lerp(_collectorTarget, damp(followSpeed, dt));
      collector.current.scale.setScalar(session.effects.debtCollectorScale);
      collector.current.lookAt(_playerWorldPos);
    }

    // Camera: extend distance only while the collector is visible (intro / danger).
    const camAlong = collectorVisible
      ? MathUtils.clamp(Math.max(CAMERA_DISTANCE, nextChaseDistance + 1.85), 8.2, 26)
      : CAMERA_DISTANCE;
    const camDist = collectorVisible
      ? MathUtils.clamp(camAlong - chaseVisualInt * 1.15, 8.2, 26)
      : MathUtils.clamp(CAMERA_DISTANCE - chaseVisualInt * 0.45, 8.2, 12.5);
    const camHeight = CAMERA_HEIGHT + chaseVisualInt * 0.42 - nextChaseDistance / 24;

    _cameraTarget.copy(_pos).addScaledVector(_forward, -camDist);
    _cameraTarget.y = camHeight;

    if (cameraKickRef.current > 0) {
      const kick = cameraKickRef.current / 0.3;
      _cameraTarget.addScaledVector(_forward, -kick * 0.6);
      _cameraTarget.y -= kick * 0.25;
    }

    state.camera.position.lerp(_cameraTarget, damp(CAM_POS_SMOOTH, dt));

    const cam = state.camera as PerspectiveCamera;
    if (cam && 'fov' in cam && typeof cam.fov === 'number') {
      const targetFov = 50 - chaseVisualInt * 3.2 - collectorPressure01 * 1.2;
      cam.fov = MathUtils.lerp(cam.fov, targetFov, damp(5, dt));
      cam.updateProjectionMatrix();
    }

    _desiredLook.copy(_pos).addScaledVector(_forward, 12);
    _desiredLook.x += -laneOffsetRef.current * 0.25;
    _desiredLook.addScaledVector(_lateral, chaseVisualInt * 0.35);
    camLookTarget.current.lerp(_desiredLook, damp(CAM_LOOK_SMOOTH, dt));
    state.camera.lookAt(camLookTarget.current);

    // Throttled collector SFX — only when the mesh is visible.
    const intenSfx = chaseVisualInt;
    if (collectorVisible && intenSfx > 0.08) {
      const footIv = 0.38 - intenSfx * 0.14;
      if (elapsed.current - lastSfxFootRef.current > footIv) {
        lastSfxFootRef.current = elapsed.current;
        audio.playSFX('collectorFootstep', { volume: 0.22 + intenSfx * 0.38 });
      }
      const rustleIv = 1.85 - intenSfx * 0.75;
      if (elapsed.current - lastSfxRustleRef.current > rustleIv) {
        lastSfxRustleRef.current = elapsed.current;
        audio.playSFX('collectorPapers', { volume: 0.12 + intenSfx * 0.28 });
      }
      if (intenSfx > 0.55 && elapsed.current - lastSfxRingRef.current > 5.2 && Math.random() < 0.004) {
        lastSfxRingRef.current = elapsed.current;
        audio.playSFX('collectorPhone', { volume: 0.18 + intenSfx * 0.25 });
      }
    }
  });

  // Single mount-time HUD pump. Runs at ~8Hz, reads the per-frame `hudRef`,
  // and pushes that snapshot into both local React state (so the in-canvas
  // HUD overlay updates) and the shared player store (so external screens
  // see the live values). Crucially, this interval is created ONCE — its
  // dep array doesn't include `hud`, so it isn't torn down/recreated 60
  // times per second. That single change is the largest contributor to
  // stable frame pacing in the runner.
  useEffect(() => {
    const handle = window.setInterval(() => {
      const snapshot = hudRef.current;
      setHud(snapshot);
      mergePlayerData({ 'runner.hud': snapshot });
    }, 120);
    return () => window.clearInterval(handle);
  }, [mergePlayerData]);

  // Visible window of tiles so far/cleanup stays cheap.
  const visibleStart = Math.max(0, tileIndex.current - 6);
  const visibleTiles = tiles.slice(visibleStart, tileIndex.current + 35);

  return (
    <>
      {/* ============================================================= */}
      {/* Sky — Island Run ParadiseSkydome gradient (see scene component). */}
      {/* Canvas clear color: zenith blue for any uncovered pixels.      */}
      {/* ============================================================= */}
      <color attach="background" args={['#3aa6ee']} />
      <ParadiseSkydomeMesh />
      <fog attach="fog" args={[new Color('#ffd4b8'), 42, 200]} />

      {/* Sunny midday tropical lighting — slightly warmer + brighter than the
          previous afternoon bias so the new beach decor (umbrellas, surfboards,
          loungers) reads as colourful and freshly lit rather than muted. */}
      <ambientLight intensity={0.62} color="#fff8ec" />
      <hemisphereLight color="#7fc8ff" groundColor="#f4d8a8" intensity={0.78} position={[0, 40, 0]} />
      <directionalLight position={[-22, 22, 13]} intensity={1.65} color="#fff1d2" castShadow={false} />
      <directionalLight position={[18, 8, -22]} intensity={0.42} color="#cfe8ff" castShadow={false} />

      <Ocean />
      <ShorelineDecor />
      <BeachSand />
      <OceanInlets />
      <BeachDecor />

      {/* Distant island silhouettes — a small archipelago at varied bearings
          so the horizon stays interesting no matter which way the path
          twists during a run. Softer tropical greens / blue-greens so fog
          reads as atmospheric depth rather than flat colour. */}
      <group>
        <mesh position={[-50, 4, -90]}>
          <sphereGeometry args={[10, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#4a9576" roughness={1} metalness={0} />
        </mesh>
        <mesh position={[40, 3.6, -100]}>
          <sphereGeometry args={[8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#3d7f62" roughness={1} metalness={0} />
        </mesh>
        <mesh position={[110, 4.4, -40]}>
          <sphereGeometry args={[9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#5aa088" roughness={1} metalness={0} />
        </mesh>
        <mesh position={[-120, 3.2, 30]}>
          <sphereGeometry args={[7.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#3f8870" roughness={1} metalness={0} />
        </mesh>
        <mesh position={[20, 3, 130]}>
          <sphereGeometry args={[8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#487f6a" roughness={1} metalness={0} />
        </mesh>
        <mesh position={[-90, 2.8, 110]}>
          <sphereGeometry args={[6.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#56988a" roughness={1} metalness={0} />
        </mesh>
      </group>

      {/* ============================================================= */}
      {/* Path — light-warm boardwalk with rope-post borders.            */}
      {/* ============================================================= */}
      {visibleTiles.map((tile: TrackTile, visibleIndex) => {
        const absoluteIndex = visibleStart + visibleIndex;
        const nextTile = getTile(absoluteIndex + 1);
        const nextNextTile = getTile(absoluteIndex + 2);
        const dx = nextTile.x - tile.x;
        const dz = nextTile.z - tile.z;
        const distance = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
        const yaw = Math.atan2(dx, dz);
        const isTurn = tile.turn !== 'straight';
        const depthLen = distance + (isTurn ? PLANK_OVERLAP_TURN : PLANK_OVERLAP_STRAIGHT);
        // Side rails removed entirely (see prior commit) — they could not be
        // trimmed enough to stop intruding into perpendicular tiles at corners.
        const width = tile.narrow ? 5.8 : 6.6;
        // Slightly weathered driftwood color. Slippery tiles are still cooler
        // (wet plank look) but biased less aqua so the boardwalk reads as wood.
        const plankColor = tile.slippery ? '#a89a76' : '#c79b62';
        const plankShadowColor = tile.slippery ? '#74684f' : '#7a4f24';
        // Number of cross-plank seams (decorative dark grooves perpendicular to
        // travel) so the surface reads as individual dock boards. Roughly one
        // seam per ~1.1m of length — enough density to feel built without
        // exploding triangle count.
        const seamCount = Math.max(2, Math.floor(distance / 1.1));

        let bisYaw = 0;
        if (isTurn) {
          _cornerIn.set(dx, 0, dz).normalize();
          const odx = nextNextTile.x - nextTile.x;
          const odz = nextNextTile.z - nextTile.z;
          const od = Math.max(0.01, Math.hypot(odx, odz));
          _cornerOut.set(odx / od, 0, odz / od);
          _cornerBis.copy(_cornerIn).add(_cornerOut);
          if (_cornerBis.lengthSq() < 1e-8) {
            _cornerBis.copy(_cornerOut);
          } else {
            _cornerBis.normalize();
          }
          bisYaw = Math.atan2(_cornerBis.x, _cornerBis.z);
        }

        return (
          <group key={tile.id}>
            <group
              position={[(tile.x + nextTile.x) * 0.5, 0, (tile.z + nextTile.z) * 0.5]}
              rotation={[0, yaw, 0]}
            >
              <mesh receiveShadow>
                <boxGeometry args={[width, 0.32, depthLen]} />
                <meshStandardMaterial
                  color={plankColor}
                  roughness={0.85}
                  polygonOffset
                  polygonOffsetFactor={-0.75}
                  polygonOffsetUnits={-0.75}
                />
              </mesh>
              {/* Subtle wash highlight along the top of the planks — gives the
                  surface a sun-bleached glow without hiding the seam grooves. */}
              <mesh position={[0, 0.17, 0]}>
                <boxGeometry args={[width, 0.02, depthLen]} />
                <meshStandardMaterial
                  color="#e9c794"
                  transparent
                  opacity={0.42}
                  polygonOffset
                  polygonOffsetFactor={-0.5}
                  polygonOffsetUnits={-0.5}
                />
              </mesh>
              {/* Cross-plank seams — thin dark grooves perpendicular to travel
                  so the boardwalk reads as a sequence of laid dock boards.
                  Rendered as flat boxes hovering just above the deck so they
                  show on top without z-fighting (polygonOffset on the deck
                  pushes the deck back; the seams sit slightly higher). */}
              {Array.from({ length: seamCount }).map((_, i) => {
                const t = (i + 1) / (seamCount + 1);
                const seamZ = (t - 0.5) * depthLen;
                return (
                  <mesh
                    key={`seam-${tile.id}-${i}`}
                    position={[0, 0.181, seamZ]}
                  >
                    <boxGeometry args={[width - 0.05, 0.012, 0.06]} />
                    <meshStandardMaterial
                      color={plankShadowColor}
                      roughness={0.95}
                      transparent
                      opacity={0.55}
                    />
                  </mesh>
                );
              })}
              {/* Edge beams running the length of the boards — the long
                  stringers a real dock would have along each side. */}
              <mesh position={[-width / 2 + 0.08, 0.005, 0]}>
                <boxGeometry args={[0.16, 0.36, depthLen]} />
                <meshStandardMaterial color={plankShadowColor} roughness={0.95} />
              </mesh>
              <mesh position={[width / 2 - 0.08, 0.005, 0]}>
                <boxGeometry args={[0.16, 0.36, depthLen]} />
                <meshStandardMaterial color={plankShadowColor} roughness={0.95} />
              </mesh>
              {/* Cross-beam under the deck near the front of the tile — visible
                  from the side as a structural support. Rendered only on
                  straight tiles so corners stay visually clean. */}
              {!isTurn ? (
                <mesh position={[0, -0.18, depthLen * 0.35]}>
                  <boxGeometry args={[width + 0.1, 0.18, 0.18]} />
                  <meshStandardMaterial color={plankShadowColor} roughness={0.95} />
                </mesh>
              ) : null}
              {/* Pilings — pairs of weathered wooden posts descending into the
                  water at the leading edge of each plank. The trailing edge is
                  covered by the next tile's pilings, so we only render one pair
                  per tile to keep draw counts tight. */}
              {!isTurn ? (
                <>
                  <mesh position={[-width / 2 - 0.05, -0.7, depthLen * 0.42]} castShadow>
                    <cylinderGeometry args={[0.16, 0.2, 1.8, 8]} />
                    <meshStandardMaterial color="#5b3a1c" roughness={0.95} />
                  </mesh>
                  <mesh position={[width / 2 + 0.05, -0.7, depthLen * 0.42]} castShadow>
                    <cylinderGeometry args={[0.16, 0.2, 1.8, 8]} />
                    <meshStandardMaterial color="#5b3a1c" roughness={0.95} />
                  </mesh>
                  {/* Tiny wet-line ring near the waterline on each piling for
                      a touch of "this lives in salt water" detail. */}
                  <mesh position={[-width / 2 - 0.05, -0.32, depthLen * 0.42]}>
                    <cylinderGeometry args={[0.205, 0.205, 0.05, 8]} />
                    <meshStandardMaterial color="#3a5a4a" roughness={1} />
                  </mesh>
                  <mesh position={[width / 2 + 0.05, -0.32, depthLen * 0.42]}>
                    <cylinderGeometry args={[0.205, 0.205, 0.05, 8]} />
                    <meshStandardMaterial color="#3a5a4a" roughness={1} />
                  </mesh>
                </>
              ) : null}
              {tile.obstacles.map((obs, index) => (
                <BeachObstacle
                  key={`${tile.id}-${obs.label}-${index}`}
                  kind={obs.kind}
                  position={[obs.lane * LANE_SPACING, 0, 0]}
                />
              ))}
            </group>
            {isTurn ? (
              <group position={[nextTile.x, 0, nextTile.z]} rotation={[0, bisYaw, 0]}>
                {/* Corner deck cap — same warm dock tone as the planks. */}
                <mesh position={[0, 0.145, 0]} receiveShadow>
                  <boxGeometry args={[2.65, 0.07, 2.65]} />
                  <meshStandardMaterial
                    color={plankColor}
                    roughness={0.88}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                  />
                </mesh>
                {/* Single corner piling under the bend — anchors the turn
                    visually to the water below. */}
                <mesh position={[0, -0.7, 0]} castShadow>
                  <cylinderGeometry args={[0.22, 0.26, 1.8, 10]} />
                  <meshStandardMaterial color="#5b3a1c" roughness={0.95} />
                </mesh>
                <mesh position={[0, -0.32, 0]}>
                  <cylinderGeometry args={[0.265, 0.265, 0.05, 10]} />
                  <meshStandardMaterial color="#3a5a4a" roughness={1} />
                </mesh>
              </group>
            ) : null}
          </group>
        );
      })}

      {/* Player.
          Two-group split:
            - outer <group ref={player}> = world position + yaw (lookAt)
            - inner <BeachCharacter ref={playerTilt}> = bank/roll only
          Splitting these prevents lookAt's quaternion writes from fighting
          the manual `rotation.z` write that produces the lane-shift bank. */}
      <group ref={player}>
        <BeachCharacter
          ref={playerTilt}
          jumping={jumping}
          hurtFlash={hurtFlash}
          energy={MathUtils.clamp(hud.stamina / 100, 0, 1)}
          meshRenderOrder={2}
        />
      </group>

      {/* Sand puffs (one-shot particle systems). */}
      {puffs.map((p) => (
        <SandPuff key={p.id} position={p.position} onDone={() => removeSandPuff(p.id)} />
      ))}

      {/* Debt Collector + paper trail (trail samples collector world position). */}
      <group ref={collectorVisualWrap}>
        <DebtCollector
          ref={collector}
          intensity={MathUtils.clamp(1 - hud.chaseDistance / 16, 0, 1)}
          monsterStage={hud.monsterStage}
        />
        <DebtCollectorPaperTrail
          sourceRef={collector}
          intensity={MathUtils.clamp(1 - hud.chaseDistance / 16, 0, 1)}
        />
      </group>
    </>
  );
}
