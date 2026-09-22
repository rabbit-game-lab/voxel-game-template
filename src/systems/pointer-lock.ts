/** Game-facing boolean adapter over the canonical Rabbit pointer-lock lifecycle. */
import { createPointerLock as createSdkPointerLock } from '../rabbit/pointer-lock'
export interface PointerLockHandle {
  locked(): boolean
  allowed(): boolean
  request(): Promise<boolean>
  release(): void
  onChange(callback: (locked: boolean) => void): () => void
  destroy(): void
}
export function createPointerLock(canvas: HTMLCanvasElement): PointerLockHandle {
  const subscribers = new Set<(locked: boolean) => void>()
  const lock = createSdkPointerLock(canvas, {
    allowWhileLocallyPaused: true,
    onChange: state => { for (const callback of subscribers) callback(state === 'locked') },
  })
  return {
    locked: lock.locked,
    allowed: () => lock.state() !== 'unsupported',
    request: lock.request,
    release: lock.release,
    onChange(callback) { subscribers.add(callback); return () => { subscribers.delete(callback) } },
    destroy() { lock.destroy(); subscribers.clear() },
  }
}
