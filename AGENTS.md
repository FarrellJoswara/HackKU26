# AGENTS.md — Operating Manual for AI Agents

> Read this file in full before editing the codebase. It is the source of truth for *how* to extend this scaffold without breaking the parallel-development contract.

This is a **modular WebGL/React hackathon game** built on Vite + React 18 + TypeScript + Tailwind v4 + Zustand + React Three Fiber + Howler. Four humans work in parallel: **UI**, **3D Games**, **Audio**, **Logic**. Your job as an agent is to keep their lanes clean.

---

## 1. Hard architectural rules (NEVER violate)

These rules exist so four people can ship in parallel without merge conflicts. Breaking any one of them constitutes a regression even if the code "works".

1. **`src/ui/**` MUST NOT import from `src/games/**`** (except `src/games/registry.ts` for `GAME_IDS` / `ModuleId` constants).
2. **`src/games/**` MUST NOT import from `src/ui/**`** — ever. Games are headless 3D scenes; the UI floats above them.
3. **Cross-module communication goes through `@/core/events` (Event Bus) or `@/core/store` (Zustand) — never via direct imports.** If two modules need to talk, add an entry to `EventMap` in `src/core/types.ts`.
4. **Only `TransitionManager` mutates `appState` / `activeModule` for user-visible navigation.** Trigger navigation by emitting `eventBus.emit('navigate:request', { to, module })`. Direct `setAppState` calls are reserved for boot/debug.
5. **Audio is a singleton.** Always `import { audio } from '@/audio/AudioManager'`. Never instantiate `Howl` directly outside `AudioManager.ts` / `tracks.ts`.
6. **Strict TypeScript, strict generics.** No `any` in public APIs. Use the generic params on `GameProps<TInput, TOutput>` and `UIProps<TData>`. `any` is permitted *only* inside registry maps where the host is type-erasing across heterogeneous modules (already done).
7. **Path alias `@/*` → `src/*`.** Use it. Do not write `../../../core/store`.
8. **Never edit another team's files to "fix" your build.** If you need a new event, add it to `EventMap`. If you need a new piece of state, add it to `playerData`. If you need a new screen, add a new file — don't shoehorn into someone else's.

---

## 2. Mental model (the only diagram you need)

```
                     ┌─────────────────────────────┐
                     │         User Input          │
                     └──────────────┬──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
 ┌──────────────┐          ┌──────────────┐          ┌──────────────────┐
 │  UIRegistry  │  events  │  Event Bus   │  events  │   GameRegistry   │
 │   (DOM)      │◀────────▶│ (typed P/S)  │◀────────▶│   (R3F Canvas)   │
 └──────┬───────┘          └──────┬───────┘          └─────────┬────────┘
        │                         │                            │
        │       read/write        ▼          read/write        │
        └───────────────▶ ┌──────────────┐ ◀────────────────────┘
                          │ Zustand store│
                          │  (persisted) │
                          └──────┬───────┘
                                 │ subscribe
                                 ▼
                       ┌──────────────────┐
                       │TransitionManager │ ── owns visual hand-offs
                       └──────────────────┘

         AudioManager (singleton) — callable from anywhere
```

Two physically-stacked layers in `src/App.tsx`:

- A `<Canvas>` containing `GameRegistry` (3D, lazy-loaded games).
- A sibling DOM div containing `UIRegistry` (Tailwind screens, HUD).

They never know about each other. They share state via `core`.

---

## 3. The folder map and what lives where

| Folder | Owner | What goes here | What does NOT go here |
|---|---|---|---|
| `src/core/` | Logic dev | Types, Zustand store, Event Bus, generic interfaces. The shared contract. | React components, 3D code, audio code |
| `src/ui/` | UI dev | DOM React components, Tailwind, lucide-react icons, screens, HUD | `<Canvas>`, R3F primitives (`<mesh>`, `useFrame`), Three.js imports |
| `src/games/` | 3D dev | R3F scenes, `useFrame`, shaders, drei helpers, per-game logic | DOM elements (`<div>`), Tailwind classes, UI components |
| `src/transitions/` | Logic / UI dev | `Transition` strategy implementations and the manager | Game-specific code |
| `src/audio/` | Audio dev | `AudioManager` (singleton), track registration, audio React hook | Anything calling `new Howl()` outside this folder |
| `src/assets/` | All | `models/`, `textures/`, `sounds/` — referenced via Vite `?url` imports | Source code |

