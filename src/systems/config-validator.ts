import { BLOCKS, isBlockKey } from '../data/blocks'
import type { LakeConfig } from '../environment/config'
import type { GameConfig } from '../game.config'
import { CHUNK_SIZE } from '../voxel/constants'
import { validateContentConfig } from './config-validator-content'
import { validateCreaturesConfig } from './config-validator-creatures'

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

export function validateConfig(config: GameConfig, modelKeys: readonly string[] = []): void {
  const errors: string[] = []
  const positive = (label: string, value: number): void => {
    if (!finite(value) || value <= 0) errors.push(`${label} must be finite and > 0`)
  }
  positive('player.bodyWidth', config.player.bodyWidth)
  positive('player.bodyHeight', config.player.bodyHeight)
  positive('player.moveSpeed', config.player.moveSpeed)
  positive('player.acceleration', config.player.acceleration)
  positive('player.jumpSpeed', config.player.jumpSpeed)
  positive('camera.firstPerson.fov', config.camera.modes.firstPerson.fov)
  positive('camera.thirdPerson.fov', config.camera.modes.thirdPerson.fov)
  positive('camera.clipping.far', config.camera.clipping.far)
  positive('interaction.reach', config.interaction.reach)
  positive('interaction.breakInterval', config.interaction.breakInterval)
  positive('interaction.placeCooldown', config.interaction.placeCooldown)
  positive('performance.maxChunkRebuildsPerFrame', config.performance.maxChunkRebuildsPerFrame)

  if (config.player.eyeHeight <= 0 || config.player.eyeHeight >= config.player.bodyHeight) {
    errors.push('player.eyeHeight must be inside player.bodyHeight')
  }
  if (config.player.gravity >= 0) errors.push('player.gravity must be negative')
  if (config.camera.clipping.near <= 0 || config.camera.clipping.near >= config.camera.clipping.far) {
    errors.push('camera.clipping.near must be > 0 and below far')
  }
  for (const [mode, spec] of Object.entries(config.camera.modes)) {
    if (spec.fov < 35 || spec.fov > 110) errors.push(`camera.modes.${mode}.fov must be 35–110 degrees`)
    if (!spec.pitchRange.every(finite) || spec.pitchRange[0] < -89 || spec.pitchRange[1] > 89 ||
        spec.pitchRange[0] >= spec.pitchRange[1]) {
      errors.push(`camera.modes.${mode}.pitchRange must be increasing inside [-89, 89]`)
    }
  }
  if (config.camera.initialMode !== 'first-person' && config.camera.initialMode !== 'third-person') {
    errors.push('camera.initialMode must be first-person or third-person')
  }
  if (typeof config.camera.switching.enabled !== 'boolean' || typeof config.camera.switching.showButton !== 'boolean') {
    errors.push('camera.switching flags must be boolean')
  }
  positive('camera.look.mouseSensitivity', config.camera.look.mouseSensitivity)
  positive('camera.look.touchSensitivity', config.camera.look.touchSensitivity)
  positive('camera.look.padLookSpeed', config.camera.look.padLookSpeed)
  const thirdPerson = config.camera.modes.thirdPerson
  for (const [label, value] of Object.entries({
    distance: thirdPerson.distance, height: thirdPerson.height, aimDistance: thirdPerson.aimDistance,
    minDistance: thirdPerson.minDistance, collisionRadius: thirdPerson.collisionRadius,
    collisionPadding: thirdPerson.collisionPadding, returnSpeed: thirdPerson.returnSpeed,
  })) positive(`camera.modes.thirdPerson.${label}`, value)
  if (thirdPerson.minDistance > thirdPerson.distance) {
    errors.push('camera.modes.thirdPerson.minDistance must not exceed distance')
  }
  if (thirdPerson.aimDistance < config.interaction.reach) {
    errors.push('camera.modes.thirdPerson.aimDistance must cover interaction.reach')
  }
  if (thirdPerson.collisionRadius > 1 || thirdPerson.collisionPadding >= thirdPerson.distance) {
    errors.push('camera third-person collision values are outside supported bounds')
  }
  if (config.controls.gamepadDeadZone < 0 || config.controls.gamepadDeadZone >= 1) {
    errors.push('controls.gamepadDeadZone must be in [0, 1)')
  }

  const { environment } = config
  for (const [label, value] of Object.entries({
    stars: environment.sky.stars.color,
    water: environment.water.color,
    shallowWater: environment.water.shallowColor,
    particles: environment.decorations.particles.color,
    selection: config.visual.selection,
    socket: config.visual.socket,
    avatarSkin: config.player.avatar.procedural.colors.skin,
    avatarHair: config.player.avatar.procedural.colors.hair,
    avatarShirt: config.player.avatar.procedural.colors.shirt,
    avatarPants: config.player.avatar.procedural.colors.pants,
    avatarBoots: config.player.avatar.procedural.colors.boots,
  })) {
    if (!validColor(value)) errors.push(`${label} must be a six-digit hex color`)
  }
  const avatar = config.player.avatar
  if (avatar.renderer !== 'procedural' && avatar.renderer !== 'gltf') {
    errors.push('player.avatar.renderer must be procedural or gltf')
  }
  positive('player.avatar.turnSpeed', avatar.turnSpeed)
  if (!finite(avatar.actionFacingTime) || avatar.actionFacingTime < 0) {
    errors.push('player.avatar.actionFacingTime must be finite and non-negative')
  }
  positive('player.avatar.procedural.height', avatar.procedural.height)
  positive('player.avatar.procedural.bodyWidth', avatar.procedural.bodyWidth)
  positive('player.avatar.procedural.headScale', avatar.procedural.headScale)
  if (avatar.procedural.height > config.player.bodyHeight) {
    errors.push('player.avatar.procedural.height must fit inside player.bodyHeight')
  }
  for (const [label, value] of Object.entries(avatar.procedural.animation)) {
    if (!finite(value) || value < 0) errors.push(`player.avatar.procedural.animation.${label} must be non-negative`)
  }
  if (!avatar.gltf.assetKey.trim()) errors.push('player.avatar.gltf.assetKey must not be empty')
  positive('player.avatar.gltf.scale', avatar.gltf.scale)
  if (!finite(avatar.gltf.yOffset) || !finite(avatar.gltf.rotationY) ||
      !finite(avatar.gltf.blendTime) || avatar.gltf.blendTime < 0) {
    errors.push('player.avatar.gltf transforms and blendTime must be finite')
  }
  if (avatar.renderer === 'gltf' && !modelKeys.includes(avatar.gltf.assetKey)) {
    errors.push(`player.avatar.gltf.assetKey ${avatar.gltf.assetKey} is not registered in the asset manifest`)
  }
  if (typeof avatar.shadow.enabled !== 'boolean' || !finite(avatar.shadow.opacity) ||
      avatar.shadow.opacity < 0 || avatar.shadow.opacity >= 1) {
    errors.push('player.avatar.shadow enabled/opacity values are invalid')
  }
  positive('player.avatar.shadow.radius', avatar.shadow.radius)
  positive('player.avatar.shadow.maxDistance', avatar.shadow.maxDistance)
  if (environment.sky.initialMode !== 'day' && environment.sky.initialMode !== 'night') {
    errors.push('environment.sky.initialMode must be day or night')
  }
  if (typeof environment.sky.showToggleButton !== 'boolean') {
    errors.push('environment.sky.showToggleButton must be boolean')
  }
  for (const mode of ['day', 'night'] as const) {
    const preset = environment.sky.presets[mode]
    for (const [label, value] of Object.entries({
      zenith: preset.zenith, horizon: preset.horizon, ambient: preset.ambient,
      fogColor: preset.fogColor, celestialColor: preset.celestialColor,
      lightColor: preset.lightColor, cloudColor: preset.cloudColor,
      worldTint: preset.worldTint, waterTint: preset.waterTint,
    })) {
      if (!validColor(value)) errors.push(`environment.sky.presets.${mode}.${label} must be a six-digit hex color`)
    }
    if (!finite(preset.fogStart) || !finite(preset.fogEnd) ||
        preset.fogStart < 0 || preset.fogStart >= preset.fogEnd) {
      errors.push(`environment.sky.presets.${mode} fog range must be finite, non-negative and increasing`)
    }
    if (!preset.celestialEuler.every(finite)) {
      errors.push(`environment.sky.presets.${mode}.celestialEuler must be finite`)
    }
    if (!finite(preset.celestialScale) || preset.celestialScale <= 0 || preset.celestialScale > 16) {
      errors.push(`environment.sky.presets.${mode}.celestialScale must be in (0, 16]`)
    }
    if (!finite(preset.lightIntensity) || preset.lightIntensity < 0 || preset.lightIntensity > 4) {
      errors.push(`environment.sky.presets.${mode}.lightIntensity must be in [0, 4]`)
    }
  }
  if (!Number.isInteger(environment.sky.stars.count) || environment.sky.stars.count < 0 ||
      environment.sky.stars.count > 96) {
    errors.push('environment.sky.stars.count must be an integer in [0, 96]')
  }
  if (!Number.isInteger(environment.sky.stars.seedOffset)) {
    errors.push('environment.sky.stars.seedOffset must be an integer')
  }
  if (!environment.sky.stars.size.every(finite) || environment.sky.stars.size[0] <= 0 ||
      environment.sky.stars.size[1] < environment.sky.stars.size[0] || environment.sky.stars.size[1] > 2) {
    errors.push('environment.sky.stars.size must be positive, increasing and at most 2')
  }
  if (!Number.isInteger(environment.clouds.seedOffset)) errors.push('environment.clouds.seedOffset must be an integer')
  let cloudCount = 0
  for (const [index, layer] of environment.clouds.layers.entries()) {
    cloudCount += layer.count
    if (!Number.isInteger(layer.count) || layer.count < 0) errors.push(`cloud layer ${index} count must be a non-negative integer`)
    if (!finite(layer.altitude) || layer.altitude <= 0 || layer.altitude >= config.camera.clipping.far) {
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
  if (config.world.beaconSockets.length !== config.mission.definitions.beacon.requiredCrystals) {
    errors.push('beaconSockets length must equal mission beacon requiredCrystals')
  }
  if (config.world.crystalNodes.length !== config.mission.definitions.beacon.requiredCrystals) {
    errors.push('crystalNodes length must equal mission beacon requiredCrystals')
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

  const particles = environment.decorations.particles
  if (!Number.isInteger(particles.count) || particles.count < 0 || particles.count > 24) {
    errors.push('environment.decorations.particles.count must be an integer in [0, 24]')
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
  errors.push(...validateContentConfig(config))
  errors.push(...validateCreaturesConfig(config))
  if (errors.length > 0) throw new Error(`Invalid game config:\n- ${errors.join('\n- ')}`)
}
