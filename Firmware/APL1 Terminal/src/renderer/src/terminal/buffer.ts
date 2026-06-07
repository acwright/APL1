/**
 * TerminalBuffer — 40 × 24 character grid.
 *
 * Stores the visible screen state as raw character codes (0x20–0x5F).
 * The cursor position is tracked separately and is NOT stored in the grid;
 * the painter overlays the blinking '@' cursor at paint time.
 *
 * Scroll behaviour: when the cursor moves past row 23, the whole grid scrolls
 * up by one line and the cursor stays on row 23.
 */

export const COLS = 40
export const ROWS = 24

export class TerminalBuffer {
  /** Row-major grid: cells[row * COLS + col] holds the ASCII char code. */
  private cells: Uint8Array

  /** Current cursor column (0-based). */
  cursor: { col: number; row: number }

  /** Set to true whenever the buffer contents change. */
  dirty = false

  constructor() {
    this.cells = new Uint8Array(COLS * ROWS).fill(0x20)
    this.cursor = { col: 0, row: 0 }
  }

  /** Read the character code at position (col, row). */
  get(col: number, row: number): number {
    return this.cells[row * COLS + col]
  }

  /** Write a character code at position (col, row) without moving the cursor. */
  set(col: number, row: number, ch: number): void {
    this.cells[row * COLS + col] = ch
    this.dirty = true
  }

  /**
   * Write a printable character at the cursor, then advance the cursor.
   * Wraps to the next line at column 40, scrolling if needed.
   */
  putChar(ch: number): void {
    this.set(this.cursor.col, this.cursor.row, ch)
    this.cursor.col++
    if (this.cursor.col >= COLS) {
      this.cursor.col = 0
      this._advanceRow()
    }
    this.dirty = true
  }

  /** Move cursor to column 0 (bare CR). */
  carriageReturn(): void {
    this.cursor.col = 0
    this.dirty = true
  }

  /** Advance cursor to the next row, scrolling if at the bottom. */
  newline(): void {
    this._advanceRow()
    this.dirty = true
  }

  /** Clear the entire grid to spaces and move cursor to (0, 0). */
  clear(): void {
    this.cells.fill(0x20)
    this.cursor = { col: 0, row: 0 }
    this.dirty = true
  }

  /** Move cursor to home position (0, 0) without clearing. */
  home(): void {
    this.cursor = { col: 0, row: 0 }
    this.dirty = true
  }

  // ── private ────────────────────────────────────────────────────────────────

  private _advanceRow(): void {
    this.cursor.row++
    if (this.cursor.row >= ROWS) {
      this._scrollUp()
      this.cursor.row = ROWS - 1
    }
  }

  /** Scroll the entire grid up by one line; fill the new bottom row with spaces. */
  private _scrollUp(): void {
    // Shift all rows up: row 0 is discarded, rows 1..23 become rows 0..22.
    this.cells.copyWithin(0, COLS)
    // Clear the new bottom row.
    this.cells.fill(0x20, (ROWS - 1) * COLS, ROWS * COLS)
  }
}
