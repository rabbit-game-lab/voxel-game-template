import { BLOCKS, blockById } from '../data/blocks'
import { creatureSpec } from '../creatures/catalog'
import { planCreatures } from '../creatures/planner'
import type { CreatureHit, CreatureState } from '../creatures/types'
import type { GameConfig } from '../game.config'
import type { VoxelCoord } from '../voxel/coords'
import type { VoxelWorld } from '../voxel/world'

interface RuntimeCreature extends CreatureState {
  directionX: number
  directionZ: number
  decisionRemaining: number
  attackRemaining: number
}

export interface CreatureAttackResult {
  damage: number
  attacker: string
}

export interface CreatureDamageResult {
  accepted: boolean
  defeated: boolean
  label: string
  category: CreatureState['category']
}

function randomFactory(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1) >>> 0
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

function rayBox(
  origin: VoxelCoord, dx: number, dy: number, dz: number,
  center: VoxelCoord, radius: number, height: number,
): number | null {
  let near = 0
  let far = Number.POSITIVE_INFINITY
  let first: number; let second: number; let inverse: number
  if (Math.abs(dx) < 1e-7) {
    if (origin.x < center.x - radius || origin.x > center.x + radius) return null
  } else {
    inverse = 1 / dx; first = (center.x - radius - origin.x) * inverse
    second = (center.x + radius - origin.x) * inverse
    if (first > second) [first, second] = [second, first]
    near = Math.max(near, first); far = Math.min(far, second)
    if (near > far) return null
  }
  if (Math.abs(dy) < 1e-7) {
    if (origin.y < center.y || origin.y > center.y + height) return null
  } else {
    inverse = 1 / dy; first = (center.y - origin.y) * inverse
    second = (center.y + height - origin.y) * inverse
    if (first > second) [first, second] = [second, first]
    near = Math.max(near, first); far = Math.min(far, second)
    if (near > far) return null
  }
  if (Math.abs(dz) < 1e-7) {
    if (origin.z < center.z - radius || origin.z > center.z + radius) return null
  } else {
    inverse = 1 / dz; first = (center.z - radius - origin.z) * inverse
    second = (center.z + radius - origin.z) * inverse
    if (first > second) [first, second] = [second, first]
    near = Math.max(near, first); far = Math.min(far, second)
    if (near > far) return null
  }
  return near
}

export class CreatureSimulation {
  private random: () => number
  private items: RuntimeCreature[] = []
  private decisionAccumulator = 0

  constructor(private readonly world: VoxelWorld, private readonly config: GameConfig) {
    this.random = randomFactory(config.world.seed + 71933)
  }

  reset(): void {
    this.random = randomFactory(this.config.world.seed + 71933)
    this.items = planCreatures(this.world, this.config).map((spawn) => ({
      ...spawn, spawnX: spawn.x, spawnY: spawn.y, spawnZ: spawn.z,
      health: creatureSpec(spawn.species).health, active: true, moving: false, phase: 0,
      directionX: -Math.sin(spawn.yaw * Math.PI / 180),
      directionZ: -Math.cos(spawn.yaw * Math.PI / 180),
      decisionRemaining: this.random() * 1.5, attackRemaining: 0,
    }))
    this.decisionAccumulator = 0
  }

  states(): readonly CreatureState[] {
    return this.items
  }

  hasHostiles(): boolean {
    return this.config.creatures.combat.enabled && this.items.some((item) =>
      item.category === 'enemy' || item.behavior === 'territorial' || item.behavior === 'chaser-melee')
  }

  step(player: VoxelCoord, dt: number): CreatureAttackResult | null {
    this.decisionAccumulator += dt
    const decisionStep = 1 / this.config.creatures.simulation.decisionHz
    const decide = this.decisionAccumulator >= decisionStep
    if (decide) this.decisionAccumulator %= decisionStep
    let attack: CreatureAttackResult | null = null
    for (const item of this.items) {
      if (!item.active) continue
      item.attackRemaining = Math.max(0, item.attackRemaining - dt)
      this.settleVertical(item, dt)
      const dx = player.x - item.x; const dz = player.z - item.z
      const playerDistance = Math.hypot(dx, dz)
      if (playerDistance > this.config.creatures.simulation.sleepDistance) {
        item.moving = false; continue
      }
      const spec = creatureSpec(item.species)
      if (decide) this.chooseDirection(item, dx, dz, playerDistance, decisionStep)
      const hostile = this.config.creatures.combat.enabled &&
        (item.behavior === 'chaser-melee' || item.behavior === 'territorial')
      if (hostile && playerDistance <= spec.attackRange * item.scale && item.attackRemaining <= 0) {
        item.attackRemaining = this.config.creatures.combat.enemyAttackCooldown
        item.moving = false
        attack ??= { damage: spec.attackDamage, attacker: spec.label }
      } else this.move(item, spec.moveSpeed, dt)
      item.phase += dt * (item.moving ? 8 : 2)
    }
    return attack
  }

  raycast(origin: VoxelCoord, direction: VoxelCoord, maxDistance: number): CreatureHit | null {
    let best: CreatureHit | null = null
    const length = Math.hypot(direction.x, direction.y, direction.z)
    if (length < 0.000001) return null
    const dx = direction.x / length; const dy = direction.y / length; const dz = direction.z / length
    this.items.forEach((item, index) => {
      if (!item.active) return
      const spec = creatureSpec(item.species)
      const distance = rayBox(origin, dx, dy, dz, item, spec.radius * item.scale, spec.height * item.scale)
      if (distance !== null && distance <= maxDistance && (!best || distance < best.distance)) {
        best = { index, distance }
      }
    })
    return best
  }

