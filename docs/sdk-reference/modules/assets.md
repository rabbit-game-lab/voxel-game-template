<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `assets`

Import path: `@rabbit-game-lab/sdk/playcanvas-3d/assets`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/playcanvas-3d/assets.ts` (read-only)

```ts
import { defineAssets, createAssets, type ModelAsset, type FileAsset, type ModelInfo, type AssetManifest, type SpawnOptions, type AssetsHandle } from '@rabbit-game-lab/sdk/playcanvas-3d/assets'
```

## Guide

```text
GLB, texture and audio assets. Canonical kit source; sync into templates.
GLB clips are discovered by default. Inspect modelInfo(key) after load for
available vs enabled clips; declare animationMap only to override semantics.
Before runtime, npm run check inventories GLBs under public/ automatically;
node scripts/models.mjs --json returns current metadata without an engine.
```

## Public API

Declarations shipped with the package (`dist/playcanvas-3d/assets.d.ts`).

```ts
/** GLB, texture and audio assets. Canonical kit source; sync into templates.
 * GLB clips are discovered by default. Inspect modelInfo(key) after load for
 * available vs enabled clips; declare animationMap only to override semantics.
 * Before runtime, npm run check inventories GLBs under public/ automatically;
 * node scripts/models.mjs --json returns current metadata without an engine.
 */
import * as pc from 'playcanvas';
import { type LoadOptions } from "../common/asset-source.js";
import { type AnimationClip, type AnimationMap } from "./animation-clips.js";
export interface ModelAsset {
    key: string;
    /** Local public path or an HTTP(S)/blob URL. External servers must permit CORS. */
    path: string;
    /** Omitted/'auto': discover every clip. false/{}: explicitly disable clips. */
    animations?: Record<string, string | number> | 'auto' | false;
    /** Semantic state -> real clip name/index; null disables that state. */
    animationMap?: AnimationMap;
    /** Critical by default. Optional assets may finish after ready. */
    required?: boolean;
}
export interface FileAsset {
    key: string;
    path: string;
    required?: boolean;
}
export interface ModelInfo {
    key: string;
    path: string;
    availableClips: AnimationClip[];
    enabledClips: string[];
    /** Validated semantic overrides, resolved to enabled playback keys. */
    animationMap: Record<string, string | null>;
}
export interface AssetManifest {
    models?: readonly ModelAsset[];
    textures?: readonly FileAsset[];
    audio?: readonly FileAsset[];
}
export interface SpawnOptions {
    position?: readonly [number, number, number];
    rotation?: readonly [number, number, number];
    scale?: number | readonly [number, number, number];
    normalizeHeight?: number;
    parent?: pc.Entity;
    name?: string;
    /** False for a static object or a deliberately unanimated character. */
    animate?: boolean;
}
export interface AssetsHandle {
    load(options?: LoadOptions): Promise<void>;
    loadModel(model: ModelAsset, options?: LoadOptions): Promise<void>;
    spawn(key: string, options?: SpawnOptions): pc.Entity;
    trySpawn(key: string, options?: SpawnOptions): pc.Entity | null;
    /** Replaces only the owned visual child, preserving actor identity and components. */
    replaceModel(entity: pc.Entity, key: string, options?: Omit<SpawnOptions, 'parent' | 'position' | 'name'>): void;
    playAnimation(entity: pc.Entity, name: string, options?: {
        loop?: boolean;
        blendTime?: number;
        restart?: boolean;
    }): boolean;
    clipNames(key: string): string[];
    /** Throws before load/after failure; an empty inventory means a loaded static model. */
    modelInfo(key: string): ModelInfo;
    texture(key: string): pc.Texture | null;
    audioUrl(key: string): string | null;
    destroy(): void;
}
export declare function defineAssets<T extends AssetManifest>(manifest: T): T;
export declare function createAssets(app: pc.Application, manifest: AssetManifest): AssetsHandle;
```
