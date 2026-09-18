import type { CameraMode, Range } from '../camera/config'
import type { WorldContentPlan } from '../content/types'
import { decorationLabel, decorationsOnSupport, raycastDecorations } from '../content/interaction'
import {
  BLOCKS, HOTBAR_BLOCKS, blockById, blockId, blockKeyById, isBlockKey,
  type BlockKey, type HotbarBlockKey,
} from '../data/blocks'
import type { TimeOfDay } from '../environment/config'
import { naturalReplacementAt } from '../environment/lakes'
import type { GameConfig } from '../game.config'
import type { VoxelCoord } from '../voxel/coords'
import { sameVoxel } from '../voxel/coords'
import { generateWorld } from '../voxel/generator'
import { raycastVoxels } from '../voxel/raycast'
import { VoxelWorld } from '../voxel/world'
import { CollectibleStore, DiscoveryStore } from './exploration'
import { MissionController } from './mission'
import { collidesAt, createPlayer, playerIntersectsVoxel, stepPlayer } from './player'
import type {
  AimRay, GameEvent, GamePhase, HudSnapshot, InputDevice, InputSnapshot,
  PlayerState, SimInput, TargetSnapshot,
} from './types'

const PICKUP_LABELS = { apple: 'Manzana', mushroom: 'Hongo' } as const

export class GameSession {
  readonly world: VoxelWorld
  player: PlayerState
  contentPlan!: WorldContentPlan
  phase: GamePhase = 'focus'
  private inventory = {} as Record<BlockKey, number>
  private selectedSlot = 1
  private target: TargetSnapshot = { hit: null, decoration: null, label: '' }
  private decorationActive = new Uint8Array()
  private breakCooldown = 0
  private placeCooldown = 0
  private aimRay: AimRay | null = null
  private cameraMode: CameraMode
  private readonly events: GameEvent[] = []
  private readonly collectibles = new CollectibleStore()
  private readonly discoveries = new DiscoveryStore()
  private readonly mission: MissionController
  private notice: HudSnapshot['notice'] = null
  private noticeRemaining = 0

  constructor(private readonly config: GameConfig) {
    this.world = new VoxelWorld(config.world.min, config.world.size)
    this.player = createPlayer(config)
    this.cameraMode = config.camera.initialMode
    this.mission = new MissionController(config.mission)
    this.restart()
  }

  restart(): void {
    this.contentPlan = generateWorld(this.world, this.config)
    this.collectibles.reset(this.contentPlan)
    this.decorationActive = new Uint8Array(this.contentPlan.meshes.length).fill(1)
    this.discoveries.reset(this.contentPlan)
    this.mission.reset()
    this.player = createPlayer(this.config)
    this.phase = 'focus'
    this.selectedSlot = 1
    this.breakCooldown = 0; this.placeCooldown = 0
    this.aimRay = null
    this.cameraMode = this.config.camera.initialMode
    this.events.length = 0
    this.resetInventory()
    this.target = { hit: null, decoration: null, label: '' }
    this.notice = null; this.noticeRemaining = 0
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
    if (this.phase !== 'playing') return
    this.player.yaw = (this.player.yaw - input.lookX) % 360
    this.player.pitch = Math.max(pitchRange[0], Math.min(pitchRange[1], this.player.pitch - input.lookY))
  }

  stepMovement(input: SimInput, dt: number): void {
    if (this.phase !== 'playing') return
    this.breakCooldown = Math.max(0, this.breakCooldown - dt)
    this.placeCooldown = Math.max(0, this.placeCooldown - dt)
    if (this.noticeRemaining > 0) {
      this.noticeRemaining = Math.max(0, this.noticeRemaining - dt)
      if (this.noticeRemaining === 0) this.notice = null
    }
    const movement = stepPlayer(this.world, this.player, input, dt, this.config)
    if (movement.jumped) this.events.push({ type: 'sound', sound: 'jump' })
    if (movement.enteredWater) this.events.push({ type: 'sound', sound: 'splash' })
    if (this.player.position.y < this.config.session.fallY) {
      if (this.config.session.fallBehavior === 'defeat') this.end('defeat')
      else this.respawn()
      return
    }
    this.collectNearby(); this.discoverNearby(); this.evaluateMission()
  }

  updateTarget(aimRay: AimRay, cameraMode: CameraMode): void {
    this.aimRay = aimRay; this.cameraMode = cameraMode; this.refreshTarget()
  }

  applyInteraction(breakHeld: boolean, placePressed: boolean): void {
    if (this.phase !== 'playing') return
    if (breakHeld && this.breakCooldown <= 0) this.breakTarget()
    if (placePressed && this.placeCooldown <= 0) this.placeTarget()
  }

  targetSnapshot(): TargetSnapshot {
    return this.target
  }

  collectibleActiveSnapshot(): boolean[] {
    return this.collectibles.activeSnapshot()
  }

  decorationActiveSnapshot(): boolean[] {
    return Array.from(this.decorationActive, (value) => value === 1)
  }

