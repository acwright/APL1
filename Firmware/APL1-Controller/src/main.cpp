#include <Arduino.h>

// ---------------------------------------------------------------------------
// Port / pin macros
// ---------------------------------------------------------------------------

// PORTA  PA0-6 = keyboard ASCII data to PIA PA0-6; PA7 = STROBE (CA1)
//        Idle = Hi-Z input (driven only while injecting a key)
#define PA_DATA_MASK    0x7F
#define PA_STROBE_BIT   7

// PORTB  PB0-6 = display data from PIA; PB7 = DA (display available)
//        The PIA CB2 handshake output is active-LOW, but it passes through an
//        external 74HC04 inverter (U1) before reaching PB7, so at the ATmega
//        DA is active-HIGH: PB7 HIGH = 6502 has written a char (DA asserted).
#define PB_DISP_MASK    0x7F
#define PB_DA_BIT       7

// PORTC  PC0-2 = video DAC outputs (deferred, kept low)
//        PC3-6 = unused inputs w/ pullup
//        PC7   = RDAB -> CB1 (active-low pulse; idle HIGH)
#define PC_DAC_MASK     0x07
#define PC_RDAB_BIT     7
#define PC_RDAB_LOW()   (PORTC &= ~(1 << PC_RDAB_BIT))
#define PC_RDAB_HIGH()  (PORTC |=  (1 << PC_RDAB_BIT))

// PORTD  PD0=RXD  PD1=TXD  PD2=PS2CLK(INT0)  PD3=PS2DATA
//        PD4=KBDRESB(in,active-low)  PD5=KBDCLR(in,active-HIGH)
//        PD6=KBDENB(out,active-low: LOW=74LS245 enabled)
//        PD7=RESB(out,active-low reset to 6502)
#define PD_RXD_BIT      0
#define PD_TXD_BIT      1
#define PD_PS2CLK_BIT   2
#define PD_PS2DATA_BIT  3
#define PD_KBDRESB_BIT  4
#define PD_KBDCLR_BIT   5
#define PD_KBDENB_BIT   6
#define PD_RESB_BIT     7

#define KBDENB_ENABLE()   (PORTD &= ~(1 << PD_KBDENB_BIT))  // LOW  = 74LS245 enabled
#define KBDENB_DISABLE()  (PORTD |=  (1 << PD_KBDENB_BIT))  // HIGH = buffer disabled

#define RESB_ASSERT()     (PORTD &= ~(1 << PD_RESB_BIT))    // LOW  = 6502 in reset
#define RESB_RELEASE()    (PORTD |=  (1 << PD_RESB_BIT))    // HIGH = 6502 running

// ---------------------------------------------------------------------------
// PS/2 Set-2 scancode tables (US layout -> Apple-1 ASCII, bit7 set)
//   Index = Set-2 make code (0x00-0x7F); 0x00 = no mapping.
//   Letters are always uppercase; shift only affects digits and symbols.
// ---------------------------------------------------------------------------
static const uint8_t PROGMEM ps2_base[128] = {
//  0     1     2     3     4     5     6     7     8     9     A     B     C     D     E     F
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x00, // 00  (0x0E=`)
    0x00, 0x00, 0x00, 0x00, 0x00, 0xD1, 0xB1, 0x00, 0x00, 0x00, 0xDA, 0xD3, 0xC1, 0xD7, 0xB2, 0x00, // 10  Q 1 Z S A W 2
    0x00, 0xC3, 0xD8, 0xC4, 0xC5, 0xB4, 0xB3, 0x00, 0x00, 0xA0, 0xD6, 0xC6, 0xD4, 0xD2, 0xB5, 0x00, // 20  C X D E 4 3 Sp V F T R 5
    0x00, 0xCE, 0xC2, 0xC8, 0xC7, 0xD9, 0xB6, 0x00, 0x00, 0x00, 0xCD, 0xCA, 0xD5, 0xB7, 0xB8, 0x00, // 30  N B H G Y 6 M J U 7 8
    0x00, 0xAC, 0xCB, 0xC9, 0xCF, 0xB0, 0xB9, 0x00, 0x00, 0xAE, 0xAF, 0xCC, 0xBB, 0xD0, 0xAD, 0x00, // 40  , K I O 0 9 . / L ; P -
    0x00, 0x00, 0xA7, 0x00, 0xDB, 0xBD, 0x00, 0x00, 0x00, 0x00, 0x8D, 0xDD, 0x00, 0xDC, 0x00, 0x00, // 50  ' [ = Enter ] bksl
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xDF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 60  (0x66=Backspace->_)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x9B, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // 70  (0x76=ESC)
};

