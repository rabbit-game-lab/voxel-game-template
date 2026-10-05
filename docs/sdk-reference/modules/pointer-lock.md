<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `pointer-lock`

Import path: `@rabbit-game-lab/sdk/common/pointer-lock`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/pointer-lock.ts` (read-only)

```ts
import { createPointerLock, type PointerLockState, type PointerLockOptions } from '@rabbit-game-lab/sdk/common/pointer-lock'
```

## Guide

```text
Pointer lock: look only while locked; Escape (browser) or release()/host pause unlocks.
```

## Public API

Declarations shipped with the package (`dist/common/pointer-lock.d.ts`).

```ts
export type PointerLockState = 'unsupported' | 'idle' | 'requesting' | 'locked' | 'denied';
export interface PointerLockOptions {
    /** Capture behind a local resume screen; a host pause always prevents capture. */
    allowWhileLocallyPaused?: boolean;
    timeoutMs?: number;
    onChange?: (state: PointerLockState) => void;
    onError?: (error: Error) => void;
}
export declare function createPointerLock(element: HTMLElement, options?: PointerLockOptions): {
    state: () => PointerLockState;
    locked: () => boolean;
    /** Call in pointerdown/click. Look only while locked(); do not add hover/drag look. */
    request(): Promise<boolean>;
    release: () => void;
    destroy(): void;
};
```
