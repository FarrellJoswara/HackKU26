/**
 * BeachDecor — large, varied, fully-static tropical scatter that surrounds
 * the player at every point along the procedural path.
 *
 * Design constraints (do not relax without checking the conversation
 * history first):
 *
 *   1. EVERYTHING IS STATIC. No useFrame, no animations, no per-frame
 *      transforms. The user has explicitly rejected moving objects in the
 *      background — see the Ocean.tsx header for context.
 *   2. NOTHING IS BLUE-AND-MOVING. Static cyan accents (lagoon-blue beach
 *      ball stripes, surfboard fins) are fine because they don't animate.
 *   3. EVERYTHING SITS OUTSIDE THE PATH. All items are placed at radius
 *      ≥ 14m from world origin so they cannot intrude on the boardwalk.
 *   4. DETERMINISTIC. The scatter is seeded so the layout is stable across
 *      re-renders and game restarts (no flicker, no surprise reposition).
 *
 * The previous version was perceived as "barren": a thin ring of small
 * props plus a sparse outer ring of palm trees. This version dramatically
 * widens the populated area and adds many more beach-themed prop types
 * (umbrellas, loungers, surfboards, sandcastles, beach balls, tiki
 * torches, palm groves, distant island clumps) organised into radial
 * bands so density tapers naturally with distance.
 *
 * Typical mesh count is ~150 items — well within budget for this scene
 * given that every item is built from primitive geometries and shared
 * standard materials.
 */

import { useMemo } from 'react';

type Decor =
  | { kind: 'shell'; x: number; z: number; rot: number; tint: string }
  | { kind: 'starfish'; x: number; z: number; rot: number; tint: string }
  | { kind: 'driftwood'; x: number; z: number; rot: number; len: number }
  | { kind: 'coconut'; x: number; z: number }
  | { kind: 'palm'; x: number; z: number; lean: number; height: number }
  | { kind: 'umbrella'; x: number; z: number; rot: number; tint: string }
  | { kind: 'lounger'; x: number; z: number; rot: number; tint: string }
  | { kind: 'surfboard'; x: number; z: number; rot: number; tint: string }
  | { kind: 'sandcastle'; x: number; z: number; rot: number }
  | { kind: 'beachball'; x: number; z: number; tint: string }
  | { kind: 'tikitorch'; x: number; z: number }
  | { kind: 'cooler'; x: number; z: number; rot: number }
  | { kind: 'rock'; x: number; z: number; rot: number; size: number };

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const SHELL_TINTS = ['#fff2dc', '#f9d7b5', '#f0a98a', '#ffe8c4', '#e7c8b8', '#ffd5b8'];
const STARFISH_TINTS = ['#f08560', '#e3704c', '#ff9d6a', '#d65a3a'];
const UMBRELLA_TINTS = ['#ff5a5a', '#ffce3a', '#3ecbe6', '#ff8b3a', '#5fb56b', '#e85ab8'];
const LOUNGER_TINTS = ['#fff7e8', '#ffe1c2', '#d8f0ff'];
const SURF_TINTS = ['#ffd23a', '#ff7a4e', '#3ecbe6', '#a25af5', '#ff5a8b'];
const BALL_TINTS = ['#ff5a5a', '#ffce3a', '#3ecbe6', '#5fb56b'];

interface BandSpec {
  innerRadius: number;
  outerRadius: number;
  count: number;
  weights: Partial<Record<Decor['kind'], number>>;
}

// Placement bands. Density tapers with distance — close-in we want lots of
// small props the camera will fly past at speed, mid-range we want
// recognisable beach setups (umbrellas + loungers + surfboards), and the
// outer band is mostly palm trees and distant islands so the horizon stays
// populated even when the player is deep into the run.
const BANDS: BandSpec[] = [
  {
    // Inner ring — directly visible at game start, immediately reads beach.
    innerRadius: 14,
    outerRadius: 26,
    count: 38,
    weights: {
      shell: 4,
      starfish: 3,
      driftwood: 2,
      coconut: 2,
      beachball: 2,
      sandcastle: 1.5,
      surfboard: 1.5,
      rock: 1.2,
    },
  },
  {
    // Mid ring — bigger, recognisable "beach scene" setups.
    innerRadius: 26,
    outerRadius: 50,
    count: 46,
    weights: {
      umbrella: 3,
      lounger: 3,
      surfboard: 2,
      sandcastle: 1.5,
      tikitorch: 1.8,
      palm: 2,
      driftwood: 1.2,
      cooler: 1.5,
      rock: 1,
    },
  },
  {
    // Outer band — palm grove + occasional resort props for depth.
    innerRadius: 50,
    outerRadius: 95,
    count: 42,
    weights: {
      palm: 6,
      tikitorch: 1,
      umbrella: 1.2,
      rock: 1.5,
    },
  },
  {
    // Far horizon — sparse very tall palms framing the distance.
    innerRadius: 95,
    outerRadius: 160,
    count: 26,
    weights: {
      palm: 8,
      rock: 1,
    },
  },
];

