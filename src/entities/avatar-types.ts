import type * as pc from 'playcanvas'

export type AvatarMotion = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'

export interface AvatarVisual {
  entity: pc.Entity
  drawCalls: number
  setMotion(motion: AvatarMotion, phase: number): void
  reset(): void
  destroy(): void
}
