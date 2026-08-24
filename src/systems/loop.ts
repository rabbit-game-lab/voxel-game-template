import * as pc from 'playcanvas'
import { ASSETS } from '../data/assets'
import { BLOCKS } from '../data/blocks'
import { createEffects, type EffectsHandle } from '../entities/effects'
import { createScene, type SceneHandle } from '../entities/scene'
import { createWorldView, type WorldViewHandle } from '../entities/world-view'
import { CONFIG } from '../game.config'
import { createAssets, type AssetsHandle } from '../rabbit/assets'
import { createPause, type PauseHandle } from '../rabbit/pause'
import { GameSession } from '../sim/session'
import type { InputSnapshot, SimInput } from '../sim/types'
import { createGameAudio, type AudioHandle } from './audio'
import { validateConfig } from './config-validator'
import { createHud, type HudHandle } from './hud'
import { createInput, type InputHandle } from './input'

const FIXED_STEP = 1 / 60

export interface GameHandle {
  ready: Promise<void>
  restart(): void
  setMuted(muted: boolean): void
  destroy(): void
}

interface Runtime {
  session: GameSession
  assets: AssetsHandle
  scene: SceneHandle
  view: WorldViewHandle
  effects: EffectsHandle
  input: InputHandle
  audio: AudioHandle
  pause: PauseHandle
}

function simInput(
  snapshot: InputSnapshot,
  jumpPressed: boolean,
  placePressed: boolean,
  breakHeld: boolean,
): SimInput {
  return {
    moveX: snapshot.moveX, moveZ: snapshot.moveZ, sprint: snapshot.sprint,
    jumpPressed, breakHeld, placePressed,
  }
}

