/**
 * rabbit/sdk — Rabbit platform iframe contract (vendored copy).
 *
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. Its hash is validated by the Contract Gate.
 * It will be replaced by the `@rabbit/game-kit` package with the same API.
 *
 * Provides:
 *  - Handshake:   ready() emits `rabbit:ready`; global errors emit `rabbit:error`.
 *  - Incoming:    `rabbit:pause`, `rabbit:restart`, `rabbit:mute` → init() handlers.
 *  - storage:     safe localStorage wrapper with in-memory fallback
 *                 (sandboxed iframes without allow-same-origin throw without it).
 *  - audio:       AudioContext unlock on the first user gesture.
 *  - Resize:      container observer, never depends on the top frame.
 */

export interface SdkHandlers {
  onPause?: (paused: boolean) => void
  onRestart?: () => void
  onMute?: (muted: boolean) => void
}

function post(type: string, payload?: Record<string, unknown>): void {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, ...payload }, '*')
    }
  } catch {
    // Cross-origin restrictions — nothing to do.
  }
}

// ---------------------------------------------------------------------------
// Safe storage
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, string>()

export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memoryStore.get(key) ?? null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      memoryStore.set(key, value)
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      memoryStore.delete(key)
    }
  },
}

// ---------------------------------------------------------------------------
// Audio unlock
// ---------------------------------------------------------------------------

interface ResumableContext {
  state: string
  resume(): Promise<void>
}

const audioContexts: ResumableContext[] = []
let gestureBound = false

function unlockAll(): void {
  for (const ctx of audioContexts) {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined)
    }
  }
}

function bindGesture(): void {
  if (gestureBound) return
  gestureBound = true
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
  for (const eventName of events) {
    window.addEventListener(eventName, unlockAll, { passive: true })
  }
}

export const audio = {
  /** Registers an AudioContext so the SDK resumes it on the first gesture. */
  register(ctx: ResumableContext): void {
    audioContexts.push(ctx)
    bindGesture()
  },
  /** Forces a resume of every registered context. */
  unlock(): void {
    unlockAll()
  },
}

// ---------------------------------------------------------------------------
// Handshake + incoming messages
// ---------------------------------------------------------------------------

let readySent = false

/** Emits `rabbit:ready` exactly once. Call after the first rendered frame. */
export function ready(): void {
  if (readySent) return
  readySent = true
  post('rabbit:ready')
}

/** Installs global error listeners and Studio incoming-message listeners. */
export function init(handlers: SdkHandlers = {}): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; paused?: boolean; muted?: boolean } | null
    if (!data || typeof data.type !== 'string') return
    switch (data.type) {
      case 'rabbit:pause':
        handlers.onPause?.(data.paused !== false)
        break
      case 'rabbit:restart':
        handlers.onRestart?.()
        break
      case 'rabbit:mute':
        handlers.onMute?.(data.muted !== false)
        break
    }
  })

  window.addEventListener('error', (event: ErrorEvent) => {
    post('rabbit:error', {
      message: String(event.message ?? 'Unknown error'),
      source: event.filename ?? '',
      line: event.lineno ?? 0,
    })
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    post('rabbit:error', { message: String(event.reason ?? 'Unhandled rejection') })
  })

  bindGesture()
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

/** Observes the container and reports its size (calls back immediately). */
export function observeResize(
  element: HTMLElement,
  callback: (width: number, height: number) => void
): void {
  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect) callback(rect.width, rect.height)
  })
  observer.observe(element)
  callback(element.clientWidth, element.clientHeight)
}
