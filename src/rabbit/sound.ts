/* =============================================================================
 * SDK MODULE: sound — music/sfx groups over WebAudio.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. Build game code on top of it (e.g. a
 * palette of playXxxSfx() helpers); if the module itself falls short, that is
 * a kit change, not a local edit.
 * Kind: agnostic — browser APIs only, no engine imports. Works in any stack.
 * =============================================================================
 *
 * WHAT
 *   Small sound manager with two volume groups (music, sfx):
 *
 *     const sound = createSound({ volumes: { music: 0.6, sfx: 1 } })
 *     await sound.load('jump', 'assets/jump.mp3')      // once, e.g. at boot
 *     sound.play('jump')                               // sfx one-shot
 *     sound.play('theme', { group: 'music', loop: true })
 *     sound.tone({ freq: 660 })                        // procedural blip, no asset
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "add a jump sound"    → no asset? sound.tone({ freq, duration }) for pitched
 *                           blips, sound.noise({...}) for whooshes and impacts.
 *                           With an asset: load() at boot + play() on the event.
 *   "background music"    → load() + play(name, { group: 'music', loop: true }).
 *   "music too loud"      → the volumes passed to createSound — expose them in
 *                           game.config.ts so tuning requests stay config-first.
 *   "mute button"         → setMuted(true/false) (Studio's mute already works).
 *
 * INTEGRATIONS
 *   - rabbit:mute (Studio): hard-mutes/unmutes everything automatically.
 *   - rabbit:pause (Studio): suspends/resumes the AudioContext automatically.
 *   - Autoplay policy: the AudioContext registers with sdk.audio, which resumes
 *     it on the first user gesture. No extra wiring needed.
 *
 * NOTES
 *   - load() fetches and decodes once; play() of an unloaded name warns and no-ops.
 *   - play() returns { stop() }. Looping music is replaced when a new play() uses
 *     the music group with replace: true (default for group 'music').
 * =============================================================================
 */
import * as sdk from './sdk'
import { pauseGate, runtime } from './runtime'

export type SoundGroup = 'music' | 'sfx'

export interface SoundOptions {
  /** Initial group volumes, 0-1. Wire these from game.config.ts. */
  volumes?: Partial<Record<SoundGroup, number>>
}

export interface PlayOptions {
  group?: SoundGroup
  /** 0-1, multiplied by the group volume. Default 1. */
  volume?: number
  /** Playback speed, 1 = normal. Default 1. */
  rate?: number
  loop?: boolean
  /** Stop the current sound of the group first. Default: true for 'music'. */
  replace?: boolean
}

export interface ToneOptions {
  /** Frequency in Hz. Default 660. */
  freq?: number
  /** Duration in seconds. Default 0.08. */
  duration?: number
  type?: OscillatorType
  /** Absolute peak gain (this fork). Default 0.035. */
  volume?: number
  group?: SoundGroup
  /** Linear frequency slide target (Hz) over the duration. */
  slideTo?: number
  /** Envelope attack in seconds. Default 0.01. */
  attack?: number
  /** Envelope release in seconds. Default min(0.12, duration * 0.6). */
  release?: number
  /** Start delay in milliseconds (layered sounds). */
  delayMs?: number
}

export interface NoiseOptions {
  /** Duration in seconds. Default 0.15. */
  duration?: number
  /** Absolute peak gain. Default 0.12. */
  volume?: number
  /** Filter shape over the burst. Default 'bandpass'. */
  filter?: 'lowpass' | 'highpass' | 'bandpass' | 'none'
  /** Filter frequency in Hz at the start. Default 2000. */
  freq?: number
  /** Filter frequency in Hz at the end — the sweep that gives it character. */
  freqTo?: number
  /** Bandpass sharpness. Default 1. */
  q?: number
  group?: SoundGroup
  /** Start delay in milliseconds (layered sounds). */
  delayMs?: number
}

export interface SoundHandle {
  load(name: string, url: string): Promise<void>
  play(name: string, options?: PlayOptions): { stop(): void }
  /** Procedural one-shot (oscillator + envelope) — sounds without assets. */
  tone(options?: ToneOptions): void
  /**
   * Procedural noise burst — the percussive half of asset-less audio: jumps,
   * slides, impacts, wind, footsteps. A tone gives you pitch; this gives you
   * texture. Sweep `freq` → `freqTo` to make it move.
   */
  noise(options?: NoiseOptions): void
  stop(group: SoundGroup): void
  setVolume(group: SoundGroup, volume: number): void
  setMuted(muted: boolean): void
  setPaused(paused: boolean): void
  destroy(): void
}