function pickWeighted<K extends string>(
  weights: Partial<Record<K, number>>,
  rand: () => number,
): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let pick = rand() * total;
  for (const [kind, w] of entries) {
    pick -= w;
    if (pick <= 0) return kind;
  }
  return entries[0]![0];
}

function generateDecor(): Decor[] {
  const rand = mulberry32(0xbeac21);
  const items: Decor[] = [];

  for (const band of BANDS) {
    for (let i = 0; i < band.count; i += 1) {
      // Even angular distribution with jitter so items don't read as a
      // perfect ring. Radius is uniform across the band's radial span.
      const angle = (i / band.count) * Math.PI * 2 + rand() * 0.55;
      const radius =
        band.innerRadius + rand() * (band.outerRadius - band.innerRadius);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const kind = pickWeighted(band.weights, rand);

      switch (kind) {
        case 'shell':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            tint: SHELL_TINTS[Math.floor(rand() * SHELL_TINTS.length)] ?? '#fff2dc',
          });
          break;
        case 'starfish':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            tint:
              STARFISH_TINTS[Math.floor(rand() * STARFISH_TINTS.length)] ?? '#f08560',
          });
          break;
        case 'driftwood':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            len: 1.2 + rand() * 1.6,
          });
          break;
        case 'coconut':
          items.push({ kind, x, z });
          break;
        case 'palm':
          items.push({
            kind,
            x,
            z,
            lean: (rand() - 0.5) * 0.3,
            // Outer-band palms are noticeably taller so they read on the horizon.
            height: 0.85 + rand() * (radius > 80 ? 1.2 : 0.5),
          });
          break;
        case 'umbrella':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            tint:
              UMBRELLA_TINTS[Math.floor(rand() * UMBRELLA_TINTS.length)] ?? '#ff5a5a',
          });
          break;
        case 'lounger':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            tint:
              LOUNGER_TINTS[Math.floor(rand() * LOUNGER_TINTS.length)] ?? '#fff7e8',
          });
          break;
        case 'surfboard':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            tint: SURF_TINTS[Math.floor(rand() * SURF_TINTS.length)] ?? '#ffd23a',
          });
          break;
        case 'sandcastle':
          items.push({ kind, x, z, rot: rand() * Math.PI * 2 });
          break;
        case 'beachball':
          items.push({
            kind,
            x,
            z,
            tint: BALL_TINTS[Math.floor(rand() * BALL_TINTS.length)] ?? '#ff5a5a',
          });
          break;
        case 'tikitorch':
          items.push({ kind, x, z });
          break;
        case 'cooler':
          items.push({ kind, x, z, rot: rand() * Math.PI * 2 });
          break;
        case 'rock':
          items.push({
            kind,
            x,
            z,
            rot: rand() * Math.PI * 2,
            size: 0.4 + rand() * 0.7,
          });
          break;
      }
    }
  }

  return items;
}

function ShellMesh({ tint, rot }: { tint: string; rot: number }) {
  return (
    <group rotation={[0, rot, 0]}>
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <sphereGeometry args={[0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={tint} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.06, 0.05]} rotation={[Math.PI / 2.4, 0, 0]}>
        <sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
    </group>
  );
}

function StarfishMesh({ rot, tint }: { rot: number; tint: string }) {
  return (
    <group rotation={[0, rot, 0]} position={[0, 0.04, 0]}>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.12, 0.06, 0.34]} />
            <meshStandardMaterial color={tint} roughness={0.85} />
          </mesh>
        );
      })}
      <mesh>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color={tint} roughness={0.85} />
      </mesh>
    </group>
  );
}

function DriftwoodMesh({ rot, len }: { rot: number; len: number }) {
  return (
    <group rotation={[0, rot, 0]} position={[0, 0.1, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.16, len, 8]} />
        <meshStandardMaterial color="#a07a4e" roughness={0.95} />
      </mesh>
      <mesh position={[len * 0.45, 0.02, 0.06]} rotation={[0, 0.4, Math.PI / 2.2]}>
        <cylinderGeometry args={[0.06, 0.08, len * 0.4, 6]} />
        <meshStandardMaterial color="#8a6334" roughness={0.95} />
      </mesh>
    </group>
  );
}

function CoconutMesh() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color="#3d2a18" roughness={0.92} />
      </mesh>
      <mesh position={[0.22, 0.14, 0.04]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color="#2e2010" roughness={0.92} />
      </mesh>
    </group>
  );
}

