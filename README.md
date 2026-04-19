# HackKU26 — Modular WebGL Game

A hackathon-friendly Vite + React + TypeScript scaffold built for **parallel development**. Four developers (UI, 3D Games, Audio, Logic) can ship in their own folders without merge conflicts.

## Stack

- **Vite 5** + **React 18** + **TypeScript** (strict)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Zustand** (with `persist`) for global state
- **React Three Fiber** + **drei** for 3D scenes
- **Howler.js** for audio
- **lucide-react** for icons

## Getting started

```bash
npm install
npm run dev
```

From the main menu you can open **Cube demo (template)** (React Three Fiber) or **Island Run** (a Three.js island board game).

### Island Run

Island Run lives entirely inside [`src/games/IslandRun/`](src/games/IslandRun/):

```
src/games/IslandRun/
  index.tsx                 # React shell: mounts HUD DOM, injects scoped CSS/fonts, calls bootstrap()
  main.ts                   # imperative Three.js bootstrap() — owns its own WebGLRenderer
  tips.ts                   # square labels + finance tips
  post/ParadiseGradeShader.ts
  skydome/ParadiseSkydome.ts
  water/ParadiseWater.ts
  style.css                 # scoped game CSS (imported via `?inline`)
  assets/                   # every .glb / .jpg the game needs (Vite `?url` imports)
```

Because `main.ts` creates its own `WebGLRenderer`, the game is mounted OUTSIDE the host R3F `<Canvas>` (see [`src/App.tsx`](src/App.tsx)) — it is a sibling to `UIRegistry`, not a child of `GameRegistry`. Everything the game needs (source, shaders, models, textures, CSS) is self-contained in this one folder: no iframe, no separate Vite project, no `public/` output, no build sync step.

Scripts:

- `npm run build` — typecheck + production build
- `npm run preview` — preview the production build
- `npm run typecheck` — TS only
- `npm run lint` — ESLint

## Folder structure

```
src/
  core/          # Zustand store, Event Bus, generic types — the shared contract
  ui/            # 2D React/Tailwind components (HUD, menus). NEVER imports /games
  games/         # Isolated R3F mini-game modules. NEVER imports /ui
  transitions/   # Pluggable screen transitions (fade, wipe, camera swoop, ...)
  audio/         # Howler.js singleton — call from anywhere
  assets/        # /models, /textures, /sounds
```

## Communication contract

```
UI  ──emit──▶  Event Bus  ◀──emit──  Games
 │                                      │
 └────── read/write ── Zustand ── read/write ──┘
                          │
                   subscribe
                          ▼
                TransitionManager
```

- UI **never** imports from `/games`. Games **never** import from `/ui`.
- Cross-module communication goes through `@/core/events` (typed pub/sub) or `@/core/store` (Zustand).
- Audio is a singleton: `import { audio } from '@/audio/AudioManager'` then `audio.playSFX('click')`.
- `TransitionManager` owns visual hand-offs between `appState` changes; swap effects in `@/transitions/registry.ts`.

## Adding things

**Add a new 3D mini-game**

1. Create `src/games/MyGame/index.tsx` typed as `GameProps<MyInput, MyOutput>`.
2. Register it in `src/games/registry.ts` with a `ModuleId`.
3. Set `useAppStore.getState().setActiveModule('myGame')` to load it.

**Add a new UI screen**

1. Create `src/ui/screens/MyScreen.tsx` typed as `UIProps<MyData>`.
2. Register it in `src/ui/UIRegistry.tsx`.

**Add a new transition**

1. Implement `Transition` in `src/transitions/effects/MyEffect.tsx`.
2. Add it to `src/transitions/registry.ts` and call `setActiveTransition('myEffect')`.

**Add a sound**

1. Drop the file in `src/assets/sounds/`.
2. Register the ID in `src/audio/tracks.ts`.
3. Trigger anywhere with `audio.playSFX('id')` or `audio.playBGM('id')`.

## Path alias

`@/*` maps to `src/*`. Example: `import { useAppStore } from '@/core/store';`
