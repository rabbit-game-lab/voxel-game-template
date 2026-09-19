import type { WorldZone } from '../content/config'
import type { CreatureBehaviorKey, CreatureCategory, CreatureSpeciesKey } from './config'

export interface CreatureSpawn {
  id: string
  species: CreatureSpeciesKey
  category: CreatureCategory
  behavior: CreatureBehaviorKey
  x: number
  y: number
  z: number
  yaw: number
  scale: number
  zone: WorldZone
  roamRadius: number
}

export interface CreatureState extends CreatureSpawn {
  spawnX: number
  spawnY: number
  spawnZ: number
  health: number
  active: boolean
  moving: boolean
  phase: number
}

export interface CreatureHit {
  index: number
  distance: number
}
