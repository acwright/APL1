# APL1 Controller Firmware

## Overview

Firmware for the ATmega1284(P) that replicates the Apple-1 terminal circuitry and extends it with PS/2 keyboard and serial (USB/UART) input. The microcontroller sits between a PS/2 keyboard, a serial terminal, and the original 6521 PIA, faithfully emulating the Apple-1 keyboard and display handshake while adding modern input options. Composite video output is reserved for a future phase.

The crystal is 28.63636 MHz (8× NTSC colorburst), overclocked beyond the 1284's 20 MHz rating to allow cycle-accurate composite video generation in a later revision. All current functionality runs well within safe operating margins at 3.3–5 V.

---

## Hardware

| Item | Value |
|------|-------|
| MCU | ATmega1284P (or ATmega1284), DIP-40 |
| Clock | External full-swing crystal, 28.63636 MHz |
| F_CPU | 28 636 363 Hz |
| Framework | Arduino via PlatformIO |
| Programmer | minipro (TL866 / T48) |
| PIA | MOS 6521 (Apple-1 original footprint) |
| Keyboard buffer | 74LS245 octal bus transceiver |

---

## Pin Map

### PORTA – Keyboard data output to PIA (PA0–PA7)

| Pin | Signal | Direction | Description |
|-----|--------|-----------|-------------|
| PA0–PA6 | KBD\[6:0\] | Output (during key inject) | Apple-1 ASCII data to PIA PA0–PA6 |
| PA7 | STROBE / CA1 | Output (during key inject) | Rising edge latches key into PIA |

Idle state: all Hi-Z inputs (74LS245 drives the bus when not injecting).

### PORTB – Display data input from PIA (PB0–PB7)

| Pin | Signal | Direction | Description |
|-----|--------|-----------|-------------|
| PB0–PB6 | DISP\[6:0\] | Input | 7-bit ASCII from PIA PB0–PB6 |
| PB7 | DA (active-low) | Input | Display Available – low when 6502 has written a char |

### PORTC – Video DAC + control

| Pin | Signal | Direction | Description |
|-----|--------|-----------|-------------|
| PC0–PC2 | VIDEO\_DAC | Output (LOW) | Composite video DAC (1 kΩ / 820 Ω / 820 Ω) – deferred |
| PC3–PC6 | — | Input w/ pullup | Unused, held at defined state |
| PC7 | RDAB / CB1 | Output | Active-low pulse clears DA flag in PIA; idle HIGH |

### PORTD – UART + PS/2 + control

| Pin | Signal | Direction | Description |
|-----|--------|-----------|-------------|
| PD0 | RXD | Input | UART receive (115 200 8N1) |
| PD1 | TXD | Output | UART transmit (115 200 8N1) |
| PD2 | PS2CLK / INT0 | Input w/ pullup | PS/2 clock – triggers INT0 ISR on falling edge |
| PD3 | PS2DATA | Input w/ pullup | PS/2 data |
| PD4 | KBDRESB (active-low) | Input w/ pullup | Keyboard reset button – resets 6502 + PS/2 state |
| PD5 | KBDCLRB (active-low) | Input w/ pullup | Keyboard clear button – sends ANSI clear to serial |
| PD6 | KBDENB (active-low) | Output | 74LS245 OE – LOW=buffer enabled, HIGH=disabled during key inject |
| PD7 | RESB (active-low) | Output | 6502 reset line – held LOW at power-on then released |

---

## Features

### Display path (6502 → serial)
The 6502 writes a character to PIA Port B and asserts DA (active-low on PIA PB7 via an external inverter). The 1284 detects PB7 LOW, reads PB0–PB6, then pulses RDAB (CB1) low to clear DA. The 7-bit ASCII value is forwarded to the serial port. Bare CR (0x0D) is translated to CR+LF for terminal compatibility.

### ASCII keyboard pass-through
The original ASCII keyboard is connected via a 74LS245 buffer (KBDENB, active-low). When no injection is in progress the buffer is enabled and the keyboard drives the PIA directly, preserving full compatibility with the original Apple-1 circuit.

