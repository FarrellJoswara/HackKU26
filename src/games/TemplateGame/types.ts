/**
 * @file Per-game input/output types. Each game owns its own — never reuse
 * another game's types, just copy this file as a starting point.
 */

export interface TemplateInput {
  /** Difficulty 0..1. Replace with whatever your game needs. */
  difficulty?: number;
  seed?: number;
}

export interface TemplateOutput {
  score: number;
  durationMs: number;
}
