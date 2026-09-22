/* =============================================================================
 * SDK MODULE: touch — on-screen joystick + buttons for phones.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * your game code passes to createTouch(); if the module itself falls short,
 * that is a kit change, not a local edit.
 * Kind: agnostic — an HTML overlay on top of the canvas, no engine imports.
 * =============================================================================
 *
 * WHAT
 *   Draws a thumb joystick and action buttons over the game and feeds them
 *   into the SAME actions your keyboard map already uses, so gameplay code
 *   never learns about touch:
 *
 *     const input = createKeyboard({ left: ['ArrowLeft'], right: ['ArrowRight'],
 *                                    jump: ['Space'] })
 *     const touch = createTouch({
 *       target: input,                                  // press()/release() go here
 *       joystick: { left: 'left', right: 'right', up: 'up', down: 'down' },
 *       buttons: [{ action: 'jump', label: 'A' }],
 *     })
 *
 *   input.pressed('left') is now true from the keyboard OR the joystick.
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que se pueda jugar en el celu" → createTouch with the joystick mapping
 *                                     your game already uses for the keyboard.
 *   "que se maneje deslizando"      → options.swipe instead of (or next to) the
 *                                     joystick: runners and lane games want the
 *                                     whole screen, not a stick in the corner.
 *   "agregá un botón de disparo"    → one more entry in `buttons`.
 *   "los botones son chicos"        → options.size (px, default 132 joystick /
 *                                     64 button). Kid thumbs like them big.
 *   "que se vean siempre"           → options.show: 'always' (default 'auto':
 *                                     only on touch devices).
 *   "analógico"                     → read touch.axis() for a -1..1 vector
 *                                     instead of the digital actions.
 *
 * INTEGRATIONS
 *   - rabbit:pause (Studio): the overlay hides and releases every held action,
 *     so nothing stays pressed across a pause.
 *   - The overlay sits in its own fixed container with pointer-events only on
 *     the controls: the rest of the screen keeps reaching the canvas.
 *
 * NOTES
 *   - Multi-touch: the joystick tracks its own pointerId, so a thumb on the
 *     stick and another on a button work at the same time.
 *   - destroy() removes the overlay and releases everything.
 * =============================================================================
 */

/** Anything with press/release — createKeyboard()'s handle satisfies this. */
import { pauseGate } from './runtime'

export interface TouchTarget<A extends string = string> {
  press(action: A): void
  release(action: A): void
}

export interface TouchButton<A extends string = string> {
  action: A
  /** Short text drawn on the button ('A', '↑', 'FIRE'). */
  label: string
}

export interface SwipeOptions<A extends string = string> {
  /** Action fired by a swipe in each direction. Omit one to ignore it. */
  actions: Partial<Record<'left' | 'right' | 'up' | 'down', A>>
  /** Minimum travel in px to count as a swipe. Default 30. */
  threshold?: number
  /** Longest gesture still read as a swipe, in ms. Default 300. */
  maxDurationMs?: number
}

export interface TouchOptions<A extends string = string> {
  target: TouchTarget<A>
  /** Directional actions fed by the stick. Omit an axis to disable it. */
  joystick?: Partial<Record<'left' | 'right' | 'up' | 'down', A>>
  buttons?: readonly TouchButton<A>[]
  /**
   * Swipe gestures anywhere on the screen — the idiomatic control for runners
   * and lane-switching games, where a joystick would be in the way. Each swipe
   * fires the action as a momentary press+release, so onDown() handlers work
   * exactly as they do for a key.
   */
  swipe?: SwipeOptions<A>
  /** 'auto' (default) shows the overlay only on touch devices. */
  show?: 'auto' | 'always' | 'never'
  /** Joystick diameter in px (default 132). Buttons are size * 0.48. */
  size?: number
  /** Fraction of the radius the thumb must travel to fire an action (default 0.35). */
  deadZone?: number
  /** Overlay opacity, 0-1 (default 0.55). */
  opacity?: number
}

export interface TouchHandle {
  /** Analog stick vector, x/y in -1..1 (y is +1 down, like screen space). */
  axis(): { x: number; y: number }
  setPaused(paused: boolean): void
  setVisible(visible: boolean): void
  destroy(): void
}

const BASE_STYLE = `position:fixed;inset:0;pointer-events:none;z-index:20;
touch-action:none;user-select:none;-webkit-user-select:none;`

