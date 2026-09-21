import type { PauseHandle } from '../rabbit/pause'
import type { GamePhase, InputDevice } from '../sim/types'
import type { InputHandle } from './input'

export type CaptureStatus = 'idle' | 'pending' | 'studio'

/** Coordinates browser capture with Rabbit's authoritative pause state. */
export function createPlayFocus(options: {
  input: InputHandle
  pause: PauseHandle
  phase(): GamePhase
  begin(): void
  changed(): void
}) {
  const { input, pause } = options
  let status: CaptureStatus = 'idle'
  let device: InputDevice = 'keyboard'
  let studioPaused = false
  let destroyed = false
  let requestId = 0
  let wasLocked = input.isFocused()

  function cancelRequest(): void {
    requestId++
  }

  function stop(): void {
    cancelRequest()
    status = studioPaused ? 'studio' : 'idle'
    pause.set(true)
    input.clear()
    input.releaseFocus()
    options.changed()
  }

  function activate(): void {
    status = 'idle'
    options.begin()
    pause.set(false)
    options.changed()
  }

  function resume(nextDevice: InputDevice = device): void {
    if (destroyed || !['focus', 'playing'].includes(options.phase())) return
    device = nextDevice
    if (studioPaused) { status = 'studio'; options.changed(); return }
    if (status === 'pending') return
    if (device !== 'keyboard') { cancelRequest(); activate(); return }
    const keepPlaying = options.phase() === 'playing' && !pause.isPaused()
    if (!keepPlaying) pause.set(true)
    status = 'pending'
    const id = ++requestId
    // Call directly in the trusted gesture, before any await.
    void input.requestFocus().then(() => {
      if (destroyed || id !== requestId) {
        if (destroyed || (status !== 'pending' && (pause.isPaused() || device !== 'keyboard' ||
            options.phase() !== 'playing'))) input.releaseFocus()
        return
      }
      activate()
    })
    options.changed()
  }

  const unsubscribe = input.onFocusChange((locked) => {
    const lost = wasLocked && !locked
    wasLocked = locked
    if (destroyed) return
    if (locked && (device !== 'keyboard' || studioPaused || (pause.isPaused() && status !== 'pending') ||
        !['focus', 'playing'].includes(options.phase()))) input.releaseFocus()
    if (lost) options.changed()
  })
  const onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyP') return
    event.preventDefault()
    if (!event.repeat && ['focus', 'playing'].includes(options.phase())) stop()
  }
  const onMessage = (event: MessageEvent): void => {
    if (event.data?.type !== 'rabbit:pause') return
    studioPaused = event.data.paused !== false
    if (studioPaused) stop()
    else { status = 'idle'; options.changed() }
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('message', onMessage)
  pause.set(true)

  return {
    resume,
    stop,
    status: () => status,
    reset() { cancelRequest(); status = 'idle'; pause.set(true); input.releaseFocus() },
    destroy() {
      destroyed = true; cancelRequest(); unsubscribe()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('message', onMessage)
    },
  }
}
