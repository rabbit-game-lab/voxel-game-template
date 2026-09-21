import type { GameConfig } from '../game.config'
import type { HudSnapshot } from '../sim/types'
import type { InputDevice } from '../sim/types'
import type { CaptureStatus } from './play-focus'

export interface HudActions {
  start(device: InputDevice): void
  resume(device: InputDevice): void
  restart(): void
  togglePause(): void
  toggleTimeOfDay(): void
  toggleCamera(): void
  selectSlot(index: number): void
}

export interface HudHandle {
  update(snapshot: HudSnapshot, pointerCaptured: boolean, captureStatus: CaptureStatus): void
  showError(message: string): void
  destroy(): void
}

const CSS = `
  .voxel-ui{position:fixed;inset:0;z-index:25;pointer-events:none;color:#fff;
    font-family:ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif;text-shadow:0 2px 0 #23352f}
  .voxel-ui button{font:inherit;color:inherit;cursor:pointer}
  .v-objective{position:absolute;top:16px;left:50%;transform:translateX(-50%);padding:10px 16px;
    border:2px solid #eddfaa;background:#203b38e8;box-shadow:0 5px 0 #10201d;border-radius:4px;
    letter-spacing:.02em;white-space:nowrap}
  .v-notice{position:absolute;top:70px;left:50%;transform:translateX(-50%);padding:8px 13px;
    border:2px solid #fff0b5;background:#6b4e2ce8;box-shadow:0 4px 0 #342516;border-radius:4px;
    font-size:13px;white-space:nowrap}
  .v-notice[data-kind="discovery"]{background:#31504be8;border-color:#93f2e6}
  .v-notice[data-kind="respawn"]{background:#3d4c67e8;border-color:#dbe9ff}
  .v-notice[data-kind="combat"]{background:#602f35e8;border-color:#ffb0a8}
  .v-health{position:absolute;left:14px;top:14px;padding:8px 11px;border:2px solid #eddfaa;
    background:#203b38e8;border-radius:4px;color:#ff8178;letter-spacing:3px;font-size:19px}
  .v-crosshair{position:absolute;left:50%;top:50%;width:20px;height:20px;transform:translate(-50%,-50%)}
  .v-crosshair:before,.v-crosshair:after{content:"";position:absolute;background:#fff;box-shadow:0 1px 0 #16231f}
  .v-crosshair:before{width:4px;height:20px;left:8px}.v-crosshair:after{width:20px;height:4px;top:8px}
  .v-target{position:absolute;left:50%;top:calc(50% + 22px);transform:translateX(-50%);font-size:12px}
  .v-hotbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:5px}
  .v-slot{position:relative;width:58px;height:58px;pointer-events:auto;border:2px solid #d6c58d;
    border-radius:3px;background:#1c302de8;box-shadow:0 4px 0 #0d1816;display:grid;place-items:center}
  .v-slot.is-selected{border-color:#fff2a8;transform:translateY(-7px);box-shadow:0 7px 0 #765528,0 0 0 2px #fff2a8}
  .v-slot.is-locked{opacity:.43}.v-swatch{width:28px;height:28px;background:var(--swatch);border:2px solid #fff8;
    box-shadow:inset -5px -5px 0 #0002}.v-key{position:absolute;left:4px;top:1px;font-size:10px}
  .v-count{position:absolute;right:4px;bottom:1px;font-size:13px}
  .v-actions{position:absolute;right:14px;top:14px;display:flex;gap:8px;align-items:center}
  .v-pause,.v-time,.v-camera{width:43px;height:43px;pointer-events:auto;border:2px solid #e7d99e;
    background:#203b38e8;border-radius:3px;box-shadow:0 4px 0 #10201d}
  .v-time{font-size:22px;line-height:1}.v-time.is-night{background:#17233de8;color:#dbe9ff}
  .v-camera{font-size:12px;letter-spacing:.04em;background:#31504be8}
  .v-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;
    background:linear-gradient(#18312cb8,#0b1715e8);padding:18px}
  .v-card{width:min(560px,94vw);border:3px solid #e3d39e;background:#203b38f5;box-shadow:0 10px 0 #0d1816;
    padding:clamp(20px,5vw,42px);text-align:center;border-radius:5px}
  .v-card h1{font-size:clamp(29px,7vw,54px);line-height:.94;color:#fff0b5;margin-bottom:15px}
  .v-card p{line-height:1.5;margin:8px auto;max-width:44ch;color:#dcebe1;text-shadow:none}
  .v-card .v-result{font-size:clamp(34px,8vw,60px);color:#93f2e6}
  .v-primary{margin-top:18px;border:2px solid #fff0b5;background:#d37943;padding:12px 22px;
    border-radius:3px;box-shadow:0 5px 0 #793f28;text-transform:uppercase;letter-spacing:.08em}
  .v-hints{position:absolute;left:14px;bottom:14px;padding:8px 10px;background:#10201dbd;border-left:3px solid #e3d39e;
    font-size:11px;line-height:1.45;max-width:220px}
  @media(max-width:700px),(pointer:coarse){.v-objective{top:9px;left:8px;transform:none;font-size:13px}.v-notice{top:61px;font-size:12px}.v-health{left:8px;top:55px;font-size:15px}.v-actions{top:8px;right:8px;gap:7px}
    .v-hotbar{bottom:92px;gap:3px}.v-slot{width:46px;height:46px}.v-swatch{width:22px;height:22px}
    .v-hints{display:none}}
  @media(max-width:390px){.v-slot{width:42px;height:42px}.v-hotbar{bottom:84px}.v-objective{font-size:11px}}
`