---

## 4. Cookbook — common tasks

### 4.1 Add a new 3D mini-game

1. **Scaffold:**
   ```
   src/games/MyGame/
     ├── index.tsx        // default export, typed GameProps<MyInput, MyOutput>
     └── types.ts         // export interface MyInput { ... }; MyOutput { ... }
   ```
2. Make `index.tsx` start as a copy of `src/games/TemplateGame/index.tsx`. Replace the scene contents. Do NOT render a `<Canvas>` here — you are *inside* one.
3. **Register** the new module in `src/games/registry.ts`:
   ```ts
   export const GAME_IDS = {
     template: moduleId('template'),
     myGame:   moduleId('myGame'),   // <— add
   } as const;

   export const GAME_MODULES: Record<ModuleId, LazyGame> = {
     [GAME_IDS.template]: lazy(() => import('./TemplateGame')),
     [GAME_IDS.myGame]:   lazy(() => import('./MyGame')),   // <— add
   };
   ```
4. **Trigger it from anywhere** (UI button, event handler, debug):
   ```ts
   eventBus.emit('navigate:request', { to: 'game', module: GAME_IDS.myGame });
   ```
5. **Emit results** when the game ends:
   ```ts
   eventBus.emit('game:result', { kind: 'result', payload: out });
   ```
   The UI/audio/analytics layers can subscribe without ever importing your game.

### 4.2 Add a new UI screen

1. Create `src/ui/screens/MyScreen.tsx`. Default export. Type props as `UIProps<MyData>`.
2. Decide where it slots in:
   - **Per `AppState`** (boot/menu/etc.) → add to `SCREENS` map in `src/ui/UIRegistry.tsx`.
   - **Per active game module** (in-game overlay/pause menu) → add to `MODULE_SCREENS` map in `src/ui/UIRegistry.tsx`.
3. Compose primitives from `src/ui/components/`. Add new shared primitives to that folder.
4. Use lucide-react icons. Use Tailwind classes. **No Three.js imports.**

### 4.3 Add a new transition effect

1. Implement the `Transition` interface from `src/transitions/types.ts`:
   ```ts
   export const WipeTransition: Transition = {
     id: 'wipe',
     async play(opts, commit) {
       // 1. animate IN
       commit();           // <— call EXACTLY ONCE when screen is masked
       // 2. animate OUT
     },
   };
   ```
2. Register it in `src/transitions/registry.ts`:
   ```ts
   export const TRANSITIONS: Record<string, Transition> = {
     [FadeTransition.id]: FadeTransition,
     [WipeTransition.id]: WipeTransition,   // <— add
   };
   ```
3. Switch effects globally:
   ```ts
   import { setActiveTransition } from '@/transitions/registry';
   setActiveTransition('wipe');
   ```

### 4.4 Add a sound

1. Drop the file in `src/assets/sounds/`.
2. Register it in `src/audio/tracks.ts`:
   ```ts
   import clickSfx from '@/assets/sounds/click.mp3?url';
   audio.registerSFX('click', { src: clickSfx, volume: 0.7 });
   ```
3. Trigger it from anywhere:
   ```ts
   import { audio } from '@/audio/AudioManager';
   audio.playSFX('click');
   audio.playBGM('theme');
   ```

### 4.5 Add a new cross-module event

1. Add the event to `EventMap` in `src/core/types.ts`:
   ```ts
   export interface EventMap {
     // ...
     'player:hit': { damage: number; sourceId?: string };
   }
   ```
2. Emit and subscribe with full type safety — no further wiring needed:
   ```ts
   eventBus.emit('player:hit', { damage: 10 });

   // in a React component:
   useEventBus('player:hit', ({ damage }) => { /* ... */ });
   ```

