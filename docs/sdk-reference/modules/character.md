<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `character`

Import path: `@rabbit-game-lab/sdk/playcanvas-3d/character`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/playcanvas-3d/character.ts` (read-only)

```ts
import { resolveClips, spawnCharacter, spawnObject, type CharacterState, type CharacterOptions, type CharacterSwitchOptions, type CharacterHandle } from '@rabbit-game-lab/sdk/playcanvas-3d/character'
```

## Guide

```text
SDK MODULE: character — imported GLB actors with automatic animation discovery.
Canonical kit source. Templates configure options, never patch this file.
Composition module: assets owns loading/animation components; this module
translates gameplay states. Position, physics and gameplay remain in the sim.

Typical use (no clip list or animations:'auto' required):
  models: [{ key: 'hero', path: 'assets/models/hero.glb' }]
  await assets.load()
  const hero = spawnCharacter(assets, 'hero')
  hero.play('run')
  createController({ ..., onStateChange: state => hero.play(state) })

Inspect assets.modelInfo('hero') for available vs enabled clips, and
hero.animations() for resolved states, ambiguous candidates and unused clips.
Declare animationMap on the model to override names or bind extra actions:
  animationMap: { idle: 'Breathing', attack: 'Punch', dance: 3, fall: null }
Instance animationMap overrides use enabled playback keys (or null).
Missing/ambiguous states return false. Automatic discovery never picks an
arbitrary resting clip. An explicit clips list preserves its first-clip rest
fallback, unless animationMap.idle is explicitly null.

Static actors: animate:false, rigged:false (legacy), or clips:[] suppress anim.
Animated objects do not require a skeleton. spawnObject is explicitly static;
use assets.spawn/playAnimation for an animated prop. Never build a state graph.
```

## Public API

Declarations shipped with the package (`dist/playcanvas-3d/character.d.ts`).

```ts
/**
 * SDK MODULE: character — imported GLB actors with automatic animation discovery.
 * Canonical kit source. Templates configure options, never patch this file.
 * Composition module: assets owns loading/animation components; this module
 * translates gameplay states. Position, physics and gameplay remain in the sim.
 *
 * Typical use (no clip list or animations:'auto' required):
 *   models: [{ key: 'hero', path: 'assets/models/hero.glb' }]
 *   await assets.load()
 *   const hero = spawnCharacter(assets, 'hero')
 *   hero.play('run')
 *   createController({ ..., onStateChange: state => hero.play(state) })
 *
 * Inspect assets.modelInfo('hero') for available vs enabled clips, and
 * hero.animations() for resolved states, ambiguous candidates and unused clips.
 * Declare animationMap on the model to override names or bind extra actions:
 *   animationMap: { idle: 'Breathing', attack: 'Punch', dance: 3, fall: null }
 * Instance animationMap overrides use enabled playback keys (or null).
 * Missing/ambiguous states return false. Automatic discovery never picks an
 * arbitrary resting clip. An explicit clips list preserves its first-clip rest
 * fallback, unless animationMap.idle is explicitly null.
 *
 * Static actors: animate:false, rigged:false (legacy), or clips:[] suppress anim.
 * Animated objects do not require a skeleton. spawnObject is explicitly static;
 * use assets.spawn/playAnimation for an animated prop. Never build a state graph.
 */
import type * as pc from 'playcanvas';
import type { AssetsHandle, SpawnOptions, ModelAsset } from "./assets.js";
import type { LoadOptions } from "../common/asset-source.js";
import { type AnimationResolution } from "./animation-clips.js";
/** Locomotion states used by the controller; handles also accept custom actions. */
export type CharacterState = 'idle' | 'walk' | 'run' | 'jump' | 'fall';
/** Compatibility helper with the original five-state shape. */
export declare function resolveClips(names: readonly string[]): Record<CharacterState, string | null>;
interface AnimationOptions {
    /** Enabled playback keys. Omit to discover; [] explicitly disables animation. */
    clips?: readonly string[];
    /** Legacy explicit opt-out; animation discovery does not require a skeleton. */
    rigged?: boolean;
    animate?: boolean;
    blendTime?: number;
    /** Per-instance override of the model's semantic map; null disables a state. */
    animationMap?: Record<string, string | null>;
}
export interface CharacterOptions extends SpawnOptions, AnimationOptions {
}
export interface CharacterSwitchOptions extends LoadOptions, AnimationOptions {
    /** Relative visual adjustment, not a physics resize. */
    scale?: number | readonly [number, number, number];
    rotation?: readonly [number, number, number];
}
export interface CharacterHandle {
    /** Stable wrapper — move, parent and attach physics to THIS entity. */
    entity: pc.Entity;
    play(state: string, options?: {
        loop?: boolean;
        restart?: boolean;
    }): boolean;
    /** Last requested state, not proof that a clip is currently playing. */
    state(): string;
    clipFor(state: string): string | null;
    has(state: string): boolean;
    animations(): AnimationResolution;
    /** Latest request wins; failed loads or invalid mappings retain the old visual. */
    switchCharacter(source: string | ModelAsset, options?: CharacterSwitchOptions): Promise<boolean>;
    destroy(): void;
}
export declare function spawnCharacter(assets: AssetsHandle, key: string, options?: CharacterOptions): CharacterHandle;
/** Static prop, even if the GLB contains clips. */
export declare function spawnObject(assets: AssetsHandle, key: string, options?: SpawnOptions): pc.Entity;
export {};
```
