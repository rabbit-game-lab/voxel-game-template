import { CHUNK_SIZE } from './constants'

export interface VoxelCoord { x: number; y: number; z: number }
export interface ChunkCoord { x: number; y: number; z: number }
export interface WorldBounds {
  readonly min: VoxelCoord
  readonly size: VoxelCoord
  readonly maxExclusive: VoxelCoord
}

export function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor)
}

export function euclideanMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function chunkKey(coord: ChunkCoord): string {
  return `${coord.x},${coord.y},${coord.z}`
}

export function worldToChunk(value: number, worldMin: number): number {
  return floorDiv(value - worldMin, CHUNK_SIZE)
}

export function worldToLocal(value: number, worldMin: number): number {
  return euclideanMod(value - worldMin, CHUNK_SIZE)
}

/** x changes fastest, then z, then y. */
export function voxelIndex(x: number, y: number, z: number): number {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y)
}

export function sameVoxel(a: VoxelCoord, b: VoxelCoord): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z
}

