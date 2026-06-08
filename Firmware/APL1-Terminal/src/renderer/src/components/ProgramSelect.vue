<!--
  ProgramSelect.vue — Phase 7
  Overlay panel for loading and paced-sending bundled Wozmon programs.

  Opened when the user clicks the SEND button on the monitor control panel.
  Reads programs from software/manifest.json via IPC, lets the user pick one,
  and streams it to the APL1 with configurable per-char and per-line delays.

  Strips comment lines (starting with ;) and blank lines before sending.
  Each line is sent character-by-character (uppercase + bit7), then an Enter
  (0x8D) is sent at the end of each line.
-->
<template>
  <div class="ps-overlay" @click.self="onClose" @keydown.escape="onClose">
    <div class="ps-panel" role="dialog" aria-label="Send Program">

      <!-- Header -->
      <div class="ps-header">
        <span class="ps-title">SEND PROGRAM</span>
        <button class="ps-close" @click="onClose" :disabled="isSending" title="Close">✕</button>
      </div>

      <!-- Body -->
      <div class="ps-body">

        <!-- Program dropdown -->
        <div class="ps-field">
          <label class="ps-label">PROGRAM</label>
          <select
            v-model="selectedFilename"
            class="ps-select"
            :disabled="isSending || programs.length === 0"
          >
            <option value="" disabled>— select program —</option>
            <option
              v-for="p in programs"
              :key="p.filename"
              :value="p.filename"
            >{{ p.name }}</option>
          </select>
        </div>

        <!-- Description -->
        <div v-if="selectedProgram" class="ps-desc">
          <span v-if="selectedProgram.description">{{ selectedProgram.description }}</span>
          <span v-if="selectedProgram.runCommand" class="ps-run-cmd">
            Run: <code>{{ selectedProgram.runCommand }}</code>
          </span>
        </div>

        <!-- Progress bar (visible while sending) -->
        <div v-if="isSending || sendDone" class="ps-progress-wrap">
          <div class="ps-progress-track">
            <div
              class="ps-progress-bar"
              :style="{ width: progress + '%' }"
              :class="{ done: sendDone }"
            />
          </div>
          <span class="ps-progress-label">
            <template v-if="sendDone">DONE</template>
            <template v-else>{{ Math.round(progress) }}%</template>
          </span>
        </div>

        <!-- Error message -->
        <div v-if="errorMsg" class="ps-error">{{ errorMsg }}</div>

        <!-- Send / Cancel -->
        <div class="ps-actions">
          <button
            v-if="!isSending"
            class="ps-send-btn"
            :disabled="!selectedFilename || !canSend"
            @click="startSend"
          >SEND</button>
          <button
            v-else
            class="ps-cancel-btn"
            @click="cancelSend"
          >CANCEL</button>
        </div>

        <!-- Not connected warning -->
        <div v-if="serialStatus !== 'connected'" class="ps-warning">
          NOT CONNECTED — connect to the APL1 first
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ProgramEntry, SerialStatus } from '../../../shared/types'

const props = defineProps<{
  serialStatus: SerialStatus
  charDelay: number
  lineDelay: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const programs = ref<ProgramEntry[]>([])
const selectedFilename = ref('')
const isSending = ref(false)
const sendDone = ref(false)
const progress = ref(0)
const errorMsg = ref('')
let cancelFlag = false

const selectedProgram = computed<ProgramEntry | undefined>(() =>
  programs.value.find((p) => p.filename === selectedFilename.value)
)

const canSend = computed(() => props.serialStatus === 'connected' && !isSending.value)

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    programs.value = await window.api.software.getManifest()
  } catch (err) {
    errorMsg.value = 'Failed to load program list'
    console.error('[ProgramSelect] manifest load error:', err)
  }
})

// ── Close ─────────────────────────────────────────────────────────────────────

function onClose(): void {
  if (isSending.value) return
  emit('close')
}

