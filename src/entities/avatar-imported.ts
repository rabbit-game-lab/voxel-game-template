import type * as pc from 'playcanvas'
import type { GameConfig } from '../game.config'
import type { AssetsHandle } from '../rabbit/assets'
import { spawnCharacter } from '../rabbit/character'
import type { AvatarMotion, AvatarVisual } from './avatar-types'

const REQUIRED_CLIPS = ['Idle', 'Walk', 'Run', 'Jump', 'Jump_Idle', 'Jump_Land'] as const

export function createImportedAvatar(
  parent: pc.Entity,
  assets: AssetsHandle,
  config: GameConfig,
): AvatarVisual {
  const spec = config.player.avatar.gltf
  const available = assets.clipNames(spec.assetKey)
  const missing = REQUIRED_CLIPS.filter((clip) => !available.includes(clip))
  if (missing.length > 0) throw new Error(`Avatar ${spec.assetKey} is missing clips: ${missing.join(', ')}`)
  const character = spawnCharacter(assets, spec.assetKey, {
    parent,
    scale: spec.scale,
    rotation: [0, spec.rotationY, 0],
    blendTime: spec.blendTime,
  })
  character.entity.setLocalPosition(0, spec.yOffset, 0)
  let current: AvatarMotion | null = null

  return {
    entity: character.entity,
    drawCalls: 1,
    setMotion(motion) {
      if (motion === current) return
      current = motion
      if (motion === 'fall') {
        assets.playAnimation(character.entity, 'Jump_Idle', { blendTime: spec.blendTime })
      } else if (motion === 'land') {
        assets.playAnimation(character.entity, 'Jump_Land', { loop: false, blendTime: spec.blendTime })
      } else {
        character.play(motion === 'run' ? 'run' : motion === 'walk' ? 'walk' : motion === 'jump' ? 'jump' : 'idle')
      }
    },
    reset() { current = null; character.play('idle') },
    destroy() { character.entity.destroy() },
  }
}
