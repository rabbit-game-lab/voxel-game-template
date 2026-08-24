import { blockById, type AtlasTile } from '../data/blocks'
import type { GameConfig } from '../game.config'
import { ATLAS_GRID_SIZE, CHUNK_SIZE } from './constants'
import type { VoxelChunk } from './chunk'
import type { VoxelCoord } from './coords'
import type { VoxelWorld } from './world'

export interface ChunkMeshData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly colors: Uint8Array
  readonly indices: Uint32Array
  readonly faces: number
}

interface FaceDef {
  normal: VoxelCoord
  corners: readonly (readonly [number, number, number])[]
  tile: 'top' | 'side' | 'bottom'
  tint: keyof Pick<GameConfig['visual'], 'topTint' | 'sideTint' | 'darkSideTint' | 'bottomTint'>
}

const FACES: readonly FaceDef[] = [
  { normal: { x: 1, y: 0, z: 0 }, corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], tile: 'side', tint: 'sideTint' },
  { normal: { x: -1, y: 0, z: 0 }, corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], tile: 'side', tint: 'darkSideTint' },
  { normal: { x: 0, y: 1, z: 0 }, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 'top', tint: 'topTint' },
  { normal: { x: 0, y: -1, z: 0 }, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 'bottom', tint: 'bottomTint' },
  { normal: { x: 0, y: 0, z: 1 }, corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], tile: 'side', tint: 'sideTint' },
  { normal: { x: 0, y: 0, z: -1 }, corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], tile: 'side', tint: 'darkSideTint' },
]

function appendUvs(target: number[], tile: AtlasTile): void {
  const unit = 1 / ATLAS_GRID_SIZE
  const inset = 0.0008
  const u0 = tile[0] * unit + inset
  const u1 = (tile[0] + 1) * unit - inset
  // PlayCanvas flips browser image data during upload, so source rows still
  // count downward from the atlas' top-left at this boundary.
  const v0 = tile[1] * unit + inset
  const v1 = (tile[1] + 1) * unit - inset
  target.push(u0, v0, u0, v1, u1, v1, u1, v0)
}

export function buildChunkMesh(world: VoxelWorld, chunk: VoxelChunk, config: GameConfig): ChunkMeshData {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const origin = world.chunkOrigin(chunk.coord)
  let faceCount = 0

  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const block = blockById(chunk.get(x, y, z))
        if (!block.solid) continue
        const wx = origin.x + x
        const wy = origin.y + y
        const wz = origin.z + z
        for (const face of FACES) {
          const neighbor = blockById(world.getBlock(wx + face.normal.x, wy + face.normal.y, wz + face.normal.z))
          if (neighbor.solid) continue
          const vertex = positions.length / 3
          for (const corner of face.corners) {
            positions.push(x + corner[0], y + corner[1], z + corner[2])
            normals.push(face.normal.x, face.normal.y, face.normal.z)
            const tint = Math.round(config.visual[face.tint] * 255)
            colors.push(tint, tint, tint, 255)
          }
          appendUvs(uvs, block.tiles[face.tile])
          indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3)
          faceCount += 1
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Uint8Array(colors),
    indices: new Uint32Array(indices),
    faces: faceCount,
  }
}
