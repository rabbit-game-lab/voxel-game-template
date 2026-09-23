/* =============================================================================
 * SDK MODULE: pause — one pause state for Studio, the player and the game.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * your game code passes to createPause(); if the module itself falls short,
 * that is a kit change, not a local edit.
 * Kind: agnostic — state + an HTML overlay, no engine imports. The one line
 * that actually freezes the engine is wired by your game code (see below).
 * =============================================================================
 *
 * WHAT
 *   A single source of truth for "is the game paused", fed by three sources:
 *   Studio's rabbit:pause message, a key (Escape/P by default) and your own
 *   code calling toggle(). Subscribers get every change once:
 *
 *     const pause = createPause({
 *       onChange: (paused) => { app.timeScale = paused ? 0 : 1 },   // 3D
 *       // onChange: (paused) => { paused ? scene.scene.pause() : scene.scene.resume() }  // 2D
 *     })
 *     pause.toggle()          // from a HUD button
 *     if (pause.isPaused()) return   // early-out inside update()
 *
 *   Why the engine line lives in your code: freezing the loop is the ONE
 *   engine-specific bit, and it is different per game (some pause physics but
 *   keep the camera). Everything else — state, key, overlay, Studio message,
 *   not firing twice — is here.
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que se pueda pausar"        → createPause({ onChange }) and call toggle()
 *                                  from a button; the key already works.
 *   "pausar con la P"            → options.keys: ['KeyP'].
 *   "un cartel de PAUSA"         → options.overlay: true (default) and
 *                                  options.text.
 *   "que pause si me voy"        → options.pauseOnBlur: true (off by default,
 *                                  see the option: focus leaves the iframe
 *                                  every time the kid types in the chat).
 *
 * INTEGRATIONS
 *   - rabbit:pause (Studio): drives the same state, so Studio's pause and the
 *     in-game pause can never disagree.
 *   - keyboard/touch/sound modules pause themselves off the same Studio
 *     message; calling toggle() also forwards to them via setPaused() when you
 *     pass them in options.inputs.
 *
 * NOTES
 *   - onChange fires only on real transitions, never twice for the same state.
 *   - destroy() removes the overlay, the key and the window listeners.
 * =============================================================================
 */

import { runtime } from './runtime'

/** Anything that can be gated — keyboard and touch handles satisfy this. */
export interface Pausable {
  setPaused(paused: boolean): void
}

export interface PauseOptions {
  /** Called on every transition. Freeze/unfreeze the engine here. */
  onChange?: (paused: boolean) => void
  /** Key codes that toggle pause. Default ['Escape', 'KeyP']. [] disables. */
  keys?: readonly string[]
  /** Draw a dimmed "PAUSED" overlay. Default true. */
  overlay?: boolean
  /** Overlay text. Default 'PAUSED'. */
  text?: string
  /**
   * Pause when the window loses focus. Default FALSE: the game runs in an
   * iframe next to the Studio chat, so the player types and clicks outside it
   * all the time — auto-pausing there reads as the game freezing at random.
   * Turn it on for a standalone build where losing focus does mean "away".
   */
  pauseOnBlur?: boolean
  /** Modules to gate alongside the game (keyboard, touch, ...). */
  inputs?: readonly Pausable[]
}

export interface PauseHandle {
  isPaused(): boolean
  set(paused: boolean): void
  toggle(): void
  /** Subscribe to changes. Returns an unsubscribe function. */
  onChange(callback: (paused: boolean) => void): () => void
  destroy(): void
}

export function createPause(options: PauseOptions = {}): PauseHandle {
  const keys = options.keys ?? ['Escape', 'KeyP']
  const subscribers = new Set<(paused: boolean) => void>()
  if (options.onChange) subscribers.add(options.onChange)
  let paused = false
  let localPaused = false
  const reason = Symbol('local pause')
  let destroyed = false

  const overlay = document.createElement('div')
  if (options.overlay !== false) {
    overlay.setAttribute('data-rabbit-pause', '')
    overlay.textContent = options.text ?? 'PAUSED'
    overlay.style.cssText = `position:fixed;inset:0;display:none;z-index:30;
      align-items:center;justify-content:center;pointer-events:none;
      background:rgba(0,0,0,.45);color:#fff;letter-spacing:.18em;
      font:700 clamp(24px,6vw,56px) system-ui,sans-serif;`
    document.body.appendChild(overlay)
  }

  function applyState(value: boolean): void {
    if (paused === value) return
    paused = value
    if (options.overlay !== false) overlay.style.display = paused ? 'flex' : 'none'
    for (const input of options.inputs ?? []) input.setPaused(paused)
    for (const callback of subscribers) callback(paused)
  }

  function set(value: boolean): void {
    if (destroyed) return
    localPaused = value
    runtime.setPaused(reason, value)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat || !keys.includes(event.code)) return
    event.preventDefault()
    // Studio owns the outer lifecycle. A local key must never wake a game
    // while the parent still requires it to be paused.
    if (runtime.hostPaused()) return
    set(!localPaused)
  }

  function onBlur(): void {
    set(true)
  }

  if (keys.length > 0) window.addEventListener('keydown', onKeyDown)
  const offState = runtime.subscribe((state) => applyState(state.paused))
  if (options.pauseOnBlur === true) window.addEventListener('blur', onBlur)

  return {
    isPaused: () => paused,
    set,
    toggle: () => {
      if (runtime.hostPaused()) return
      set(!localPaused)
    },
    onChange(callback) {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown)
      if (destroyed) return
      destroyed = true
      runtime.setPaused(reason, false)
      offState()
      for (const input of options.inputs ?? []) input.setPaused(false)
      window.removeEventListener('blur', onBlur)
      subscribers.clear()
      overlay.remove()
    },
  }
}
