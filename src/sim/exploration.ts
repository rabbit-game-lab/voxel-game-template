import type { CollectibleKey } from '../content/config'
import type {
  CollectiblePlacement, DiscoveryPlacement, WorldContentPlan,
} from '../content/types'
import type { VoxelCoord } from '../voxel/coords'

export class CollectibleStore {
  private placements: readonly CollectiblePlacement[] = []
  private active = new Uint8Array(0)
  private readonly totals: Record<CollectibleKey, number> = { apple: 0, mushroom: 0 }

  reset(plan: WorldContentPlan): void {
    this.placements = plan.collectibles
    this.active = new Uint8Array(this.placements.length)
    this.active.fill(1)
    this.totals.apple = 0; this.totals.mushroom = 0
  }

  rebind(plan: WorldContentPlan): void {
    if (plan.collectibles.length !== this.placements.length) {
      this.reset(plan)
      return
    }
    this.placements = plan.collectibles
  }

  nextNearby(position: VoxelCoord): number {
    for (let index = 0; index < this.placements.length; index += 1) {
      if (this.active[index] === 0) continue
      const item = this.placements[index]
      const dx = item.x - position.x
      const dy = item.y - (position.y + 0.7)
      const dz = item.z - position.z
      if (dx * dx + dy * dy + dz * dz > item.pickupRadius * item.pickupRadius) continue
      this.active[index] = 0
      this.totals[item.key] += 1
      return index
    }
    return -1
  }

  placement(index: number): CollectiblePlacement {
    return this.placements[index]
  }

  count(key: CollectibleKey): number {
    return this.totals[key]
  }

  activeSnapshot(): boolean[] {
    return Array.from(this.active, (value) => value === 1)
  }
}

export class DiscoveryStore {
  private placements: readonly DiscoveryPlacement[] = []
  private discovered = new Uint8Array(0)

  reset(plan: WorldContentPlan): void {
    this.placements = plan.discoveries
    this.discovered = new Uint8Array(this.placements.length)
  }

  rebind(plan: WorldContentPlan): void {
    if (plan.discoveries.length !== this.placements.length) {
      this.reset(plan)
      return
    }
    this.placements = plan.discoveries
  }

  nextNearby(position: VoxelCoord): DiscoveryPlacement | null {
    for (let index = 0; index < this.placements.length; index += 1) {
      if (this.discovered[index] === 1) continue
      const item = this.placements[index]
      const dx = item.x - position.x; const dz = item.z - position.z
      if (dx * dx + dz * dz > item.radius * item.radius) continue
      this.discovered[index] = 1
      return item
    }
    return null
  }
}
