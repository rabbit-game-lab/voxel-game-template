import { defineAssets } from '../rabbit/assets'
import type { AvatarRenderer } from '../camera/config'
import { CONFIG } from '../game.config'

/** Runtime assets used by the shipped first playable. Paths are relative to public/. */
export const ASSETS = defineAssets({
  textures: [{ key: 'blockAtlas', path: 'assets/textures/blocks-pixel-art.png' }],
  models: (CONFIG.player.avatar.renderer as AvatarRenderer) === 'gltf' ? [{
    key: 'quaterniusHero',
    path: 'assets/models/quaternius-character-male-2.glb',
    animations: {
      Idle: 'Idle', Walk: 'Walk', Run: 'Run',
      Jump: 'Jump', Jump_Idle: 'Jump_Idle', Jump_Land: 'Jump_Land',
    },
  }] : [],
})

export type TextureKey = (typeof ASSETS.textures)[number]['key']
