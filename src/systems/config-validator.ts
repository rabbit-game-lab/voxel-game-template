import { BLOCKS, isBlockKey } from '../data/blocks'
import type { LakeConfig } from '../environment/config'
import type { GameConfig } from '../game.config'
import { CHUNK_SIZE } from '../voxel/constants'

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function validColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function inLakeFootprint(point: readonly [number, number, number], lake: LakeConfig, clearance = 0): boolean {
  const rx = lake.radius[0] + lake.shoreWidth + clearance
  const rz = lake.radius[1] + lake.shoreWidth + clearance
  return ((point[0] - lake.center[0]) / rx) ** 2 + ((point[2] - lake.center[2]) / rz) ** 2 <= 1
}

export function validateConfig(config: GameConfig): void {
  const errors: string[] = []
  const positive = (label: string, value: number): void => {
    if (!finite(value) || value <= 0) errors.push(`${label} must be finite and > 0`)
  }
  positive('player.bodyWidth', config.player.bodyWidth)
  positive('player.bodyHeight', config.player.bodyHeight)
  positive('player.moveSpeed', config.player.moveSpeed)
  positive('player.acceleration', config.player.acceleration)
  positive('player.jumpSpeed', config.player.jumpSpeed)
  positive('camera.fov', config.camera.fov)
  positive('camera.farClip', config.camera.farClip)
  positive('interaction.reach', config.interaction.reach)
  positive('interaction.breakInterval', config.interaction.breakInterval)
  positive('interaction.placeCooldown', config.interaction.placeCooldown)
  positive('performance.maxChunkRebuildsPerFrame', config.performance.maxChunkRebuildsPerFrame)

  if (config.player.eyeHeight <= 0 || config.player.eyeHeight >= config.player.bodyHeight) {
    errors.push('player.eyeHeight must be inside player.bodyHeight')
  }
  if (config.player.gravity >= 0) errors.push('player.gravity must be negative')
  if (config.camera.nearClip <= 0 || config.camera.nearClip >= config.camera.farClip) {
    errors.push('camera.nearClip must be > 0 and below farClip')
  }
  if (config.camera.fov < 35 || config.camera.fov > 110) errors.push('camera.fov must be 35–110 degrees')
  if (config.controls.gamepadDeadZone < 0 || config.controls.gamepadDeadZone >= 1) {
    errors.push('controls.gamepadDeadZone must be in [0, 1)')
  }

  const { environment } = config
  for (const [label, value] of Object.entries({
    zenith: environment.sky.zenith,
    horizon: environment.sky.horizon,
    ambient: environment.sky.ambient,
    fogColor: environment.sky.fogColor,
    sunColor: environment.sky.sunColor,
    water: environment.water.color,
    shallowWater: environment.water.shallowColor,
    reeds: environment.decorations.reeds.color,
    rocks: environment.decorations.rocks.color,
    particles: environment.decorations.particles.color,
    selection: config.visual.selection,
    socket: config.visual.socket,
  })) {
    if (!validColor(value)) errors.push(`${label} must be a six-digit hex color`)
  }
  if (!finite(environment.sky.fogStart) || !finite(environment.sky.fogEnd) ||
      environment.sky.fogStart < 0 || environment.sky.fogStart >= environment.sky.fogEnd) {
    errors.push('environment.sky fog range must be finite, non-negative and increasing')
  }
  if (!environment.sky.sunEuler.every(finite)) errors.push('environment.sky.sunEuler must be finite')
  if (!Number.isInteger(environment.clouds.seedOffset)) errors.push('environment.clouds.seedOffset must be an integer')
  let cloudCount = 0
  for (const [index, layer] of environment.clouds.layers.entries()) {
    cloudCount += layer.count
    if (!Number.isInteger(layer.count) || layer.count < 0) errors.push(`cloud layer ${index} count must be a non-negative integer`)
    if (!finite(layer.altitude) || layer.altitude <= 0 || layer.altitude >= config.camera.farClip) {
      errors.push(`cloud layer ${index} altitude must be positive and below camera.farClip`)
    }
    if (!finite(layer.speed) || layer.speed < 0) errors.push(`cloud layer ${index} speed must be non-negative`)
    if (!layer.scale.every(finite) || layer.scale[0] <= 0 || layer.scale[1] < layer.scale[0]) {
      errors.push(`cloud layer ${index} scale must be positive and increasing`)
    }
  }
  if (cloudCount > 16) errors.push('environment.clouds supports at most 16 clouds')

  if (!finite(environment.water.opacity) || environment.water.opacity <= 0 || environment.water.opacity >= 1) {
    errors.push('environment.water.opacity must be in (0, 1)')
  }
  if (!finite(environment.water.surfaceInset) || environment.water.surfaceInset < 0 || environment.water.surfaceInset >= 0.5) {
    errors.push('environment.water.surfaceInset must be in [0, 0.5)')
  }
  if (!finite(environment.water.wadeSpeedMultiplier) ||
      environment.water.wadeSpeedMultiplier <= 0 || environment.water.wadeSpeedMultiplier > 1) {
    errors.push('environment.water.wadeSpeedMultiplier must be in (0, 1]')
  }

  for (const [index, value] of config.world.size.entries()) {
    if (!Number.isInteger(value) || value <= 0 || value % CHUNK_SIZE !== 0) {
      errors.push(`world.size[${index}] must be a positive multiple of ${CHUNK_SIZE}`)
    }
  }
  if (config.world.beaconSockets.length !== config.session.requiredCrystals) {
    errors.push('beaconSockets length must equal session.requiredCrystals')
  }
  if (config.world.crystalNodes.length !== config.session.requiredCrystals) {
    errors.push('crystalNodes length must equal session.requiredCrystals')
  }
  const contains = (point: readonly [number, number, number]): boolean =>
    point.every((value, index) => value >= config.world.min[index] &&
      value < config.world.min[index] + config.world.size[index])
  if (!contains(config.world.spawn)) errors.push('world.spawn is outside world bounds')
  for (const [label, points] of [
    ['beaconSockets', config.world.beaconSockets],
    ['crystalNodes', config.world.crystalNodes],
  ] as const) {
    const keys = new Set<string>()
    for (const point of points) {
      const key = point.join(',')
      if (!contains(point)) errors.push(`${label} contains out-of-bounds point ${key}`)
      if (keys.has(key)) errors.push(`${label} contains duplicate point ${key}`)
      keys.add(key)
    }
  }
  const lakeIds = new Set<string>()
  const worldMax = config.world.min.map((value, index) => value + config.world.size[index])
  for (const lake of environment.water.lakes) {
    if (!lake.id.trim() || lakeIds.has(lake.id)) errors.push(`environment.water has invalid or duplicate lake id ${lake.id}`)
    lakeIds.add(lake.id)
    if (!lake.center.every(Number.isInteger)) errors.push(`lake ${lake.id} center must use integer voxel coordinates`)
    if (!lake.radius.every(finite) || lake.radius.some((value) => value < 2)) {
      errors.push(`lake ${lake.id} radius values must be finite and at least 2`)
    }
    if (!finite(lake.shoreWidth) || lake.shoreWidth < 0 || lake.shoreWidth > 6) {
      errors.push(`lake ${lake.id} shoreWidth must be in [0, 6]`)
    }
    if (!finite(lake.edgeNoise) || lake.edgeNoise < 0 || lake.edgeNoise > 0.45) {
      errors.push(`lake ${lake.id} edgeNoise must be in [0, 0.45]`)
    }
    const outerX = lake.radius[0] + lake.shoreWidth
    const outerZ = lake.radius[1] + lake.shoreWidth
    if (lake.center[0] - outerX < config.world.min[0] || lake.center[0] + outerX >= worldMax[0] ||
        lake.center[2] - outerZ < config.world.min[2] || lake.center[2] + outerZ >= worldMax[2] ||
        lake.center[1] <= config.world.min[1] || lake.center[1] + 1 >= worldMax[1]) {
      errors.push(`lake ${lake.id} including shore must fit inside world bounds`)
    }
    for (const [label, point] of [
      ['spawn', config.world.spawn],
      ['plateau', config.world.plateauCenter],
      ['beacon', config.world.beaconBase],
      ...config.world.beaconSockets.map((item) => ['socket', item] as const),
      ...config.world.crystalNodes.map((item) => ['crystal', item] as const),
    ] as const) {
      if (inLakeFootprint(point, lake, label === 'spawn' ? 2 : 1)) {
        errors.push(`lake ${lake.id} overlaps protected ${label} landmark`)
      }
    }
  }

  for (const [label, spec, max] of [
    ['reeds', environment.decorations.reeds, 64],
    ['rocks', environment.decorations.rocks, 32],
    ['particles', environment.decorations.particles, 24],
  ] as const) {
    if (!Number.isInteger(spec.count) || spec.count < 0 || spec.count > max) {
      errors.push(`environment.decorations.${label}.count must be an integer in [0, ${max}]`)
    }
  }
  for (const [label, interval] of [
    ['waterInterval', environment.ambience.waterInterval],
    ['windInterval', environment.ambience.windInterval],
  ] as const) {
    if (!interval.every(finite) || interval[0] <= 0 || interval[1] < interval[0]) {
      errors.push(`environment.ambience.${label} must be positive and increasing`)
    }
  }
  if (!finite(environment.ambience.volume) || environment.ambience.volume < 0 || environment.ambience.volume > 1) {
    errors.push('environment.ambience.volume must be in [0, 1]')
  }
  for (const [key, count] of Object.entries(config.world.startingInventory)) {
    if (!isBlockKey(key)) errors.push(`startingInventory references unknown block ${key}`)
    if (!finite(count) || count < 0 || !Number.isInteger(count)) {
      errors.push(`startingInventory.${key} must be a non-negative integer`)
    }
  }
  if (Object.keys(BLOCKS).length > 255) errors.push('Block registry exceeds Uint8Array capacity')
  for (const [label, volume] of Object.entries(config.audio)) {
    if (!finite(volume) || volume < 0 || volume > 1) errors.push(`audio.${label} must be in [0, 1]`)
  }
  if (errors.length > 0) throw new Error(`Invalid game config:\n- ${errors.join('\n- ')}`)
}
