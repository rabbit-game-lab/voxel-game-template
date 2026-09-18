import type { VoxelCoord } from '../voxel/coords'
import type { DecorationHit, MeshPlacement } from './types'

interface Bounds {
  min: VoxelCoord
  max: VoxelCoord
}

const LABELS: Record<MeshPlacement['archetype'], string> = {
  bush: 'Arbusto', flower: 'Flor', reed: 'Junco', rock: 'Piedra',
  signpost: 'Cartel', campfire: 'Fogata',
}

export function decorationLabel(item: MeshPlacement): string {
  return LABELS[item.archetype]
}

export function decorationSupport(item: MeshPlacement): VoxelCoord {
  return { x: item.x, y: item.y - 1, z: item.z }
}

export function decorationsOnSupport(
  placements: readonly MeshPlacement[], active: Uint8Array, support: VoxelCoord,
): number[] {
  const result: number[] = []
  for (let index = 0; index < placements.length; index += 1) {
    if (active[index] !== 1) continue
    const voxel = decorationSupport(placements[index])
    if (voxel.x === support.x && voxel.y === support.y && voxel.z === support.z) result.push(index)
  }
  return result
}

function boundsFor(item: MeshPlacement): Bounds {
  const x = item.x + 0.5; const z = item.z + 0.5; const scale = item.scale
  let halfX = 0.32 * scale; let halfZ = 0.32 * scale; let height = 0.8 * scale
  if (item.archetype === 'bush') {
    halfX = 0.55 * scale; halfZ = 0.5 * scale; height = 0.7 * scale
  } else if (item.archetype === 'flower') {
    halfX = 0.22 * scale; halfZ = 0.22 * scale; height = 0.65 * scale
  } else if (item.archetype === 'reed') {
    halfX = 0.25 * scale; halfZ = 0.25 * scale; height = 0.82 * scale
  } else if (item.archetype === 'rock') {
    halfX = 0.38 * scale; halfZ = 0.44 * scale; height = 0.45 * scale
  } else if (item.archetype === 'signpost') {
    halfX = item.rotation % 2 === 0 ? 0.52 * scale : 0.16
    halfZ = item.rotation % 2 === 0 ? 0.16 : 0.52 * scale
    height = 1.5 * scale
  } else if (item.archetype === 'campfire') {
    halfX = 0.62; halfZ = 0.62; height = 0.82
  }
  return {
    min: { x: x - halfX, y: item.y, z: z - halfZ },
    max: { x: x + halfX, y: item.y + height, z: z + halfZ },
  }
}

function rayBounds(origin: VoxelCoord, direction: VoxelCoord, bounds: Bounds, maxDistance: number): number | null {
  const length = Math.hypot(direction.x, direction.y, direction.z)
  if (length < 0.000001) return null
  const components = [
    [origin.x, direction.x / length, bounds.min.x, bounds.max.x],
    [origin.y, direction.y / length, bounds.min.y, bounds.max.y],
    [origin.z, direction.z / length, bounds.min.z, bounds.max.z],
  ] as const
  let near = 0; let far = maxDistance
  for (const [start, delta, min, max] of components) {
    if (Math.abs(delta) < 0.000001) {
      if (start < min || start > max) return null
      continue
    }
    let first = (min - start) / delta; let second = (max - start) / delta
    if (first > second) [first, second] = [second, first]
    near = Math.max(near, first); far = Math.min(far, second)
    if (near > far) return null
  }
  return near <= maxDistance ? near : null
}

export function raycastDecorations(
  placements: readonly MeshPlacement[], active: Uint8Array,
  origin: VoxelCoord, direction: VoxelCoord, maxDistance: number,
): DecorationHit | null {
  let result: DecorationHit | null = null
  for (let index = 0; index < placements.length; index += 1) {
    if (active[index] !== 1) continue
    const distance = rayBounds(origin, direction, boundsFor(placements[index]), maxDistance)
    if (distance !== null && (!result || distance < result.distance)) result = { index, distance }
  }
  return result
}