const SWATCHES: Record<string, string> = {
  grass: '#72aa51', dirt: '#a56f43', stone: '#8f9590', planks: '#c48a4a',
  wood: '#7a5030', crystal: '#73e9ed',
}

export function createHud(container: HTMLElement, config: GameConfig, actions: HudActions): HudHandle {
  container.innerHTML = `<div class="voxel-ui"><style>${CSS}</style>
    <div class="v-objective"></div><div class="v-notice"></div><div class="v-health"></div><div class="v-crosshair"></div><div class="v-target"></div>
    <div class="v-hotbar"></div><div class="v-actions">
      <button class="v-time" aria-label="Cambiar a modo noche">☾</button>
      <button class="v-camera" aria-label="Cambiar a tercera persona">3P</button>
      <button class="v-pause" aria-label="Pausa">Ⅱ</button></div>
    <div class="v-hints"></div><div class="v-overlay"></div></div>`
  const root = container.firstElementChild as HTMLElement
  const objective = root.querySelector('.v-objective') as HTMLElement
  const notice = root.querySelector('.v-notice') as HTMLElement
  const health = root.querySelector('.v-health') as HTMLElement
  const target = root.querySelector('.v-target') as HTMLElement
  const hotbar = root.querySelector('.v-hotbar') as HTMLElement
  const overlay = root.querySelector('.v-overlay') as HTMLElement
  const hints = root.querySelector('.v-hints') as HTMLElement
  const actionRow = root.querySelector('.v-actions') as HTMLElement
  const crosshair = root.querySelector('.v-crosshair') as HTMLElement
  const timeButton = root.querySelector('.v-time') as HTMLButtonElement
  const cameraButton = root.querySelector('.v-camera') as HTMLButtonElement
  const pauseButton = root.querySelector('.v-pause') as HTMLButtonElement
  let gestureDevice: InputDevice = 'keyboard'
  const rememberGesture = (event: PointerEvent): void => {
    gestureDevice = event.pointerType === 'touch' ? 'touch' : 'keyboard'
  }
  root.addEventListener('pointerdown', rememberGesture)
  const rememberKeyboard = (): void => { gestureDevice = 'keyboard' }
  root.addEventListener('keydown', rememberKeyboard)
  let last = ''

  pauseButton.addEventListener('click', actions.togglePause)
  timeButton.addEventListener('click', actions.toggleTimeOfDay)
  cameraButton.addEventListener('click', actions.toggleCamera)

  function overlayMarkup(snapshot: HudSnapshot, status: CaptureStatus): string {
    if (status === 'studio') return '<div class="v-card"><h1>Pausa</h1><p>Rabbit tiene el juego pausado.</p></div>'
    if (status === 'pending' && snapshot.paused) return '<div class="v-card"><h1>Capturando mouse</h1><p>Esperando al navegador…</p></div>'
    if (snapshot.phase === 'focus') return `<div class="v-card"><h1>${config.session.title}</h1>
      <p>${snapshot.mission
        ? `Misión: <strong>${snapshot.mission.title}</strong>. Explorá, construí y completá el objetivo.`
        : 'Explorá libremente la isla, descubrí lugares y transformá el mundo bloque por bloque.'}</p>
      <p><strong>WASD</strong> mover · <strong>Espacio</strong> saltar · <strong>P</strong> pausa. Click captura el mouse; Escape lo suelta.</p>
      <button class="v-primary" data-start>Entrar al mundo</button></div>`
    if (snapshot.paused) return `<div class="v-card"><h1>Pausa</h1><p>El mundo está congelado.</p>
      <button class="v-primary" data-resume>Continuar</button></div>`
    if (snapshot.phase === 'victory') return `<div class="v-card"><div class="v-result">¡Misión completada!</div>
      <p>${snapshot.mission?.title ?? 'La isla celebra tu aventura.'}</p><button class="v-primary" data-restart>Reiniciar</button></div>`
    if (snapshot.phase === 'defeat') return `<div class="v-card"><div class="v-result">Caíste al vacío</div>
      <p>La seed está intacta. Volvé a intentarlo.</p><button class="v-primary" data-restart>Reintentar</button></div>`
    return ''
  }

  return {
    update(snapshot, pointerCaptured, captureStatus) {
      const signature = JSON.stringify([snapshot, pointerCaptured, captureStatus])
      if (signature === last) return
      last = signature
      objective.textContent = snapshot.mission
        ? `${snapshot.mission.title}: ${snapshot.mission.current}/${snapshot.mission.required}` : ''
      objective.style.display = snapshot.mission ? 'block' : 'none'
      notice.textContent = snapshot.notice?.text ?? ''
      notice.dataset.kind = snapshot.notice?.kind ?? ''
      notice.style.display = snapshot.notice && snapshot.phase === 'playing' && !snapshot.paused ? 'block' : 'none'
      health.textContent = snapshot.health
        ? `${'♥'.repeat(snapshot.health.current)}${'♡'.repeat(snapshot.health.max - snapshot.health.current)}` : ''
      health.style.display = snapshot.health && snapshot.phase === 'playing' ? 'block' : 'none'
      const nextMode = snapshot.timeOfDay === 'day' ? 'noche' : 'día'
      timeButton.textContent = snapshot.timeOfDay === 'day' ? '☾' : '☀'
      timeButton.setAttribute('aria-label', `Cambiar a modo ${nextMode}`)
      timeButton.title = `Cambiar a modo ${nextMode}`
      timeButton.classList.toggle('is-night', snapshot.timeOfDay === 'night')
      const nextCamera = snapshot.cameraMode === 'first-person' ? 'tercera persona' : 'primera persona'
      cameraButton.textContent = snapshot.cameraMode === 'first-person' ? '3P' : '1P'
      cameraButton.setAttribute('aria-label', `Cambiar a ${nextCamera}`)
      cameraButton.title = `Cambiar a ${nextCamera}`
      target.textContent = snapshot.hasTarget ? snapshot.targetLabel : ''
      hotbar.innerHTML = snapshot.slots.map((slot, index) => `<button class="v-slot${slot.selected ? ' is-selected' : ''}${slot.locked ? ' is-locked' : ''}"
        data-slot="${index}" aria-label="${slot.label}"><span class="v-key">${index + 1}</span>
        <span class="v-swatch" style="--swatch:${SWATCHES[slot.key]}"></span><span class="v-count">${slot.count}</span></button>`).join('')
      hotbar.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((button) => {
        button.addEventListener('click', () => actions.selectSlot(Number(button.dataset.slot)))
      })
      hints.textContent = snapshot.device === 'gamepad'
        ? 'Stick izq.: mover · Stick der.: mirar · RT romper · LT colocar · A saltar · Y cámara'
        : pointerCaptured
          ? 'WASD: mover · Mouse: mirar · LMB romper · RMB colocar · V cámara · P pausa · Esc suelta el mouse'
          : 'WASD: mover · Click para capturar el mouse · P pausa'
      const markup = overlayMarkup(snapshot, captureStatus)
      overlay.innerHTML = markup
      overlay.style.display = markup ? 'flex' : 'none'
      overlay.querySelector<HTMLElement>('[data-start]')?.addEventListener('click', () => actions.start(gestureDevice))
      overlay.querySelector<HTMLElement>('[data-resume]')?.addEventListener('click', () => actions.resume(gestureDevice))
      overlay.querySelector<HTMLElement>('[data-restart]')?.addEventListener('click', actions.restart)
      const playing = snapshot.phase === 'playing' && !snapshot.paused
      pauseButton.style.display = snapshot.phase === 'playing' ? 'block' : 'none'
      timeButton.style.display = config.environment.sky.showToggleButton && snapshot.phase === 'playing' ? 'block' : 'none'
      cameraButton.style.display = config.camera.switching.enabled && config.camera.switching.showButton && playing
        ? 'block' : 'none'
      crosshair.style.display = playing ? 'block' : 'none'
    },
    showError(message) {
      objective.style.display = 'none'; notice.style.display = 'none'; health.style.display = 'none'; target.style.display = 'none'; hotbar.style.display = 'none'
      actionRow.style.display = 'none'; crosshair.style.display = 'none'
      hints.style.display = 'none'
      overlay.style.display = 'flex'
      overlay.innerHTML = `<div class="v-card"><h1>No se pudo iniciar</h1><p>${message}</p></div>`
    },
    destroy() {
      root.removeEventListener('pointerdown', rememberGesture)
      root.removeEventListener('keydown', rememberKeyboard)
      container.replaceChildren()
    },
  }
}
