/**
 * settings.ts — Phase 2
 * Persists AppSettings to <userData>/settings.json via synchronous JSON I/O.
 */

import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

export class SettingsService {
  private readonly filePath: string
  private cache: AppSettings

  constructor() {
    const userDataDir = app.getPath('userData')
    // Ensure the directory exists (it usually does, but guard anyway)
    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true })
    }
    this.filePath = join(userDataDir, 'settings.json')
    this.cache = this.load()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get(): AppSettings {
    return { ...this.cache }
  }

  set(partial: Partial<AppSettings>): void {
    this.cache = { ...this.cache, ...partial }
    this.save()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private load(): AppSettings {
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      // Merge with defaults so new keys added in future versions get their defaults
      return { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      // File doesn't exist or is corrupt — start fresh
      return { ...DEFAULT_SETTINGS }
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8')
    } catch (err) {
      console.error('[settings] failed to save:', err)
    }
  }
}