static const uint8_t PROGMEM ps2_shifted[128] = {
//  0     1     2     3     4     5     6     7     8     9     A     B     C     D     E     F
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFE, 0x00, // 00  (`->~)
    0x00, 0x00, 0x00, 0x00, 0x00, 0xD1, 0xA1, 0x00, 0x00, 0x00, 0xDA, 0xD3, 0xC1, 0xD7, 0xC0, 0x00, // 10  (1->! 2->@)
    0x00, 0xC3, 0xD8, 0xC4, 0xC5, 0xA4, 0xA3, 0x00, 0x00, 0xA0, 0xD6, 0xC6, 0xD4, 0xD2, 0xA5, 0x00, // 20  (4->$ 3-># 5->%)
    0x00, 0xCE, 0xC2, 0xC8, 0xC7, 0xD9, 0xDE, 0x00, 0x00, 0x00, 0xCD, 0xCA, 0xD5, 0xA6, 0xAA, 0x00, // 30  (6->^ 7->& 8->*)
    0x00, 0xBC, 0xCB, 0xC9, 0xCF, 0xA9, 0xA8, 0x00, 0x00, 0xBE, 0xBF, 0xCC, 0xBA, 0xD0, 0xDF, 0x00, // 40  (,->< 0->) 9->( .-> > /->? ;->: ->>_)
    0x00, 0x00, 0xA2, 0x00, 0xFB, 0xAB, 0x00, 0x00, 0x00, 0x00, 0x8D, 0xFD, 0x00, 0xFC, 0x00, 0x00, // 50  ('->" [->{ =->+ ]->} \->|)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xDF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 60
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x9B, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // 70
};

// PS/2 ring buffer (written by ISR, read by main loop)
#define PS2_BUF_SIZE 16                        // must be a power of 2
static volatile uint8_t ps2_buf[PS2_BUF_SIZE];
static volatile uint8_t ps2_head = 0;          // ISR writes here
static volatile uint8_t ps2_tail = 0;          // main reads here

// ---------------------------------------------------------------------------
// Throttle ("slow") mode
//   Toggled at runtime by Ctrl-T (0x14) over serial.
//   FALSE = full speed (UART-buffered, 6502 barely waits on the DA flag).
//   TRUE  = emulate the original Apple-1 terminal: before clearing the DA
//           flag we keep it asserted for SLOW_CHAR_DELAY_MS, which forces the
//           6502 to spin in WozMon's `BIT DSP / BMI ECHO` loop just as it did
//           against the real video hardware (~60 characters/second).
// ---------------------------------------------------------------------------
#define SLOW_CHAR_DELAY_MS 16                  // ~60 chars/sec, original feel
static bool slowMode = false;

// ---------------------------------------------------------------------------
// putDisplayChar()  (video buffer hook deferred)
// ---------------------------------------------------------------------------
void putDisplayChar(uint8_t c) {
    Serial.write(c);
    // Future: also write to video buffer
}

