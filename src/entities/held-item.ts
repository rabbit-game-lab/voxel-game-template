import * as pc from 'playcanvas'
import type { CameraMode } from '../camera/config'
import type { TimeOfDay } from '../environment/config'
import type { GameConfig } from '../game.config'
import type { PlayerState } from '../sim/types'
import { addBox, builder, createMesh, rgb, vertexMaterial } from './environment-geometry'
import { createPickaxeMesh } from './pickaxe-mesh'

/** Minecraft swings take 6 ticks. */
const SWING_SECONDS = 0.3
const HAND_POSITION = [0.4, -0.4, -0.62] as const
const HAND_EULER = [8, 12, 0] as const

export interface HeldItemHandle {
  setCameraMode(mode: CameraMode): void
  swing(): void
  update(dt: number, player: PlayerState): void
  setTimeOfDay(mode: TimeOfDay): void
  reset(): void
  stats(): { drawCalls: number }
  destroy(): void
}

function armMesh(device: pc.GraphicsDevice, config: GameConfig): pc.Mesh {
  const { skin, shirt } = config.player.avatar.procedural.colors
  const data = builder()
  addBox(data, [0, 0, 0.2], [0.13, 0.13, 0.42], rgb(skin))
  addBox(data, [0, 0, 0.46], [0.15, 0.15, 0.2], rgb(shirt))
  return createMesh(device, data)
}

/**
 * First-person view model: the right arm holding the configured pickaxe. It
 * renders on its own layer after the world with a cleared depth buffer, so it
 * never clips into nearby blocks, and swings like Minecraft on every action.
 */
export function createHeldItem(app: pc.Application, camera: pc.Entity, config: GameConfig): HeldItemHandle {
  const layer = new pc.Layer({ name: 'Held Item' })
  layer.clearDepthBuffer = true
  app.scene.layers.push(layer)
  camera.camera!.layers = [...camera.camera!.layers, layer.id]

  const material = vertexMaterial(true)
  const tier = config.interaction.mining.pickaxe
  const meshes = [armMesh(app.graphicsDevice, config)]
  if (tier !== 'none') meshes.push(createPickaxeMesh(app.graphicsDevice, tier, 0.5))
  const root = new pc.Entity('Held Item')
  camera.addChild(root)
  const hand = new pc.Entity('Held Hand')
  root.addChild(hand)
  const part = (name: string, mesh: pc.Mesh, parent: pc.Entity): pc.Entity => {
    const entity = new pc.Entity(name)
    entity.addComponent('render', { layers: [layer.id], castShadows: false, receiveShadows: false })
    entity.render!.meshInstances = [new pc.MeshInstance(mesh, material)]
    parent.addChild(entity)
    return entity
  }
  part('Held Arm', meshes[0], hand)
  if (meshes[1]) {
    // Sprite plane turned side-on, handle in the fist, head pointing forward.
    const grip = new pc.Entity('Pickaxe Grip')
    grip.setLocalPosition(0, 0.04, -0.02)
    grip.setLocalEulerAngles(0, 80, 0)
    hand.addChild(grip)
    part('Held Pickaxe', meshes[1], grip).setLocalEulerAngles(0, 0, 20)
  }

  let mode: CameraMode = config.camera.initialMode
  let swingTime = 0
  let bobPhase = 0
  let bobAmount = 0

  const pose = (): void => {
    const t = swingTime > 0 ? 1 - swingTime / SWING_SECONDS : 0
    const fast = Math.sin(Math.sqrt(t) * Math.PI)
    const slow = Math.sin(t * t * Math.PI)
    const bobX = Math.sin(bobPhase) * 0.018 * bobAmount
    const bobY = -Math.abs(Math.cos(bobPhase)) * 0.022 * bobAmount
    hand.setLocalPosition(
      HAND_POSITION[0] - fast * 0.16 + bobX,
      HAND_POSITION[1] + Math.sin(Math.sqrt(t) * Math.PI * 2) * 0.08 + bobY,
      HAND_POSITION[2] - Math.sin(t * Math.PI) * 0.12,
    )
    hand.setLocalEulerAngles(HAND_EULER[0] - fast * 45, HAND_EULER[1] + slow * 20, HAND_EULER[2] - fast * 20)
  }
  const setMode = (next: CameraMode): void => { mode = next; root.enabled = mode === 'first-person' }
  const setTimeOfDay = (timeOfDay: TimeOfDay): void => {
    const tint = rgb(config.environment.sky.presets[timeOfDay].worldTint)
    material.emissive.set(tint[0] / 255, tint[1] / 255, tint[2] / 255); material.update()
  }
  setMode(mode); setTimeOfDay(config.environment.sky.initialMode); pose()

  return {
    setCameraMode: setMode,
    swing() { if (swingTime < SWING_SECONDS * 0.5) swingTime = SWING_SECONDS },
    update(dt, player) {
      swingTime = Math.max(0, swingTime - dt)
      const speed = player.grounded ? Math.hypot(player.velocity.x, player.velocity.z) : 0
      bobAmount += (Math.min(1, speed / config.player.moveSpeed) - bobAmount) * Math.min(1, dt * 10)
      bobPhase += dt * speed * 1.8
      if (mode === 'first-person') pose()
    },
    setTimeOfDay,
    reset() { swingTime = 0; bobPhase = 0; bobAmount = 0; pose() },
    stats: () => ({ drawCalls: meshes.length }),
    destroy() {
      root.destroy(); material.destroy()
      for (const mesh of meshes) mesh.destroy()
      camera.camera!.layers = camera.camera!.layers.filter((id) => id !== layer.id)
      app.scene.layers.remove(layer)
    },
  }
}
