import { BLOCKS, type BlockId } from '../data/blocks'
import { CHUNK_SIZE } from './constants'
import { VoxelChunk } from './chunk'
import {
  chunkKey, worldToChunk, worldToLocal,
  type ChunkCoord, type VoxelCoord, type WorldBounds,
} from './coords'

export interface BlockEdit {
  readonly changed: boolean
  readonly dirtyChunks: readonly ChunkCoord[]
}

export class VoxelWorld {
  readonly bounds: WorldBounds
  private readonly chunks = new Map<string, VoxelChunk>()

  constructor(min: readonly [number, number, number], size: readonly [number, number, number]) {
    const minCoord = { x: min[0], y: min[1], z: min[2] }
    const sizeCoord = { x: size[0], y: size[1], z: size[2] }
    this.bounds = {
      min: minCoord,
      size: sizeCoord,
      maxExclusive: {
        x: minCoord.x + sizeCoord.x,
        y: minCoord.y + sizeCoord.y,
        z: minCoord.z + sizeCoord.z,
      },
    }
    for (let cy = 0; cy < sizeCoord.y / CHUNK_SIZE; cy += 1) {
      for (let cz = 0; cz < sizeCoord.z / CHUNK_SIZE; cz += 1) {
        for (let cx = 0; cx < sizeCoord.x / CHUNK_SIZE; cx += 1) {
          const coord = { x: cx, y: cy, z: cz }
          this.chunks.set(chunkKey(coord), new VoxelChunk(coord))
        }
      }
    }
  }

  contains(x: number, y: number, z: number): boolean {
    const { min, maxExclusive } = this.bounds
    return x >= min.x && x < maxExclusive.x && y >= min.y && y < maxExclusive.y &&
      z >= min.z && z < maxExclusive.z
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (!this.contains(x, y, z)) return BLOCKS.air.id
    const chunk = this.chunkAtVoxel(x, y, z)
    return chunk?.get(
      worldToLocal(x, this.bounds.min.x),
      worldToLocal(y, this.bounds.min.y),
      worldToLocal(z, this.bounds.min.z),
    ) ?? BLOCKS.air.id
  }

  setBlock(x: number, y: number, z: number, block: BlockId): BlockEdit {
    if (!this.contains(x, y, z)) return { changed: false, dirtyChunks: [] }
    const chunkCoord = this.chunkCoordAtVoxel(x, y, z)
    const chunk = this.chunks.get(chunkKey(chunkCoord))
    if (!chunk) return { changed: false, dirtyChunks: [] }
    const lx = worldToLocal(x, this.bounds.min.x)
    const ly = worldToLocal(y, this.bounds.min.y)
    const lz = worldToLocal(z, this.bounds.min.z)
    if (chunk.get(lx, ly, lz) === block) return { changed: false, dirtyChunks: [] }
    chunk.set(lx, ly, lz, block)
    return { changed: true, dirtyChunks: this.dirtyChunksFor(chunkCoord, lx, ly, lz) }
  }

  reset(): void {
    for (const chunk of this.chunks.values()) chunk.clear()
  }

  allChunks(): readonly VoxelChunk[] {
    return [...this.chunks.values()]
  }

  chunkOrigin(coord: ChunkCoord): VoxelCoord {
    const { min } = this.bounds
    return {
      x: min.x + coord.x * CHUNK_SIZE,
      y: min.y + coord.y * CHUNK_SIZE,
      z: min.z + coord.z * CHUNK_SIZE,
    }
  }

  highestSolidY(x: number, z: number): number | null {
    for (let y = this.bounds.maxExclusive.y - 1; y >= this.bounds.min.y; y -= 1) {
      if (this.getBlock(x, y, z) !== BLOCKS.air.id) return y
    }
    return null
  }

  private chunkAtVoxel(x: number, y: number, z: number): VoxelChunk | undefined {
    return this.chunks.get(chunkKey(this.chunkCoordAtVoxel(x, y, z)))
  }

  private chunkCoordAtVoxel(x: number, y: number, z: number): ChunkCoord {
    const { min } = this.bounds
    return {
      x: worldToChunk(x, min.x),
      y: worldToChunk(y, min.y),
      z: worldToChunk(z, min.z),
    }
  }

  private dirtyChunksFor(coord: ChunkCoord, x: number, y: number, z: number): ChunkCoord[] {
    const result: ChunkCoord[] = [coord]
    const add = (dx: number, dy: number, dz: number): void => {
      const next = { x: coord.x + dx, y: coord.y + dy, z: coord.z + dz }
      if (this.chunks.has(chunkKey(next))) result.push(next)
    }
    if (x === 0) add(-1, 0, 0)
    if (x === CHUNK_SIZE - 1) add(1, 0, 0)
    if (y === 0) add(0, -1, 0)
    if (y === CHUNK_SIZE - 1) add(0, 1, 0)
    if (z === 0) add(0, 0, -1)
    if (z === CHUNK_SIZE - 1) add(0, 0, 1)
    return result
  }
}

