/**
 * ByteStreamParser — translates raw bytes from the APL1 serial port into
 * mutations on a TerminalBuffer.
 *
 * Handled sequences (per firmware protocol):
 *   0x20–0x5F  printable ASCII (displayable range) → putChar
 *   0x60–0x7E  fold to uppercase range (& 0x5F) → putChar
 *   0x0D (CR)  → carriageReturn
 *   0x0A (LF)  → newline
 *   ESC [ 2 J  → clear screen
 *   ESC [ ; H  → cursor home (0, 0)
 *
 * All other bytes are silently consumed; bit 7 is stripped before processing
 * because the Apple-1 PIA sets bit 7 on every character it outputs.
 */

import { TerminalBuffer } from './buffer'

const enum State {
  NORMAL,
  ESC,       // received 0x1B
  CSI,       // received ESC [
  CSI_2,     // received ESC [ 2
  CSI_SEMI,  // received ESC [ ;
}

export class ByteStreamParser {
  private state: State = State.NORMAL

  /**
   * @param buffer  The TerminalBuffer to write into.
   * @param onUpdate  Called after each batch of bytes has been processed,
   *                  if the buffer was modified. Use to schedule a repaint.
   */
  constructor(
    private buffer: TerminalBuffer,
    private onUpdate: () => void
  ) {}

  /** Feed a chunk of bytes from the serial port. */
  feed(data: Uint8Array): void {
    this.buffer.dirty = false

    for (let i = 0; i < data.length; i++) {
      this._consume(data[i])
    }

    if (this.buffer.dirty) {
      this.onUpdate()
    }
  }

  // ── private ────────────────────────────────────────────────────────────────

  private _consume(raw: number): void {
    // Strip Apple-1 bit 7 (PIA sets it on all outgoing characters).
    const byte = raw & 0x7f

    switch (this.state) {
      case State.NORMAL:
        if (byte === 0x1b) {
          this.state = State.ESC
        } else if (byte === 0x0d) {
          this.buffer.carriageReturn()
        } else if (byte === 0x0a) {
          this.buffer.newline()
        } else if (byte >= 0x20 && byte <= 0x5f) {
          this.buffer.putChar(byte)
        } else if (byte >= 0x60 && byte <= 0x7e) {
          // Fold lowercase / extended printable to 0x20–0x5F.
          this.buffer.putChar(byte & 0x5f)
        }
        // All other bytes (control chars, etc.) are silently ignored.
        break

      case State.ESC:
        if (byte === 0x5b) {
          // ESC [  → CSI
          this.state = State.CSI
        } else {
          // Unknown escape — abort and re-process this byte as normal.
          this.state = State.NORMAL
          this._consume(raw)
        }
        break

      case State.CSI:
        if (byte === 0x32) {
          // ESC [ 2 …
          this.state = State.CSI_2
        } else if (byte === 0x3b) {
          // ESC [ ; …
          this.state = State.CSI_SEMI
        } else {
          // Unknown CSI sequence — discard and return to normal.
          this.state = State.NORMAL
        }
        break

      case State.CSI_2:
        if (byte === 0x4a) {
          // ESC [ 2 J  → erase display (clear screen)
          this.buffer.clear()
        }
        this.state = State.NORMAL
        break

      case State.CSI_SEMI:
        if (byte === 0x48) {
          // ESC [ ; H  → cursor home
          this.buffer.home()
        }
        this.state = State.NORMAL
        break
    }
  }
}
