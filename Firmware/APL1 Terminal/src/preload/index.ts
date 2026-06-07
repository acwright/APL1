import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  PortInfo,
  AppSettings,
  SerialStatus,
  PhosphorColor,
  ProgramEntry
} from '../shared/types'
import { IPC } from '../shared/types'

// Re-export types so renderer env.d.ts can import from here
export type { PortInfo, AppSettings, SerialStatus, PhosphorColor, ProgramEntry }

/**
 * The API surface exposed to the renderer via contextBridge.
 * No Node.js APIs are exposed directly — all communication goes through
 * explicitly named IPC channels (contextIsolation: true).
 */
const api = {
  serial: {
    /** List available serial ports. Returns [] until Phase 2. */
    listPorts: (): Promise<PortInfo[]> =>
      ipcRenderer.invoke(IPC.SERIAL_LIST_PORTS),

    /** Open a serial connection to the APL1 at 115200 8N1. */
    connect: (path: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SERIAL_CONNECT, path),

    /** Close the current serial connection. */
    disconnect: (): Promise<void> =>
      ipcRenderer.invoke(IPC.SERIAL_DISCONNECT),

    /**
     * Send raw bytes to the APL1.
     * Caller is responsible for encoding: uppercase + bit7 set for keys.
     */
    send: (data: Uint8Array): Promise<void> =>
      ipcRenderer.invoke(IPC.SERIAL_SEND, data),

    /**
     * Subscribe to incoming serial data from the APL1.
     * Returns an unsubscribe function.
     */
    onData: (callback: (data: Uint8Array) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: Uint8Array): void =>
        callback(data)
      ipcRenderer.on(IPC.SERIAL_DATA, handler)
      return () => ipcRenderer.off(IPC.SERIAL_DATA, handler)
    },

    /**
     * Subscribe to serial connection status changes.
     * Returns an unsubscribe function.
     */
    onStatus: (callback: (status: SerialStatus) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, status: SerialStatus): void =>
        callback(status)
      ipcRenderer.on(IPC.SERIAL_STATUS, handler)
      return () => ipcRenderer.off(IPC.SERIAL_STATUS, handler)
    }
  },

  settings: {
    /** Load persisted settings from disk (falls back to defaults). */
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.SETTINGS_GET),

    /** Persist a partial settings update. */
    set: (partial: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, partial)
  },

  window: {
    /** Toggle between windowed and fullscreen (letterbox) mode. */
    toggleFullscreen: (): Promise<void> =>
      ipcRenderer.invoke(IPC.WINDOW_TOGGLE_FULLSCREEN),

    /** Query current fullscreen state. */
    isFullscreen: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC.WINDOW_IS_FULLSCREEN),

    /**
     * Subscribe to fullscreen state changes (e.g. user pressing Escape).
     * Returns an unsubscribe function.
     */
    onFullscreenChanged: (callback: (isFullscreen: boolean) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: boolean): void =>
        callback(value)
      ipcRenderer.on(IPC.WINDOW_FULLSCREEN_CHANGED, handler)
      return () => ipcRenderer.off(IPC.WINDOW_FULLSCREEN_CHANGED, handler)
    }
  },

  app: {
    /** Application version string from package.json. */
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IPC.APP_GET_VERSION),

    /** Host operating system. */
    platform: process.platform as NodeJS.Platform
  },

  software: {
    /** Load the list of bundled programs from software/manifest.json. */
    getManifest: (): Promise<ProgramEntry[]> =>
      ipcRenderer.invoke(IPC.SOFTWARE_GET_MANIFEST),

    /**
     * Read the raw text content of a bundled program file.
     * `filename` must be a plain filename (no path separators).
     */
    readFile: (filename: string): Promise<string> =>
      ipcRenderer.invoke(IPC.SOFTWARE_READ_FILE, filename)
  }
}

export type AppAPI = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] contextBridge error:', error)
  }
} else {
  // Fallback for non-isolated contexts (development only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).electron = electronAPI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = api
}