  isBeaconMission(): boolean {
    return this.config.mission.active === 'beacon'
  }

  getHudSnapshot(device: InputDevice, paused: boolean, timeOfDay: TimeOfDay, cameraMode: CameraMode): HudSnapshot {
    return {
      phase: this.phase, paused, cameraMode, timeOfDay,
      mission: this.mission.snapshot(), notice: this.notice,
      device, hasTarget: this.target.hit !== null || this.target.decoration !== null,
      targetLabel: this.target.label,
      slots: HOTBAR_BLOCKS.map((key, index) => ({
        key, label: BLOCKS[key].label, count: this.inventory[key],
        selected: index === this.selectedSlot, locked: !BLOCKS[key].placeable,
      })),
    }
  }

  consumeEvents(): GameEvent[] {
    return this.events.splice(0)
  }

  private resetInventory(): void {
    for (const key of Object.keys(BLOCKS) as BlockKey[]) {
      this.inventory[key] = this.config.world.startingInventory[key] ?? 0
    }
  }

  private refreshTarget(): void {
    const aim = this.aimRay
    if (!aim) { this.target = { hit: null, decoration: null, label: '' }; return }
    let target = this.raycastTarget(aim.origin, aim.direction, aim.maxDistance)
    if ((target.hit || target.decoration) && this.cameraMode === 'third-person') {
      const distance = (target.decoration?.distance ?? target.hit!.distance) + 0.001
      const surface = {
        x: aim.origin.x + aim.direction.x * distance,
        y: aim.origin.y + aim.direction.y * distance,
        z: aim.origin.z + aim.direction.z * distance,
      }
      const eye = {
        x: this.player.position.x,
        y: this.player.position.y + this.config.player.eyeHeight,
        z: this.player.position.z,
      }
      const line = { x: surface.x - eye.x, y: surface.y - eye.y, z: surface.z - eye.z }
      const reach = Math.hypot(line.x, line.y, line.z)
      const eyeTarget = reach <= this.config.interaction.reach
        ? this.raycastTarget(eye, line, reach + 0.01) : { hit: null, decoration: null }
      const sameBlock = target.hit && eyeTarget.hit && sameVoxel(eyeTarget.hit.voxel, target.hit.voxel)
      const sameDecoration = target.decoration && eyeTarget.decoration &&
        eyeTarget.decoration.index === target.decoration.index
      if (!sameBlock && !sameDecoration) target = { hit: null, decoration: null }
    }
    const decoration = target.decoration
    this.target = {
      ...target,
      label: decoration ? decorationLabel(this.contentPlan.meshes[decoration.index])
        : target.hit ? blockById(this.world.getBlock(target.hit.voxel.x, target.hit.voxel.y, target.hit.voxel.z)).label : '',
    }
  }

  private raycastTarget(origin: VoxelCoord, direction: VoxelCoord, maxDistance: number) {
    const hit = raycastVoxels(this.world, origin, direction, maxDistance)
    const decoration = this.config.content.interaction.breakableDecorations
      ? raycastDecorations(this.contentPlan.meshes, this.decorationActive, origin, direction, maxDistance)
      : null
    if (decoration && (!hit || decoration.distance < hit.distance)) return { hit: null, decoration }
    return { hit, decoration: null }
  }

  private selectedBlock(): HotbarBlockKey {
    return HOTBAR_BLOCKS[this.selectedSlot]
  }

  private breakTarget(): void {
    this.breakCooldown = this.config.interaction.breakInterval
    const decoration = this.target.decoration
    if (decoration) {
      this.removeDecoration(decoration.index, 'break')
      this.events.push({ type: 'sound', sound: 'break' })
      this.refreshTarget()
      return
    }
    const hit = this.target.hit
    if (!hit) return
    const currentId = this.world.getBlock(hit.voxel.x, hit.voxel.y, hit.voxel.z)
    const spec = blockById(currentId)
    if (!spec.breakable || (spec.drop !== null && !isBlockKey(spec.drop))) {
      this.events.push({ type: 'sound', sound: 'invalid' }); return
    }
    const replacement = naturalReplacementAt(this.config, hit.voxel.x, hit.voxel.y, hit.voxel.z)
    const edit = this.world.setBlock(hit.voxel.x, hit.voxel.y, hit.voxel.z, replacement)
    if (!edit.changed) return
    if (spec.drop && isBlockKey(spec.drop)) this.inventory[spec.drop] += 1
    const brokenKey = blockKeyById(currentId)
    this.events.push({ type: 'sound', sound: spec.drop === 'crystal' ? 'crystal' : 'break' })
    this.events.push({
      type: 'edit', action: 'break', dirtyChunks: edit.dirtyChunks,
      voxel: hit.voxel, block: spec.drop && isBlockKey(spec.drop) ? spec.drop : brokenKey,
    })
    this.removeDecorationsAbove(hit.voxel)
    this.refreshTarget()
  }

