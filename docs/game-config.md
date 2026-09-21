# Game configuration

`src/game.config.ts` is the only tuning surface. Validation occurs before assets are loaded or entities are created; an invalid combination displays a visible error and never announces `rabbit:ready`.

## Session and player

- `session.fallY` is the fall limit, and `fallBehavior` accepts `respawn` or `defeat`.
- `session.respawn` determines whether a fall preserves block inventory, collectibles, and voxel edits. The default preserves all three.
- Body dimensions are measured in meters. `eyeHeight` must remain inside the body.
- Speeds use m/s; acceleration and gravity use m/s².
- `coyoteTime` is expressed in seconds.

## Camera and controls

- `camera.initialMode` accepts `first-person` or `third-person`. It is the minimal recipe for changing the initial view and the view restored by restart.
- `camera.switching.enabled` enables switching during gameplay; `showButton` only shows or hides the HUD control. The system remains available through `GameHandle.setCameraMode()` when the UI is hidden.
- Each strategy has its own `fov` and `pitchRange`, expressed in degrees. `clipping.near/far` is shared.
- In third person, `distance` and `height` define the camera boom; `collisionRadius`, `collisionPadding`, `minDistance`, and `returnSpeed` control collision and recovery. The camera center produces the crosshair's actual ray.
- Mouse and touch sensitivities are measured in degrees per pixel; `padLookSpeed` uses degrees per second.
- `gamepadDeadZone` belongs to `[0, 1)`.
- Desktop mouse look uses pointer lock. Start, Continue, and canvas clicks request capture from a user gesture. Escape unlocks the mouse and does not pause; `P` (and the HUD button) pause. After Escape, the next click recaptures. There is no hover-look, drag-look, or capture-denied chip — the camera must not pan while the cursor is free.
- Rabbit's embedding iframe must send `allow="autoplay; pointer-lock; fullscreen; gamepad"` and, when sandboxed, `allow-pointer-lock`. Missing parent tokens are a Studio bug, not a reason to ship hover-look.
- Touch and gamepad do not require pointer lock.
- Studio resume does not bypass the local Continue/capture step.
- `V`, the HUD button, and gamepad `Y` switch views when switching is enabled.

## Avatar

- `player.avatar.renderer` accepts `procedural` or `gltf`. It does not change the AABB, physics, or simulation.
- `procedural` controls proportions, colors, and idle, walk, and run animation frequency and amplitude; it uses reusable materials and entities.
- `gltf.assetKey` must exist in the conditional manifest in `src/data/assets.ts`. The included backend loads `quaterniusHero` and requires `Idle`, `Walk`, `Run`, `Jump`, `Jump_Idle`, and `Jump_Land`.
- `scale`, `yOffset`, and `rotationY` correct GLB authoring differences; `blendTime` controls transitions.
- `turnSpeed` rotates the avatar toward movement or toward a successful edit for `actionFacingTime`.
- The shadow is visual and adds no collider. The avatar and shadow render only in third person.

## World

- `world.min` and `world.size` define bounds `[min, min + size)`.
- Each dimension must be a positive multiple of 16.
- Spawn, sockets, and crystals must be unique and inside the bounds. The default world is `64×32×64` and creates 32 chunks.
- The seed controls terrain, zones, placements, and variants. The voxel content plan is applied before initial meshing.
- `startingInventory` accepts only block keys from the registry and non-negative integers.

## Content and missions

- `content.preset` accepts `forest` or `minimal`; each preset is complete and does not inherit from the other.
- Trees, densities, colors, scales, zones, landmarks, collectibles, and discoveries live in `CONFIG.content`.
- `content.interaction.breakableDecorations` enables center-ray targeting for merged props. `removeUnsupportedDecorations` removes a prop when its supporting voxel becomes non-solid.
- Content limits are validated before entities are created. The renderer uses at most five of the six budgeted draw calls.
- `mission.active` accepts `none`, `beacon`, or `collect`. `none` hides the objective and never ends the sandbox.
- `beacon` generates the beacon, sockets, and crystal nodes only when active. Its quantity must match the world arrays.
- `collect` guarantees enough units of the configured `item` even when the preset contains fewer.
- `onComplete` accepts `victory` or `continue`.

AI recipes are available in [`content-config.md`](content-config.md).

## Creatures

- `creatures.preset` accepts `empty`, `peacefulForest`, or `forestAdventure`.
- Preset groups select a catalog species, count, zones, optional behavior override, scale, spacing, and roam radius.
- `combat` controls whether hostile behavior can damage the player, whether friendly animals are damageable, health, damage, and cooldowns.
- `simulation.decisionHz` throttles AI decisions while fixed-step movement remains at 60 Hz. `sleepDistance` pauses distant creatures.
- `limits` caps total creatures, enemies, and draw calls before boot.

Catalog keys, aliases, AI recipes, and the missing-species workflow are documented in [`creature-catalog.md`](creature-catalog.md) and [`creature-config.md`](creature-config.md).

## Environment

- `environment.sky.initialMode` accepts `day` or `night`. Changing it is the minimal recipe for making the game start during the day or at night.
- `environment.sky.showToggleButton` shows or hides the moon/sun selector without removing the presets or runtime controller.
- `environment.sky.presets.day/night` coordinates the dome, celestial body, lighting, fog, clouds, terrain, and water. In each preset, `fogStart` must be smaller than `fogEnd`.
- `environment.sky.stars` controls one nighttime mesh containing up to 96 stars; it is generated once and enabled only at night.
- `environment.clouds.layers` supports up to 16 total clouds. Each layer defines its count, altitude, speed, and scale range.
- `environment.water.lakes` supports multiple deterministic lakes. The center uses `[x, waterBlockY, z]`; the radii and shore must fit completely inside the world without overlapping the spawn, beacon, or crystals.
- `surfaceInset` moves the top face inside the block to prevent z-fighting. `wadeSpeedMultiplier` affects only horizontal speed while the player's feet are in water.
- Atmospheric particles are visual. Reeds and rocks now belong to `CONFIG.content` with the other props.
- Environment limits: 16 clouds and 24 particles.
- `environment.ambience` controls procedural bursts; intervals are `[minimum, maximum]` ranges in seconds.

Safe editing recipes and presets are available in [`environment-config.md`](environment-config.md).

## Visuals, audio, and performance

- Colors are CSS hex strings accepted by PlayCanvas.
- `visual` contains only face, selection, and socket tints; the sky, lighting, and fog live in `environment.sky`.
- Volumes belong to `[0, 1]`.
- `maxChunkRebuildsPerFrame` limits editing spikes; boot always builds all 32 chunks.
- `fragmentPoolSize` is fixed and does not grow during the session.
- `maxCatchupSteps` limits catch-up for the fixed 60 Hz simulation.

The following are intentionally not configurable: chunk size, fixed time step, array layout, generation, meshing, collision, DDA and camera algorithms, asset paths and filters, and the Rabbit lifecycle.
