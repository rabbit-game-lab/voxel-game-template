import * as pc from 'playcanvas'
import type { TimeOfDay } from '../environment/config'
import { color } from './helpers'
import type { GameConfig } from '../game.config'
import type { PlayerState } from '../sim/types'

export interface SceneHandle {
  camera: pc.Entity
  setTimeOfDay(mode: TimeOfDay): void
  updatePlayer(player: PlayerState): void
  destroy(): void
}

export function createScene(app: pc.Application, config: GameConfig): SceneHandle {
  const root = new pc.Entity('Voxel Scene')
  app.root.addChild(root)
  const initialSky = config.environment.sky.presets[config.environment.sky.initialMode]

  const camera = new pc.Entity('FPS Camera')
  camera.addComponent('camera', {
    clearColor: color(initialSky.horizon),
    fov: config.camera.fov,
    nearClip: config.camera.nearClip,
    farClip: config.camera.farClip,
  })
  root.addChild(camera)

  const celestialLight = new pc.Entity('Celestial Light')
  celestialLight.addComponent('light', {
    type: 'directional', color: color(initialSky.lightColor), intensity: initialSky.lightIntensity,
    castShadows: false,
  })
  root.addChild(celestialLight)

  const setTimeOfDay = (mode: TimeOfDay): void => {
    const preset = config.environment.sky.presets[mode]
    app.scene.ambientLight = color(preset.ambient)
    app.scene.fog.type = pc.FOG_LINEAR
    app.scene.fog.color.copy(color(preset.fogColor))
    app.scene.fog.start = preset.fogStart
    app.scene.fog.end = preset.fogEnd
    camera.camera!.clearColor.copy(color(preset.horizon))
    celestialLight.light!.color.copy(color(preset.lightColor))
    celestialLight.light!.intensity = preset.lightIntensity
    celestialLight.setLocalEulerAngles(...preset.celestialEuler)
  }
  setTimeOfDay(config.environment.sky.initialMode)

  return {
    camera,
    setTimeOfDay,
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
