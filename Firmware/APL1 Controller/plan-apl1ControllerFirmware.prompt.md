# Plan: APL1 Controller Firmware (PS/2 + Serial, video deferred)

## Context
- Target: ATmega1284(P), Arduino framework via PlatformIO, single `src/main.cpp`, custom PS/2 decoder.
- External crystal 28.63636 MHz (8x NTSC colorburst) -> F_CPU = 28636363L. Overclock (1284 rated 20MHz) intentional for future composite video.
- Role: replicate Apple-1 terminal circuitry against a 6521 PIA + add PS/2 and serial. Video deferred but design kept compatible. Circuit is a faithful Apple-1 clone.

## Confirmed decisions
- Display handshake: PIA PB7 -> external inverter -> DA (active-LOW) read on 1284 PB7. 1284 reads PB0-6, then pulses RDAB LOW on PC7 (-> CB1) to clear DA. Matches original Apple-1.
- Keymap: Apple-1 style, uppercase only, bit 7 set. CR = 0x8D. Letters always uppercase; shift affects digit/symbol row only; caps lock ignored.
- Input arbitration: time-multiplex all three sources simultaneously. ASCII-keyboard 74LS245 normally enabled (KBDENB); when PS/2 or serial key arrives, briefly disable buffer, drive PA from 1284, re-enable.
- Serial: 115200 8N1, no local echo (6502 echoes). With 28.636MHz use U2X (Arduino core handles; ~0.2% error -> OK).
- Structure: single main.cpp, custom ISR-based PS/2 decoder.
- STROBE/CA1 = rising-edge active.
- CR -> CRLF on serial out: yes.
- lfuse = 0xF7 VERIFIED vs ATmega1284 datasheet: CKDIV8=1(off), CKOUT=1, SUT=11 (slow rising power), CKSEL=0111 Full-Swing Crystal Osc (covers >16MHz). hfuse=0xff efuse=0xff lock=0xff.
- KBDENB active-low (74LS245 OE). Idle LOW=buffer enabled; drive HIGH to disable while 1284 injects a key.

## Pin map (set ALL pins, including unused)
- PORTA: PA0-6 = keyboard ASCII data out to PIA PA0-6; PA7 = STROBE -> CA1. Idle = INPUT/Hi-Z. Drive only while sending a key.
- PORTB: PB0-6 = display data in from PIA (INPUT); PB7 = DA active-low (INPUT). All inputs.
- PORTC: PC0-2 = video DAC (1k/820/820) OUTPUT low (deferred); PC7 = RDAB out -> CB1, idle HIGH; PC3-6 unused -> INPUT w/ pullup (defined state).
- PORTD: PD0=RXD, PD1=TXD; PD2=PS2CLK (INT0, INPUT pullup); PD3=PS2DATA (INPUT pullup); PD4=KBDRESB (INPUT pullup, active low); PD5=KBDCLRB (INPUT pullup, active low); PD6=KBDENB out (74LS245 OE, active-low: LOW=enabled); PD7=RESB out (reset to 6502, active low).

## Phases / Steps

### Phase 1 - Build config & timing
1. platformio.ini: set board_build.f_cpu = 28636363L in BOTH envs (atmega1284p, atmega1284).
2. fuses.cfg: lfuse=0xF7 (full-swing crystal >16MHz, CKDIV8 off, SUT slow rising). hfuse=0xff, efuse=0xff, lock=0xff.

### Phase 2 - Pin defs & init (setup())
3. Add pin/port macros at top of main.cpp for PA/PB/PC/PD per map.
4. Configure DDR/PORT for every pin incl. unused PC3-6. Initial states: PA=Hi-Z input, PB=input, PC0-2=output low, PC7=output high (RDAB idle), PD6 KBDENB=enabled (LOW), PD7 RESB=output, PD2/3/4/5=input pullup.
5. Power-on reset: drive RESB (PD7) low ~few ms, release high.

### Phase 3 - Display path (PIA -> serial)  [parallel-capable with Phase 4]
6. Serial.begin(115200).
7. Abstraction: putDisplayChar(c) -> currently Serial.write; future also video buffer.
8. Loop: detect DA (PB7 == LOW); read PB0-6; mask 0x7F; strip bit7; translate CR(0x0D)->CRLF for serial; putDisplayChar; pulse RDAB (PC7) low ~few us then high.

### Phase 4 - Keyboard injection (-> PIA)
9. sendKey(ascii): disable KBDENB (set PD6 high), set PA as outputs, drive (ascii & 0x7F) on PA0-6, generate rising-edge STROBE on PA7 (CA1, hold ~tens of us), return PA to Hi-Z input, re-enable KBDENB (PD6 low).

### Phase 5 - Serial input
10. Loop: if Serial.available, read byte, uppercase a-z, set bit7, sendKey().
    - Ctrl+L (0x0C) -> clearScreen() (consume, do not forward).
    - Ctrl+\ (0x1C) -> doReset() (consume, do not forward).

### Phase 6 - PS/2 input (custom decoder)
11. INT0 ISR on PD2 falling edge: sample PD3, shift 11-bit frame (start/8 data LSB-first/odd parity/stop), validate, push scancode to ring buffer.
12. Main: decode Set-2 scancodes: 0xF0 break, 0xE0 extended, modifiers Shift(0x12/0x59) Ctrl(0x14/E0-14) Alt(0x11/E0-11) (Caps ignored). Map make codes via table to Apple-1 ASCII (uppercase, bit7 set). Map Enter->0x8D, ESC(0x76)->0x9B, Backspace->0xDF ('_'). sendKey().
    - Ctrl+L (scan 0x4B with Ctrl mod) -> clearScreen() (consume).
    - Ctrl+\ (scan 0x5D with Ctrl mod) -> doReset() (consume).
    - Ctrl+Alt+Del (E0 0x71 with both Ctrl+Alt) -> doReset() (consume).

### Phase 7 - Control signals
13. KBDRESB (PD4 low, debounced) -> assert RESB low pulse + reset PS/2 state.
14. KBDCLRB (PD5 low, debounced) -> clear screen: send ANSI clear (ESC[2J ESC[H) to serial now; video clear later.

### Phase 8 - README
15. Rewrite README.md: overview, hardware (1284 @28.636MHz), full pinout table, features (ASCII kbd / PS/2 / serial, video deferred), DA/RDAB + strobe handshake description, key injection sequence, control shortcuts (buttons + PS/2 hotkeys + serial hotkeys), build/flash (PlatformIO + minipro), fuse values + recovery warning, project status table, future video notes.

### Phase 9 - Verify
16. pio run (both envs build clean).
17. Flash code + fuses via minipro.
18. Manual: PS/2 typing echoes via serial through WozMon; serial input drives 6502; ASCII keyboard still works (buffer multiplex); KBDRESB resets; KBDCLRB clears.
19. Logic analyzer: verify STROBE/CA1 edge, DA/RDAB handshake timing, no PA bus contention.

## Relevant files
- platformio.ini - f_cpu both envs
- fuses.cfg - lfuse full-swing xtal (0xF7)
- src/main.cpp - all firmware (single file)
- README.md - rewrite

## Future video compatibility
- Keep putDisplayChar() abstraction and non-blocking main loop.
- Reserve PC0-2 DAC + a timer for video; don't busy-wait long in handlers.
