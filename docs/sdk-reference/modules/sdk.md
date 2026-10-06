<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `sdk`

Import path: `@rabbit-game-lab/sdk`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/sdk.ts` (read-only)

```ts
import { runtime, reportError, storage, audio, requireReady, ready, init, observeResize, type SdkHandlers } from '@rabbit-game-lab/sdk'
```

## Guide

```text
Rabbit iframe contract. Canonical source: rabbit-game-kit; sync, do not fork.
```

## Public API

Declarations shipped with the package (`dist/common/sdk.d.ts`).

```ts
export { runtime } from "./runtime.js";
export interface SdkHandlers {
    onPause?: (paused: boolean) => void;
    onRestart?: () => void;
    onMute?: (muted: boolean) => void;
}
export declare function reportError(error: unknown): void;
export declare const storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    persistent: () => boolean;
};
interface ResumableContext {
    state: string;
    resume(): Promise<void>;
}
declare function unlockAll(): void;
export declare const audio: {
    /** Returns unregister; allowed gates context-specific pause during gestures. */
    register(ctx: ResumableContext, allowed?: () => boolean): () => void;
    unlock: typeof unlockAll;
};
/** Register critical work synchronously before ready(); failures block ready. */
export declare function requireReady<T>(work: Promise<T>): Promise<T>;
/** Request ready after a rendered frame; pending critical loads delay emission. */
export declare function ready(): void;
/** Replaces prior init handlers. Its disposer is safe to call repeatedly. */
export declare function init(handlers?: SdkHandlers): () => void;
/** Observe local container sizing; returns disconnect for teardown/HMR. */
export declare function observeResize(element: HTMLElement, callback: (width: number, height: number) => void): () => void;
```