export function createSound(options: SoundOptions = {}): SoundHandle {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  const groups = new Map<SoundGroup, GainNode>()
  const volumes: Record<SoundGroup, number> = {
    music: options.volumes?.music ?? 0.6,
    sfx: options.volumes?.sfx ?? 1,
  }
  const buffers = new Map<string, AudioBuffer>()
  const current = new Map<SoundGroup, { stop(): void }>()
  let muted = false
  let localMuted = false
  let paused = false
  let destroyed = false
  let unregisterAudio: (() => void) | undefined

  function getCtx(): AudioContext {
    if (destroyed) throw new Error('sound: handle destroyed')
    if (!ctx) {
      ctx = new AudioContext()
      unregisterAudio = sdk.audio.register(ctx, () => !paused)
      if (paused) void ctx.suspend().catch(() => undefined)
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 1
      master.connect(ctx.destination)
      for (const group of ['music', 'sfx'] as const) {
        const gain = ctx.createGain()
        gain.gain.value = volumes[group]
        gain.connect(master)
        groups.set(group, gain)
      }
    }
    return ctx
  }

  function groupNode(group: SoundGroup): GainNode {
    getCtx()
    return groups.get(group) as GainNode
  }

  const gate = pauseGate((value) => {
    paused = value
    if (ctx) void (paused ? ctx.suspend() : ctx.resume()).catch(() => undefined)
  })
  const offState = runtime.subscribe(() => applyMute())

  function setMuted(value: boolean): void {
    localMuted = value
    applyMute()
  }
  function applyMute(): void {
    muted = localMuted || runtime.state().muted
    if (master) master.gain.value = muted ? 0 : 1
  }

  return {
    async load(name, url) {
      if (buffers.has(name)) return
      const response = await fetch(url)
      if (!response.ok) throw new Error(`sound: failed to fetch ${url} (${response.status})`)
      const buffer = await getCtx().decodeAudioData(await response.arrayBuffer())
      buffers.set(name, buffer)
    },

    play(name, playOptions = {}) {
      const group = playOptions.group ?? 'sfx'
      const buffer = buffers.get(name)
      if (!buffer) {
        console.warn(`sound: "${name}" not loaded — call sound.load('${name}', url) first`)
        return { stop: () => undefined }
      }
      const context = getCtx()
      if (playOptions.replace ?? group === 'music') current.get(group)?.stop()

      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = playOptions.loop ?? false
      source.playbackRate.value = playOptions.rate ?? 1
      const gain = context.createGain()
      gain.gain.value = playOptions.volume ?? 1
      source.connect(gain)
      gain.connect(groupNode(group))
      source.start()

      const handle = {
        stop() {
          try {
            source.stop()
          } catch {
            // Already stopped — nothing to do.
          }
        },
      }
      current.set(group, handle)
      return handle
    },

    tone(toneOptions = {}) {
      const context = getCtx()
      const now = context.currentTime + (toneOptions.delayMs ?? 0) / 1000
      const duration = toneOptions.duration ?? 0.08
      const attack = toneOptions.attack ?? 0.01
      const release = toneOptions.release ?? Math.min(0.12, duration * 0.6)
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = toneOptions.type ?? 'square'
      osc.frequency.setValueAtTime(toneOptions.freq ?? 660, now)
      if (toneOptions.slideTo) {
        osc.frequency.linearRampToValueAtTime(toneOptions.slideTo, now + duration)
      }
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(toneOptions.volume ?? 0.035, now + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release)
      osc.connect(gain)
      gain.connect(groupNode(toneOptions.group ?? 'sfx'))
      osc.start(now)
      osc.stop(now + duration + release + 0.02)
    },

    noise(noiseOptions = {}) {
      const context = getCtx()
      const now = context.currentTime + (noiseOptions.delayMs ?? 0) / 1000
      const duration = noiseOptions.duration ?? 0.15
      const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration))

      const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < sampleCount; i += 1) {
        // White noise with a linear decay baked in, so it never clicks at the end.
        data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount)
      }
      const source = context.createBufferSource()
      source.buffer = buffer

      const gain = context.createGain()
      gain.gain.setValueAtTime(noiseOptions.volume ?? 0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      const filterType = noiseOptions.filter ?? 'bandpass'
      if (filterType === 'none') {
        source.connect(gain)
      } else {
        const filter = context.createBiquadFilter()
        filter.type = filterType
        filter.frequency.setValueAtTime(noiseOptions.freq ?? 2000, now)
        if (noiseOptions.freqTo) {
          filter.frequency.linearRampToValueAtTime(noiseOptions.freqTo, now + duration)
        }
        filter.Q.value = noiseOptions.q ?? 1
        source.connect(filter)
        filter.connect(gain)
      }
      gain.connect(groupNode(noiseOptions.group ?? 'sfx'))
      source.start(now)
      source.stop(now + duration + 0.02)
    },

    stop(group) {
      current.get(group)?.stop()
      current.delete(group)
    },

    setVolume(group, volume) {
      volumes[group] = Math.min(1, Math.max(0, volume))
      const node = groups.get(group)
      if (node) node.gain.value = volumes[group]
    },

    setMuted,
    setPaused: gate.set,

    destroy() {
      if (destroyed) return
      destroyed = true
      gate.destroy()
      offState()
      unregisterAudio?.()
      for (const handle of current.values()) handle.stop()
      current.clear()
      if (ctx) void ctx.close().catch(() => undefined)
      ctx = null
      master = null
      groups.clear()
    },
  }
}
