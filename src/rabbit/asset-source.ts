/** Validated asset locations and bounded asynchronous work, shared by both stacks. */
export interface LoadOptions { signal?: AbortSignal; timeoutMs?: number; critical?: boolean }
export function assetUrl(path: string): string {
  const url = new URL(path, document.baseURI)
  if (!['http:', 'https:', 'blob:'].includes(url.protocol)) throw new Error('assets: unsupported URL protocol')
  return url.href
}
/** Caller cancellation does not cancel a shared cached load for other consumers. */
export function abortable<T>(work: Promise<T>, options: LoadOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('assets: load timed out')), options.timeoutMs ?? 30000)
    const onAbort = () => finish(new DOMException('Asset load aborted', 'AbortError'))
    let done = false
    function finish(error?: unknown, value?: T): void {
      if (done) return
      done = true
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve(value as T)
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) onAbort()
    work.then((value) => finish(undefined, value), (error: unknown) => finish(error))
  })
}