// ---------------------------------------------------------------------------
// sendKey()  inject one Apple-1 ASCII byte into the PIA
// ---------------------------------------------------------------------------
// ascii : Apple-1 style (bit7 set, uppercase).
//
// The keyboard STROBE (PIA CA1) line is driven, when idle, by the keyboard
// through the 74LS245 (B8). Measured on real hardware the keyboard idles this
// line HIGH, and the PIA is set to latch keyboard data on the RISING edge of
// CA1 (KBDCR = $A7). Injection therefore has to produce EXACTLY ONE rising edge
// on CA1, and must hand the line back to the '245 at the same idle level it
// found it - otherwise the '245 re-asserting the idle HIGH level creates a
// SECOND, phantom rising edge that latches the idle bus value (0x7F -> reads
// 0xFF) which WozMon rejects by echoing "\". That phantom was the bug.
void sendKey(uint8_t ascii) {
    // Capture the keyboard's idle CA1 level while the '245 still drives the bus
    // and PORTA is input. We restore CA1 to this exact level before handing the
    // bus back, making the '245 takeover a same-level (no-edge) transition.
    uint8_t idleHigh = (PINA >> PA_STROBE_BIT) & 1;

    KBDENB_DISABLE();                           // PD6 HIGH – take bus from '245

    // Drive CA1 LOW first, then HIGH, so the latch is one clean rising edge.
    DDRA  = 0xFF;                               // PA all outputs
    PORTA = ascii & PA_DATA_MASK;               // PA0-6 = data; PA7 (CA1) LOW
    delayMicroseconds(2);                       // data setup time
    PORTA |=  (1 << PA_STROBE_BIT);             // CA1 LOW→HIGH: latch injected key
    delayMicroseconds(20);                      // PIA latch hold time

    // Restore CA1 to the keyboard idle level. With idle HIGH we simply hold it
    // HIGH (no further edge). If idle were LOW we drop it (a falling edge, which
    // the PIA ignores). Either way no extra RISING edge is produced.
    if (idleHigh) PORTA |=  (1 << PA_STROBE_BIT);
    else          PORTA &= ~(1 << PA_STROBE_BIT);

    // Release PA0-6 but keep driving CA1 at the idle level during the handoff.
    DDRA  = (1 << PA_STROBE_BIT);               // PA0-6 Hi-Z, PA7 still output
    delayMicroseconds(2);

    KBDENB_ENABLE();                            // PD6 LOW – '245 re-drives CA1 to
                                                // the same idle level: no edge
    delayMicroseconds(2);                       // let the '245 take over CA1

    DDRA  = 0x00;                               // PA back to Hi-Z inputs
    PORTA = 0x00;
}

// ---------------------------------------------------------------------------
// PS/2 frame ISR  (INT0, triggered on falling edge of PS2CLK/PD2)
//   11-bit frame: start(0) | D0..D7 LSB-first | parity(odd) | stop(1)
// ---------------------------------------------------------------------------
ISR(INT0_vect) {
    static uint16_t sr  = 0;   // 11-bit shift register (bit 0 = first received)
    static uint8_t  cnt = 0;   // counts received bits (0..10)

    // Shift in data bit sampled on the falling clock edge
    sr |= (uint16_t)((PIND >> PD_PS2DATA_BIT) & 1) << cnt;

    if (++cnt == 11) {
        // Validate: start=0, stop=1, odd parity over 9-bit field (data + parity)
        if (!(sr & 1) &&                             // start bit must be 0
            ((sr >> 10) & 1) &&                      // stop  bit must be 1
            __builtin_parity((sr >> 1) & 0x1FF)) {   // 8 data + 1 parity = odd
            uint8_t byte = (uint8_t)(sr >> 1);
            uint8_t next = (ps2_head + 1) & (PS2_BUF_SIZE - 1);
            if (next != ps2_tail) {                  // drop if buffer full
                ps2_buf[ps2_head] = byte;
                ps2_head = next;
            }
        }
        sr  = 0;
        cnt = 0;
    }
}

// ---------------------------------------------------------------------------
// PS/2 scancode decoder  (Set-2, stateful)
// ---------------------------------------------------------------------------
static uint8_t ps2_state = 0;  // 0=normal 1=F0-break 2=E0-ext 3=E0-F0-ext-break
static uint8_t ps2_mods  = 0;  // bit0=shift  bit1=ctrl  bit2=alt

// Called by KBDRESB handler to clear decoder state
static inline void resetPS2State() { ps2_state = 0; ps2_mods = 0; }

// Forward declarations (defined after processPS2)
static void clearScreen();
static void doReset();