function PalmTreeMesh({ lean, height }: { lean: number; height: number }) {
  // Curved tapered trunk + a fan of fronds + a coconut cluster on top.
  // `height` scales the overall trunk length so the outer band's palms read
  // tall on the horizon while close-in palms stay short and stocky.
  const segments = 5;
  return (
    <group rotation={[0, 0, lean]} scale={[height, height, height]}>
      {Array.from({ length: segments }).map((_, i) => {
        const y = 0.5 + i * 1.0;
        const tilt = lean * 0.4 + (i - 2) * 0.04;
        return (
          <mesh
            key={i}
            position={[Math.sin(tilt) * 0.2 * i, y, 0]}
            rotation={[0, 0, tilt]}
          >
            <cylinderGeometry args={[0.18 - i * 0.02, 0.22 - i * 0.02, 1.05, 10]} />
            <meshStandardMaterial color="#7c5836" roughness={0.95} />
          </mesh>
        );
      })}
      <group position={[Math.sin(lean) * 0.8, 5.1, 0]}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6]}
              rotation={[0, -a, -0.5]}
            >
              <boxGeometry args={[1.7, 0.05, 0.45]} />
              <meshStandardMaterial color="#3fa57a" roughness={0.7} />
            </mesh>
          );
        })}
        <mesh position={[0.05, -0.05, 0]}>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial color="#3d2a18" roughness={0.92} />
        </mesh>
        <mesh position={[-0.1, -0.08, 0.12]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#2e2010" roughness={0.92} />
        </mesh>
      </group>
    </group>
  );
}

function UmbrellaMesh({ rot, tint }: { rot: number; tint: string }) {
  // Beach umbrella: tilted pole + striped parasol top.
  return (
    <group rotation={[0, rot, 0]}>
      <mesh position={[0, 1.2, 0]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
        <meshStandardMaterial color="#d8b078" roughness={0.85} />
      </mesh>
      {/* Parasol — alternating coloured wedges */}
      <group position={[0, 2.35, 0.18]} rotation={[0.18, 0, 0]}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const fill = i % 2 === 0 ? tint : '#fffaf2';
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]}
              rotation={[Math.PI / 2.6, -a + Math.PI / 2, 0]}
            >
              <coneGeometry args={[0.5, 0.7, 4, 1, true]} />
              <meshStandardMaterial color={fill} roughness={0.7} side={2} />
            </mesh>
          );
        })}
        <mesh>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial color="#fffaf2" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function LoungerMesh({ rot, tint }: { rot: number; tint: string }) {
  // Beach lounger: flat seat + tilted backrest + four small legs.
  return (
    <group rotation={[0, rot, 0]} position={[0, 0, 0]}>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.7, 0.08, 1.6]} />
        <meshStandardMaterial color={tint} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.55, 0.65]} rotation={[-0.55, 0, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.7]} />
        <meshStandardMaterial color={tint} roughness={0.7} />
      </mesh>
      {[
        [-0.3, 0.16, -0.7],
        [0.3, 0.16, -0.7],
        [-0.3, 0.16, 0.7],
        [0.3, 0.16, 0.7],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x!, y!, z!]}>
          <boxGeometry args={[0.06, 0.32, 0.06]} />
          <meshStandardMaterial color="#a07a4e" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function SurfboardMesh({ rot, tint }: { rot: number; tint: string }) {
  // Surfboard stuck upright in the sand — instantly reads "beach".
  return (
    <group rotation={[0, rot, 0]} position={[0, 0, 0]}>
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.55, 2.2, 0.08]} />
        <meshStandardMaterial color={tint} roughness={0.55} />
      </mesh>
      {/* Stripe down the centre. */}
      <mesh position={[0, 1.1, 0.045]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.06, 1.7, 0.005]} />
        <meshStandardMaterial color="#ffffff" roughness={0.55} />
      </mesh>
      {/* Fin at the bottom. */}
      <mesh position={[0, 0.18, -0.06]} rotation={[0, 0, 0.18]}>
        <coneGeometry args={[0.08, 0.18, 4]} />
        <meshStandardMaterial color={tint} roughness={0.6} />
      </mesh>
    </group>
  );
}

