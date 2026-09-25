import * as pc from 'playcanvas'
import { makeMat, prim } from './helpers'
import type { BlockKey } from '../data/blocks'
import type { GameConfig } from '../game.config'
import type { VoxelCoord } from '../voxel/coords'

interface Fragment {
  entity: pc.Entity
  velocity: pc.Vec3
  life: number
}

export interface EffectsHandle {
  burst(voxel: VoxelCoord, crystal: boolean): void
  /** Small debris knocked off the hit face on every mining swing. */
  chip(voxel: VoxelCoord, face: VoxelCoord, block: BlockKey): void
  update(dt: number): void
  reset(): void
  destroy(): void
}

export function createEffects(app: pc.Application, config: GameConfig): EffectsHandle {
  const root = new pc.Entity('Voxel Effects')
  app.root.addChild(root)
  const earth = makeMat('#bd8b55', { emissive: '#6b3f2a', emissiveIntensity: 0.22 })
  const crystal = makeMat('#78f1ff', { emissive: '#78f1ff', emissiveIntensity: 2.4 })
  const stone = makeMat('#8a8a88', { emissive: '#3f3f3e', emissiveIntensity: 0.22 })
  const wood = makeMat('#9c7446', { emissive: '#4a3219', emissiveIntensity: 0.22 })
  const leaves = makeMat('#4f8a34', { emissive: '#23461a', emissiveIntensity: 0.22 })
  const chipMaterial = (block: BlockKey): pc.Material => block === 'crystal' ? crystal
    : block === 'stone' || block === 'bedrock' ? stone
      : block === 'wood' || block === 'planks' ? wood : block === 'leaves' ? leaves : earth
  const pool: Fragment[] = []
  for (let index = 0; index < config.performance.fragmentPoolSize; index += 1) {
    const entity = prim(`Fragment ${index}`, 'box', {
      parent: root, material: earth, scale: [0.12, 0.12, 0.12], enabled: false,
    })
    pool.push({ entity, velocity: new pc.Vec3(), life: 0 })
  }
  let cursor = 0

  function reset(): void {
    for (const fragment of pool) {
      fragment.life = 0
      fragment.entity.enabled = false
    }
  }

  return {
    burst(voxel, isCrystal) {
      for (let index = 0; index < 8; index += 1) {
        const fragment = pool[cursor]
        cursor = (cursor + 1) % pool.length
        fragment.entity.enabled = true
        fragment.entity.render!.material = isCrystal ? crystal : earth
        fragment.entity.setLocalScale(0.12, 0.12, 0.12)
        fragment.entity.setPosition(voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5)
        const angle = (index / 8) * Math.PI * 2
        fragment.velocity.set(Math.cos(angle) * 2.2, 2.4 + (index % 3) * 0.35, Math.sin(angle) * 2.2)
        fragment.life = 0.55
      }
    },
    chip(voxel, face, block) {
      const x = (voxel.x + face.x) * 0.5 + 0.5; const y = (voxel.y + face.y) * 0.5 + 0.5
      const z = (voxel.z + face.z) * 0.5 + 0.5
      for (let index = 0; index < 3; index += 1) {
        const fragment = pool[cursor]
        cursor = (cursor + 1) % pool.length
        const angle = Math.random() * Math.PI * 2
        fragment.entity.enabled = true
        fragment.entity.render!.material = chipMaterial(block)
        fragment.entity.setPosition(x + Math.cos(angle) * 0.2, y + Math.sin(angle) * 0.2, z)
        fragment.entity.setLocalScale(0.07, 0.07, 0.07)
        fragment.velocity.set(
          (face.x - voxel.x) * 1.2 + Math.cos(angle) * 0.8, 1.6 + Math.random() * 0.6,
          (face.z - voxel.z) * 1.2 + Math.sin(angle) * 0.8,
        )
        fragment.life = 0.35
      }
    },
    update(dt) {
      for (const fragment of pool) {
        if (fragment.life <= 0) continue
        fragment.life -= dt
        fragment.velocity.y -= 9 * dt
        fragment.entity.translate(
          fragment.velocity.x * dt, fragment.velocity.y * dt, fragment.velocity.z * dt,
        )
        fragment.entity.rotate(190 * dt, 260 * dt, 120 * dt)
        if (fragment.life <= 0) fragment.entity.enabled = false
      }
    },
    reset,
    destroy() {
      root.destroy(); pool.length = 0
      for (const material of [earth, crystal, stone, wood, leaves]) material.destroy()
    },
  }
}
