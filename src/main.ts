/** Rabbit boot and iframe lifecycle. Keep game behavior in systems/loop.ts. */
import * as pc from 'playcanvas'
import * as sdk from './rabbit/sdk'
import { setupGame } from './systems/loop'

sdk.init()

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const container = document.getElementById('app') as HTMLElement

const app = new pc.Application(canvas, {
  graphicsDeviceOptions: { antialias: true, powerPreference: 'high-performance' },
})
app.setCanvasFillMode(pc.FILLMODE_NONE)
app.setCanvasResolution(pc.RESOLUTION_AUTO)
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2)

const game = setupGame(app)
const bootReady = (game as typeof game & { ready?: Promise<void> }).ready
if (bootReady) sdk.requireReady(bootReady)

sdk.init({
  onRestart: () => game.restart(),
  onMute: (muted) => game.setMuted(muted),
})
sdk.observeResize(container, (width, height) => app.resizeCanvas(width, height))

app.start()
void game.ready.then(() => {
  app.once('postrender', () => sdk.ready())
}).catch((error: unknown) => {
  setTimeout(() => { throw error }, 0)
})

window.addEventListener('beforeunload', () => game.destroy(), { once: true })
