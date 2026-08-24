import type { GameConfig } from '../game.config'
import type { HudSnapshot } from '../sim/types'

export interface HudActions {
  start(): void
  restart(): void
  togglePause(): void
  selectSlot(index: number): void
  capturePointer(): void
}

export interface HudHandle {
  update(snapshot: HudSnapshot, pointerCaptured: boolean): void
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
  .v-pause{position:absolute;right:14px;top:14px;width:43px;height:43px;pointer-events:auto;border:2px solid #e7d99e;
    background:#203b38e8;border-radius:3px;box-shadow:0 4px 0 #10201d}
  .v-capture{position:absolute;top:68px;left:50%;transform:translateX(-50%);pointer-events:auto;
    border:1px solid #ffe9a8;background:#6b4e2cdd;border-radius:3px;padding:7px 10px;font-size:12px}
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
  @media(max-width:700px),(pointer:coarse){.v-objective{top:9px;font-size:13px}.v-pause{top:8px;right:8px}
    .v-hotbar{bottom:92px;gap:3px}.v-slot{width:46px;height:46px}.v-swatch{width:22px;height:22px}
    .v-hints{display:none}.v-capture{display:none}}
  @media(max-width:390px){.v-slot{width:42px;height:42px}.v-hotbar{bottom:84px}.v-objective{font-size:11px}}
`

const SWATCHES: Record<string, string> = {
  grass: '#72aa51', dirt: '#a56f43', stone: '#8f9590', planks: '#c48a4a',
  crystal: '#73e9ed', bedrock: '#353e3d',
}

export function createHud(container: HTMLElement, config: GameConfig, actions: HudActions): HudHandle {
  container.innerHTML = `<div class="voxel-ui"><style>${CSS}</style>
    <div class="v-objective"></div><div class="v-crosshair"></div><div class="v-target"></div>
    <div class="v-hotbar"></div><button class="v-pause" aria-label="Pausa">Ⅱ</button>
    <button class="v-capture">Capturar mouse</button><div class="v-hints"></div><div class="v-overlay"></div></div>`
  const root = container.firstElementChild as HTMLElement
  const objective = root.querySelector('.v-objective') as HTMLElement
  const target = root.querySelector('.v-target') as HTMLElement
  const hotbar = root.querySelector('.v-hotbar') as HTMLElement
  const overlay = root.querySelector('.v-overlay') as HTMLElement
  const hints = root.querySelector('.v-hints') as HTMLElement
  const pauseButton = root.querySelector('.v-pause') as HTMLButtonElement
  const capture = root.querySelector('.v-capture') as HTMLButtonElement
  let last = ''

  pauseButton.addEventListener('click', actions.togglePause)
  capture.addEventListener('click', actions.capturePointer)

  function overlayMarkup(snapshot: HudSnapshot): string {
    if (snapshot.phase === 'focus') return `<div class="v-card"><h1>${config.session.title}</h1>
      <p>Explorá la isla, extraé los tres cristales expuestos y colocalos en los sockets luminosos del faro.</p>
      <p><strong>WASD</strong> mover · <strong>Espacio</strong> saltar · <strong>Click</strong> romper/colocar</p>
      <button class="v-primary" data-start>Entrar al mundo</button></div>`
    if (snapshot.paused) return `<div class="v-card"><h1>Pausa</h1><p>El mundo está congelado.</p>
      <button class="v-primary" data-resume>Continuar</button></div>`
    if (snapshot.phase === 'victory') return `<div class="v-card"><div class="v-result">¡Faro restaurado!</div>
      <p>Los tres cristales vuelven a iluminar la isla.</p><button class="v-primary" data-restart>Reiniciar</button></div>`
    if (snapshot.phase === 'defeat') return `<div class="v-card"><div class="v-result">Caíste al vacío</div>
      <p>La seed está intacta. Volvé a intentarlo.</p><button class="v-primary" data-restart>Reintentar</button></div>`
    return ''
  }

  return {
    update(snapshot, pointerCaptured) {
      const signature = JSON.stringify([snapshot, pointerCaptured])
      if (signature === last) return
      last = signature
      objective.textContent = `Cristales colocados: ${snapshot.placedCrystals}/${snapshot.requiredCrystals}`
      target.textContent = snapshot.hasTarget ? snapshot.targetLabel : ''
      hotbar.innerHTML = snapshot.slots.map((slot, index) => `<button class="v-slot${slot.selected ? ' is-selected' : ''}${slot.locked ? ' is-locked' : ''}"
        data-slot="${index}" aria-label="${slot.label}"><span class="v-key">${index + 1}</span>
        <span class="v-swatch" style="--swatch:${SWATCHES[slot.key]}"></span><span class="v-count">${slot.count}</span></button>`).join('')
      hotbar.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((button) => {
        button.addEventListener('click', () => actions.selectSlot(Number(button.dataset.slot)))
      })
      hints.textContent = snapshot.device === 'gamepad'
        ? 'Stick izq.: mover · Stick der.: mirar · RT romper · LT colocar · A saltar'
        : 'WASD: mover · Mouse: mirar · LMB romper · RMB colocar · 1–6 seleccionar'
      const markup = overlayMarkup(snapshot)
      overlay.innerHTML = markup
      overlay.style.display = markup ? 'flex' : 'none'
      overlay.querySelector<HTMLElement>('[data-start]')?.addEventListener('click', actions.start)
      overlay.querySelector<HTMLElement>('[data-resume]')?.addEventListener('click', actions.togglePause)
      overlay.querySelector<HTMLElement>('[data-restart]')?.addEventListener('click', actions.restart)
      const playing = snapshot.phase === 'playing' && !snapshot.paused
      capture.style.display = playing && snapshot.device === 'keyboard' && !pointerCaptured ? 'block' : 'none'
      pauseButton.style.display = snapshot.phase === 'playing' ? 'block' : 'none'
      root.querySelector<HTMLElement>('.v-crosshair')!.style.display = playing ? 'block' : 'none'
    },
    showError(message) {
      overlay.style.display = 'flex'
      overlay.innerHTML = `<div class="v-card"><h1>No se pudo iniciar</h1><p>${message}</p></div>`
    },
    destroy() { container.replaceChildren() },
  }
}
