export type EnvironmentVec2 = readonly [number, number]
export type EnvironmentVec3 = readonly [number, number, number]

export interface CloudLayerConfig {
  count: number
  altitude: number
  speed: number
  scale: EnvironmentVec2
}

export interface LakeConfig {
  id: string
  /** x, water-block y, z */
  center: EnvironmentVec3
  radius: EnvironmentVec2
  shoreWidth: number
  edgeNoise: number
}

export interface EnvironmentConfig {
  sky: {
    zenith: string
    horizon: string
    ambient: string
    fogColor: string
    fogStart: number
    fogEnd: number
    sunColor: string
    sunEuler: EnvironmentVec3
  }
  clouds: {
    enabled: boolean
    seedOffset: number
    layers: readonly CloudLayerConfig[]
  }
  water: {
    enabled: boolean
    color: string
    shallowColor: string
    opacity: number
    surfaceInset: number
    wadeSpeedMultiplier: number
    lakes: readonly LakeConfig[]
  }
  decorations: {
    reeds: { enabled: boolean; count: number; color: string }
    rocks: { enabled: boolean; count: number; color: string }
    particles: { enabled: boolean; count: number; color: string }
  }
  ambience: {
    enabled: boolean
    volume: number
    waterInterval: EnvironmentVec2
    windInterval: EnvironmentVec2
  }
}
