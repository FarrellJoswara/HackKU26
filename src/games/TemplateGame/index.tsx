/**
 * @file Boilerplate R3F mini-game. Copy this folder to start a new game.
 *
 * Contract:
 *   - Receives `inputs: TemplateInput` from the host (set by the caller
 *     that triggered the navigation).
 *   - Emits results through the typed Event Bus, NOT through prop
 *     callbacks, so UI/audio/analytics can listen without a direct
 *     import of this file.
 *
 *       eventBus.emit('game:result', { kind: 'result', payload: out });
 *
 *   - Lives inside the parent `<Canvas>` mounted by `GameRegistry`. Do
 *     not render a `<Canvas>` here.
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { eventBus } from '@/core/events';
import type { GameProps } from '@/core/types';
import type { TemplateInput, TemplateOutput } from './types';

export default function TemplateGame({
  inputs,
  onEvent,
}: GameProps<TemplateInput, TemplateOutput>) {
  const meshRef = useRef<Mesh>(null);
  const startedAt = useRef<number>(performance.now());

  useEffect(() => {
    const startEvt = { kind: 'start' as const, payload: undefined as unknown as TemplateOutput };
    eventBus.emit('game:event', startEvt);
    onEvent?.(startEvt);

    const startedAtMs = startedAt.current;

    return () => {
      const out: TemplateOutput = {
        score: 0,
        durationMs: performance.now() - startedAtMs,
      };
      const resultEvt = { kind: 'result' as const, payload: out };
      eventBus.emit('game:result', resultEvt);
      onEvent?.(resultEvt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += dt * 0.6;
      meshRef.current.rotation.y += dt * 0.9 * (inputs.difficulty ?? 1);
    }
  });

  return (
    <>
      {/* TODO: replace with your scene */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#7c5cff" />
      </mesh>
    </>
  );
}
