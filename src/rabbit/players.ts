/* =============================================================================
 * SDK MODULE: players — local multiplayer seats (same screen, same keyboard).
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the schemes array
 * your game code passes to createPlayers(); if the module itself falls short,
 * that is a kit change, not a local edit.
 * Kind: agnostic — browser APIs only, no engine imports.
 * COMPOSITION MODULE: unlike the rest of the catalog this one imports other
 * modules (keyboard, gamepad, touch). Wiring those three per seat IS its whole
 * job; see the module design rules in the kit README.
 * =============================================================================
 *
 * WHAT
 *   Turns "one player" into "N players on the same screen", where each seat
 *   owns its own keys, its own pad, and its own action state:
 *
 *     const players = createPlayers({
 *       count: 2,
 *       schemes: [
 *         { label: 'P1', color: '#ffd23f',
 *           keys: { left: ['KeyA'], right: ['KeyD'], jump: ['Space'] },
 *           gamepad: { buttons: { 0: 'jump' },
 *                      axes: { 0: { negative: 'left', positive: 'right' } } } },
 *         { label: 'P2', color: '#4ecdc4',
 *           keys: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Enter'] } },
 *       ],
 *     })
 *
 *     for (const player of players.list()) {
 *       if (player.input.pressed('left')) { ... }
 *     }
 *
 *   Gameplay code reads `player.input` and never learns which device moved it:
 *   the seat's pad and its touch overlay both feed the seat's keyboard handle.
 *   count: 1 is the same code path, so a game does not need two modes.
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que juguemos de a dos"   → count: 2 and a second entry in `schemes`.
 *   "cambiá las teclas del
 *    jugador 2"               → schemes[1].keys.
 *   "cada uno con su joystick"→ give each scheme a `gamepad` map; pad N is
 *                               assigned to seat N automatically.
 *   "los dos manejan el mismo
 *    auto"                    → two seats share a key code. That throws at
 *                               boot on purpose: split the maps.
 *
 * INTEGRATIONS
 *   - rabbit:pause (Studio): each device pauses itself; setPaused() here is
 *     for an in-game pause, and satisfies the `Pausable` shape the pause
 *     module expects, so `createPause({ inputs: [players] })` just works.
 *   - Touch: pass `touch` on ONE scheme only (normally seat 0). The overlay is
 *     anchored to the screen corners, so two of them would sit on top of each
 *     other — split-screen touch is not a thing this module solves.
 *
 * NOTES
 *   - Seats are validated at boot: fewer schemes than seats, or the same key
 *     code in two seats, throws with the offending value. Silent key sharing
 *     is the classic local-co-op bug (one key moves both players).
 *   - destroy() tears down every device of every seat.
 * =============================================================================
 */
import { createKeyboard, type KeyboardHandle } from './keyboard'
import { createGamepad, type GamepadHandle, type GamepadMap } from './gamepad'
import { createTouch, type TouchHandle, type TouchOptions } from './touch'

export interface PlayerScheme<A extends string = string> {
  /** Key codes per action, same shape as createKeyboard's map. */
  keys: Record<A, readonly string[]>
  /** Buttons/axes for the pad assigned to this seat. Omit for keyboard only. */
  gamepad?: GamepadMap<A>
  /** On-screen controls for this seat. Normally only seat 0 gets them. */
  touch?: Omit<TouchOptions<A>, 'target'>
  /** Shown in the HUD. Defaults to 'P1', 'P2', … */
  label?: string
  /** Seat colour for HUD chips, bodywork, markers. Defaults to a palette. */
  color?: string
}

/** What gameplay code reads. The keyboard handle plus an analog vector. */
export interface PlayerInput<A extends string = string> {
  pressed(action: A): boolean
  onDown(action: A, callback: () => void): () => void
  onUp(action: A, callback: () => void): () => void
  press(action: A): void
  release(action: A): void
  /** Strongest analog source for this seat: touch stick, then pad stick. */
  axis(): { x: number; y: number }
}

