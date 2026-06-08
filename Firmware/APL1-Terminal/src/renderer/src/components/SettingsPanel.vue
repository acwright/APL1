<!--
  SettingsPanel.vue — Phase 2
  Serial port selector, connect/disconnect, and app settings (phosphor color,
  CRT effects, pacing delays). Docked overlay; toggled from App.vue.
-->
<template>
  <div class="settings-panel" role="dialog" aria-label="Settings">
    <div class="settings-header">
      <span class="settings-title">SETTINGS</span>
      <button class="close-btn" @click="$emit('close')" title="Close">✕</button>
    </div>

    <!-- ── Serial Connection ─────────────────────────────────────── -->
    <section class="section">
      <div class="section-label">SERIAL PORT</div>

      <div class="row">
        <select v-model="selectedPort" class="port-select" :disabled="connected">
          <option value="">— select port —</option>
          <option v-for="p in ports" :key="p.path" :value="p.path">
            {{ p.path }}{{ p.manufacturer ? ` (${p.manufacturer})` : '' }}
          </option>
        </select>
        <button class="icon-btn" @click="refreshPorts" :disabled="connected" title="Refresh ports">⟳</button>
      </div>

      <div class="row row-connect">
        <button
          class="connect-btn"
          :class="{ connected, error: status === 'error', connecting: status === 'connecting' }"
          @click="toggleConnect"
          :disabled="status === 'connecting' || (!connected && !selectedPort)"
        >
          {{ connectLabel }}
        </button>
        <span class="status-dot" :class="status" :title="status" />
        <span class="status-text">{{ statusText }}</span>
      </div>
    </section>

    <!-- ── Display ───────────────────────────────────────────────── -->
    <section class="section">
      <div class="section-label">PHOSPHOR COLOR</div>
      <div class="row color-row">
        <button
          v-for="c in phosphorColors"
          :key="c.value"
          class="color-btn"
          :class="{ active: settings.phosphorColor === c.value }"
          :style="{ '--clr': c.hex }"
          @click="updateSetting({ phosphorColor: c.value })"
        >{{ c.label }}</button>
      </div>
    </section>

    <section class="section">
      <div class="section-label">CRT EFFECTS</div>
      <label class="toggle-row">
        <input type="checkbox" v-model="crtEffects" @change="updateSetting({ crtEffects })" />
        <span>Phosphor glow</span>
      </label>
      <label class="toggle-row">
        <input type="checkbox" v-model="scanlines" @change="updateSetting({ scanlines })" />
        <span>Scanlines</span>
      </label>
      <label class="toggle-row">
        <input type="checkbox" v-model="flicker" @change="updateSetting({ flicker })" />
        <span>Flicker</span>
      </label>
    </section>

    <!-- ── Pacing ─────────────────────────────────────────────────── -->
    <section class="section">
      <div class="section-label">PROGRAM SEND PACING</div>
      <label class="input-row">
        <span>Char delay (ms)</span>
        <input
          type="number"
          min="0"
          max="500"
          class="num-input"
          v-model.number="charDelay"
          @change="updateSetting({ charDelay })"
        />
      </label>
      <label class="input-row">
        <span>Line delay (ms)</span>
        <input
          type="number"
          min="0"
          max="2000"
          class="num-input"
          v-model.number="lineDelay"
          @change="updateSetting({ lineDelay })"
        />
      </label>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { AppSettings, PortInfo, SerialStatus, PhosphorColor } from '../../../shared/types'

const props = defineProps<{
  connectionStatus: SerialStatus
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'settings-changed', settings: AppSettings): void
}>()

// ── State ────────────────────────────────────────────────────────────────────
const ports = ref<PortInfo[]>([])
const selectedPort = ref<string>('')
const status = ref<SerialStatus>(props.connectionStatus)

// Keep status in sync if it changes while the panel is open
watch(() => props.connectionStatus, (s) => { status.value = s })
const settings = ref<AppSettings>({
  port: null,
  phosphorColor: 'green',
  crtEffects: true,
  scanlines: true,
  flicker: true,
  charDelay: 10,
  lineDelay: 60
})

// Local mirror refs for v-model on checkboxes / inputs
const crtEffects = ref(settings.value.crtEffects)
const scanlines = ref(settings.value.scanlines)
const flicker = ref(settings.value.flicker)
const charDelay = ref(settings.value.charDelay)
const lineDelay = ref(settings.value.lineDelay)

// ── Derived ──────────────────────────────────────────────────────────────────
const connected = computed(() => status.value === 'connected')

const connectLabel = computed(() => {
  if (status.value === 'connecting') return 'CONNECTING…'
  if (status.value === 'connected') return 'DISCONNECT'
  if (status.value === 'error') return 'RETRY'
  return 'CONNECT'
})

const statusText = computed(() => {
  if (status.value === 'connected') return selectedPort.value
  return status.value.toUpperCase()
})

