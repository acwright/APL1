/**
 * Generates the APL1 Terminal app icon using ImageMagick.
 * Requires: magick (ImageMagick 7) and fc-match (fontconfig) — both available on macOS via Homebrew.
 *
 * Icon: PCB green (#1a7a2e) background, "APL1" in bold white Futura.
 *
 * Run: node gen-icon.mjs
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'icon.png')

// Resolve Futura Bold via fontconfig
const fontFile = execSync('fc-match --format=\'%{file}\' "Futura:bold"').toString().trim()
console.log(`Using font: ${fontFile}`)

// Render each character individually (trimmed to ink bounds), then composite
// them with a consistent pixel gap — so A→P, P→L, L→1 gaps are all equal.
const GAP = 28  // pixels between characters
const POINTSIZE = 200
const chars = ['A', 'P', 'L', '1']
const tmpChars = chars.map((_, i) => `/tmp/apl1_char_${i}.png`)

// Render each char trimmed to its actual ink
chars.forEach((c, i) => {
  execSync(
    `magick -background transparent -fill white ` +
    `-font "${fontFile}" -pointsize ${POINTSIZE} ` +
    `label:"${c}" -trim +repage "${tmpChars[i]}"`
  )
})

// Measure each character's pixel width and height
const dims = tmpChars.map(f => ({
  w: parseInt(execSync(`magick identify -format "%w" "${f}"`).toString().trim()),
  h: parseInt(execSync(`magick identify -format "%h" "${f}"`).toString().trim()),
}))

const totalW = dims.reduce((s, d) => s + d.w, 0) + GAP * (chars.length - 1)
const maxH = Math.max(...dims.map(d => d.h))

// Composite each character onto the green background with equal gaps
execSync(`magick -size 512x512 xc:"#007A3B" /tmp/apl1_bg.png`)

let x = Math.round((512 - totalW) / 2)
const y = Math.round((512 - maxH) / 2)

chars.forEach((_, i) => {
  execSync(
    `magick /tmp/apl1_bg.png "${tmpChars[i]}" ` +
    `-geometry +${x}+${y} -composite /tmp/apl1_bg.png`
  )
  x += dims[i].w + GAP
})

execSync(`cp /tmp/apl1_bg.png "${OUT}"`)


console.log(`Written: ${OUT}`)