// ── Paced send ────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function startSend(): Promise<void> {
  if (!selectedFilename.value || !canSend.value) return

  isSending.value = true
  sendDone.value = false
  progress.value = 0
  errorMsg.value = ''
  cancelFlag = false

  try {
    const content = await window.api.software.readFile(selectedFilename.value)

    // Strip comment lines (starting with ;) and blank lines
    const lines = content
      .split('\n')
      .map((l) => {
        const ci = l.indexOf(';')
        return (ci >= 0 ? l.slice(0, ci) : l).trim()
      })
      .filter((l) => l.length > 0)

    const total = lines.length

    for (let i = 0; i < lines.length; i++) {
      if (cancelFlag) break

      const line = lines[i]

      // Send each character in the line
      for (const char of line) {
        if (cancelFlag) break
        const code = char.charCodeAt(0)
        // Only send printable ASCII in the 0x20-0x5F range (already uppercase hex)
        if (code >= 0x20 && code <= 0x5f) {
          await window.api.serial.send(new Uint8Array([0x80 | code]))
          if (props.charDelay > 0) await sleep(props.charDelay)
        }
      }

      // Send Enter / CR after each line
      if (!cancelFlag) {
        await window.api.serial.send(new Uint8Array([0x8d]))
        if (props.lineDelay > 0) await sleep(props.lineDelay)
      }

      progress.value = ((i + 1) / total) * 100
    }

    if (!cancelFlag) {
      sendDone.value = true
    }
  } catch (err) {
    errorMsg.value = `Send failed: ${err instanceof Error ? err.message : String(err)}`
    console.error('[ProgramSelect] send error:', err)
  } finally {
    isSending.value = false
  }
}

function cancelSend(): void {
  cancelFlag = true
}
</script>

<style scoped>
.ps-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.ps-panel {
  background: #111;
  border: 1px solid #2a2a2a;
  width: 300px;
  font-family: monospace;
  font-size: 0.75rem;
  color: #aaa;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
}

/* ── Header ────────────────────────────────────────────────────────── */
.ps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #222;
  background: #0d0d0d;
}

.ps-title {
  color: var(--phosphor, #33ff33);
  letter-spacing: 0.15em;
  font-size: 0.7rem;
}

.ps-close {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 4px;
  line-height: 1;
}
.ps-close:hover:not(:disabled) { color: #aaa; }
.ps-close:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Body ──────────────────────────────────────────────────────────── */
.ps-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ps-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ps-label {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #444;
}

.ps-select {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
  padding: 5px 8px;
  font-family: monospace;
  font-size: 0.75rem;
  width: 100%;
  cursor: pointer;
}
.ps-select:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Description ───────────────────────────────────────────────────── */
.ps-desc {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #666;
  font-size: 0.7rem;
}

.ps-run-cmd {
  color: #555;
}
.ps-run-cmd code {
  color: var(--phosphor, #33ff33);
  font-family: monospace;
  opacity: 0.8;
}

/* ── Progress ──────────────────────────────────────────────────────── */
.ps-progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ps-progress-track {
  flex: 1;
  height: 6px;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  overflow: hidden;
}

.ps-progress-bar {
  height: 100%;
  background: var(--phosphor, #33ff33);
  opacity: 0.7;
  transition: width 0.1s linear;
}
.ps-progress-bar.done {
  opacity: 1;
}

.ps-progress-label {
  font-size: 0.65rem;
  color: var(--phosphor, #33ff33);
  min-width: 36px;
  text-align: right;
}

/* ── Error / Warning ───────────────────────────────────────────────── */
.ps-error {
  color: #ff4444;
  font-size: 0.7rem;
}

.ps-warning {
  color: #666;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  border-top: 1px solid #1a1a1a;
  padding-top: 8px;
}

/* ── Actions ───────────────────────────────────────────────────────── */
.ps-actions {
  display: flex;
  justify-content: flex-end;
}

.ps-send-btn,
.ps-cancel-btn {
  background: none;
  border: 1px solid;
  font-family: monospace;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  padding: 5px 18px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ps-send-btn {
  border-color: var(--phosphor, #33ff33);
  color: var(--phosphor, #33ff33);
}
.ps-send-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--phosphor, #33ff33) 15%, transparent);
}
.ps-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ps-cancel-btn {
  border-color: #ff6666;
  color: #ff6666;
}
.ps-cancel-btn:hover {
  background: rgba(255, 100, 100, 0.12);
}
</style>
