APL1 Terminal
=============

Desktop terminal application for the [A.C. Wright APL1 project](https://github.com/acwright/APL1).

An [Electron](https://www.electronjs.org/) + [Vue 3](https://vuejs.org/) app that provides a faithful CRT terminal experience for the APL1. It connects to the board over the DB-9 serial port at 115200 8N1 and renders output using the original Signetics 2513 character ROM glyphs on an authentic-looking monitor bezel.

---

## Features

- **Authentic display** — 40×24 character canvas rendered from Signetics 2513 ROM glyph data
- **Phosphor colors** — switchable white, amber, or green phosphor
- **CRT effects** — phosphor glow, scanlines overlay, and screen flicker (individually toggleable)
- **Serial connection** — auto-discovers ports; connects at 115200 8N1
- **Keyboard input** — keystrokes forwarded to the APL1 with Apple 1 control shortcuts
- **Program loader** — paced sending of 20 bundled Wozmon programs with configurable per-character and per-line delays
- **Persistent settings** — port selection, display options, and pacing delays saved across sessions

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+L | Clear screen (ANSI clear forwarded to APL1) |
| Ctrl+\ | Reset the 6502 |
| Ctrl+T | Toggle throttle ("slow") mode on the controller |
| F1 / ⚙ button | Open / close settings panel |
| Escape | Close open overlay panel |

---

## Bundled Programs

The `software/` folder contains 20 Wozmon-compatible programs loadable via the Send Program panel:

| Program | Description |
|---------|-------------|
| 15 Puzzle | Classic 4×4 sliding tile puzzle |
| Apple 30th | Graphics demo celebrating Apple's 30th anniversary |
| Applesoft BASIC | Applesoft BASIC interpreter |
| Blackjack | Casino-style Blackjack |
| Cellular Automaton | Configurable 1D cellular automaton visualizer |
| Checkers | Two-player checkers running on Integer BASIC |
| Hamurabi | Govern ancient Sumeria over 10 years |
| Hello | Prints HELLO, APPLE I! |
| Life | Conway's Game of Life |
| Little Tower | Text adventure game |
| Lunar Lander | Land your rocket before fuel runs out |
| Matrix | Scrolling matrix rain effect |
| Microchess | Chess against a 6502 AI |
| Shut the Box | Classic dice-and-tiles pub game |
| Slots | Single-armed bandit slot machine |
| Star Trek | Classic Star Trek strategy game |
| Star Trek 2003 | Updated Star Trek variant |
| Volksforth | Forth interpreter for the 6502 |
| Wumpus | Hunt the Wumpus text adventure |
| — | (additional titles may be present in software/) |

Programs are loaded from `software/manifest.json`, which maps filenames to display names, descriptions, and optional Wozmon run commands.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later

Install dependencies:

```bash
npm install
```

---

## Development

Start the app in development mode with hot reload:

```bash
npm run dev
```

Type-check without building:

```bash
npm run typecheck
```

---

## Building

Compile the app (outputs to `out/`):

```bash
npm run build
```

### Distribution

Build a distributable package for the current platform:

```bash
# macOS (Apple Silicon DMG)
npm run dist:mac

# Linux (AppImage + deb, x64)
npm run dist:linux

# Both platforms
npm run dist
```

Artifacts are written to the `dist/` directory. macOS builds are notarized via the `publish` configuration in `electron-builder.yml`.

---

## Project Structure

```
APL1-Terminal/
├── src/
│   ├── main/
│   │   ├── index.ts         # Electron main process, IPC handlers, window setup
│   │   ├── serial.ts        # SerialService — serial port management (115200 8N1)
│   │   └── settings.ts      # SettingsService — persistent settings via JSON
│   ├── preload/
│   │   └── index.ts         # Context bridge — exposes api.serial and api.settings to renderer
│   ├── renderer/src/
│   │   ├── App.vue           # Root component — keyboard handling, overlay management
│   │   ├── components/
│   │   │   ├── MonitorFrame.vue    # Sanyo monitor bezel skin with control panel
│   │   │   ├── TerminalCanvas.vue  # 40×24 canvas screen with CRT effects
│   │   │   ├── SettingsPanel.vue   # Serial port selector and display settings
│   │   │   ├── ProgramSelect.vue   # Program loader with paced sending
│   │   │   └── ColorKnob.vue       # Phosphor color selector knob
│   │   ├── terminal/
│   │   │   ├── buffer.ts     # 40×24 character buffer
│   │   │   ├── parser.ts     # Byte-stream parser (Apple 1 ASCII → buffer)
│   │   │   ├── painter.ts    # Canvas renderer with phosphor glow
│   │   │   └── glyphAtlas.ts # Glyph atlas built from Signetics 2513 ROM data
│   │   └── assets/
│   │       └── signetics2513.ts  # Signetics 2513 character ROM (64 glyphs, 5×7 px)
│   └── shared/
│       └── types.ts          # Shared types and IPC channel constants
├── software/
│   ├── manifest.json         # Program catalog (name, filename, description, run command)
│   └── *.woz                 # Wozmon hex program files
├── electron-builder.yml      # Distribution build configuration
├── electron.vite.config.ts   # electron-vite build configuration
└── package.json
```

---

## Settings

Settings are persisted to `<userData>/settings.json` and restored on next launch.

| Setting | Default | Description |
|---------|---------|-------------|
| `port` | `null` | Last-used serial port path |
| `phosphorColor` | `green` | Phosphor color: `white`, `amber`, or `green` |
| `crtEffects` | `true` | Master toggle for all CRT effects |
| `scanlines` | `true` | Horizontal scanlines overlay |
| `flicker` | `true` | Subtle screen flicker animation |
| `charDelay` | `10` ms | Delay between characters when sending a program |
| `lineDelay` | `60` ms | Delay between lines when sending a program |
