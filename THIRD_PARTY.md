# Third-party assets

## Quaternius — Cube World Kit

- Autor: Quaternius
- Fuente: https://quaternius.com/packs/cubeworldkit.html
- Archivo original usado: `Blocks_PixelArt.png`
- Archivo distribuido: `public/assets/textures/blocks-pixel-art.png`
- Licencia: CC0 1.0 Universal / dominio público
- Cambios: renombrado del archivo para una ruta web estable; el contenido visual no fue modificado.

### Personaje opcional

- Archivo original usado: `Character_Male_2.gltf` autocontenido.
- Archivo distribuido: `public/assets/models/quaternius-character-male-2.glb`.
- Clips registrados: `Idle`, `Walk`, `Run`, `Jump`, `Jump_Idle` y `Jump_Land`.
- Conversión: el JSON glTF y su buffer base64 embebido se empaquetaron sin alterar mallas, textura, rig o animaciones mediante `scripts/convert-embedded-gltf.mjs`.
- Uso: backend opcional de tercera persona; sólo se carga en boot cuando `player.avatar.renderer` vale `gltf`.

No se distribuyen los otros 107 modelos del pack.
