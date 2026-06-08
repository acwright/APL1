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
 * Extra transparent margin baked around each atlas cell so a pre-rendered
 * phosphor glow has room to bleed without spilling into neighbouring atlas
 * cells.  Must be ≥ the glow blur radius used in buildAtlas().
 */
export const GLOW_PAD = 8

/** Phosphor glow blur radius baked into the atlas (canvas shadowBlur). */
export const GLOW_BLUR = 8

/** Padded source-cell dimensions inside the atlas (glyph cell + glow margin). */
export const ATLAS_CELL_W = CELL_W + GLOW_PAD * 2
export const ATLAS_CELL_H = CELL_H + GLOW_PAD * 2

/**
 * Build a fresh OffscreenCanvas atlas for the given CSS colour string.
 * Re-call whenever the phosphor colour or glow setting changes.
 *
 * Each glyph is rendered into a padded cell (ATLAS_CELL_W × ATLAS_CELL_H).
 * When `glow` is true the phosphor halo is baked in via shadowBlur **once**
 * per glyph here, so the painter can blit cells with plain drawImage() calls
 * (no per-blit shadow) and keep frame times consistent during heavy output.
 */
export function buildAtlas(color: string, glow = true): OffscreenCanvas {
  const atlas = new OffscreenCanvas(64 * ATLAS_CELL_W, ATLAS_CELL_H)
  const ctx = atlas.getContext('2d')!

  ctx.fillStyle = color
  if (glow) {
    ctx.shadowColor = color
    ctx.shadowBlur = GLOW_BLUR
  }

  for (let i = 0; i < 64; i++) {
    const glyph = ROM_GLYPHS[i]
    // Glyph content is offset by the glow margin + the in-cell centring pad.
    const xBase = i * ATLAS_CELL_W + GLOW_PAD + CELL_PAD_X
    const yBase = GLOW_PAD + CELL_PAD_Y

    for (let row = 0; row < GLYPH_H; row++) {
      const bits = glyph[row]
      for (let col = 0; col < GLYPH_W; col++) {
        // Bit 4 is leftmost column (col 0), bit 0 is rightmost (col 4).
        if (bits & (0x10 >> col)) {
          ctx.fillRect(
            xBase + col * PIXEL_SIZE,
            yBase + row * PIXEL_SIZE,
            PIXEL_SIZE,
            PIXEL_SIZE
          )
        }
      }
    }
  }

  return atlas
}
