# Rabbit Voxel Lab — Agent Guide

Configurable voxel sandbox on a finite deterministic island: explore procedural
forest content, break and place blocks, collect items, discover landmarks, and
optionally run beacon or collection missions. Built with **PlayCanvas
(engine-only) + Vite + TypeScript**. Terrain, water, clouds, content, and the
default avatar are procedural; an optional Quaternius GLB loads when selected.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR (`--host`, required by the platform) |
| `npm run check` | **Run after every change**: tsc + forbidden APIs + layout + file size |
| `npm run build` | Production build |

Run `npm run check` after every change and `npm run build` for boot, rendering,
asset, or architecture changes.

## File map

```text
rabbit.json               Platform manifest. DO NOT EDIT.
src/
  main.ts                 Boot + SDK wiring. DO NOT EDIT.
  game.config.ts          ⭐ Public gameplay tuning (see docs/game-config.md).
  camera/config.ts        Typed camera/avatar contract; defaults live in game.config.
  environment/config.ts   Typed environment contract; public tuning via CONFIG.environment.
  rabbit/                 Platform SDK, vendored from rabbit-game-kit. DO NOT EDIT.
    sdk.ts                Handshake, resize, safe storage (unused here), audio unlock.
    keyboard.ts           Declarative key→action input (createKeyboard).
    touch.ts              On-screen joystick + buttons (createTouch).
    gamepad.ts            Pad buttons/axes → the same actions (createGamepad).
    sound.ts              Music/SFX groups and procedural tones (createSound).
    pause.ts              Shared Studio/local pause state + overlay.
    assets.ts             GLB/texture/audio manifest helpers (createAssets).
    character.ts          Imported GLB actors (spawnCharacter / spawnObject).
    physics.ts            Kinematic helpers (unused for voxel AABB movement).
    controller.ts         Generic character controller (unused).
    players.ts / viewport.ts  Local multiplayer seats (unused in this template).
    spatial.ts            Profile spatial-v1 adapter (Studio sandbox).
  data/
    blocks.ts             Stable block IDs and face tiles. Never reorder or reuse IDs.
    assets.ts             Boot-critical atlas + conditional Quaternius hero GLB.
  voxel/                  Coordinates, chunks, generation, DDA raycast, meshing.
    coords.ts / chunk.ts / constants.ts / world.ts
    generator.ts          Deterministic terrain + guaranteed landmarks.
    mesher.ts             Opaque + liquid chunk meshes.
    raycast.ts            Block picking along the aim ray.
  environment/
    config.ts             Environment types consumed by CONFIG.environment.
    lakes.ts              Deterministic lake membership rules.
  content/                Presets, deterministic plans, archetypes, prop targeting.
  creatures/              Species catalog, aliases, preset contract, deterministic spawns.
  sim/                    Engine-agnostic fixed-step gameplay.
    types.ts              InputSnapshot, phases, session types.
    player.ts             Movement, wading, collision vs voxels (no physics engine).
    session.ts            Inventory, editing, missions, pickups, respawn.
    creatures.ts          Engine-independent behavior, movement, targeting and combat.
  entities/               PlayCanvas render layer (reads sim state, never mutates it).
    scene.ts              Lights, fog, camera entity.
    world-view.ts         Chunk entity pool, opaque + liquid meshes, remesh budget.
    camera-rig.ts         First/third-person strategies, collision, aim ray.
    player-avatar.ts      Procedural or imported avatar mirror.
    environment.ts        Sky, clouds, water, shore props factory registry.
    content.ts            Merged procedural props and collectible meshes.
    creatures.ts          Shared species meshes and one visual root per moving creature.
    effects.ts            Break/place particles.
    helpers.ts            Materials and primitive helpers.
  systems/
    loop.ts               Composition root: lifecycle, fixed step, Rabbit wiring.
    input.ts              Keyboard/touch/gamepad + DOM listeners → InputSnapshot.
    pointer-lock.ts       Canvas pointer-lock adapter (embed declared in rabbit.json).
    hud.ts                Single DOM HUD tree; touch-safe layout.
    audio.ts              Procedural SFX palette over createSound.
    config-validator.ts   Runtime validation for CONFIG invariants.
scripts/check.mjs         Local rabbit-check. DO NOT EDIT (sync-check from kit).
scripts/profile.mjs       Profile v1 resolver. DO NOT EDIT (sync-check from kit).
docs/game-config.md       Units, safe ranges, and config interactions.
public/assets/            PNG atlas and optional models actually loaded by the game.
```

## Config keys (routing)

Treat `src/game.config.ts` as the only public tuning surface. Detailed units and
ranges live in `docs/game-config.md`.

