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
- **Program loader** — paced sending of Wozmon programs via three input modes: bundled library, local file upload, or pasted text; configurable per-character and per-line delays
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

## Send Program Panel

The Send Program panel is opened by clicking the SEND button on the monitor control panel. It provides three tabs for loading Wozmon programs:

| Tab | Description |
|-----|-------------|
| **Library** | Pick from the bundled program catalog. Shows program name, description, and the Wozmon run command. |
| **File** | Browse for a local Wozmon-formatted `.txt` or `.woz` file. The first `XXXX:` address in the file is detected automatically and shown as a run command hint (e.g. `0280R`). |
| **Paste** | Paste Wozmon hex lines directly into a text area. The start address is detected in real time from the pasted content and shown as a run command hint. |

All three tabs share the same paced-send engine (configurable per-character and per-line delays), the same progress bar, and the SEND / CANCEL controls. Comment lines beginning with `;` and blank lines are stripped before sending. Each line is transmitted character-by-character with bit 7 set, followed by a carriage return (0x8D).

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

Distribution packages are built locally on macOS. Each platform has its own prerequisites:

| Platform | Prerequisite |
|----------|-------------|
| **macOS** | Xcode, a valid **Developer ID Application** certificate in Keychain |
| **Linux** | Docker (electron-builder runs inside `electronuserland/builder`) |
| **Windows** | Wine — `brew install --cask wine-stable` |

Before building macOS targets, export your notarization credentials (or add them to `~/.zshrc`):

```bash
export APPLE_ID="your@apple.id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Build commands:

```bash
# macOS (Apple Silicon DMG — signed and notarized)
npm run dist:mac

# Linux (AppImage + deb, x64 — requires Docker)
npm run dist:linux

# Windows (NSIS installer, x64 — requires Docker)
npm run dist:win

# All three platforms
npm run dist
```

Artifacts are written to the `dist/` directory. After tagging a release, upload the artifacts to the corresponding GitHub release manually.

> **Note — Linux builds:** `dist:linux` runs entirely inside Docker. It uses a named Docker volume (`apl1-terminal-linux-modules`) to keep Linux-compiled `node_modules` isolated from the macOS working copy. The first run pulls the Docker image and compiles native modules; subsequent runs reuse the cached volume and are significantly faster.

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

---

## Changelog

### 1.1.0 — 2026-07-06

- **Send Program — File tab**: browse for any local Wozmon-formatted `.txt` or `.woz` file and send it with the paced-send engine.
- **Send Program — Paste tab**: paste Wozmon hex lines directly into a text area for immediate sending.
- **Auto run-command detection**: the File and Paste tabs scan the program content for the first `XXXX:` address line and display a Wozmon run-command hint (e.g. `0280R`) automatically.
- Send Program panel redesigned with a three-tab layout (Library / File / Paste); all tabs share the progress bar, SEND/CANCEL controls, and not-connected warning.

### 1.0.0 — Initial release

- 40×24 CRT terminal with Signetics 2513 ROM glyphs.
- Phosphor color selector (white, amber, green) and CRT effects (glow, scanlines, flicker).
- Serial connection at 115200 8N1 with auto port discovery.
- Bundled library of 20 Wozmon programs with paced sending.
- Persistent settings saved across sessions.
