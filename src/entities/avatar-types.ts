import type * as pc from 'playcanvas'

export type AvatarMotion = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'

export interface AvatarVisual {
  entity: pc.Entity
  drawCalls: number
  setMotion(motion: AvatarMotion, phase: number): void
  /** Right hand that holds the pickaxe; renderers without one hold nothing. */
  hand?: pc.Entity
  /** Arm swing progress 0…1 applied after the locomotion pose. */
  setSwing?(amount: number): void
  reset(): void
  destroy(): void
}