static void processPS2(uint8_t sc) {
    uint8_t &state = ps2_state;
    uint8_t &mods  = ps2_mods;

    switch (state) {
        case 0:  // --- normal: watch for prefix bytes or process make code ---
            if      (sc == 0xF0) { state = 1; return; }
            else if (sc == 0xE0) { state = 2; return; }
            // Modifier make events
            if (sc == 0x12 || sc == 0x59) { mods |=  0x01; return; }  // L/R Shift
            if (sc == 0x14)               { mods |=  0x02; return; }  // L Ctrl
            if (sc == 0x11)               { mods |=  0x04; return; }  // L Alt
            if (sc == 0x58) return;                                    // Caps Lock: ignored
            // Ctrl+L -> clear screen; Ctrl+\ -> reset 6502; Ctrl+T -> toggle
            // throttle (consume, do not forward)
            if (sc == 0x4B && (mods & 0x02)) { clearScreen(); return; }
            if (sc == 0x5D && (mods & 0x02)) { doReset();     return; }
            if (sc == 0x2C && (mods & 0x02)) { slowMode = !slowMode; return; }
            {
                uint8_t ascii = (sc < 128)
                    ? ((mods & 0x01)
                        ? pgm_read_byte(&ps2_shifted[sc])
                        : pgm_read_byte(&ps2_base[sc]))
                    : 0;
                if (ascii) sendKey(ascii);
            }
            break;

        case 1:  // --- F0 break: release event ---
            state = 0;
            if (sc == 0x12 || sc == 0x59) mods &= ~0x01;  // L/R Shift release
            if (sc == 0x14)               mods &= ~0x02;  // L Ctrl release
            if (sc == 0x11)               mods &= ~0x04;  // L Alt release
            break;

        case 2:  // --- E0 extended make ---
            if (sc == 0xF0) { state = 3; return; }         // E0 F0 break follows
            state = 0;
            if (sc == 0x14) { mods |=  0x02; return; }  // R Ctrl make (E0 14)
            if (sc == 0x11) { mods |=  0x04; return; }  // R Alt  make (E0 11)
            // Ctrl+Alt+Del -> reset 6502 (consume key)
            if (sc == 0x71 && (mods & 0x06) == 0x06) { doReset(); return; }
            break;

        case 3:  // --- E0 F0 extended break ---
            state = 0;
            if (sc == 0x14) mods &= ~0x02;  // R Ctrl release (E0 F0 14)
            if (sc == 0x11) mods &= ~0x04;  // R Alt  release (E0 F0 11)
            break;
    }
}

// ---------------------------------------------------------------------------
// clearScreen() / doReset()  (shared by KBDCLR, PS/2, serial)
// ---------------------------------------------------------------------------
static void clearScreen() {
    // ANSI ESC[2J = erase display, ESC[;H = cursor home (matches CoolTerm "Home display" pattern; valid VT100)
    Serial.print(F("\x1B[2J\x1B[;H"));
    // Future: also clear video framebuffer
}

static void doReset() {
    resetPS2State();
    RESB_ASSERT();
    delay(10);          // 6502 reset pulse (≥2 clock cycles; 10 ms comfortable)
    RESB_RELEASE();
}

// ---------------------------------------------------------------------------
// setup()
// ---------------------------------------------------------------------------
void setup() {
    // --- PORTA: all inputs, no pullups (Hi-Z) until key injection ---
    DDRA  = 0x00;
    PORTA = 0x00;

    // --- PORTB: all inputs. DA (PB7) is driven by the 74HC04 (U1) output, so no
    //     pull-up is used: an internal pull-up would force PB7 HIGH and, because
    //     DA is active-HIGH here, register as a permanent (false) DA assertion.
    DDRB  = 0x00;
    PORTB = 0x00;               // no pull-ups; U1 actively drives DA, PIA drives PB0-6

    // --- PORTC ---
    // PC0-2 = outputs (video DAC, deferred), drive LOW
    // PC3-6 = unused inputs with pullup (defined state)
    // PC7   = output, idle HIGH (RDAB)
    DDRC  = (1 << PC_RDAB_BIT) | PC_DAC_MASK;    // 0x87
    PORTC = (1 << PC_RDAB_BIT)                    // RDAB idle HIGH
          | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6); // PC3-6 pullups; 0xF8 total

    // --- PORTD ---
    // PD0 = RXD input  (UART)
    // PD1 = TXD output (UART)
    // PD2-5 = inputs; PS2CLK, PS2DATA, KBDRESB have pullup; KBDCLR has NO pullup
    //   (KBDCLR is active-HIGH: idle LOW, goes HIGH when key pressed)
    // PD6 = KBDENB output, start LOW (74LS245 buffer enabled)
    // PD7 = RESB  output, start LOW (6502 held in reset)
    DDRD  = (1 << PD_TXD_BIT) | (1 << PD_KBDENB_BIT) | (1 << PD_RESB_BIT); // 0xC2
    PORTD = (1 << PD_PS2CLK_BIT) | (1 << PD_PS2DATA_BIT)
          | (1 << PD_KBDRESB_BIT);
    // KBDCLR (PD5) = 0 → no pullup; PD6 (KBDENB) = 0 → enabled; PD7 (RESB) = 0 → 6502 in reset  (0x1C)

    Serial.begin(115200);   // init UART before releasing 6502 reset

    // --- Power-on reset: hold RESB low, then release ---
    delay(10);       // 10 ms – allows supply rails to stabilise
    RESB_RELEASE();  // PD7 HIGH – release 6502 from reset

    // --- PS/2: INT0 on PD2 falling edge ---
    EICRA = (EICRA & ~0x03) | (1 << ISC01);   // ISC01=1, ISC00=0 = falling edge
    EIMSK |= (1 << INT0);                      // enable INT0
}