export interface Player<A extends string = string> {
  readonly index: number
  readonly label: string
  readonly color: string
  readonly input: PlayerInput<A>
  /**
   * This seat's raw devices, or null when it has none. `input` is enough for
   * almost everything; reach for these only when the game needs to treat a
   * device differently — analog trigger pressure, or a touch stick whose
   * vector means something other than the pad's.
   */
  readonly gamepad: GamepadHandle<A> | null
  readonly touch: TouchHandle | null
  /** True while a pad is plugged into this seat (re-checked live). */
  usingGamepad(): boolean
}

export interface PlayersHandle<A extends string = string> {
  readonly count: number
  list(): readonly Player<A>[]
  get(index: number): Player<A>
  /** Pause every seat. Matches the pause module's `Pausable` shape. */
  setPaused(paused: boolean): void
  destroy(): void
}

export interface PlayersOptions<A extends string = string> {
  /** How many seats to open. Needs at least this many schemes. */
  count: number
  schemes: readonly PlayerScheme<A>[]
  /** Assign pad N to seat N. Default true. */
  autoAssignGamepads?: boolean
}

const DEFAULT_COLORS = ['#ffd23f', '#4ecdc4', '#ff6b6b', '#a78bfa']

export function createPlayers<A extends string>(
  options: PlayersOptions<A>
): PlayersHandle<A> {
  const count = Math.max(1, Math.floor(options.count))
  const assignPads = options.autoAssignGamepads !== false

  if (options.schemes.length < count) {
    throw new Error(
      `players: count is ${count} but only ${options.schemes.length} scheme(s) were given`
    )
  }
  assertDisjointKeys(options.schemes.slice(0, count))

  const keyboards: KeyboardHandle<A>[] = []
  const pads: (GamepadHandle<A> | null)[] = []
  const touches: (TouchHandle | null)[] = []
  const players: Player<A>[] = []

  for (let index = 0; index < count; index++) {
    const scheme = options.schemes[index]
    const keys = createKeyboard(scheme.keys)
    const pad =
      assignPads && scheme.gamepad
        ? createGamepad<A>({ slot: index, map: scheme.gamepad, target: keys })
        : null
    const touch = scheme.touch ? createTouch<A>({ ...scheme.touch, target: keys }) : null

    keyboards.push(keys)
    pads.push(pad)
    touches.push(touch)

    players.push({
      index,
      label: scheme.label ?? `P${index + 1}`,
      color: scheme.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      gamepad: pad,
      touch,
      usingGamepad: () => pad?.connected() ?? false,
      input: {
        pressed: (action) => keys.pressed(action),
        onDown: (action, callback) => keys.onDown(action, callback),
        onUp: (action, callback) => keys.onUp(action, callback),
        press: (action) => keys.press(action),
        release: (action) => keys.release(action),
        axis: () => strongestAxis(touch, pad),
      },
    })
  }

  return {
    count,
    list: () => players,
    get: (index) => players[index],
    setPaused: (paused) => {
      for (const keys of keyboards) keys.setPaused(paused)
      for (const pad of pads) pad?.setPaused(paused)
      for (const touch of touches) touch?.setPaused(paused)
    },
    destroy: () => {
      for (const touch of touches) touch?.destroy()
      for (const pad of pads) pad?.destroy()
      for (const keys of keyboards) keys.destroy()
    },
  }
}

/** Touch wins over the pad: if a thumb is on the stick, that is the intent. */
function strongestAxis(
  touch: TouchHandle | null,
  pad: GamepadHandle<string> | null
): { x: number; y: number } {
  const fromTouch = touch?.axis() ?? { x: 0, y: 0 }
  if (fromTouch.x !== 0 || fromTouch.y !== 0) return fromTouch
  return pad?.axis() ?? { x: 0, y: 0 }
}

/** Two seats sharing a key code means one key drives both players. */
function assertDisjointKeys<A extends string>(schemes: readonly PlayerScheme<A>[]): void {
  const owner = new Map<string, number>()
  schemes.forEach((scheme, index) => {
    for (const codes of Object.values(scheme.keys) as readonly string[][]) {
      for (const code of codes) {
        const previous = owner.get(code)
        if (previous !== undefined) {
          throw new Error(
            `players: key ${code} is mapped by seat ${previous} and seat ${index} — ` +
              'give each seat its own keys'
          )
        }
        owner.set(code, index)
      }
    }
  })
}
