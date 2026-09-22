/** Rabbit iframe contract. Canonical source: rabbit-game-kit; sync, do not fork. */
import { runtime } from './runtime'
export { runtime } from './runtime'

export interface SdkHandlers {
  onPause?: (paused: boolean) => void
  onRestart?: () => void
  onMute?: (muted: boolean) => void
}
function post(type: string, payload?: Record<string, unknown>): void {
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage({ type, ...payload }, '*')
  } catch { /* Parent may have navigated. */ }
}
export function reportError(error: unknown): void {
  post('rabbit:error', { message: String(error instanceof Error ? error.message : error).slice(0, 2000) })
}

// After a storage failure, use one consistent in-memory backend for this document.
const memoryStore = new Map<string, string | null>()
let memoryOnly = false
export const storage = {
  get(key: string): string | null {
    if (memoryStore.has(key)) return memoryStore.get(key) ?? null
    if (!memoryOnly) {
      try { return window.localStorage.getItem(key) } catch { memoryOnly = true }
    }
    return null
  },
  set(key: string, value: string): void {
    memoryStore.set(key, value)
    if (!memoryOnly) {
      try { window.localStorage.setItem(key, value) } catch { memoryOnly = true }
    }
  },
  remove(key: string): void {
    memoryStore.set(key, null)
    if (!memoryOnly) {
      try { window.localStorage.removeItem(key) } catch { memoryOnly = true }
    }
  },
  persistent: () => !memoryOnly,
}

interface ResumableContext { state: string; resume(): Promise<void> }
const audioContexts = new Map<ResumableContext, () => boolean>()
const gestures = ['pointerdown', 'keydown', 'touchstart'] as const
function unlockAll(): void {
  if (runtime.state().paused) return
  for (const [ctx, allowed] of audioContexts) {
    if (allowed() && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  }
}
export const audio = {
  /** Returns unregister; allowed gates context-specific pause during gestures. */
  register(ctx: ResumableContext, allowed: () => boolean = () => true): () => void {
    if (!audioContexts.size) for (const event of gestures) window.addEventListener(event, unlockAll, { passive: true })
    audioContexts.set(ctx, allowed)
    return () => {
      audioContexts.delete(ctx)
      if (!audioContexts.size) for (const event of gestures) window.removeEventListener(event, unlockAll)
    }
  },
  unlock: unlockAll,
}

let readySent = false
let readyRequested = false
let pending = 0
let bootFailed = false
function flushReady(): void {
  if (!readyRequested || readySent || pending || bootFailed) return
  readySent = true
  post('rabbit:ready')
}
/** Register critical work synchronously before ready(); failures block ready. */
export function requireReady<T>(work: Promise<T>): Promise<T> {
  if (readySent) return work
  pending++
  const tracked = work.then((value) => { pending--; flushReady(); return value }, (error: unknown) => {
    pending--; bootFailed = true; reportError(error); throw error
  })
  void tracked.catch(() => undefined)
  return tracked
}
/** Request ready after a rendered frame; pending critical loads delay emission. */
export function ready(): void { readyRequested = true; flushReady() }

let disposeCurrent: (() => void) | undefined
/** Replaces prior init handlers. Its disposer is safe to call repeatedly. */
export function init(handlers: SdkHandlers = {}): () => void {
  const disposePrevious = disposeCurrent
  let previous = { paused: false, muted: false }
  const offState = runtime.subscribe((state) => {
    if (state.paused !== previous.paused) handlers.onPause?.(state.paused)
    if (state.muted !== previous.muted) handlers.onMute?.(state.muted)
    previous = { ...state }
  })
  const offRestart = runtime.onRestart(() => handlers.onRestart?.())
  disposePrevious?.()
  const onError = (event: ErrorEvent) => reportError(event.message ?? 'Unknown error')
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason ?? 'Unhandled rejection')
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    offState(); offRestart()
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    if (disposeCurrent === dispose) disposeCurrent = undefined
  }
  disposeCurrent = dispose
  return dispose
}
/** Observe local container sizing; returns disconnect for teardown/HMR. */
export function observeResize(element: HTMLElement, callback: (width: number, height: number) => void): () => void {
  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect) callback(rect.width, rect.height)
  })
  observer.observe(element)
  callback(element.clientWidth, element.clientHeight)
  return () => observer.disconnect()
}