// ---------------------------------------------------------------------------
// loop()
// ---------------------------------------------------------------------------
void loop() {
    // --- Display path (PIA -> serial) ---
    // DA is active-HIGH at the ATmega (PIA CB2 is active-low but inverted by U1):
    // PB7 HIGH means the 6502 has written a char to the PIA.
    if (PINB & (1 << PB_DA_BIT)) {
        uint8_t c = PINB & PB_DISP_MASK;       // read PB0-6 (bit7 = DA, ignored)

        // Throttle mode: leave DA asserted so the 6502 keeps spinning in its
        // output-polling loop, replicating the original terminal's slow rate.
        if (slowMode) {
            delay(SLOW_CHAR_DELAY_MS);
        }

        // Acknowledge: pulse RDAB (CB1) low to clear the DA flag in the PIA
        PC_RDAB_LOW();
        delayMicroseconds(20);  // >1 PIA E-clock cycle; was 5 µs (too marginal)
        PC_RDAB_HIGH();

        // Apple-1 always sends 7-bit ASCII; translate bare CR -> CRLF for serial
        if (c == 0x0D) {
            putDisplayChar('\r');
            putDisplayChar('\n');
        } else {
            putDisplayChar(c);
        }
    }

    // --- Serial input (PC -> PIA) ---
    if (Serial.available()) {
        uint8_t c = (uint8_t)Serial.read();
        // Ctrl+L (0x0C FF) -> clear screen; Ctrl+\ (0x1C FS) -> reset 6502
        // Ctrl+T (0x14 DC4) -> toggle throttle (full speed <-> original feel)
        if (c == 0x0C) { clearScreen(); }
        else if (c == 0x1C) { doReset(); }
        else if (c == 0x14) { slowMode = !slowMode; }
        else {
            if (c >= 'a' && c <= 'z') c -= 32;  // force uppercase
            c |= 0x80;                           // set bit 7 (Apple-1 style)
            sendKey(c);
        }
    }

    // --- PS/2 input ---
    if (ps2_tail != ps2_head) {
        uint8_t sc = ps2_buf[ps2_tail];
        ps2_tail = (ps2_tail + 1) & (PS2_BUF_SIZE - 1);
        processPS2(sc);
    }

    // --- Control signals (KBDRESB active-low / KBDCLR active-high, debounced) ---
    // Integrating debounce: each input must remain CONTINUOUSLY in its active
    // state for the whole window before firing. Any single sample in the
    // inactive state re-arms (resets) the timer, so brief noise glitches – e.g.
    // crosstalk coupled onto the keyboard ribbon's RESET line while the PA bus
    // and 74LS245 are switching during heavy serial/key-injection traffic – can
    // no longer accumulate into a spurious reset or clear. A genuine button
    // press is held far longer than the window, so usability is unaffected.
    // NOTE: KBDCLR (PD5) requires an external ~10 kΩ pull-down resistor to GND.
    //       Without it the pin floats HIGH and button presses cannot be detected.
    {
        const uint16_t  KBD_DEBOUNCE_MS = 40;   // continuous active time required
        static bool     resb_armed = false, clr_armed = false;
        static uint32_t resb_t     = 0,     clr_t     = 0;

        uint8_t  resb   = (PIND >> PD_KBDRESB_BIT) & 1;   // active LOW
        uint8_t  clr    = (PIND >> PD_KBDCLR_BIT)  & 1;   // active HIGH
        uint32_t now_ms = millis();

        // KBDRESB: must read LOW on every sample across the whole window
        if (resb) {
            resb_armed = false;                          // released / glitch -> re-arm
        } else if (!resb_armed) {
            resb_armed = true;  resb_t = now_ms;
        } else if (now_ms - resb_t >= KBD_DEBOUNCE_MS) {
            resb_armed = false;
            doReset();
        }

        // KBDCLR: must read HIGH on every sample across the whole window
        if (!clr) {
            clr_armed = false;
        } else if (!clr_armed) {
            clr_armed = true;   clr_t = now_ms;
        } else if (now_ms - clr_t >= KBD_DEBOUNCE_MS) {
            clr_armed = false;
            clearScreen();
        }
    }
}