<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `physics`

Import path: `@rabbit-game-lab/sdk/playcanvas-3d/physics`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/playcanvas-3d/physics.ts` (read-only)

```ts
import { createPhysicsWorld, type BoxShape, type KinematicOptions, type KinematicBody, type PhysicsWorldOptions, type PhysicsWorld } from '@rabbit-game-lab/sdk/playcanvas-3d/physics'
```

## Guide

```text
SDK MODULE: physics — kinematic movement, ground and collisions (PlayCanvas).
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
your game code passes; if the module falls short, that is a kit change.
Kind: playcanvas-3d — PlayCanvas math and entities.

WHAT
  Gravity, ground and "did these two things touch" WITHOUT a physics engine.
  The base template ships no Ammo build on purpose (`npm ci` must stay tiny
  and boots fast), and kid-game requests — walk, jump, pick up coins, don't
  walk through walls — are all covered by boxes and spheres:

    const world = createPhysicsWorld({ gravity: -22, groundY: 0 })
    world.addStatic(wallEntity, { size: [4, 3, 0.5] })       // solid box
    const player = world.addKinematic(heroEntity, { radius: 0.4, height: 1.7 })

    // in update(dt):
    player.move(velocityX, velocityZ, dt)      // gravity + collisions applied
    if (player.grounded) { ... }

    world.onOverlap(heroEntity, coinEntity, () => coin.destroy())

TYPICAL REQUESTS → WHAT TO TOUCH
  "que caiga más rápido"      → gravity (negative = down; -22 feels arcade-y,
                                -9.8 is realistic and reads as floaty).
  "que no atraviese paredes"  → addStatic() on the wall. Without it, nothing
                                stops the player.
  "que junte monedas"         → onOverlap() (or overlaps() polled in update).
  "que el piso tenga altura"  → groundY, or a static box as a platform.
  "quiero física de verdad"   → that means vendoring Ammo and rebuilding the
                                template around rigidbodies: a kit change,
                                not a local one. Ask before promising it.

NOTES
  - Collisions are axis-aligned boxes (AABB) and spheres. Rotated colliders
    are approximated by their bounding box — good enough for these games.
  - Resolution is per-axis sliding: you walk along a wall instead of sticking.
  - This module never renders anything: shapes are invisible, attached to the
    entity you pass.
```

## Public API

Declarations shipped with the package (`dist/playcanvas-3d/physics.d.ts`).

```ts
import * as pc from 'playcanvas';
export interface BoxShape {
    /** Full size in metres [x, y, z]. */
    size: readonly [number, number, number];
    /** Offset from the entity origin, in metres. */
    offset?: readonly [number, number, number];
}
export interface KinematicOptions {
    /** Capsule radius in metres. Default 0.4. */
    radius?: number;
    /** Total height in metres. Default 1.8. */
    height?: number;
    /** Max height the body climbs without jumping (kerbs, stairs). Default 0.35. */
    stepHeight?: number;
}
export interface KinematicBody {
    entity: pc.Entity;
    /** True while standing on the ground plane or a static box. */
    grounded: boolean;
    /** Vertical speed in m/s (negative = falling). Set it to jump. */
    velocityY: number;
    /** Applies horizontal speed + gravity + collisions for this frame. */
    move(velocityX: number, velocityZ: number, dt: number): void;
    /** Teleport without inheriting speed. */
    teleport(x: number, y: number, z: number): void;
    destroy(): void;
}
export interface PhysicsWorldOptions {
    /** Vertical acceleration in m/s². Negative is down. Default -22. */
    gravity?: number;
    /** Height of the infinite ground plane. Pass null for no ground. Default 0. */
    groundY?: number | null;
    /** Terminal fall speed in m/s. Default 45. */
    maxFallSpeed?: number;
}
export interface PhysicsWorld {
    addStatic(entity: pc.Entity, shape: BoxShape): void;
    removeStatic(entity: pc.Entity): void;
    addKinematic(entity: pc.Entity, options?: KinematicOptions): KinematicBody;
    /** True when the two entities' shapes intersect right now. */
    overlaps(a: pc.Entity, b: pc.Entity, radius?: number): boolean;
    /** Fires once per enter (not every frame). Call update() for it to work. */
    onOverlap(a: pc.Entity, b: pc.Entity, callback: () => void): () => void;
    /** Call once per frame, after moving bodies, to dispatch overlap callbacks. */
    update(): void;
    destroy(): void;
}
export declare function createPhysicsWorld(options?: PhysicsWorldOptions): PhysicsWorld;
```
