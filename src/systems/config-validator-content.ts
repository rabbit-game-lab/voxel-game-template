import type { WorldZone } from '../content/config'
import type { GameConfig } from '../game.config'

const ZONES: readonly WorldZone[] = ['spawn-meadow', 'forest', 'shore', 'highland', 'coast']
const COMPLETIONS = ['victory', 'continue'] as const

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function validColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function validRange(range: readonly [number, number]): boolean {
  return range.every(finite) && range[0] > 0 && range[1] >= range[0]
}

export function validateContentConfig(config: GameConfig): string[] {
  const errors: string[] = []
  const { content, mission } = config
  if (content.preset !== 'forest' && content.preset !== 'minimal') {
    errors.push('content.preset must be forest or minimal')
  }
  for (const [key, value] of Object.entries(content.interaction)) {
    if (typeof value !== 'boolean') errors.push(`content.interaction.${key} must be boolean`)
  }
  for (const [label, value] of Object.entries(content.limits)) {
    if (!Number.isInteger(value) || value <= 0) errors.push(`content.limits.${label} must be a positive integer`)
  }
  if (content.limits.maxExtraDrawCalls < 5 || content.limits.maxExtraDrawCalls > 8) {
    errors.push('content.limits.maxExtraDrawCalls must be in [5, 8]')
  }
  const minX = config.world.min[0]; const maxX = minX + config.world.size[0]
  const minZ = config.world.min[2]; const maxZ = minZ + config.world.size[2]
  for (const [presetKey, preset] of Object.entries(content.presets)) {
    let treeCount = 0
    for (const [key, spec] of Object.entries(preset.trees)) {
      if (!Number.isInteger(spec.count) || spec.count < 0) errors.push(`content.presets.${presetKey}.trees.${key}.count is invalid`)
      if (!finite(spec.minSpacing) || spec.minSpacing < 2) errors.push(`content.presets.${presetKey}.trees.${key}.minSpacing must be >= 2`)
      if (!validRange(spec.height) || spec.height[1] > 10) errors.push(`content.presets.${presetKey}.trees.${key}.height is invalid`)
      if (spec.zones.length === 0 || spec.zones.some((zone) => !ZONES.includes(zone))) {
        errors.push(`content.presets.${presetKey}.trees.${key}.zones is invalid`)
      }
      if (spec.enabled) treeCount += spec.count
    }
    if (treeCount > content.limits.maxTrees) errors.push(`content preset ${presetKey} exceeds maxTrees`)

    let scatterCount = 0
    for (const [key, spec] of Object.entries(preset.scatter)) {
      if (!Number.isInteger(spec.count) || spec.count < 0) errors.push(`content.presets.${presetKey}.scatter.${key}.count is invalid`)
      if (!validColor(spec.color)) errors.push(`content.presets.${presetKey}.scatter.${key}.color is invalid`)
      if (!validRange(spec.scale) || spec.scale[1] > 3) errors.push(`content.presets.${presetKey}.scatter.${key}.scale is invalid`)
      if (spec.zones.length === 0 || spec.zones.some((zone) => !ZONES.includes(zone))) {
        errors.push(`content.presets.${presetKey}.scatter.${key}.zones is invalid`)
      }
      if (spec.enabled) scatterCount += spec.count
    }
    if (scatterCount > content.limits.maxScatterInstances) {
      errors.push(`content preset ${presetKey} exceeds maxScatterInstances`)
    }

    let collectibleCount = 0
    for (const [key, spec] of Object.entries(preset.collectibles)) {
      if (!Number.isInteger(spec.count) || spec.count < 0) errors.push(`content.presets.${presetKey}.collectibles.${key}.count is invalid`)
      if (!finite(spec.pickupRadius) || spec.pickupRadius < 0.5 || spec.pickupRadius > 3) {
        errors.push(`content.presets.${presetKey}.collectibles.${key}.pickupRadius must be in [0.5, 3]`)
      }
      if (!validColor(spec.color) || !validRange(spec.scale)) {
        errors.push(`content.presets.${presetKey}.collectibles.${key} style is invalid`)
      }
      if (spec.zones.length === 0 || spec.zones.some((zone) => !ZONES.includes(zone))) {
        errors.push(`content.presets.${presetKey}.collectibles.${key}.zones is invalid`)
      }
      if (spec.enabled) collectibleCount += spec.count
    }
    if (collectibleCount > content.limits.maxCollectibles) {
      errors.push(`content preset ${presetKey} exceeds maxCollectibles`)
    }
    if (!finite(preset.discoveries.radius) || preset.discoveries.radius <= 0 ||
        !finite(preset.discoveries.toastSeconds) || preset.discoveries.toastSeconds <= 0) {
      errors.push(`content.presets.${presetKey}.discoveries ranges are invalid`)
    }
    if (preset.landmarks.length > content.limits.maxLandmarks) {
      errors.push(`content preset ${presetKey} exceeds maxLandmarks`)
    }
    const ids = new Set<string>()
    for (const landmark of preset.landmarks) {
      if (!landmark.id.trim() || ids.has(landmark.id)) errors.push(`content preset ${presetKey} has invalid landmark id ${landmark.id}`)
      ids.add(landmark.id)
      if (!landmark.label.trim()) errors.push(`landmark ${landmark.id} requires a label`)
      if (!landmark.center.every(finite) || landmark.center[0] < minX + 3 || landmark.center[0] >= maxX - 3 ||
          landmark.center[1] < minZ + 3 || landmark.center[1] >= maxZ - 3) {
        errors.push(`landmark ${landmark.id} must fit inside world bounds`)
      }
      if (Math.hypot(landmark.center[0] - config.world.spawn[0], landmark.center[1] - config.world.spawn[2]) < 7) {
        errors.push(`landmark ${landmark.id} overlaps the spawn clearing`)
      }
    }
  }

  if (!['none', 'beacon', 'collect'].includes(mission.active)) errors.push('mission.active is invalid')
  if (!mission.definitions.none.title.trim() || !mission.definitions.beacon.title.trim() ||
      !mission.definitions.collect.title.trim()) errors.push('mission titles must not be empty')
  if (!Number.isInteger(mission.definitions.beacon.requiredCrystals) || mission.definitions.beacon.requiredCrystals <= 0) {
    errors.push('mission.definitions.beacon.requiredCrystals must be a positive integer')
  }
  if (!Number.isInteger(mission.definitions.collect.required) || mission.definitions.collect.required <= 0 ||
      mission.definitions.collect.required > content.limits.maxCollectibles) {
    errors.push('mission.definitions.collect.required is outside content limits')
  }
  if (!['apple', 'mushroom'].includes(mission.definitions.collect.item)) {
    errors.push('mission.definitions.collect.item is invalid')
  }
  for (const [key, value] of [
    ['beacon', mission.definitions.beacon.onComplete],
    ['collect', mission.definitions.collect.onComplete],
  ] as const) {
    if (!COMPLETIONS.includes(value)) errors.push(`mission.definitions.${key}.onComplete is invalid`)
  }
  if (!finite(config.session.fallY)) errors.push('session.fallY must be finite')
  if (config.session.fallBehavior !== 'respawn' && config.session.fallBehavior !== 'defeat') {
    errors.push('session.fallBehavior must be respawn or defeat')
  }
  for (const [key, value] of Object.entries(config.session.respawn)) {
    if (typeof value !== 'boolean') errors.push(`session.respawn.${key} must be boolean`)
  }
  return errors
}
