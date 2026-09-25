import type {
  CreatureBehaviorKey, CreatureCategory, CreatureSpeciesKey,
} from './config'

export type CreatureShape = 'quadruped' | 'bird' | 'humanoid' | 'slime' | 'golem'

export interface CreatureSpec {
  key: CreatureSpeciesKey
  label: string
  aliases: readonly string[]
  category: CreatureCategory
  shape: CreatureShape
  behavior: CreatureBehaviorKey
  colors: readonly [string, string, string]
  height: number
  radius: number
  moveSpeed: number
  health: number
  detectionRange: number
  attackRange: number
  attackDamage: number
}

const spec = (
  key: CreatureSpeciesKey, label: string, aliases: readonly string[], category: CreatureCategory,
  shape: CreatureShape, behavior: CreatureBehaviorKey, colors: readonly [string, string, string],
  height: number, radius: number, moveSpeed: number, health: number,
  detectionRange = 0, attackRange = 0, attackDamage = 0,
): CreatureSpec => ({
  key, label, aliases, category, shape, behavior, colors, height, radius,
  moveSpeed, health, detectionRange, attackRange, attackDamage,
})

/** Internal reusable asset catalog. Config selects species; render/sim details stay here. */
export const CREATURE_CATALOG = {
  horse: spec('horse', 'Horse', ['horse', 'pony', 'caballo', 'caballito'], 'animal', 'quadruped', 'grazer', ['#9b6138', '#4a2d21', '#25201d'], 1.65, 0.65, 2.1, 5),
  chicken: spec('chicken', 'Chicken', ['chicken', 'hen', 'gallina', 'pollo'], 'animal', 'bird', 'skittish', ['#f1ead8', '#d94c43', '#e9b949'], 0.65, 0.32, 1.65, 2),
  sheep: spec('sheep', 'Sheep', ['sheep', 'lamb', 'oveja', 'cordero'], 'animal', 'quadruped', 'grazer', ['#e8e5da', '#6b625a', '#292724'], 1.05, 0.52, 1.25, 3),
  pig: spec('pig', 'Pig', ['pig', 'piglet', 'cerdo', 'chanchito'], 'animal', 'quadruped', 'grazer', ['#e58f91', '#bd666e', '#4b3235'], 0.85, 0.48, 1.4, 3),
  dog: spec('dog', 'Dog', ['dog', 'puppy', 'perro', 'perrito'], 'animal', 'quadruped', 'companion', ['#b9824f', '#65442f', '#27211d'], 0.85, 0.42, 2.4, 3),
  raccoon: spec('raccoon', 'Raccoon', ['raccoon', 'mapache'], 'animal', 'quadruped', 'skittish', ['#777d7c', '#303535', '#d8d1bd'], 0.72, 0.4, 1.85, 2),
  wolf: spec('wolf', 'Wolf', ['wolf', 'lobo'], 'animal', 'quadruped', 'territorial', ['#777b78', '#4b504f', '#d7d4c8'], 1.0, 0.48, 2.65, 4, 7, 1.25, 1),
  slime: spec('slime', 'Slime', ['slime', 'blob', 'baba'], 'enemy', 'slime', 'chaser-melee', ['#66bd66', '#3c844b', '#172d20'], 0.8, 0.48, 1.3, 3, 8, 1.15, 1),
  skeleton: spec('skeleton', 'Skeleton', ['skeleton', 'esqueleto'], 'enemy', 'humanoid', 'chaser-melee', ['#ddd7bc', '#807d6e', '#242722'], 1.7, 0.38, 1.75, 4, 10, 1.3, 1),
  goblin: spec('goblin', 'Goblin', ['goblin', 'duende'], 'enemy', 'humanoid', 'chaser-melee', ['#6d9b55', '#704735', '#d2ad50'], 1.25, 0.4, 2.05, 4, 9, 1.25, 1),
  zombie: spec('zombie', 'Zombie', ['zombie', 'zombi'], 'enemy', 'humanoid', 'chaser-melee', ['#6f9971', '#45586e', '#493c32'], 1.7, 0.42, 1.45, 5, 10, 1.3, 1),
  explorer: spec('explorer', 'Explorer', ['explorer', 'adventurer', 'explorador'], 'character', 'humanoid', 'stationary', ['#d6a06c', '#3f8f86', '#34495e'], 1.72, 0.4, 1.5, 5),
  villager: spec('villager', 'Villager', ['villager', 'aldeano', 'aldeana'], 'character', 'humanoid', 'npc-wander', ['#c88d62', '#9d6849', '#5e7651'], 1.68, 0.4, 1.35, 5),
  ironGolem: spec('ironGolem', 'Iron Golem', ['iron golem', 'iron-golem', 'golem', 'golem de hierro'], 'character', 'golem', 'guardian', ['#d9d3c7', '#a9a397', '#4f8a3a'], 2.7, 0.7, 2.4, 20, 10, 1.7, 3),
} as const satisfies Record<CreatureSpeciesKey, CreatureSpec>

export function creatureSpec(key: CreatureSpeciesKey): CreatureSpec {
  return CREATURE_CATALOG[key]
}

export function findCreatureSpecies(name: string): CreatureSpeciesKey | null {
  const normalized = name.trim().toLocaleLowerCase()
  for (const item of Object.values(CREATURE_CATALOG)) {
    if (item.key === normalized || item.aliases.includes(normalized)) return item.key
  }
  return null
}

/** Render parts per instance: golems animate arms and legs as separate shared-mesh parts. */
export function creatureDrawCalls(key: CreatureSpeciesKey): number {
  return CREATURE_CATALOG[key].shape === 'golem' ? 5 : 1
}
