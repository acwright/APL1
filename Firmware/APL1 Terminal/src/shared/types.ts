/**
 * Shared type definitions used by both the main process and renderer.
 * Imported by preload/index.ts and renderer/src/env.d.ts.
 */

export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  locationId?: string
  productId?: string
  vendorId?: string
}

export type PhosphorColor = 'white' | 'amber' | 'green'

export interface AppSettings {
  port: string | null
  phosphorColor: PhosphorColor
  crtEffects: boolean
  scanlines: boolean
  flicker: boolean
  /** Delay in ms between each character when sending a program */
  charDelay: number
  /** Delay in ms between each line when sending a program */
  lineDelay: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  port: null,
  phosphorColor: 'green',
  crtEffects: true,
  scanlines: true,
  flicker: true,
  charDelay: 10,
  lineDelay: 60
}

export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** A single entry from the software manifest. */
export interface ProgramEntry {
  /** Display name shown in the UI dropdown. */
  name: string
  /** Filename inside the `software/` folder (e.g. "hello_world.txt"). */
  filename: string
  /** Optional one-line description shown below the dropdown. */
  description?: string
  /** Wozmon command to run the program after loading (e.g. "0280R"). */
  runCommand?: string
}

/** IPC channel name constants shared between main and preload. */
export const IPC = {
  SERIAL_LIST_PORTS: 'serial:listPorts',
  SERIAL_CONNECT: 'serial:connect',
  SERIAL_DISCONNECT: 'serial:disconnect',
  SERIAL_SEND: 'serial:send',
  SERIAL_DATA: 'serial:data',
  SERIAL_STATUS: 'serial:status',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  APP_GET_VERSION: 'app:getVersion',
  WINDOW_TOGGLE_FULLSCREEN: 'window:toggleFullscreen',
  WINDOW_IS_FULLSCREEN: 'window:isFullscreen',
  WINDOW_FULLSCREEN_CHANGED: 'window:fullscreenChanged',
  SOFTWARE_GET_MANIFEST: 'software:getManifest',
  SOFTWARE_READ_FILE: 'software:readFile'
} as const
