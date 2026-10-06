<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `spatial`

Import path: `@rabbit-game-lab/sdk/common/spatial`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/spatial.ts` (read-only)

```ts
import { validatePlacementPoint, validatePlacementPoints, fitPlacement, fitModelToPoint, validateSpatialPoints, choosePlacementPoint, measureGlbBounds, correctionMatrix, modelCorrectionMatrix, type Vec3, type Quat, type Mat4, type PlacementPoint, type ModelBounds, type PlacementRequest, type PlacementFit, type PlacementFailureCode, type PlacementFailure, type PlacementSuccess, type PlacementResult, type ModelCorrection, type GlbBoundsOptions } from '@rabbit-game-lab/sdk/common/spatial'
```

## Guide

```text
SDK MODULE: spatial — bounded, engine-free decoration placement.

Templates resolve their moving world into PlacementPoint values. Eve chooses
a stable point id and this module checks the model's verified bounds before
producing the transform the template adapter applies. It intentionally
knows no game names, coordinates, or engine types.

Typical use:
  const bounds = measureGlbBounds(bytes, { correction: model.correction })
  const result = choosePlacementPoint(points, bounds, { meaning: 'curve-side' })
  if (result.ok) adapter.encode({ point: result.point, fit: result.fit, bounds, modelKey })

⛔ AGENTS MUST NOT EDIT THIS FILE after it is vendored into a template.
```

## Public API

Declarations shipped with the package (`dist/common/spatial.d.ts`).

```ts
/**
 * SDK MODULE: spatial — bounded, engine-free decoration placement.
 *
 * Templates resolve their moving world into PlacementPoint values. Eve chooses
 * a stable point id and this module checks the model's verified bounds before
 * producing the transform the template adapter applies. It intentionally
 * knows no game names, coordinates, or engine types.
 *
 * Typical use:
 *   const bounds = measureGlbBounds(bytes, { correction: model.correction })
 *   const result = choosePlacementPoint(points, bounds, { meaning: 'curve-side' })
 *   if (result.ok) adapter.encode({ point: result.point, fit: result.fit, bounds, modelKey })
 *
 * ⛔ AGENTS MUST NOT EDIT THIS FILE after it is vendored into a template.
 */
export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export type Mat4 = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export interface PlacementPoint {
    /** Stable within a live world revision; never an array index. */
    id: string;
    /** Human-readable semantic role, used for exact capability matching. */
    meaning?: string;
    position: Vec3;
    /** World yaw in degrees, increasing with the template's forward direction. */
    rotation: number;
    /** Full available dimensions (width, height, depth), centred on position. */
    space: Vec3;
    /** Null means free; any other value reserves this point. */
    occupiedBy: string | null;
    /** Changes when a moving template invalidates its resolved points. */
    revision: string;
}
export interface ModelBounds {
    min: Vec3;
    max: Vec3;
    size: Vec3;
    /** True only when every static mesh vertex was inspected successfully. */
    verified: true;
    vertexCount: number;
}
export interface PlacementRequest {
    pointId?: string;
    meaning?: string;
    /** Desired world dimensions. Uniform model scaling is still required. */
    explicitSize?: Vec3;
    /** Explicit authored scale. A value is never enlarged by the fitter. */
    explicitScale?: number;
}
export interface PlacementFit {
    pointId: string;
    position: Vec3;
    rotation: number;
    scale: number;
    /** Bounds after the returned transform, useful as write evidence. */
    worldBounds: {
        min: Vec3;
        max: Vec3;
        size: Vec3;
    };
}
export type PlacementFailureCode = 'invalid_point' | 'unknown_point' | 'meaning_mismatch' | 'unavailable' | 'occupied' | 'unverified_bounds' | 'invalid_bounds' | 'explicit_size_not_uniform' | 'explicit_size_too_large' | 'explicit_scale_too_large' | 'no_fit';
export interface PlacementFailure {
    ok: false;
    code: PlacementFailureCode;
    message: string;
}
export interface PlacementSuccess {
    ok: true;
    point: PlacementPoint;
    fit: PlacementFit;
}
export type PlacementResult = PlacementSuccess | PlacementFailure;
/** Validate one template-resolved point. Invalid metadata must be discarded. */
export declare function validatePlacementPoint(point: unknown): string[];
/** Validate a complete point set, including duplicate stable ids. */
export declare function validatePlacementPoints(points: unknown): string[];
/** Fit a verified static model at one already selected point. */
export declare function fitPlacement(point: PlacementPoint, bounds: ModelBounds, request?: PlacementRequest): PlacementResult;
/** Short adapter-facing name for fitting a static model at one point. */
export declare function fitModelToPoint(bounds: ModelBounds, point: PlacementPoint, requestedSize?: Vec3): PlacementResult;
/** Compatibility alias for consumers that call the validator by its capability name. */
export declare const validateSpatialPoints: typeof validatePlacementPoints;
/** Deterministically select the first available, unoccupied point that fits. */
export declare function choosePlacementPoint(points: readonly PlacementPoint[], bounds: ModelBounds, request?: PlacementRequest): PlacementResult;
export interface ModelCorrection {
    position?: Vec3;
    /** Euler degrees, in XYZ order, matching PlayCanvas model corrections. */
    rotation?: Vec3;
    scale?: number | Vec3;
}
export interface GlbBoundsOptions {
    correction?: Mat4 | ModelCorrection;
    scene?: number;
}
/**
 * Decode static POSITION vertices from a binary GLB and include every node's
 * transform. Sparse accessors, compressed/quantized attributes, morph targets,
 * and skinned nodes are rejected: guessing their bounds would be unsafe.
 */
export declare function measureGlbBounds(input: ArrayBuffer | Uint8Array, options?: GlbBoundsOptions | Mat4 | ModelCorrection): ModelBounds;
/** Build a correction matrix from the same transform shape used by adapters. */
export declare function correctionMatrix(transformValue?: Partial<{
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
}>): Mat4;
/** Convert the adapter's Euler-degree correction metadata into a GLB matrix. */
export declare function modelCorrectionMatrix(correction?: ModelCorrection): Mat4;
```
