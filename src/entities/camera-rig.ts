import * as pc from 'playcanvas'
import type { CameraMode } from '../camera/config'
import type { GameConfig } from '../game.config'
import { viewDirection } from '../sim/player'
import type { AimRay, PlayerState } from '../sim/types'
import { raycastVoxels } from '../voxel/raycast'
import type { VoxelWorld } from '../voxel/world'

export interface CameraRigHandle {
  entity: pc.Entity
  mode(): CameraMode
  setMode(mode: CameraMode): void
  update(player: PlayerState, dt: number): AimRay
  reset(): void
  destroy(): void
}

export function createCameraRig(
  parent: pc.Entity,
  world: VoxelWorld,
  config: GameConfig,
  clearColor: pc.Color,
): CameraRigHandle {
  const entity = new pc.Entity('Player Camera')
  entity.addComponent('camera', {
    clearColor,
    fov: config.camera.modes.firstPerson.fov,
    nearClip: config.camera.clipping.near,
    farClip: config.camera.clipping.far,
  })
  parent.addChild(entity)

  const aim: AimRay = {
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: -1 },
    maxDistance: config.interaction.reach,
  }
  let currentMode: CameraMode = config.camera.initialMode
  let currentBoom = 0
  let boomReady = false
  const anchor = new pc.Vec3()
  const desired = new pc.Vec3()
  const boomDirection = new pc.Vec3()
  const traceOrigin = { x: 0, y: 0, z: 0 }
  const traceDirection = { x: 0, y: 0, z: -1 }

  function applyMode(): void {
    entity.camera!.fov = currentMode === 'first-person'
      ? config.camera.modes.firstPerson.fov
      : config.camera.modes.thirdPerson.fov
    boomReady = false
  }

  function traceBoomRay(offsetX: number, offsetY: number, offsetZ: number, length: number): number {
    traceOrigin.x = anchor.x + offsetX; traceOrigin.y = anchor.y + offsetY; traceOrigin.z = anchor.z + offsetZ
    traceDirection.x = boomDirection.x; traceDirection.y = boomDirection.y; traceDirection.z = boomDirection.z
    const hit = raycastVoxels(world, traceOrigin, traceDirection, length)
    return hit ? Math.max(0.08, hit.distance - config.camera.modes.thirdPerson.collisionPadding) : length
  }

  function traceBoom(yaw: number): number {
    boomDirection.copy(desired).sub(anchor)
    const length = boomDirection.length()
    if (length < 0.0001) { boomDirection.set(0, 0, -1); return 0 }
    boomDirection.mulScalar(1 / length)
    const spec = config.camera.modes.thirdPerson
    const angle = yaw * Math.PI / 180
    const rightX = Math.cos(angle) * spec.collisionRadius
    const rightZ = -Math.sin(angle) * spec.collisionRadius
    return Math.min(
      traceBoomRay(0, 0, 0, length),
      traceBoomRay(rightX, 0, rightZ, length),
      traceBoomRay(-rightX, 0, -rightZ, length),
      traceBoomRay(0, spec.collisionRadius, 0, length),
      traceBoomRay(0, -spec.collisionRadius, 0, length),
    )
  }

  function updateFirstPerson(player: PlayerState): void {
    const direction = viewDirection(player)
    const x = player.position.x
    const y = player.position.y + config.player.eyeHeight
    const z = player.position.z
    entity.setPosition(x, y, z)
    entity.setEulerAngles(player.pitch, player.yaw, 0)
    aim.origin.x = x; aim.origin.y = y; aim.origin.z = z
    aim.direction.x = direction.x; aim.direction.y = direction.y; aim.direction.z = direction.z
    aim.maxDistance = config.interaction.reach
  }

  function updateThirdPerson(player: PlayerState, dt: number): void {
    const spec = config.camera.modes.thirdPerson
    const direction = viewDirection(player)
    const yaw = player.yaw * Math.PI / 180
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    anchor.set(
      player.position.x,
      player.position.y + config.player.eyeHeight,
      player.position.z,
    )
    desired.set(
      player.position.x - forwardX * spec.distance,
      player.position.y + spec.height,
      player.position.z - forwardZ * spec.distance,
    )
    const availableBoom = traceBoom(player.yaw)
    if (!boomReady) { currentBoom = availableBoom; boomReady = true }
    else if (availableBoom < currentBoom) currentBoom = availableBoom
    else currentBoom += (availableBoom - currentBoom) * Math.min(1, spec.returnSpeed * dt)
    currentBoom = Math.max(Math.min(spec.minDistance, availableBoom), currentBoom)
    currentBoom = Math.min(currentBoom, availableBoom)

    const x = anchor.x + boomDirection.x * currentBoom
    const y = anchor.y + boomDirection.y * currentBoom
    const z = anchor.z + boomDirection.z * currentBoom
    const targetX = anchor.x + direction.x * spec.aimDistance
    const targetY = anchor.y + direction.y * spec.aimDistance
    const targetZ = anchor.z + direction.z * spec.aimDistance
    entity.setPosition(x, y, z)
    entity.lookAt(targetX, targetY, targetZ)
    const aimX = targetX - x
    const aimY = targetY - y
    const aimZ = targetZ - z
    const aimLength = Math.hypot(aimX, aimY, aimZ) || 1
    aim.origin.x = x; aim.origin.y = y; aim.origin.z = z
    aim.direction.x = aimX / aimLength; aim.direction.y = aimY / aimLength; aim.direction.z = aimZ / aimLength
    aim.maxDistance = spec.aimDistance + currentBoom
  }

  applyMode()
  return {
    entity,
    mode: () => currentMode,
    setMode(mode) { if (mode !== currentMode) { currentMode = mode; applyMode() } },
    update(player, dt) {
      if (currentMode === 'first-person') updateFirstPerson(player)
      else updateThirdPerson(player, dt)
      return aim
    },
    reset() { currentMode = config.camera.initialMode; currentBoom = 0; applyMode() },
    destroy() { entity.destroy() },
  }
}
