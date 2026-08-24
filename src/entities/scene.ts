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
  const sky = config.environment.sky

  app.scene.ambientLight = color(sky.ambient)
  app.scene.fog.type = pc.FOG_LINEAR
  app.scene.fog.color.copy(color(sky.fogColor))
  app.scene.fog.start = sky.fogStart
  app.scene.fog.end = sky.fogEnd

  const camera = new pc.Entity('FPS Camera')
  camera.addComponent('camera', {
    clearColor: color(sky.horizon),
    fov: config.camera.fov,
    nearClip: config.camera.nearClip,
    farClip: config.camera.farClip,
  })
  root.addChild(camera)

  const sun = new pc.Entity('Warm Sun')
  sun.addComponent('light', {
    type: 'directional', color: color(sky.sunColor), intensity: 0.88,
    castShadows: false,
  })
  sun.setLocalEulerAngles(...sky.sunEuler)
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
