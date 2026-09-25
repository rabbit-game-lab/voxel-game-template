import * as pc from 'playcanvas'
import type { CameraMode } from '../camera/config'
import type { GameConfig } from '../game.config'
import type { AssetsHandle } from '../rabbit/assets'
import type { PlayerState } from '../sim/types'
import type { VoxelCoord } from '../voxel/coords'
import { raycastVoxels } from '../voxel/raycast'
import type { VoxelWorld } from '../voxel/world'
import { createImportedAvatar } from './avatar-imported'
import { createProceduralAvatar } from './avatar-procedural'
import type { AvatarMotion, AvatarVisual } from './avatar-types'
import { makeMat, prim } from './helpers'
import { createPickaxeMesh } from './pickaxe-mesh'

export interface PlayerAvatarHandle {
  setCameraMode(mode: CameraMode): void
  triggerAction(target: VoxelCoord): void
  swing(): void
  update(player: PlayerState, dt: number, animate: boolean): void
  reset(player: PlayerState): void
  stats(): { drawCalls: number; renderer: string }
  destroy(): void
}

function targetYaw(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz) * 180 / Math.PI
}

function turnToward(current: number, target: number, maxStep: number): number {
  const delta = ((target - current + 540) % 360) - 180
  return current + Math.max(-maxStep, Math.min(maxStep, delta))
}

export function createPlayerAvatar(
  parent: pc.Entity,
  world: VoxelWorld,
  assets: AssetsHandle,
  config: GameConfig,
  device: pc.GraphicsDevice,
): PlayerAvatarHandle {
  const root = new pc.Entity('Player Avatar')
  parent.addChild(root)
  const factories: Record<string, () => AvatarVisual> = {
    procedural: () => createProceduralAvatar(root, config),
    gltf: () => createImportedAvatar(root, assets, config),
  }
  const visual = factories[config.player.avatar.renderer]()
  const tier = config.interaction.mining.pickaxe
  const toolMaterial = new pc.StandardMaterial()
  toolMaterial.diffuseVertexColor = true; toolMaterial.gloss = 0; toolMaterial.update()
  const toolMesh = visual.hand && tier !== 'none' ? createPickaxeMesh(device, tier, 0.8) : null
  if (visual.hand && toolMesh) {
    // Handle forward out of the fist, head standing upright, like a Minecraft held tool.
    const grip = new pc.Entity('Pickaxe Grip')
    grip.setLocalEulerAngles(0, 90, 0)
    visual.hand.addChild(grip)
    const tool = new pc.Entity('Held Pickaxe')
    tool.addComponent('render', { castShadows: false, receiveShadows: false })
    tool.render!.meshInstances = [new pc.MeshInstance(toolMesh, toolMaterial)]
    tool.setLocalEulerAngles(0, 0, -45)
    grip.addChild(tool)
  }
  const SWING_SECONDS = 0.3
  let swingRemaining = 0

  const shadowMaterial = makeMat('#000000', { opacity: config.player.avatar.shadow.opacity, unlit: true })
  const shadow = prim('Avatar Blob Shadow', 'cylinder', {
    parent, material: shadowMaterial, scale: [1, 0.012, 1],
  })
  let mode: CameraMode = config.camera.initialMode
  let facingYaw = 0
  let phase = 0
  let actionRemaining = 0
  let landingRemaining = 0
  let previousGrounded = false
  let shadowHit = false
  const actionTarget = { x: 0, y: 0, z: 0 }
  const shadowOrigin = { x: 0, y: 0, z: 0 }
  const shadowDirection = { x: 0, y: -1, z: 0 }

  function setVisibility(): void {
    root.enabled = mode === 'third-person'
    shadow.enabled = root.enabled && config.player.avatar.shadow.enabled && shadowHit
  }

  function motionFor(player: PlayerState, speed: number): AvatarMotion {
    if (landingRemaining > 0) return 'land'
    if (!player.grounded) return player.velocity.y > 0.15 ? 'jump' : 'fall'
    if (speed > config.player.moveSpeed * 1.05) return 'run'
    return speed > 0.12 ? 'walk' : 'idle'
  }

  function updateShadow(player: PlayerState): void {
    if (mode !== 'third-person' || !config.player.avatar.shadow.enabled) {
      shadowHit = false; shadow.enabled = false; return
    }
    const spec = config.player.avatar.shadow
    shadowOrigin.x = player.position.x; shadowOrigin.y = player.position.y + 0.05; shadowOrigin.z = player.position.z
    const hit = raycastVoxels(world, shadowOrigin, shadowDirection, spec.maxDistance + 0.1)
    shadowHit = hit !== null
    shadow.enabled = shadowHit
    if (!hit) return
    const fade = Math.max(0.48, 1 - hit.distance / spec.maxDistance * 0.45)
    shadow.setPosition(player.position.x, hit.voxel.y + 1.015, player.position.z)
    shadow.setLocalScale(spec.radius * fade, 0.012, spec.radius * fade)
  }

  setVisibility()
  return {
    setCameraMode(next) { mode = next; setVisibility() },
    swing() { if (swingRemaining < SWING_SECONDS * 0.5) swingRemaining = SWING_SECONDS },
    triggerAction(target) {
      actionTarget.x = target.x; actionTarget.y = target.y; actionTarget.z = target.z
      actionRemaining = config.player.avatar.actionFacingTime
    },
    update(player, dt, animate) {
      root.setPosition(player.position.x, player.position.y, player.position.z)
      const speed = Math.hypot(player.velocity.x, player.velocity.z)
      if (animate) {
        if (!previousGrounded && player.grounded) landingRemaining = 0.14
        actionRemaining = Math.max(0, actionRemaining - dt)
        landingRemaining = Math.max(0, landingRemaining - dt)
        const frequency = speed > config.player.moveSpeed * 1.05
          ? config.player.avatar.procedural.animation.runFrequency
          : config.player.avatar.procedural.animation.walkFrequency
        phase += dt * (speed > 0.12 ? frequency : 2.1)
      }
      let desiredYaw = facingYaw
      if (actionRemaining > 0) {
        desiredYaw = targetYaw(
          actionTarget.x + 0.5 - player.position.x,
          actionTarget.z + 0.5 - player.position.z,
        )
      } else if (speed > 0.12) desiredYaw = targetYaw(player.velocity.x, player.velocity.z)
      facingYaw = turnToward(facingYaw, desiredYaw, config.player.avatar.turnSpeed * (animate ? dt : 0))
      root.setEulerAngles(0, facingYaw, 0)
      visual.setMotion(motionFor(player, speed), phase)
      if (animate) swingRemaining = Math.max(0, swingRemaining - dt)
      visual.setSwing?.(swingRemaining > 0 ? 1 - swingRemaining / SWING_SECONDS : 0)
      updateShadow(player)
      previousGrounded = player.grounded
    },
    reset(player) {
      facingYaw = player.yaw; phase = 0; actionRemaining = 0; landingRemaining = 0; swingRemaining = 0
      previousGrounded = player.grounded; shadowHit = false
      visual.reset(); root.setPosition(player.position.x, player.position.y, player.position.z)
      setVisibility()
    },
    stats: () => ({
      drawCalls: visual.drawCalls + (config.player.avatar.shadow.enabled ? 1 : 0) + (toolMesh ? 1 : 0),
      renderer: config.player.avatar.renderer,
    }),
    destroy() {
      visual.destroy(); root.destroy(); shadow.destroy(); shadowMaterial.destroy()
      toolMaterial.destroy(); toolMesh?.destroy()
    },
  }
}
