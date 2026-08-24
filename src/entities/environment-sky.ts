import * as pc from 'playcanvas'
import type { TimeOfDay } from '../environment/config'
import type { EnvironmentFeature, EnvironmentFeatureStats, FeatureContext } from './environment'
import {
  addBox, builder, createMesh, createSkyDome, renderMesh, rgb, seededRandom, vertexMaterial,
} from './environment-geometry'
import { makeMat, prim } from './helpers'

interface SkyRuntime {
  root: pc.Entity
  mesh: pc.Mesh
  domeMaterial: pc.Material
  celestialMaterial: pc.Material
}

function stats(drawCalls: number): EnvironmentFeatureStats {
  return { drawCalls, clouds: 0, reeds: 0, rocks: 0, particles: 0 }
}

export function createSkyFeature(context: FeatureContext): EnvironmentFeature {
  const root = new pc.Entity('Sky Atmosphere')
  context.root.addChild(root)
  const config = context.config.environment.sky
  const runtimes = {} as Record<TimeOfDay, SkyRuntime>

  for (const mode of ['day', 'night'] as const) {
    const preset = config.presets[mode]
    const modeRoot = new pc.Entity(mode === 'day' ? 'Day Sky' : 'Night Sky')
    root.addChild(modeRoot)
    const domeMaterial = vertexMaterial(true)
    domeMaterial.depthWrite = false
    domeMaterial.cull = pc.CULLFACE_NONE
    domeMaterial.update()
    const mesh = createSkyDome(context.app.graphicsDevice, 82, rgb(preset.zenith), rgb(preset.horizon))
    const dome = renderMesh(`${mode} Gradient`, modeRoot, mesh, domeMaterial)
    dome.render!.meshInstances[0].cull = false

    const celestialMaterial = makeMat(preset.celestialColor, {
      unlit: true, emissive: preset.celestialColor, emissiveIntensity: mode === 'day' ? 1.8 : 1.25,
    })
    const pivot = new pc.Entity(mode === 'day' ? 'Sun Pivot' : 'Moon Pivot')
    pivot.setLocalEulerAngles(...preset.celestialEuler)
    modeRoot.addChild(pivot)
    prim(mode === 'day' ? 'Voxel Sun' : 'Voxel Moon', 'cylinder', {
      parent: pivot, material: celestialMaterial, position: [0, 0, 65],
      rotation: [90, 0, 0], scale: [preset.celestialScale, 0.16, preset.celestialScale],
    })
    runtimes[mode] = { root: modeRoot, mesh, domeMaterial, celestialMaterial }
  }

  let stars: { entity: pc.Entity; mesh: pc.Mesh; material: pc.Material } | null = null
  if (config.stars.enabled && config.stars.count > 0) {
    const data = builder()
    const random = seededRandom(context.config.world.seed + config.stars.seedOffset)
    for (let index = 0; index < config.stars.count; index += 1) {
      const angle = random() * Math.PI * 2
      const elevation = 0.14 + random() * 1.28
      const radius = 70
      const size = config.stars.size[0] + random() * (config.stars.size[1] - config.stars.size[0])
      addBox(data, [
        Math.cos(angle) * Math.cos(elevation) * radius,
        Math.sin(elevation) * radius,
        Math.sin(angle) * Math.cos(elevation) * radius,
      ], [size, size, size], rgb(config.stars.color))
    }
    const mesh = createMesh(context.app.graphicsDevice, data)
    const material = vertexMaterial(true)
    const entity = renderMesh('Voxel Stars', root, mesh, material)
    stars = { entity, mesh, material }
  }

  let mode: TimeOfDay = config.initialMode
  const setMode = (next: TimeOfDay): void => {
    mode = next
    runtimes.day.root.enabled = next === 'day'
    runtimes.night.root.enabled = next === 'night'
    if (stars) stars.entity.enabled = next === 'night'
  }
  setMode(mode)

  return {
    update() { root.setPosition(context.camera.getPosition()) },
    reset() { setMode(config.initialMode) },
    setPaused() {},
    setTimeOfDay: setMode,
    stats: () => stats(2 + (mode === 'night' && stars ? 1 : 0)),
    destroy() {
      root.destroy()
      for (const runtime of Object.values(runtimes)) {
        runtime.mesh.destroy(); runtime.domeMaterial.destroy(); runtime.celestialMaterial.destroy()
      }
      if (stars) { stars.mesh.destroy(); stars.material.destroy() }
    },
  }
}
