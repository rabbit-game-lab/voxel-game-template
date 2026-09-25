import * as pc from 'playcanvas'
import { creatureDrawCalls, creatureSpec } from '../creatures/catalog'
import type { CreatureSpeciesKey } from '../creatures/config'
import type { TimeOfDay } from '../environment/config'
import type { GameConfig } from '../game.config'
import type { CreatureSimulation } from '../sim/creatures'
import { GUARDIAN } from '../sim/creature-guardian'
import { createCreatureMesh } from './creature-archetypes'
import { createGolemMeshes, GOLEM_PIVOTS, poseGolem, type GolemLimbs, type GolemMeshes } from './creature-golem'
import { rgb, vertexMaterial } from './environment-geometry'

interface CreatureVisual { entity: pc.Entity; limbs: GolemLimbs | null }

function addPart(parent: pc.Entity, name: string, mesh: pc.Mesh, material: pc.Material): pc.Entity {
  const entity = new pc.Entity(name)
  entity.addComponent('render')
  const instance = new pc.MeshInstance(mesh, material)
  instance.castShadow = false; instance.receiveShadow = false
  entity.render!.meshInstances = [instance]
  parent.addChild(entity)
  return entity
}

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
  let golem: GolemMeshes | null = null
  const visuals: CreatureVisual[] = simulation.states().map((state) => {
    if (creatureSpec(state.species).shape === 'golem') {
      golem ??= createGolemMeshes(app.graphicsDevice)
      const entity = addPart(root, `Creature ${state.id}`, golem.body, material)
      entity.setLocalScale(state.scale, state.scale, state.scale)
      const limb = (name: string, mesh: pc.Mesh, x: number, y: number, z: number): pc.Entity => {
        const part = addPart(entity, `${state.id} ${name}`, mesh, material)
        part.setLocalPosition(x, y, z)
        return part
      }
      const { shoulderX, shoulderY, shoulderZ, hipX, hipY } = GOLEM_PIVOTS
      return {
        entity,
        limbs: {
          leftArm: limb('left arm', golem.arm, -shoulderX, shoulderY, shoulderZ),
          rightArm: limb('right arm', golem.arm, shoulderX, shoulderY, shoulderZ),
          leftLeg: limb('left leg', golem.leg, -hipX, hipY, 0),
          rightLeg: limb('right leg', golem.leg, hipX, hipY, 0),
        },
      }
    }
    let mesh = meshes.get(state.species)
    if (!mesh) { mesh = createCreatureMesh(app.graphicsDevice, state.species); meshes.set(state.species, mesh) }
    const entity = addPart(root, `Creature ${state.id}`, mesh, material)
    entity.setLocalScale(state.scale, state.scale, state.scale)
    return { entity, limbs: null }
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
      if (visual.limbs) poseGolem(visual.limbs, state, GUARDIAN.swingSeconds)
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
        drawCalls: states.reduce((sum, state) => sum + (state.active ? creatureDrawCalls(state.species) : 0), 0),
        species: meshes.size + (golem ? 1 : 0),
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true; root.destroy(); material.destroy()
      for (const mesh of meshes.values()) mesh.destroy()
      meshes.clear()
      if (golem) { golem.body.destroy(); golem.arm.destroy(); golem.leg.destroy(); golem = null }
    },
  }
}
