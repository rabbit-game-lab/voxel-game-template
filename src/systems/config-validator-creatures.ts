import { CREATURE_CATALOG, creatureDrawCalls } from '../creatures/catalog'
import type { CreatureBehaviorKey } from '../creatures/config'
import type { WorldZone } from '../content/config'
import type { GameConfig } from '../game.config'

const ZONES: readonly WorldZone[] = ['spawn-meadow', 'forest', 'shore', 'highland', 'coast']
const BEHAVIORS: readonly CreatureBehaviorKey[] = [
  'grazer', 'wanderer', 'skittish', 'companion', 'territorial',
  'chaser-melee', 'stationary', 'npc-wander', 'guardian',
]

export function validateCreaturesConfig(config: GameConfig): string[] {
  const errors: string[] = []
  const { creatures } = config
  if (!(creatures.preset in creatures.presets)) errors.push(`creatures.preset ${creatures.preset} is not defined`)
  for (const [key, value] of Object.entries(creatures.limits)) {
    if (!Number.isInteger(value) || value <= 0) errors.push(`creatures.limits.${key} must be a positive integer`)
  }
  if (creatures.limits.maxCreatures > 24) errors.push('creatures.limits.maxCreatures must not exceed 24')
  if (creatures.limits.maxEnemies > creatures.limits.maxCreatures) {
    errors.push('creatures.limits.maxEnemies must not exceed maxCreatures')
  }
  if (creatures.limits.maxDrawCalls < creatures.limits.maxCreatures) {
    errors.push('creatures.limits.maxDrawCalls must cover maxCreatures for the procedural backend')
  }
  for (const key of ['enabled', 'animalsDamageable'] as const) {
    if (typeof creatures.combat[key] !== 'boolean') errors.push(`creatures.combat.${key} must be boolean`)
  }
  for (const key of ['playerMaxHealth', 'playerAttackDamage', 'playerAttackCooldown', 'enemyAttackCooldown'] as const) {
    const value = creatures.combat[key]
    if (!Number.isFinite(value) || value <= 0) errors.push(`creatures.combat.${key} must be finite and > 0`)
  }
  if (!Number.isInteger(creatures.combat.playerMaxHealth)) {
    errors.push('creatures.combat.playerMaxHealth must be an integer')
  }
  if (!Number.isFinite(creatures.simulation.decisionHz) || creatures.simulation.decisionHz < 2 ||
      creatures.simulation.decisionHz > 30) errors.push('creatures.simulation.decisionHz must be in [2, 30]')
  if (!Number.isFinite(creatures.simulation.sleepDistance) || creatures.simulation.sleepDistance < 8 ||
      creatures.simulation.sleepDistance > config.camera.clipping.far) {
    errors.push('creatures.simulation.sleepDistance must be between 8 and camera far clipping')
  }
  for (const [presetKey, preset] of Object.entries(creatures.presets)) {
    let total = 0; let enemies = 0; let drawCalls = 0
    const ids = new Set<string>()
    for (const [index, group] of preset.groups.entries()) {
      const path = `creatures.presets.${presetKey}.groups[${index}]`
      if (!(group.species in CREATURE_CATALOG)) errors.push(`${path}.species is not registered`)
      if (!Number.isInteger(group.count) || group.count < 0) errors.push(`${path}.count must be a non-negative integer`)
      if (group.behavior && !BEHAVIORS.includes(group.behavior)) errors.push(`${path}.behavior is invalid`)
      if (!group.zones.length || group.zones.some((zone) => !ZONES.includes(zone))) errors.push(`${path}.zones is invalid`)
      if (!Number.isFinite(group.scale) || group.scale < 0.5 || group.scale > 2) errors.push(`${path}.scale must be in [0.5, 2]`)
      if (!Number.isFinite(group.minSpacing) || group.minSpacing < 1 || group.minSpacing > 16) errors.push(`${path}.minSpacing must be in [1, 16]`)
      if (!Number.isFinite(group.roamRadius) || group.roamRadius < 1 || group.roamRadius > 24) errors.push(`${path}.roamRadius must be in [1, 24]`)
      if (ids.has(group.species)) errors.push(`${path}.species is duplicated; combine it into one group`)
      ids.add(group.species); total += group.count
      if (group.species in CREATURE_CATALOG) drawCalls += group.count * creatureDrawCalls(group.species)
      if (CREATURE_CATALOG[group.species]?.category === 'enemy') enemies += group.count
    }
    if (total > creatures.limits.maxCreatures) errors.push(`creature preset ${presetKey} exceeds maxCreatures`)
    if (enemies > creatures.limits.maxEnemies) errors.push(`creature preset ${presetKey} exceeds maxEnemies`)
    if (drawCalls > creatures.limits.maxDrawCalls) errors.push(`creature preset ${presetKey} exceeds maxDrawCalls`)
  }
  return errors
}
