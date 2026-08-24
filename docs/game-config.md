# Configuración del juego

`src/game.config.ts` es la única superficie de tuning. La validación ocurre antes de cargar assets o crear entidades; una combinación inválida presenta un error visible y no anuncia `rabbit:ready`.

## Sesión y jugador

- `session.requiredCrystals` debe coincidir con la cantidad de sockets y nodos de cristal.
- `session.defeatY` es el límite de caída.
- Las dimensiones del cuerpo son metros. `eyeHeight` debe quedar dentro del cuerpo.
- Velocidades usan m/s; aceleración y gravedad usan m/s².
- `coyoteTime` está expresado en segundos.

## Cámara y controles

- `camera.initialMode` acepta `first-person` o `third-person`. Es la receta mínima para cambiar la vista inicial y también la vista restaurada por restart.
- `camera.switching.enabled` habilita el cambio durante gameplay; `showButton` sólo muestra u oculta el control HUD. El sistema sigue disponible mediante `GameHandle.setCameraMode()` aunque la UI esté oculta.
- Cada estrategia posee su propio `fov` y `pitchRange`, expresados en grados. `clipping.near/far` se comparte.
- En tercera persona, `distance` y `height` definen el boom; `collisionRadius`, `collisionPadding`, `minDistance` y `returnSpeed` controlan su colisión y recuperación. El centro de cámara produce el rayo real del crosshair.
- Sensibilidades de mouse/touch son grados por pixel; `padLookSpeed` usa grados por segundo.
- `gamepadDeadZone` pertenece a `[0, 1)`.
- `fallbackDragThreshold` evita interpretar como rotura un clic que se desplazó demasiado; sin pointer lock, mover el cursor sobre el canvas rota la cámara sin mantener un botón.
- `V`, el botón HUD y `Y` de gamepad alternan las vistas cuando switching está habilitado.

## Avatar

- `player.avatar.renderer` acepta `procedural` o `gltf`. No cambia el AABB, la física ni la simulación.
- `procedural` controla proporciones, colores y amplitud/frecuencia de idle, walk y run; usa materiales y entidades reutilizables.
- `gltf.assetKey` debe existir en el manifest condicional de `src/data/assets.ts`. El backend incluido carga `quaterniusHero` y exige `Idle`, `Walk`, `Run`, `Jump`, `Jump_Idle` y `Jump_Land`.
- `scale`, `yOffset` y `rotationY` corrigen la autoría del GLB; `blendTime` controla las transiciones.
- `turnSpeed` orienta el avatar hacia movimiento o una edición exitosa durante `actionFacingTime`.
- La sombra es visual y no agrega collider. Avatar y sombra sólo se renderizan en tercera persona.

## Mundo

- `world.min` y `world.size` definen bounds `[min, min + size)`.
- Cada dimensión debe ser un múltiplo positivo de 16.
- Spawn, sockets y cristales deben ser únicos y estar dentro de bounds.
- La seed controla el value noise determinista. Landmarks se aplican después del terreno.
- `startingInventory` sólo acepta block keys del registro y enteros no negativos.

## Ambiente

- `environment.sky.initialMode` acepta `day` o `night`. Cambiarlo es la receta mínima para que una AI haga arrancar el juego de día o de noche.
- `environment.sky.showToggleButton` muestra u oculta el selector ☾/☀ sin eliminar los presets ni el controlador runtime.
- `environment.sky.presets.day/night` coordina domo, cuerpo celeste, luz, niebla, nubes, terreno y agua. En cada preset `fogStart` debe ser menor que `fogEnd`.
- `environment.sky.stars` controla una única malla nocturna de hasta 96 estrellas; se genera una vez y sólo se activa en modo noche.
- `environment.clouds.layers` admite hasta 16 nubes en total. Cada capa define cantidad, altitud, velocidad y rango de escala.
- `environment.water.lakes` admite múltiples lagos deterministas. El centro usa `[x, yDelBloqueDeAgua, z]`; radios y costa deben caber completamente dentro del mundo y no superponer spawn, faro o cristales.
- `surfaceInset` desplaza la cara superior dentro del bloque para evitar z-fighting. `wadeSpeedMultiplier` sólo afecta velocidad horizontal con agua en los pies.
- Juncos, piedras y partículas son visuales: no tienen colisión ni participan del raycast.
- Límites: 16 nubes, 64 juncos, 32 piedras y 24 partículas.
- `environment.ambience` controla ráfagas procedurales; los intervalos son rangos `[mínimo, máximo]` en segundos.

Las recetas de edición segura y presets están en [`environment-config.md`](environment-config.md).

## Visual, audio y rendimiento

- Colores son strings CSS hex aceptados por PlayCanvas.
- `visual` conserva sólo tintes de caras, selección y sockets; cielo, luz y niebla viven en `environment.sky`.
- Volúmenes pertenecen a `[0, 1]`.
- `maxChunkRebuildsPerFrame` limita picos por edición; el boot siempre construye los 18 chunks.
- `fragmentPoolSize` es fijo y no crece durante la sesión.
- `maxCatchupSteps` limita el catch-up de la simulación fija de 60 Hz.

No son configurables por diseño: tamaño de chunk, paso fijo, layout de arrays, algoritmos de generación/meshing/colisión/DDA/cámara, rutas y filtros de assets, ni lifecycle Rabbit.
