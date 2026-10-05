<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `sound`

Import path: `@rabbit-game-lab/sdk/common/sound`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/common/sound.ts` (read-only)

```ts
import { createSound, type SoundGroup, type SoundOptions, type PlayOptions, type ToneOptions, type NoiseOptions, type SoundHandle } from '@rabbit-game-lab/sdk/common/sound'
```

## Guide

```text
SDK MODULE: sound — music/sfx groups over WebAudio.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. Build game code on top of it (e.g. a
palette of playXxxSfx() helpers); if the module itself falls short, that is
a kit change, not a local edit.
Kind: agnostic — browser APIs only, no engine imports. Works in any stack.

WHAT
  Small sound manager with two volume groups (music, sfx):

    const sound = createSound({ volumes: { music: 0.6, sfx: 1 } })
    await sound.load('jump', 'assets/jump.mp3')      // once, e.g. at boot
    sound.play('jump')                               // sfx one-shot
    sound.play('theme', { group: 'music', loop: true })
    sound.tone({ freq: 660 })                        // procedural blip, no asset

TYPICAL REQUESTS → WHAT TO TOUCH
  "add a jump sound"    → no asset? sound.tone({ freq, duration }) for pitched
                          blips, sound.noise({...}) for whooshes and impacts.
                          With an asset: load() at boot + play() on the event.
  "background music"    → load() + play(name, { group: 'music', loop: true }).
  "music too loud"      → the volumes passed to createSound — expose them in
                          game.config.ts so tuning requests stay config-first.
  "mute button"         → setMuted(true/false) (Studio's mute already works).

INTEGRATIONS
  - rabbit:mute (Studio): hard-mutes/unmutes everything automatically.
  - rabbit:pause (Studio): suspends/resumes the AudioContext automatically.
  - Autoplay policy: the AudioContext registers with sdk.audio, which resumes
    it on the first user gesture. No extra wiring needed.

NOTES
  - load() fetches and decodes once; play() of an unloaded name warns and no-ops.
  - play() returns { stop() }. Looping music is replaced when a new play() uses
    the music group with replace: true (default for group 'music').
```

## Public API

Declarations shipped with the package (`dist/common/sound.d.ts`).

```ts
export type SoundGroup = 'music' | 'sfx';
export interface SoundOptions {
    /** Initial group volumes, 0-1. Wire these from game.config.ts. */
    volumes?: Partial<Record<SoundGroup, number>>;
}
export interface PlayOptions {
    group?: SoundGroup;
    /** 0-1, multiplied by the group volume. Default 1. */
    volume?: number;
    /** Playback speed, 1 = normal. Default 1. */
    rate?: number;
    loop?: boolean;
    /** Stop the current sound of the group first. Default: true for 'music'. */
    replace?: boolean;
}
export interface ToneOptions {
    /** Frequency in Hz. Default 660. */
    freq?: number;
    /** Duration in seconds. Default 0.08. */
    duration?: number;
    type?: OscillatorType;
    /** Absolute peak gain (this fork). Default 0.035. */
    volume?: number;
    group?: SoundGroup;
    /** Linear frequency slide target (Hz) over the duration. */
    slideTo?: number;
    /** Envelope attack in seconds. Default 0.01. */
    attack?: number;
    /** Envelope release in seconds. Default min(0.12, duration * 0.6). */
    release?: number;
    /** Start delay in milliseconds (layered sounds). */
    delayMs?: number;
}
export interface NoiseOptions {
    /** Duration in seconds. Default 0.15. */
    duration?: number;
    /** Absolute peak gain. Default 0.12. */
    volume?: number;
    /** Filter shape over the burst. Default 'bandpass'. */
    filter?: 'lowpass' | 'highpass' | 'bandpass' | 'none';
    /** Filter frequency in Hz at the start. Default 2000. */
    freq?: number;
    /** Filter frequency in Hz at the end — the sweep that gives it character. */
    freqTo?: number;
    /** Bandpass sharpness. Default 1. */
    q?: number;
    group?: SoundGroup;
    /** Start delay in milliseconds (layered sounds). */
    delayMs?: number;
}
export interface SoundHandle {
    load(name: string, url: string): Promise<void>;
    play(name: string, options?: PlayOptions): {
        stop(): void;
    };
    /** Procedural one-shot (oscillator + envelope) — sounds without assets. */
    tone(options?: ToneOptions): void;
    /**
     * Procedural noise burst — the percussive half of asset-less audio: jumps,
     * slides, impacts, wind, footsteps. A tone gives you pitch; this gives you
     * texture. Sweep `freq` → `freqTo` to make it move.
     */
    noise(options?: NoiseOptions): void;
    stop(group: SoundGroup): void;
    setVolume(group: SoundGroup, volume: number): void;
    setMuted(muted: boolean): void;
    setPaused(paused: boolean): void;
    destroy(): void;
}
export declare function createSound(options?: SoundOptions): SoundHandle;
```
