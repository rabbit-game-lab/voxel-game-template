/* =============================================================================
 * SDK MODULE: viewport — split-screen for local multiplayer (PlayCanvas).
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * your game code passes to createViewports(); if the module itself falls
 * short, that is a kit change, not a local edit.
 * Kind: playcanvas-3d — PlayCanvas camera rects + a DOM overlay.
 * =============================================================================
 *
 * WHAT
 *   Splits the canvas between seats and hands each one a camera rect and a
 *   DOM zone for its own HUD:
 *
 *     const viewports = createViewports(app, { count: CONFIG.players.count })
 *
 *     for (const viewport of viewports.list()) {
 *       const camera = new pc.Entity('camera')
 *       camera.addComponent('camera', { fov: 40 })
 *       viewport.apply(camera.camera!)           // this seat's half of the screen
 *       viewport.zone.append(myHudFor(viewport.index))   // this seat's HUD
 *     }
 *
 *   count: 1 returns ONE full-screen viewport, so single player and split
 *   screen are the same code path — a game never needs two modes.
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "pantalla dividida"        → count: 2. That is the whole feature.
 *   "uno arriba y otro abajo"  → layout: 'rows' (default 'auto' picks
 *                                 columns on a wide canvas, rows on a tall one
 *                                 — it always splits the LONGER side, which
 *                                 keeps each half closer to square).
 *   "uno al lado del otro"     → layout: 'columns'.
 *   "sacá la línea del medio"  → divider: false.
 *   "que la línea sea gruesa"  → divider: { width: 6, color: '#000' }.
 *
 * INTEGRATIONS
 *   - The DOM zones track the canvas box (ResizeObserver + window resize), so
 *     they stay aligned when Studio resizes the iframe or the phone rotates.
 *   - Zones are pointer-events:none: the canvas keeps receiving input, and the
 *     touch module's overlay still works on top.
 *
 * NOTES
 *   - PlayCanvas camera rects are NORMALIZED with the origin at the BOTTOM
 *     left (pc.Vec4(x, y, width, height)); CSS starts at the top left. This
 *     module owns that flip so game code never has to think about it.
 *   - Up to 2 seats. Three or four would be a grid with different framing and
 *     HUD rules — a separate design, not a bigger number here.
 *   - destroy() removes the overlay and stops observing.
 * =============================================================================
 */
import * as pc from 'playcanvas'

export type ViewportLayout = 'auto' | 'rows' | 'columns'

export interface DividerOptions {
  /** CSS colour of the line between viewports. Default 'rgba(0,0,0,.55)'. */
  color?: string
  /** Line thickness in px. Default 3. */
  width?: number
}

export interface ViewportOptions {
  /** How many seats share the canvas. 1 or 2. */
  count: number
  /** 'auto' (default) splits the longer side. */
  layout?: ViewportLayout
  /** Line between the viewports. Default true. */
  divider?: boolean | DividerOptions
}

export interface Viewport {
  readonly index: number
  /** Normalized rect, origin bottom-left — what a camera component wants. */
  readonly rect: pc.Vec4
  /** Point a camera at this slice of the screen. */
  apply(camera: pc.CameraComponent): void
  /** Positioned DOM box over this slice. Append the seat's HUD here. */
  readonly zone: HTMLElement
  /** Current size of this slice in CSS pixels. */
  size(): { width: number; height: number }
}

export interface ViewportsHandle {
  readonly count: number
  list(): readonly Viewport[]
  get(index: number): Viewport
  destroy(): void
}

const MAX_SEATS = 2

