/* =============================================================================
 * SDK MODULE: gamepad — declarative button/axis→action map for joysticks.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the map your game
 * code passes to createGamepad(); if the module itself falls short, that is a
 * kit change, not a local edit.
 * Kind: agnostic — the browser Gamepad API only, no engine imports.
 * =============================================================================
 *
 * WHAT
 *   The same shape as the keyboard module, for a physical controller:
 *
 *     const pad = createGamepad({
 *       map: {
 *         buttons: { 0: 'jump', 7: 'forward', 6: 'backward' },
 *         axes: { 0: { negative: 'left', positive: 'right' } },
 *       },
 *     })
 *
 *     if (pad.pressed('left')) { ... }         // poll in the update loop
 *     const off = pad.onDown('jump', () => {}) // or subscribe; off() removes
 *
 *   Feed a keyboard handle instead and gameplay code never learns there is a
 *   pad at all — the same seam the touch module uses:
 *
 *     const input = createKeyboard({ left: ['KeyA'], right: ['KeyD'], ... })
 *     createGamepad({ map, target: input })    // pad presses land in `input`
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que ande con joystick"    → createGamepad with target: your keyboard handle.
 *   "cambiá los botones"       → the `buttons` map. Standard layout indices:
 *                                0 A/×, 1 B/○, 2 X/□, 3 Y/△, 4 LB, 5 RB,
 *                                6 LT, 7 RT, 8 select, 9 start, 12-15 d-pad.
 *   "el gatillo para acelerar" → buttons: { 7: 'forward' }; read pad.analog()
 *                                for the 0-1 pressure instead of on/off.
 *   "dos jugadores con un pad
 *    cada uno"                 → one createGamepad per seat with slot: 0 and
 *                                slot: 1 (or let the players module do it).
 *   "el auto se va solo"       → deadZone (default 0.15). Worn sticks drift.
 *
 * INTEGRATIONS
 *   - rabbit:pause (Studio): while paused every action reads released and no
 *     onDown/onUp fires, exactly like the keyboard module.
 *   - target: anything with press()/release() — createKeyboard()'s handle.
 *
 * NOTES
 *   - The Gamepad API is poll-only: there are no button events. This module
 *     runs its own requestAnimationFrame poll so consumers read it like the
 *     keyboard, with nothing to call from the game loop.
 *   - `slot` is a SEAT, not gamepad.index. Browsers hand out sparse indices
 *     (unplugging pad 0 leaves pad 1 at index 1), so slots are resolved
 *     against the connected pads in index order and re-resolved on
 *     connect/disconnect. Slot 0 is always "the first pad plugged in".
 *   - destroy() stops the poll and releases everything.
 * =============================================================================
 */

/** Anything with press/release — createKeyboard()'s handle satisfies this. */
import { pauseGate } from './runtime'

export interface GamepadTarget<A extends string = string> {
  press(action: A): void
  release(action: A): void
}

/** One stick/trigger axis split into the two actions its ends fire. */
export interface GamepadAxis<A extends string = string> {
  negative: A
  positive: A
}

export interface GamepadMap<A extends string = string> {
  /** Button index → action. See the standard layout in the header. */
  buttons?: Readonly<Record<number, A>>
  /** Axis index → the actions its negative/positive ends fire. */
  axes?: Readonly<Record<number, GamepadAxis<A>>>
}

export interface GamepadOptions<A extends string = string> {
  /** Seat this handle listens to: 0 = first pad plugged in. Default 0. */
  slot?: number
  map: GamepadMap<A>
  /** Stick travel needed to fire a direction, 0-1. Default 0.15. */
  deadZone?: number
  /** Optional press()/release() sink, so a keyboard handle sees pad input. */
  target?: GamepadTarget<A>
}

export interface GamepadHandle<A extends string = string> {
  /** True while a pad is present in this slot. */
  connected(): boolean
  /** Human-readable id of the pad in this slot, or '' when none. */
  id(): string
  /** True while any mapped button/axis for the action is held. */
  pressed(action: A): boolean
  /** Fires on the released→held transition. Returns an unsubscribe function. */
  onDown(action: A, callback: () => void): () => void
  /** Fires on the held→released transition. Returns an unsubscribe function. */
  onUp(action: A, callback: () => void): () => void
  /** Left stick vector, x/y in -1..1 (y is +1 down, like screen space). */
  axis(): { x: number; y: number }
  /** Analog pressure 0-1: trigger value, or stick travel toward the action. */
  analog(action: A): number
  /** Pause gate. Studio's rabbit:pause drives this automatically. */
  setPaused(paused: boolean): void
  /** Stops the poll, removes listeners and releases everything. */
  destroy(): void
}

