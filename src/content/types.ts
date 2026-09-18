import type {
  CollectibleKey, LandmarkArchetype, TreeArchetypeKey, WorldZone,
} from './config'

export interface SurfacePoint {
  x: number
  y: number
  z: number
  zone: WorldZone
}

export interface TreePlacement extends SurfacePoint {
  id: string
  archetype: TreeArchetypeKey
  height: number
  variant: number
}

export type VoxelPropArchetype = 'fallen-log' | 'stone-ruin' | 'rocky-overlook'

export interface VoxelPropPlacement extends SurfacePoint {
  id: string
  archetype: VoxelPropArchetype
  rotation: number
  scale: number
}

export type MeshArchetype = 'bush' | 'flower' | 'reed' | 'rock' | 'signpost' | 'campfire'

export interface MeshPlacement extends SurfacePoint {
  id: string
  archetype: MeshArchetype
  rotation: number
  scale: number
  color: string
}

export interface DecorationHit {
  index: number
  distance: number
}

export interface CollectiblePlacement {
  id: string
  key: CollectibleKey
  x: number
  y: number
  z: number
  scale: number
  color: string
  pickupRadius: number
}

export interface DiscoveryPlacement {
  id: string
  label: string
  x: number
  z: number
  radius: number
  toastSeconds: number
  archetype: LandmarkArchetype | 'lake'
}

export interface WorldContentPlan {
  seed: number
  preset: string
  trees: readonly TreePlacement[]
  voxelProps: readonly VoxelPropPlacement[]
  meshes: readonly MeshPlacement[]
  collectibles: readonly CollectiblePlacement[]
  discoveries: readonly DiscoveryPlacement[]
}
