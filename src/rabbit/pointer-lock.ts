/** Pointer lock with explicit user-gesture requests and an unlocked fallback. */
import { runtime } from './runtime'

export type PointerLockState = 'unsupported' | 'idle' | 'requesting' | 'locked' | 'denied'
export interface PointerLockOptions {
  /** Capture behind a local resume screen; a host pause always prevents capture. */
  allowWhileLocallyPaused?: boolean
  timeoutMs?: number
  onChange?: (state: PointerLockState) => void
  onError?: (error: Error) => void
}
export function createPointerLock(element: HTMLElement, options: PointerLockOptions = {}) {
  const doc = element.ownerDocument
  let current: PointerLockState = typeof element.requestPointerLock === 'function' ? 'idle' : 'unsupported'
  let destroyed = false
  let wanted = false
  let pending: Promise<boolean> | undefined
  let finish: ((locked: boolean) => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const blocked = () => runtime.hostPaused() || (!options.allowWhileLocallyPaused && runtime.state().paused)
  function transition(next: PointerLockState): void {
    if (current === next) return
    current = next
    if (!destroyed) options.onChange?.(next)
  }
  function settle(value: boolean): void {
    clearTimeout(timer)
    const resolve = finish
    finish = undefined
    pending = undefined
    resolve?.(value)
  }
  function release(): void {
    wanted = false
    if (doc.pointerLockElement === element) doc.exitPointerLock()
    settle(false)
    if (current !== 'unsupported') transition('idle')
  }
  function changed(): void {
    const locked = doc.pointerLockElement === element
    if (locked && (!wanted || destroyed || blocked())) { release(); return }
    transition(locked ? 'locked' : 'idle')
    settle(locked)
  }
  function denied(error: unknown = new Error('Pointer lock denied')): void {
    if (!finish) return
    wanted = false
    transition('denied')
    settle(false)
    options.onError?.(error instanceof Error ? error : new Error(String(error)))
  }
  const onError = () => denied()
  doc.addEventListener('pointerlockchange', changed)
  doc.addEventListener('pointerlockerror', onError)
  window.addEventListener('blur', release)
  const off = runtime.subscribe(() => { if (blocked()) release() })
  return {
    state: () => current,
    locked: () => !destroyed && doc.pointerLockElement === element,
    /** Call directly in pointerdown/click; denial resolves false for drag/touch fallback. */
    request(): Promise<boolean> {
      if (destroyed || current === 'unsupported' || blocked()) return Promise.resolve(false)
      if (doc.pointerLockElement === element) return Promise.resolve(true)
      if (pending) return pending
      wanted = true
      transition('requesting')
      const promise = new Promise<boolean>((resolve) => { finish = resolve })
      pending = promise
      const attempt = finish
      timer = setTimeout(() => denied(new Error('Pointer lock timed out')), options.timeoutMs ?? 3000)
      try {
        // Legacy browsers return void; success is always the pointerlockchange event.
        const result = element.requestPointerLock() as Promise<void> | undefined
        void result?.catch((error: unknown) => { if (finish === attempt) denied(error) })
      } catch (error) { denied(error) }
      return promise
    },
    release,
    destroy(): void {
      if (destroyed) return
      destroyed = true
      release()
      off()
      doc.removeEventListener('pointerlockchange', changed)
      doc.removeEventListener('pointerlockerror', onError)
      window.removeEventListener('blur', release)
    },
  }
}