export function createTouch<A extends string>(options: TouchOptions<A>): TouchHandle {
  const size = options.size ?? 132
  const deadZone = options.deadZone ?? 0.35
  const opacity = options.opacity ?? 0.55
  const joystick = options.joystick ?? {}
  const held = new Set<A>()
  let paused = false
  let stickPointer: number | null = null
  let axis = { x: 0, y: 0 }

  const root = document.createElement('div')
  root.setAttribute('data-rabbit-touch', '')
  root.style.cssText = BASE_STYLE
  root.style.opacity = String(opacity)

  const wantsOverlay =
    options.show === 'always' ||
    (options.show !== 'never' &&
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0))

  function press(action: A | undefined): void {
    if (!action || paused || held.has(action)) return
    held.add(action)
    options.target.press(action)
  }

  function release(action: A | undefined): void {
    if (!action || !held.has(action)) return
    held.delete(action)
    options.target.release(action)
  }

  function releaseAll(): void {
    for (const action of [...held]) release(action)
    axis = { x: 0, y: 0 }
  }

  // --- Joystick ---
  const stick = document.createElement('div')
  const thumb = document.createElement('div')
  if (Object.keys(joystick).length > 0) {
    stick.style.cssText = `position:absolute;left:${size * 0.2}px;bottom:${size * 0.2}px;
      width:${size}px;height:${size}px;border-radius:50%;pointer-events:auto;
      background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.5);`
    thumb.style.cssText = `position:absolute;left:50%;top:50%;width:${size * 0.42}px;
      height:${size * 0.42}px;margin:${-size * 0.21}px 0 0 ${-size * 0.21}px;border-radius:50%;
      background:rgba(255,255,255,.75);transition:transform .05s linear;`
    stick.appendChild(thumb)
    root.appendChild(stick)
  }

  function updateStick(clientX: number, clientY: number): void {
    const rect = stick.getBoundingClientRect()
    const radius = rect.width / 2
    const dx = (clientX - (rect.left + radius)) / radius
    const dy = (clientY - (rect.top + radius)) / radius
    const length = Math.hypot(dx, dy)
    const scale = length > 1 ? 1 / length : 1
    axis = { x: dx * scale, y: dy * scale }
    thumb.style.transform = `translate(${axis.x * radius * 0.6}px, ${axis.y * radius * 0.6}px)`

    setDirection(joystick.left, axis.x < -deadZone)
    setDirection(joystick.right, axis.x > deadZone)
    setDirection(joystick.up, axis.y < -deadZone)
    setDirection(joystick.down, axis.y > deadZone)
  }

  function setDirection(action: A | undefined, active: boolean): void {
    if (!action) return
    if (active) press(action)
    else release(action)
  }

  function resetStick(): void {
    stickPointer = null
    axis = { x: 0, y: 0 }
    thumb.style.transform = 'translate(0,0)'
    for (const action of Object.values(joystick) as (A | undefined)[]) release(action)
  }

  function onStickDown(event: PointerEvent): void {
    if (stickPointer !== null) return
    stickPointer = event.pointerId
    stick.setPointerCapture(event.pointerId)
    updateStick(event.clientX, event.clientY)
  }

  function onStickMove(event: PointerEvent): void {
    if (event.pointerId !== stickPointer) return
    updateStick(event.clientX, event.clientY)
  }

  function onStickUp(event: PointerEvent): void {
    if (event.pointerId !== stickPointer) return
    resetStick()
  }

  stick.addEventListener('pointerdown', onStickDown)
  stick.addEventListener('pointermove', onStickMove)
  stick.addEventListener('pointerup', onStickUp)
  stick.addEventListener('pointercancel', onStickUp)

  // --- Buttons ---
  const buttonSize = size * 0.48
  const buttons = options.buttons ?? []
  buttons.forEach((button, index) => {
    const element = document.createElement('div')
    element.textContent = button.label
    element.style.cssText = `position:absolute;right:${size * 0.2 + index * buttonSize * 1.25}px;
      bottom:${size * 0.25}px;width:${buttonSize}px;height:${buttonSize}px;border-radius:50%;
      pointer-events:auto;display:flex;align-items:center;justify-content:center;
      font:600 ${Math.round(buttonSize * 0.34)}px system-ui,sans-serif;color:#fff;
      background:rgba(255,255,255,.22);border:2px solid rgba(255,255,255,.5);`

    const down = (event: PointerEvent): void => {
      event.preventDefault()
      element.style.background = 'rgba(255,255,255,.45)'
      press(button.action)
    }
    const up = (): void => {
      element.style.background = 'rgba(255,255,255,.22)'
      release(button.action)
    }
    element.addEventListener('pointerdown', down)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', up)
    element.addEventListener('pointerleave', up)
    root.appendChild(element)
  })

  // --- Swipe gestures (whole screen, no overlay needed) ---
  const swipeFrames = new Map<number, A>()
  const cancelSwipe = () => { swipeStart = null }
  let swipeStart: { x: number; y: number; time: number } | null = null

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') return
    swipeStart = { x: event.clientX, y: event.clientY, time: performance.now() }
  }

  function onPointerUp(event: PointerEvent): void {
    const start = swipeStart
    swipeStart = null
    const swipe = options.swipe
    if (!start || !swipe || paused) return

    const threshold = swipe.threshold ?? 30
    if (performance.now() - start.time > (swipe.maxDurationMs ?? 300)) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    let action: A | undefined
    if (absX > absY && absX > threshold) action = dx > 0 ? swipe.actions.right : swipe.actions.left
    else if (absY > absX && absY > threshold) action = dy > 0 ? swipe.actions.down : swipe.actions.up
    if (!action) return

    // Momentary press: onDown fires now, the release lands on the next frame
    // so a poll of pressed() in this frame's update still sees it held.
    options.target.press(action)
    const held = action
    const frame = requestAnimationFrame(() => { swipeFrames.delete(frame); options.target.release(held) })
    swipeFrames.set(frame, held)
  }

  if (options.swipe) {
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', cancelSwipe, { passive: true })
  }

  function setVisible(visible: boolean): void {
    root.style.display = visible ? 'block' : 'none'
    if (!visible) releaseAll()
  }

  function setPaused(value: boolean): void {
    if (paused === value) return
    paused = value
    if (paused) {
      releaseAll()
      resetStick()
    }
    setVisible(!paused && wantsOverlay)
  }


  const gate = pauseGate(setPaused)
  document.body.appendChild(root)
  setVisible(!paused && wantsOverlay)

  return {
    axis: () => ({ ...axis }),
    setPaused: gate.set,
    setVisible,
    destroy() {
      gate.destroy()
      window.removeEventListener('pointercancel', cancelSwipe)
      for (const [frame, action] of swipeFrames) { cancelAnimationFrame(frame); options.target.release(action) }
      swipeFrames.clear()
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      releaseAll()
      root.remove()
    },
  }
}
