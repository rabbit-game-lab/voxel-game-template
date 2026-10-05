<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `asset-source`

Import path: `@rabbit-game-lab/sdk/common/asset-source`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/asset-source.ts` (read-only)

```ts
import { assetUrl, abortable, type LoadOptions } from '@rabbit-game-lab/sdk/common/asset-source'
```

## Guide

```text
Validated asset locations and bounded asynchronous work, shared by both stacks.
```

## Public API

Declarations shipped with the package (`dist/common/asset-source.d.ts`).

```ts
/** Validated asset locations and bounded asynchronous work, shared by both stacks. */
export interface LoadOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    critical?: boolean;
}
export declare function assetUrl(path: string): string;
/** Caller cancellation does not cancel a shared cached load for other consumers. */
export declare function abortable<T>(work: Promise<T>, options?: LoadOptions): Promise<T>;
```
