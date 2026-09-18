import * as pc from 'playcanvas'
import type { CollectibleKey } from '../content/config'
import type {
  CollectiblePlacement, MeshPlacement, WorldContentPlan,
} from '../content/types'
import type { TimeOfDay } from '../environment/config'
import type { GameConfig } from '../game.config'
import {
  addBox, builder, rgb, vertexMaterial, type MeshBuilder,
} from './environment-geometry'

interface MeshSlot {
  entity: pc.Entity
  mesh: pc.Mesh
  instance: pc.MeshInstance
}

export interface ContentStats {
  drawCalls: number
  trees: number
  decorations: number
  collectibles: number
  landmarks: number
}

export interface ContentHandle {
  update(dt: number): void
  reset(plan: WorldContentPlan, collectibles: readonly boolean[], decorations: readonly boolean[]): void
  setPaused(paused: boolean): void
  setTimeOfDay(mode: TimeOfDay): void
  setCollectibleActive(index: number, active: boolean): void
  setDecorationActive(index: number, active: boolean): void
  stats(): ContentStats
  destroy(): void
}

function createSlot(name: string, root: pc.Entity, device: pc.GraphicsDevice, material: pc.Material): MeshSlot {
  const mesh = new pc.Mesh(device)
  // MeshInstance caches its shader feature flags when it is constructed. Prime the
  // reusable mesh with the final vertex layout so later uploads keep vertex colors.
  mesh.setPositions(new Float32Array(9))
  mesh.setNormals(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]))
  mesh.setColors32(new Uint8Array([
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
  ]))
  mesh.setIndices(new Uint32Array([0, 1, 2]))
  mesh.update(pc.PRIMITIVE_TRIANGLES)
  const entity = new pc.Entity(name)
  entity.addComponent('render')
  const instance = new pc.MeshInstance(mesh, material)
  instance.castShadow = false; instance.receiveShadow = false; instance.visible = false
  entity.render!.meshInstances = [instance]
  root.addChild(entity)
  return { entity, mesh, instance }
}

function upload(slot: MeshSlot, data: MeshBuilder): void {
  if (data.positions.length === 0) {
    slot.instance.visible = false
    return
  }
  slot.mesh.clear(true, true, data.positions.length / 3, data.indices.length)
  slot.mesh.setPositions(new Float32Array(data.positions))
  slot.mesh.setNormals(new Float32Array(data.normals))
  slot.mesh.setColors32(new Uint8Array(data.colors))
  slot.mesh.setIndices(new Uint32Array(data.indices))
  slot.mesh.update(pc.PRIMITIVE_TRIANGLES)
  slot.instance.visible = true
}

function addVegetation(data: MeshBuilder, item: MeshPlacement): void {
  const color = rgb(item.color)
  const x = item.x + 0.5; const z = item.z + 0.5
  if (item.archetype === 'bush') {
    addBox(data, [x, item.y + 0.28 * item.scale, z], [0.78 * item.scale, 0.55 * item.scale, 0.76 * item.scale], color)
    addBox(data, [x + 0.24, item.y + 0.36 * item.scale, z - 0.15], [0.46 * item.scale, 0.48 * item.scale, 0.48 * item.scale], color)
  } else if (item.archetype === 'flower') {
    addBox(data, [x, item.y + 0.25 * item.scale, z], [0.08, 0.5 * item.scale, 0.08], rgb('#5e9c4c'))
    addBox(data, [x, item.y + 0.52 * item.scale, z], [0.34 * item.scale, 0.18, 0.34 * item.scale], color)
  } else {
    const height = 0.75 * item.scale
    addBox(data, [x - 0.12, item.y + height * 0.5, z], [0.1, height, 0.1], color)
    addBox(data, [x + 0.13, item.y + height * 0.42, z + 0.08], [0.09, height * 0.84, 0.09], color)
  }
}

function addProp(data: MeshBuilder, item: MeshPlacement): void {
  const color = rgb(item.color)
  const x = item.x + 0.5; const z = item.z + 0.5
  if (item.archetype === 'rock') {
    addBox(data, [x, item.y + 0.2 * item.scale, z], [0.58 * item.scale, 0.4 * item.scale, 0.7 * item.scale], color)
  } else if (item.archetype === 'signpost') {
    addBox(data, [x, item.y + 0.72 * item.scale, z], [0.14, 1.45 * item.scale, 0.14], rgb('#765032'))
    const alongX = item.rotation % 2 === 0
    addBox(data, [x, item.y + 1.22 * item.scale, z], alongX
      ? [0.95 * item.scale, 0.38 * item.scale, 0.12]
      : [0.12, 0.38 * item.scale, 0.95 * item.scale], color)
  } else if (item.archetype === 'campfire') {
    addBox(data, [x, item.y + 0.12, z], [1.05, 0.18, 0.2], rgb('#69442d'))
    addBox(data, [x, item.y + 0.12, z], [0.2, 0.18, 1.05], rgb('#805035'))
    for (const [dx, dz] of [[-0.48, 0], [0.48, 0], [0, -0.48], [0, 0.48]] as const) {
      addBox(data, [x + dx, item.y + 0.12, z + dz], [0.26, 0.24, 0.26], rgb('#777b78'))
    }
  }
}

function addFlame(data: MeshBuilder, item: MeshPlacement): void {
  if (item.archetype !== 'campfire') return
  const x = item.x + 0.5; const z = item.z + 0.5
  addBox(data, [x, item.y + 0.48, z], [0.25, 0.62, 0.25], rgb('#ffb13b'))
  addBox(data, [x + 0.08, item.y + 0.45, z - 0.04], [0.18, 0.38, 0.18], rgb('#ff6544'))
}

