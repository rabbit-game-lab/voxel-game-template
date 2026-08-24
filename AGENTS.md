# Rabbit Voxel Lab

## Protected contract

Do not edit `src/rabbit/`, `scripts/check.mjs`, `rabbit.json`, or the dependency set unless the user explicitly requests a platform-contract change. Keep `rabbit.json` at `audio: true`, `pointerLock: true`, and `storage: false`.

## Architecture

- `src/game.config.ts` is the only gameplay tuning surface.
- `src/data/blocks.ts` owns stable block IDs. Never reorder or reuse IDs.
- `src/voxel/` owns coordinates, chunks, generation, DDA and meshing.
- `src/environment/` owns typed environment contracts and deterministic lake rules.
- `src/sim/` is engine-independent gameplay and fixed-step player simulation.
- `src/entities/environment.ts` owns modular PlayCanvas environment factories; add features there without coupling them to the game loop.
- `src/entities/world-view.ts` owns both opaque and liquid chunk meshes.
- `src/systems/loop.ts` is the composition root and Rabbit lifecycle owner.
- Keep every `src/` file below 400 lines; split near 250–300 lines.
- Keep all public environment tuning in `CONFIG.environment`; algorithms, render resources and lifecycle remain internal.
- Route “make it night/day” requests through `environment.sky.initialMode` and the existing `day/night` presets. Hide the temporary UI with `showToggleButton`; do not build a parallel time-of-day system.

## Required gates

Run `npm run check`, `npm run build`, and the Rabbit audit after changes. Test both keyboard/mouse and touch-sized viewports for changes to input, HUD, camera, interaction, pause or lifecycle.
