/* =============================================================================
 * SDK MODULE: keyboard — declarative key→action input map.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the key map your
 * game code passes to createKeyboard(); if the module itself falls short,
 * that is a kit change, not a local edit.
 * Kind: agnostic — browser APIs only, no engine imports. Works in any stack.
 * =============================================================================
 *
 * WHAT
 *   Turns raw KeyboardEvent.code events into named game actions:
 *
 *     const input = createKeyboard({
 *       left:  ['ArrowLeft', 'KeyA'],
 *       right: ['ArrowRight', 'KeyD'],
 *       jump:  ['Space', 'ArrowUp'],
 *     })
 *
 *     if (input.pressed('left')) { ... }            // poll in the update loop
 *     const off = input.onDown('jump', () => {})    // or subscribe; off() removes
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "change the controls"   → the key lists in the map passed to createKeyboard.
 *                             Use KeyboardEvent.code names: 'KeyA', 'Space',
 *                             'ArrowUp', 'ShiftLeft', 'Digit1', ...
 *   "add a dash on Shift"   → add `dash: ['ShiftLeft']` and read pressed('dash').
 *   "play on mobile"        → on-screen controls (or the future touch SDK
 *                             module) call press()/release() here, so gameplay
 *                             code keeps reading the same actions.
 *
 * INTEGRATIONS
 *   - rabbit:pause (Studio): while paused, every action reads released and no
 *     onDown/onUp fires. Keys held during a pause must be pressed again after
 *     resume (state is cleared on pause — safest for gameplay).
 *   - press()/release(): programmatic input for virtual buttons, touch or cutscenes.
 *
 * NOTES
 *   - preventDefault is applied to mapped keys, so arrows/space never scroll the page.
 *   - destroy() removes the window listeners (only needed on full teardown).
 * =============================================================================
 */

import { pauseGate } from './runtime'

export interface KeyboardHandle<A extends string = string> {
  /** True while any mapped key (or virtual press) for the action is held. */
  pressed(action: A): boolean
  /** Fires on the released→held transition. Returns an unsubscribe function. */
  onDown(action: A, callback: () => void): () => void
  /** Fires on the held→released transition. Returns an unsubscribe function. */
  onUp(action: A, callback: () => void): () => void
  /** Programmatic press (virtual buttons / touch module). Pair with release(). */
  press(action: A): void
  release(action: A): void
  /** Pause gate. Studio's rabbit:pause drives this automatically. */
  setPaused(paused: boolean): void
  /** Removes window listeners and clears all state. */
  destroy(): void
}

export function createKeyboard<A extends string>(
  map: Record<A, readonly string[]>
): KeyboardHandle<A> {
  const actions = Object.keys(map) as A[]
  const codeToActions = new Map<string, A[]>()
  for (const action of actions) {
    for (const code of map[action]) {
      const list = codeToActions.get(code) ?? []
      list.push(action)
      codeToActions.set(code, list)
    }
  }

  const heldCodes = new Map<A, Set<string>>(actions.map((a) => [a, new Set<string>()]))
  const virtualCount = new Map<A, number>(actions.map((a) => [a, 0]))
  const downSubs = new Map<A, Set<() => void>>()
  const upSubs = new Map<A, Set<() => void>>()
  let paused = false

  function isHeld(action: A): boolean {
    return (heldCodes.get(action)?.size ?? 0) > 0 || (virtualCount.get(action) ?? 0) > 0
  }

  function emit(subs: Map<A, Set<() => void>>, action: A): void {
    for (const callback of subs.get(action) ?? []) callback()
  }

  function activate(action: A, apply: () => void): void {
    const wasHeld = isHeld(action)
    apply()
    if (!paused && !wasHeld && isHeld(action)) emit(downSubs, action)
  }

  function deactivate(action: A, apply: () => void): void {
    const wasHeld = isHeld(action)
    apply()
    if (!paused && wasHeld && !isHeld(action)) emit(upSubs, action)
  }

  function clearAll(): void {
    for (const set of heldCodes.values()) set.clear()
    for (const action of actions) virtualCount.set(action, 0)
  }

  function onKeyDown(event: KeyboardEvent): void {
    const mapped = codeToActions.get(event.code)
    if (!mapped) return
    event.preventDefault()
    if (event.repeat || paused) return
    for (const action of mapped) {
      activate(action, () => heldCodes.get(action)?.add(event.code))
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    const mapped = codeToActions.get(event.code)
    if (!mapped) return
    event.preventDefault()
    for (const action of mapped) {
      deactivate(action, () => heldCodes.get(action)?.delete(event.code))
    }
  }


  function setPaused(value: boolean): void {
    if (paused === value) return
    paused = value
    if (paused) clearAll()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearAll)
  const gate = pauseGate(setPaused)

  function subscribe(subs: Map<A, Set<() => void>>, action: A, callback: () => void): () => void {
    const set = subs.get(action) ?? new Set<() => void>()
    set.add(callback)
    subs.set(action, set)
    return () => set.delete(callback)
  }

  return {
    pressed: (action) => !paused && isHeld(action),
    onDown: (action, callback) => subscribe(downSubs, action, callback),
    onUp: (action, callback) => subscribe(upSubs, action, callback),
    press: (action) => {
      if (paused) return
      activate(action, () => virtualCount.set(action, (virtualCount.get(action) ?? 0) + 1))
    },
    release: (action) => {
      deactivate(action, () =>
        virtualCount.set(action, Math.max(0, (virtualCount.get(action) ?? 0) - 1))
      )
    },
    setPaused: gate.set,
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearAll)
      gate.destroy()
      clearAll()
      downSubs.clear()
      upSubs.clear()
    },
  }
}