export function setupGame(app: pc.Application): GameHandle {
  const canvas = app.graphicsDevice.canvas as HTMLCanvasElement
  const ui = document.getElementById('ui') as HTMLElement
  let runtime: Runtime | null = null
  let destroyed = false
  let accumulator = 0
  let lastDevice: InputSnapshot['device'] = 'keyboard'
  let pendingSlot: number | null = null
  let muted = false
  let performanceFrames = 0
  let performanceElapsed = 0
  let performanceWorst = 0
  let performanceReported = false
  let bufferedJump = false
  let bufferedPlace = false
  let bufferedBreak = false
  let resolveReady!: () => void
  let rejectReady!: (error: unknown) => void
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject })

  const restart = (): void => {
    const current = runtime
    if (!current || destroyed) return
    current.session.restart()
    current.view.rebuildAll()
    current.effects.reset()
    current.audio.reset()
    current.input.clear()
    current.input.releaseFocus()
    current.pause.set(false)
    accumulator = 0
    performanceFrames = 0; performanceElapsed = 0; performanceWorst = 0; performanceReported = false
    bufferedJump = false; bufferedPlace = false; bufferedBreak = false
    current.scene.updatePlayer(current.session.player)
    updatePresentation(current)
  }

  const hud: HudHandle = createHud(ui, CONFIG, {
    start() {
      const current = runtime
      if (!current || current.pause.isPaused()) return
      current.session.begin()
      void current.input.requestFocus()
      updatePresentation(current)
    },
    restart,
    togglePause() { runtime?.pause.toggle() },
    selectSlot(index) { pendingSlot = index },
    capturePointer() { void runtime?.input.requestFocus() },
  })

  function updatePresentation(current: Runtime): void {
    const target = current.session.targetSnapshot().hit
    current.view.setSelection(current.session.phase === 'playing' ? target?.voxel ?? null : null)
    current.view.setSockets(CONFIG.world.beaconSockets.map((socket) =>
      current.session.world.getBlock(socket[0], socket[1], socket[2]) === BLOCKS.crystal.id))
    hud.update(current.session.getHudSnapshot(lastDevice, current.pause.isPaused()), current.input.isFocused())
  }

  function processEvents(current: Runtime): void {
    for (const event of current.session.consumeEvents()) {
      if (event.type === 'sound') current.audio.play(event.sound)
      if (event.type === 'edit') {
        current.view.markDirty(event.dirtyChunks)
        current.effects.burst(event.voxel, event.block === 'crystal')
      }
      if (event.type === 'phase' && (event.phase === 'victory' || event.phase === 'defeat')) {
        current.input.clear()
        current.input.releaseFocus()
      }
    }
  }

  function update(dt: number): void {
    const current = runtime
    if (!current || destroyed) return
    const frameDt = Math.min(Math.max(dt, 0), 0.1)
    const snapshot = current.input.snapshot(frameDt)
    lastDevice = snapshot.device
    if (snapshot.pausePressed) current.pause.toggle()
    if (snapshot.restartPressed && (current.session.phase === 'victory' || current.session.phase === 'defeat')) {
      restart()
      return
    }
    if (pendingSlot !== null) {
      snapshot.selectSlot = pendingSlot
      pendingSlot = null
    }
    current.session.applyFrameInput(snapshot)

    if (!current.pause.isPaused()) {
      bufferedJump ||= snapshot.jumpPressed
      bufferedPlace ||= snapshot.placePressed
      bufferedBreak ||= snapshot.breakHeld
      if (current.session.phase === 'playing' && !performanceReported) {
        performanceFrames += 1
        performanceElapsed += frameDt
        performanceWorst = Math.max(performanceWorst, frameDt)
        if (performanceElapsed >= 3) {
          console.info(`[Rabbit Voxel Lab] frame sample: ${(performanceFrames / performanceElapsed).toFixed(1)} FPS average, ${(performanceWorst * 1000).toFixed(1)} ms worst`)
          performanceReported = true
        }
      }
      accumulator += frameDt
      let steps = 0
      while (accumulator >= FIXED_STEP && steps < CONFIG.performance.maxCatchupSteps) {
        current.session.step(simInput(
          snapshot,
          steps === 0 && bufferedJump,
          steps === 0 && bufferedPlace,
          snapshot.breakHeld || (steps === 0 && bufferedBreak),
        ), FIXED_STEP)
        if (steps === 0) {
          bufferedJump = false; bufferedPlace = false; bufferedBreak = false
        }
        accumulator -= FIXED_STEP
        steps += 1
      }
      if (steps === CONFIG.performance.maxCatchupSteps) accumulator %= FIXED_STEP
      processEvents(current)
      current.view.update()
      if (current.session.phase === 'playing') current.effects.update(frameDt)
    }
    current.scene.updatePlayer(current.session.player)
    updatePresentation(current)
  }

  async function boot(): Promise<void> {
    let assets: AssetsHandle | null = null
    try {
      validateConfig(CONFIG)
      assets = createAssets(app, ASSETS)
      await assets.load()
      if (destroyed) return
      const session = new GameSession(CONFIG)
      const scene = createScene(app, CONFIG)
      const view = createWorldView(app, session.world, assets, CONFIG)
      const effects = createEffects(app, CONFIG)
      const input = createInput(canvas, CONFIG)
      const audio = createGameAudio(CONFIG)
      audio.setMuted(muted)
      const pause = createPause({
        keys: ['Escape', 'KeyP'], overlay: false, pauseOnBlur: false,
        inputs: [input, audio],
        onChange(paused) {
          app.timeScale = paused ? 0 : 1
          if (paused) {
            bufferedJump = false; bufferedPlace = false; bufferedBreak = false
            input.releaseFocus()
          }
          updatePresentation({ session, assets: assets!, scene, view, effects, input, audio, pause })
        },
      })
      runtime = { session, assets, scene, view, effects, input, audio, pause }
      scene.updatePlayer(session.player)
      app.on('update', update)
      updatePresentation(runtime)
      const stats = view.stats()
      console.info(`[Rabbit Voxel Lab] ${stats.chunks} chunks, ${stats.drawCalls} terrain draw calls, ${stats.triangles} triangles, max boot remesh ${stats.maxRemeshMs.toFixed(1)} ms`)
      resolveReady()
    } catch (error) {
      assets?.destroy()
      const message = error instanceof Error ? error.message : String(error)
      hud.showError(message)
      rejectReady(error)
    }
  }

  void boot()

  return {
    ready,
    restart,
    setMuted(value) {
      muted = value
      runtime?.audio.setMuted(value)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      app.off('update', update)
      const current = runtime
      runtime = null
      if (current) {
        current.pause.destroy(); current.input.destroy(); current.audio.destroy()
        current.effects.destroy(); current.view.destroy(); current.scene.destroy(); current.assets.destroy()
      }
      hud.destroy()
    },
  }
}
