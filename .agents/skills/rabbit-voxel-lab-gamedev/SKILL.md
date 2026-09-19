---
name: rabbit-voxel-lab-gamedev
description: Extend, tune, debug, or review the Rabbit Voxel Lab PlayCanvas template. Use for block registries, deterministic terrain, content presets, trees, landmarks, pickups, sandbox or mission rules, chunk meshing, voxel collision and DDA, cameras, avatars, controls, environment, HUD, audio, Rabbit lifecycle, performance, or acceptance testing in this repository.
---

# Rabbit Voxel Lab Gamedev

Maintain the reusable Rabbit voxel template without breaking deterministic generation, compact chunk storage, fixed-step simulation, or the iframe lifecycle.

## Start here

1. Read `AGENTS.md`, `docs/implementation-brief.md`, and the relevant source subsystem.
2. Treat `src/game.config.ts` as the public tuning surface.
3. Treat `src/rabbit/`, `scripts/check.mjs`, `rabbit.json`, block IDs, `CHUNK_SIZE`, and fixed-step timing as protected contracts.
4. Make the smallest cross-layer change that fully implements the request.
5. Run `npm run check`, `npm run build`, and the Rabbit audit.

## Route the change

- Tune numbers, colors, spawn or landmarks in `src/game.config.ts`; extend `src/systems/config-validator.ts` for new invariants.
- Tune sky, clouds, lakes, shore density, particles or ambience only through `CONFIG.environment`. Keep the public types in `src/environment/config.ts`, deterministic lake membership in `src/environment/lakes.ts`, and PlayCanvas factories in `src/entities/environment.ts`.
- Tune trees, ground decoration, landmarks, discoveries and pickups through `CONFIG.content`. Keep public types in `src/content/config.ts`, deterministic placements in `src/content/planner.ts`, editable structures in `src/content/voxel-features.ts`, and merged render resources in `src/entities/content.ts`.
- Tune animals, enemies, characters, behavior and combat through `CONFIG.creatures`. Keep stable species and aliases in `src/creatures/catalog.ts`, deterministic spawns in `src/creatures/planner.ts`, fixed-step behavior/targeting in `src/sim/creatures.ts`, and shared procedural species meshes in `src/entities/creatures.ts`.
- Tune the active objective through `CONFIG.mission`. `none` is open sandbox, `beacon` conditionally generates sockets/crystals, and `collect` guarantees enough target pickups. Keep mission evaluation engine-independent.
- Handle “make it night/day” by changing `environment.sky.initialMode` or the existing `day/night` presets. Use `showToggleButton` only to expose/hide the temporary ☾/☀ control; preserve the shared runtime controller in scene, environment and world view.
- Handle “make it first/third person” through `CONFIG.camera`. Keep strategy logic in `src/entities/camera-rig.ts`, the real camera-center ray in `AimRay`, and third-person visibility/reach verification in `src/sim/session.ts`. Do not create separate player movement implementations.
- Tune the visible character through `CONFIG.player.avatar`. Keep renderer factories in `src/entities/player-avatar.ts`; procedural geometry and imported GLB animation remain render-only mirrors of the same player AABB.
- For the Quaternius backend, preserve conditional boot registration in `src/data/assets.ts`, exact required clip mappings and provenance in `THIRD_PARTY.md`. A selected missing/invalid model must reject boot visibly.
- Add a block in `src/data/blocks.ts`. Append a new stable numeric ID; never reorder or reuse an existing ID. Define all face tiles and inventory behavior.
- Change generation in `src/voxel/generator.ts`. Preserve seed determinism and apply guaranteed landmarks after noise terrain.
- Content generation returns one deterministic `WorldContentPlan`: apply voxel archetypes before initial chunk meshing and construct merged visual categories from the same plan.
- Change storage or coordinates in `src/voxel/chunk.ts`, `coords.ts`, and `world.ts`. Preserve allocation-free reads and Euclidean negative-coordinate handling.
- Change geometry in `src/voxel/mesher.ts` and `src/entities/world-view.ts`. Keep one entity per chunk, one opaque and one liquid mesh, shared materials, cross-chunk culling, neighbor invalidation, and the two-remesh-per-frame cap.
- Change movement in `src/sim/player.ts`; keep it engine-independent and fixed-step. Do not add per-block colliders or a physics dependency.
- Change camera presentation/collision in `src/entities/camera-rig.ts`; keep five voxel traces, immediate obstacle contraction, smooth recovery and water/decor exclusion.
- Change interaction in `src/voxel/raycast.ts`, `src/content/interaction.ts`, and `src/sim/session.ts`; preserve bounds checks, nearest voxel/decoration targeting, player-overlap rejection, atomic inventory edits, and one-shot victory.
- Change device controls in `src/systems/input.ts`; expose only normalized `InputSnapshot` to simulation and clear state on blur, cancel, pause, disconnect, and end states.
- Change DOM only in `src/systems/hud.ts`; keep one HUD tree, touch-safe layout, and change-driven updates.
- Compose lifecycle only in `src/systems/loop.ts`; `ready` waits for boot-critical atlas, config, world, meshes, scene, HUD and input. Restart reuses engine resources and `destroy()` remains idempotent.