const phosphorColors: { value: PhosphorColor; label: string; hex: string }[] = [
  { value: 'white', label: 'WHITE', hex: '#e8e8e8' },
  { value: 'amber', label: 'AMBER', hex: '#ffb000' },
  { value: 'green', label: 'GREEN', hex: '#33ff33' }
]

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Load persisted settings
  const saved = await window.api.settings.get()
  if (saved) {
    settings.value = saved
    crtEffects.value = saved.crtEffects
    scanlines.value = saved.scanlines
    flicker.value = saved.flicker
    charDelay.value = saved.charDelay
    lineDelay.value = saved.lineDelay
    if (saved.port) selectedPort.value = saved.port
  }

  await refreshPorts()

  // Subscribe to serial status updates from main process
  window.api.serial.onStatus((s: SerialStatus) => {
    status.value = s
  })
})

// Keep settings.value in sync with child refs
watch(settings, (s) => {
  crtEffects.value = s.crtEffects
  scanlines.value = s.scanlines
  flicker.value = s.flicker
  charDelay.value = s.charDelay
  lineDelay.value = s.lineDelay
})

// ── Methods ───────────────────────────────────────────────────────────────────
async function refreshPorts(): Promise<void> {
  ports.value = await window.api.serial.listPorts()
  // Re-select the saved port if it's still present
  if (selectedPort.value && !ports.value.find((p) => p.path === selectedPort.value)) {
    selectedPort.value = ''
  }
}

async function toggleConnect(): Promise<void> {
  if (connected.value) {
    await window.api.serial.disconnect()
    await updateSetting({ port: null })
  } else {
    if (!selectedPort.value) return
    await window.api.serial.connect(selectedPort.value)
    await updateSetting({ port: selectedPort.value })
  }
}

async function updateSetting(partial: Partial<AppSettings>): Promise<void> {
  settings.value = { ...settings.value, ...partial }
  await window.api.settings.set(partial)
  emit('settings-changed', settings.value)
}
</script>

<style scoped>
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 280px;
  height: 100vh;
  background: #111;
  border-left: 1px solid #2a2a2a;
  color: #aaa;
  font-family: 'Futura', sans-serif;
  font-weight: bold;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  z-index: 100;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.6);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #222;
  background: #0d0d0d;
  position: sticky;
  top: 0;
  z-index: 1;
}

.settings-title {
  color: var(--phosphor);
  letter-spacing: 0.15em;
  font-size: 0.7rem;
}

.close-btn {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 4px;
  line-height: 1;
}
.close-btn:hover {
  color: #aaa;
}

.section {
  padding: 12px 14px;
  border-bottom: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #444;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.port-select {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
  font-family: 'Futura', sans-serif;
  font-size: 0.72rem;
  padding: 4px 6px;
  border-radius: 2px;
  min-width: 0;
}
.port-select:disabled {
  opacity: 0.5;
}
.port-select:focus {
  outline: 1px solid var(--phosphor);
}

.icon-btn {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #aaa;
  cursor: pointer;
  font-size: 1rem;
  padding: 3px 7px;
  border-radius: 2px;
  line-height: 1;
}
.icon-btn:hover:not(:disabled) {
  border-color: #555;
  color: #ccc;
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.row-connect {
  gap: 8px;
}

.connect-btn {
  background: #1a2a1a;
  border: 1px solid #2a4a2a;
  color: #33ff33;
  font-family: 'Futura', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  padding: 5px 10px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.connect-btn:hover:not(:disabled) {
  background: #1f3a1f;
  border-color: #33ff33;
}
.connect-btn.connected {
  background: #2a1a1a;
  border-color: #4a2a2a;
  color: #ff5533;
}
.connect-btn.connected:hover:not(:disabled) {
  background: #3a1a1a;
  border-color: #ff5533;
}
.connect-btn.error {
  border-color: #aa3300;
  color: #ff7755;
}
.connect-btn.connecting {
  opacity: 0.6;
  cursor: default;
}
.connect-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #333;
}
.status-dot.connected { background: var(--phosphor); box-shadow: 0 0 6px var(--phosphor); }
.status-dot.connecting { background: #ffb000; }
.status-dot.error { background: #ff4422; }
.status-dot.disconnected { background: #333; }

.status-text {
  font-size: 0.65rem;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Phosphor colors */
.color-row {
  gap: 6px;
}

.color-btn {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  color: var(--clr);
  font-family: 'Futura', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  padding: 5px 4px;
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}
.color-btn:hover {
  border-color: var(--clr);
}
.color-btn.active {
  border-color: var(--clr);
  background: color-mix(in srgb, var(--clr) 15%, #111);
  box-shadow: 0 0 6px color-mix(in srgb, var(--clr) 40%, transparent);
}

/* Toggles */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #888;
  user-select: none;
}
.toggle-row:hover {
  color: #bbb;
}
.toggle-row input[type='checkbox'] {
  accent-color: var(--phosphor);
  width: 13px;
  height: 13px;
  cursor: pointer;
}

/* Number inputs */
.input-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #888;
}

.num-input {
  width: 60px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
  font-family: 'Futura', sans-serif;
  font-size: 0.72rem;
  padding: 4px 6px;
  border-radius: 2px;
  text-align: right;
}
.num-input:focus {
  outline: 1px solid #33ff33;
}
</style>
