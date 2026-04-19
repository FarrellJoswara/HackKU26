/**
 * @file Ocean plane — INTENTIONALLY STATIC.
 *
 * Earlier versions of this component animated:
 *   1. The plane's vertex Z values (wave displacement via useFrame), which
 *      created visible undulating cyan crests across the surface.
 *   2. The normal-map UV offset (scrolling water normals).
 *
 * Both of those produced what the player perceived as "blue masses moving in
 * the background." User feedback was explicit: get rid of them. So this
 * component now renders a flat, motion-free pale-lagoon plane:
 *
 *   - No `useFrame`. No per-frame writes to geometry attributes. No UV scroll.
 *   - Plain low-segment `PlaneGeometry` (no need for wave detail).
 *   - Softer, less-saturated color so the water reads as calm shallow lagoon
 *     rather than vivid cyan ocean.
 *
 * If you ever want subtle motion back, re-introduce a useFrame here AND read
 * the related conversation history first — the user explicitly does not want
 * moving blue masses in the background.
 */

export default function Ocean() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.32, 0]}
      renderOrder={-1}
    >
      <planeGeometry args={[900, 900, 1, 1]} />
      <meshStandardMaterial
        color="#3fb6d6"
        roughness={0.55}
        metalness={0.08}
        transparent
        opacity={0.94}
        depthWrite={false}
      />
    </mesh>
  );
}
