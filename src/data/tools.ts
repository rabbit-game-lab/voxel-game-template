/**
 * Minecraft pickaxe tiers. `speed` is the mining-speed multiplier applied to
 * blocks whose preferred tool is the pickaxe; colors tint the pixel-art head.
 * `none` hides the pickaxe and mines with the bare hand.
 */
export const PICKAXE_TIERS = {
  none: { label: 'Mano', speed: 1, head: ['#000000', '#000000', '#000000'] },
  wood: { label: 'Pico de madera', speed: 2, head: ['#b8945f', '#8f6e3e', '#5e4526'] },
  stone: { label: 'Pico de piedra', speed: 4, head: ['#a7a7a7', '#7d7d7d', '#555555'] },
  iron: { label: 'Pico de hierro', speed: 6, head: ['#f2f2f2', '#d0d0d0', '#8f8f8f'] },
  gold: { label: 'Pico de oro', speed: 12, head: ['#fff27a', '#f0c83c', '#b5891c'] },
  diamond: { label: 'Pico de diamante', speed: 8, head: ['#a4fff2', '#4ae3d0', '#1f9c8d'] },
} as const satisfies Record<string, { label: string; speed: number; head: readonly [string, string, string] }>

export type PickaxeTier = keyof typeof PICKAXE_TIERS

export const PICKAXE_HANDLE = ['#9a7143', '#6b4b27'] as const
