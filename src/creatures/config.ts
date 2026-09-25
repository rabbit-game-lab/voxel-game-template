import type { WorldZone } from '../content/config'

export type CreatureSpeciesKey =
  | 'horse' | 'chicken' | 'sheep' | 'pig' | 'dog' | 'raccoon' | 'wolf'
  | 'slime' | 'skeleton' | 'goblin' | 'zombie'
  | 'explorer' | 'villager' | 'ironGolem'

export type CreatureCategory = 'animal' | 'enemy' | 'character'
export type CreatureBehaviorKey =
  | 'grazer' | 'wanderer' | 'skittish' | 'companion' | 'territorial'
  | 'chaser-melee' | 'stationary' | 'npc-wander' | 'guardian'
export type CreaturePresetKey = 'empty' | 'peacefulForest' | 'forestAdventure'

export interface CreatureGroupConfig {
  species: CreatureSpeciesKey
  count: number
  behavior?: CreatureBehaviorKey
  zones: readonly WorldZone[]
  scale: number
  minSpacing: number
  roamRadius: number
}

export interface CreaturePresetConfig {
  groups: readonly CreatureGroupConfig[]
}

/** Iron Golem guardian companion, added on top of whichever preset is active. */
export interface IronGolemConfig {
  enabled: boolean
  zones: readonly WorldZone[]
  scale: number
}

export interface CreaturesConfig {
  preset: CreaturePresetKey
  presets: Readonly<Record<CreaturePresetKey, CreaturePresetConfig>>
  ironGolem: IronGolemConfig
  combat: {
    enabled: boolean
    animalsDamageable: boolean
    playerMaxHealth: number
    playerAttackDamage: number
    playerAttackCooldown: number
    enemyAttackCooldown: number
  }
  simulation: {
    decisionHz: number
    sleepDistance: number
  }
  limits: {
    maxCreatures: number
    maxEnemies: number
    maxDrawCalls: number
  }
}
