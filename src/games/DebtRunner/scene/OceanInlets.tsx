/**
 * @file OceanInlets — large, irregularly-shaped water bodies cut into the
 * background sand so the floor reads as living shoreline with the ocean
 * pushing in past the dock, rather than a flat tan plane.
 *
 * Conceptually these are different from `BeachLagoons.tsx`:
 *
 *   - BeachLagoons render small circular tide pools tucked between props.
 *   - OceanInlets render BIG (8-22 m wide), irregularly-blobbed inlets
 *     that match the main ocean's colour, so they read as the same body
 *     of water reaching inland — tidal inlets / coastal lagoons / bays.
 *
 * DESIGN CONSTRAINTS (do not relax without checking conversation
 * history first):
 *
 *   1. EVERYTHING IS STATIC. No useFrame, no shaders, no animation. The
 *      user has explicitly forbidden moving water in the background; see
 *      Ocean.tsx for the same rule.
 *   2. STAYS OFF THE PATH. Every inlet's centre sits at radius ≥ 38 m
 *      from world origin. The path has no collision against decor (these
 *      are visual-only) but we want the inlets clearly in the background
 *      sand, not under the boardwalk's starting span.
 *   3. NO Z-FIGHTING WITH SAND/LAGOONS. Sand is at y = -0.20, lagoons at
 *      y ≈ -0.185. Inlets sit between them at y ≈ -0.193..-0.188 with
 *      `polygonOffset` so all three layers resolve cleanly.
 *   4. DETERMINISTIC. The seeded layout is identical every run.
 *   5. COLOUR MATCHES THE OCEAN. The deep-water core uses #3fb6d6 — the
 *      exact colour of the main Ocean.tsx plane — so the inlets visually
 *      "belong to" the same body of water rather than looking like loose
 *      stickers on the sand. If you change the ocean colour, change this
 *      one too (search "3fb6d6" in src/games/DebtRunner).
 *
 * Each inlet is built from three layers:
 *
 *   - WET-SAND RING:   3-5 overlapping ellipses, slightly larger,
 *                      darker tan. Reads as the moist sand at the edge.
 *   - FOAM BAND:       3-5 overlapping ellipses, just slightly smaller,
 *                      pale aqua. Reads as the foam/shallow waterline.
 *   - DEEP-WATER CORE: 3-5 overlapping ellipses, smallest, ocean violet.
 *                      The body of water itself.
 *
 * Stacking three offset blob-clusters at the same centre produces an
 * organic, non-circular shoreline silhouette without needing custom
 * geometry or shaders.
 */

import { useMemo } from 'react';

import type { TrackTile } from '../types';

/**
 * Reject any inlet whose bounding sphere comes within this distance of
 * any path tile. The inlet "footprint" can be ~6m across (baseSize ×
 * scale ≈ up to 4m radius), and the boardwalk is ~3m wide, so 8m of
 * clearance keeps water visibly off the planks even when the path
 * snakes past the spawn point.
 */
const INLET_PATH_CLEARANCE_M = 9;

interface InletBlob {
  dx: number; // offset from inlet centre
  dz: number;
  rx: number; // x-radius of this ellipse component
  rz: number; // z-radius of this ellipse component
}

interface Inlet {
  x: number;
  z: number;
  rot: number;
  blobs: InletBlob[];
  scale: number;
}

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

function isOnPath(x: number, z: number, tiles: ReadonlyArray<TrackTile>): boolean {
  const r = INLET_PATH_CLEARANCE_M;
  for (const tile of tiles) {
    const dx = tile.x - x;
    if (dx > r || dx < -r) continue;
    const dz = tile.z - z;
    if (dz > r || dz < -r) continue;
    if (dx * dx + dz * dz <= r * r) return true;
  }
  return false;
}