### PS/2 keyboard input
A custom ISR-based Set-2 decoder handles the 11-bit PS/2 frame (start / 8 data LSB-first / odd parity / stop) on INT0 (falling edge). Decoded make codes are mapped to Apple-1 ASCII (uppercase, bit 7 set) using tables in flash. Supported:
- All printable US-layout keys (unshifted and shifted)
- **Enter** → 0x8D (Apple-1 CR)
- **Backspace** → 0xDF (Apple-1 `_` rubout)
- **ESC** → 0x9B
- Left/Right Shift, Left Ctrl, Right Ctrl (via E0 prefix), Left/Right Alt tracked
- Caps Lock ignored (Apple-1 is uppercase-only)
- **Ctrl+L** → clear screen (ANSI ESC\[2J ESC\[H to serial)
- **Ctrl+\\** → reset 6502 (assert RESB low pulse)
- **Ctrl+Alt+Del** → reset 6502

### Serial input (PC → 6502)
Characters received over the serial port are uppercased, bit 7 set, and injected into the PIA via `sendKey()`. Control shortcuts:
- **Ctrl+L** (0x0C) → clear screen
- **Ctrl+\\** (0x1C) → reset 6502

### Key injection
`sendKey(ascii)` disables the 74LS245 (KBDENB HIGH), drives PA0–PA6 with the 7-bit ASCII value, generates a rising edge on PA7 (STROBE → CA1) to latch the key into the PIA, then returns PA to Hi-Z and re-enables the buffer. The entire sequence takes < 30 µs.

### DA / RDAB handshake
Matches the original Apple-1 terminal circuit:
1. 6502 writes character to PIA Port B → DA asserted (active-low) on CB2/PB7
2. 1284 detects DA, reads the data, pulses RDAB (CB1) low ~5 µs
3. PIA clears DA; 6502 can write the next character

### Control buttons
Both buttons are debounced (20 ms) and active-low:
- **KBDRESB** (PD4) – asserts RESB low for 10 ms (resets 6502) and clears PS/2 decoder state
- **KBDCLRB** (PD5) – sends ANSI clear sequence to serial (video framebuffer clear deferred)

---

## Build & Flash

### Prerequisites
- [PlatformIO](https://platformio.org/) (CLI or VS Code extension)
- [minipro](https://gitlab.com/DavidGriffith/minipro) with a TL866 or T48 programmer

### Build

```sh
pio run                  # build both envs
pio run -e atmega1284p   # build only the 1284P variant
```

### Flash (code + fuses in one step)

```sh
pio run -e atmega1284p --target upload
```

The upload command is:
```sh
minipro -p "ATMEGA1284P@DIP40" -c code -w firmware.hex && \
minipro -p "ATMEGA1284P@DIP40" -c config -w fuses.cfg --fuses
```

For the non-P variant use env `atmega1284` and `-p "ATMEGA1284@DIP40"`.

### Fuse values

| Fuse | Value | Notes |
|------|-------|-------|
| lfuse | 0xF7 | Full-swing crystal oscillator (CKSEL=0111), CKDIV8 off, SUT slow-rising power |
| hfuse | 0xFF | All defaults (JTAG on, no bootloader, Brown-out disabled) |
| efuse | 0xFF | — |
| lock | 0xFF | No lock bits |

> **Warning:** setting lfuse 0xF7 requires an external crystal. Attempting to read back fuses without a crystal present will leave the device unresponsive; use the programmer's external-clock option to recover.

---

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Build config & timing (F_CPU, fuses) | ✅ Done |
| 2 | Pin defs & init, power-on reset | ✅ Done |
| 3 | Display path (PIA → serial) | ✅ Done |
| 4 | Key injection (`sendKey`) | ✅ Done |
| 5 | Serial input + control shortcuts | ✅ Done |
| 6 | PS/2 ISR decoder + Set-2 keymap | ✅ Done |
| 7 | KBDRESB / KBDCLRB control signals | ✅ Done |
| 8 | README | ✅ Done |
| 9 | Hardware verification | ⏳ Pending |
| — | Composite video | 🔮 Future |

---

## Future: Composite Video

- `putDisplayChar()` and `clearScreen()` already contain hooks for a video framebuffer.
- PC0–PC2 are wired to a resistor-ladder DAC for composite output.
- A timer ISR will generate the video signal; the main loop is kept non-blocking to avoid tearing.

---

## License

See the main repository LICENSE file for licensing information.

