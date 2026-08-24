/* =============================================================================
 * SDK MODULE: controller — third-person character controller (PlayCanvas).
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * your game code passes to createController(); if the module falls short,
 * that is a kit change, not a local edit.
 * Kind: playcanvas-3d — PlayCanvas entities + the kinematic physics module.
 * =============================================================================
 *
 * WHAT
 *   Walk, run, jump and a camera that follows — the movement every 3D kid game
 *   starts from, camera-relative (pushing "up" walks away from the camera,
 *   whatever way it is facing):
 *
 *     const world = createPhysicsWorld({ gravity: -22, groundY: 0 })
 *     const hero = assets.spawn('hero')
 *     const control = createController({
 *       entity: hero, camera, world, input,
 *       speed: CONFIG.player.speed, jumpSpeed: CONFIG.player.jumpSpeed,
 *       onJump: () => sfx.tone({ freq: 520, slideTo: 900 }),
 *       onStateChange: (state) => assets.playAnimation(hero, state),  // idle|run|jump
 *     })
 *
 *     update(dt) { control.update(dt) }        // one line in systems/loop.ts
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que corra más rápido"      → speed (m/s; 4 walks, 8 runs, 14 is fast).
 *   "que salte más alto"        → jumpSpeed (m/s of initial upward speed).
 *   "doble salto"               → maxJumps: 2.
 *   "que gire más suave"        → turnSpeed (degrees/s the model rotates to
 *                                 face where it moves).
 *   "la cámara muy cerca"       → camera.distance / camera.height.
 *   "que la cámara no siga"     → omit `camera` entirely; movement stays
 *                                 relative to the world axes.
 *   "vista en primera persona"  → camera.mode: 'first-person'.
 *
 * INTEGRATIONS
 *   - Input: anything with pressed() — the keyboard module, and the touch
 *     module feeding it, so mobile works with no extra code.
 *   - Physics: the kinematic world of the physics module (gravity, ground,
 *     walls). No Ammo, no rigidbodies.
 *   - onStateChange gives you 'idle' | 'run' | 'jump' | 'fall', ready to hand
 *     to assets.playAnimation().
 *
 * NOTES
 *   - update(dt) expects SECONDS (PlayCanvas Script.update gives you seconds;
 *     the Phaser controller takes milliseconds — different engines, different
 *     idiom, on purpose).
 * =============================================================================
 */
import * as pc from 'playcanvas'
import type { KinematicBody, PhysicsWorld } from './physics'

export type ControllerState = 'idle' | 'run' | 'jump' | 'fall'

/** Minimal input surface — createKeyboard()'s handle satisfies it. */
export interface ControllerInput {
  pressed(action: string): boolean
}

export interface CameraFollowOptions {
  entity: pc.Entity
  /** 'third-person' (default) or 'first-person'. */
  mode?: 'third-person' | 'first-person'
  /** Distance behind the character, in metres. Default 6. */
  distance?: number
  /** Height above the character, in metres. Default 3. */
  height?: number
  /** 0-1 per frame smoothing; higher snaps faster. Default 0.12. */
  smoothing?: number
}

export interface ControllerOptions {
  entity: pc.Entity
  input: ControllerInput
  world: PhysicsWorld
  camera?: CameraFollowOptions
  /** Horizontal speed in m/s. Default 6. */
  speed?: number
  /** Initial upward speed of a jump, in m/s. Default 8. */
  jumpSpeed?: number
  /** Jumps before touching ground again. Default 1 (2 = double jump). */
  maxJumps?: number
  /** Degrees per second the model turns towards its movement. Default 720. */
  turnSpeed?: number
  /** Grace period after leaving a ledge where a jump still works. Default 0.1s. */
  coyoteTime?: number
  /** Collider size passed to the physics world. */
  radius?: number
  height?: number
  actions?: { left?: string; right?: string; up?: string; down?: string; jump?: string }
  onJump?: () => void
  onLand?: () => void
  onStateChange?: (state: ControllerState) => void
}

export interface ControllerHandle {
  /** Call once per frame with the delta in SECONDS. */
  update(dt: number): void
  isGrounded(): boolean
  state(): ControllerState
  jump(): void
  /** Move the character somewhere else without inheriting speed. */
  teleport(x: number, y: number, z: number): void
  destroy(): void
}

