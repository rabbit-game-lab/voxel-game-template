import type { ContentHandle } from '../entities/content'
import type { EffectsHandle } from '../entities/effects'
import type { EnvironmentHandle } from '../entities/environment'
import type { SceneHandle } from '../entities/scene'
import type { WorldViewHandle } from '../entities/world-view'
import type { AssetsHandle } from '../rabbit/assets'
import type { PauseHandle } from '../rabbit/pause'
import type { GameSession } from '../sim/session'
import type { InputSnapshot, SimInput } from '../sim/types'
import type { AudioHandle } from './audio'
import type { InputHandle } from './input'
import type { CreaturesHandle } from '../entities/creatures'

export interface RuntimeState {
  session: GameSession
  assets: AssetsHandle
  scene: SceneHandle
  view: WorldViewHandle
  effects: EffectsHandle
  environment: EnvironmentHandle
  content: ContentHandle
  creatures: CreaturesHandle
  input: InputHandle
  audio: AudioHandle
  pause: PauseHandle
}

export function toSimInput(snapshot: InputSnapshot, jumpPressed: boolean): SimInput {
  return {
    moveX: snapshot.moveX, moveZ: snapshot.moveZ, sprint: snapshot.sprint,
    jumpPressed,
  }
}
