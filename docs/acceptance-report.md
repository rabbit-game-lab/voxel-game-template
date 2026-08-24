# Acceptance report

Evidencia observada el 2026-08-23/24 (America/Argentina/Buenos_Aires).

## Gates automáticos

- `npm ci`: aprobado; lockfile instalado sin modificar dependencias.
- `npm run check`: aprobado.
- `npm run build`: aprobado con Vite 8.1.5. El warning de chunk >1.5 MB corresponde al bundle del motor PlayCanvas.
- `audit-template.mjs`: 24 checks aprobados, 0 warnings.
- `quick_validate.py`: skill `rabbit-voxel-lab-gamedev` válida.
- Preview de producción: boot correcto y consola sin errores/warnings.

## Rabbit y lifecycle

- Iframe sandbox sin `allow-same-origin`: `rabbit:ready=1`, `rabbit:error=0`.
- Atlas faltante en iframe opaco: overlay visible, `ready=0`, `error=1`.
- Pausa Studio: el overlay aparece; el botón local Continuar no puede revertirla; resume Studio sí.
- Cinco mensajes `rabbit:restart`: `ready` permanece en 1 y quedan exactamente un HUD, un canvas, un root touch y seis slots.
- Boot directo y production preview: consola limpia.

## Gameplay y responsive

- Pointer lock fue rechazado por el browser de prueba; el fallback drag-look rotó la cámara.
- Cámara y DDA quedaron alineados con el crosshair después de corregir el signo del pitch.
- Break de grass: dirt pasó de 12 a 13 exactamente una vez.
- Place de dirt: dirt volvió de 13 a 12 exactamente una vez y la selección cambió a Dirt.
- Hotbar por click seleccionó Stone; durante pausa un click no alteró inventario.
- Layout inspeccionado en 1920×1080, 844×390 y 390×844.

## Perfil observado

Muestra de tres segundos en el browser de prueba a viewport 1920×1080:

- 120.0 FPS promedio; peor frame 9.4 ms.
- 18 chunks y 18 draw calls de terreno.
- 14.124 triángulos de terreno.
- Remesh máximo de boot observado: 2.2–2.4 ms (una corrida anterior registró 2.7 ms).

Esto satisface el target desktop de 60 FPS en el entorno probado. No equivale a un benchmark de hardware móvil.

## Rutas no probadas físicamente

- Pointer lock concedido por un navegador externo.
- Multitouch real simultáneo (joystick + look + acción) y `pointercancel` de hardware.
- Gamepad físico, desconexión y reconexión.
- Rendimiento en un teléfono móvil medio.
- Recorrido humano completo de los tres cristales hasta victoria, caída al vacío y edición manual de un borde de chunk.

La cobertura estructural de estas rutas está implementada y pasó tipos/audit, pero no se las marca como aceptadas sin hardware o recorrido manual real.
