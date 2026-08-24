import type { BlockKey } from './data/blocks'
import type { EnvironmentConfig } from './environment/config'

type Vec2 = readonly [number, number]
type Vec3 = readonly [number, number, number]

export interface GameConfig {
  session: { title: string; requiredCrystals: number; defeatY: number }
  player: {
    bodyWidth: number; bodyHeight: number; eyeHeight: number
    moveSpeed: number; sprintMultiplier: number; acceleration: number
    airControl: number; friction: number; jumpSpeed: number
    gravity: number; maxFallSpeed: number; coyoteTime: number
  }
  camera: {
    fov: number; nearClip: number; farClip: number; maxPitch: number
    mouseSensitivity: number; touchSensitivity: number; padLookSpeed: number
  }
  controls: { gamepadDeadZone: number; fallbackDragThreshold: number; touchSize: number }
  world: {
    seed: number; min: Vec3; size: Vec3; spawn: Vec3
    plateauCenter: Vec3; beaconBase: Vec3
    beaconSockets: readonly Vec3[]; crystalNodes: readonly Vec3[]; trees: readonly Vec2[]
    startingInventory: Readonly<Partial<Record<BlockKey, number>>>
  }
  interaction: { reach: number; breakInterval: number; placeCooldown: number }
  hud: { heartbeat: number }
  environment: EnvironmentConfig
  visual: {
    topTint: number; sideTint: number; darkSideTint: number; bottomTint: number
    selection: string; socket: string
  }
  audio: { sfxVolume: number; musicVolume: number }
  performance: { maxChunkRebuildsPerFrame: number; fragmentPoolSize: number; maxCatchupSteps: number }
}

/**
 * Public tuning surface. Units, ranges and interactions are documented in
 * docs/game-config.md. Algorithms, asset paths and lifecycle do not belong here.
 */
export const CONFIG = {
  session: { title: 'Rabbit Voxel Lab', requiredCrystals: 3, defeatY: -8 },
  player: {
    bodyWidth: 0.62, bodyHeight: 1.8, eyeHeight: 1.62,
    moveSpeed: 5.4, sprintMultiplier: 1.45, acceleration: 34,
    airControl: 0.35, friction: 24, jumpSpeed: 8.4,
    gravity: -25, maxFallSpeed: 36, coyoteTime: 0.1,
  },
  camera: {
    fov: 72, nearClip: 0.05, farClip: 90, maxPitch: 88,
    mouseSensitivity: 0.09, touchSensitivity: 0.18, padLookSpeed: 145,
  },
  controls: { gamepadDeadZone: 0.17, fallbackDragThreshold: 7, touchSize: 126 },
  world: {
    seed: 1337,
    min: [-24, 0, -24], size: [48, 32, 48], spawn: [0.5, 15, 0.5],
    plateauCenter: [0, 13, 0], beaconBase: [4, 13, -3],
    beaconSockets: [[4, 14, -3], [5, 14, -3], [6, 14, -3]],
    crystalNodes: [[-9, 11, -6], [10, 9, -8], [3, 10, 13]],
    trees: [[-20, 8], [12, 7], [-5, -13]],
    startingInventory: { grass: 0, dirt: 12, stone: 8, planks: 8, crystal: 0, bedrock: 0 },
  },
  interaction: { reach: 6, breakInterval: 0.18, placeCooldown: 0.15 },
  hud: { heartbeat: 0.25 },
  environment: {
    sky: {
      initialMode: 'day',
      showToggleButton: false,
      presets: {
        day: {
          zenith: '#74b9e8', horizon: '#c9e5dc', ambient: '#526963',
          fogColor: '#b6d8d3', fogStart: 32, fogEnd: 76,
          celestialColor: '#ffe2aa', celestialEuler: [48, -32, 0], celestialScale: 5.2,
          lightColor: '#ffe2aa', lightIntensity: 0.88, cloudColor: '#fff8e5',
          worldTint: '#ffffff', waterTint: '#ffffff',
        },
        night: {
          zenith: '#08142e', horizon: '#293757', ambient: '#172238',
          fogColor: '#1c2d49', fogStart: 28, fogEnd: 68,
          celestialColor: '#dbe9ff', celestialEuler: [32, 38, 0], celestialScale: 4.4,
          lightColor: '#8ea7d8', lightIntensity: 0.28, cloudColor: '#6d7894',
          worldTint: '#53617c', waterTint: '#435978',
        },
      },
      stars: { enabled: true, count: 72, seedOffset: 9127, color: '#eaf2ff', size: [0.18, 0.42] },
    },
    clouds: {
      enabled: true, seedOffset: 7001,
      layers: [
        { count: 6, altitude: 24, speed: 0.28, scale: [1.6, 3.2] },
        { count: 4, altitude: 28, speed: 0.14, scale: [2.2, 4.2] },
      ],
    },
    water: {
      enabled: true, color: '#4fa7b5', shallowColor: '#7bd0c5', opacity: 0.68,
      surfaceInset: 0.12, wadeSpeedMultiplier: 0.62,
      lakes: [{ id: 'spawn-lake', center: [-13, 7, 10], radius: [6, 5], shoreWidth: 2, edgeNoise: 0.18 }],
    },
    decorations: {
      reeds: { enabled: true, count: 34, color: '#6d9d4d' },
      rocks: { enabled: true, count: 18, color: '#7b8580' },
      particles: { enabled: true, count: 18, color: '#e8e58c' },
    },
    ambience: { enabled: true, volume: 0.018, waterInterval: [5, 9], windInterval: [8, 14] },
  },
  visual: {
    topTint: 1, sideTint: 0.88, darkSideTint: 0.8, bottomTint: 0.65,
    selection: '#fff2a8', socket: '#8ff5ff',
  },
  audio: { sfxVolume: 0.72, musicVolume: 0 },
  performance: { maxChunkRebuildsPerFrame: 2, fragmentPoolSize: 32, maxCatchupSteps: 5 },
} as const satisfies GameConfig
