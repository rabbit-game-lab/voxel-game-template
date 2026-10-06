<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `keyboard`

Import path: `@rabbit-game-lab/sdk/common/keyboard`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/keyboard.ts` (read-only)

```ts
import { createKeyboard, type KeyboardHandle } from '@rabbit-game-lab/sdk/common/keyboard'
```

## Guide

```text
SDK MODULE: keyboard — declarative key→action input map.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the key map your
game code passes to createKeyboard(); if the module itself falls short,
that is a kit change, not a local edit.
Kind: agnostic — browser APIs only, no engine imports. Works in any stack.

WHAT
  Turns raw KeyboardEvent.code events into named game actions:

    const input = createKeyboard({
      left:  ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      jump:  ['Space', 'ArrowUp'],
    })

    if (input.pressed('left')) { ... }            // poll in the update loop
    const off = input.onDown('jump', () => {})    // or subscribe; off() removes

TYPICAL REQUESTS → WHAT TO TOUCH
  "change the controls"   → the key lists in the map passed to createKeyboard.
                            Use KeyboardEvent.code names: 'KeyA', 'Space',
                            'ArrowUp', 'ShiftLeft', 'Digit1', ...
  "add a dash on Shift"   → add `dash: ['ShiftLeft']` and read pressed('dash').
  "play on mobile"        → on-screen controls (or the future touch SDK
                            module) call press()/release() here, so gameplay
                            code keeps reading the same actions.

INTEGRATIONS
  - rabbit:pause (Studio): while paused, every action reads released and no
    onDown/onUp fires. Keys held during a pause must be pressed again after
    resume (state is cleared on pause — safest for gameplay).
  - press()/release(): programmatic input for virtual buttons, touch or cutscenes.

NOTES
  - preventDefault is applied to mapped keys, so arrows/space never scroll the page.
  - destroy() removes the window listeners (only needed on full teardown).
```

## Public API

Declarations shipped with the package (`dist/common/keyboard.d.ts`).

```ts
export interface KeyboardHandle<A extends string = string> {
    /** True while any mapped key (or virtual press) for the action is held. */
    pressed(action: A): boolean;
    /** Fires on the released→held transition. Returns an unsubscribe function. */
    onDown(action: A, callback: () => void): () => void;
    /** Fires on the held→released transition. Returns an unsubscribe function. */
    onUp(action: A, callback: () => void): () => void;
    /** Programmatic press (virtual buttons / touch module). Pair with release(). */
    press(action: A): void;
    release(action: A): void;
    /** Pause gate. Studio's rabbit:pause drives this automatically. */
    setPaused(paused: boolean): void;
    /** Removes window listeners and clears all state. */
    destroy(): void;
}
export declare function createKeyboard<A extends string>(map: Record<A, readonly string[]>): KeyboardHandle<A>;
```
