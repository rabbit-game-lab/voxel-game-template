<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `gamepad`

Import path: `@rabbit-game-lab/sdk/common/gamepad`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/gamepad.ts` (read-only)

```ts
import { listGamepads, createGamepad, type GamepadTarget, type GamepadAxis, type GamepadMap, type GamepadOptions, type GamepadHandle } from '@rabbit-game-lab/sdk/common/gamepad'
```

## Guide

```text
SDK MODULE: gamepad — declarative button/axis→action map for joysticks.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the map your game
code passes to createGamepad(); if the module itself falls short, that is a
kit change, not a local edit.
Kind: agnostic — the browser Gamepad API only, no engine imports.

WHAT
  The same shape as the keyboard module, for a physical controller:

    const pad = createGamepad({
      map: {
        buttons: { 0: 'jump', 7: 'forward', 6: 'backward' },
        axes: { 0: { negative: 'left', positive: 'right' } },
      },
    })

    if (pad.pressed('left')) { ... }         // poll in the update loop
    const off = pad.onDown('jump', () => {}) // or subscribe; off() removes

  Feed a keyboard handle instead and gameplay code never learns there is a
  pad at all — the same seam the touch module uses:

    const input = createKeyboard({ left: ['KeyA'], right: ['KeyD'], ... })
    createGamepad({ map, target: input })    // pad presses land in `input`

TYPICAL REQUESTS → WHAT TO TOUCH
  "que ande con joystick"    → createGamepad with target: your keyboard handle.
  "cambiá los botones"       → the `buttons` map. Standard layout indices:
                               0 A/×, 1 B/○, 2 X/□, 3 Y/△, 4 LB, 5 RB,
                               6 LT, 7 RT, 8 select, 9 start, 12-15 d-pad.
  "el gatillo para acelerar" → buttons: { 7: 'forward' }; read pad.analog()
                               for the 0-1 pressure instead of on/off.
  "dos jugadores con un pad
   cada uno"                 → one createGamepad per seat with slot: 0 and
                               slot: 1 (or let the players module do it).
  "el auto se va solo"       → deadZone (default 0.15). Worn sticks drift.

INTEGRATIONS
  - rabbit:pause (Studio): while paused every action reads released and no
    onDown/onUp fires, exactly like the keyboard module.
  - target: anything with press()/release() — createKeyboard()'s handle.

NOTES
  - The Gamepad API is poll-only: there are no button events. This module
    runs its own requestAnimationFrame poll so consumers read it like the
    keyboard, with nothing to call from the game loop.
  - `slot` is a SEAT, not gamepad.index. Browsers hand out sparse indices
    (unplugging pad 0 leaves pad 1 at index 1), so slots are resolved
    against the connected pads in index order and re-resolved on
    connect/disconnect. Slot 0 is always "the first pad plugged in".
  - destroy() stops the poll and releases everything.

 Anything with press/release — createKeyboard()'s handle satisfies this.
```

## Public API

Declarations shipped with the package (`dist/common/gamepad.d.ts`).

```ts
export interface GamepadTarget<A extends string = string> {
    press(action: A): void;
    release(action: A): void;
}
/** One stick/trigger axis split into the two actions its ends fire. */
export interface GamepadAxis<A extends string = string> {
    negative: A;
    positive: A;
}
export interface GamepadMap<A extends string = string> {
    /** Button index → action. See the standard layout in the header. */
    buttons?: Readonly<Record<number, A>>;
    /** Axis index → the actions its negative/positive ends fire. */
    axes?: Readonly<Record<number, GamepadAxis<A>>>;
}
export interface GamepadOptions<A extends string = string> {
    /** Seat this handle listens to: 0 = first pad plugged in. Default 0. */
    slot?: number;
    map: GamepadMap<A>;
    /** Stick travel needed to fire a direction, 0-1. Default 0.15. */
    deadZone?: number;
    /** Optional press()/release() sink, so a keyboard handle sees pad input. */
    target?: GamepadTarget<A>;
}
export interface GamepadHandle<A extends string = string> {
    /** True while a pad is present in this slot. */
    connected(): boolean;
    /** Human-readable id of the pad in this slot, or '' when none. */
    id(): string;
    /** True while any mapped button/axis for the action is held. */
    pressed(action: A): boolean;
    /** Fires on the released→held transition. Returns an unsubscribe function. */
    onDown(action: A, callback: () => void): () => void;
    /** Fires on the held→released transition. Returns an unsubscribe function. */
    onUp(action: A, callback: () => void): () => void;
    /** Left stick vector, x/y in -1..1 (y is +1 down, like screen space). */
    axis(): {
        x: number;
        y: number;
    };
    /** Analog pressure 0-1: trigger value, or stick travel toward the action. */
    analog(action: A): number;
    /** Pause gate. Studio's rabbit:pause drives this automatically. */
    setPaused(paused: boolean): void;
    /** Stops the poll, removes listeners and releases everything. */
    destroy(): void;
}
/** Connected pads in seat order — slot 0 is the first one plugged in. */
export declare function listGamepads(): readonly {
    slot: number;
    id: string;
}[];
export declare function createGamepad<A extends string>(options: GamepadOptions<A>): GamepadHandle<A>;
```
