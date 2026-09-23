/** Canonical shared lifecycle. Vendored by rabbit-kit; edit in the kit only. */
export interface RuntimeState { paused: boolean; muted: boolean; hostPaused: boolean }
type Listener = (state: Readonly<RuntimeState>) => void

/** One coordinator per game document; engines apply the effective state. */
export function createRuntime() {
  const pauses = new Set<string | symbol>()
  const mutes = new Set<string | symbol>()
  const listeners = new Set<Listener>()
  const restarts = new Set<() => void>()
  const host = Symbol('host')
  let bound = false
  let last: RuntimeState = { paused: false, muted: false, hostPaused: false }
  const state = (): RuntimeState => ({ paused: pauses.size > 0, muted: mutes.size > 0, hostPaused: pauses.has(host) })
  function emit(): void {
    const next = state()
    if (next.paused === last.paused && next.muted === last.muted && next.hostPaused === last.hostPaused) return
    last = next
    for (const listener of [...listeners]) listener(Object.freeze({ ...next }))
  }
  function set(reasons: Set<string | symbol>, reason: string | symbol, value: boolean): void {
    if (value) reasons.add(reason)
    else reasons.delete(reason)
    emit()
  }
  function onMessage(event: MessageEvent): void {
    if (event.source !== window.parent) return
    const data: unknown = event.data
    if (!data || typeof data !== 'object') return
    const message = data as Record<string, unknown>
    if (message.type === 'rabbit:pause' && typeof message.paused === 'boolean') set(pauses, host, message.paused)
    if (message.type === 'rabbit:mute' && typeof message.muted === 'boolean') set(mutes, host, message.muted)
    if (message.type === 'rabbit:restart') for (const callback of [...restarts]) callback()
  }
  function bind(): void {
    if (!bound) window.addEventListener('message', onMessage)
    bound = true
  }
  function unbind(): void {
    if (listeners.size || restarts.size || !bound) return
    window.removeEventListener('message', onMessage)
    bound = false
    pauses.delete(host)
    mutes.delete(host)
    last = state()
  }
  return {
    state,
    hostPaused: () => pauses.has(host),
    setPaused: (reason: string | symbol, value: boolean) => set(pauses, reason, value),
    setMuted: (reason: string | symbol, value: boolean) => set(mutes, reason, value),
    subscribe(listener: Listener, immediate = true): () => void {
      bind()
      listeners.add(listener)
      if (immediate) listener(Object.freeze(state()))
      return () => { listeners.delete(listener); unbind() }
    },
    onRestart(callback: () => void): () => void {
      bind()
      restarts.add(callback)
      return () => { restarts.delete(callback); unbind() }
    },
  }
}
export const runtime = createRuntime()

/** Compose a module's own gate with the shared runtime. */
export function pauseGate(apply: (paused: boolean) => void) {
  let local = false
  let shared = runtime.state().paused
  const off = runtime.subscribe((state) => { shared = state.paused; apply(local || shared) })
  return {
    set(value: boolean) { local = value; apply(local || shared) },
    destroy: off,
  }
}
