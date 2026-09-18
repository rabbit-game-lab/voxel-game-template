export type ContentVec2 = readonly [number, number]
export type ContentPresetKey = 'forest' | 'minimal'
export type TreeArchetypeKey = 'oak' | 'pine' | 'dead-tree'
export type CollectibleKey = 'apple' | 'mushroom'
export type WorldZone = 'spawn-meadow' | 'forest' | 'shore' | 'highland' | 'coast'
export type LandmarkArchetype = 'campfire' | 'stone-ruin' | 'rocky-overlook'

export interface TreeContentConfig {
  enabled: boolean
  count: number
  minSpacing: number
  height: ContentVec2
  zones: readonly WorldZone[]
}

export interface ScatterContentConfig {
  enabled: boolean
  count: number
  color: string
  scale: ContentVec2
  zones: readonly WorldZone[]
}

export interface LandmarkContentConfig {
  id: string
  archetype: LandmarkArchetype
  center: ContentVec2
  label: string
}

export interface CollectibleContentConfig {
  enabled: boolean
  count: number
  pickupRadius: number
  color: string
  scale: ContentVec2
  zones: readonly WorldZone[]
}

export interface ContentPresetConfig {
  trees: {
    oak: TreeContentConfig
    pine: TreeContentConfig
    deadTree: TreeContentConfig
  }
  scatter: {
    bushes: ScatterContentConfig
    flowers: ScatterContentConfig
    reeds: ScatterContentConfig
    rocks: ScatterContentConfig
    fallenLogs: ScatterContentConfig
    signposts: ScatterContentConfig
  }
  landmarks: readonly LandmarkContentConfig[]
  collectibles: Readonly<Record<CollectibleKey, CollectibleContentConfig>>
  discoveries: { enabled: boolean; radius: number; toastSeconds: number }
}

export interface ContentConfig {
  preset: ContentPresetKey
  interaction: {
    breakableDecorations: boolean
    removeUnsupportedDecorations: boolean
  }
  presets: Readonly<Record<ContentPresetKey, ContentPresetConfig>>
  limits: {
    maxTrees: number
    maxScatterInstances: number
    maxCollectibles: number
    maxLandmarks: number
    maxExtraDrawCalls: number
  }
}
