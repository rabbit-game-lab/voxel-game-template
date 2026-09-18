import type { GameConfig } from '../game.config'
import { createSound } from '../rabbit/sound'
import type { SoundType } from '../sim/types'

export interface AudioHandle {
  play(type: SoundType): void
  update(dt: number): void
  setPaused(paused: boolean): void
  setMuted(muted: boolean): void
  reset(): void
  destroy(): void
}

export function createGameAudio(config: GameConfig): AudioHandle {
  const sound = createSound({ volumes: { sfx: config.audio.sfxVolume, music: config.audio.musicVolume } })
  let paused = false
  let muted = false
  let randomState = (config.world.seed + 92821) >>> 0
  let waterTimer = 2.5
  let windTimer = 5

  const random = (): number => {
    randomState = Math.imul(randomState ^ (randomState >>> 15), randomState | 1) >>> 0
    return randomState / 0xffffffff
  }
  const interval = (range: readonly [number, number]): number => range[0] + random() * (range[1] - range[0])

  return {
    play(type) {
      if (paused || muted) return
      switch (type) {
        case 'jump':
          sound.tone({ freq: 260, slideTo: 520, duration: 0.08, volume: 0.028 })
          break
        case 'splash':
          sound.noise({ duration: 0.2, filter: 'lowpass', freq: 720, freqTo: 180, volume: 0.045 })
          break
        case 'break':
          sound.noise({ duration: 0.11, filter: 'lowpass', freq: 950, freqTo: 280, volume: 0.055 })
          break
        case 'place':
          sound.noise({ duration: 0.07, filter: 'bandpass', freq: 420, volume: 0.04 })
          break
        case 'crystal':
          sound.tone({ freq: 620, slideTo: 1240, duration: 0.16, type: 'sine', volume: 0.04 })
          sound.tone({ freq: 930, duration: 0.12, delayMs: 70, type: 'sine', volume: 0.025 })
          break
        case 'pickup':
          sound.tone({ freq: 520, slideTo: 780, duration: 0.11, type: 'triangle', volume: 0.03 })
          break
        case 'discovery':
          sound.tone({ freq: 392, slideTo: 587, duration: 0.22, type: 'sine', volume: 0.03 })
          sound.tone({ freq: 784, duration: 0.18, delayMs: 120, type: 'sine', volume: 0.022 })
          break
        case 'respawn':
          sound.tone({ freq: 210, slideTo: 480, duration: 0.26, type: 'triangle', volume: 0.03 })
          break
        case 'invalid':
          sound.tone({ freq: 150, slideTo: 105, duration: 0.08, volume: 0.02 })
          break
        case 'victory':
          [440, 660, 880].forEach((freq, index) => sound.tone({
            freq, duration: 0.2, delayMs: index * 115, type: 'triangle', volume: 0.035,
          }))
          break
        case 'defeat':
          sound.tone({ freq: 260, slideTo: 70, duration: 0.5, type: 'sawtooth', volume: 0.03 })
          break
      }
    },
    update(dt) {
      if (paused || muted || !config.environment.ambience.enabled) return
      waterTimer -= dt; windTimer -= dt
      if (waterTimer <= 0) {
        sound.noise({
          duration: 0.32, filter: 'lowpass', freq: 460, freqTo: 210,
          volume: config.environment.ambience.volume * 0.72,
        })
        waterTimer = interval(config.environment.ambience.waterInterval)
      }
      if (windTimer <= 0) {
        sound.noise({
          duration: 0.42, filter: 'bandpass', freq: 680, freqTo: 340, q: 0.5,
          volume: config.environment.ambience.volume * 0.52,
        })
        windTimer = interval(config.environment.ambience.windInterval)
      }
    },
    setPaused(value) {
      paused = value
      if (value) sound.stop('sfx')
    },
    setMuted(value) {
      muted = value
      sound.setMuted(value)
    },
    reset() {
      sound.stop('sfx')
      randomState = (config.world.seed + 92821) >>> 0
      waterTimer = 2.5; windTimer = 5
    },
    destroy() { sound.destroy() },
  }
}
