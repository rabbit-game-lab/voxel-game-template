<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `players`

Import path: `@rabbit-game-lab/sdk/common/players`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/players.ts` (read-only)

```ts
import { createPlayers, type PlayerScheme, type PlayerInput, type Player, type PlayersHandle, type PlayersOptions } from '@rabbit-game-lab/sdk/common/players'
```

## Guide

```text
SDK MODULE: players — local multiplayer seats (same screen, same keyboard).
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the schemes array
your game code passes to createPlayers(); if the module itself falls short,
that is a kit change, not a local edit.
Kind: agnostic — browser APIs only, no engine imports.
COMPOSITION MODULE: unlike the rest of the catalog this one imports other
modules (keyboard, gamepad, touch). Wiring those three per seat IS its whole
job; see the module design rules in the kit README.

WHAT
  Turns "one player" into "N players on the same screen", where each seat
  owns its own keys, its own pad, and its own action state:

    const players = createPlayers({
      count: 2,
      schemes: [
        { label: 'P1', color: '#ffd23f',
          keys: { left: ['KeyA'], right: ['KeyD'], jump: ['Space'] },
          gamepad: { buttons: { 0: 'jump' },
                     axes: { 0: { negative: 'left', positive: 'right' } } } },
        { label: 'P2', color: '#4ecdc4',
          keys: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Enter'] } },
      ],
    })

    for (const player of players.list()) {
      if (player.input.pressed('left')) { ... }
    }

  Gameplay code reads `player.input` and never learns which device moved it:
  the seat's pad and its touch overlay both feed the seat's keyboard handle.
  count: 1 is the same code path, so a game does not need two modes.

TYPICAL REQUESTS → WHAT TO TOUCH
  "que juguemos de a dos"   → count: 2 and a second entry in `schemes`.
  "cambiá las teclas del
   jugador 2"               → schemes[1].keys.
  "cada uno con su joystick"→ give each scheme a `gamepad` map; pad N is
                              assigned to seat N automatically.
  "los dos manejan el mismo
   auto"                    → two seats share a key code. That throws at
                              boot on purpose: split the maps.

INTEGRATIONS
  - rabbit:pause (Studio): each device pauses itself; setPaused() here is
    for an in-game pause, and satisfies the `Pausable` shape the pause
    module expects, so `createPause({ inputs: [players] })` just works.
  - Touch: pass `touch` on ONE scheme only (normally seat 0). The overlay is
    anchored to the screen corners, so two of them would sit on top of each
    other — split-screen touch is not a thing this module solves.

NOTES
  - Seats are validated at boot: fewer schemes than seats, or the same key
    code in two seats, throws with the offending value. Silent key sharing
    is the classic local-co-op bug (one key moves both players).
  - destroy() tears down every device of every seat.
```

## Public API

Declarations shipped with the package (`dist/common/players.d.ts`).

```ts
import { type GamepadHandle, type GamepadMap } from "./gamepad.js";
import { type TouchHandle, type TouchOptions } from "./touch.js";
export interface PlayerScheme<A extends string = string> {
    /** Key codes per action, same shape as createKeyboard's map. */
    keys: Record<A, readonly string[]>;
    /** Buttons/axes for the pad assigned to this seat. Omit for keyboard only. */
    gamepad?: GamepadMap<A>;
    /** On-screen controls for this seat. Normally only seat 0 gets them. */
    touch?: Omit<TouchOptions<A>, 'target'>;
    /** Shown in the HUD. Defaults to 'P1', 'P2', … */
    label?: string;
    /** Seat colour for HUD chips, bodywork, markers. Defaults to a palette. */
    color?: string;
}
/** What gameplay code reads. The keyboard handle plus an analog vector. */
export interface PlayerInput<A extends string = string> {
    pressed(action: A): boolean;
    onDown(action: A, callback: () => void): () => void;
    onUp(action: A, callback: () => void): () => void;
    press(action: A): void;
    release(action: A): void;
    /** Strongest analog source for this seat: touch stick, then pad stick. */
    axis(): {
        x: number;
        y: number;
    };
}
export interface Player<A extends string = string> {
    readonly index: number;
    readonly label: string;
    readonly color: string;
    readonly input: PlayerInput<A>;
    /**
     * This seat's raw devices, or null when it has none. `input` is enough for
     * almost everything; reach for these only when the game needs to treat a
     * device differently — analog trigger pressure, or a touch stick whose
     * vector means something other than the pad's.
     */
    readonly gamepad: GamepadHandle<A> | null;
    readonly touch: TouchHandle | null;
    /** True while a pad is plugged into this seat (re-checked live). */
    usingGamepad(): boolean;
}
export interface PlayersHandle<A extends string = string> {
    readonly count: number;
    list(): readonly Player<A>[];
    get(index: number): Player<A>;
    /** Pause every seat. Matches the pause module's `Pausable` shape. */
    setPaused(paused: boolean): void;
    destroy(): void;
}
export interface PlayersOptions<A extends string = string> {
    /** How many seats to open. Needs at least this many schemes. */
    count: number;
    schemes: readonly PlayerScheme<A>[];
    /** Assign pad N to seat N. Default true. */
    autoAssignGamepads?: boolean;
}
export declare function createPlayers<A extends string>(options: PlayersOptions<A>): PlayersHandle<A>;
```
