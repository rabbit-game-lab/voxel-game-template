import type { WorldZone } from '../content/config'
import { BLOCKS, blockById } from '../data/blocks'
import { lakeSignedDistance } from '../environment/lakes'
import type { GameConfig } from '../game.config'
import type { VoxelWorld } from '../voxel/world'
import { creatureSpec } from './catalog'
import type { CreatureSpawn } from './types'

interface Candidate { x: number; y: number; z: number; zone: WorldZone }

function randomFactory(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000
  }
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[items[index], items[other]] = [items[other], items[index]]
  }
}

function zoneAt(x: number, z: number, config: GameConfig): WorldZone {
  if (Math.hypot(x - config.world.spawn[0], z - config.world.spawn[2]) <= 8) return 'spawn-meadow'
  for (const lake of config.environment.water.lakes) {
    if (lakeSignedDistance(lake, x, z, config.world.seed) <= lake.shoreWidth + 1.5) return 'shore'
  }
  const centerX = config.world.min[0] + config.world.size[0] * 0.5
  const centerZ = config.world.min[2] + config.world.size[2] * 0.5
  const radial = Math.hypot(
    (x - centerX) / (config.world.size[0] * 0.5),
    (z - centerZ) / (config.world.size[2] * 0.5),
  )
  if (radial > 0.76) return 'coast'
  if (x > 8 && z < -3) return 'highland'
  return 'forest'
}

function candidates(world: VoxelWorld, config: GameConfig): Candidate[] {
  const result: Candidate[] = []
  const { min, maxExclusive } = world.bounds
  for (let z = min.z + 3; z < maxExclusive.z - 3; z += 1) {
    for (let x = min.x + 3; x < maxExclusive.x - 3; x += 1) {
      const ground = world.highestSolidY(x, z)
      if (ground === null || world.getBlock(x, ground, z) !== BLOCKS.grass.id) continue
      if (blockById(world.getBlock(x, ground + 1, z)).solid || blockById(world.getBlock(x, ground + 2, z)).solid) continue
      if (Math.hypot(x + 0.5 - config.world.spawn[0], z + 0.5 - config.world.spawn[2]) < 6) continue
      result.push({ x: x + 0.5, y: ground + 1, z: z + 0.5, zone: zoneAt(x, z, config) })
    }
  }
  return result
}

function bodyClear(world: VoxelWorld, cell: Candidate, height: number): boolean {
  for (let y = cell.y; y < cell.y + height; y += 1) {
    if (blockById(world.getBlock(Math.floor(cell.x), y, Math.floor(cell.z))).solid) return false
  }
  return true
}

export function planCreatures(world: VoxelWorld, config: GameConfig): CreatureSpawn[] {
  const random = randomFactory(config.world.seed + 48121)
  const available = candidates(world, config)
  shuffle(available, random)
  const result: CreatureSpawn[] = []
  const preset = config.creatures.presets[config.creatures.preset]
  for (const group of preset.groups) {
    const spec = creatureSpec(group.species)
    let placed = 0
    for (const cell of available) {
      if (!group.zones.includes(cell.zone)) continue
      if (result.some((other) => Math.hypot(other.x - cell.x, other.z - cell.z) < group.minSpacing)) continue
      if (!bodyClear(world, cell, spec.height * group.scale)) continue
      result.push({
        id: `${group.species}-${placed}`, species: group.species, category: spec.category,
        behavior: group.behavior ?? spec.behavior, x: cell.x, y: cell.y, z: cell.z,
        yaw: random() * 360, scale: group.scale, zone: cell.zone, roamRadius: group.roamRadius,
      })
      placed += 1
      if (placed === group.count) break
    }
    if (placed !== group.count) throw new Error(`Creature planner placed ${placed}/${group.count} ${group.species}`)
  }
  return result
}
