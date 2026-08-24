import type { BlockId } from '../data/blocks'
import { CHUNK_VOLUME } from './constants'
import type { ChunkCoord } from './coords'
import { voxelIndex } from './coords'

export class VoxelChunk {
  readonly voxels = new Uint8Array(CHUNK_VOLUME)

  constructor(readonly coord: ChunkCoord) {}

  get(x: number, y: number, z: number): BlockId {
    return this.voxels[voxelIndex(x, y, z)] as BlockId
  }

  set(x: number, y: number, z: number, block: BlockId): void {
    this.voxels[voxelIndex(x, y, z)] = block
  }

  clear(): void {
    this.voxels.fill(0)
  }
}

