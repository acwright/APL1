<!--
  TerminalCanvas.vue — Phase 3 / Phase 5 / Phase 6
  Owns the 40×24 canvas screen.  Wires serial data → parser → buffer → painter.
  Phase 5: letterbox CSS scaling via ResizeObserver on the container div, so the
  canvas fits correctly inside the MonitorFrame bezel aperture (and in fullscreen).
  Phase 6: scanlines overlay (CSS) and flicker animation class; glow via painter.
-->
<template>
  <div ref="containerRef" class="terminal-container" :class="{ 'crt-flicker': props.crtEffects && props.flicker }">
    <canvas
      ref="canvasRef"
      :width="CANVAS_W"
      :height="CANVAS_H"
      :style="{ width: cssW + 'px', height: cssH + 'px' }"
      class="terminal-canvas"
    />
    <!-- Scanlines overlay: horizontal dark lines drawn in CSS over the canvas. -->
    <div v-if="props.crtEffects && props.scanlines" class="crt-scanlines" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { TerminalBuffer } from '../terminal/buffer'
import { ByteStreamParser } from '../terminal/parser'
import { TerminalPainter } from '../terminal/painter'
import { CANVAS_W, CANVAS_H } from '../terminal/glyphAtlas'
import type { PhosphorColor } from '../../../shared/types'

const props = defineProps<{
  phosphorColor: PhosphorColor
  crtEffects: boolean
  scanlines: boolean
  flicker: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// ── Letterbox sizing — driven by ResizeObserver on the container ─────────────
const cssW = ref(CANVAS_W)
const cssH = ref(CANVAS_H)

function updateLetterbox(): void {
  const el = containerRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  const scale = Math.min(width / CANVAS_W, height / CANVAS_H)
  cssW.value = Math.round(CANVAS_W * scale)
  cssH.value = Math.round(CANVAS_H * scale)
}

let resizeObserver: ResizeObserver | null = null
// ─────────────────────────────────────────────────────────────────────────────

let buffer: TerminalBuffer
let parser: ByteStreamParser
let painter: TerminalPainter
let unsubData: (() => void) | null = null

onMounted(() => {
  const canvas = canvasRef.value!

  buffer = new TerminalBuffer()
  painter = new TerminalPainter(canvas, buffer)
  parser = new ByteStreamParser(buffer, () => painter.requestPaint())

  painter.setColor(props.phosphorColor)
  painter.setGlow(props.crtEffects)
  painter.requestPaint()

  unsubData = window.api.serial.onData((data: Uint8Array) => {
    parser.feed(data)
  })

  resizeObserver = new ResizeObserver(() => updateLetterbox())
  resizeObserver.observe(containerRef.value!)
  updateLetterbox()
})

onUnmounted(() => {
  unsubData?.()
  painter?.destroy()
  resizeObserver?.disconnect()
})

watch(
  () => props.phosphorColor,
  (color) => painter?.setColor(color)
)

watch(
  () => props.crtEffects,
  (enabled) => painter?.setGlow(enabled)
)
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* Clip the scanlines overlay to the container bounds */
  overflow: hidden;
}

.terminal-canvas {
  display: block;
  /* Keep pixels sharp when scaled up by CSS. */
  image-rendering: pixelated;
  flex-shrink: 0;
}

/* ── CRT Scanlines ── */
.crt-scanlines {
  position: absolute;
  inset: 0;
  /* Two-pixel repeating stripe: 1px transparent + 1px semi-black. */
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 1px,
    rgba(0, 0, 0, 0.18) 1px,
    rgba(0, 0, 0, 0.18) 2px
  );
  pointer-events: none;
  z-index: 2;
}

/* ── CRT Flicker ── */
@keyframes crt-flicker {
  0%,  100% { opacity: 1.000; }
  4%         { opacity: 0.960; }
  7%         { opacity: 1.000; }
  20%        { opacity: 0.990; }
  30%        { opacity: 1.000; }
  62%        { opacity: 0.975; }
  64%        { opacity: 1.000; }
  83%        { opacity: 0.985; }
  86%        { opacity: 1.000; }
}

.crt-flicker {
  animation: crt-flicker 4.1s linear infinite;
}
</style>