  private removeDecoration(index: number, reason: 'break' | 'unsupported'): void {
    if (this.decorationActive[index] !== 1) return
    this.decorationActive[index] = 0
    const item = this.contentPlan.meshes[index]
    this.events.push({
      type: 'decoration', index, reason,
      position: { x: item.x, y: item.y, z: item.z },
    })
  }

  private removeDecorationsAbove(voxel: VoxelCoord): void {
    if (!this.config.content.interaction.removeUnsupportedDecorations ||
        blockById(this.world.getBlock(voxel.x, voxel.y, voxel.z)).solid) return
    for (const index of decorationsOnSupport(this.contentPlan.meshes, this.decorationActive, voxel)) {
      this.removeDecoration(index, 'unsupported')
    }
  }

  private placeTarget(): void {
    this.placeCooldown = this.config.interaction.placeCooldown
    const hit = this.target.hit
    const key = this.selectedBlock(); const spec = BLOCKS[key]
    const replaced = hit ? this.world.getBlock(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z) : BLOCKS.air.id
    if (!hit || !spec.placeable || this.inventory[key] <= 0 ||
        !this.world.contains(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z) ||
        !blockById(replaced).replaceable || playerIntersectsVoxel(this.player, hit.adjacent, this.config)) {
      this.events.push({ type: 'sound', sound: 'invalid' }); return
    }
    const edit = this.world.setBlock(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z, blockId(key))
    if (!edit.changed || collidesAt(this.world, this.player.position, this.config)) {
      if (edit.changed) this.world.setBlock(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z, replaced)
      this.events.push({ type: 'sound', sound: 'invalid' }); return
    }
    this.inventory[key] -= 1
    this.events.push({ type: 'sound', sound: 'place' })
    this.events.push({ type: 'edit', action: 'place', dirtyChunks: edit.dirtyChunks, voxel: hit.adjacent, block: key })
    this.evaluateMission(); this.refreshTarget()
  }

  private collectNearby(): void {
    for (let index = this.collectibles.nextNearby(this.player.position); index >= 0;
      index = this.collectibles.nextNearby(this.player.position)) {
      const item = this.collectibles.placement(index)
      this.events.push({ type: 'collectible', index, key: item.key })
      this.events.push({ type: 'sound', sound: 'pickup' })
      this.setNotice(`Recogiste: ${PICKUP_LABELS[item.key]}`, 'pickup', 1.8)
    }
  }

  private discoverNearby(): void {
    const discovery = this.discoveries.nextNearby(this.player.position)
    if (!discovery) return
    this.events.push({ type: 'sound', sound: 'discovery' })
    this.setNotice(`Lugar descubierto: ${discovery.label}`, 'discovery', discovery.toastSeconds)
  }

  private evaluateMission(): void {
    const outcome = this.mission.evaluate(this.placedCrystals(), (key) => this.collectibles.count(key))
    if (!outcome) return
    this.setNotice(`Misión completada: ${outcome.title}`, 'mission', 3)
    if (outcome.completion === 'victory') this.end('victory')
    else this.events.push({ type: 'sound', sound: 'victory' })
  }

  private placedCrystals(): number {
    if (!this.isBeaconMission()) return 0
    return this.config.world.beaconSockets.reduce((count, socket) =>
      count + (this.world.getBlock(socket[0], socket[1], socket[2]) === BLOCKS.crystal.id ? 1 : 0), 0)
  }

  private respawn(): void {
    let worldReset = false
    if (!this.config.session.respawn.keepWorldEdits) {
      this.contentPlan = generateWorld(this.world, this.config)
      this.decorationActive = new Uint8Array(this.contentPlan.meshes.length).fill(1)
      this.collectibles.rebind(this.contentPlan)
      this.discoveries.rebind(this.contentPlan)
      worldReset = true
    }
    if (!this.config.session.respawn.keepCollectibles) this.collectibles.reset(this.contentPlan)
    if (!this.config.session.respawn.keepBlockInventory) this.resetInventory()
    this.player = createPlayer(this.config)
    this.target = { hit: null, decoration: null, label: '' }; this.aimRay = null
    this.breakCooldown = 0; this.placeCooldown = 0
    this.events.push({ type: 'respawn' })
    if (worldReset || !this.config.session.respawn.keepCollectibles) {
      this.events.push({ type: 'reset', world: worldReset })
    }
    this.events.push({ type: 'sound', sound: 'respawn' })
    this.setNotice('Volviste al campamento', 'respawn', 2.2)
  }

  private setNotice(text: string, kind: NonNullable<HudSnapshot['notice']>['kind'], seconds: number): void {
    this.notice = { text, kind }; this.noticeRemaining = seconds
  }

  private end(phase: 'victory' | 'defeat'): void {
    if (this.phase !== 'playing') return
    this.phase = phase
    this.events.push({ type: 'sound', sound: phase })
    this.events.push({ type: 'phase', phase })
  }
}
