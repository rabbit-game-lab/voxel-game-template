import * as pc from 'playcanvas'
import type { AssetsHandle } from '../rabbit/assets'
import type { TimeOfDay } from '../environment/config'
import { color, makeMat } from './helpers'
import type { GameConfig } from '../game.config'
import type { ChunkCoord, VoxelCoord } from '../voxel/coords'
import { chunkKey } from '../voxel/coords'
import { buildChunkMesh, buildLiquidChunkMesh } from '../voxel/mesher'
import type { MiningSnapshot } from '../sim/mining'
import { createBlockCracks } from './block-cracks'
import type { VoxelWorld } from '../voxel/world'

interface ChunkRender {
  entity: pc.Entity
  opaqueMesh: pc.Mesh
  liquidMesh: pc.Mesh
  liquidInstance: pc.MeshInstance
}

export interface WorldViewHandle {
  rebuildAll(): void
  markDirty(coords: readonly ChunkCoord[]): void
  update(): void
  setSelection(voxel: VoxelCoord | null): void
  setCracks(mining: MiningSnapshot | null): void
  setSockets(occupied: readonly boolean[], visible?: boolean): void
  setTimeOfDay(mode: TimeOfDay): void
  stats(): {
    chunks: number; faces: number; liquidFaces: number; triangles: number
    drawCalls: number; waterDrawCalls: number; maxRemeshMs: number
  }
  destroy(): void
}

function emptyMesh(mesh: pc.Mesh, withUvs: boolean): void {
  mesh.clear(true, true, 3, 3)
  mesh.setPositions(new Float32Array(9))
  mesh.setNormals(new Float32Array(9))
  if (withUvs) mesh.setUvs(0, new Float32Array(6))
  mesh.setColors32(new Uint8Array(12))
  mesh.setIndices(new Uint16Array([0, 1, 2]))
  mesh.update(pc.PRIMITIVE_TRIANGLES)
}

function uploadOpaque(mesh: pc.Mesh, world: VoxelWorld, coord: ChunkCoord, config: GameConfig): number {
  const chunk = world.allChunks().find((item) => chunkKey(item.coord) === chunkKey(coord))
  if (!chunk) return 0
  const data = buildChunkMesh(world, chunk, config)
  if (data.positions.length === 0) {
    emptyMesh(mesh, true)
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

function uploadLiquid(mesh: pc.Mesh, world: VoxelWorld, coord: ChunkCoord, config: GameConfig): number {
  const chunk = world.allChunks().find((item) => chunkKey(item.coord) === chunkKey(coord))
  if (!chunk) return 0
  const data = buildLiquidChunkMesh(world, chunk, config)
  if (data.positions.length === 0) {
    emptyMesh(mesh, false)
    return 0
  }
  mesh.clear(true, true, data.positions.length / 3, data.indices.length)
  mesh.setPositions(data.positions)
  mesh.setNormals(data.normals)
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

  const liquidMaterial = new pc.StandardMaterial()
  liquidMaterial.useLighting = false
  liquidMaterial.diffuse.set(0, 0, 0)
  liquidMaterial.emissive.set(1, 1, 1)
  liquidMaterial.emissiveVertexColor = true
  liquidMaterial.opacity = config.environment.water.opacity
  liquidMaterial.blendType = pc.BLEND_NORMAL
  liquidMaterial.depthWrite = false
  liquidMaterial.gloss = 0
  liquidMaterial.cull = pc.CULLFACE_NONE
  liquidMaterial.update()

  const setTimeOfDay = (mode: TimeOfDay): void => {
    const preset = config.environment.sky.presets[mode]
    material.emissive.copy(color(preset.worldTint)); material.update()
    liquidMaterial.emissive.copy(color(preset.waterTint)); liquidMaterial.update()
  }
  setTimeOfDay(config.environment.sky.initialMode)

  const chunkRenders = new Map<string, ChunkRender>()
  const faceCounts = new Map<string, { opaque: number; liquid: number }>()
  const dirty = new Map<string, ChunkCoord>()
  let maxRemeshMs = 0

  for (const chunk of world.allChunks()) {
    const entity = new pc.Entity(`Chunk ${chunkKey(chunk.coord)}`)
    const origin = world.chunkOrigin(chunk.coord)
    entity.setLocalPosition(origin.x, origin.y, origin.z)
    const opaqueMesh = new pc.Mesh(app.graphicsDevice)
    const liquidMesh = new pc.Mesh(app.graphicsDevice)
    const opaqueFaces = uploadOpaque(opaqueMesh, world, chunk.coord, config)
    const liquidFaces = uploadLiquid(liquidMesh, world, chunk.coord, config)
    faceCounts.set(chunkKey(chunk.coord), { opaque: opaqueFaces, liquid: liquidFaces })
    const opaqueInstance = new pc.MeshInstance(opaqueMesh, material)
    opaqueInstance.castShadow = false
    opaqueInstance.receiveShadow = false
    const liquidInstance = new pc.MeshInstance(liquidMesh, liquidMaterial)
    liquidInstance.castShadow = false
    liquidInstance.receiveShadow = false
    liquidInstance.visible = liquidFaces > 0
    entity.addComponent('render')
    entity.render!.meshInstances = [opaqueInstance, liquidInstance]
    root.addChild(entity)
    chunkRenders.set(chunkKey(chunk.coord), { entity, opaqueMesh, liquidMesh, liquidInstance })
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
  const cracks = createBlockCracks(root, app.graphicsDevice)

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
    const opaque = uploadOpaque(render.opaqueMesh, world, coord, config)
    const liquid = uploadLiquid(render.liquidMesh, world, coord, config)
    render.liquidInstance.visible = liquid > 0
    faceCounts.set(chunkKey(coord), { opaque, liquid })
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
    setCracks: (mining) => cracks.set(mining),
    setSockets(occupied, visible = true) {
      socketMarkers.forEach((marker, index) => { marker.enabled = visible && !occupied[index] })
    },
    setTimeOfDay,
    stats() {
      const opaqueFaces = [...faceCounts.values()].reduce((sum, value) => sum + value.opaque, 0)
      const liquidFaces = [...faceCounts.values()].reduce((sum, value) => sum + value.liquid, 0)
      const waterDrawCalls = [...faceCounts.values()].filter((value) => value.liquid > 0).length
      const faces = opaqueFaces + liquidFaces
      return {
        chunks: chunkRenders.size, faces, liquidFaces, triangles: faces * 2,
        drawCalls: chunkRenders.size + waterDrawCalls, waterDrawCalls, maxRemeshMs,
      }
    },
    destroy() {
      root.destroy()
      material.destroy(); liquidMaterial.destroy()
      selectionMaterial.destroy(); cracks.destroy()
      socketMaterials.forEach((item) => item.destroy())
      for (const render of chunkRenders.values()) {
        render.opaqueMesh.destroy(); render.liquidMesh.destroy()
      }
      dirty.clear(); chunkRenders.clear(); faceCounts.clear()
    },
  }
  handle.rebuildAll()
  return handle
}
