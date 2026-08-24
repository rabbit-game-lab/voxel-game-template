import * as pc from 'playcanvas'
import type { GameConfig } from '../game.config'
import type { PlayerState } from '../sim/types'
import type { VoxelWorld } from '../voxel/world'
import { createDecorationFeature, createParticleFeature } from './environment-decorations'
import { makeMat, prim } from './helpers'
import {
  addBox, builder, createMesh, createSkyDome, renderMesh, rgb, seededRandom,
  vertexMaterial, type MeshBuilder,
} from './environment-geometry'

export interface FeatureContext {
  app: pc.Application
  camera: pc.Entity
  world: VoxelWorld
  config: GameConfig
  root: pc.Entity
}

export interface EnvironmentFeatureStats {
  drawCalls: number
  clouds: number
  reeds: number
  rocks: number
  particles: number
}

export interface EnvironmentFeature {
  update(dt: number, player: PlayerState): void
  reset(): void
  setPaused(paused: boolean): void
  stats(): EnvironmentFeatureStats
  destroy(): void
}

export interface EnvironmentHandle {
  update(dt: number, player: PlayerState): void
  reset(): void
  setPaused(paused: boolean): void
  stats(): { drawCalls: number; clouds: number; reeds: number; rocks: number; particles: number }
  destroy(): void
}

function featureStats(
  drawCalls: number,
  counts: Partial<Omit<EnvironmentFeatureStats, 'drawCalls'>> = {},
): EnvironmentFeatureStats {
  return { drawCalls, clouds: 0, reeds: 0, rocks: 0, particles: 0, ...counts }
}

function createSkyFeature(context: FeatureContext): EnvironmentFeature {
  const root = new pc.Entity('Sky Atmosphere')
  context.root.addChild(root)
  const sky = context.config.environment.sky
  const material = vertexMaterial(true)
  material.depthWrite = false
  material.cull = pc.CULLFACE_NONE
  material.update()
  const mesh = createSkyDome(context.app.graphicsDevice, 82, rgb(sky.zenith), rgb(sky.horizon))
  const dome = renderMesh('Gradient Sky', root, mesh, material)
  dome.render!.meshInstances[0].cull = false

  const sunMaterial = makeMat(sky.sunColor, { unlit: true, emissive: sky.sunColor, emissiveIntensity: 1.8 })
  const sunPivot = new pc.Entity('Sun Pivot')
  sunPivot.setLocalEulerAngles(...sky.sunEuler)
  root.addChild(sunPivot)
  prim('Voxel Sun', 'cylinder', {
    parent: sunPivot, material: sunMaterial, position: [0, 0, 65],
    rotation: [90, 0, 0], scale: [5.2, 0.16, 5.2],
  })
  return {
    update() { root.setPosition(context.camera.getPosition()) },
    reset() {}, setPaused() {},
    stats: () => featureStats(2),
    destroy() { root.destroy(); mesh.destroy(); material.destroy(); sunMaterial.destroy() },
  }
}

function addCloud(data: MeshBuilder, x: number, y: number, z: number, scale: number): void {
  const white = rgb('#fff8e5')
  addBox(data, [x, y, z], [scale * 2.8, scale * 0.72, scale * 1.45], white)
  addBox(data, [x - scale * 1.35, y - scale * 0.06, z], [scale * 1.25, scale * 0.56, scale], white)
  addBox(data, [x + scale * 1.4, y - scale * 0.08, z + scale * 0.12], [scale * 1.4, scale * 0.52, scale], white)
  addBox(data, [x + scale * 0.15, y + scale * 0.48, z], [scale * 1.35, scale * 0.66, scale], white)
}

function createCloudFeature(context: FeatureContext): EnvironmentFeature | null {
  const clouds = context.config.environment.clouds
  if (!clouds.enabled || clouds.layers.every((layer) => layer.count === 0)) return null
  const root = new pc.Entity('Voxel Clouds')
  context.root.addChild(root)
  const material = vertexMaterial(false)
  const span = 96
  const runtimes: { entity: pc.Entity; mesh: pc.Mesh; speed: number; offset: number }[] = []
  clouds.layers.forEach((layer, layerIndex) => {
    if (layer.count === 0) return
    const random = seededRandom(context.config.world.seed + clouds.seedOffset + layerIndex * 101)
    const data = builder()
    for (let index = 0; index < layer.count; index += 1) {
      const x = random() * span
      const z = -38 + random() * 76
      const size = layer.scale[0] + random() * (layer.scale[1] - layer.scale[0])
      const y = layer.altitude + random() * 1.2
      addCloud(data, x, y, z, size)
      addCloud(data, x - span, y, z, size)
    }
    const mesh = createMesh(context.app.graphicsDevice, data)
    const entity = renderMesh(`Cloud Layer ${layerIndex + 1}`, root, mesh, material)
    runtimes.push({ entity, mesh, speed: layer.speed, offset: 0 })
  })
  return {
    update(dt) {
      for (const layer of runtimes) {
        layer.offset = (layer.offset + layer.speed * dt) % span
        layer.entity.setLocalPosition(layer.offset, 0, 0)
      }
    },
    reset() { for (const layer of runtimes) { layer.offset = 0; layer.entity.setLocalPosition(0, 0, 0) } },
    setPaused() {},
    stats: () => featureStats(runtimes.length, {
      clouds: clouds.layers.reduce((sum, layer) => sum + layer.count, 0),
    }),
    destroy() { root.destroy(); material.destroy(); runtimes.forEach((layer) => layer.mesh.destroy()) },
  }
}

const FEATURE_FACTORIES = [createSkyFeature, createCloudFeature, createDecorationFeature, createParticleFeature]

export function createEnvironment(
  app: pc.Application,
  camera: pc.Entity,
  world: VoxelWorld,
  config: GameConfig,
): EnvironmentHandle {
  const root = new pc.Entity('Voxel Environment')
  app.root.addChild(root)
  const context = { app, camera, world, config, root }
  const features = FEATURE_FACTORIES.map((factory) => factory(context)).filter((item): item is EnvironmentFeature => item !== null)
  let destroyed = false
  return {
    update(dt, player) { if (!destroyed) features.forEach((feature) => feature.update(dt, player)) },
    reset() { if (!destroyed) features.forEach((feature) => feature.reset()) },
    setPaused(paused) { if (!destroyed) features.forEach((feature) => feature.setPaused(paused)) },
    stats() {
      const total = featureStats(0)
      for (const feature of features) {
        const current = feature.stats()
        total.drawCalls += current.drawCalls
        total.clouds += current.clouds
        total.reeds += current.reeds
        total.rocks += current.rocks
        total.particles += current.particles
      }
      return total
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      features.forEach((feature) => feature.destroy())
      root.destroy()
    },
  }
}
