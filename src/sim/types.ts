import type { BlockKey, HotbarBlockKey } from '../data/blocks'
import type { CameraMode } from '../camera/config'
import type { TimeOfDay } from '../environment/config'
import type { ChunkCoord, VoxelCoord } from '../voxel/coords'
import type { RayHit } from '../voxel/raycast'
import type { CollectibleKey } from '../content/config'
import type { DecorationHit } from '../content/types'
import type { CreatureHit } from '../creatures/types'
import type { MissionSnapshot } from './mission'

export type GamePhase = 'focus' | 'playing' | 'victory' | 'defeat'
export type InputDevice = 'keyboard' | 'touch' | 'gamepad'
export type SoundType = 'jump' | 'splash' | 'break' | 'place' | 'crystal' | 'pickup' |
  'discovery' | 'respawn' | 'invalid' | 'victory' | 'defeat' | 'creatureHit' | 'creatureDefeat' | 'playerHurt'

export interface InputSnapshot {
  moveX: number
  moveZ: number
  lookX: number
  lookY: number
  sprint: boolean
  jumpPressed: boolean
  breakHeld: boolean
  placePressed: boolean
  slotDelta: number
  selectSlot: number | null
  restartPressed: boolean
  pausePressed: boolean
  cameraPressed: boolean
  device: InputDevice
}

export interface SimInput {
  moveX: number
  moveZ: number
  sprint: boolean
  jumpPressed: boolean
}

export interface PlayerState {
  position: VoxelCoord
  velocity: VoxelCoord
  yaw: number
  pitch: number
  grounded: boolean
  inWater: boolean
  coyoteRemaining: number
}

export interface HudSlot {
  key: HotbarBlockKey
  label: string
  count: number
  selected: boolean
  locked: boolean
}

export interface HudSnapshot {
  phase: GamePhase
  paused: boolean
  cameraMode: CameraMode
  timeOfDay: TimeOfDay
  mission: MissionSnapshot | null
  notice: { text: string; kind: 'pickup' | 'discovery' | 'respawn' | 'mission' | 'combat' } | null
  health: { current: number; max: number } | null
  slots: readonly HudSlot[]
  device: InputDevice
  hasTarget: boolean
  targetLabel: string
}

export type GameEvent =
  | { type: 'sound'; sound: SoundType }
  | { type: 'edit'; action: 'break' | 'place'; dirtyChunks: readonly ChunkCoord[]; voxel: VoxelCoord; block: BlockKey }
  | { type: 'collectible'; index: number; key: CollectibleKey }
  | { type: 'decoration'; index: number; reason: 'break' | 'unsupported'; position: VoxelCoord }
  | { type: 'reset'; world: boolean }
  | { type: 'respawn' }
  | { type: 'creature'; index: number; action: 'hit' | 'defeat'; position: VoxelCoord }
  | { type: 'phase'; phase: GamePhase }

export interface AimRay {
  origin: VoxelCoord
  direction: VoxelCoord
  maxDistance: number
}

export interface CameraPose extends AimRay {
  position: VoxelCoord
  mode: CameraMode
}

export interface AvatarRenderState {
  moving: boolean
  running: boolean
  grounded: boolean
  rising: boolean
}

export interface TargetSnapshot {
  hit: RayHit | null
  decoration: DecorationHit | null
  creature: CreatureHit | null
  label: string
}
