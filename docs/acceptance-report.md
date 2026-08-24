# Acceptance report

Evidencia observada el 2026-08-23/24 (America/Argentina/Buenos_Aires).

## Gates automáticos

- `npm ci`: aprobado; lockfile instalado sin modificar dependencias.
- `npm run check`: aprobado.
- `npm run build`: aprobado con Vite 8.1.5. El warning de chunk >1.5 MB corresponde al bundle del motor PlayCanvas.
- `audit-template.mjs`: 24 checks aprobados, 0 warnings.
- `quick_validate.py`: skill `rabbit-voxel-lab-gamedev` válida.
- Preview de producción: boot correcto y consola sin errores/warnings.

La ampliación de ambiente del 2026-08-24 volvió a ejecutar `check`, `build` y la auditoría: 24 checks de contrato, 0 warnings. La build final conserva sólo el warning informativo de tamaño del bundle PlayCanvas.

## Rabbit y lifecycle

- Iframe sandbox sin `allow-same-origin`: `rabbit:ready=1`, `rabbit:error=0`.
- Atlas faltante en iframe opaco: overlay visible, `ready=0`, `error=1`.
- Pausa Studio: el overlay aparece; el botón local Continuar no puede revertirla; resume Studio sí.
- Cinco mensajes `rabbit:restart`: `ready` permanece en 1 y quedan exactamente un HUD, un canvas, un root touch y seis slots.
- Boot directo y production preview: consola limpia.
- Con cielo, agua y ambiente activos, cinco reinicios consecutivos conservaron exactamente 1 canvas, 1 HUD, 1 root touch y 6 slots. Inventario, objetivo y fase volvieron al estado inicial.
- Dos capturas PNG separadas por 1,2 s durante pausa fueron idénticas byte a byte; nubes, partículas y escena quedaron congeladas.

## Gameplay y responsive

- Hover mouse-look verificado en desktop: mover el cursor entre dos puntos del canvas sin botones presionados cambió la orientación de cámara; pointer lock permanece como modo opcional.
- Pointer lock fue rechazado por el browser de prueba; el fallback hover-look mantuvo el control de cámara disponible.
- Cámara y DDA quedaron alineados con el crosshair después de corregir el signo del pitch.
- Break de grass: dirt pasó de 12 a 13 exactamente una vez.
- Place de dirt: dirt volvió de 13 a 12 exactamente una vez y la selección cambió a Dirt.
- Hotbar por click seleccionó Stone; durante pausa un click no alteró inventario.
- Layout inspeccionado en 1920×1080, 844×390 y 390×844.

## Ambiente natural

- Boot final: 10 nubes, 34 juncos, 18 piedras y 18 partículas, con layout determinista para seed `1337`.
- El lago por defecto ocupa 3 chunks líquidos. La inspección desde costa mostró superficie transparente sin z-fighting, laterales completos, juncos combinados y partículas legibles.
- Agua verificada por prueba interna descartable, retirada antes de la entrega:
  - DDA atravesó agua y golpeó el fondo sólido.
  - Colocar/reemplazar una celda natural y restaurarla devolvió `BlockId 7`.
  - La entrada produjo un único `splash`.
  - Velocidad estabilizada: `3,348 m/s` en agua frente a `5,4 m/s` en tierra, razón exacta `0,62`.
  - Una edición líquida en una esquina de chunks invalidó dueño y dos vecinos (`3` chunks dirty).
- El hotbar mantuvo seis slots y no expuso agua.
- Preset mínimo probado con nubes, agua, decoraciones, partículas y ambience desactivados: 0 chunks líquidos, 0 props/partículas y sólo 2 draw calls de cielo/sol.
- Configuración temporal con un segundo lago válido arrancó correctamente y pasó de 3 a 4 draw calls líquidos, sin cambios al compositor.
- `opacity: 1.68` fue rechazado antes del boot con overlay legible `environment.water.opacity must be in (0, 1)`.
- Capturas de revisión realizadas en el browser de aceptación a 1280×720 y 691×807; no se reemplazó el screenshot histórico del README.

## Modo día y noche

- El botón temporal de autoría aparece junto a Pausa sólo durante `playing`: en día muestra `☾` con etiqueta accesible `Cambiar a modo noche`; en noche muestra `☀` y `Cambiar a modo día`.
- La alternancia visual fue verificada en ejecución: gradiente nocturno, luna, estrellas, nubes, niebla, luz, terreno y agua cambian como un preset coordinado; HUD, crosshair y hotbar conservan contraste.
- Las 72 estrellas se combinan en una única malla. El perfil pasó de 7 draw calls ambientales en día a 8 en noche, sin reconstruir chunks ni crear entidades al alternar.
- Una configuración temporal `initialMode: 'night'` + `showToggleButton: false` inició directamente de noche sin renderizar el botón, confirmando la ruta plug-and-play que quedará después de retirar esa UI.
- Restart desde noche restauró el `initialMode` configurado y mantuvo exactamente 1 canvas, 1 HUD y 6 slots, sin duplicar recursos ni listeners.
- Revisión responsive realizada a 1280×720 y 691×807: botón de modo y Pausa no se superponen. La consola permaneció sin errores ni warnings.

## Perfil observado

Muestra de tres segundos en el browser de prueba a viewport 1920×1080:

- 120.0 FPS promedio; peor frame 9.4 ms.
- 18 chunks y 18 draw calls de terreno.
- 14.124 triángulos de terreno.
- Remesh máximo de boot observado: 2.2–2.4 ms (una corrida anterior registró 2.7 ms).

Esto satisface el target desktop de 60 FPS en el entorno probado. No equivale a un benchmark de hardware móvil.

Perfil de la ampliación ambiental en el browser instrumentado:

- 18 chunks, 21 draw calls de terreno (3 líquidos) y 7 de ambiente.
- 14.570 triángulos de terreno/líquido; el ambiente usa geometría combinada y capacidad fija.
- Remesh de boot normal observado: 3,9–4,4 ms; pico de 10,7 ms con ocho tabs WebGL simultáneos.
- El browser instrumentado limitó tanto el preset completo como el mínimo a 30,0 FPS / ~34,3 ms. Como ambos perfiles dieron el mismo límite, esta corrida no permite certificar 60 FPS desktop ni atribuir la limitación al ambiente. Se conserva como evidencia el benchmark desktop previo de 120 FPS del template base.
- La API disponible no expuso una medición fiable de memoria GPU; no se inventa una cifra.

## Rutas no probadas físicamente

- Pointer lock concedido por un navegador externo.
- Multitouch real simultáneo (joystick + look + acción) y `pointercancel` de hardware.
- Gamepad físico, desconexión y reconexión.
- Rendimiento en un teléfono móvil medio.
- Rendimiento de la ampliación ambiental en desktop sin el cap de 30 FPS del browser instrumentado.
- Recorrido humano completo de los tres cristales hasta victoria, caída al vacío y edición manual de un borde de chunk.

La cobertura estructural de estas rutas está implementada y pasó tipos/audit, pero no se las marca como aceptadas sin hardware o recorrido manual real.