export function createController(options: ControllerOptions): ControllerHandle {
  const speed = options.speed ?? 6
  const jumpSpeed = options.jumpSpeed ?? 8
  const maxJumps = options.maxJumps ?? 1
  const turnSpeed = options.turnSpeed ?? 720
  const coyoteTime = options.coyoteTime ?? 0.1
  const actions = {
    left: options.actions?.left ?? 'left',
    right: options.actions?.right ?? 'right',
    up: options.actions?.up ?? 'up',
    down: options.actions?.down ?? 'down',
    jump: options.actions?.jump ?? 'jump',
  }

  const body: KinematicBody = options.world.addKinematic(options.entity, {
    radius: options.radius,
    height: options.height,
  })

  const forward = new pc.Vec3()
  const right = new pc.Vec3()
  const move = new pc.Vec3()
  const cameraTarget = new pc.Vec3()

  let coyoteTimer = 0
  let jumpsLeft = maxJumps
  let jumpWasPressed = false
  let wasGrounded = false
  let currentState: ControllerState = 'idle'

  function setState(state: ControllerState): void {
    if (state === currentState) return
    currentState = state
    options.onStateChange?.(state)
  }

  function jump(): void {
    body.velocityY = jumpSpeed
    jumpsLeft -= 1
    coyoteTimer = 0
    setState('jump')
    options.onJump?.()
  }

  /** Camera-relative axes, flattened to the ground plane. */
  function movementAxes(): void {
    const camera = options.camera?.entity
    if (camera) {
      forward.copy(camera.forward)
      right.copy(camera.right)
      forward.y = 0
      right.y = 0
      if (forward.length() < 0.001) forward.set(0, 0, -1)
      forward.normalize()
      right.normalize()
    } else {
      forward.set(0, 0, -1)
      right.set(1, 0, 0)
    }
  }

  function updateCamera(dt: number): void {
    const camera = options.camera
    if (!camera) return
    const position = options.entity.getPosition()
    const smoothing = Math.min(1, (camera.smoothing ?? 0.12) * dt * 60)

    if (camera.mode === 'first-person') {
      cameraTarget.set(position.x, position.y + (camera.height ?? 1.6), position.z)
      camera.entity.setPosition(
        pc.math.lerp(camera.entity.getPosition().x, cameraTarget.x, smoothing),
        pc.math.lerp(camera.entity.getPosition().y, cameraTarget.y, smoothing),
        pc.math.lerp(camera.entity.getPosition().z, cameraTarget.z, smoothing)
      )
      return
    }

    const distance = camera.distance ?? 6
    const height = camera.height ?? 3
    const heading = options.entity.forward
    cameraTarget.set(
      position.x - heading.x * distance,
      position.y + height,
      position.z - heading.z * distance
    )
    const current = camera.entity.getPosition()
    camera.entity.setPosition(
      pc.math.lerp(current.x, cameraTarget.x, smoothing),
      pc.math.lerp(current.y, cameraTarget.y, smoothing),
      pc.math.lerp(current.z, cameraTarget.z, smoothing)
    )
    camera.entity.lookAt(position.x, position.y + 1, position.z)
  }

  function update(dt: number): void {
    const input = options.input
    const moveX = (input.pressed(actions.right) ? 1 : 0) - (input.pressed(actions.left) ? 1 : 0)
    const moveZ = (input.pressed(actions.up) ? 1 : 0) - (input.pressed(actions.down) ? 1 : 0)

    movementAxes()
    move.set(0, 0, 0)
    move.add(new pc.Vec3().copy(forward).mulScalar(moveZ))
    move.add(new pc.Vec3().copy(right).mulScalar(moveX))
    const moving = move.length() > 0.001
    if (moving) move.normalize().mulScalar(speed)

    // Jump: edge-detected, with coyote time and multi-jump.
    const jumpPressed = input.pressed(actions.jump)
    const jumpJustPressed = jumpPressed && !jumpWasPressed
    jumpWasPressed = jumpPressed
    if (jumpJustPressed && (coyoteTimer > 0 || jumpsLeft > 0)) jump()

    body.move(move.x, move.z, dt)

    if (body.grounded) {
      if (!wasGrounded) options.onLand?.()
      coyoteTimer = coyoteTime
      jumpsLeft = maxJumps
      setState(moving ? 'run' : 'idle')
    } else {
      coyoteTimer = Math.max(0, coyoteTimer - dt)
      setState(body.velocityY > 0 ? 'jump' : 'fall')
    }
    wasGrounded = body.grounded

    // Face the movement direction, turning at a limited rate.
    if (moving) {
      const targetYaw = (Math.atan2(move.x, move.z) * 180) / Math.PI
      const currentYaw = options.entity.getEulerAngles().y
      let delta = ((targetYaw - currentYaw + 540) % 360) - 180
      const maxStep = turnSpeed * dt
      delta = pc.math.clamp(delta, -maxStep, maxStep)
      options.entity.setEulerAngles(0, currentYaw + delta, 0)
    }

    updateCamera(dt)
  }

  return {
    update,
    isGrounded: () => body.grounded,
    state: () => currentState,
    jump,
    teleport: (x, y, z) => body.teleport(x, y, z),
    destroy: () => body.destroy(),
  }
}
