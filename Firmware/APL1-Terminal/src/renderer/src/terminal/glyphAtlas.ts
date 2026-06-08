/**
 * Glyph atlas builder for the 2513 character ROM.
 *
 * Renders all 64 printable characters (ASCII 0x20–0x5F) into a single
 * OffscreenCanvas row so the painter can blit individual glyphs with one
 * drawImage() call per cell.
 *
 * Layout (atlas): [char0 | char1 | … | char63]
 *   width  = 64 × CELL_W
 *   height = CELL_H
 *
 * Each glyph is scaled: every ROM pixel becomes a PIXEL_SIZE × PIXEL_SIZE
 * block, centred inside the cell with CELL_PAD_X / CELL_PAD_Y padding.
 */

import { ROM_GLYPHS } from '../assets/signetics2513'

/** ROM pixel dimensions (Signetics 2513: 5 wide × 7 tall). */
export const GLYPH_W = 5
export const GLYPH_H = 7

/** Each ROM pixel is rendered as a PIXEL_SIZE × PIXEL_SIZE square. */
export const PIXEL_SIZE = 4

/** Pixel padding inside each cell (centres the scaled glyph). */
export const CELL_PAD_X = 2
export const CELL_PAD_Y = 2

/** Physical canvas pixels per character cell. */
export const CELL_W = GLYPH_W * PIXEL_SIZE + CELL_PAD_X * 2 // 24
export const CELL_H = GLYPH_H * PIXEL_SIZE + CELL_PAD_Y * 2 // 32

/** Total canvas dimensions for a 40 × 24 terminal. */
export const CANVAS_W = 40 * CELL_W // 960
export const CANVAS_H = 24 * CELL_H // 768

/**
 * Build a fresh OffscreenCanvas atlas for the given CSS colour string.
 * Re-call whenever the phosphor colour changes.
 */
export function buildAtlas(color: string): OffscreenCanvas {
  const atlas = new OffscreenCanvas(64 * CELL_W, CELL_H)
  const ctx = atlas.getContext('2d')!

  ctx.fillStyle = color

  for (let i = 0; i < 64; i++) {
    const glyph = ROM_GLYPHS[i]
    const xBase = i * CELL_W + CELL_PAD_X

    for (let row = 0; row < GLYPH_H; row++) {
      const bits = glyph[row]
      for (let col = 0; col < GLYPH_W; col++) {
        // Bit 4 is leftmost column (col 0), bit 0 is rightmost (col 4).
        if (bits & (0x10 >> col)) {
          ctx.fillRect(
            xBase + col * PIXEL_SIZE,
            CELL_PAD_Y + row * PIXEL_SIZE,
            PIXEL_SIZE,
            PIXEL_SIZE
          )
        }
      }
    }
  }

  return atlas
}
