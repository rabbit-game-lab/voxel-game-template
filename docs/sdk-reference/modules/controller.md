<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `controller`

Import path: `@rabbit-game-lab/sdk/playcanvas-3d/controller`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/playcanvas-3d/controller.ts` (read-only)

```ts
import { createController, type ControllerState, type ControllerInput, type CameraFollowOptions, type ControllerOptions, type ControllerHandle } from '@rabbit-game-lab/sdk/playcanvas-3d/controller'
```

## Guide

```text
SDK MODULE: controller — third-person character controller (PlayCanvas).
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
your game code passes to createController(); if the module falls short,
that is a kit change, not a local edit.
Kind: playcanvas-3d — PlayCanvas entities + the kinematic physics module.

WHAT
  Walk, run, jump and a camera that follows — the movement every 3D kid game
  starts from, camera-relative (pushing "up" walks away from the camera,
  whatever way it is facing):

    const world = createPhysicsWorld({ gravity: -22, groundY: 0 })
    const hero = assets.spawn('hero')
    const control = createController({
      entity: hero, camera, world, input,
      speed: CONFIG.player.speed, jumpSpeed: CONFIG.player.jumpSpeed,
      onJump: () => sfx.tone({ freq: 520, slideTo: 900 }),
      onStateChange: (state) => assets.playAnimation(hero, state),  // idle|run|jump
    })

    update(dt) { control.update(dt) }        // one line in systems/loop.ts

TYPICAL REQUESTS → WHAT TO TOUCH
  "que corra más rápido"      → speed (m/s; 4 walks, 8 runs, 14 is fast).
  "que salte más alto"        → jumpSpeed (m/s of initial upward speed).
  "doble salto"               → maxJumps: 2.
  "que gire más suave"        → turnSpeed (degrees/s the model rotates to
                                face where it moves).
  "la cámara muy cerca"       → camera.distance / camera.height.
  "que la cámara no siga"     → omit `camera` entirely; movement stays
                                relative to the world axes.
  "vista en primera persona"  → camera.mode: 'first-person'.

INTEGRATIONS
  - Input: anything with pressed() — the keyboard module, and the touch
    module feeding it, so mobile works with no extra code.
  - Physics: the kinematic world of the physics module (gravity, ground,
    walls). No Ammo, no rigidbodies.
  - onStateChange gives you 'idle' | 'run' | 'jump' | 'fall', ready to hand
    to assets.playAnimation().

NOTES
  - update(dt) expects SECONDS (PlayCanvas Script.update gives you seconds;
    the Phaser controller takes milliseconds — different engines, different
    idiom, on purpose).
```

## Public API

Declarations shipped with the package (`dist/playcanvas-3d/controller.d.ts`).

```ts
import * as pc from 'playcanvas';
import type { PhysicsWorld } from "./physics.js";
export type ControllerState = 'idle' | 'run' | 'jump' | 'fall';
/** Minimal input surface — createKeyboard()'s handle satisfies it. */
export interface ControllerInput {
    pressed(action: string): boolean;
}
export interface CameraFollowOptions {
    entity: pc.Entity;
    /** 'third-person' (default) or 'first-person'. */
    mode?: 'third-person' | 'first-person';
    /** Distance behind the character, in metres. Default 6. */
    distance?: number;
    /** Height above the character, in metres. Default 3. */
    height?: number;
    /** 0-1 per frame smoothing; higher snaps faster. Default 0.12. */
    smoothing?: number;
}
export interface ControllerOptions {
    entity: pc.Entity;
    input: ControllerInput;
    world: PhysicsWorld;
    camera?: CameraFollowOptions;
    /** Horizontal speed in m/s. Default 6. */
    speed?: number;
    /** Initial upward speed of a jump, in m/s. Default 8. */
    jumpSpeed?: number;
    /** Jumps before touching ground again. Default 1 (2 = double jump). */
    maxJumps?: number;
    /** Degrees per second the model turns towards its movement. Default 720. */
    turnSpeed?: number;
    /** Grace period after leaving a ledge where a jump still works. Default 0.1s. */
    coyoteTime?: number;
    /** Collider size passed to the physics world. */
    radius?: number;
    height?: number;
    actions?: {
        left?: string;
        right?: string;
        up?: string;
        down?: string;
        jump?: string;
    };
    onJump?: () => void;
    onLand?: () => void;
    onStateChange?: (state: ControllerState) => void;
}
export interface ControllerHandle {
    /** Call once per frame with the delta in SECONDS. */
    update(dt: number): void;
    isGrounded(): boolean;
    state(): ControllerState;
    jump(): void;
    /** Move the character somewhere else without inheriting speed. */
    teleport(x: number, y: number, z: number): void;
    destroy(): void;
}
export declare function createController(options: ControllerOptions): ControllerHandle;
```
