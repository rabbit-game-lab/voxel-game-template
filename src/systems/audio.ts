import type { GameConfig } from '../game.config'
import { createSound } from '../rabbit/sound'
import type { SoundType } from '../sim/types'

export interface AudioHandle {
  play(type: SoundType): void
  setPaused(paused: boolean): void
  setMuted(muted: boolean): void
  reset(): void
  destroy(): void
}

export function createGameAudio(config: GameConfig): AudioHandle {
  const sound = createSound({ volumes: { sfx: config.audio.sfxVolume, music: config.audio.musicVolume } })
  let paused = false
  let muted = false

  return {
    play(type) {
      if (paused || muted) return
      switch (type) {
        case 'jump':
          sound.tone({ freq: 260, slideTo: 520, duration: 0.08, volume: 0.028 })
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
    setPaused(value) {
      paused = value
      if (value) sound.stop('sfx')
    },
    setMuted(value) {
      muted = value
      sound.setMuted(value)
    },
    reset() { sound.stop('sfx') },
    destroy() { sound.destroy() },
  }
}
