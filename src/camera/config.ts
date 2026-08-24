export type CameraMode = 'first-person' | 'third-person'
export type AvatarRenderer = 'procedural' | 'gltf'
export type Range = readonly [number, number]

export interface CameraConfig {
  initialMode: CameraMode
  switching: { enabled: boolean; showButton: boolean }
  clipping: { near: number; far: number }
  look: {
    mouseSensitivity: number
    touchSensitivity: number
    padLookSpeed: number
  }
  modes: {
    firstPerson: { fov: number; pitchRange: Range }
    thirdPerson: {
      fov: number
      pitchRange: Range
      distance: number
      height: number
      aimDistance: number
      minDistance: number
      collisionRadius: number
      collisionPadding: number
      returnSpeed: number
    }
  }
}

export interface AvatarConfig {
  renderer: AvatarRenderer
  turnSpeed: number
  actionFacingTime: number
  procedural: {
    height: number
    bodyWidth: number
    headScale: number
    colors: { skin: string; hair: string; shirt: string; pants: string; boots: string }
    animation: {
      idleBob: number
      walkFrequency: number
      runFrequency: number
      walkSwing: number
      runSwing: number
    }
  }
  gltf: {
    assetKey: string
    scale: number
    yOffset: number
    rotationY: number
    blendTime: number
  }
  shadow: { enabled: boolean; opacity: number; radius: number; maxDistance: number }
}
