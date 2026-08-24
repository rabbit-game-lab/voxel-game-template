import {
  BLOCKS, HOTBAR_BLOCKS, blockById, blockId, isBlockKey,
  type BlockKey, type HotbarBlockKey,
} from '../data/blocks'
import type { CameraMode, Range } from '../camera/config'
import type { GameConfig } from '../game.config'
import { naturalReplacementAt } from '../environment/lakes'
import type { TimeOfDay } from '../environment/config'
import type { VoxelCoord } from '../voxel/coords'
import { sameVoxel } from '../voxel/coords'
import { generateWorld } from '../voxel/generator'
import { raycastVoxels } from '../voxel/raycast'
import { VoxelWorld } from '../voxel/world'
import {
  collidesAt, createPlayer, playerIntersectsVoxel, stepPlayer,
} from './player'
import type {
  AimRay, GameEvent, GamePhase, HudSnapshot, InputDevice, InputSnapshot,
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
  private aimRay: AimRay | null = null
  private cameraMode: CameraMode
  private readonly events: GameEvent[] = []

  constructor(private readonly config: GameConfig) {
    this.world = new VoxelWorld(config.world.min, config.world.size)
    this.player = createPlayer(config)
    this.cameraMode = config.camera.initialMode
    this.restart()
  }

  restart(): void {
    generateWorld(this.world, this.config)
    this.player = createPlayer(this.config)
    this.phase = 'focus'
    this.selectedSlot = 1
    this.breakCooldown = 0
    this.placeCooldown = 0
    this.aimRay = null
    this.cameraMode = this.config.camera.initialMode
    this.events.length = 0
    for (const key of Object.keys(BLOCKS) as BlockKey[]) {
      this.inventory[key] = this.config.world.startingInventory[key] ?? 0
    }
    this.target = { hit: null, label: '' }
  }

  begin(): void {
    if (this.phase !== 'focus') return
    this.phase = 'playing'
    this.events.push({ type: 'phase', phase: this.phase })
  }

  applyFrameInput(input: InputSnapshot, pitchRange: Range): void {
    if (input.selectSlot !== null && input.selectSlot >= 0 && input.selectSlot < HOTBAR_BLOCKS.length) {
      this.selectedSlot = input.selectSlot
    }
    if (input.slotDelta !== 0) {
      this.selectedSlot = (this.selectedSlot + Math.sign(input.slotDelta) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length
    }
    if (this.phase === 'playing') {
      this.player.yaw = (this.player.yaw - input.lookX) % 360
      this.player.pitch = Math.max(
        pitchRange[0],
        Math.min(pitchRange[1], this.player.pitch - input.lookY),
      )
    }
  }

  stepMovement(input: SimInput, dt: number): void {
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
  }

  updateTarget(aimRay: AimRay, cameraMode: CameraMode): void {
    this.aimRay = aimRay
    this.cameraMode = cameraMode
    this.refreshTarget()
  }

  applyInteraction(breakHeld: boolean, placePressed: boolean): void {
    if (this.phase !== 'playing') return
    if (breakHeld && this.breakCooldown <= 0) this.breakTarget()
    if (placePressed && this.placeCooldown <= 0) this.placeTarget()
  }

  private refreshTarget(): void {
    const aim = this.aimRay
    if (!aim) { this.target = { hit: null, label: '' }; return }
    let hit = raycastVoxels(this.world, aim.origin, aim.direction, aim.maxDistance)
    if (hit && this.cameraMode === 'third-person') {
      const surfaceDistance = hit.distance + 0.001
      const surface = {
        x: aim.origin.x + aim.direction.x * surfaceDistance,
        y: aim.origin.y + aim.direction.y * surfaceDistance,
        z: aim.origin.z + aim.direction.z * surfaceDistance,
      }
      const eye = {
      x: this.player.position.x,
      y: this.player.position.y + this.config.player.eyeHeight,
      z: this.player.position.z,
      }
      const line = { x: surface.x - eye.x, y: surface.y - eye.y, z: surface.z - eye.z }
      const reach = Math.hypot(line.x, line.y, line.z)
      const eyeHit = reach <= this.config.interaction.reach
        ? raycastVoxels(this.world, eye, line, reach + 0.01)
        : null
      if (!eyeHit || !sameVoxel(eyeHit.voxel, hit.voxel)) hit = null
    }
    this.target = { hit, label: hit ? blockById(this.world.getBlock(hit.voxel.x, hit.voxel.y, hit.voxel.z)).label : '' }
  }

  targetSnapshot(): TargetSnapshot {
    return this.target
  }

  getHudSnapshot(device: InputDevice, paused: boolean, timeOfDay: TimeOfDay, cameraMode: CameraMode): HudSnapshot {
    return {
      phase: this.phase,
      paused,
      cameraMode,
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
    this.events.push({ type: 'edit', action: 'break', dirtyChunks: edit.dirtyChunks, voxel: hit.voxel, block: spec.drop })
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
    this.events.push({ type: 'edit', action: 'place', dirtyChunks: edit.dirtyChunks, voxel: hit.adjacent, block: key })
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
