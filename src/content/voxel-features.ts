import { BLOCKS, type BlockId } from '../data/blocks'
import type { GameConfig } from '../game.config'
import type { VoxelWorld } from '../voxel/world'
import type { TreePlacement, VoxelPropPlacement, WorldContentPlan } from './types'

function setAirOnly(world: VoxelWorld, x: number, y: number, z: number, block: BlockId): void {
  if (world.getBlock(x, y, z) === BLOCKS.air.id) world.setBlock(x, y, z, block)
}

function addOak(world: VoxelWorld, tree: TreePlacement): void {
  for (let offset = 0; offset < tree.height; offset += 1) {
    setAirOnly(world, tree.x, tree.y + offset, tree.z, BLOCKS.wood.id)
  }
  const crownY = tree.y + tree.height - 2
  for (let dy = 0; dy <= 3; dy += 1) {
    const radius = dy === 0 || dy === 1 ? 2 : 1
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const edge = Math.abs(dx) + Math.abs(dz) > radius * 1.65
        if (edge && ((dx * 13 + dz * 7 + dy + tree.variant) & 1) === 0) continue
        if (dx === 0 && dz === 0 && dy < 2) continue
        setAirOnly(world, tree.x + dx, crownY + dy, tree.z + dz, BLOCKS.leaves.id)
      }
    }
  }
}

function addPine(world: VoxelWorld, tree: TreePlacement): void {
  for (let offset = 0; offset < tree.height; offset += 1) {
    setAirOnly(world, tree.x, tree.y + offset, tree.z, BLOCKS.wood.id)
  }
  const first = Math.max(2, tree.height - 6)
  for (let offset = first; offset < tree.height + 1; offset += 1) {
    const fromTop = tree.height - offset
    const radius = fromTop >= 4 ? 2 : fromTop >= 1 ? 1 : 0
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue
        if (dx === 0 && dz === 0 && offset < tree.height) continue
        setAirOnly(world, tree.x + dx, tree.y + offset, tree.z + dz, BLOCKS.leaves.id)
      }
    }
  }
}

function addDeadTree(world: VoxelWorld, tree: TreePlacement): void {
  for (let offset = 0; offset < tree.height; offset += 1) {
    setAirOnly(world, tree.x, tree.y + offset, tree.z, BLOCKS.wood.id)
  }
  const direction = tree.variant % 2 === 0 ? 1 : -1
  const branchY = tree.y + Math.max(2, tree.height - 2)
  setAirOnly(world, tree.x + direction, branchY, tree.z, BLOCKS.wood.id)
  setAirOnly(world, tree.x + direction * 2, branchY, tree.z, BLOCKS.wood.id)
  setAirOnly(world, tree.x, branchY - 1, tree.z - direction, BLOCKS.wood.id)
}

function addTree(world: VoxelWorld, tree: TreePlacement): void {
  if (tree.archetype === 'oak') addOak(world, tree)
  else if (tree.archetype === 'pine') addPine(world, tree)
  else addDeadTree(world, tree)
}

function addFallenLog(world: VoxelWorld, prop: VoxelPropPlacement): void {
  const alongX = prop.rotation % 2 === 0
  const length = Math.max(3, Math.min(5, Math.round(3.5 * prop.scale)))
  for (let offset = 0; offset < length; offset += 1) {
    const x = prop.x + (alongX ? offset : 0)
    const z = prop.z + (alongX ? 0 : offset)
    setAirOnly(world, x, prop.y, z, BLOCKS.wood.id)
  }
}

function addRuin(world: VoxelWorld, prop: VoxelPropPlacement): void {
  const baseY = prop.y
  for (let dz = -3; dz <= 3; dz += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      if (Math.abs(dx) === 3 || Math.abs(dz) === 3 || (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)) {
        world.setBlock(prop.x + dx, baseY, prop.z + dz, BLOCKS.stone.id)
      }
    }
  }
  for (let level = 1; level <= 3; level += 1) {
    for (let offset = -3; offset <= 3; offset += 1) {
      if (level === 3 && Math.abs(offset) % 2 === 1) continue
      if (!(offset === 0 && level < 3)) world.setBlock(prop.x + offset, baseY + level, prop.z - 3, BLOCKS.stone.id)
      if (offset % 2 === 0) world.setBlock(prop.x - 3, baseY + level, prop.z + offset, BLOCKS.stone.id)
    }
  }
  world.setBlock(prop.x + 2, baseY + 1, prop.z + 2, BLOCKS.wood.id)
}

function addOverlook(world: VoxelWorld, prop: VoxelPropPlacement): void {
  for (let dz = -2; dz <= 2; dz += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      world.setBlock(prop.x + dx, prop.y, prop.z + dz, BLOCKS.stone.id)
    }
  }
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) {
    world.setBlock(prop.x + dx, prop.y + 1, prop.z + dz, BLOCKS.wood.id)
  }
}

export function applyVoxelContent(
  world: VoxelWorld, plan: WorldContentPlan, _config: GameConfig,
): void {
  for (const tree of plan.trees) addTree(world, tree)
  for (const prop of plan.voxelProps) {
    if (prop.archetype === 'fallen-log') addFallenLog(world, prop)
    else if (prop.archetype === 'stone-ruin') addRuin(world, prop)
    else addOverlook(world, prop)
  }
}
