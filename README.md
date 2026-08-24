# Rabbit Voxel Lab

![Rabbit Voxel Lab](docs/screenshots/rabbit-voxel-lab.jpg)

Template 3D FPS de construcción por bloques para Rabbit Game Lab, construido con PlayCanvas, Vite y TypeScript estricto. El primer objetivo jugable es recuperar tres cristales expuestos y colocarlos en los sockets luminosos del faro.

## Ejecutar

Requiere Node.js 24 o posterior.

```bash
npm ci
npm run dev
```

Gates de entrega:

```bash
npm run check
npm run build
node ~/.codex/skills/create-rabbit-playcanvas-game/scripts/audit-template.mjs .
```

## Controles

| Dispositivo | Movimiento y cámara | Acciones |
|---|---|---|
| Desktop | WASD, mouse; Shift para sprint | Espacio salta, LMB rompe, RMB coloca, rueda/1–6 selecciona, Esc/P pausa |
| Touch | Joystick izquierdo, drag derecho | Botones de salto, romper y colocar; hotbar tocable |
| Gamepad | Stick izquierdo y derecho | A salta, RT rompe, LT coloca, LB/RB cambia slot, Start pausa |

Si pointer lock no está disponible o es rechazado, un click primario rompe y un drag primario rota la cámara. El click secundario sigue colocando.

## Arquitectura

- `src/game.config.ts`: única superficie pública de tuning.
- `src/data/blocks.ts`: registro de bloques e IDs estables.
- `src/voxel/`: `Uint8Array` por chunk, generación determinista, DDA y face-culling.
- `src/sim/`: jugador cinemático y reglas sin dependencias de PlayCanvas.
- `src/entities/`: escena, una malla por chunk, selección y efectos.
- `src/systems/`: composición, input normalizado, HUD, audio y lifecycle Rabbit.
- `src/rabbit/`: contrato de plataforma protegido.

El mundo mide 48×32×48 y contiene 18 chunks de 16³. Se generan todos antes de `ready`; las ediciones reconstruyen como máximo dos chunks por frame y también invalidan el vecino cuando tocan un borde.

## Asset CC0

V1 usa únicamente `public/assets/textures/blocks-pixel-art.png` de Quaternius. No se incorporan modelos GLB ni un objeto por bloque. Consultá `THIRD_PARTY.md` para provenance.

Una extensión futura con props del pack debe seguir este flujo: seleccionar sólo el asset necesario, convertir glTF a GLB, inspeccionar clips, registrar escala/correcciones/collider y cargarlo opcionalmente después de `ready`.

## Alcance deliberado

No hay mundo infinito, streaming, greedy meshing, crafting, enemigos, líquidos, iluminación voxel, backend, guardado ni multiplayer. Restart y recarga vuelven a generar la seed `1337`. Greedy meshing se evaluará únicamente si mediciones en dispositivos objetivo demuestran que el face-culling actual no alcanza.
