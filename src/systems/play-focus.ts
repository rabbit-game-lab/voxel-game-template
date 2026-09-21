import type { PauseHandle } from '../rabbit/pause'
import type { GamePhase, InputDevice } from '../sim/types'
import type { InputHandle } from './input'

export type CaptureStatus = 'idle' | 'pending' | 'denied' | 'studio'

// Chromium blocks recapture for 1250 ms after Escape; allow a small margin.
const RECAPTURE_GRACE_MS = 1500

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
  let lastUnlock = -Infinity
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  function cancelRequest(): void {
    requestId++
    clearTimeout(retryTimer)
    retryTimer = undefined
  }

  function stop(): void {
    cancelRequest()
    status = studioPaused ? 'studio' : 'idle'
    pause.set(true)
    input.clear()
    input.releaseFocus()
    options.changed()
  }

  function activate(next: CaptureStatus = 'idle'): void {
    status = next
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
    function requestCapture(canRetry: boolean): void {
      if (destroyed || id !== requestId) return
      void input.requestFocus().then((locked) => {
        if (destroyed || id !== requestId) {
          if (destroyed || (status !== 'pending' && (pause.isPaused() || device !== 'keyboard' ||
              options.phase() !== 'playing'))) input.releaseFocus()
          return
        }
        if (locked || input.isFocused()) activate()
        else if (canRetry && Date.now() - lastUnlock < RECAPTURE_GRACE_MS) {
          // Escape imposes a temporary browser cooldown. Respect it, then
          // retry once within the original Continue gesture's activation.
          retryTimer = setTimeout(() => {
            retryTimer = undefined
            requestCapture(false)
          }, Math.max(0, RECAPTURE_GRACE_MS - (Date.now() - lastUnlock)))
        } else {
          // Iframe / Permissions-Policy denials must not brick the session.
          activate('denied')
        }
      })
    }
    requestCapture(true)
    options.changed()
  }

  const unsubscribe = input.onFocusChange((locked) => {
    const lost = wasLocked && !locked
    if (lost) lastUnlock = Date.now()
    wasLocked = locked
    if (destroyed) return
    if (locked && (device !== 'keyboard' || studioPaused || (pause.isPaused() && status !== 'pending') ||
        !['focus', 'playing'].includes(options.phase()))) input.releaseFocus()
    if (locked && status === 'denied') { status = 'idle'; options.changed() }
    if (lost && options.phase() === 'playing' && !pause.isPaused()) stop()
  })
  const onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' && event.code !== 'KeyP') return
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
