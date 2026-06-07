/**
 * TerminalPainter — draws the 40 × 24 terminal grid onto an HTMLCanvasElement.
 *
 * Rendering strategy:
 *   1. Fill the whole canvas black.
 *   2. Blit each character cell from the pre-built glyph atlas.
 *   3. Overlay a blinking '@' at the cursor position.
 *
 * Repaints are deferred through requestAnimationFrame so multiple buffer
 * mutations in one tick coalesce into a single draw call.
 *
 * The glyph atlas is rebuilt whenever the phosphor colour changes.
 * CRT effects (glow): phosphor glow is implemented via ctx.shadowBlur so the
 * shadow tracks the lit pixels in the transparent atlas glyphs.
 * Scanlines and flicker are CSS overlays in TerminalCanvas.vue (Phase 6).
 */

import { COLS, ROWS, type TerminalBuffer } from './buffer'
import { buildAtlas, CELL_W, CELL_H } from './glyphAtlas'
import type { PhosphorColor } from '../../../shared/types'

export const PHOSPHOR_COLORS: Record<PhosphorColor, string> = {
  green: '#33ff33',
  amber: '#ffb000',
  white: '#e8e8e8',
}

/** ASCII code of the cursor glyph (@ = 0x40). */
const CURSOR_CHAR = 0x40

/** Cursor blink interval in milliseconds (≈ 1 Hz, matching original Apple-1). */
const BLINK_INTERVAL_MS = 530

export class TerminalPainter {
  private atlas: OffscreenCanvas
  private phosphorColor: string = PHOSPHOR_COLORS.green
  private glowEnabled = true
  private blinkOn = true
  private blinkTimer: ReturnType<typeof setInterval> | null = null
  private pendingFrame = 0
  private ctx: CanvasRenderingContext2D

  constructor(
    private canvas: HTMLCanvasElement,
    private buffer: TerminalBuffer
  ) {
    this.ctx = canvas.getContext('2d')!
    this.atlas = buildAtlas(this.phosphorColor)

    this.blinkTimer = setInterval(() => {
      this.blinkOn = !this.blinkOn
      this.requestPaint()
    }, BLINK_INTERVAL_MS)
  }

  /** Enable or disable the phosphor glow (canvas shadowBlur). */
  setGlow(enabled: boolean): void {
    this.glowEnabled = enabled
    this.requestPaint()
  }

  /** Switch phosphor colour; rebuilds the atlas and schedules a repaint. */
  setColor(color: PhosphorColor): void {
    this.phosphorColor = PHOSPHOR_COLORS[color]
    this.atlas = buildAtlas(this.phosphorColor)
    this.requestPaint()
  }

  /**
   * Schedule a repaint on the next animation frame.
   * Multiple calls within the same frame are coalesced into one draw.
   */
  requestPaint(): void {
    if (this.pendingFrame) return
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0
      this._doPaint()
    })
  }

  /** Release the blink timer and cancel any pending frame. */
  destroy(): void {
    if (this.blinkTimer !== null) {
      clearInterval(this.blinkTimer)
      this.blinkTimer = null
    }
    if (this.pendingFrame) {
      cancelAnimationFrame(this.pendingFrame)
      this.pendingFrame = 0
    }
  }

  // ── private ────────────────────────────────────────────────────────────────

  private _doPaint(): void {
    const ctx = this.ctx
    const atlas = this.atlas

    // 1. Black background.
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 2. Phosphor glow: apply canvas shadow so each glyph blit gets a halo.
    //    The atlas glyphs have transparent backgrounds, so the shadow tracks
    //    only the lit pixels in each character cell.
    if (this.glowEnabled) {
      ctx.shadowBlur = 8
      ctx.shadowColor = this.phosphorColor
    } else {
      ctx.shadowBlur = 0
    }

    const { col: cursorCol, row: cursorRow } = this.buffer.cursor

    // 3. Draw each character cell.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let charCode = this.buffer.get(col, row)

        // Overlay the blinking cursor glyph.
        if (col === cursorCol && row === cursorRow && this.blinkOn) {
          charCode = CURSOR_CHAR
        }

        // Clamp to the displayable range; unmapped codes become SPACE.
        if (charCode < 0x20 || charCode > 0x5f) charCode = 0x20
        const charIndex = charCode - 0x20

        ctx.drawImage(
          atlas,
          charIndex * CELL_W, 0, CELL_W, CELL_H,     // source in atlas
          col * CELL_W, row * CELL_H, CELL_W, CELL_H // destination on canvas
        )
      }
    }

    // Reset shadow so it doesn't affect any future 2D operations.
    ctx.shadowBlur = 0
  }
}
