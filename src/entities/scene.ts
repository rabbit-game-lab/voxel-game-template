import * as pc from 'playcanvas'
import type { CameraMode } from '../camera/config'
import type { TimeOfDay } from '../environment/config'
import { color } from './helpers'
import type { GameConfig } from '../game.config'
import type { AssetsHandle } from '../rabbit/assets'
import type { AimRay, PlayerState } from '../sim/types'
import type { VoxelCoord } from '../voxel/coords'
import type { VoxelWorld } from '../voxel/world'
import { createCameraRig } from './camera-rig'
import { createHeldItem } from './held-item'
import { createPlayerAvatar } from './player-avatar'

export interface SceneHandle {
  camera: pc.Entity
  cameraMode(): CameraMode
  setCameraMode(mode: CameraMode): void
  setTimeOfDay(mode: TimeOfDay): void
  updatePlayer(player: PlayerState, dt: number, animate: boolean): AimRay
  triggerAvatarAction(target: VoxelCoord): void
  /** Minecraft arm swing for the held pickaxe (first and third person). */
  swing(): void
  reset(player: PlayerState): void
  avatarStats(): { drawCalls: number; renderer: string }
  destroy(): void
}

export function createScene(
  app: pc.Application,
  world: VoxelWorld,
  assets: AssetsHandle,
  config: GameConfig,
): SceneHandle {
  const root = new pc.Entity('Voxel Scene')
  app.root.addChild(root)
  const initialSky = config.environment.sky.presets[config.environment.sky.initialMode]
  const cameraRig = createCameraRig(root, world, config, color(initialSky.horizon))
  const avatar = createPlayerAvatar(root, world, assets, config, app.graphicsDevice)
  const heldItem = createHeldItem(app, cameraRig.entity, config)

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
    cameraRig.entity.camera!.clearColor.copy(color(preset.horizon))
    celestialLight.light!.color.copy(color(preset.lightColor))
    celestialLight.light!.intensity = preset.lightIntensity
    celestialLight.setLocalEulerAngles(...preset.celestialEuler)
    heldItem.setTimeOfDay(mode)
  }
  setTimeOfDay(config.environment.sky.initialMode)

  return {
    camera: cameraRig.entity,
    cameraMode: cameraRig.mode,
    setCameraMode(mode) { cameraRig.setMode(mode); avatar.setCameraMode(mode); heldItem.setCameraMode(mode) },
    setTimeOfDay,
    updatePlayer(player, dt, animate) {
      const aim = cameraRig.update(player, dt)
      avatar.update(player, dt, animate)
      heldItem.update(dt, player)
      return aim
    },
    triggerAvatarAction: (target) => avatar.triggerAction(target),
    swing() { heldItem.swing(); avatar.swing() },
    reset(player) {
      cameraRig.reset(); avatar.setCameraMode(cameraRig.mode()); avatar.reset(player)
      heldItem.setCameraMode(cameraRig.mode()); heldItem.reset()
    },
    avatarStats: () => {
      const stats = avatar.stats()
      return { ...stats, drawCalls: stats.drawCalls + heldItem.stats().drawCalls }
    },
    destroy() {
      heldItem.destroy(); avatar.destroy(); cameraRig.destroy()
      root.destroy()
      app.scene.fog.type = pc.FOG_NONE
    },
  }
}
