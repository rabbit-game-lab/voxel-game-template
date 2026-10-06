<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# Rabbit SDK reference — playcanvas-3d

`@rabbit-game-lab/sdk@1.1.0` is installed in `node_modules`, which you may not
be able to read or search. This folder is its committed reference: read the
module page before writing input, audio, pause, assets, physics, character or
camera code yourself. Rebuilding what a module already does is the most
common wasted turn.

## Rules

- Import the modules; never copy, fork or patch them (including files under `node_modules`).
- Tune them through the options your game code passes, ideally sourced from `src/game.config.ts`.
- If a module falls short, build on top of it as game code (a wrapper in `src/systems/`)
  and report the missing capability so it can be added to `rabbit-game-kit` for every template.
- Module guides were written for the older vendored layout: read `../rabbit/sdk` or
  `src/rabbit/<module>` as the package import paths listed below.
- Do not edit this folder. After an SDK upgrade run `npx rabbit-kit sync-docs`.

## Modules

| Module | Import | What it is for |
| --- | --- | --- |
| [`sdk`](modules/sdk.md) | `@rabbit-game-lab/sdk` | Rabbit iframe contract. |
| [`asset-source`](modules/asset-source.md) | `@rabbit-game-lab/sdk/common/asset-source` | Validated asset locations and bounded asynchronous work, shared by both stacks. |
| [`gamepad`](modules/gamepad.md) | `@rabbit-game-lab/sdk/common/gamepad` | Declarative button/axis→action map for joysticks. |
| [`keyboard`](modules/keyboard.md) | `@rabbit-game-lab/sdk/common/keyboard` | Declarative key→action input map. |
| [`pause`](modules/pause.md) | `@rabbit-game-lab/sdk/common/pause` | One pause state for Studio, the player and the game. |
| [`players`](modules/players.md) | `@rabbit-game-lab/sdk/common/players` | Local multiplayer seats (same screen, same keyboard). |
| [`pointer-lock`](modules/pointer-lock.md) | `@rabbit-game-lab/sdk/common/pointer-lock` | Pointer lock: look only while locked; Escape (browser) or release()/host pause unlocks. |
| [`runtime`](modules/runtime.md) | `@rabbit-game-lab/sdk/common/runtime` | Canonical shared lifecycle. |
| [`sound`](modules/sound.md) | `@rabbit-game-lab/sdk/common/sound` | Music/sfx groups over WebAudio. |
| [`spatial`](modules/spatial.md) | `@rabbit-game-lab/sdk/common/spatial` | Bounded, engine-free decoration placement. |
| [`touch`](modules/touch.md) | `@rabbit-game-lab/sdk/common/touch` | On-screen joystick + buttons for phones. |
| [`animation-clips`](modules/animation-clips.md) | `@rabbit-game-lab/sdk/playcanvas-3d/animation-clips` | Pure animation discovery and semantic matching, shared by assets/character. |
| [`assets`](modules/assets.md) | `@rabbit-game-lab/sdk/playcanvas-3d/assets` | GLB, texture and audio assets. |
| [`character`](modules/character.md) | `@rabbit-game-lab/sdk/playcanvas-3d/character` | Imported GLB actors with automatic animation discovery. |
| [`controller`](modules/controller.md) | `@rabbit-game-lab/sdk/playcanvas-3d/controller` | Third-person character controller (PlayCanvas). |
| [`physics`](modules/physics.md) | `@rabbit-game-lab/sdk/playcanvas-3d/physics` | Kinematic movement, ground and collisions (PlayCanvas). |
| [`viewport`](modules/viewport.md) | `@rabbit-game-lab/sdk/playcanvas-3d/viewport` | Split-screen for local multiplayer (PlayCanvas). |

## Guides

- [runtime-and-character.md](guides/runtime-and-character.md)
- [glb-animation-discovery.md](guides/glb-animation-discovery.md)
