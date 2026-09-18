import * as pc from 'playcanvas'
import type { EnvironmentFeature, EnvironmentFeatureStats, FeatureContext } from './environment'
import { rgb } from './environment-geometry'

function particleStats(count: number): EnvironmentFeatureStats {
  return { drawCalls: 1, clouds: 0, particles: count }
}

function createParticleTexture(device: pc.GraphicsDevice): pc.Texture {
  const texture = new pc.Texture(device, {
    width: 4, height: 4, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false,
  })
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
    setTimeOfDay() {},
    stats: () => particleStats(spec.count),
    destroy() { root.destroy(); texture.destroy() },
  }
}
