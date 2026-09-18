import type {
  CollectibleContentConfig, CollectibleKey, ContentPresetConfig, ScatterContentConfig,
  TreeArchetypeKey, TreeContentConfig, WorldZone,
} from './config'
import type { GameConfig } from '../game.config'
import { lakeSignedDistance } from '../environment/lakes'
import type { VoxelWorld } from '../voxel/world'
import type {
  CollectiblePlacement, DiscoveryPlacement, MeshArchetype, MeshPlacement,
  SurfacePoint, TreePlacement, VoxelPropPlacement, WorldContentPlan,
} from './types'

function randomFactory(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

function pointKey(x: number, z: number): string {
  return `${x},${z}`
}

function zoneAt(x: number, z: number, config: GameConfig): WorldZone {
  const spawnDistance = Math.hypot(x - config.world.spawn[0], z - config.world.spawn[2])
  if (spawnDistance <= 8) return 'spawn-meadow'
  for (const lake of config.environment.water.lakes) {
    if (lakeSignedDistance(lake, x, z, config.world.seed) <= lake.shoreWidth + 1.5) return 'shore'
  }
  const centerX = config.world.min[0] + config.world.size[0] * 0.5
  const centerZ = config.world.min[2] + config.world.size[2] * 0.5
  const radial = Math.hypot(
    (x - centerX) / (config.world.size[0] * 0.5),
    (z - centerZ) / (config.world.size[2] * 0.5),
  )
  if (radial > 0.76) return 'coast'
  if (x > 8 && z < -3) return 'highland'
  return 'forest'
}

function surfaceCells(world: VoxelWorld, config: GameConfig): SurfacePoint[] {
  const result: SurfacePoint[] = []
  const { min, maxExclusive } = world.bounds
  for (let z = min.z + 2; z < maxExclusive.z - 2; z += 1) {
    for (let x = min.x + 2; x < maxExclusive.x - 2; x += 1) {
      const ground = world.highestSolidY(x, z)
      if (ground === null || ground + 10 >= maxExclusive.y) continue
      result.push({ x, y: ground + 1, z, zone: zoneAt(x, z, config) })
    }
  }
  return result
}

function reachableKeys(cells: readonly SurfacePoint[], config: GameConfig): Set<string> {
  const byKey = new Map(cells.map((cell) => [pointKey(cell.x, cell.z), cell]))
  let start = byKey.get(pointKey(Math.floor(config.world.spawn[0]), Math.floor(config.world.spawn[2])))
  if (!start) start = cells.reduce<SurfacePoint | undefined>((best, cell) =>
    !best || Math.hypot(cell.x, cell.z) < Math.hypot(best.x, best.z) ? cell : best, undefined)
  const visited = new Set<string>()
  if (!start) return visited
  const queue: SurfacePoint[] = [start]
  visited.add(pointKey(start.x, start.z))
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const key = pointKey(current.x + dx, current.z + dz)
      const next = byKey.get(key)
      if (!next || visited.has(key) || Math.abs(next.y - current.y) > 1) continue
      visited.add(key); queue.push(next)
    }
  }
  return visited
}

function nearProtected(cell: SurfacePoint, protectedPoints: readonly [number, number, number][]): boolean {
  return protectedPoints.some(([x, z, radius]) => Math.hypot(cell.x - x, cell.z - z) < radius)
}

function takeCells(
  candidates: readonly SurfacePoint[], count: number, zones: readonly WorldZone[],
  used: Set<string>, protectedPoints: readonly [number, number, number][], random: () => number,
): SurfacePoint[] {
  const result: SurfacePoint[] = []
  for (const cell of shuffled(candidates, random)) {
    const key = pointKey(cell.x, cell.z)
    if (!zones.includes(cell.zone) || used.has(key) || nearProtected(cell, protectedPoints)) continue
    used.add(key); result.push(cell)
    if (result.length === count) break
  }
  if (result.length !== count) throw new Error(`Content planner placed ${result.length}/${count} requested instances`)
  return result
}

function scalar(range: readonly [number, number], random: () => number): number {
  return range[0] + (range[1] - range[0]) * random()
}

