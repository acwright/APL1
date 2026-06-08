<!--
  App.vue — Phase 6
  MonitorFrame wraps the TerminalCanvas with the Sanyo bezel skin.
  Full settings (incl. CRT effects) are now tracked and forwarded.
-->
<template>
  <div class="app" @keydown.escape="onEscape" tabindex="-1" :style="{ '--phosphor': phosphorHex }">
    <!-- Monitor bezel housing + control panel (Phase 6) -->
    <MonitorFrame
      :phosphorColor="settings.phosphorColor"
      :serialStatus="serialStatus"
      @color-changed="onColorChanged"
      @send="onSend"
    >
      <!-- Canvas screen inside the aperture slot -->
      <TerminalCanvas
        :phosphorColor="settings.phosphorColor"
        :crtEffects="settings.crtEffects"
        :scanlines="settings.scanlines"
        :flicker="settings.flicker"
      />
    </MonitorFrame>

    <!-- Settings gear button -->
    <button class="gear-btn" @click="showSettings = !showSettings" title="Settings (F1)">⚙</button>

    <!-- Settings panel overlay -->
    <Transition name="slide">
      <SettingsPanel
        v-if="showSettings"
        :connectionStatus="serialStatus"
        @close="showSettings = false"
        @settings-changed="onSettingsChanged"
      />
    </Transition>
    <!-- Program select overlay (Phase 7) -->
    <Transition name="fade">
      <ProgramSelect
        v-if="showProgramSelect"
        :serialStatus="serialStatus"
        :charDelay="settings.charDelay"
        :lineDelay="settings.lineDelay"
        @close="showProgramSelect = false"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { computed } from 'vue'
import type { AppSettings, PhosphorColor, SerialStatus } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { PHOSPHOR_COLORS } from './terminal/painter'
import SettingsPanel from './components/SettingsPanel.vue'
import TerminalCanvas from './components/TerminalCanvas.vue'
import MonitorFrame from './components/MonitorFrame.vue'
import ProgramSelect from './components/ProgramSelect.vue'

const showSettings = ref(false)
const showProgramSelect = ref(false)
const serialStatus = ref<SerialStatus>('disconnected')
const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
const phosphorHex = computed(() => PHOSPHOR_COLORS[settings.value.phosphorColor])
let unsubStatus: (() => void) | null = null

onMounted(async () => {
  // Restore all persisted settings on launch.
  const saved = await window.api.settings.get()
  if (saved) settings.value = saved

  unsubStatus = window.api.serial.onStatus((s: SerialStatus) => {
    serialStatus.value = s
  })

  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  unsubStatus?.()
  window.removeEventListener('keydown', handleKey)
})

// ── Key → APL1 byte mapping ─────────────────────────────────────────────────

/**
 * Map a KeyboardEvent to raw byte(s) for the APL1.
 * Returns null for keys that should not be forwarded.
 */
function mapKeyToBytes(e: KeyboardEvent): Uint8Array | null {
  if (e.metaKey) return null

  if (e.ctrlKey) {
    const k = e.key.toLowerCase()
    if (k === 'l') return new Uint8Array([0x0c])
    if (k === '\\') return new Uint8Array([0x1c])
    if (k === 't') return new Uint8Array([0x14])
    return null
  }

  if (e.key === 'Enter') return new Uint8Array([0x8d])
  if (e.key === 'Backspace') return new Uint8Array([0xdf])

  if (e.key.length === 1) {
    let c = e.key.charCodeAt(0)
    if (c >= 0x61 && c <= 0x7a) c -= 0x20
    if (c >= 0x20 && c <= 0x5f) return new Uint8Array([0x80 | c])
  }

  return null
}

function handleKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (showProgramSelect.value) { showProgramSelect.value = false; return }
    if (showSettings.value) { showSettings.value = false; return }
    return
  }

  if (e.key === 'F1') {
    showSettings.value = !showSettings.value
    e.preventDefault()
    return
  }

  if (e.key === 'F11' || (e.metaKey && e.key === 'Enter')) {
    window.api.window.toggleFullscreen()
    e.preventDefault()
    return
  }

  if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (serialStatus.value !== 'connected') {
      showSettings.value = !showSettings.value
      return
    }
  }

  if (showSettings.value || showProgramSelect.value || serialStatus.value !== 'connected') return

  const bytes = mapKeyToBytes(e)
  if (bytes) {
    e.preventDefault()
    window.api.serial.send(bytes)
  }
}

function onEscape(): void {
  if (showProgramSelect.value) { showProgramSelect.value = false; return }
  if (showSettings.value) showSettings.value = false
}

function onSettingsChanged(updated: AppSettings): void {
  settings.value = updated
}

/** Colour-knob click → update phosphor setting and persist. */
function onColorChanged(color: PhosphorColor): void {
  settings.value = { ...settings.value, phosphorColor: color }
  window.api.settings.set({ phosphorColor: color })
}

/** SEND button click — open the program selector (Phase 7). */
function onSend(): void {
  showProgramSelect.value = true
}
</script>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  outline: none;
  position: relative;
  overflow: hidden;
}

.gear-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid #2a2a2a;
  color: #444;
  font-size: 1.1rem;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, border-color 0.15s;
  z-index: 50;
}
.gear-btn:hover {
  color: var(--phosphor);
  border-color: var(--phosphor);
}

/* Settings panel slide-in transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

/* Program select fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
