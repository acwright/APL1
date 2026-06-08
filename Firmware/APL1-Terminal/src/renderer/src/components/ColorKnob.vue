<!--
  ColorKnob.vue — Phase 6
  SVG rotary knob that cycles through the three phosphor colours.
  The pointer indicator rotates to one of three detent positions and is tinted
  in the currently-active phosphor colour for immediate visual feedback.

  Detent positions (clockwise from 12 o'clock):
    white  → 225° (lower-left,  7:30 position)
    amber  → 270° (straight down, 6 o'clock)
    green  → 315° (lower-right, 4:30 position)
-->
<template>
  <button class="knob-group" @click="cycle" :title="`Phosphor: ${props.color}`">
    <svg
      class="knob-svg"
      viewBox="0 0 48 48"
      width="48"
      height="48"
      aria-hidden="true"
    >
      <defs>
        <!-- Radial gradient for the 3-D plastic-knob body -->
        <radialGradient id="knob-body-grad" cx="38%" cy="30%" r="65%">
          <stop offset="0%"   stop-color="#3e3f3e" />
          <stop offset="60%"  stop-color="#262726" />
          <stop offset="100%" stop-color="#1b1c1b" />
        </radialGradient>
        <!-- Subtle inner-ring stroke gradient -->
        <radialGradient id="knob-ring-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="rgba(255,255,255,0.10)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)" />
        </radialGradient>
      </defs>

      <!-- Drop-shadow ring -->
      <circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.75)" />
      <!-- Knob body -->
      <circle cx="24" cy="24" r="22" fill="url(#knob-body-grad)" />
      <!-- Knurl texture ring (very faint dashed stroke) -->
      <circle
        cx="24" cy="24" r="19"
        fill="none"
        stroke="url(#knob-ring-grad)"
        stroke-width="1"
        stroke-dasharray="2.5 3.2"
      />
      <!-- Pointer line from centre toward edge, rotated to detent position.
           Origin is 12 o'clock; positive angles rotate clockwise. -->
      <line
        x1="24" y1="24"
        x2="24" y2="7"
        :stroke="phosphorHex"
        stroke-width="2.5"
        stroke-linecap="round"
        :transform="`rotate(${pointerAngle}, 24, 24)`"
      />
      <!-- Small indicator dot at the pointer tip -->
      <circle
        cx="24" cy="7"
        r="2"
        :fill="phosphorHex"
        :transform="`rotate(${pointerAngle}, 24, 24)`"
      />
    </svg>
    <span class="knob-label">COLOR</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PhosphorColor } from '../../../shared/types'
import { PHOSPHOR_COLORS } from '../terminal/painter'

const props = defineProps<{
  color: PhosphorColor
}>()

const emit = defineEmits<{
  (e: 'change', color: PhosphorColor): void
}>()

const COLOR_ORDER: PhosphorColor[] = ['white', 'amber', 'green']

/** Detent rotation angles (degrees clockwise from 12 o'clock). */
const DETENTS: Record<PhosphorColor, number> = {
  white: 225,
  amber: 270,
  green: 315,
}

const pointerAngle = computed(() => DETENTS[props.color])
const phosphorHex   = computed(() => PHOSPHOR_COLORS[props.color])

function cycle(): void {
  const idx = COLOR_ORDER.indexOf(props.color)
  const next = COLOR_ORDER[(idx + 1) % COLOR_ORDER.length]
  emit('change', next)
}
</script>

<style scoped>
.knob-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  outline: none;
  /* Prevent accidental text selection on double-click */
  user-select: none;
  -webkit-user-select: none;
}

.knob-svg {
  display: block;
  /* Smooth rotation transition when colour changes */
  transition: transform 0.1s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7));
}

.knob-group:hover .knob-svg {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.9));
}

.knob-group:active .knob-svg {
  transform: scale(0.95);
}

.knob-label {
  font-family: monospace;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  color: #555;
  text-transform: uppercase;
}
</style>