function generateInlets(tiles: ReadonlyArray<TrackTile>): Inlet[] {
  // Distinct seed from BeachDecor (0xbeac21) and BeachLagoons (0x1a900)
  // so the three scatters don't collapse into the same angular pattern.
  const rand = mulberry32(0x0c3a47);
  const inlets: Inlet[] = [];

  // Two radial bands. The mid band gives the player a strong sense of
  // "ocean pushing into the beach" close enough to read clearly while
  // running. The outer band fills in the horizon between the dock and
  // the distant ocean ring so the wide sand expanse no longer looks
  // empty at distance.
  const bands: Array<{
    inner: number;
    outer: number;
    count: number;
    minScale: number;
    maxScale: number;
  }> = [
    { inner: 38, outer: 80, count: 6, minScale: 1.0, maxScale: 1.6 },
    { inner: 80, outer: 180, count: 8, minScale: 1.6, maxScale: 2.6 },
  ];

  for (const band of bands) {
    for (let i = 0; i < band.count; i += 1) {
      // Even angular spread + jitter so inlets don't form a visible ring.
      const angle = (i / band.count) * Math.PI * 2 + rand() * 0.6;
      const radius = band.inner + rand() * (band.outer - band.inner);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Reject inlets whose centre is too close to any path tile.
      // Without this, the radial scatter would still allow water to
      // appear under the boardwalk wherever the path winds past the
      // inlet centre — see file header for the rationale.
      if (isOnPath(x, z, tiles)) continue;

      // Compose the inlet from 3-5 overlapping ellipses so its silhouette
      // is organic. Each component blob's offset is small (≤ base size)
      // so they stay clustered into one shape.
      const blobCount = 3 + Math.floor(rand() * 3);
      const baseSize = 2.6 + rand() * 1.8;
      const blobs: InletBlob[] = [];
      for (let b = 0; b < blobCount; b += 1) {
        const a = (b / blobCount) * Math.PI * 2 + rand() * 0.5;
        const off = b === 0 ? 0 : baseSize * (0.45 + rand() * 0.55);
        const rx = baseSize * (0.7 + rand() * 0.6);
        const rz = baseSize * (0.7 + rand() * 0.6);
        blobs.push({
          dx: Math.cos(a) * off,
          dz: Math.sin(a) * off,
          rx,
          rz,
        });
      }

      inlets.push({
        x,
        z,
        rot: rand() * Math.PI * 2,
        blobs,
        scale: band.minScale + rand() * (band.maxScale - band.minScale),
      });
    }
  }

  return inlets;
}

interface BlobLayerProps {
  blobs: InletBlob[];
  yOffset: number;
  ringScale: number;
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  polygonOffsetFactor: number;
}

/**
 * One layer of the inlet (wet sand / foam / deep water). Renders all the
 * component ellipses at a shared y-offset, all sharing the same material
 * config. The `ringScale` lets the wet-sand layer be slightly puffier
 * than the water layer, so the moist-sand band shows around the edge.
 */
function BlobLayer({
  blobs,
  yOffset,
  ringScale,
  color,
  roughness,
  metalness,
  opacity,
  polygonOffsetFactor,
}: BlobLayerProps) {
  return (
    <group position={[0, yOffset, 0]}>
      {blobs.map((blob, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[blob.dx, 0, blob.dz]}
          scale={[blob.rx * ringScale, blob.rz * ringScale, 1]}
        >
          <circleGeometry args={[1, 40]} />
          <meshStandardMaterial
            color={color}
            roughness={roughness}
            metalness={metalness}
            transparent={opacity < 1}
            opacity={opacity}
            polygonOffset
            polygonOffsetFactor={polygonOffsetFactor}
            polygonOffsetUnits={polygonOffsetFactor}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function OceanInlets({ tiles }: { tiles: ReadonlyArray<TrackTile> }) {
  const inlets = useMemo(() => generateInlets(tiles), [tiles]);

  return (
    <group renderOrder={-1}>
      {inlets.map((inlet, i) => (
        <group
          key={`inlet-${i}`}
          position={[inlet.x, -0.193, inlet.z]}
          rotation={[0, inlet.rot, 0]}
          scale={[inlet.scale, 1, inlet.scale]}
        >
          {/* Wet-sand ring — darker tan, slightly puffier than the water. */}
          <BlobLayer
            blobs={inlet.blobs}
            yOffset={0.001}
            ringScale={1.22}
            color="#a8855a"
            roughness={0.95}
            metalness={0}
            opacity={1}
            polygonOffsetFactor={-2}
          />
          {/* Foam / shallow waterline — pale tropical aqua, brighter than
              the deep core so the edge of each inlet reads clearly. */}
          <BlobLayer
            blobs={inlet.blobs}
            yOffset={0.005}
            ringScale={1.08}
            color="#9bd6e0"
            roughness={0.55}
            metalness={0.12}
            opacity={0.95}
            polygonOffsetFactor={-3}
          />
          {/* Deep-water core — EXACT same colour as the main Ocean.tsx
              plane (#3fb6d6) so the inlets read as the same body of
              water reaching inland, not as loose blue stickers. */}
          <BlobLayer
            blobs={inlet.blobs}
            yOffset={0.01}
            ringScale={0.92}
            color="#3fb6d6"
            roughness={0.55}
            metalness={0.18}
            opacity={0.96}
            polygonOffsetFactor={-4}
          />
        </group>
      ))}
    </group>
  );
}
