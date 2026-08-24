import * as pc from 'playcanvas'
import type { LakeConfig } from '../environment/config'
import { lakeSignedDistance } from '../environment/lakes'
import type { GameConfig } from '../game.config'
import type { EnvironmentFeature, EnvironmentFeatureStats, FeatureContext } from './environment'
import { addBox, builder, createMesh, renderMesh, rgb, seededRandom, vertexMaterial } from './environment-geometry'

interface ShoreCell { x: number; z: number; lake: LakeConfig }

function stats(
  drawCalls: number,
  counts: Partial<Omit<EnvironmentFeatureStats, 'drawCalls'>> = {},
): EnvironmentFeatureStats {
  return { drawCalls, clouds: 0, reeds: 0, rocks: 0, particles: 0, ...counts }
}

function shoreCells(config: GameConfig, min: number, max: number): ShoreCell[] {
  const result: ShoreCell[] = []
  for (const lake of config.environment.water.lakes) {
    const rx = Math.ceil(lake.radius[0] + lake.shoreWidth)
    const rz = Math.ceil(lake.radius[1] + lake.shoreWidth)
    for (let z = lake.center[2] - rz; z <= lake.center[2] + rz; z += 1) {
      for (let x = lake.center[0] - rx; x <= lake.center[0] + rx; x += 1) {
        const distance = lakeSignedDistance(lake, x, z, config.world.seed)
        if (distance >= min && distance <= max) result.push({ x, z, lake })
      }
    }
  }
  return result
}

function selectCells(cells: ShoreCell[], count: number, random: () => number): ShoreCell[] {
  const copy = [...cells]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1)); [copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

export function createDecorationFeature(context: FeatureContext): EnvironmentFeature | null {
  const specs = context.config.environment.decorations
  if (!context.config.environment.water.enabled || context.config.environment.water.lakes.length === 0) return null
  const root = new pc.Entity('Shore Decorations')
  context.root.addChild(root)
  const random = seededRandom(context.config.world.seed + 4103)
  const resources: { mesh: pc.Mesh; material: pc.Material }[] = []
  let drawCalls = 0
  let reedCount = 0
  let rockCount = 0
  if (specs.reeds.enabled && specs.reeds.count > 0) {
    const data = builder()
    const cells = selectCells(shoreCells(context.config, -1.2, 0.35), specs.reeds.count, random)
    reedCount = cells.length
    for (const cell of cells) {
      const height = 0.72 + random() * 0.62
      const y = cell.lake.center[1] + height * 0.5
      addBox(data, [cell.x + 0.35, y, cell.z + 0.48], [0.11, height, 0.11], rgb(specs.reeds.color))
      addBox(data, [cell.x + 0.64, y - 0.08, cell.z + 0.58], [0.1, height * 0.82, 0.1], rgb(specs.reeds.color))
    }
    if (data.positions.length > 0) {
      const mesh = createMesh(context.app.graphicsDevice, data)
      const material = vertexMaterial(false)
      renderMesh('Merged Reeds', root, mesh, material)
      resources.push({ mesh, material }); drawCalls += 1
    }
  }
  if (specs.rocks.enabled && specs.rocks.count > 0) {
    const data = builder()
    for (const cell of selectCells(shoreCells(context.config, 0.35, 2.2), specs.rocks.count, random)) {
      const ground = context.world.highestSolidY(cell.x, cell.z)
      if (ground === null) continue
      rockCount += 1
      const size = 0.28 + random() * 0.34
      addBox(data, [cell.x + 0.5, ground + size * 0.34, cell.z + 0.5], [size, size * 0.68, size * 0.82], rgb(specs.rocks.color))
    }
    if (data.positions.length > 0) {
      const mesh = createMesh(context.app.graphicsDevice, data)
      const material = vertexMaterial(false)
      renderMesh('Merged Shore Rocks', root, mesh, material)
      resources.push({ mesh, material }); drawCalls += 1
    }
  }
  if (drawCalls === 0) { root.destroy(); return null }
  return {
    update() {}, reset() {}, setPaused() {},
    stats: () => stats(drawCalls, { reeds: reedCount, rocks: rockCount }),
    destroy() { root.destroy(); resources.forEach(({ mesh, material }) => { mesh.destroy(); material.destroy() }) },
  }
}

function createParticleTexture(device: pc.GraphicsDevice): pc.Texture {
  const texture = new pc.Texture(device, { width: 4, height: 4, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false })
  texture.minFilter = pc.FILTER_NEAREST; texture.magFilter = pc.FILTER_NEAREST
  const pixels = texture.lock() as Uint8Array
  pixels.fill(0)
  for (const index of [5, 6, 9, 10]) pixels.set([255, 255, 255, 255], index * 4)
  texture.unlock()
  return texture
}

export function createParticleFeature(context: FeatureContext): EnvironmentFeature | null {
  const spec = context.config.environment.decorations.particles
  if (!spec.enabled || spec.count === 0) return null
  const root = new pc.Entity('Ambient Pollen')
  context.root.addChild(root)
  const lake = context.config.environment.water.lakes[0]
  root.setLocalPosition(lake?.center[0] ?? 0, (lake?.center[1] ?? 8) + 2.2, lake?.center[2] ?? 0)
  const texture = createParticleTexture(context.app.graphicsDevice)
  const color = rgb(spec.color).map((value) => value / 255)
  root.addComponent('particlesystem', {
    numParticles: spec.count, lifetime: 7, rate: 7 / spec.count, rate2: 9 / spec.count,
    emitterShape: pc.EMITTERSHAPE_BOX, emitterExtents: new pc.Vec3(7, 2.4, 6),
    initialVelocity: 0.12, wrap: true, wrapBounds: new pc.Vec3(14, 5, 12),
    colorMap: texture, colorGraph: new pc.CurveSet(color.map((value) => [0, value, 1, value])),
    alphaGraph: new pc.Curve([0, 0, 0.18, 0.55, 0.78, 0.45, 1, 0]),
    scaleGraph: new pc.Curve([0, 0.045, 0.5, 0.085, 1, 0.035]),
    lighting: false, depthWrite: false, blendType: pc.BLEND_ADDITIVEALPHA,
    loop: true, preWarm: true,
  })
  return {
    update() {},
    reset() { root.particlesystem?.reset(); root.particlesystem?.play() },
    setPaused(paused) { if (paused) root.particlesystem?.pause(); else root.particlesystem?.unpause() },
    stats: () => stats(1, { particles: spec.count }),
    destroy() { root.destroy(); texture.destroy() },
  }
}