function SandcastleMesh({ rot }: { rot: number }) {
  // Three-tier sand castle with little flag on top.
  return (
    <group rotation={[0, rot, 0]} position={[0, 0, 0]}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.36, 14]} />
        <meshStandardMaterial color="#e6c590" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.4, 0.45, 0.2, 14]} />
        <meshStandardMaterial color="#dab57b" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.18, 12]} />
        <meshStandardMaterial color="#cca668" roughness={0.95} />
      </mesh>
      {/* Four corner turrets. */}
      {[
        [-0.5, 0.42, -0.2],
        [0.5, 0.42, -0.2],
        [-0.5, 0.42, 0.2],
        [0.5, 0.42, 0.2],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x!, y!, z!]}>
          <cylinderGeometry args={[0.07, 0.09, 0.32, 8]} />
          <meshStandardMaterial color="#e6c590" roughness={0.95} />
        </mesh>
      ))}
      {/* Flag pole + flag. */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
        <meshStandardMaterial color="#3a2410" />
      </mesh>
      <mesh position={[0.12, 1.02, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.005]} />
        <meshStandardMaterial color="#ff5a5a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function BeachBallMesh({ tint }: { tint: string }) {
  // Ball with two coloured stripes on the white base.
  return (
    <group position={[0, 0.32, 0]}>
      <mesh>
        <sphereGeometry args={[0.32, 18, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.45} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.32, 0.045, 8, 24, Math.PI]} />
        <meshStandardMaterial color={tint} roughness={0.45} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.045, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#ff5a5a" roughness={0.45} />
      </mesh>
    </group>
  );
}

function TikiTorchMesh() {
  // Bamboo pole + thatched basket + warm "flame" cone (no animation — the
  // emissive material gives it the appearance of a glowing flame at rest).
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 1.7, 8]} />
        <meshStandardMaterial color="#a8794a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.22, 10]} />
        <meshStandardMaterial color="#8a6334" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.98, 0]}>
        <coneGeometry args={[0.12, 0.32, 10]} />
        <meshStandardMaterial
          color="#ffae3a"
          emissive="#ff6a1a"
          emissiveIntensity={0.55}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

function CoolerMesh({ rot }: { rot: number }) {
  // Picnic cooler — rectangular box with lid and a small handle.
  return (
    <group rotation={[0, rot, 0]} position={[0, 0, 0]}>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.7, 0.42, 0.46]} />
        <meshStandardMaterial color="#f4f4f4" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.74, 0.06, 0.5]} />
        <meshStandardMaterial color="#ff5a5a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.018, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#3a2410" roughness={0.85} />
      </mesh>
    </group>
  );
}

function RockMesh({ rot, size }: { rot: number; size: number }) {
  // Rough, weathered grey rock — a low-poly squashed sphere reads as a
  // beach pebble or boulder depending on `size`.
  return (
    <mesh rotation={[0, rot, 0]} position={[0, size * 0.35, 0]} scale={[size, size * 0.7, size * 0.85]}>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#a8a09a" roughness={0.95} />
    </mesh>
  );
}

export default function BeachDecor() {
  const items = useMemo(generateDecor, []);

  return (
    <group renderOrder={-1}>
      {items.map((item, i) => {
        const key = `decor-${i}`;
        const position: [number, number, number] = [item.x, -0.18, item.z];
        switch (item.kind) {
          case 'shell':
            return (
              <group key={key} position={position}>
                <ShellMesh tint={item.tint} rot={item.rot} />
              </group>
            );
          case 'starfish':
            return (
              <group key={key} position={position}>
                <StarfishMesh tint={item.tint} rot={item.rot} />
              </group>
            );
          case 'driftwood':
            return (
              <group key={key} position={position}>
                <DriftwoodMesh rot={item.rot} len={item.len} />
              </group>
            );
          case 'coconut':
            return (
              <group key={key} position={position}>
                <CoconutMesh />
              </group>
            );
          case 'palm':
            return (
              <group key={key} position={position}>
                <PalmTreeMesh lean={item.lean} height={item.height} />
              </group>
            );
          case 'umbrella':
            return (
              <group key={key} position={position}>
                <UmbrellaMesh rot={item.rot} tint={item.tint} />
              </group>
            );
          case 'lounger':
            return (
              <group key={key} position={position}>
                <LoungerMesh rot={item.rot} tint={item.tint} />
              </group>
            );
          case 'surfboard':
            return (
              <group key={key} position={position}>
                <SurfboardMesh rot={item.rot} tint={item.tint} />
              </group>
            );
          case 'sandcastle':
            return (
              <group key={key} position={position}>
                <SandcastleMesh rot={item.rot} />
              </group>
            );
          case 'beachball':
            return (
              <group key={key} position={position}>
                <BeachBallMesh tint={item.tint} />
              </group>
            );
          case 'tikitorch':
            return (
              <group key={key} position={position}>
                <TikiTorchMesh />
              </group>
            );
          case 'cooler':
            return (
              <group key={key} position={position}>
                <CoolerMesh rot={item.rot} />
              </group>
            );
          case 'rock':
            return (
              <group key={key} position={position}>
                <RockMesh rot={item.rot} size={item.size} />
              </group>
            );
          default:
            return null;
        }
      })}
    </group>
  );
}