function planTrees(
  candidates: readonly SurfacePoint[], preset: ContentPresetConfig,
  protectedPoints: readonly [number, number, number][], random: () => number,
): TreePlacement[] {
  const result: TreePlacement[] = []
  const specs: readonly [TreeArchetypeKey, TreeContentConfig][] = [
    ['oak', preset.trees.oak], ['pine', preset.trees.pine], ['dead-tree', preset.trees.deadTree],
  ]
  for (const [archetype, spec] of specs) {
    if (!spec.enabled || spec.count === 0) continue
    for (const cell of shuffled(candidates, random)) {
      if (!spec.zones.includes(cell.zone) || nearProtected(cell, protectedPoints)) continue
      if (result.some((tree) => Math.hypot(tree.x - cell.x, tree.z - cell.z) < spec.minSpacing)) continue
      result.push({
        ...cell, id: `${archetype}-${result.length}`, archetype,
        height: Math.round(scalar(spec.height, random)), variant: Math.floor(random() * 4),
      })
      if (result.filter((tree) => tree.archetype === archetype).length === spec.count) break
    }
    if (result.filter((tree) => tree.archetype === archetype).length !== spec.count) {
      throw new Error(`Content planner could not place every ${archetype} tree`)
    }
  }
  return result
}

function planScatter(
  name: string, archetype: MeshArchetype, spec: ScatterContentConfig,
  candidates: readonly SurfacePoint[], used: Set<string>,
  protectedPoints: readonly [number, number, number][], random: () => number,
): MeshPlacement[] {
  if (!spec.enabled || spec.count === 0) return []
  return takeCells(candidates, spec.count, spec.zones, used, protectedPoints, random).map((cell, index) => ({
    ...cell, id: `${name}-${index}`, archetype, rotation: Math.floor(random() * 4),
    scale: scalar(spec.scale, random), color: spec.color,
  }))
}

function collectiblePlacements(
  key: CollectibleKey, spec: CollectibleContentConfig, count: number,
  candidates: readonly SurfacePoint[], used: Set<string>, random: () => number,
): CollectiblePlacement[] {
  if (count === 0) return []
  return takeCells(candidates, count, spec.zones, used, [], random).map((cell, index) => ({
    id: `${key}-${index}`, key, x: cell.x + 0.5, y: cell.y + 0.24, z: cell.z + 0.5,
    scale: scalar(spec.scale, random), color: spec.color, pickupRadius: spec.pickupRadius,
  }))
}

function planSignposts(
  preset: ContentPresetConfig, candidates: readonly SurfacePoint[],
  discoveries: readonly DiscoveryPlacement[], used: Set<string>, random: () => number,
): MeshPlacement[] {
  const spec = preset.scatter.signposts
  if (!spec.enabled || spec.count === 0) return []
  const targets = discoveries.filter((item) => item.archetype !== 'lake')
  const result: MeshPlacement[] = []
  for (let index = 0; index < spec.count; index += 1) {
    const target = targets[index % Math.max(1, targets.length)]
    const desiredX = target ? target.x * 0.45 : index * 3 - 3
    const desiredZ = target ? target.z * 0.45 : -7
    const cell = candidates.reduce<SurfacePoint | null>((best, candidate) => {
      if (!spec.zones.includes(candidate.zone) || used.has(pointKey(candidate.x, candidate.z))) return best
      if (!best) return candidate
      return Math.hypot(candidate.x - desiredX, candidate.z - desiredZ) <
        Math.hypot(best.x - desiredX, best.z - desiredZ) ? candidate : best
    }, null)
    if (!cell) throw new Error('Content planner could not place every signpost')
    used.add(pointKey(cell.x, cell.z))
    const angle = target ? Math.atan2(target.z - cell.z, target.x - cell.x) : 0
    result.push({
      ...cell, id: `signpost-${index}`, archetype: 'signpost',
      rotation: Math.round(angle / (Math.PI * 0.5)), scale: scalar(spec.scale, random), color: spec.color,
    })
  }
  return result
}

