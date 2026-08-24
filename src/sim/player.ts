import { blockById } from '../data/blocks'
import type { GameConfig } from '../game.config'
import { COLLISION_EPSILON } from '../voxel/constants'
import type { VoxelCoord } from '../voxel/coords'
import type { VoxelWorld } from '../voxel/world'
import type { PlayerState, SimInput } from './types'

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

export function createPlayer(config: GameConfig): PlayerState {
  const spawn = config.world.spawn
  return {
    position: { x: spawn[0], y: spawn[1], z: spawn[2] },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: false,
    coyoteRemaining: 0,
  }
}

export function collidesAt(world: VoxelWorld, position: VoxelCoord, config: GameConfig): boolean {
  const half = config.player.bodyWidth * 0.5
  const minX = Math.floor(position.x - half + COLLISION_EPSILON)
  const maxX = Math.floor(position.x + half - COLLISION_EPSILON)
  const minY = Math.floor(position.y + COLLISION_EPSILON)
  const maxY = Math.floor(position.y + config.player.bodyHeight - COLLISION_EPSILON)
  const minZ = Math.floor(position.z - half + COLLISION_EPSILON)
  const maxZ = Math.floor(position.z + half - COLLISION_EPSILON)
  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (blockById(world.getBlock(x, y, z)).solid) return true
      }
    }
  }
  return false
}

export function playerIntersectsVoxel(player: PlayerState, voxel: VoxelCoord, config: GameConfig): boolean {
  const half = config.player.bodyWidth * 0.5
  return player.position.x + half > voxel.x && player.position.x - half < voxel.x + 1 &&
    player.position.y + config.player.bodyHeight > voxel.y && player.position.y < voxel.y + 1 &&
    player.position.z + half > voxel.z && player.position.z - half < voxel.z + 1
}

function moveAxis(
  world: VoxelWorld,
  player: PlayerState,
  config: GameConfig,
  axis: 'x' | 'y' | 'z',
  amount: number,
): boolean {
  if (amount === 0) return false
  const start = player.position[axis]
  player.position[axis] = start + amount
  if (!collidesAt(world, player.position, config)) return false
  let free = 0
  let blocked = 1
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const middle = (free + blocked) * 0.5
    player.position[axis] = start + amount * middle
    if (collidesAt(world, player.position, config)) blocked = middle
    else free = middle
  }
  player.position[axis] = start + amount * free
  return true
}

export function stepPlayer(
  world: VoxelWorld,
  player: PlayerState,
  input: SimInput,
  dt: number,
  config: GameConfig,
): boolean {
  const magnitude = Math.hypot(input.moveX, input.moveZ)
  const moveX = magnitude > 1 ? input.moveX / magnitude : input.moveX
  const moveZ = magnitude > 1 ? input.moveZ / magnitude : input.moveZ
  const yaw = player.yaw * Math.PI / 180
  const desiredX = Math.cos(yaw) * moveX - Math.sin(yaw) * moveZ
  const desiredZ = -Math.sin(yaw) * moveX - Math.cos(yaw) * moveZ
  const speed = config.player.moveSpeed * (input.sprint ? config.player.sprintMultiplier : 1)
  const control = player.grounded ? 1 : config.player.airControl
  const rate = magnitude > 0 ? config.player.acceleration * control : config.player.friction * control
  player.velocity.x = moveToward(player.velocity.x, desiredX * speed, rate * dt)
  player.velocity.z = moveToward(player.velocity.z, desiredZ * speed, rate * dt)

  if (player.grounded) player.coyoteRemaining = config.player.coyoteTime
  else player.coyoteRemaining = Math.max(0, player.coyoteRemaining - dt)
  let jumped = false
  if (input.jumpPressed && (player.grounded || player.coyoteRemaining > 0)) {
    player.velocity.y = config.player.jumpSpeed
    player.grounded = false
    player.coyoteRemaining = 0
    jumped = true
  }
  player.velocity.y = Math.max(-config.player.maxFallSpeed, player.velocity.y + config.player.gravity * dt)

  if (moveAxis(world, player, config, 'x', player.velocity.x * dt)) player.velocity.x = 0
  if (moveAxis(world, player, config, 'z', player.velocity.z * dt)) player.velocity.z = 0
  const verticalCollision = moveAxis(world, player, config, 'y', player.velocity.y * dt)
  player.grounded = verticalCollision && player.velocity.y < 0
  if (verticalCollision) player.velocity.y = 0
  return jumped
}

export function viewDirection(player: PlayerState): VoxelCoord {
  const yaw = player.yaw * Math.PI / 180
  const pitch = player.pitch * Math.PI / 180
  const horizontal = Math.cos(pitch)
  return {
    x: -Math.sin(yaw) * horizontal,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * horizontal,
  }
}

