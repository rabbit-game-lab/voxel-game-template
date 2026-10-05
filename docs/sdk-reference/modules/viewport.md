<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `viewport`

Import path: `@rabbit-game-lab/sdk/playcanvas-3d/viewport`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/playcanvas-3d/viewport.ts` (read-only)

```ts
import { createViewports, type ViewportLayout, type DividerOptions, type ViewportOptions, type Viewport, type ViewportsHandle } from '@rabbit-game-lab/sdk/playcanvas-3d/viewport'
```

## Guide

```text
SDK MODULE: viewport — split-screen for local multiplayer (PlayCanvas).
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
your game code passes to createViewports(); if the module itself falls
short, that is a kit change, not a local edit.
Kind: playcanvas-3d — PlayCanvas camera rects + a DOM overlay.

WHAT
  Splits the canvas between seats and hands each one a camera rect and a
  DOM zone for its own HUD:

    const viewports = createViewports(app, { count: CONFIG.players.count })

    for (const viewport of viewports.list()) {
      const camera = new pc.Entity('camera')
      camera.addComponent('camera', { fov: 40 })
      viewport.apply(camera.camera!)           // this seat's half of the screen
      viewport.zone.append(myHudFor(viewport.index))   // this seat's HUD
    }

  count: 1 returns ONE full-screen viewport, so single player and split
  screen are the same code path — a game never needs two modes.

TYPICAL REQUESTS → WHAT TO TOUCH
  "pantalla dividida"        → count: 2. That is the whole feature.
  "uno arriba y otro abajo"  → layout: 'rows' (default 'auto' picks
                                columns on a wide canvas, rows on a tall one
                                — it always splits the LONGER side, which
                                keeps each half closer to square).
  "uno al lado del otro"     → layout: 'columns'.
  "sacá la línea del medio"  → divider: false.
  "que la línea sea gruesa"  → divider: { width: 6, color: '#000' }.

INTEGRATIONS
  - The DOM zones track the canvas box (ResizeObserver + window resize), so
    they stay aligned when Studio resizes the iframe or the phone rotates.
  - Zones are pointer-events:none: the canvas keeps receiving input, and the
    touch module's overlay still works on top.

NOTES
  - PlayCanvas camera rects are NORMALIZED with the origin at the BOTTOM
    left (pc.Vec4(x, y, width, height)); CSS starts at the top left. This
    module owns that flip so game code never has to think about it.
  - Up to 2 seats. Three or four would be a grid with different framing and
    HUD rules — a separate design, not a bigger number here.
  - destroy() removes the overlay and stops observing.
```

## Public API

Declarations shipped with the package (`dist/playcanvas-3d/viewport.d.ts`).

```ts
import * as pc from 'playcanvas';
export type ViewportLayout = 'auto' | 'rows' | 'columns';
export interface DividerOptions {
    /** CSS colour of the line between viewports. Default 'rgba(0,0,0,.55)'. */
    color?: string;
    /** Line thickness in px. Default 3. */
    width?: number;
}
export interface ViewportOptions {
    /** How many seats share the canvas. 1 or 2. */
    count: number;
    /** 'auto' (default) splits the longer side. */
    layout?: ViewportLayout;
    /** Line between the viewports. Default true. */
    divider?: boolean | DividerOptions;
}
export interface Viewport {
    readonly index: number;
    /** Normalized rect, origin bottom-left — what a camera component wants. */
    readonly rect: pc.Vec4;
    /** Point a camera at this slice of the screen. */
    apply(camera: pc.CameraComponent): void;
    /** Positioned DOM box over this slice. Append the seat's HUD here. */
    readonly zone: HTMLElement;
    /** Current size of this slice in CSS pixels. */
    size(): {
        width: number;
        height: number;
    };
}
export interface ViewportsHandle {
    readonly count: number;
    list(): readonly Viewport[];
    get(index: number): Viewport;
    destroy(): void;
}
export declare function createViewports(app: pc.AppBase, options: ViewportOptions): ViewportsHandle;
```
