/** Browser capability adapter. Gameplay never depends on the raw pointer-lock API. */
export interface PointerLockHandle {
  locked(): boolean
  request(): Promise<boolean>
  release(): void
  onChange(callback: (locked: boolean) => void): () => void
  destroy(): void
}

export function createPointerLock(canvas: HTMLCanvasElement): PointerLockHandle {
  const subscribers = new Set<(locked: boolean) => void>()

  const isLocked = (): boolean => document.pointerLockElement === canvas
  const onChange = (): void => {
    const value = isLocked()
    for (const callback of subscribers) callback(value)
  }

  document.addEventListener('pointerlockchange', onChange)

  return {
    locked: isLocked,
    async request() {
      try {
        await canvas.requestPointerLock()
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
      subscribers.clear()
    },
  }
}
