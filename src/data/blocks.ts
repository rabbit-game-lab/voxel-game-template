export type AtlasTile = readonly [column: number, row: number]

export interface BlockSpec {
  readonly id: number
  readonly label: string
  readonly solid: boolean
  readonly renderLayer: 'hidden' | 'opaque' | 'liquid'
  readonly raycastable: boolean
  readonly replaceable: boolean
  readonly occludesFaces: boolean
  readonly breakable: boolean
  readonly placeable: boolean
  readonly drop: string | null
  /** Minecraft-style hardness: seconds to break by hand ≈ hardness × 1.5. */
  readonly hardness: number
  /** Tool that speeds up breaking; any other tool (or the hand) mines at base speed. */
  readonly tool: 'pickaxe' | null
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
    hardness: 0, tool: null,
    renderLayer: 'hidden', raycastable: false, replaceable: true, occludesFaces: false,
    tiles: faces(tile(0, 0)),
  },
  grass: {
    id: 1, label: 'Grass', solid: true, breakable: true, placeable: true, drop: 'dirt',
    hardness: 0.6, tool: null,
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: { top: tile(0, 3), side: tile(3, 0), bottom: tile(2, 0) },
  },
  dirt: {
    id: 2, label: 'Dirt', solid: true, breakable: true, placeable: true, drop: 'dirt',
    hardness: 0.5, tool: null,
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: faces(tile(2, 0)),
  },
  stone: {
    id: 3, label: 'Stone', solid: true, breakable: true, placeable: true, drop: 'stone',
    hardness: 1.5, tool: 'pickaxe',
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: faces(tile(2, 1)),
  },
  planks: {
    id: 4, label: 'Planks', solid: true, breakable: true, placeable: true, drop: 'planks',
    hardness: 2, tool: null,
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: faces(tile(1, 2)),
  },
  crystal: {
    id: 5, label: 'Crystal', solid: true, breakable: true, placeable: true, drop: 'crystal',
    hardness: 3, tool: 'pickaxe',
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: faces(tile(1, 0)),
  },
  bedrock: {
    id: 6, label: 'Bedrock', solid: true, breakable: false, placeable: false, drop: null,
    hardness: 0, tool: null,
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: faces(tile(2, 4)),
  },
  water: {
    id: 7, label: 'Water', solid: false, breakable: false, placeable: false, drop: null,
    hardness: 0, tool: null,
    renderLayer: 'liquid', raycastable: false, replaceable: true, occludesFaces: false,
    tiles: faces(tile(0, 0)),
  },
  wood: {
    id: 8, label: 'Wood', solid: true, breakable: true, placeable: true, drop: 'wood',
    hardness: 2, tool: null,
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: { top: tile(1, 4), side: tile(0, 2), bottom: tile(1, 4) },
  },
  leaves: {
    id: 9, label: 'Leaves', solid: true, breakable: true, placeable: false, drop: null,
    hardness: 0.2, tool: null,
    renderLayer: 'opaque', raycastable: true, replaceable: false, occludesFaces: true,
    tiles: faces(tile(1, 3)),
  },
} as const satisfies Record<string, BlockSpec>

export type BlockKey = keyof typeof BLOCKS
export type BlockId = (typeof BLOCKS)[BlockKey]['id']

const BY_ID: readonly BlockSpec[] = Object.values(BLOCKS).sort((a, b) => a.id - b.id)

export const HOTBAR_BLOCKS = ['grass', 'dirt', 'stone', 'planks', 'wood', 'crystal'] as const
export type HotbarBlockKey = (typeof HOTBAR_BLOCKS)[number]

export function blockById(id: number): BlockSpec {
  return BY_ID[id] ?? BLOCKS.air
}

export function blockId(key: BlockKey): BlockId {
  return BLOCKS[key].id
}

export function blockKeyById(id: number): BlockKey {
  return (Object.keys(BLOCKS) as BlockKey[]).find((key) => BLOCKS[key].id === id) ?? 'air'
}

export function isBlockKey(value: string): value is BlockKey {
  return value in BLOCKS
}
