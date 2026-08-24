import * as pc from 'playcanvas'
import { makeMat, prim } from './helpers'
import type { GameConfig } from '../game.config'
import type { VoxelCoord } from '../voxel/coords'

interface Fragment {
  entity: pc.Entity
  velocity: pc.Vec3
  life: number
}

export interface EffectsHandle {
  burst(voxel: VoxelCoord, crystal: boolean): void
  update(dt: number): void
  reset(): void
  destroy(): void
}

export function createEffects(app: pc.Application, config: GameConfig): EffectsHandle {
  const root = new pc.Entity('Voxel Effects')
  app.root.addChild(root)
  const earth = makeMat('#bd8b55', { emissive: '#6b3f2a', emissiveIntensity: 0.22 })
  const crystal = makeMat('#78f1ff', { emissive: '#78f1ff', emissiveIntensity: 2.4 })
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
        fragment.entity.setPosition(voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5)
        const angle = (index / 8) * Math.PI * 2
        fragment.velocity.set(Math.cos(angle) * 2.2, 2.4 + (index % 3) * 0.35, Math.sin(angle) * 2.2)
        fragment.life = 0.55
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
      root.destroy(); earth.destroy(); crystal.destroy(); pool.length = 0
    },
  }
}