function addCollectible(data: MeshBuilder, item: CollectiblePlacement): void {
  if (item.key === 'apple') {
    addBox(data, [item.x, item.y + 0.14, item.z], [0.28 * item.scale, 0.28 * item.scale, 0.28 * item.scale], rgb(item.color))
    addBox(data, [item.x + 0.03, item.y + 0.32, item.z], [0.06, 0.13, 0.06], rgb('#5a442b'))
    addBox(data, [item.x + 0.1, item.y + 0.34, item.z], [0.13, 0.05, 0.08], rgb('#5f9f4d'))
  } else {
    addBox(data, [item.x, item.y + 0.12, item.z], [0.1, 0.24 * item.scale, 0.1], rgb('#efe1bf'))
    addBox(data, [item.x, item.y + 0.27, item.z], [0.3 * item.scale, 0.16 * item.scale, 0.3 * item.scale], rgb(item.color))
  }
}

export function createContent(
  app: pc.Application, initialPlan: WorldContentPlan, initialActive: readonly boolean[], config: GameConfig,
): ContentHandle {
  const root = new pc.Entity('Procedural Content')
  app.root.addChild(root)
  const worldMaterial = vertexMaterial(false)
  const collectibleMaterial = vertexMaterial(false)
  const flameMaterial = vertexMaterial(false)
  const vegetation = createSlot('Merged Vegetation', root, app.graphicsDevice, worldMaterial)
  const props = createSlot('Merged Props', root, app.graphicsDevice, worldMaterial)
  const apples = createSlot('Merged Apples', root, app.graphicsDevice, collectibleMaterial)
  const mushrooms = createSlot('Merged Mushrooms', root, app.graphicsDevice, collectibleMaterial)
  const flames = createSlot('Merged Campfire Flames', root, app.graphicsDevice, flameMaterial)
  let plan = initialPlan
  let active = new Uint8Array(initialPlan.collectibles.length)
  let decorationActive = new Uint8Array(initialPlan.meshes.length)
  let paused = false
  let flameTime = 0
  let destroyed = false

  const rebuildStatic = (): void => {
    const vegetationData = builder(); const propData = builder(); const flameData = builder()
    plan.meshes.forEach((item, index) => {
      if (decorationActive[index] !== 1) return
      if (item.archetype === 'bush' || item.archetype === 'flower' || item.archetype === 'reed') addVegetation(vegetationData, item)
      else addProp(propData, item)
      addFlame(flameData, item)
    })
    upload(vegetation, vegetationData); upload(props, propData); upload(flames, flameData)
  }
  const rebuildCollectible = (key: CollectibleKey): void => {
    const data = builder()
    plan.collectibles.forEach((item, index) => {
      if (item.key === key && active[index] === 1) addCollectible(data, item)
    })
    upload(key === 'apple' ? apples : mushrooms, data)
  }
  const reset = (
    nextPlan: WorldContentPlan, nextActive: readonly boolean[], nextDecorations: readonly boolean[],
  ): void => {
    plan = nextPlan
    active = new Uint8Array(plan.collectibles.length)
    for (let index = 0; index < active.length; index += 1) active[index] = nextActive[index] === false ? 0 : 1
    decorationActive = new Uint8Array(plan.meshes.length)
    for (let index = 0; index < decorationActive.length; index += 1) {
      decorationActive[index] = nextDecorations[index] === false ? 0 : 1
    }
    flameTime = 0
    rebuildStatic(); rebuildCollectible('apple'); rebuildCollectible('mushroom')
  }
  const setTimeOfDay = (mode: TimeOfDay): void => {
    const tint = rgb(config.environment.sky.presets[mode].worldTint)
    for (const material of [worldMaterial, collectibleMaterial]) {
      material.emissive.set(tint[0] / 255, tint[1] / 255, tint[2] / 255); material.update()
    }
  }
  reset(initialPlan, initialActive, initialPlan.meshes.map(() => true))
  setTimeOfDay(config.environment.sky.initialMode)

  return {
    update(dt) {
      if (destroyed || paused || !flames.instance.visible) return
      flameTime += dt
      const pulse = 0.72 + Math.sin(flameTime * 8) * 0.12
      flameMaterial.emissive.set(1, pulse, 0.3); flameMaterial.update()
    },
    reset,
    setPaused(value) { paused = value },
    setTimeOfDay,
    setCollectibleActive(index, value) {
      if (destroyed || index < 0 || index >= active.length) return
      const next = value ? 1 : 0
      if (active[index] === next) return
      active[index] = next
      rebuildCollectible(plan.collectibles[index].key)
    },
    setDecorationActive(index, value) {
      if (destroyed || index < 0 || index >= decorationActive.length) return
      const next = value ? 1 : 0
      if (decorationActive[index] === next) return
      decorationActive[index] = next
      rebuildStatic()
    },
    stats() {
      const drawCalls = [vegetation, props, apples, mushrooms, flames].filter((slot) => slot.instance.visible).length
      return {
        drawCalls, trees: plan.trees.length,
        decorations: decorationActive.reduce((sum, value) => sum + value, 0) + plan.voxelProps.length,
        collectibles: active.reduce((sum, value) => sum + value, 0),
        landmarks: plan.discoveries.length,
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true; root.destroy()
      for (const slot of [vegetation, props, apples, mushrooms, flames]) slot.mesh.destroy()
      worldMaterial.destroy(); collectibleMaterial.destroy(); flameMaterial.destroy()
    },
  }
}
