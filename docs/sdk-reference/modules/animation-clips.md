<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `animation-clips`

Import path: `@rabbit-game-lab/sdk/playcanvas-3d/animation-clips`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/playcanvas-3d/animation-clips.ts` (read-only)

```ts
import { describeClips, selectClip, resolveAnimationMap, type AnimationClip, type AnimationMap, type AnimationResolution } from '@rabbit-game-lab/sdk/playcanvas-3d/animation-clips'
```

## Guide

```text
Pure animation discovery and semantic matching, shared by assets/character.
Vendored SDK: configure animationMap in game data, never edit this module.
Names describe intent only when unambiguous; explicit mappings win.
```

## Public API

Declarations shipped with the package (`dist/playcanvas-3d/animation-clips.d.ts`).

```ts
/** Pure animation discovery and semantic matching, shared by assets/character.
 * Vendored SDK: configure animationMap in game data, never edit this module.
 * Names describe intent only when unambiguous; explicit mappings win.
 */
export interface AnimationClip {
    index: number;
    /** Track name (not PlayCanvas's generated asset registration name). */
    name: string;
    /** Unique playback key; duplicate/empty names receive an indexed key. */
    key: string;
    duration: number;
}
export type AnimationMap = Record<string, string | number | null>;
export interface AnimationResolution {
    bindings: Record<string, string | null>;
    ambiguous: Record<string, string[]>;
    unused: string[];
}
/** Preserve all clips, including duplicate and unnamed tracks. */
export declare function describeClips(tracks: readonly {
    name: string;
    duration: number;
}[]): AnimationClip[];
export declare function selectClip(clips: readonly AnimationClip[], selector: string | number): AnimationClip;
/** Best unique candidate wins. Ties and mixed actions stay unresolved. */
export declare function resolveAnimationMap(names: readonly string[], overrides?: Record<string, string | null>): AnimationResolution;
```
