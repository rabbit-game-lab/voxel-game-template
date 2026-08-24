export type AtlasTile = readonly [column: number, row: number]

export interface BlockSpec {
  readonly id: number
  readonly label: string
  readonly solid: boolean
  readonly breakable: boolean
  readonly placeable: boolean
  readonly drop: string | null
  readonly tiles: {
    readonly top: AtlasTile
    readonly side: AtlasTile
    readonly bottom: AtlasTile
  }
}

const tile = (column: number, row: number): AtlasTile => [column, row]
const faces = (all: AtlasTile): BlockSpec['tiles'] => ({ top: all, side: all, bottom: all })

/** Stable registry. IDs are serialized inside chunk arrays and must not be reordered. */
export const BLOCKS = {
  air: {
    id: 0, label: 'Air', solid: false, breakable: false, placeable: false, drop: null,
    tiles: faces(tile(0, 0)),
  },
  grass: {
    id: 1, label: 'Grass', solid: true, breakable: true, placeable: true, drop: 'dirt',
    tiles: { top: tile(0, 3), side: tile(3, 0), bottom: tile(2, 0) },
  },
  dirt: {
    id: 2, label: 'Dirt', solid: true, breakable: true, placeable: true, drop: 'dirt',
    tiles: faces(tile(2, 0)),
  },
  stone: {
    id: 3, label: 'Stone', solid: true, breakable: true, placeable: true, drop: 'stone',
    tiles: faces(tile(2, 1)),
  },
  planks: {
    id: 4, label: 'Planks', solid: true, breakable: true, placeable: true, drop: 'planks',
    tiles: faces(tile(1, 2)),
  },
  crystal: {
    id: 5, label: 'Crystal', solid: true, breakable: true, placeable: true, drop: 'crystal',
    tiles: faces(tile(1, 0)),
  },
  bedrock: {
    id: 6, label: 'Bedrock', solid: true, breakable: false, placeable: false, drop: null,
    tiles: faces(tile(2, 4)),
  },
} as const satisfies Record<string, BlockSpec>

export type BlockKey = keyof typeof BLOCKS
export type BlockId = (typeof BLOCKS)[BlockKey]['id']

const BY_ID: readonly BlockSpec[] = Object.values(BLOCKS).sort((a, b) => a.id - b.id)

export const HOTBAR_BLOCKS = ['grass', 'dirt', 'stone', 'planks', 'crystal', 'bedrock'] as const
export type HotbarBlockKey = (typeof HOTBAR_BLOCKS)[number]

export function blockById(id: number): BlockSpec {
  return BY_ID[id] ?? BLOCKS.air
}

export function blockId(key: BlockKey): BlockId {
  return BLOCKS[key].id
}

export function isBlockKey(value: string): value is BlockKey {
  return value in BLOCKS
}
