import { BLOCKS } from '../data/blocks'
import type { VoxelCoord } from './coords'
import type { VoxelWorld } from './world'

export interface RayHit {
  readonly voxel: VoxelCoord
  readonly adjacent: VoxelCoord
  readonly normal: VoxelCoord
  readonly distance: number
}

export function raycastVoxels(
  world: VoxelWorld,
  origin: VoxelCoord,
  direction: VoxelCoord,
  maxDistance: number,
): RayHit | null {
  const length = Math.hypot(direction.x, direction.y, direction.z)
  if (length < 0.000001) return null
  const dx = direction.x / length
  const dy = direction.y / length
  const dz = direction.z / length
  let x = Math.floor(origin.x)
  let y = Math.floor(origin.y)
  let z = Math.floor(origin.z)
  const stepX = Math.sign(dx)
  const stepY = Math.sign(dy)
  const stepZ = Math.sign(dz)
  const deltaX = stepX === 0 ? Infinity : Math.abs(1 / dx)
  const deltaY = stepY === 0 ? Infinity : Math.abs(1 / dy)
  const deltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz)
  let maxX = stepX > 0 ? (x + 1 - origin.x) * deltaX : (origin.x - x) * deltaX
  let maxY = stepY > 0 ? (y + 1 - origin.y) * deltaY : (origin.y - y) * deltaY
  let maxZ = stepZ > 0 ? (z + 1 - origin.z) * deltaZ : (origin.z - z) * deltaZ
  let distance = 0
  let normal = { x: 0, y: 0, z: 0 }

  while (distance <= maxDistance) {
    if (world.getBlock(x, y, z) !== BLOCKS.air.id) {
      return {
        voxel: { x, y, z },
        adjacent: { x: x + normal.x, y: y + normal.y, z: z + normal.z },
        normal,
        distance,
      }
    }
    if (maxX <= maxY && maxX <= maxZ) {
      x += stepX; distance = maxX; maxX += deltaX
      normal = { x: -stepX, y: 0, z: 0 }
    } else if (maxY <= maxZ) {
      y += stepY; distance = maxY; maxY += deltaY
      normal = { x: 0, y: -stepY, z: 0 }
    } else {
      z += stepZ; distance = maxZ; maxZ += deltaZ
      normal = { x: 0, y: 0, z: -stepZ }
    }
  }
  return null
}

