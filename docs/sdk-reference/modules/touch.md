<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `touch`

Import path: `@rabbit-game-lab/sdk/common/touch`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/touch.ts` (read-only)

```ts
import { createTouch, type TouchTarget, type TouchButton, type SwipeOptions, type TouchOptions, type TouchHandle } from '@rabbit-game-lab/sdk/common/touch'
```

## Guide

```text
SDK MODULE: touch — on-screen joystick + buttons for phones.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
your game code passes to createTouch(); if the module itself falls short,
that is a kit change, not a local edit.
Kind: agnostic — an HTML overlay on top of the canvas, no engine imports.

WHAT
  Draws a thumb joystick and action buttons over the game and feeds them
  into the SAME actions your keyboard map already uses, so gameplay code
  never learns about touch:

    const input = createKeyboard({ left: ['ArrowLeft'], right: ['ArrowRight'],
                                   jump: ['Space'] })
    const touch = createTouch({
      target: input,                                  // press()/release() go here
      joystick: { left: 'left', right: 'right', up: 'up', down: 'down' },
      buttons: [{ action: 'jump', label: 'A' }],
    })

  input.pressed('left') is now true from the keyboard OR the joystick.

TYPICAL REQUESTS → WHAT TO TOUCH
  "que se pueda jugar en el celu" → createTouch with the joystick mapping
                                    your game already uses for the keyboard.
  "que se maneje deslizando"      → options.swipe instead of (or next to) the
                                    joystick: runners and lane games want the
                                    whole screen, not a stick in the corner.
  "agregá un botón de disparo"    → one more entry in `buttons`.
  "los botones son chicos"        → options.size (px, default 132 joystick /
                                    64 button). Kid thumbs like them big.
  "que se vean siempre"           → options.show: 'always' (default 'auto':
                                    only on touch devices).
  "analógico"                     → read touch.axis() for a -1..1 vector
                                    instead of the digital actions.

INTEGRATIONS
  - rabbit:pause (Studio): the overlay hides and releases every held action,
    so nothing stays pressed across a pause.
  - The overlay sits in its own fixed container with pointer-events only on
    the controls: the rest of the screen keeps reaching the canvas.

NOTES
  - Multi-touch: the joystick tracks its own pointerId, so a thumb on the
    stick and another on a button work at the same time.
  - destroy() removes the overlay and releases everything.

 Anything with press/release — createKeyboard()'s handle satisfies this.
```

## Public API

Declarations shipped with the package (`dist/common/touch.d.ts`).

```ts
export interface TouchTarget<A extends string = string> {
    press(action: A): void;
    release(action: A): void;
}
export interface TouchButton<A extends string = string> {
    action: A;
    /** Short text drawn on the button ('A', '↑', 'FIRE'). */
    label: string;
}
export interface SwipeOptions<A extends string = string> {
    /** Action fired by a swipe in each direction. Omit one to ignore it. */
    actions: Partial<Record<'left' | 'right' | 'up' | 'down', A>>;
    /** Minimum travel in px to count as a swipe. Default 30. */
    threshold?: number;
    /** Longest gesture still read as a swipe, in ms. Default 300. */
    maxDurationMs?: number;
}
export interface TouchOptions<A extends string = string> {
    target: TouchTarget<A>;
    /** Directional actions fed by the stick. Omit an axis to disable it. */
    joystick?: Partial<Record<'left' | 'right' | 'up' | 'down', A>>;
    buttons?: readonly TouchButton<A>[];
    /**
     * Swipe gestures anywhere on the screen — the idiomatic control for runners
     * and lane-switching games, where a joystick would be in the way. Each swipe
     * fires the action as a momentary press+release, so onDown() handlers work
     * exactly as they do for a key.
     */
    swipe?: SwipeOptions<A>;
    /** 'auto' (default) shows the overlay only on touch devices. */
    show?: 'auto' | 'always' | 'never';
    /** Joystick diameter in px (default 132). Buttons are size * 0.48. */
    size?: number;
    /** Fraction of the radius the thumb must travel to fire an action (default 0.35). */
    deadZone?: number;
    /** Overlay opacity, 0-1 (default 0.55). */
    opacity?: number;
}
export interface TouchHandle {
    /** Analog stick vector, x/y in -1..1 (y is +1 down, like screen space). */
    axis(): {
        x: number;
        y: number;
    };
    setPaused(paused: boolean): void;
    setVisible(visible: boolean): void;
    destroy(): void;
}
export declare function createTouch<A extends string>(options: TouchOptions<A>): TouchHandle;
```
