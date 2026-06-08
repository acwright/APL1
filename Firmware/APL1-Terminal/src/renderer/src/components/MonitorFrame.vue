<!--
  MonitorFrame.vue — Phase 6
  Sanyo VM4209-era security-monitor skin surrounding the terminal canvas.

  Layout (top-to-bottom inside 100vw × 100vh):
    ┌── bezel top (28px padding) ────────────────────────────────────┐
    │   ┌── screen aperture ────────────────────────────────────┐    │
    │   │   <slot>  ← TerminalCanvas letterboxed inside here    │    │
    │   └────────────────────────────────────────────────────────┘   │
    │  (12px gap)                                                     │
    ├── control-panel strip (84px) ──────────────────────────────────┤
    └────────────────────────────────────────────────────────────────┘

  Props:
    phosphorColor  — current phosphor colour (drives the LED and knob indicator)
    serialStatus   — 'connected' lights the LED bright; otherwise dim
    crtEffects     — whether phosphor-glow knob label is highlighted

  Events:
    color-changed(color)  — user clicked the colour knob
    send                  — user clicked the SEND button (wired in Phase 7)
-->
<template>
  <div class="monitor">
    <!-- ── Bezel + screen aperture ──────────────────────────────────── -->
    <div class="screen-surround">
      <div class="screen-aperture">
        <!-- Terminal canvas slot -->
        <slot />
      </div>
    </div>

    <!-- ── Horizontal rule between screen and controls ─────────────── -->
    <div class="panel-divider" />

    <!-- ── Control panel ───────────────────────────────────────────── -->
    <div class="control-panel">
      <!-- Left: brand + status LED -->
      <div class="brand-block">
        <div class="brand-name">APL1</div>
        <div class="brand-model">TERMINAL</div>
        <div
          class="power-led"
          :class="ledClass"
          :style="{ '--led-color': phosphorHex }"
          :title="props.serialStatus"
        />
      </div>

      <!-- Right: colour knob + SEND button -->
      <div class="controls-block">
        <ColorKnob :color="props.phosphorColor" @change="emit('color-changed', $event)" />
        <button class="send-btn" @click="emit('send')" title="Send program (Phase 7)">
          SEND
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PhosphorColor, SerialStatus } from '../../../shared/types'
import { PHOSPHOR_COLORS } from '../terminal/painter'
import ColorKnob from './ColorKnob.vue'

const props = defineProps<{
  phosphorColor: PhosphorColor
  serialStatus: SerialStatus
}>()

const emit = defineEmits<{
  (e: 'color-changed', color: PhosphorColor): void
  (e: 'send'): void
}>()

const phosphorHex = computed(() => PHOSPHOR_COLORS[props.phosphorColor])

const ledClass = computed(() => ({
  'led-on':  props.serialStatus === 'connected',
  'led-err': props.serialStatus === 'error',
}))
</script>

<style scoped>
/* ── Monitor housing ─────────────────────────────────────────────────────── */
.monitor {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* Dark charcoal ABS-plastic housing */
  background: linear-gradient(160deg, #202120 0%, #1a1b1a 55%, #161716 100%);
  /* Faint top-edge specular highlight from overhead light */
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
  overflow: hidden;
}

/* ── Bezel frame around the screen aperture ─────────────────────────────── */
.screen-surround {
  flex: 1;
  /* Bezel padding: 40px top/bottom, 28px sides. */
  padding: 40px 28px;
  min-height: 0;
  display: flex;
  /* Center the aperture so bezel fills the remaining space on all sides. */
  align-items: center;
  justify-content: center;
}

/* ── Screen aperture (the recessed CRT window) ──────────────────────────── */
.screen-aperture {
  /*
   * Size the glass panel tightly around the 960 × 768 canvas content.
   * height: 100% is the explicit anchor (fills the surround content box).
   * aspect-ratio derives the width from that fixed height — no feedback loop.
   * max-width: 100% handles the rare case where the window is narrower than
   * the calculated width, capping and letting aspect-ratio shrink height too.
   */
  height: 100%;
  aspect-ratio: 960 / 768;
  max-width: 100%;
  background: #000;
  border-radius: 5px;
  /* Inset shadow creates depth / recession illusion */
  box-shadow:
    inset 0 0 40px rgba(0, 0, 0, 1),
    inset 0 3px 10px rgba(0, 0, 0, 0.8),
    0 0 0 1px #0b0b0b,
    0 0 0 3px #131413;
  overflow: hidden;
  /* 10px inner padding: the "CRT glass" inset that gives text breathing room. */
  padding: 10px;
}

/* ── Divider between aperture and control panel ─────────────────────────── */
.panel-divider {
  height: 12px;
  /* subtle sunken channel to separate the two sections visually */
  background: linear-gradient(
    to bottom,
    #0e0e0e 0%,
    #161716 40%,
    #1a1b1a 100%
  );
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.5);
}

/* ── Control panel strip ─────────────────────────────────────────────────── */
.control-panel {
  height: 80px;
  background: linear-gradient(180deg, #1a1b1a 0%, #161716 100%);
  border-top: 1px solid #0c0c0c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}

/* ── Brand block ─────────────────────────────────────────────────────────── */
.brand-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  position: relative;
}

.brand-name {
  font-family: 'Futura', sans-serif;
  font-size: 1.1rem;
  font-weight: bold;
  letter-spacing: 0.25em;
  color: #444;
  line-height: 1;
}

.brand-model {
  font-family: 'Futura', sans-serif;
  font-size: 0.55rem;
  letter-spacing: 0.2em;
  color: #333;
  text-transform: uppercase;
}

/* Power / connection LED */
.power-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #222;
  box-shadow: none;
  margin-top: 5px;
  transition: background 0.3s, box-shadow 0.3s;
}

.power-led.led-on {
  background: var(--led-color, #33ff33);
  box-shadow: 0 0 5px 1px var(--led-color, #33ff33);
}

.power-led.led-err {
  background: #ff3333;
  box-shadow: 0 0 5px 1px #ff3333;
}

/* ── Controls block ──────────────────────────────────────────────────────── */
.controls-block {
  display: flex;
  align-items: center;
  gap: 24px;
}

/* ── SEND push-button ────────────────────────────────────────────────────── */
.send-btn {
  background: linear-gradient(180deg, #2c2d2c 0%, #222322 100%);
  border: 1px solid #333;
  border-bottom: 2px solid #0a0a0a;
  border-radius: 4px;
  color: #666;
  font-family: 'Futura', sans-serif;
  font-size: 0.65rem;
  font-weight: bold;
  letter-spacing: 0.18em;
  padding: 7px 22px;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 3px 6px rgba(0, 0, 0, 0.5);
  transition: color 0.1s, background 0.1s, transform 0.08s, box-shadow 0.08s;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
}

.send-btn:hover {
  color: #999;
  border-color: #444;
}

.send-btn:active {
  background: linear-gradient(180deg, #1e1f1e 0%, #222322 100%);
  border-bottom-width: 1px;
  transform: translateY(1px);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.5);
}
</style>
