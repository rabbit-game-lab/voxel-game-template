import * as pc from 'playcanvas'
import type { CreatureSpeciesKey } from '../creatures/config'
import type { TimeOfDay } from '../environment/config'
import type { GameConfig } from '../game.config'
import type { CreatureSimulation } from '../sim/creatures'
import { createCreatureMesh } from './creature-archetypes'
import { rgb, vertexMaterial } from './environment-geometry'

interface CreatureVisual { entity: pc.Entity; instance: pc.MeshInstance }

export interface CreaturesHandle {
  update(dt: number): void
  reset(): void
  setPaused(paused: boolean): void
  setTimeOfDay(mode: TimeOfDay): void
  stats(): { active: number; enemies: number; drawCalls: number; species: number }
  destroy(): void
}

export function createCreatures(
  app: pc.Application, simulation: CreatureSimulation, config: GameConfig,
): CreaturesHandle {
  const root = new pc.Entity('Creatures')
  app.root.addChild(root)
  const material = vertexMaterial(false)
  const meshes = new Map<CreatureSpeciesKey, pc.Mesh>()
  const visuals: CreatureVisual[] = simulation.states().map((state) => {
    let mesh = meshes.get(state.species)
    if (!mesh) { mesh = createCreatureMesh(app.graphicsDevice, state.species); meshes.set(state.species, mesh) }
    const entity = new pc.Entity(`Creature ${state.id}`)
    entity.addComponent('render')
    const instance = new pc.MeshInstance(mesh, material)
    instance.castShadow = false; instance.receiveShadow = false
    entity.render!.meshInstances = [instance]
    entity.setLocalScale(state.scale, state.scale, state.scale)
    root.addChild(entity)
    return { entity, instance }
  })
  let paused = false
  let visualTime = 0
  let destroyed = false

  const sync = (): void => {
    simulation.states().forEach((state, index) => {
      const visual = visuals[index]
      visual.entity.enabled = state.active
      if (!state.active) return
      const bob = state.moving ? Math.abs(Math.sin(state.phase)) * 0.045 : Math.sin(state.phase) * 0.012
      visual.entity.setPosition(state.x, state.y + bob, state.z)
      visual.entity.setEulerAngles(0, state.yaw, 0)
    })
  }
  const setTimeOfDay = (mode: TimeOfDay): void => {
    const tint = rgb(config.environment.sky.presets[mode].worldTint)
    material.emissive.set(tint[0] / 255, tint[1] / 255, tint[2] / 255); material.update()
  }
  sync(); setTimeOfDay(config.environment.sky.initialMode)
  return {
    update(dt) { if (!destroyed && !paused) { visualTime += dt; if (visualTime >= 1 / 30) { visualTime = 0; sync() } } },
    reset() { visualTime = 0; sync() },
    setPaused(value) { paused = value },
    setTimeOfDay,
    stats() {
      const states = simulation.states()
      return {
        active: states.filter((state) => state.active).length,
        enemies: states.filter((state) => state.active && state.category === 'enemy').length,
        drawCalls: states.filter((state) => state.active).length,
        species: meshes.size,
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true; root.destroy(); material.destroy()
      for (const mesh of meshes.values()) mesh.destroy()
      meshes.clear()
    },
  }
}
