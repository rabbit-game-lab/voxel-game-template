import assert from 'node:assert/strict'
import { createPointerLock } from '../src/systems/pointer-lock.ts'

const previousDocument = globalThis.document
let pointerLockElement = null
const listeners = new Map()
globalThis.document = {
  get pointerLockElement() { return pointerLockElement },
  featurePolicy: { allowsFeature: (name) => name !== 'blocked' },
  addEventListener(type, fn) { listeners.set(type, fn) },
  removeEventListener(type) { listeners.delete(type) },
  exitPointerLock() { pointerLockElement = null; listeners.get('pointerlockchange')?.() },
}

const canvas = {
  requestPointerLock() {
    return Promise.reject(Object.assign(new Error('SecurityError'), { name: 'SecurityError' }))
  },
}

const lock = createPointerLock(canvas)
assert.equal(lock.allowed(), true)
assert.equal(await lock.request(), false)
assert.equal(lock.locked(), false)

let calls = 0
canvas.requestPointerLock = () => {
  calls += 1
  if (calls === 1) return Promise.reject(new Error('denied'))
  pointerLockElement = canvas
  return Promise.resolve()
}
assert.equal(await lock.request(), false)
assert.equal(await lock.request(), true)
assert.equal(lock.locked(), true)
lock.release()
assert.equal(lock.locked(), false)
lock.destroy()

let blockedCalls = 0
globalThis.document = {
  ...globalThis.document,
  featurePolicy: { allowsFeature: () => false },
}
const blocked = createPointerLock({
  requestPointerLock() {
    blockedCalls += 1
    return Promise.reject(new Error('policy'))
  },
})
assert.equal(blocked.allowed(), false)
assert.equal(await blocked.request(), false)
assert.equal(blockedCalls, 1, 'Policy reports must not skip the real requestPointerLock call')
blocked.destroy()

globalThis.document = {
  ...globalThis.document,
  featurePolicy: { allowsFeature: () => true },
}
const hanging = createPointerLock({
  requestPointerLock() { return new Promise(() => {}) },
})
assert.equal(await hanging.request(), false)
hanging.destroy()

globalThis.document = previousDocument
console.log('Pointer-lock adapter denial/retry scenarios passed.')
