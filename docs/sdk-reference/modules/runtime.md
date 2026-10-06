<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `runtime`

Import path: `@rabbit-game-lab/sdk/common/runtime`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/runtime.ts` (read-only)

```ts
import { createRuntime, runtime, pauseGate, type RuntimeState } from '@rabbit-game-lab/sdk/common/runtime'
```

## Guide

```text
Canonical shared lifecycle. Vendored by rabbit-kit; edit in the kit only.
```

## Public API

Declarations shipped with the package (`dist/common/runtime.d.ts`).

```ts
/** Canonical shared lifecycle. Vendored by rabbit-kit; edit in the kit only. */
export interface RuntimeState {
    paused: boolean;
    muted: boolean;
    hostPaused: boolean;
}
type Listener = (state: Readonly<RuntimeState>) => void;
/** One coordinator per game document; engines apply the effective state. */
export declare function createRuntime(): {
    state: () => RuntimeState;
    hostPaused: () => boolean;
    setPaused: (reason: string | symbol, value: boolean) => void;
    setMuted: (reason: string | symbol, value: boolean) => void;
    subscribe(listener: Listener, immediate?: boolean): () => void;
    onRestart(callback: () => void): () => void;
};
export declare const runtime: {
    state: () => RuntimeState;
    hostPaused: () => boolean;
    setPaused: (reason: string | symbol, value: boolean) => void;
    setMuted: (reason: string | symbol, value: boolean) => void;
    subscribe(listener: Listener, immediate?: boolean): () => void;
    onRestart(callback: () => void): () => void;
};
/** Compose a module's own gate with the shared runtime. */
export declare function pauseGate(apply: (paused: boolean) => void): {
    set(value: boolean): void;
    destroy: () => void;
};
export {};
```
