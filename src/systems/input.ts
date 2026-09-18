import type { GameConfig } from '../game.config'
import { createGamepad } from '../rabbit/gamepad'
import { createKeyboard } from '../rabbit/keyboard'
import { createPointerLock } from './pointer-lock'
import { createTouch } from '../rabbit/touch'
import type { InputDevice, InputSnapshot } from '../sim/types'

type Action = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' |
  'break' | 'place' | 'previous' | 'next' | 'restart' | 'pause' | 'camera'

export interface InputHandle {
  snapshot(dt: number): InputSnapshot
  setPaused(paused: boolean): void
  requestFocus(): Promise<boolean>
  releaseFocus(): void
  isFocused(): boolean
  onFocusChange(callback: (locked: boolean) => void): () => void
  clear(): void
  destroy(): void
}

const KEY_MAP: Record<Action, readonly string[]> = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'],
  break: [], place: [], previous: [], next: [], restart: ['KeyR'], pause: [], camera: ['KeyV'],
}
const GAMEPAD_BUTTON_ACTIONS: readonly Action[] = [
  'jump', 'camera', 'previous', 'next', 'place', 'break', 'pause',
]

export function createInput(canvas: HTMLCanvasElement, config: GameConfig): InputHandle {
  const keyboard = createKeyboard<Action>(KEY_MAP)
  const touch = createTouch<Action>({
    target: keyboard,
    joystick: { left: 'left', right: 'right', up: 'forward', down: 'back' },
    buttons: [
      { action: 'place', label: '+' }, { action: 'break', label: '⛏' }, { action: 'jump', label: '↑' },
    ],
    size: config.controls.touchSize,
    deadZone: config.controls.gamepadDeadZone,
    opacity: 0.72,
  })
  const gamepad = createGamepad<Action>({
    target: keyboard,
    deadZone: config.controls.gamepadDeadZone,
    map: {
      buttons: { 0: 'jump', 3: 'camera', 4: 'previous', 5: 'next', 6: 'place', 7: 'break', 9: 'pause' },
      axes: {
        0: { negative: 'left', positive: 'right' },
        1: { negative: 'forward', positive: 'back' },
      },
    },
  })
  const pointerLock = createPointerLock(canvas)
  let paused = false
  let device: InputDevice = 'keyboard'
  let lookX = 0
  let lookY = 0
  let wheelDelta = 0
  let selectedSlot: number | null = null
  let breakPulse = false
  let placePulse = false
  let previousJump = false
  let previousPlace = false
  let previousRestart = false
  let previousPause = false
  let previousCamera = false
  let previousSlot = 0
  let touchLook: { id: number; x: number; y: number } | null = null

  const mappedCodes = new Map([
    ['Digit1', 0], ['Digit2', 1], ['Digit3', 2],
    ['Digit4', 3], ['Digit5', 4], ['Digit6', 5],
  ])
  const markKeyboard = (event: KeyboardEvent): void => {
    if (event.repeat) return
    device = 'keyboard'
    const slot = mappedCodes.get(event.code)
    if (slot !== undefined) selectedSlot = slot
  }
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    if (paused) return
    device = 'keyboard'
    wheelDelta += Math.sign(event.deltaY)
  }
  const onContextMenu = (event: Event): void => event.preventDefault()
  const onMouseMove = (event: MouseEvent): void => {
    if (paused || !pointerLock.locked()) return
    device = 'keyboard'
    lookX += event.movementX * config.camera.look.mouseSensitivity
    lookY += event.movementY * config.camera.look.mouseSensitivity
  }
  const onPointerDown = (event: PointerEvent): void => {
    if (paused) return
    if (event.pointerType === 'touch') {
      if (touchLook === null && event.clientX > window.innerWidth * 0.38) {
        touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY }
        canvas.setPointerCapture(event.pointerId)
        device = 'touch'
      }
      return
    }
    device = 'keyboard'
    if (!pointerLock.locked()) return
    if (pointerLock.locked()) {
      if (event.button === 0) keyboard.press('break')
      if (event.button === 2) keyboard.press('place')
      return
    }
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (paused) return
    if (touchLook?.id === event.pointerId) {
      lookX += (event.clientX - touchLook.x) * config.camera.look.touchSensitivity
      lookY += (event.clientY - touchLook.y) * config.camera.look.touchSensitivity
      touchLook.x = event.clientX
      touchLook.y = event.clientY
      return
    }
  }
  const onPointerUp = (event: PointerEvent): void => {
    if (touchLook?.id === event.pointerId) touchLook = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (pointerLock.locked() && event.pointerType !== 'touch') {
      if (event.button === 0) keyboard.release('break')
      if (event.button === 2) keyboard.release('place')
    }
  }
  const onPointerCancel = (event: PointerEvent): void => {
    if (touchLook?.id === event.pointerId) touchLook = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }
  const clear = (): void => {
    keyboard.release('break')
    keyboard.release('place')
    lookX = 0; lookY = 0; wheelDelta = 0; selectedSlot = null
    breakPulse = false; placePulse = false; touchLook = null
  }
  const onBlur = (): void => clear()

  window.addEventListener('keydown', markKeyboard)
  window.addEventListener('blur', onBlur)
  document.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)

  function rawPadLook(dt: number): void {
    if (!gamepad.connected() || paused) return
    const pad = [...(navigator.getGamepads?.() ?? [])].find((entry) => entry?.connected)
    if (!pad) return
    const deadZone = config.controls.gamepadDeadZone
    const x = Math.abs(pad.axes[2] ?? 0) > deadZone ? (pad.axes[2] ?? 0) : 0
    const y = Math.abs(pad.axes[3] ?? 0) > deadZone ? (pad.axes[3] ?? 0) : 0
    if (x !== 0 || y !== 0) {
      device = 'gamepad'
      lookX += x * config.camera.look.padLookSpeed * dt
      lookY += y * config.camera.look.padLookSpeed * dt
    }
  }

  function gamepadButtonActive(): boolean {
    for (const action of GAMEPAD_BUTTON_ACTIONS) if (gamepad.pressed(action)) return true
    return false
  }

  return {
    snapshot(dt) {
      rawPadLook(dt)
      const touchAxis = touch.axis()
      const padAxis = gamepad.axis()
      let moveX = (keyboard.pressed('right') ? 1 : 0) - (keyboard.pressed('left') ? 1 : 0)
      let moveZ = (keyboard.pressed('forward') ? 1 : 0) - (keyboard.pressed('back') ? 1 : 0)
      if (Math.hypot(touchAxis.x, touchAxis.y) > config.controls.gamepadDeadZone) {
        moveX = touchAxis.x; moveZ = -touchAxis.y; device = 'touch'
      } else if (Math.hypot(padAxis.x, padAxis.y) > config.controls.gamepadDeadZone) {
        moveX = padAxis.x; moveZ = -padAxis.y; device = 'gamepad'
      }
      const jump = keyboard.pressed('jump') || gamepad.pressed('jump')
      const place = keyboard.pressed('place') || placePulse
      const restart = keyboard.pressed('restart')
      const pause = keyboard.pressed('pause') || gamepad.pressed('pause')
      const camera = keyboard.pressed('camera')
      const slot = (keyboard.pressed('next') ? 1 : 0) - (keyboard.pressed('previous') ? 1 : 0)
      if (gamepad.connected() && gamepadButtonActive()) device = 'gamepad'
      const result: InputSnapshot = {
        moveX, moveZ, lookX, lookY, sprint: keyboard.pressed('sprint'),
        jumpPressed: jump && !previousJump,
        breakHeld: keyboard.pressed('break') || breakPulse,
        placePressed: place && !previousPlace,
        slotDelta: wheelDelta + (slot !== 0 && slot !== previousSlot ? slot : 0),
        selectSlot: selectedSlot,
        restartPressed: restart && !previousRestart,
        pausePressed: pause && !previousPause,
        cameraPressed: camera && !previousCamera,
        device,
      }
      previousJump = jump; previousPlace = place; previousRestart = restart
      previousPause = pause; previousCamera = camera; previousSlot = slot
      lookX = 0; lookY = 0; wheelDelta = 0; selectedSlot = null
      breakPulse = false; placePulse = false
      return result
    },
    setPaused(value) {
      paused = value
      keyboard.setPaused(value); touch.setPaused(value)
      if (value) clear()
    },
    requestFocus: () => pointerLock.request(),
    releaseFocus: () => pointerLock.release(),
    isFocused: () => pointerLock.locked(),
    onFocusChange: (callback) => pointerLock.onChange(callback),
    clear,
    destroy() {
      clear(); keyboard.destroy(); touch.destroy(); gamepad.destroy(); pointerLock.destroy()
      window.removeEventListener('keydown', markKeyboard)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    },
  }
}