export function planWorldContent(world: VoxelWorld, config: GameConfig): WorldContentPlan {
  const preset = config.content.presets[config.content.preset]
  const random = randomFactory(config.world.seed + 17041)
  const cells = surfaceCells(world, config)
  const reachable = reachableKeys(cells, config)
  const reachableCells = cells.filter((cell) => reachable.has(pointKey(cell.x, cell.z)))
  const protectedPoints: [number, number, number][] = [
    [config.world.spawn[0], config.world.spawn[2], 7],
    ...config.environment.water.lakes.map((lake) => [lake.center[0], lake.center[2], Math.max(...lake.radius) + 1] as [number, number, number]),
  ]
  if (config.mission.active === 'beacon') {
    protectedPoints.push(
      [config.world.beaconBase[0], config.world.beaconBase[2], 4],
      ...config.world.crystalNodes.map((node) => [node[0], node[2], 3] as [number, number, number]),
    )
  }

  const voxelProps: VoxelPropPlacement[] = []
  const meshes: MeshPlacement[] = []
  const discoveries: DiscoveryPlacement[] = []
  for (const landmark of preset.landmarks) {
    const requested = reachableCells.reduce((best, cell) => {
      const distance = Math.hypot(cell.x - landmark.center[0], cell.z - landmark.center[1])
      return distance < best.distance ? { cell, distance } : best
    }, { cell: reachableCells[0], distance: Number.POSITIVE_INFINITY }).cell
    if (!requested) throw new Error(`Landmark ${landmark.id} has no reachable placement`)
    protectedPoints.push([requested.x, requested.z, 4])
    if (landmark.archetype === 'campfire') {
      meshes.push({ ...requested, id: landmark.id, archetype: 'campfire', rotation: 0, scale: 1, color: '#f3a33c' })
    } else {
      voxelProps.push({ ...requested, id: landmark.id, archetype: landmark.archetype, rotation: 0, scale: 1 })
    }
    if (preset.discoveries.enabled) discoveries.push({
      id: landmark.id, label: landmark.label, x: requested.x, z: requested.z,
      radius: preset.discoveries.radius, toastSeconds: preset.discoveries.toastSeconds,
      archetype: landmark.archetype,
    })
  }
  if (preset.discoveries.enabled && config.environment.water.enabled) {
    for (const lake of config.environment.water.lakes) discoveries.push({
      id: lake.id, label: 'Lago del Bosque', x: lake.center[0], z: lake.center[2],
      radius: preset.discoveries.radius + Math.min(...lake.radius),
      toastSeconds: preset.discoveries.toastSeconds, archetype: 'lake',
    })
  }

  const trees = planTrees(cells, preset, protectedPoints, random)
  const used = new Set(trees.map((tree) => pointKey(tree.x, tree.z)))
  meshes.push(...planScatter('bush', 'bush', preset.scatter.bushes, cells, used, protectedPoints, random))
  meshes.push(...planScatter('flower', 'flower', preset.scatter.flowers, cells, used, protectedPoints, random))
  meshes.push(...planScatter('reed', 'reed', preset.scatter.reeds, cells, used, [], random))
  meshes.push(...planScatter('rock', 'rock', preset.scatter.rocks, cells, used, protectedPoints, random))
  meshes.push(...planSignposts(preset, reachableCells, discoveries, used, random))
  if (preset.scatter.fallenLogs.enabled) {
    const logs = takeCells(cells, preset.scatter.fallenLogs.count, preset.scatter.fallenLogs.zones, used, protectedPoints, random)
    logs.forEach((cell, index) => voxelProps.push({
      ...cell, id: `fallen-log-${index}`, archetype: 'fallen-log',
      rotation: Math.floor(random() * 4), scale: scalar(preset.scatter.fallenLogs.scale, random),
    }))
  }

  const collectibleUsed = new Set<string>()
  const collectibles: CollectiblePlacement[] = []
  for (const key of ['apple', 'mushroom'] as const) {
    const spec = preset.collectibles[key]
    let count = spec.enabled ? spec.count : 0
    if (config.mission.active === 'collect' && config.mission.definitions.collect.item === key) {
      count = Math.max(count, config.mission.definitions.collect.required)
    }
    const oakTrees = trees.filter((tree) => tree.archetype === 'oak')
    const itemCandidates = key === 'apple' && oakTrees.length > 0
      ? reachableCells.filter((cell) => oakTrees.some((tree) => {
        const distance = Math.hypot(cell.x - tree.x, cell.z - tree.z)
        return distance >= 1.4 && distance <= 3.4
      }))
      : reachableCells
    collectibles.push(...collectiblePlacements(key, spec, count, itemCandidates, collectibleUsed, random))
  }
  return {
    seed: config.world.seed, preset: config.content.preset,
    trees, voxelProps, meshes, collectibles, discoveries,
  }
}
