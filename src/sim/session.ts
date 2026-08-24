import {
  BLOCKS, HOTBAR_BLOCKS, blockById, blockId, isBlockKey,
  type BlockKey, type HotbarBlockKey,
} from '../data/blocks'
import type { GameConfig } from '../game.config'
import { naturalReplacementAt } from '../environment/lakes'
import type { TimeOfDay } from '../environment/config'
import type { VoxelCoord } from '../voxel/coords'
import { generateWorld } from '../voxel/generator'
import { raycastVoxels } from '../voxel/raycast'
import { VoxelWorld } from '../voxel/world'
import {
  collidesAt, createPlayer, playerIntersectsVoxel, stepPlayer, viewDirection,
} from './player'
import type {
  GameEvent, GamePhase, HudSnapshot, InputDevice, InputSnapshot,
  PlayerState, SimInput, TargetSnapshot,
} from './types'

export class GameSession {
  readonly world: VoxelWorld
  player: PlayerState
  phase: GamePhase = 'focus'
  private inventory = {} as Record<BlockKey, number>
  private selectedSlot = 1
  private target: TargetSnapshot = { hit: null, label: '' }
  private breakCooldown = 0
  private placeCooldown = 0
  private readonly events: GameEvent[] = []

  constructor(private readonly config: GameConfig) {
    this.world = new VoxelWorld(config.world.min, config.world.size)
    this.player = createPlayer(config)
    this.restart()
  }

  restart(): void {
    generateWorld(this.world, this.config)
    this.player = createPlayer(this.config)
    this.phase = 'focus'
    this.selectedSlot = 1
    this.breakCooldown = 0
    this.placeCooldown = 0
    this.events.length = 0
    for (const key of Object.keys(BLOCKS) as BlockKey[]) {
      this.inventory[key] = this.config.world.startingInventory[key] ?? 0
    }
    this.refreshTarget()
  }

  begin(): void {
    if (this.phase !== 'focus') return
    this.phase = 'playing'
    this.events.push({ type: 'phase', phase: this.phase })
  }

  applyFrameInput(input: InputSnapshot): void {
    if (input.selectSlot !== null && input.selectSlot >= 0 && input.selectSlot < HOTBAR_BLOCKS.length) {
      this.selectedSlot = input.selectSlot
    }
    if (input.slotDelta !== 0) {
      this.selectedSlot = (this.selectedSlot + Math.sign(input.slotDelta) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length
    }
    if (this.phase === 'playing') {
      this.player.yaw = (this.player.yaw - input.lookX) % 360
      this.player.pitch = Math.max(
        -this.config.camera.maxPitch,
        Math.min(this.config.camera.maxPitch, this.player.pitch - input.lookY),
      )
    }
    this.refreshTarget()
  }

  step(input: SimInput, dt: number): void {
    if (this.phase !== 'playing') return
    this.breakCooldown = Math.max(0, this.breakCooldown - dt)
    this.placeCooldown = Math.max(0, this.placeCooldown - dt)
    const movement = stepPlayer(this.world, this.player, input, dt, this.config)
    if (movement.jumped) this.events.push({ type: 'sound', sound: 'jump' })
    if (movement.enteredWater) this.events.push({ type: 'sound', sound: 'splash' })
    if (this.player.position.y < this.config.session.defeatY) {
      this.end('defeat')
      return
    }
    this.refreshTarget()
    if (input.breakHeld && this.breakCooldown <= 0) this.breakTarget()
    if (input.placePressed && this.placeCooldown <= 0) this.placeTarget()
  }

  refreshTarget(): void {
    const origin = {
      x: this.player.position.x,
      y: this.player.position.y + this.config.player.eyeHeight,
      z: this.player.position.z,
    }
    const hit = raycastVoxels(this.world, origin, viewDirection(this.player), this.config.interaction.reach)
    this.target = { hit, label: hit ? blockById(this.world.getBlock(hit.voxel.x, hit.voxel.y, hit.voxel.z)).label : '' }
  }

  targetSnapshot(): TargetSnapshot {
    return this.target
  }

  getHudSnapshot(device: InputDevice, paused: boolean, timeOfDay: TimeOfDay): HudSnapshot {
    return {
      phase: this.phase,
      paused,
      timeOfDay,
      placedCrystals: this.placedCrystals(),
      requiredCrystals: this.config.session.requiredCrystals,
      device,
      hasTarget: this.target.hit !== null,
      targetLabel: this.target.label,
      slots: HOTBAR_BLOCKS.map((key, index) => ({
        key,
        label: BLOCKS[key].label,
        count: this.inventory[key],
        selected: index === this.selectedSlot,
        locked: !BLOCKS[key].placeable,
      })),
    }
  }

  consumeEvents(): GameEvent[] {
    return this.events.splice(0)
  }

  private selectedBlock(): HotbarBlockKey {
    return HOTBAR_BLOCKS[this.selectedSlot]
  }

  private breakTarget(): void {
    this.breakCooldown = this.config.interaction.breakInterval
    const hit = this.target.hit
    if (!hit) return
    const spec = blockById(this.world.getBlock(hit.voxel.x, hit.voxel.y, hit.voxel.z))
    if (!spec.breakable || !spec.drop || !isBlockKey(spec.drop)) {
      this.events.push({ type: 'sound', sound: 'invalid' })
      return
    }
    const replacement = naturalReplacementAt(this.config, hit.voxel.x, hit.voxel.y, hit.voxel.z)
    const edit = this.world.setBlock(hit.voxel.x, hit.voxel.y, hit.voxel.z, replacement)
    if (!edit.changed) return
    this.inventory[spec.drop] += 1
    this.events.push({ type: 'sound', sound: spec.drop === 'crystal' ? 'crystal' : 'break' })
    this.events.push({ type: 'edit', dirtyChunks: edit.dirtyChunks, voxel: hit.voxel, block: spec.drop })
    this.refreshTarget()
  }

  private placeTarget(): void {
    this.placeCooldown = this.config.interaction.placeCooldown
    const hit = this.target.hit
    const key = this.selectedBlock()
    const spec = BLOCKS[key]
    const replaced = hit ? this.world.getBlock(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z) : BLOCKS.air.id
    if (!hit || !spec.placeable || this.inventory[key] <= 0 ||
        !this.world.contains(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z) ||
        !blockById(replaced).replaceable ||
        playerIntersectsVoxel(this.player, hit.adjacent, this.config)) {
      this.events.push({ type: 'sound', sound: 'invalid' })
      return
    }
    const edit = this.world.setBlock(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z, blockId(key))
    if (!edit.changed || collidesAt(this.world, this.player.position, this.config)) {
      if (edit.changed) this.world.setBlock(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z, replaced)
      this.events.push({ type: 'sound', sound: 'invalid' })
      return
    }
    this.inventory[key] -= 1
    this.events.push({ type: 'sound', sound: 'place' })
    this.events.push({ type: 'edit', dirtyChunks: edit.dirtyChunks, voxel: hit.adjacent, block: key })
    if (this.placedCrystals() === this.config.session.requiredCrystals) this.end('victory')
    this.refreshTarget()
  }

  private placedCrystals(): number {
    return this.config.world.beaconSockets.reduce((count, socket) =>
      count + (this.world.getBlock(socket[0], socket[1], socket[2]) === BLOCKS.crystal.id ? 1 : 0), 0)
  }

  private end(phase: 'victory' | 'defeat'): void {
    if (this.phase !== 'playing') return
    this.phase = phase
    this.events.push({ type: 'sound', sound: phase })
    this.events.push({ type: 'phase', phase })
  }
}
