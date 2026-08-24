import * as pc from 'playcanvas'
import type { AssetsHandle } from '../rabbit/assets'
import { makeMat } from './helpers'
import type { GameConfig } from '../game.config'
import type { ChunkCoord, VoxelCoord } from '../voxel/coords'
import { chunkKey } from '../voxel/coords'
import { buildChunkMesh } from '../voxel/mesher'
import type { VoxelWorld } from '../voxel/world'

interface ChunkRender {
  entity: pc.Entity
  mesh: pc.Mesh
}

export interface WorldViewHandle {
  rebuildAll(): void
  markDirty(coords: readonly ChunkCoord[]): void
  update(): void
  setSelection(voxel: VoxelCoord | null): void
  setSockets(occupied: readonly boolean[]): void
  stats(): { chunks: number; faces: number; triangles: number; drawCalls: number; maxRemeshMs: number }
  destroy(): void
}

function upload(mesh: pc.Mesh, world: VoxelWorld, coord: ChunkCoord, config: GameConfig): number {
  const chunk = world.allChunks().find((item) => chunkKey(item.coord) === chunkKey(coord))
  if (!chunk) return 0
  const data = buildChunkMesh(world, chunk, config)
  if (data.positions.length === 0) {
    mesh.clear(true, true, 3, 3)
    mesh.setPositions(new Float32Array(9))
    mesh.setNormals(new Float32Array(9))
    mesh.setUvs(0, new Float32Array(6))
    mesh.setColors32(new Uint8Array(12))
    mesh.setIndices(new Uint16Array([0, 1, 2]))
    mesh.update(pc.PRIMITIVE_TRIANGLES)
    return 0
  }
  mesh.clear(true, true, data.positions.length / 3, data.indices.length)
  mesh.setPositions(data.positions)
  mesh.setNormals(data.normals)
  mesh.setUvs(0, data.uvs)
  mesh.setColors32(data.colors)
  mesh.setIndices(data.indices)
  mesh.update(pc.PRIMITIVE_TRIANGLES)
  return data.faces
}

export function createWorldView(
  app: pc.Application,
  world: VoxelWorld,
  assets: AssetsHandle,
  config: GameConfig,
): WorldViewHandle {
  const root = new pc.Entity('Voxel World')
  app.root.addChild(root)
  const texture = assets.texture('blockAtlas')
  if (!texture) throw new Error('Boot-critical texture blockAtlas is unavailable')
  texture.magFilter = pc.FILTER_NEAREST
  texture.minFilter = pc.FILTER_NEAREST
  texture.mipmaps = false
  texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE
  texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE

  const material = new pc.StandardMaterial()
  material.useLighting = false
  material.diffuse.set(0, 0, 0)
  material.emissive.set(1, 1, 1)
  material.emissiveMap = texture
  material.emissiveVertexColor = true
  material.gloss = 0
  material.metalness = 0
  material.update()

  const chunkRenders = new Map<string, ChunkRender>()
  const faceCounts = new Map<string, number>()
  const dirty = new Map<string, ChunkCoord>()
  let maxRemeshMs = 0

  for (const chunk of world.allChunks()) {
    const entity = new pc.Entity(`Chunk ${chunkKey(chunk.coord)}`)
    const origin = world.chunkOrigin(chunk.coord)
    entity.setLocalPosition(origin.x, origin.y, origin.z)
    const mesh = new pc.Mesh(app.graphicsDevice)
    faceCounts.set(chunkKey(chunk.coord), upload(mesh, world, chunk.coord, config))
    const meshInstance = new pc.MeshInstance(mesh, material)
    meshInstance.castShadow = false
    meshInstance.receiveShadow = false
    entity.addComponent('render')
    entity.render!.meshInstances = [meshInstance]
    root.addChild(entity)
    chunkRenders.set(chunkKey(chunk.coord), { entity, mesh })
  }

  const selectionMaterial = makeMat(config.visual.selection, {
    emissive: config.visual.selection, emissiveIntensity: 1.6, opacity: 0.42,
  })
  const selection = new pc.Entity('Selection')
  selection.addComponent('render', { type: 'box', castShadows: false, receiveShadows: false })
  selection.render!.material = selectionMaterial
  selection.setLocalScale(1.012, 1.012, 1.012)
  selection.enabled = false
  root.addChild(selection)
  for (const instance of selection.render!.meshInstances) instance.renderStyle = pc.RENDERSTYLE_WIREFRAME

  const socketMaterials = config.world.beaconSockets.map(() => makeMat(config.visual.socket, {
    emissive: config.visual.socket, emissiveIntensity: 2, opacity: 0.62,
  }))
  const socketMarkers = config.world.beaconSockets.map((socket, index) => {
    const marker = new pc.Entity(`Crystal Socket ${index + 1}`)
    marker.addComponent('render', { type: 'box', castShadows: false, receiveShadows: false })
    marker.render!.material = socketMaterials[index]
    marker.setLocalPosition(socket[0] + 0.5, socket[1] + 0.05, socket[2] + 0.5)
    marker.setLocalScale(0.78, 0.08, 0.78)
    root.addChild(marker)
    return marker
  })

  const rebuild = (coord: ChunkCoord): void => {
    const render = chunkRenders.get(chunkKey(coord))
    if (!render) return
    const start = performance.now()
    faceCounts.set(chunkKey(coord), upload(render.mesh, world, coord, config))
    maxRemeshMs = Math.max(maxRemeshMs, performance.now() - start)
  }

  const handle: WorldViewHandle = {
    rebuildAll() {
      dirty.clear()
      for (const chunk of world.allChunks()) rebuild(chunk.coord)
    },
    markDirty(coords) {
      for (const coord of coords) dirty.set(chunkKey(coord), coord)
    },
    update() {
      let remaining = config.performance.maxChunkRebuildsPerFrame
      for (const [key, coord] of dirty) {
        rebuild(coord)
        dirty.delete(key)
        remaining -= 1
        if (remaining <= 0) break
      }
    },
    setSelection(voxel) {
      selection.enabled = voxel !== null
      if (voxel) selection.setLocalPosition(voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5)
    },
    setSockets(occupied) {
      socketMarkers.forEach((marker, index) => { marker.enabled = !occupied[index] })
    },
    stats() {
      const faces = [...faceCounts.values()].reduce((sum, value) => sum + value, 0)
      return { chunks: chunkRenders.size, faces, triangles: faces * 2, drawCalls: chunkRenders.size, maxRemeshMs }
    },
    destroy() {
      root.destroy()
      material.destroy()
      selectionMaterial.destroy()
      socketMaterials.forEach((item) => item.destroy())
      for (const render of chunkRenders.values()) render.mesh.destroy()
      dirty.clear(); chunkRenders.clear(); faceCounts.clear()
    },
  }
  handle.rebuildAll()
  return handle
}
