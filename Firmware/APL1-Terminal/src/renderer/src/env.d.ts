/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'
import type { AppAPI } from '../../preload/index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
