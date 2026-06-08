/**
 * serial.ts — Phase 2
 * SerialService: manages a single serial connection to the APL1 at 115200 8N1.
 * Runs entirely in the main process; data/status pushed to renderer via IPC.
 */

import { BrowserWindow } from 'electron'
import { SerialPort } from 'serialport'
import type { PortInfo, SerialStatus } from '../shared/types'
import { IPC } from '../shared/types'

export class SerialService {
  private port: SerialPort | null = null
  private status: SerialStatus = 'disconnected'

  // ---------------------------------------------------------------------------
  // Port discovery
  // ---------------------------------------------------------------------------

  async listPorts(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      pnpId: p.pnpId,
      locationId: p.locationId,
      productId: p.productId,
      vendorId: p.vendorId
    }))
  }

  // ---------------------------------------------------------------------------
  // Connect / Disconnect
  // ---------------------------------------------------------------------------

  async connect(path: string, window: BrowserWindow): Promise<void> {
    if (this.port?.isOpen) {
      await this.disconnect(window)
    }

    this.setStatus('connecting', window)

    return new Promise<void>((resolve, reject) => {
      const sp = new SerialPort({
        path,
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      })

      sp.open((err) => {
        if (err) {
          this.setStatus('error', window)
          reject(err)
          return
        }

        this.port = sp
        this.setStatus('connected', window)

        // Forward incoming bytes to renderer as Uint8Array
        sp.on('data', (chunk: Buffer) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC.SERIAL_DATA, new Uint8Array(chunk))
          }
        })

        sp.on('error', (err) => {
          console.error('[serial] port error:', err)
          this.setStatus('error', window)
        })

        sp.on('close', () => {
          this.port = null
          this.setStatus('disconnected', window)
        })

        resolve()
      })
    })
  }

  async disconnect(window: BrowserWindow): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      this.port = null
      this.setStatus('disconnected', window)
      return
    }

    return new Promise<void>((resolve) => {
      this.port!.close((err) => {
        if (err) console.warn('[serial] close error:', err)
        this.port = null
        this.setStatus('disconnected', window)
        resolve()
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  send(data: Uint8Array): void {
    if (!this.port?.isOpen) {
      console.warn('[serial] send called but port is not open')
      return
    }
    this.port.write(Buffer.from(data), (err) => {
      if (err) console.error('[serial] write error:', err)
    })
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  getStatus(): SerialStatus {
    return this.status
  }

  isConnected(): boolean {
    return this.status === 'connected' && (this.port?.isOpen ?? false)
  }

  private setStatus(status: SerialStatus, window: BrowserWindow): void {
    this.status = status
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.SERIAL_STATUS, status)
    }
  }
}