| Request | Config path |
| --- | --- |
| Title, crystals to win, fall death | `CONFIG.session` |
| Walk/jump/gravity/avatar renderer | `CONFIG.player`, `CONFIG.player.avatar` |
| Camera mode, look sensitivity, third-person distance | `CONFIG.camera` |
| Touch size, gamepad dead zone | `CONFIG.controls` |
| World size, spawn, landmarks, starting blocks | `CONFIG.world` |
| Reach, break/place cadence | `CONFIG.interaction` |
| Sky, day/night, lakes, clouds, ambience | `CONFIG.environment` |
| Forest/minimal density, colors, landmarks, collectibles | `CONFIG.content` |
| Animals, enemies, NPCs, behavior and combat | `CONFIG.creatures` |
| Iron Golem companion on/off | `CONFIG.creatures.ironGolem.enabled` |
| Sandbox/beacon/collect objective | `CONFIG.mission` |
| Block tints, selection colors | `CONFIG.visual` |
| Volumes | `CONFIG.audio` |
| Remesh budget, catch-up steps | `CONFIG.performance` |

Typed contracts: `src/camera/config.ts`, `src/environment/config.ts`. Do not
fork movement physics per camera mode.

## Where to add what

Use this as the repository's gameplay-routing map. Keep simulation rules in
engine-independent `src/sim/` and PlayCanvas rendering/lifecycle in `src/entities/`
and `src/systems/`.

1. **Tuning values** → `src/game.config.ts` first; extend `src/systems/config-validator.ts` for new invariants.
2. **New block type** → append a new stable ID in `src/data/blocks.ts` (never reuse or reorder).
3. **Terrain / landmarks** → `src/voxel/generator.ts` (keep seed determinism).
4. **Meshing / liquids** → `src/voxel/mesher.ts` and `src/entities/world-view.ts` (one entity per chunk, remesh cap).
5. **Player movement** → `src/sim/player.ts` (fixed-step, engine-independent).
6. **Break/place rules** → `src/sim/session.ts`, `src/content/interaction.ts` + `src/voxel/raycast.ts`.
7. **Camera presentation** → `src/entities/camera-rig.ts` (five-voxel traces, water/decor exclusion).
8. **Environment visuals** → factories under `src/entities/environment*.ts`; register in `environment.ts`.
9. **Trees, props, landmarks, pickups** → `src/content/` planning plus merged rendering in `src/entities/content.ts`.
10. **Controls / pointer lock** → `src/systems/input.ts` and `src/systems/pointer-lock.ts`.
11. **Creatures** → config in `game.config.ts`, species/aliases in `src/creatures/catalog.ts`, simulation in `src/sim/creatures.ts`, visuals in `src/entities/creatures.ts`.
12. **HUD copy and layout** → `src/systems/hud.ts` only.
13. **Sounds** → `src/systems/audio.ts` over the SDK `sound` module.
14. **Art** → `public/assets/` + `src/data/assets.ts`; Quaternius provenance in `THIRD_PARTY.md`.

**Before writing a system for X, check whether an SDK module already does it.**
They live in `src/rabbit/`, are never edited, and each file's header lists the
requests it solves:

| Module | Use it for |
| --- | --- |
| `keyboard` | key→action map, `pressed`/`onDown`, pause-aware |
| `gamepad` | joystick buttons/axes → the same actions |
| `touch` | on-screen joystick + buttons, feeding the same actions |
| `sound` | music/sfx groups, procedural `tone()`, mute and pause |
| `pause` | one pause state (P, a HUD button or Studio) + overlay |
| `assets` | GLB models, textures, audio files |
| `character` | an imported GLB as an actor: `play('run')` instead of clip names |
| `spatial` | Profile spatial-v1 decoration fits (pure TS, no PlayCanvas) |

Pointer lock is provided by the SDK. `src/systems/pointer-lock.ts` adapts its
lifecycle for `createInput`, including capture while the local resume screen is
paused. A host pause always prevents capture. The manifest declares the feature;
the browser and parent iframe still decide whether a request is granted.

## Rules

- **DO NOT EDIT**: `src/main.ts`, anything in `src/rabbit/` (repair with
  `node ../../tooling/rabbit-game-kit/bin/rabbit-kit.mjs sync-sdk`), `rabbit.json`,
  `scripts/check.mjs`, `scripts/profile.mjs`, `vite.config.ts`, `package.json`
  dependencies unless the platform contract itself changes.
- Keep `rabbit.json` at `audio: true`, `pointerLock: true`, `storage: false`.
- **Run `npm run check` after every change.** Fix console errors forwarded from the iframe.
- Never use `localStorage`/`sessionStorage` directly — this template does not persist; use `sdk.storage` only if that pick changes.
- Never use `pc.createScript()` — use ESM `pc.Script` classes in `systems/loop.ts`.
- No rigidbody physics engine. Voxel collision is custom AABB + DDA in `sim/` and `voxel/`.
- Keep every `src/` file **≤ 400 lines**; split near 250–300.
- World bounds stay finite; dimensions stay multiples of 16. Block `0` stays air.
- Never create one entity, collider, material, or DOM node per block.
- Keep small props and pickups in merged meshes. Use engine-independent bounds
  for break targeting and remove decorations when their supporting voxel breaks.
