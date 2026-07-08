<!--
  ProgramSelect.vue
  Overlay panel for loading and paced-sending Wozmon programs.

  Two input modes selectable via tabs:
    1. File  — browse for a local Wozmon .txt / .woz file
    2. Paste — paste Wozmon hex lines directly into a text area

  Both modes share the same paced-send engine and progress indicator.
  Both modes auto-detect the program start address from the first "XXXX:"
  line in the content and show a Wozmon run-command hint (e.g. "0280R").

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

      <!-- Tabs -->
      <div class="ps-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="ps-tab"
          :class="{ active: activeTab === tab.id }"
          :disabled="isSending"
          @click="setTab(tab.id)"
        >{{ tab.label }}</button>
      </div>

      <!-- Body -->
      <div class="ps-body">

        <!-- ── File tab ─────────────────────────────────────────── -->
        <template v-if="activeTab === 'file'">
          <div class="ps-field">
            <label class="ps-label">FILE</label>
            <div class="ps-file-row">
              <span class="ps-filename">{{ fileName || '— choose file —' }}</span>
              <button class="ps-browse-btn" :disabled="isSending" @click="triggerFileInput">BROWSE</button>
            </div>
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt,.woz"
              style="display: none"
              @change="onFileSelected"
            />
          </div>

          <div v-if="fileRunCommand" class="ps-desc">
            <span class="ps-run-cmd">Run: <code>{{ fileRunCommand }}</code></span>
          </div>
        </template>

        <!-- ── Paste tab ─────────────────────────────────────────── -->
        <template v-else>
          <div class="ps-field">
            <label class="ps-label">PASTE WOZMON PROGRAM</label>
            <textarea
              v-model="pasteContent"
              class="ps-textarea"
              :disabled="isSending"
              placeholder="0280: A9 00 AA 20 EF FF&#10;..."
              spellcheck="false"
            />
          </div>

          <div v-if="pasteRunCommand" class="ps-desc">
            <span class="ps-run-cmd">Run: <code>{{ pasteRunCommand }}</code></span>
          </div>
        </template>

        <!-- ── Progress bar (all tabs) ──────────────────────────── -->
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
            :disabled="!canSend"
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
import { ref, computed } from 'vue'
import type { SerialStatus } from '../../../shared/types'

type TabId = 'file' | 'paste'

const tabs: { id: TabId; label: string }[] = [
  { id: 'file',  label: 'FILE' },
  { id: 'paste', label: 'PASTE' }
]

const props = defineProps<{
  serialStatus: SerialStatus
  charDelay: number
  lineDelay: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// ── State ─────────────────────────────────────────────────────────────────────

// Shared
const activeTab = ref<TabId>('file')
const isSending = ref(false)
const sendDone = ref(false)
const progress = ref(0)
const errorMsg = ref('')
let cancelFlag = false

// File tab
const fileInputRef = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const fileContent = ref('')

// Paste tab
const pasteContent = ref('')

// ── Computed ──────────────────────────────────────────────────────────────────

const fileRunCommand = computed(() => detectRunCommand(fileContent.value))
const pasteRunCommand = computed(() => detectRunCommand(pasteContent.value))

const canSend = computed(() => {
  if (isSending.value || props.serialStatus !== 'connected') return false
  if (activeTab.value === 'file') return !!fileContent.value
  return pasteContent.value.trim().length > 0
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect the Wozmon start address from program content and return a run hint
 * like "0280R". Looks for the first line of the form "XXXX: ..." after
 * stripping comment lines (;) and blank lines.
 */
function detectRunCommand(content: string): string | undefined {
  if (!content) return undefined
  const lines = content
    .split('\n')
    .map((l) => {
      const ci = l.indexOf(';')
      return (ci >= 0 ? l.slice(0, ci) : l).trim()
    })
    .filter((l) => l.length > 0)

  for (const line of lines) {
    const m = line.match(/^([0-9A-Fa-f]{1,4}):/)
    if (m) {
      return m[1].toUpperCase().padStart(4, '0') + 'R'
    }
  }
  return undefined
}

/** Strip comment and blank lines; trim each line. */
function parseLines(content: string): string[] {
  return content
    .split('\n')
    .map((l) => {
      const ci = l.indexOf(';')
      return (ci >= 0 ? l.slice(0, ci) : l).trim()
    })
    .filter((l) => l.length > 0)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── Tab management ────────────────────────────────────────────────────────────

function setTab(tab: TabId): void {
  if (isSending.value) return
  activeTab.value = tab
  sendDone.value = false
  errorMsg.value = ''
}

// ── Close ─────────────────────────────────────────────────────────────────────

function onClose(): void {
  if (isSending.value) return
  emit('close')
}

// ── File input ────────────────────────────────────────────────────────────────

function triggerFileInput(): void {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  fileContent.value = ''
  sendDone.value = false
  errorMsg.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    fileContent.value = (e.target?.result as string) ?? ''
  }
  reader.onerror = () => {
    errorMsg.value = 'Failed to read file'
  }
  reader.readAsText(file)

  // Reset so the same file can be re-selected
  input.value = ''
}

// ── Paced send ────────────────────────────────────────────────────────────────

async function startSend(): Promise<void> {
  if (!canSend.value) return

  const content = activeTab.value === 'file' ? fileContent.value : pasteContent.value
  await sendContent(content)
}

async function sendContent(content: string): Promise<void> {
  isSending.value = true
  sendDone.value = false
  progress.value = 0
  errorMsg.value = ''
  cancelFlag = false

  try {
    const lines = parseLines(content)
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
  font-family: 'Futura', sans-serif;
  font-weight: bold;
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

/* ── Tabs ──────────────────────────────────────────────────────────── */
.ps-tabs {
  display: flex;
  border-bottom: 1px solid #222;
}

.ps-tab {
  flex: 1;
  background: none;
  border: none;
  border-right: 1px solid #222;
  color: #444;
  font-family: 'Futura', sans-serif;
  font-weight: bold;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  padding: 7px 0;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.ps-tab:last-child { border-right: none; }
.ps-tab:hover:not(:disabled):not(.active) { color: #777; background: #141414; }
.ps-tab.active { color: var(--phosphor, #33ff33); background: #0d0d0d; }
.ps-tab:disabled { opacity: 0.3; cursor: not-allowed; }

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
  font-family: 'Futura', sans-serif;
  font-size: 0.75rem;
  width: 100%;
  cursor: pointer;
}
.ps-select:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── File row ──────────────────────────────────────────────────────── */
.ps-file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1a1a1a;
  border: 1px solid #333;
  padding: 4px 6px 4px 8px;
}

.ps-filename {
  flex: 1;
  color: #ccc;
  font-size: 0.7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ps-browse-btn {
  background: none;
  border: 1px solid #444;
  color: #888;
  font-family: 'Futura', sans-serif;
  font-weight: bold;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
}
.ps-browse-btn:hover:not(:disabled) { color: #bbb; border-color: #666; }
.ps-browse-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Paste textarea ────────────────────────────────────────────────── */
.ps-textarea {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  padding: 6px 8px;
  width: 100%;
  height: 120px;
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.5;
}
.ps-textarea::placeholder { color: #333; }
.ps-textarea:disabled { opacity: 0.5; cursor: not-allowed; }

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
  font-family: 'Futura', sans-serif;
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
  font-family: 'Futura', sans-serif;
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