### 4.6 Add new persisted player data

1. Just write to it. It's `Record<string, unknown>` by design:
   ```ts
   useAppStore.getState().mergePlayerData({ score: 42, level: 3 });
   ```
2. Read it back with type narrowing at the use site:
   ```ts
   const score = useAppStore((s) => (s.playerData.score as number | undefined) ?? 0);
   ```
3. If a field becomes "official" and shared across modules, promote it: add a typed selector in `src/core/store.ts` rather than mutating `AppStoreState` (which would break the partialize contract). Or add a typed wrapper in your own module's file.

---

## 5. Decision tree — "where should this code live?"

```
Is it a React component?
├── No  → it's a service/util:
│        ├── Used everywhere? .................... src/core/ (or a new /services dir)
│        ├── Audio? .............................. src/audio/
│        └── A Transition strategy? .............. src/transitions/effects/
│
└── Yes → does it render anything 3D (mesh, useFrame, drei)?
         ├── Yes → src/games/<GameName>/
         └── No  → src/ui/ (screens / hud / components)
```

Need to share data between two of those? **Add to `EventMap` or `playerData`.** Do not import across the boundary.

---

## 6. Tech-stack quirks worth remembering

- **Tailwind v4** uses `@import "tailwindcss";` in `src/index.css`. There is **no `tailwind.config.js`** and no `@tailwind base/components/utilities` directives. Configure in CSS via `@theme` if needed.
- **R3F primitives are lowercase JSX** (`<mesh>`, `<ambientLight>`) — they're not React components, so they don't show in IntelliSense. Refer to three.js docs.
- **Howler requires user gesture** before audio plays in most browsers. The first `audio.playBGM()` after a click usually works; firing one in `useEffect` on page load may be silently blocked.
- **Zustand + `persist`** rehydrates on boot. The store starts with the persisted `playerData` but `appState` always starts as `'boot'` (we `partialize`).
- **Strict TS** is on with `noUncheckedIndexedAccess`. Map lookups return `T | undefined` — handle the `undefined`.
- **`StrictMode` is enabled** → effects run twice in dev. Make subscribers idempotent (the Event Bus already returns an unsubscribe function from `on`).

---

## 7. Coding conventions

- **TypeScript:** strict. Prefer `interface` for object shapes, `type` for unions/aliases.
- **Imports:** absolute via `@/...`. No deep relative paths.
- **React:** function components, default exports for screens/games (lazy-loaded), named exports for utilities.
- **Tailwind:** prefer composing utility classes inline; extract to `src/ui/components/` when reused 3+ times.
- **Comments:** explain *why*, not *what*. Mark TODOs with `// TODO:` so devs and agents can grep.
- **Files:** one component per file. PascalCase for components, camelCase for utilities, kebab-case for asset filenames.

---

## 8. What you (the agent) should NOT do

- Do not add a new state-management library (Redux, Jotai, etc.). Use Zustand.
- Do not add a router (React Router, TanStack Router). Navigation is `appState` + `activeModule` + Event Bus.
- Do not add CSS-in-JS (styled-components, emotion). Use Tailwind.
- Do not pin dependency versions speculatively — current `package.json` versions were chosen carefully; ask before changing them.
- Do not edit `vite.config.ts` / `tsconfig.json` / `.eslintrc.cjs` unless explicitly asked.
- Do not delete or rename TODO comments without implementing them.
- Do not introduce circular imports between `core` ↔ anything. `core` depends on **nothing** internal.

---

## 9. When in doubt

1. Reread the **Hard architectural rules** in §1.
2. Read the existing file most similar to what you want to add (TemplateGame, MainMenu, FadeTransition).
3. If a request seems to require violating a rule, **stop and ask the user** which rule they want relaxed and why.

The whole point of this scaffold is that adding a feature should touch *one* folder plus *one* registry line. If your change spans more than that, you're probably doing it wrong — re-plan.
