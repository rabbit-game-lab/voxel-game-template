# Rabbit Voxel Lab

![Rabbit Voxel Lab](docs/screenshots/rabbit-voxel-lab.jpg)

Template 3D FPS de construcción por bloques para Rabbit Game Lab, construido con PlayCanvas, Vite y TypeScript estricto. El primer objetivo jugable es recuperar tres cristales expuestos y colocarlos en los sockets luminosos del faro.

La isla incluye un ambiente natural enteramente procedural: presets coordinados de día/noche, sol, luna y estrellas, dos capas de nubes voxel, un lago orgánico transitable, costa con juncos y piedras, partículas y audio suave de viento/agua. No requiere assets ambientales ni dependencias adicionales.

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
| Desktop | WASD; mover el cursor rota la cámara; Shift para sprint | Espacio salta, LMB rompe, RMB coloca, rueda/1–6 selecciona, ☾/☀ cambia día/noche, Esc/P pausa |
| Touch | Joystick izquierdo, drag derecho | Botones de salto, romper y colocar; hotbar y selector día/noche tocables |
| Gamepad | Stick izquierdo y derecho | A salta, RT rompe, LT coloca, LB/RB cambia slot, Start pausa |

Sin pointer lock, mover el cursor sobre el canvas rota la cámara sin mantener ningún botón. El pointer lock queda disponible como modo opcional para giros ilimitados; LMB rompe y RMB coloca en ambos modos.

## Arquitectura

- `src/game.config.ts`: única superficie pública de tuning.
- `src/data/blocks.ts`: registro de bloques e IDs estables.
- `src/voxel/`: `Uint8Array` por chunk, generación determinista, DDA y face-culling.
- `src/environment/`: contrato tipado y reglas deterministas de lagos.
- `src/sim/`: jugador cinemático y reglas sin dependencias de PlayCanvas.
- `src/entities/`: escena, mallas opaca/líquida por chunk, ambiente, selección y efectos.
- `src/systems/`: composición, input normalizado, HUD, audio y lifecycle Rabbit.
- `src/rabbit/`: contrato de plataforma protegido.

El mundo mide 48×32×48 y contiene 18 chunks de 16³. Se generan todos antes de `ready`; las ediciones reconstruyen como máximo dos chunks por frame y también invalidan el vecino cuando tocan un borde. El agua usa una capa transparente compartida: no tiene física de fluidos, no bloquea el DDA y se restaura de forma determinista cuando se rompe un bloque colocado dentro del lago.

## Tuning para AI

`CONFIG.environment` concentra los presets `day/night`, modo inicial, visibilidad del botón temporal, estrellas, nubes, lagos, densidades de costa, partículas y audio. Para arrancar siempre de noche basta cambiar `environment.sky.initialMode` a `night`; el botón se retira con `showToggleButton: false` sin borrar el sistema. Las recetas plug-and-play están en [`docs/environment-config.md`](docs/environment-config.md).

## Asset CC0

V1 usa únicamente `public/assets/textures/blocks-pixel-art.png` de Quaternius. No se incorporan modelos GLB ni un objeto por bloque. Consultá `THIRD_PARTY.md` para provenance.

Una extensión futura con props del pack debe seguir este flujo: seleccionar sólo el asset necesario, convertir glTF a GLB, inspeccionar clips, registrar escala/correcciones/collider y cargarlo opcionalmente después de `ready`.

## Alcance deliberado

No hay mundo infinito, streaming, greedy meshing, crafting, enemigos, natación, simulación de fluidos, iluminación voxel, backend, guardado ni multiplayer. Restart y recarga vuelven a generar la seed `1337`. Greedy meshing se evaluará únicamente si mediciones en dispositivos objetivo demuestran que el face-culling actual no alcanza.
