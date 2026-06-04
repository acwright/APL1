.setcpu "6502"
.segment "WOZMON"

; Page 0 Variables

XAML  = $24             ; Last "opened" location Low
XAMH  = $25             ; Last "opened" location High
STL   = $26             ; Store address Low
STH   = $27             ; Store address High
L     = $28             ; Hex value parsing Low
H     = $29             ; Hex value parsing High
YSAV  = $2A             ; Used to see if hex value is given
MODE  = $2B             ; $00=XAM, $7F=STOR, $AE=BLOCK XAM

; Other Variables

IN    = $0200           ; Input buffer to $027F
KBD   = $D010           ; PIA.A keyboard input
KBDCR = $D011           ; PIA.A keyboard control register
DSP   = $D012           ; PIA.B display output register
DSPCR = $D013           ; PIA.B display control register

Reset:
  cld                   ; Clear decimal arithmetic mode.
  cli
  ldy #$7F              ; Mask for DSP data direction register.
  sty DSP               ; Set it up.
  lda #$A7              ; KBD and DSP control register mask.
  sta KBDCR             ; Enable interrupts, set CA1, CB1, for
  sta DSPCR             ;  positive edge sense/output mode.

NotCr:
  cmp #$DF              ; "_"?
  beq BackSpace         ; Yes.
  cmp #$9B              ; ESC?
  beq Escape            ; Yes.
  iny                   ; Advance text index.
  bpl NextChar          ; Auto ESC if > 127.

Escape:
  lda #$DC              ; "\".
  jsr Echo              ; Output it.

GetLine:
  lda #$8D              ; CR.
  jsr Echo              ; Output it.
  ldy #$01              ; Initialize text index.

BackSpace:
  dey                   ; Back up text index.
  bmi GetLine           ; Beyond start of line, reinitialize.

NextChar:
  lda KBDCR             ; Key ready?
  bpl NextChar          ; Loop until ready.
  lda KBD               ; Load character. B7 should be '1'.
  sta IN,Y              ; Add to text buffer.
  jsr Echo              ; Display character.
  cmp #$8D              ; CR?
  bne NotCr             ; No.
  ldy #$FF              ; Reset text index.
  lda #$00              ; For XAM mode.
  tax                   ; 0->X.

SetStor:
  asl                   ; Leaves $7B if setting STOR mode.
SetMode:
  sta MODE              ; $00=XAM, $7B=STOR, $AE=BLOCK XAM.
BlSkip:
  iny                   ; Advance text index.
NextItem:
  lda IN,Y              ; Get character.
  cmp #$8D              ; CR?
  beq GetLine           ; Yes, done this line.
  cmp #$AE              ; "."?
  bcc BlSkip            ; Skip delimiter.
  beq SetMode           ; Set BLOCK XAM mode.
  cmp #$BA              ; ":"?
  beq SetStor           ; Yes. Set STOR mode.
  cmp #$D2              ; "R"?
  beq Run               ; Yes. Run user program.
  stx L                 ; $00->L.
  stx H                 ;  and H.
  sty YSAV              ; Save Y for comparison.

NextHex:
  lda IN,Y              ; Get character for hex test.
  eor #$B0              ; Map digits to $0-9.
  cmp #$0A              ; Digit?
  bcc Dig               ; Yes.
  adc #$88              ; Map letter "A"-"F" to $FA-FF.
  cmp #$FA              ; Hex letter?
  bcc NotHex            ; No, character not hex.

Dig:
  asl
  asl                   ; Hex digit to MSD of A.
  asl
  asl
  ldx #$04              ; Shift count.

HexShift:
  asl                   ; Hex digit left, MSB to carry.
  rol L                 ; Rotate into LSD.
  rol H                 ; Rotate into MSD's.
  dex                   ; Done 4 shifts?
  bne HexShift          ; No, loop.
  iny                   ; Advance text index.
  bne NextHex           ; Always taken. Check next character for hex.

NotHex:
  cpy YSAV              ; Check if L, H empty (no hex digits).
  beq Escape            ; Yes, generate ESC sequence.
  bit MODE              ; Test MODE byte.
  bvc NotStor           ; B6=0 STOR, 1 for XAM and BLOCK XAM.
  lda L                 ; LSD's of hex data.
  sta (STL,X)           ; Store at current 'store index'.
  inc STL               ; Increment store index.
  bne NextItem          ; Get next item. (no carry).
  inc STH               ; Add carry to 'store index' high order.

ToNextItem:
  jmp NextItem          ; Get next command item.

Run:
  jmp (XAML)            ; Run at current XAM index.

NotStor:
  bmi XamNext           ; B7=0 for XAM, 1 for BLOCK XAM.
  ldx #$02              ; Byte count.

SetAdr:
  lda L-1,X             ; Copy hex data to
  sta STL-1,X           ;  'store index'.
  sta XAML-1,X          ; And to 'XAM index'.
  dex                   ; Next of 2 bytes.
  bne SetAdr            ; Loop unless X=0.

NxtPrnt:
  bne PrData            ; NE means no address to print.
  lda #$8D              ; CR.
  jsr Echo              ; Output it.
  lda XAMH              ; 'Examine index' high-order byte.
  jsr PrByte            ; Output it in hex format.
  lda XAML              ; Low-order 'examine index' byte.
  jsr PrByte            ; Output it in hex format.
  lda #$BA              ; ":".
  jsr Echo              ; Output it.

PrData:
  lda #$A0              ; Blank.
  jsr Echo              ; Output it.
  lda (XAML,X)          ; Get data byte at 'examine index'.
  jsr PrByte            ; Output it in hex format.

XamNext:
  stx MODE              ; 0->MODE (XAM mode).
  lda XAML
  cmp L                 ; Compare 'examine index' to hex data.
  lda XAMH
  sbc H
  bcs ToNextItem        ; Not less, so no more data to output.
  inc XAML
  bne Mod8Chk           ; Increment 'examine index'.
  inc XAMH

Mod8Chk:
  lda XAML              ; Check low-order 'examine index' byte
  and #$07              ;  For MOD 8=0
  bpl NxtPrnt           ; Always taken.

PrByte:
  pha                   ; Save A for LSD.
  lsr
  lsr
  lsr                   ; MSD to LSD position.
  lsr
  jsr PrHex             ; Output hex digit.
  pla                   ; Restore A.

PrHex:
  and #$0F              ; Mask LSD for hex print.
  ora #$B0              ; Add "0".
  cmp #$BA              ; Digit?
  bcc Echo              ; Yes, output it.
  adc #$06              ; Add offset for letter.

Echo:
  bit DSP               ; DA bit (B7) cleared yet?
  bmi Echo              ; No, wait for display.
  sta DSP               ; Output character. Sets DA.
  rts                   ; Return.

  brk                   ; unused
  brk                   ; unused

.segment "VECTORS"

  .word $0F00           ; NMI
  .word Reset           ; RESET
  .word $0000           ; BRK/IRQ