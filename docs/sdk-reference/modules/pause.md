<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `pause`

Import path: `@rabbit-game-lab/sdk/common/pause`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/pause.ts` (read-only)

```ts
import { createPause, type Pausable, type PauseOptions, type PauseHandle } from '@rabbit-game-lab/sdk/common/pause'
```

## Guide

```text
SDK MODULE: pause — one pause state for Studio, the player and the game.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
your game code passes to createPause(); if the module itself falls short,
that is a kit change, not a local edit.
Kind: agnostic — state + an HTML overlay, no engine imports. The one line
that actually freezes the engine is wired by your game code (see below).

WHAT
  A single source of truth for "is the game paused", fed by three sources:
  Studio's rabbit:pause message, a key (Escape/P by default) and your own
  code calling toggle(). Subscribers get every change once:

    const pause = createPause({
      onChange: (paused) => { app.timeScale = paused ? 0 : 1 },   // 3D
      // onChange: (paused) => { paused ? scene.scene.pause() : scene.scene.resume() }  // 2D
    })
    pause.toggle()          // from a HUD button
    if (pause.isPaused()) return   // early-out inside update()

  Why the engine line lives in your code: freezing the loop is the ONE
  engine-specific bit, and it is different per game (some pause physics but
  keep the camera). Everything else — state, key, overlay, Studio message,
  not firing twice — is here.

TYPICAL REQUESTS → WHAT TO TOUCH
  "que se pueda pausar"        → createPause({ onChange }) and call toggle()
                                 from a button; the key already works.
  "pausar con la P"            → options.keys: ['KeyP'].
  "un cartel de PAUSA"         → options.overlay: true (default) and
                                 options.text.
  "que pause si me voy"        → options.pauseOnBlur: true (off by default,
                                 see the option: focus leaves the iframe
                                 every time the kid types in the chat).

INTEGRATIONS
  - rabbit:pause (Studio): drives the same state, so Studio's pause and the
    in-game pause can never disagree.
  - keyboard/touch/sound modules pause themselves off the same Studio
    message; calling toggle() also forwards to them via setPaused() when you
    pass them in options.inputs.

NOTES
  - onChange fires only on real transitions, never twice for the same state.
  - destroy() removes the overlay, the key and the window listeners.
```

## Public API

Declarations shipped with the package (`dist/common/pause.d.ts`).

```ts
/** Anything that can be gated — keyboard and touch handles satisfy this. */
export interface Pausable {
    setPaused(paused: boolean): void;
}
export interface PauseOptions {
    /** Called on every transition. Freeze/unfreeze the engine here. */
    onChange?: (paused: boolean) => void;
    /** Key codes that toggle pause. Default ['Escape', 'KeyP']. [] disables. */
    keys?: readonly string[];
    /** Draw a dimmed "PAUSED" overlay. Default true. */
    overlay?: boolean;
    /** Overlay text. Default 'PAUSED'. */
    text?: string;
    /**
     * Pause when the window loses focus. Default FALSE: the game runs in an
     * iframe next to the Studio chat, so the player types and clicks outside it
     * all the time — auto-pausing there reads as the game freezing at random.
     * Turn it on for a standalone build where losing focus does mean "away".
     */
    pauseOnBlur?: boolean;
    /** Modules to gate alongside the game (keyboard, touch, ...). */
    inputs?: readonly Pausable[];
}
export interface PauseHandle {
    isPaused(): boolean;
    set(paused: boolean): void;
    toggle(): void;
    /** Subscribe to changes. Returns an unsubscribe function. */
    onChange(callback: (paused: boolean) => void): () => void;
    destroy(): void;
}
export declare function createPause(options?: PauseOptions): PauseHandle;
```