## Non-negotiable behavior

- World bounds remain finite and dimensions remain multiples of 16.
- Block `0` remains air and chunks remain `Uint8Array(4096)` unless the user explicitly authorizes a format migration.
- Never create one entity, collider, material or DOM node per block.
- Water remains non-solid, non-raycastable, replaceable and absent from the hotbar. Breaking a placed block in a natural lake cell restores water without propagation.
- Clouds and procedural props remain merged by layer/category. Environment features implement `update/reset/setPaused/setTimeOfDay/destroy/stats` and are registered through the internal factory list.
- Breakable decorations use an active bitset and rebuild only merged content meshes after edits. They never gain per-instance entities or colliders, and removing their supporting voxel removes them from interaction and rendering.
- Procedural content uses at most six additional draw calls. Collectibles use one active bitset and rebuild only their category mesh on pickup.
- Creature presets stay deterministic. Built-in procedural species create one shared mesh per active species and at most one draw call per active moving creature; never attach rigidbodies, DOM, or listeners per creature.
- Day/night switches reuse both prebuilt domes and celestial bodies, one merged star mesh and shared terrain/cloud materials. Do not rebuild chunks or recreate resources when toggling.
- Camera switches reuse one camera, one configured avatar and one shadow. FPS hides the avatar completely; third-person movement remains camera-relative and interaction must pass both camera and player-eye DDA checks.
- Restart restores `camera.initialMode`, seed, active preset, pickups and discoveries; respawn obeys `session.respawn` without duplicating or reconstructing engine resources.
- Edits dirty the owner chunk plus neighbors touched at chunk boundaries.
- Pause and end states block simulation, editing, scoring and session audio.
- Restart regenerates seed `1337` and resets world, content plan, mission, inventory, player and HUD without duplicating resources or listeners.
- Use only the Quaternius pixel atlas in v1. New third-party assets require provenance in `THIRD_PARTY.md` and must load after `ready` unless boot-critical.
- Keep each `src/` file below 400 lines and split before roughly 300.

## Verification matrix

After every change run:

```bash
npm run check
npm run build
node ~/.codex/skills/create-rabbit-playcanvas-game/scripts/audit-template.mjs .
```

For gameplay or lifecycle changes also verify:

- clean boot and one `rabbit:ready` in an opaque-origin iframe;
- keyboard/mouse and pointer-lock fallback;
- touch-sized landscape and portrait layout;
- deterministic lake/cloud/decoration layout plus individual environment toggles;
- deterministic forest/minimal content plan, sandbox/beacon/collect mission boot, pickups, discoveries and fall respawn;
- empty/peacefulForest/forestAdventure creature presets, friendly targeting, hostile damage, defeat, water avoidance, pause and restart;
- both day/night presets, initial night boot, hidden toggle config and restart-to-initial-mode;
- both camera modes, camera collision/recovery, aligned crosshair, initial third-person boot, hidden/disabled selector, V/Y/touch switching and restart-to-initial-mode;
- both avatar renderers and required GLB clips; FPS must contribute zero visible avatar draw calls;
- water DDA pass-through, wading, displacement/restoration and a cross-chunk liquid edit;
- block edits at an ordinary voxel and a chunk boundary;
- pause, victory, defeat, restart, and repeated restart;
- missing boot asset produces a visible error and no ready event.

Record observed results and untested hardware paths in `docs/acceptance-report.md`. Do not claim physical mobile or gamepad acceptance from browser emulation alone.
