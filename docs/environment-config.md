# Ambiente configurable

`CONFIG.environment` en `src/game.config.ts` es el único contrato público del ambiente. Una AI puede cambiar presets sin conocer PlayCanvas, el mesher o el lifecycle Rabbit. La validación falla antes del boot si un valor excede límites o un lago invade landmarks protegidos.

## Cielo y hora visual

No existe un reloj: la “hora” es un preset coordinado de colores y dirección solar.

- Mañana cálida: subir rojo en `horizon` y `sunColor`, usar niebla clara y un sol bajo (`sunEuler[0]` cercano a 25–35).
- Mediodía: acercar `zenith` a azul, aclarar `ambient` y elevar el sol (`sunEuler[0]` cercano a 55–70).
- Atardecer: horizonte naranja/rosa, zenith más oscuro, ambient desaturado y niebla del mismo matiz.

Usar siempre colores hex de seis dígitos. Mantener `fogStart < fogEnd` y el final por debajo o cerca de `camera.farClip`.

## Mover o agregar lagos

Cada lago se define así:

```ts
{
  id: 'north-pond',
  center: [12, 8, 13],
  radius: [5, 4],
  shoreWidth: 2,
  edgeNoise: 0.12,
}
```

`center[1]` es el voxel de agua; su superficie se renderiza en `y + 1 - surfaceInset`. Elegir un `id` estable: forma parte de la deformación determinista. La costa completa debe caber dentro del mundo y quedar separada de spawn, meseta, faro, sockets y cristales. Para varios lagos, agregar objetos a `water.lakes`; el generador, restauración de agua y decoraciones los detectan automáticamente.

## Desactivar features

Cambiar sólo el `enabled` correspondiente:

```ts
clouds: { enabled: false, ... },
water: { enabled: false, ... },
decorations: {
  reeds: { enabled: false, ... },
  rocks: { enabled: true, ... },
  particles: { enabled: false, ... },
},
ambience: { enabled: false, ... },
```

Los valores siguen validándose aunque una feature esté apagada, de modo que volver a activarla sea seguro. El agua desactivada no se genera ni afecta movimiento; las categorías de decoración conservan toggles propios.

## Densidad y presupuesto

- Nubes: hasta 16 sumando todas las capas; cada capa cuesta un draw call.
- Juncos: hasta 64, combinados en una malla.
- Piedras: hasta 32, combinadas en una malla.
- Partículas: hasta 24 dentro de un único sistema de capacidad fija.
- Agua: usa un material compartido y como máximo un draw call adicional por chunk que contenga caras líquidas.

Para un preset móvil, reducir primero partículas y nubes; después juncos y piedras. No crear entidades por prop ni materiales por lago.

## Preset mínimo

Para conservar sólo cielo y terreno:

```ts
clouds: { enabled: false, seedOffset: 7001, layers: [] },
water: { enabled: false, /* conservar colores/rangos válidos */ lakes: [] },
decorations: {
  reeds: { enabled: false, count: 0, color: '#6d9d4d' },
  rocks: { enabled: false, count: 0, color: '#7b8580' },
  particles: { enabled: false, count: 0, color: '#e8e58c' },
},
ambience: { enabled: false, volume: 0, waterInterval: [5, 9], windInterval: [8, 14] },
```

## Extender el sistema

Una feature nueva implementa internamente `update`, `reset`, `setPaused`, `destroy` y `drawCalls`, y se registra en `FEATURE_FACTORIES`. Sólo su configuración tipada y validada se expone en `game.config.ts`; no se modifica el loop principal. Mantener geometría combinada, capacidad fija, determinismo por seed y recursos reutilizables entre restarts.
