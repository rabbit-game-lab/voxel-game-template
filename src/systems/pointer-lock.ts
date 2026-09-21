/** Browser capability adapter. Gameplay never depends on the raw pointer-lock API. */
export interface PointerLockHandle {
  locked(): boolean
  allowed(): boolean
  request(): Promise<boolean>
  release(): void
  onChange(callback: (locked: boolean) => void): () => void
  destroy(): void
}

function policyAllowsPointerLock(): boolean {
  const doc = document as Document & {
    featurePolicy?: { allowsFeature(name: string): boolean }
    permissionsPolicy?: { allowsFeature(name: string): boolean }
  }
  const policy = doc.permissionsPolicy ?? doc.featurePolicy
  if (!policy || typeof policy.allowsFeature !== 'function') return true
  try {
    return policy.allowsFeature('pointer-lock')
  } catch {
    return true
  }
}

export function createPointerLock(canvas: HTMLCanvasElement): PointerLockHandle {
  const subscribers = new Set<(locked: boolean) => void>()

  const isLocked = (): boolean => document.pointerLockElement === canvas
  const onChange = (): void => {
    const value = isLocked()
    for (const callback of subscribers) callback(value)
  }

  document.addEventListener('pointerlockchange', onChange)
  document.addEventListener('pointerlockerror', onChange)

  return {
    locked: isLocked,
    allowed: () => typeof canvas.requestPointerLock === 'function' && policyAllowsPointerLock(),
    async request() {
      if (isLocked()) return true
      if (typeof canvas.requestPointerLock !== 'function') return false
      try {
        const result = canvas.requestPointerLock()
        if (result && typeof result.then === 'function') {
          await new Promise((resolve, reject) => {
            const timer = globalThis.setTimeout(() => reject(new Error('pointer-lock-timeout')), 400)
            result.then(
              (value) => { globalThis.clearTimeout(timer); resolve(value) },
              (err) => { globalThis.clearTimeout(timer); reject(err) },
            )
          })
        }
        return isLocked()
      } catch {
        return false
      }
    },
    release() {
      if (isLocked()) document.exitPointerLock()
    },
    onChange(callback) {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    destroy() {
      if (isLocked()) document.exitPointerLock()
      document.removeEventListener('pointerlockchange', onChange)
      document.removeEventListener('pointerlockerror', onChange)
      subscribers.clear()
    },
  }
}
