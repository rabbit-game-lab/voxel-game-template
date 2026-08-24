import { readFileSync, writeFileSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node scripts/convert-embedded-gltf.mjs input.gltf output.glb')

const document = JSON.parse(readFileSync(input, 'utf8'))
const buffers = document.buffers
if (!Array.isArray(buffers) || buffers.length !== 1) {
  throw new Error('Expected exactly one embedded glTF buffer')
}
const uri = buffers[0].uri
const match = typeof uri === 'string' ? /^data:[^,]*;base64,(.+)$/s.exec(uri) : null
if (!match) throw new Error('Expected a base64-embedded glTF buffer')

const binary = Buffer.from(match[1], 'base64')
delete buffers[0].uri
buffers[0].byteLength = binary.length

const json = Buffer.from(JSON.stringify(document))
const jsonPadding = (4 - json.length % 4) % 4
const binaryPadding = (4 - binary.length % 4) % 4
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)])
const binaryChunk = Buffer.concat([binary, Buffer.alloc(binaryPadding)])
const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length
const glb = Buffer.alloc(totalLength)

glb.writeUInt32LE(0x46546c67, 0)
glb.writeUInt32LE(2, 4)
glb.writeUInt32LE(totalLength, 8)
glb.writeUInt32LE(jsonChunk.length, 12)
glb.writeUInt32LE(0x4e4f534a, 16)
jsonChunk.copy(glb, 20)
const binaryHeader = 20 + jsonChunk.length
glb.writeUInt32LE(binaryChunk.length, binaryHeader)
glb.writeUInt32LE(0x004e4942, binaryHeader + 4)
binaryChunk.copy(glb, binaryHeader + 8)
writeFileSync(output, glb)