/** Connected pads in seat order — slot 0 is the first one plugged in. */
export function listGamepads(): readonly { slot: number; id: string }[] {
  return connectedPads().map((pad, slot) => ({ slot, id: pad.id }))
}

function connectedPads(): Gamepad[] {
  const pads: Gamepad[] = []
  try {
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (pad && pad.connected) pads.push(pad)
    }
  } catch { return [] }
  return pads.sort((a, b) => a.index - b.index)
}

export function createGamepad<A extends string>(
  options: GamepadOptions<A>
): GamepadHandle<A> {
  const slot = options.slot ?? 0
  const deadZone = options.deadZone ?? 0.15
  const buttons = options.map.buttons ?? {}
  const axes = options.map.axes ?? {}
  const target = options.target

  const held = new Set<A>()
  const strength = new Map<A, number>()
  const downSubs = new Map<A, Set<() => void>>()
  const upSubs = new Map<A, Set<() => void>>()
  let stick = { x: 0, y: 0 }
  let padId = ''
  let paused = false
  let frame = 0

  function emit(subs: Map<A, Set<() => void>>, action: A): void {
    for (const callback of subs.get(action) ?? []) callback()
  }

  function set(action: A, active: boolean, value: number): void {
    strength.set(action, active ? value : 0)
    if (active === held.has(action)) return
    if (active) {
      held.add(action)
      target?.press(action)
      if (!paused) emit(downSubs, action)
    } else {
      held.delete(action)
      target?.release(action)
      if (!paused) emit(upSubs, action)
    }
  }

  function releaseAll(): void {
    for (const action of [...held]) set(action, false, 0)
    strength.clear()
    stick = { x: 0, y: 0 }
  }

  function poll(): void {
    frame = requestAnimationFrame(poll)
    const pad = connectedPads()[slot]
    padId = pad?.id ?? ''

    if (!pad || paused) {
      if (held.size > 0 || stick.x !== 0 || stick.y !== 0) releaseAll()
      return
    }

    const next = new Map<A, number>()
    const collect = (action: A, active: boolean, value: number) => {
      next.set(action, Math.max(next.get(action) ?? 0, active ? Math.max(value, Number.EPSILON) : 0))
    }
    for (const [index, action] of Object.entries(buttons)) {
      const button = pad.buttons[Number(index)]
      const value = button?.value ?? 0
      collect(action, button?.pressed === true || value > 0.5, value)
    }

    for (const [index, pair] of Object.entries(axes)) {
      const value = pad.axes[Number(index)] ?? 0
      collect(pair.negative, value < -deadZone, Math.max(0, -value))
      collect(pair.positive, value > deadZone, Math.max(0, value))
    }

    for (const [action, value] of next) set(action, value > 0, value)
    stick = { x: applyDeadZone(pad.axes[0] ?? 0), y: applyDeadZone(pad.axes[1] ?? 0) }
  }

  function applyDeadZone(value: number): number {
    return Math.abs(value) > deadZone ? value : 0
  }

  function setPaused(value: boolean): void {
    if (paused === value) return
    paused = value
    if (paused) releaseAll()
  }


  function subscribe(subs: Map<A, Set<() => void>>, action: A, callback: () => void): () => void {
    const set_ = subs.get(action) ?? new Set<() => void>()
    set_.add(callback)
    subs.set(action, set_)
    return () => set_.delete(callback)
  }

  const gate = pauseGate(setPaused)
  frame = requestAnimationFrame(poll)

  return {
    connected: () => padId !== '',
    id: () => padId,
    pressed: (action) => !paused && held.has(action),
    onDown: (action, callback) => subscribe(downSubs, action, callback),
    onUp: (action, callback) => subscribe(upSubs, action, callback),
    axis: () => (paused ? { x: 0, y: 0 } : { ...stick }),
    analog: (action) => (paused ? 0 : strength.get(action) ?? 0),
    setPaused: gate.set,
    destroy: () => {
      cancelAnimationFrame(frame)
      gate.destroy()
      releaseAll()
      downSubs.clear()
      upSubs.clear()
    },
  }
}
