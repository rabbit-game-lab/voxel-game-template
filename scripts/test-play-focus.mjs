import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createPlayFocus } from '../src/systems/play-focus.ts'
import { createPause } from '../src/rabbit/pause.ts'

globalThis.window = new EventTarget()
globalThis.document = { createElement: () => ({ remove() {} }) }
function event(type, values = {}) {
  window.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values))
}
function fixture() {
  let locked = false
  let phase = 'focus'
  let complete
  let requests = 0
  const listeners = new Set()
  const input = {
    isFocused: () => locked,
    clear() {}, setPaused() {},
    requestFocus: () => { requests++; return new Promise(resolve => { complete = resolve }) },
    releaseFocus() { change(false) },
    onFocusChange(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  }
  function change(value) {
    if (locked === value) return
    locked = value
    for (const fn of listeners) fn(value)
  }
  const pause = createPause({ keys: [], overlay: false, inputs: [input],
    onChange(value) { if (value) input.releaseFocus() },
  })
  const focus = createPlayFocus({ input, pause, phase: () => phase,
    begin() { if (phase === 'focus') phase = 'playing' }, changed() {},
  })
  return { focus, pause, input, change, phase: () => phase,
    requests: () => requests,
    setPhase(value) { phase = value },
    async finish(value) { if (value) change(true); complete(value); await Promise.resolve() },
    destroy() { focus.destroy(); pause.destroy() },
  }
}

{
  const f = fixture()
  f.focus.resume('keyboard')
  assert.equal(f.pause.isPaused(), true)
  await f.finish(true)
  assert.equal(f.phase(), 'playing')
  assert.equal(f.pause.isPaused(), false)
  f.change(false)
  event('keydown', { code: 'Escape', repeat: false })
  assert.equal(f.pause.isPaused(), false, 'Escape unlocks the mouse and must not pause')
  assert.equal(f.input.isFocused(), false)
  f.destroy()
}
{
  const f = fixture()
  f.focus.resume('keyboard'); await f.finish(true)
  event('keydown', { code: 'KeyP', repeat: false })
  assert.equal(f.pause.isPaused(), true)
  f.destroy()
}
{
  const f = fixture()
  f.focus.resume('keyboard'); await f.finish(false)
  assert.equal(f.focus.status(), 'idle')
  assert.equal(f.phase(), 'playing')
  assert.equal(f.pause.isPaused(), false)
  f.focus.resume('keyboard')
  event('message', { data: { type: 'rabbit:pause', paused: true } })
  await f.finish(true)
  assert.equal(f.input.isFocused(), false)
  assert.equal(f.pause.isPaused(), true)
  f.focus.resume('touch')
  assert.equal(f.pause.isPaused(), true)
  event('message', { data: { type: 'rabbit:pause', paused: false } })
  assert.equal(f.pause.isPaused(), true)
  f.focus.resume('keyboard'); await f.finish(true)
  assert.equal(f.pause.isPaused(), false)
  f.destroy()
}
for (const device of ['touch', 'gamepad']) {
  const f = fixture()
  f.focus.resume(device)
  assert.equal(f.pause.isPaused(), false)
  assert.equal(f.input.isFocused(), false)
  event('pointermove', { pointerType: 'mouse' })
  assert.equal(f.pause.isPaused(), false, 'Unlocked mouse look must not stop a running session')
  f.destroy()
}
for (const phase of ['focus', 'victory', 'defeat']) {
  const f = fixture()
  f.focus.resume('keyboard'); await f.finish(true)
  f.setPhase(phase); f.change(false)
  assert.equal(f.pause.isPaused(), false)
  f.destroy()
}
for (const cancel of ['reset', 'destroy', 'pause-key']) {
  const f = fixture()
  f.focus.resume('keyboard')
  if (cancel === 'pause-key') event('keydown', { code: 'KeyP', repeat: false })
  else f.focus[cancel]()
  await f.finish(true)
  assert.equal(f.pause.isPaused(), true)
  assert.equal(f.input.isFocused(), false)
  f.destroy()
}
{
  const f = fixture()
  f.focus.resume('keyboard'); await f.finish(true)
  f.change(false)
  assert.equal(f.pause.isPaused(), false, 'Losing lock must not pause')
  const before = f.requests()
  f.focus.resume('keyboard'); await f.finish(true)
  assert.equal(f.pause.isPaused(), false)
  assert.equal(f.requests(), before + 1, 'Next Continue/click recaptures')
  f.destroy()
}
mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10000 })
{
  const f = fixture()
  f.focus.resume('keyboard'); await f.finish(true)
  f.change(false)
  f.focus.resume('keyboard'); await f.finish(false)
  mock.timers.tick(1500)
  assert.equal(f.requests(), 2, 'Denied lock must not auto-retry without a gesture')
  assert.equal(f.pause.isPaused(), false)
  f.destroy()
}
mock.timers.reset()
console.log('Pointer capture / Rabbit pause regression scenarios passed.')