- Water stays non-solid, non-raycastable, replaceable, and off the hotbar.
- Pause and end states block simulation, editing, scoring, and session audio.
- Creature presets remain deterministic. Procedural species share one mesh per species; do not add rigidbodies, DOM, or listeners per creature.
- `main.ts` depends on one game-owned export: `setupGame(app)` in `systems/loop.ts`
  returning `{ restart, setMuted }`.

## Architecture

`main.ts` boots PlayCanvas, calls `setupGame(app)`, and wires the Rabbit SDK
(ready/error handshake, pause/restart/mute, resize). `systems/loop.ts` owns the
fixed-step loop: normalized input → `sim` session/player → chunk remesh budget →
environment/camera/avatar sync → HUD/audio. `sim/` and `voxel/` never import
PlayCanvas or DOM. `entities/` mirrors state read-only. Boot emits one
`rabbit:ready` after atlas, config validation, world generation, initial meshes,
scene, HUD, and input are live. Restart regenerates the default seed and resets
session state without duplicating listeners or GPU resources.

## Non-negotiable behavior

- Deterministic generation for a given `CONFIG.world.seed`; landmarks apply after noise.
- Chunks remain compact `Uint8Array(4096)` unless the user authorizes a format migration.
- Edits dirty the owner chunk and any neighbor touched at chunk boundaries.
- Camera switches reuse one camera, one avatar root, and one shadow rig.
- Third-person interaction must pass both camera-center and player-eye DDA checks.
- The procedural avatar is default; GLB selection must not change the player AABB.
- `mission.active: 'none'` must remain an open sandbox and never trigger victory.
- Respawn restores player motion/camera without rebuilding the session; restart
  remains the full deterministic regeneration boundary.
- Only the Quaternius pixel atlas is boot-critical in v1; new third-party assets need `THIRD_PARTY.md`.

## Validation

```bash
npm run check
npm run build
node ../../tooling/rabbit-game-kit/bin/rabbit-kit.mjs verify http://localhost:<port>
```

For gameplay, input, camera, environment, or lifecycle work, verify in a
GPU-backed browser: clean boot and one `rabbit:ready`; keyboard/mouse and
pointer-lock recapture after Escape; touch landscape/portrait; day/night presets; first- and
third-person modes; both avatar renderers; water wading and lake restoration;
chunk-boundary edits; pause, victory, defeat, restart (repeat restart). Record
results in `docs/acceptance-report.md` when doing formal acceptance.

## Imported characters

An imported GLB that has to *act* goes through the SDK `character` module, never
through a hand-built PlayCanvas anim state graph.

```ts
const hero = spawnCharacter(assets, 'quaterniusHero', {
  clips: ['Idle', 'Walk', 'Run', 'Jump'], // exact manifest names
})
hero.play('run')
```

- `clips` are **exact** names from the manifest (`animations: 'auto'` in `data/assets.ts`).
- `rigged: false` or missing clips → `play()` returns `false`; do not substitute clips.
- Props use `spawnObject()`. A missing boot-critical model must fail visibly (`rabbit:error`).

## How to grow this game

1. **Tune first**: numbers, colors, landmarks, and environment presets in
   `game.config.ts` before touching algorithms.
2. **New blocks**: append IDs in `blocks.ts`, add tiles, extend hotbar/inventory rules in `session.ts`.
3. **New environment feature**: add a factory implementing `update/reset/setPaused/setTimeOfDay/destroy` and register it in `entities/environment.ts`.
4. **New win condition or mode**: extend `sim/session.ts` phases and HUD in `systems/hud.ts`; keep sim free of PlayCanvas imports.
5. **New creature**: register its stable key, aliases, bounds and defaults in `creatures/catalog.ts`, reuse/add a procedural archetype, then expose it only through `CONFIG.creatures`.
6. **Performance**: respect `CONFIG.performance.maxChunkRebuildsPerFrame`; pool fragments and reuse chunk entities.
7. **Kit updates**: after pulling kit changes, run `sync-sdk` and `sync-check` from `rabbit-game-kit`; never patch vendored files by hand.

## SDK 0.8 integration

Read [docs/rabbit-sdk.md](docs/rabbit-sdk.md) for shared lifecycle, required/optional assets, pointer lock and character switching. `.rabbit-kit.json` records the exact source commit and file hashes. Run `rabbit-kit status --check` from a matching kit checkout; `npm run check` also checks the recorded integrity. Do not edit vendored files or their receipt.

## Switching the playable character

For a GLB actor, keep the `CharacterHandle` returned by `spawnCharacter(assets, key, options)` and switch through it: `await hero.switchCharacter('loaded-model-key', { clips: ['Idle', 'Run'] })` uses a model already loaded by the manifest; `{ key: 'visitor', path: '/models/visitor.glb', animations: 'auto' }` loads another asset. External hosts must allow CORS. `clips` are exact clip names in the target file; `animations: 'auto'` lets the SDK map them to semantic states. The wrapper entity, components and physics remain stable, and the current semantic state is replayed on the new visual. Visual `scale`/`rotation` do not resize the collider; failed or superseded requests keep the current model. Use `rigged: false` for a static model. The SDK does not retarget unrelated skeletons.
