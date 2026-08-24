import { BLOCKS, isBlockKey } from '../data/blocks'
import type { GameConfig } from '../game.config'
import { CHUNK_SIZE } from '../voxel/constants'

function finite(value: number): boolean {
  return Number.isFinite(value)
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

