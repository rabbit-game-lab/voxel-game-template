import { BLOCKS } from '../data/blocks'
import type { GameConfig } from '../game.config'
import { VoxelWorld } from './world'

function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value)
}

function valueNoise(x: number, z: number, seed: number): number {
  const scale = 0.13
  const sx = x * scale
  const sz = z * scale
  const x0 = Math.floor(sx)
  const z0 = Math.floor(sz)
  const tx = smooth(sx - x0)
  const tz = smooth(sz - z0)
  const a = hash2(x0, z0, seed)
  const b = hash2(x0 + 1, z0, seed)
  const c = hash2(x0, z0 + 1, seed)
  const d = hash2(x0 + 1, z0 + 1, seed)
  const top = a + (b - a) * tx
  const bottom = c + (d - c) * tx
  return top + (bottom - top) * tz
}

function terrainHeight(x: number, z: number, config: GameConfig): number {
  const radiusX = config.world.size[0] * 0.5
  const radiusZ = config.world.size[2] * 0.5
  const radial = Math.max(0, 1 - Math.hypot(x / radiusX, z / radiusZ))
  const noise = valueNoise(x, z, config.world.seed) * 2 - 1
  return Math.max(2, Math.min(13, Math.floor(5 + radial * 7 + noise * 1.8)))
}

function fillColumn(world: VoxelWorld, x: number, z: number, top: number): void {
  for (let y = world.bounds.min.y; y <= top; y += 1) {
    const block = y === world.bounds.min.y ? BLOCKS.bedrock.id
      : y === top ? BLOCKS.grass.id
        : y >= top - 3 ? BLOCKS.dirt.id : BLOCKS.stone.id
    world.setBlock(x, y, z, block)
  }
  for (let y = top + 1; y < world.bounds.maxExclusive.y; y += 1) {
    world.setBlock(x, y, z, BLOCKS.air.id)
  }
}

function flatten(world: VoxelWorld, centerX: number, centerZ: number, radius: number, top: number): void {
  for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (world.contains(x, top, z)) fillColumn(world, x, z, top)
    }
  }
}

function addTree(world: VoxelWorld, x: number, z: number): void {
  const ground = world.highestSolidY(x, z)
  if (ground === null || ground + 5 >= world.bounds.maxExclusive.y) return
  for (let y = ground + 1; y <= ground + 3; y += 1) world.setBlock(x, y, z, BLOCKS.planks.id)
  for (let y = ground + 3; y <= ground + 4; y += 1) {
    const radius = y === ground + 3 ? 2 : 1
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dz) <= radius + 1) {
          world.setBlock(x + dx, y, z + dz, BLOCKS.grass.id)
        }
      }
    }
  }
}

export function generateWorld(world: VoxelWorld, config: GameConfig): void {
  world.reset()
  const { min, maxExclusive } = world.bounds
  for (let z = min.z; z < maxExclusive.z; z += 1) {
    for (let x = min.x; x < maxExclusive.x; x += 1) {
      fillColumn(world, x, z, terrainHeight(x, z, config))
    }
  }

  const plateau = config.world.plateauCenter
  flatten(world, plateau[0], plateau[2], 5, plateau[1])

  const beacon = config.world.beaconBase
  flatten(world, beacon[0] + 1, beacon[2], 3, beacon[1] - 1)
  for (let z = beacon[2] - 1; z <= beacon[2] + 1; z += 1) {
    for (let x = beacon[0] - 1; x <= beacon[0] + 3; x += 1) {
      world.setBlock(x, beacon[1], z, BLOCKS.stone.id)
    }
  }
  for (const socket of config.world.beaconSockets) {
    world.setBlock(socket[0], socket[1], socket[2], BLOCKS.air.id)
  }

  for (const node of config.world.crystalNodes) {
    flatten(world, node[0], node[2], 2, node[1] - 1)
    world.setBlock(node[0], node[1], node[2], BLOCKS.crystal.id)
  }
  for (const tree of config.world.trees) addTree(world, tree[0], tree[1])
}