  damage(index: number, amount: number): CreatureDamageResult {
    const item = this.items[index]
    if (!item?.active) return { accepted: false, defeated: false, label: '', category: 'animal' }
    const spec = creatureSpec(item.species)
    const accepted = this.config.creatures.combat.enabled && (
      item.category === 'enemy' || item.behavior === 'territorial' || item.behavior === 'chaser-melee' ||
      this.config.creatures.combat.animalsDamageable
    )
    if (!accepted) return { accepted: false, defeated: false, label: spec.label, category: item.category }
    item.health = Math.max(0, item.health - amount)
    item.active = item.health > 0
    item.moving = false
    return { accepted: true, defeated: !item.active, label: spec.label, category: item.category }
  }

  intersectsVoxel(voxel: VoxelCoord): boolean {
    return this.items.some((item) => {
      if (!item.active) return false
      const spec = creatureSpec(item.species)
      const radius = spec.radius * item.scale
      return item.x + radius > voxel.x && item.x - radius < voxel.x + 1 &&
        item.y + spec.height * item.scale > voxel.y && item.y < voxel.y + 1 &&
        item.z + radius > voxel.z && item.z - radius < voxel.z + 1
    })
  }

  private chooseDirection(item: RuntimeCreature, dx: number, dz: number, distance: number, step: number): void {
    const spec = creatureSpec(item.species)
    item.decisionRemaining -= step
    const pursue = (item.behavior === 'chaser-melee' || item.behavior === 'territorial') && distance <= spec.detectionRange
    const follow = item.behavior === 'companion' && distance > 3 && distance < 12
    const flee = item.behavior === 'skittish' && distance < 3.2
    if (pursue || follow || flee) {
      const inverse = distance > 0.001 ? 1 / distance : 0
      const direction = flee ? -1 : 1
      item.directionX = dx * inverse * direction; item.directionZ = dz * inverse * direction
      item.decisionRemaining = 0.25
    } else if (item.behavior === 'stationary') {
      item.directionX = 0; item.directionZ = 0; item.decisionRemaining = 2
    } else if (item.decisionRemaining <= 0) {
      if (this.random() < 0.28) item.directionX = item.directionZ = 0
      else {
        const angle = this.random() * Math.PI * 2
        item.directionX = Math.sin(angle); item.directionZ = Math.cos(angle)
      }
      item.decisionRemaining = 0.8 + this.random() * 2.4
    }
    const fromHomeX = item.x - item.spawnX; const fromHomeZ = item.z - item.spawnZ
    if (Math.hypot(fromHomeX, fromHomeZ) > item.roamRadius && !pursue && !follow && !flee) {
      const length = Math.max(0.001, Math.hypot(fromHomeX, fromHomeZ))
      item.directionX = -fromHomeX / length; item.directionZ = -fromHomeZ / length
    }
  }

  private move(item: RuntimeCreature, speed: number, dt: number): void {
    if (item.directionX === 0 && item.directionZ === 0) { item.moving = false; return }
    const nextX = item.x + item.directionX * speed * dt
    const nextZ = item.z + item.directionZ * speed * dt
    const ground = this.groundNear(nextX, nextZ, item.y)
    const blocked = ground === null || Math.abs(ground + 1 - item.y) > 1.05 ||
      this.world.getBlock(Math.floor(nextX), Math.floor(ground + 1), Math.floor(nextZ)) === BLOCKS.water.id ||
      this.bodyBlocked(nextX, ground + 1, nextZ, item)
    if (blocked) {
      const angle = (this.random() * 1.5 + 0.75) * Math.PI
      const cos = Math.cos(angle); const sin = Math.sin(angle)
      const x = item.directionX
      item.directionX = x * cos - item.directionZ * sin
      item.directionZ = x * sin + item.directionZ * cos
      item.moving = false; item.decisionRemaining = 0.2
      return
    }
    item.x = nextX; item.y = ground + 1; item.z = nextZ
    item.yaw = Math.atan2(-item.directionX, -item.directionZ) * 180 / Math.PI
    item.moving = true
  }

  private settleVertical(item: RuntimeCreature, dt: number): void {
    const x = Math.floor(item.x); const z = Math.floor(item.z)
    const supportY = Math.floor(item.y - 0.05)
    if (blockById(this.world.getBlock(x, supportY, z)).solid) return
    let ground: number | null = null
    for (let y = supportY - 1; y >= this.world.bounds.min.y; y -= 1) {
      if (blockById(this.world.getBlock(x, y, z)).solid) { ground = y; break }
    }
    if (ground !== null) item.y = Math.max(ground + 1, item.y - 10 * dt)
  }

  private groundNear(x: number, z: number, referenceY: number): number | null {
    const voxelX = Math.floor(x); const voxelZ = Math.floor(z)
    const start = Math.min(this.world.bounds.maxExclusive.y - 1, Math.floor(referenceY + 1))
    for (let y = start; y >= Math.max(this.world.bounds.min.y, Math.floor(referenceY - 3)); y -= 1) {
      if (blockById(this.world.getBlock(voxelX, y, voxelZ)).solid) return y
    }
    return null
  }

  private bodyBlocked(x: number, y: number, z: number, item: RuntimeCreature): boolean {
    const spec = creatureSpec(item.species)
    const top = Math.floor(y + spec.height * item.scale - 0.05)
    for (let checkY = Math.floor(y); checkY <= top; checkY += 1) {
      if (blockById(this.world.getBlock(Math.floor(x), checkY, Math.floor(z))).solid) return true
    }
    return false
  }
}