export function createViewports(
  app: pc.AppBase,
  options: ViewportOptions
): ViewportsHandle {
  const count = Math.max(1, Math.floor(options.count))
  if (count > MAX_SEATS) {
    throw new Error(`viewport: ${count} seats requested, this module supports up to ${MAX_SEATS}`)
  }

  const canvas = app.graphicsDevice.canvas as HTMLCanvasElement
  const divider = options.divider ?? true

  const root = document.createElement('div')
  root.setAttribute('data-rabbit-viewports', '')
  root.style.cssText = 'position:fixed;pointer-events:none;z-index:15;overflow:hidden;'
  document.body.appendChild(root)

  const dividerStyle = typeof divider === 'object' ? divider : {}
  const dividerWidth = `${dividerStyle.width ?? 3}px`
  const line = document.createElement('div')
  if (divider !== false && count > 1) {
    line.style.cssText =
      `position:absolute;background:${dividerStyle.color ?? 'rgba(0,0,0,.55)'};`
    root.appendChild(line)
  }

  const zones: HTMLElement[] = []
  const rects: pc.Vec4[] = []
  const cameras: (pc.CameraComponent | null)[] = []

  for (let index = 0; index < count; index++) {
    const zone = document.createElement('div')
    zone.setAttribute('data-rabbit-viewport', String(index))
    zone.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;'
    root.appendChild(zone)
    zones.push(zone)
    rects.push(new pc.Vec4(0, 0, 1, 1))
    cameras.push(null)
  }

  /** Columns on a wide canvas, rows on a tall one: always split the longer side. */
  function resolveLayout(): 'rows' | 'columns' {
    const layout = options.layout ?? 'auto'
    if (layout !== 'auto') return layout
    return canvas.clientWidth >= canvas.clientHeight ? 'columns' : 'rows'
  }

  function relayout(): void {
    const box = canvas.getBoundingClientRect()
    root.style.left = `${box.left}px`
    root.style.top = `${box.top}px`
    root.style.width = `${box.width}px`
    root.style.height = `${box.height}px`

    if (count === 1) {
      rects[0].set(0, 0, 1, 1)
      Object.assign(zones[0].style, { left: '0', top: '0', width: '100%', height: '100%' })
      applyRects()
      return
    }

    const columns = resolveLayout() === 'columns'
    for (let index = 0; index < count; index++) {
      if (columns) {
        // Seat 0 on the left. CSS and camera rects agree on the x axis.
        rects[index].set(index * 0.5, 0, 0.5, 1)
        Object.assign(zones[index].style, {
          left: `${index * 50}%`, top: '0', width: '50%', height: '100%',
        })
      } else {
        // Seat 0 on top. The camera rect y is measured from the BOTTOM, so
        // the top half is y = 0.5 while CSS puts it at top = 0.
        rects[index].set(0, index === 0 ? 0.5 : 0, 1, 0.5)
        Object.assign(zones[index].style, {
          left: '0', top: `${index * 50}%`, width: '100%', height: '50%',
        })
      }
    }

    if (line.parentNode) {
      Object.assign(line.style, columns
        ? { left: `calc(50% - ${dividerWidth} / 2)`, top: '0', width: dividerWidth, height: '100%' }
        : { left: '0', top: `calc(50% - ${dividerWidth} / 2)`, width: '100%', height: dividerWidth })
    }

    applyRects()
  }

  function applyRects(): void {
    for (let index = 0; index < count; index++) {
      const camera = cameras[index]
      if (camera) camera.rect = rects[index]
    }
  }

  const observer = new ResizeObserver(relayout)
  observer.observe(canvas)
  window.addEventListener('resize', relayout)
  window.addEventListener('scroll', relayout, { passive: true })
  relayout()

  const viewports: Viewport[] = []
  for (let index = 0; index < count; index++) {
    viewports.push({
      index,
      rect: rects[index],
      zone: zones[index],
      apply: (camera) => {
        cameras[index] = camera
        camera.rect = rects[index]
      },
      size: () => ({
        width: canvas.clientWidth * rects[index].z,
        height: canvas.clientHeight * rects[index].w,
      }),
    })
  }

  return {
    count,
    list: () => viewports,
    get: (index) => viewports[index],
    destroy: () => {
      observer.disconnect()
      window.removeEventListener('resize', relayout)
      window.removeEventListener('scroll', relayout)
      root.remove()
    },
  }
}
