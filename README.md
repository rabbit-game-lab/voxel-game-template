# Rabbit Voxel Lab

![Rabbit Voxel Lab](docs/screenshots/rabbit-voxel-lab.jpg)

Template 3D de construcción por bloques para Rabbit Game Lab, construido con PlayCanvas, Vite y TypeScript estricto. Incluye vistas FPS y tercera persona, un explorador voxel visible y un sandbox procedural con misiones intercambiables.

La isla `64×32×64` incluye un ambiente enteramente procedural: bosque mixto editable, troncos, flores, juncos, carteles, fogata, ruina, mirador, recogibles y descubrimientos, además de día/noche, nubes, lago, audio ambiental y un catálogo plug-and-play de animales, enemigos y personajes. No requiere assets ambientales ni dependencias adicionales. Las decoraciones pequeñas pueden picarse y desaparecen si se rompe el bloque sólido que las sostiene, sin dejar de usar mallas combinadas.

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
| Desktop | WASD; mouse capturado rota la cámara; Shift para sprint | Espacio salta, LMB rompe, RMB coloca, V cambia cámara, rueda/1–6 selecciona, Esc/P pausa |
| Touch | Joystick izquierdo, drag derecho | Botones de salto, romper, colocar y cámara; hotbar tocable |
| Gamepad | Stick izquierdo y derecho | A salta, Y cambia cámara, RT rompe, LT coloca, LB/RB cambia slot, Start pausa |

Con mouse, entrar y continuar requieren pointer lock para giros ilimitados. Un solo Escape libera el cursor y pausa inmediatamente; Continuar recupera la captura antes de reanudar. Si el navegador rechaza la captura, el juego permanece detenido y permite reintentar. Touch y gamepad no requieren captura. LMB rompe y RMB coloca.

## Arquitectura

- `src/game.config.ts`: única superficie pública de tuning.
- `src/camera/`: contrato público de cámaras y avatar.
- `src/data/blocks.ts`: registro de bloques e IDs estables.
- `src/voxel/`: `Uint8Array` por chunk, generación determinista, DDA y face-culling.
- `src/environment/`: contrato tipado y reglas deterministas de lagos.
- `src/content/`: presets tipados, placement determinista y archetypes voxel.
- `src/creatures/`: catálogo, aliases, presets y placement determinista de criaturas.
- `src/sim/`: jugador cinemático y reglas sin dependencias de PlayCanvas.
- `src/entities/`: escena, cámaras, avatares, mallas de chunks y contenido combinado, ambiente, selección y efectos.
- `src/systems/`: composición, input normalizado, HUD, audio y lifecycle Rabbit.
- `src/rabbit/`: contrato de plataforma protegido.

El mundo mide 64×32×64 y contiene 32 chunks de 16³. Se generan todos antes de `ready`; las ediciones reconstruyen como máximo dos chunks por frame y también invalidan el vecino cuando tocan un borde. El agua usa una capa transparente compartida: no tiene física de fluidos, no bloquea el DDA y se restaura de forma determinista cuando se rompe un bloque colocado dentro del lago.

## Tuning para AI

`CONFIG.camera` concentra modo inicial, selector, FOV, sensibilidad y cámara de seguimiento; `CONFIG.player.avatar` elige el explorador procedural o el GLB de Quaternius. Para arrancar en tercera persona basta cambiar `camera.initialMode` a `third-person`; la UI puede ocultarse con `camera.switching.showButton: false` sin retirar el sistema.

`CONFIG.environment` concentra los presets `day/night`, estrellas, nubes, lagos, partículas y audio. `CONFIG.content.preset` alterna entre `forest` y `minimal`; `CONFIG.creatures.preset` elige `empty`, `peacefulForest` o `forestAdventure`; `CONFIG.mission.active` elige `none`, `beacon` o `collect`. El selector día/noche está oculto por defecto. Las recetas están en [`docs/game-config.md`](docs/game-config.md), [`docs/environment-config.md`](docs/environment-config.md), [`docs/content-config.md`](docs/content-config.md) y [`docs/creature-config.md`](docs/creature-config.md).

## Asset CC0

El terreno usa `public/assets/textures/blocks-pixel-art.png`. También se distribuye `public/assets/models/quaternius-character-male-2.glb` como backend de avatar opcional: sólo es boot-critical cuando `player.avatar.renderer` vale `gltf`. Ambos provienen del Cube World Kit CC0 de Quaternius. Consultá `THIRD_PARTY.md` para provenance.

Una extensión futura con props del pack debe seguir este flujo: seleccionar sólo el asset necesario, convertir glTF a GLB, inspeccionar clips, registrar escala/correcciones/collider y cargarlo opcionalmente después de `ready`.

## Alcance deliberado

No hay mundo infinito, streaming, greedy meshing, crafting, combate a distancia, monturas, domesticación, crianza, natación, simulación de fluidos, iluminación voxel, backend, guardado ni multiplayer. Caer produce respawn sin perder el sandbox; restart y recarga vuelven a generar la seed `1337`. Greedy meshing se evaluará únicamente si mediciones en dispositivos objetivo demuestran que el face-culling actual no alcanza.
