import type { CollectibleKey } from '../content/config'

export type MissionKey = 'none' | 'beacon' | 'collect'
export type MissionCompletion = 'victory' | 'continue'

export interface MissionConfig {
  active: MissionKey
  definitions: {
    none: { title: string }
    beacon: { title: string; requiredCrystals: number; onComplete: MissionCompletion }
    collect: { title: string; item: CollectibleKey; required: number; onComplete: MissionCompletion }
  }
}
