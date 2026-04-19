import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Color, Vector3 } from 'three';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { GameProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';
import { parseBudgetProfile } from '@/core/finance/budgetTypes';
import { resolveBudgetEffects } from '@/core/finance/budgetEffectResolver';
import type { RunnerFinishedPayload } from '@/core/runner/runnerTypes';
import type { RunnerHudState } from '@/core/runner/hudTypes';
import { generateTrackTiles } from './pathGenerator';
import type { TrackTile } from './types';

const RIGHT = new Vector3(1, 0, 0);
const TILE_SIZE = 8;
const TURN_INPUT_BUFFER_SECONDS = 0.5;
const BASE_SPEED = 10;
/** Lateral offset for lane -1 / 0 / +1; must match obstacle mesh `obs.lane * LANE_SPACING`. */
const LANE_SPACING = 2.2;

function createEmptyHud(maxLives: number): RunnerHudState {
  return {
    timerSeconds: 90,
    stamina: 100,
    lives: maxLives,
    maxLives,
    morale: 55,
    debtPressure: 0.2,
    chaseDistance: 16,
    monsterStage: 'manageable',
    debuffs: [],
    paused: false,
  };
}

function buildHudForSession(session: ReturnType<typeof resolveBudgetEffects>): RunnerHudState {
  const base = createEmptyHud(session.effects.startingLives);
  base.morale += session.effects.moraleStartBoost;
  return base;
}

export default function DebtRunnerGame(_props: GameProps) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);
  const profileInput = useAppStore.getState().playerData['runner.profile'];
  const profile = parseBudgetProfile(profileInput) ?? MOCK_BUDGET_PROFILE;
  const session = useMemo(() => resolveBudgetEffects(profile), [profile]);
  const tiles = useMemo(() => generateTrackTiles(260, session.effects), [session.effects]);

  const initialHud = useMemo(() => buildHudForSession(session), [session]);

  const player = useRef<Group>(null);
  const collector = useRef<Group>(null);
  const cameraFollow = useRef(new Vector3(0, 5.2, 11.5));
  const hudRef = useRef<RunnerHudState>(initialHud);
  const [jumping, setJumping] = useState(false);
  const [hud, setHud] = useState<RunnerHudState>(initialHud);

  const elapsed = useRef(0);
  const tileIndex = useRef(2);
  const tileProgress = useRef(0);
  const stumbleTimer = useRef(0);
  const injuryTimer = useRef(0);
  const hitLock = useRef(0);
  const pauseRef = useRef(false);
  const finishedRef = useRef(false);
  const pendingTurn = useRef<{ direction: 'left' | 'right'; atSeconds: number } | null>(null);
  const consumedTurnTile = useRef<string | null>(null);
  const wrongTurnPenaltyTileId = useRef<string | null>(null);
  const playerLaneRef = useRef<-1 | 0 | 1>(0);
  const jumpingRef = useRef(false);

  useEffect(() => {
    hudRef.current = initialHud;
    setHud(initialHud);
  }, [initialHud]);

  useEffect(() => {
    mergePlayerData({
      'runner.session': session,
      'runner.hud': hud,
    });
  }, [mergePlayerData, session, hud]);

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

      if (event.code === 'ArrowLeft' || event.code === 'KeyD') {
        event.preventDefault();
        goLeft();
      } else if (event.code === 'ArrowRight' || event.code === 'KeyA') {
        event.preventDefault();
        goRight();
      } else if (event.code === 'Space') {
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

  useFrame((state, dt) => {
    if (finishedRef.current) return;
    if (pauseRef.current) return;

    elapsed.current += dt;
    hitLock.current = Math.max(0, hitLock.current - dt);
    injuryTimer.current = Math.max(0, injuryTimer.current - dt);
    stumbleTimer.current = Math.max(0, stumbleTimer.current - dt);

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

    const forward = new Vector3(nextTile.x - activeTile.x, 0, nextTile.z - activeTile.z).normalize();
    const offset = RIGHT.clone()
      .crossVectors(new Vector3(0, 1, 0), forward)
      .normalize()
      .multiplyScalar(playerLaneRef.current * LANE_SPACING);
    const t = tileProgress.current / TILE_SIZE;
    const pos = new Vector3(
      activeTile.x + (nextTile.x - activeTile.x) * t + offset.x,
      jumping ? 1.3 : 0.7,
      activeTile.z + (nextTile.z - activeTile.z) * t + offset.z,
    );

    if (player.current) {
      player.current.position.lerp(pos, Math.min(1, dt * 16));
      player.current.lookAt(pos.clone().add(forward));
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
      debuffs,
    };

    hudRef.current = h;
    setHud(h);

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

    if (collector.current && player.current) {
      const p = player.current.position.clone();
      const collectorPos = p.clone().add(forward.clone().multiplyScalar(-Math.max(1, h.chaseDistance)));
      collector.current.position.lerp(collectorPos, Math.min(1, dt * 6));
      collector.current.scale.setScalar(session.effects.debtCollectorScale);
      collector.current.lookAt(p);
    }

    // Third-person follow: camera sits BEHIND the player (opposite of forward)
    // and looks AHEAD down the path so the player runs away from the lens.
    state.camera.position.lerp(
      pos.clone().add(forward.clone().multiplyScalar(-cameraFollow.current.z)).setY(cameraFollow.current.y),
      Math.min(1, dt * 4),
    );
    state.camera.lookAt(pos.clone().add(forward.clone().multiplyScalar(12)));
  });

  useEffect(() => {
    const t = window.setInterval(() => {
      mergePlayerData({ 'runner.hud': hud });
    }, 120);
    return () => window.clearInterval(t);
  }, [mergePlayerData, hud]);

  return (
    <>
      <color attach="background" args={['#6ec6ff']} />
      <fog attach="fog" args={[new Color('#8fd1ff'), 25, 120]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 18, 8]} intensity={1.2} color="#ffe7b2" />

      {/* Ocean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#2d9bd1" metalness={0.1} roughness={0.35} />
      </mesh>

      {/* Beach base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color="#e5c07b" roughness={0.95} />
      </mesh>

      {tiles
        .slice(Math.max(0, tileIndex.current - 6), tileIndex.current + 35)
        .map((tile: TrackTile, visibleIndex) => {
        const absoluteIndex = Math.max(0, tileIndex.current - 6) + visibleIndex;
        const nextTile = getTile(absoluteIndex + 1);
        const dx = nextTile.x - tile.x;
        const dz = nextTile.z - tile.z;
        const distance = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
        const yaw = Math.atan2(dx, dz);
        const width = tile.narrow ? 5.8 : 6.6;
        const obstacleColor = tile.slippery ? '#5fa8ff' : '#7d4f28';
        return (
          <group
            key={tile.id}
            position={[(tile.x + nextTile.x) * 0.5, 0, (tile.z + nextTile.z) * 0.5]}
            rotation={[0, yaw, 0]}
          >
            <mesh>
              <boxGeometry args={[width, 0.35, distance + 0.35]} />
              <meshStandardMaterial color="#9a6b3f" roughness={0.8} />
            </mesh>
            {tile.obstacles.map((obs, index) => (
              <mesh key={`${tile.id}-${obs.label}-${index}`} position={[obs.lane * LANE_SPACING, 0.8, 0]}>
                <boxGeometry args={[1.2, obs.kind === 'low' ? 0.7 : 1.7, 1.2]} />
                <meshStandardMaterial color={obstacleColor} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Player */}
      <group ref={player} position={[0, 0.7, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.34, 0.65, 4, 12]} />
          <meshStandardMaterial color="#2a3d66" />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.24, 16, 16]} />
          <meshStandardMaterial color="#ffd4aa" />
        </mesh>
      </group>

      {/* Debt Collector */}
      <group ref={collector} position={[0, 0.7, 7]}>
        <mesh>
          <boxGeometry args={[1.2, 1.8, 1.2]} />
          <meshStandardMaterial color="#351313" emissive="#220707" />
        </mesh>
        <mesh position={[0, 1.2, 0.4]}>
          <sphereGeometry args={[0.4, 12, 12]} />
          <meshStandardMaterial color="#5a1f1f" emissive="#2a1010" />
        </mesh>
      </group>
    </>
  );
}

