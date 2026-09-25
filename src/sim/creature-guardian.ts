import { creatureSpec } from '../creatures/catalog'
import type { GameConfig } from '../game.config'
import type { VoxelCoord } from '../voxel/coords'
import { flatDistance, isHostileCreature, type RuntimeCreature } from './creature-runtime'

/** Guardian (Iron Golem) companion tuning. Public knobs stay in CONFIG.creatures. */
export const GUARDIAN = {
  followStart: 4.5,
  followStop: 3,
  catchUpDistance: 8,
  catchUpMultiplier: 2,
  chaseMultiplier: 1.3,
  guardRadius: 14,
  teleportDistance: 22,
  stuckTeleportSeconds: 2.5,
  swingSeconds: 0.6,
  regenPerSecond: 0.2,
  launchSpeed: 3.2,
  launchLift: 7.5,
} as const

export interface GuardianMotor {
  move(item: RuntimeCreature, speed: number, dt: number): void
  teleportNear(item: RuntimeCreature, anchor: VoxelCoord): boolean
}

export type GuardianAction =
  | { type: 'strike'; targetIndex: number }
  | null

function pickTarget(
  guardian: RuntimeCreature, items: readonly RuntimeCreature[], player: VoxelCoord, config: GameConfig,
): number {
  if (!config.creatures.combat.enabled) return -1
  const range = creatureSpec(guardian.species).detectionRange * guardian.scale
  const valid = (item: RuntimeCreature | undefined): item is RuntimeCreature => !!item && item.active &&
    item !== guardian && isHostileCreature(item) && flatDistance(item, player) <= GUARDIAN.guardRadius &&
    flatDistance(item, guardian) <= range
  // Stay on the current target while it remains valid so the golem does not flicker between foes.
  if (valid(items[guardian.targetIndex])) return guardian.targetIndex
  let best = -1; let bestDistance = Number.POSITIVE_INFINITY
  items.forEach((item, index) => {
    if (!valid(item)) return
    const distance = flatDistance(item, guardian)
    if (distance < bestDistance) { best = index; bestDistance = distance }
  })
  return best
}

function steer(item: RuntimeCreature, toward: { x: number; z: number }): void {
  const dx = toward.x - item.x; const dz = toward.z - item.z
  const length = Math.hypot(dx, dz)
  if (length < 0.001) { item.directionX = 0; item.directionZ = 0; return }
  item.directionX = dx / length; item.directionZ = dz / length
}

function face(item: RuntimeCreature, toward: { x: number; z: number }): void {
  item.yaw = Math.atan2(-(toward.x - item.x), -(toward.z - item.z)) * 180 / Math.PI
}

/**
 * Iron Golem companion: follows the player, engages hostile creatures near the
 * player and swings at them. Never sleeps; teleports back when left behind.
 */
export function stepGuardian(
  guardian: RuntimeCreature, items: readonly RuntimeCreature[], player: VoxelCoord,
  dt: number, decide: boolean, motor: GuardianMotor, config: GameConfig,
): GuardianAction {
  const spec = creatureSpec(guardian.species)
  const playerDistance = flatDistance(guardian, player)
  const lost = playerDistance > GUARDIAN.teleportDistance ||
    (guardian.stuckTime > GUARDIAN.stuckTeleportSeconds && playerDistance > GUARDIAN.followStart)
  if (lost && motor.teleportNear(guardian, player)) {
    guardian.stuckTime = 0; guardian.targetIndex = -1; guardian.moving = false
    return null
  }
  if (decide || !items[guardian.targetIndex]?.active) guardian.targetIndex = pickTarget(guardian, items, player, config)
  const target = guardian.targetIndex >= 0 ? items[guardian.targetIndex] : null
  let speed = spec.moveSpeed
  if (target) {
    const reach = spec.attackRange * guardian.scale + creatureSpec(target.species).radius * target.scale
    if (flatDistance(guardian, target) <= reach) {
      face(guardian, target)
      guardian.moving = false; guardian.stuckTime = 0
      if (guardian.attackRemaining > 0) return null
      guardian.attackRemaining = config.creatures.combat.enemyAttackCooldown
      guardian.swing = GUARDIAN.swingSeconds
      return { type: 'strike', targetIndex: guardian.targetIndex }
    }
    steer(guardian, target); speed *= GUARDIAN.chaseMultiplier
  } else {
    guardian.health = Math.min(spec.health, guardian.health + GUARDIAN.regenPerSecond * dt)
    const following = guardian.directionX !== 0 || guardian.directionZ !== 0
    if (playerDistance > GUARDIAN.followStart || (following && playerDistance > GUARDIAN.followStop)) {
      steer(guardian, player)
      if (playerDistance > GUARDIAN.catchUpDistance) speed *= GUARDIAN.catchUpMultiplier
    } else {
      guardian.directionX = 0; guardian.directionZ = 0
    }
  }
  const wantsToMove = guardian.directionX !== 0 || guardian.directionZ !== 0
  motor.move(guardian, speed, dt)
  guardian.stuckTime = wantsToMove && !guardian.moving ? guardian.stuckTime + dt : 0
  return null
}

/** Launches a struck creature up and away from the golem, Minecraft style. */
export function launchFrom(guardian: RuntimeCreature, target: RuntimeCreature): void {
  const dx = target.x - guardian.x; const dz = target.z - guardian.z
  const length = Math.max(0.001, Math.hypot(dx, dz))
  target.airborne = true
  target.launchX = dx / length * GUARDIAN.launchSpeed
  target.launchZ = dz / length * GUARDIAN.launchSpeed
  target.launchY = GUARDIAN.launchLift
  target.moving = false
}
