import { BLOCKS, type BlockId } from '../data/blocks'
import type { LakeConfig } from './config'
import type { GameConfig } from '../game.config'

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

/** Approximate signed distance in blocks: negative is water, positive is shore/outside. */
export function lakeSignedDistance(lake: LakeConfig, x: number, z: number, seed: number): number {
  const dx = (x + 0.5 - lake.center[0]) / lake.radius[0]
  const dz = (z + 0.5 - lake.center[2]) / lake.radius[1]
  const angle = Math.atan2(dz, dx)
  const phase = ((hashString(lake.id) ^ seed) >>> 0) / 0xffffffff * Math.PI * 2
  const wave = Math.sin(angle * 3 + phase) * 0.62 + Math.sin(angle * 7 - phase * 0.7) * 0.38
  const boundary = 1 + wave * lake.edgeNoise
  return (Math.hypot(dx, dz) - boundary) * Math.min(lake.radius[0], lake.radius[1])
}

export function naturalWaterAt(config: GameConfig, x: number, y: number, z: number): boolean {
  if (!config.environment.water.enabled) return false
  return config.environment.water.lakes.some((lake) =>
    y === lake.center[1] && lakeSignedDistance(lake, x, z, config.world.seed) <= 0)
}

export function naturalReplacementAt(config: GameConfig, x: number, y: number, z: number): BlockId {
  return naturalWaterAt(config, x, y, z) ? BLOCKS.water.id : BLOCKS.air.id
}
