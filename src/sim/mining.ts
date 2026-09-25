import type { BlockSpec } from '../data/blocks'
import { PICKAXE_TIERS } from '../data/tools'
import type { GameConfig } from '../game.config'
import { sameVoxel, type VoxelCoord } from '../voxel/coords'

/** Minecraft swings (and plays a dig sound) every 4 ticks while mining. */
const HIT_INTERVAL = 0.2
export const DESTROY_STAGES = 10

/** Seconds to break a block with the configured pickaxe, Minecraft formula. */
export function breakSeconds(spec: BlockSpec, config: GameConfig): number {
  const mining = config.interaction.mining
  const speed = spec.tool === 'pickaxe' ? PICKAXE_TIERS[mining.pickaxe].speed : 1
  return spec.hardness * 1.5 / speed * mining.timeScale
}

export interface MiningSnapshot {
  voxel: VoxelCoord
  /** 0 … DESTROY_STAGES - 1, the crack texture to draw. */
  stage: number
}

export interface MiningStep {
  done: boolean
  hit: boolean
}

/**
 * Progress on the block under the crosshair. Releasing the button, aiming at
 * another block or the block changing restarts from zero, like Minecraft.
 */
export class MiningProgress {
  private voxel: VoxelCoord | null = null
  private blockId = -1
  private elapsed = 0
  private total = 0
  private hitTimer = 0

  reset(): void {
    this.voxel = null; this.blockId = -1; this.elapsed = 0; this.total = 0; this.hitTimer = 0
  }

  step(voxel: VoxelCoord, blockId: number, seconds: number, dt: number): MiningStep {
    if (!this.voxel || !sameVoxel(this.voxel, voxel) || this.blockId !== blockId) {
      this.voxel = { ...voxel }; this.blockId = blockId
      this.elapsed = 0; this.total = seconds; this.hitTimer = 0
    }
    this.elapsed += dt
    this.hitTimer -= dt
    const hit = this.hitTimer <= 0
    if (hit) this.hitTimer += HIT_INTERVAL
    return { done: this.elapsed >= this.total, hit }
  }

  snapshot(): MiningSnapshot | null {
    if (!this.voxel || this.total <= 0 || this.elapsed <= 0) return null
    const stage = Math.min(DESTROY_STAGES - 1, Math.floor(this.elapsed / this.total * DESTROY_STAGES))
    return { voxel: this.voxel, stage }
  }
}
