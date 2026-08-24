import { defineAssets } from '../rabbit/assets'

/** Runtime assets used by the shipped first playable. Paths are relative to public/. */
export const ASSETS = defineAssets({
  textures: [{ key: 'blockAtlas', path: 'assets/textures/blocks-pixel-art.png' }],
})

export type TextureKey = (typeof ASSETS.textures)[number]['key']
