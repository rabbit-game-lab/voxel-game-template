import * as pc from 'playcanvas'
import { color } from './helpers'
import type { GameConfig } from '../game.config'
import type { PlayerState } from '../sim/types'

export interface SceneHandle {
  camera: pc.Entity
  updatePlayer(player: PlayerState): void
  destroy(): void
}

export function createScene(app: pc.Application, config: GameConfig): SceneHandle {
  const root = new pc.Entity('Voxel Scene')
  app.root.addChild(root)

  app.scene.ambientLight = color(config.visual.ambient)
  app.scene.fog.type = pc.FOG_LINEAR
  app.scene.fog.color.copy(color(config.visual.fogColor))
  app.scene.fog.start = config.visual.fogStart
  app.scene.fog.end = config.visual.fogEnd

  const camera = new pc.Entity('FPS Camera')
  camera.addComponent('camera', {
    clearColor: color(config.visual.sky),
    fov: config.camera.fov,
    nearClip: config.camera.nearClip,
    farClip: config.camera.farClip,
  })
  root.addChild(camera)

  const sun = new pc.Entity('Warm Sun')
  sun.addComponent('light', {
    type: 'directional', color: color(config.visual.sun), intensity: 0.88,
    castShadows: false,
  })
  sun.setLocalEulerAngles(48, -32, 0)
  root.addChild(sun)

  return {
    camera,
    updatePlayer(player) {
      camera.setPosition(
        player.position.x,
        player.position.y + config.player.eyeHeight,
        player.position.z,
      )
      camera.setEulerAngles(player.pitch, player.yaw, 0)
    },
    destroy() {
      root.destroy()
      app.scene.fog.type = pc.FOG_NONE
    },
  }
}
