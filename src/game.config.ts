import type { BlockKey } from './data/blocks'
import type { AvatarConfig, CameraConfig } from './camera/config'
import type { EnvironmentConfig } from './environment/config'
import type { ContentConfig } from './content/config'
import type { MissionConfig } from './sim/mission-config'

type Vec3 = readonly [number, number, number]

export interface GameConfig {
  session: {
    title: string
    fallY: number
    fallBehavior: 'respawn' | 'defeat'
    respawn: { keepBlockInventory: boolean; keepCollectibles: boolean; keepWorldEdits: boolean }
  }
  mission: MissionConfig
  player: {
    bodyWidth: number; bodyHeight: number; eyeHeight: number
    moveSpeed: number; sprintMultiplier: number; acceleration: number
    airControl: number; friction: number; jumpSpeed: number
    gravity: number; maxFallSpeed: number; coyoteTime: number
    avatar: AvatarConfig
  }
  camera: CameraConfig
  controls: { gamepadDeadZone: number; fallbackDragThreshold: number; touchSize: number }
  world: {
    seed: number; min: Vec3; size: Vec3; spawn: Vec3
    plateauCenter: Vec3; beaconBase: Vec3
    beaconSockets: readonly Vec3[]; crystalNodes: readonly Vec3[]
    startingInventory: Readonly<Partial<Record<BlockKey, number>>>
  }
  interaction: { reach: number; breakInterval: number; placeCooldown: number }
  hud: { heartbeat: number }
  environment: EnvironmentConfig
  content: ContentConfig
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
  session: {
    title: 'Rabbit Voxel Lab', fallY: -8, fallBehavior: 'respawn',
    respawn: { keepBlockInventory: true, keepCollectibles: true, keepWorldEdits: true },
  },
  mission: {
    active: 'none',
    definitions: {
      none: { title: 'Modo libre' },
      beacon: { title: 'Activá el faro', requiredCrystals: 3, onComplete: 'victory' },
      collect: { title: 'Recolector del bosque', item: 'apple', required: 8, onComplete: 'victory' },
    },
  },
  player: {
    bodyWidth: 0.62, bodyHeight: 1.8, eyeHeight: 1.62,
    moveSpeed: 5.4, sprintMultiplier: 1.45, acceleration: 34,
    airControl: 0.35, friction: 24, jumpSpeed: 8.4,
    gravity: -25, maxFallSpeed: 36, coyoteTime: 0.1,
    avatar: {
      renderer: 'procedural', turnSpeed: 720, actionFacingTime: 0.22,
      procedural: {
        height: 1.72, bodyWidth: 0.5, headScale: 1,
        colors: {
          skin: '#d6a06c', hair: '#5a3825', shirt: '#3f8f86',
          pants: '#34495e', boots: '#4a3428',
        },
        animation: {
          idleBob: 0.025, walkFrequency: 7, runFrequency: 10,
          walkSwing: 28, runSwing: 42,
        },
      },
      gltf: {
        assetKey: 'quaterniusHero', scale: 0.68, yOffset: 0,
        rotationY: 180, blendTime: 0.12,
      },
      shadow: { enabled: true, opacity: 0.24, radius: 0.42, maxDistance: 3 },
    },
  },
  camera: {
    initialMode: 'first-person',
    switching: { enabled: true, showButton: true },
    clipping: { near: 0.05, far: 90 },
    look: { mouseSensitivity: 0.09, touchSensitivity: 0.18, padLookSpeed: 145 },
    modes: {
      firstPerson: { fov: 72, pitchRange: [-88, 88] },
      thirdPerson: {
        fov: 68, pitchRange: [-62, 54], distance: 4.8, height: 2.55,
        aimDistance: 12, minDistance: 0.75, collisionRadius: 0.22,
        collisionPadding: 0.18, returnSpeed: 10,
      },
    },
  },
  controls: { gamepadDeadZone: 0.17, fallbackDragThreshold: 7, touchSize: 126 },
  world: {
    seed: 1337,
    min: [-32, 0, -32], size: [64, 32, 64], spawn: [0.5, 15, 0.5],
    plateauCenter: [0, 13, 0], beaconBase: [4, 13, -3],
    beaconSockets: [[4, 14, -3], [5, 14, -3], [6, 14, -3]],
    crystalNodes: [[-9, 11, -6], [10, 9, -8], [3, 10, 13]],
    startingInventory: {
      grass: 0, dirt: 12, stone: 8, planks: 8, wood: 0, crystal: 0,
      bedrock: 0, leaves: 0, water: 0, air: 0,
    },
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
      particles: { enabled: true, count: 18, color: '#e8e58c' },
    },
    ambience: { enabled: true, volume: 0.018, waterInterval: [5, 9], windInterval: [8, 14] },
  },
  content: {
    preset: 'forest',
    interaction: { breakableDecorations: true, removeUnsupportedDecorations: true },
    presets: {
      forest: {
        trees: {
          oak: { enabled: true, count: 9, minSpacing: 4.5, height: [4, 6], zones: ['forest'] },
          pine: { enabled: true, count: 6, minSpacing: 4.5, height: [6, 9], zones: ['forest', 'highland'] },
          deadTree: { enabled: true, count: 2, minSpacing: 5, height: [4, 7], zones: ['highland', 'coast'] },
        },
        scatter: {
          bushes: { enabled: true, count: 12, color: '#4f8f45', scale: [0.7, 1.2], zones: ['forest'] },
          flowers: { enabled: true, count: 20, color: '#f2b6cb', scale: [0.75, 1.15], zones: ['spawn-meadow', 'forest'] },
          reeds: { enabled: true, count: 18, color: '#6d9d4d', scale: [0.8, 1.25], zones: ['shore'] },
          rocks: { enabled: true, count: 8, color: '#7b8580', scale: [0.75, 1.3], zones: ['shore', 'highland'] },
          fallenLogs: { enabled: true, count: 4, color: '#745133', scale: [0.85, 1.2], zones: ['forest'] },
          signposts: { enabled: true, count: 3, color: '#b77a43', scale: [0.9, 1.1], zones: ['spawn-meadow', 'forest'] },
        },
        landmarks: [
          { id: 'forest-camp', archetype: 'campfire', center: [-8, -11], label: 'Campamento del Claro' },
          { id: 'old-ruin', archetype: 'stone-ruin', center: [18, 11], label: 'Ruinas Antiguas' },
          { id: 'rocky-overlook', archetype: 'rocky-overlook', center: [17, -16], label: 'Mirador Rocoso' },
        ],
        collectibles: {
          apple: { enabled: true, count: 12, pickupRadius: 1.1, color: '#d94c43', scale: [0.85, 1.1], zones: ['forest'] },
          mushroom: { enabled: true, count: 8, pickupRadius: 1.1, color: '#e48359', scale: [0.8, 1.2], zones: ['forest'] },
        },
        discoveries: { enabled: true, radius: 4.5, toastSeconds: 2.5 },
      },
      minimal: {
        trees: {
          oak: { enabled: true, count: 2, minSpacing: 6, height: [4, 5], zones: ['forest'] },
          pine: { enabled: true, count: 1, minSpacing: 6, height: [6, 7], zones: ['highland'] },
          deadTree: { enabled: false, count: 0, minSpacing: 6, height: [4, 5], zones: ['coast'] },
        },
        scatter: {
          bushes: { enabled: false, count: 0, color: '#4f8f45', scale: [0.7, 1.2], zones: ['forest'] },
          flowers: { enabled: true, count: 6, color: '#f2b6cb', scale: [0.75, 1.15], zones: ['spawn-meadow'] },
          reeds: { enabled: false, count: 0, color: '#6d9d4d', scale: [0.8, 1.25], zones: ['shore'] },
          rocks: { enabled: true, count: 4, color: '#7b8580', scale: [0.75, 1.3], zones: ['highland'] },
          fallenLogs: { enabled: false, count: 0, color: '#745133', scale: [0.85, 1.2], zones: ['forest'] },
          signposts: { enabled: false, count: 0, color: '#b77a43', scale: [0.9, 1.1], zones: ['spawn-meadow'] },
        },
        landmarks: [],
        collectibles: {
          apple: { enabled: false, count: 0, pickupRadius: 1.1, color: '#d94c43', scale: [0.85, 1.1], zones: ['forest'] },
          mushroom: { enabled: false, count: 0, pickupRadius: 1.1, color: '#e48359', scale: [0.8, 1.2], zones: ['forest'] },
        },
        discoveries: { enabled: false, radius: 4.5, toastSeconds: 2.5 },
      },
    },
    limits: {
      maxTrees: 24, maxScatterInstances: 96, maxCollectibles: 32,
      maxLandmarks: 8, maxExtraDrawCalls: 6,
    },
  },
  visual: {
    topTint: 1, sideTint: 0.88, darkSideTint: 0.8, bottomTint: 0.65,
    selection: '#fff2a8', socket: '#8ff5ff',
  },
  audio: { sfxVolume: 0.72, musicVolume: 0 },
  performance: { maxChunkRebuildsPerFrame: 2, fragmentPoolSize: 32, maxCatchupSteps: 5 },
} as const satisfies GameConfig
