import * as pc from 'playcanvas'
import { DESTROY_STAGES, type MiningSnapshot } from '../sim/mining'
import { seededRandom } from './environment-geometry'

const SIZE = 16

/**
 * Crack pixels in growth order: a few random walks from the block centre,
 * interleaved so every branch grows a little on each destroy stage.
 */
function crackOrder(): number[] {
  const random = seededRandom(9127)
  const walkers = Array.from({ length: 7 }, (_, index) => {
    const angle = index / 7 * Math.PI * 2 + random() * 0.6
    return { x: 7.5, y: 7.5, dx: Math.cos(angle), dy: Math.sin(angle), delay: index < 4 ? 0 : 3 + index }
  })
  const order: number[] = []
  const seen = new Set<number>()
  for (let step = 0; step < 14; step += 1) {
    for (const walker of walkers) {
      if (step < walker.delay) continue
      walker.x = Math.max(0, Math.min(SIZE - 1, walker.x + walker.dx + (random() - 0.5) * 0.9))
      walker.y = Math.max(0, Math.min(SIZE - 1, walker.y + walker.dy + (random() - 0.5) * 0.9))
      const pixel = Math.floor(walker.y) * SIZE + Math.floor(walker.x)
      if (!seen.has(pixel)) { seen.add(pixel); order.push(pixel) }
    }
  }
  return order
}

function stageTextures(device: pc.GraphicsDevice): pc.Texture[] {
  const order = crackOrder()
  return Array.from({ length: DESTROY_STAGES }, (_, stage) => {
    const texture = new pc.Texture(device, {
      name: `Destroy Stage ${stage}`, width: SIZE, height: SIZE, format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false, minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    })
    const pixels = texture.lock() as Uint8Array
    pixels.fill(0)
    const visible = Math.ceil(order.length * (stage + 1) / DESTROY_STAGES)
    order.slice(0, visible).forEach((pixel, index) => {
      // Newest pixels are fainter, so cracks look like they are still opening.
      pixels[pixel * 4 + 3] = index > visible - 4 ? 120 : 210
    })
    texture.unlock()
    return texture
  })
}

export interface BlockCracksHandle {
  set(mining: MiningSnapshot | null): void
  destroy(): void
}

/** Minecraft destroy-stage overlay drawn over the block being mined. */
export function createBlockCracks(parent: pc.Entity, device: pc.GraphicsDevice): BlockCracksHandle {
  const textures = stageTextures(device)
  const material = new pc.StandardMaterial()
  material.useLighting = false
  material.diffuse.set(0, 0, 0)
  material.emissive.set(0.05, 0.04, 0.03)
  material.opacityMap = textures[0]
  material.opacityMapChannel = 'a'
  material.blendType = pc.BLEND_NORMAL
  material.depthWrite = false
  material.update()
  const entity = new pc.Entity('Block Cracks')
  entity.addComponent('render', { type: 'box', castShadows: false, receiveShadows: false })
  entity.render!.material = material
  entity.setLocalScale(1.004, 1.004, 1.004)
  entity.enabled = false
  parent.addChild(entity)
  let stage = 0

  return {
    set(mining) {
      entity.enabled = mining !== null
      if (!mining) return
      entity.setLocalPosition(mining.voxel.x + 0.5, mining.voxel.y + 0.5, mining.voxel.z + 0.5)
      if (mining.stage === stage) return
      stage = mining.stage
      material.opacityMap = textures[stage]; material.update()
    },
    destroy() {
      entity.destroy(); material.destroy()
      for (const texture of textures) texture.destroy()
    },
  }
}
