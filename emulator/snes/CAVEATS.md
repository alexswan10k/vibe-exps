# SNES C Development Caveats & Language Quirks

When developing C games for the Super Nintendo (SNES) using **PVSnesLib** and the **tcc-65816** compiler, you must work around several critical compiler limitations and hardware memory architecture constraints.

---

## 1. 24-Bit Addressing and 32-Bit C Pointers

### The Quirks
- **tcc-65816 Pointer Size:** The compiler implements pointers as 32-bit types, but the upper byte (which corresponds to the bank byte on the 65816 CPU's 24-bit address space) is **assumed or initialized to zero**. 
- **16-Bit Pointer Arithmetic:** Pointer arithmetic and array indexing are restricted to 16 bits. It is impossible to cross a 64KB bank boundary using standard C pointer arithmetic.
- **Bank Information Loss:** Converting pointers to scalars or doing complex pointer casting strips away the target bank byte, forcing the address back to Bank 0.

### The Problem
When you declare a global constant structure, e.g.:
```c
const char level_template[MAP_HEIGHT][MAP_WIDTH + 1] = { ... };
```
The compiler stores this in the `.rodata` (read-only data) section in ROM. On LoROM mapping, ROM is placed in higher banks (typically starting at bank `$80` or mirrored at `$00:8000+`). 
When you dereference a pointer to `level_template` in C, the compiler generates instructions accessing the offset in the **default data bank (Bank 0)**. 
- Bank 0 `$0000-$1FFF` maps to **WRAM** (Work RAM).
- Bank 0 `$2000-$5FFF` maps to **hardware registers** (PPU, APU, DMA, controllers).
- Consequently, dereferencing the ROM pointer reads random memory/registers rather than the ROM data, resulting in garbage characters and broken collision mapping.

### The Solution
- **Omit the `const` Keyword for Initialized Layouts:** By declaring the template as a mutable array:
  ```c
  char level_template[MAP_HEIGHT][MAP_WIDTH + 1] = { ... };
  ```
  The compiler places the data in the `.data` section. The assembly startup routine automatically handles copying `.data` from ROM into the correct WRAM banks at boot. Because WRAM is accessed natively in Bank 0 (the first 8KB of WRAM are mirrored at `$00:0000-$00:1FFF`), C's default Bank 0 pointers can read/write the array correctly.
- **For Large Assets (Sprites/Backgrounds):** Avoid storing large assets (larger than 32KB) as C arrays. Place them in assembly source files (e.g. `data.asm`) using `.incbin` inside specific ROM sections and load them via PVSnesLib's hardware-accelerated DMA copy functions rather than standard C pointers.

---

## 2. Controller Input Reading (`padsCurrent` vs `padsDown`)

### The Quirks
- **VBlank ISR Integration:** In modern PVSnesLib versions (v4.3.0+), the manual `scanPads()` function has been removed. The controller state is automatically polled and refreshed during the VBlank Interrupt Service Routine (ISR).
- **Edge Detection vs. Continuous Polling:**
  - `padsDown(0)` checks for *edge-triggered* button presses (buttons transitioned from unpressed to pressed in the current frame).
  - `padsCurrent(0)` checks for *level-triggered* button presses (the button is currently held down).
- **Focus in Web-Based Emulators:** Emulators like EmulatorJS capture key events at the browser page/canvas level. If the emulator canvas loses focus, keyboard inputs are dropped. `padsDown` is prone to missing presses if focus is acquired slightly after the key transition, while `padsCurrent` is highly robust as it registers as long as the key continues to be held.

---

## 3. Initialised C Arrays Are Silently Discarded At Link Time

### The Symptom
A sprite/tile/palette array declared with an initialiser compiles cleanly, the
build reports success, and the ROM is produced — but the data is **not in it**:

```
DISCARD: main.obj: main.asm: Section ".data" was discarded.
DISCARD: main.obj: main.asm: Section "ram.data" was discarded.
```

At runtime the array is zero-filled, so every sprite renders as a blank
(fully transparent) tile. The game still runs; the artwork is just invisible.

### Why
The devkitsnes linker configuration discards `main.obj`'s `.data` /
`ram.data` sections. This affects **every** game built with `build.sh`, and it
is silent — nothing in the build output is an error, so it is easy to miss.

Note this is a different failure from section 1 above: the data does not end up
in the wrong bank, it is not in the ROM at all.

### The Fix
Put non-trivial graphics in assembly and `.incbin` them into `.rodata1`, the
same superfree section that carries the console font (`data.asm`). The font
works, which proves superfree sections in `data.obj` survive linking:

```asm
.section ".rodata1" superfree

snesfont:
.incbin "pvsneslibfont.pic"

vsgfx_tiles:
.incbin "gfx/vsgfx_tiles.bin"
...
.ends
```

Then reference them from C and upload with DMA (never dereference the pointer in
C — pass it straight to the DMA helpers, exactly as `consoleInitText` does with
`snesfont`):

```c
extern char vsgfx_tiles[];
oamInitGfxSet(vsgfx_tiles, 336, vpal_snake, 32, 0, 0x2000, OBJ_SIZE8);
```

Plain zero-initialised globals are fine — they land in `.bss`, which is not
discarded.

### Verifying
Do not trust a clean build as proof the art made it in. Grep the build log for
`DISCARD`, and search the finished ROM for a distinctive byte run from the
asset:

```sh
./build.sh <game> 2>&1 | grep -i discard
python3 -c "rom=open('build/game.sfc','rb').read(); \
  print(rom.find(open('src/gfx/vsgfx_tiles.bin','rb').read()))"
```

A result of `-1` means the asset is missing from the ROM.

### `.incbin` Caveat
This wla-dx build does **not** accept `.incbin "file", offset, length`. Emit one
`.bin` per blob rather than slicing a single file.

---

## 4. Sprite Art Must Be 4bpp (Four Bitplanes), Not 2bpp

### The Symptom
Sprites appear, but they look wrong and pieces of the art are simply missing —
typically small detail (eyes, highlights) vanishing entirely. The build is
clean and every asset is present in the ROM, so nothing signals a problem.

### The Cause
Video Mode 1 runs OBJ at **4bpp** — four bitplanes per row, so an 8x8 tile is
**32 bytes**, not 16:

```
row = 4 bytes (bitplanes 0..3)     8 rows * 4 = 32 bytes per tile
colour index = p0 | p1<<1 | p2<<2 | p3<<3
```

Generating only two bitplanes does not just halve the size, it caps the palette
at colours 0-3. An encoder written as:

```python
lo |= (v & 1) << (7 - x)
hi |= ((v >> 1) & 1) << (7 - x)     # WRONG: (v >> 1) & 1 is always 0 for v >= 4
```

silently encodes colour 4 as 0 and colour 5 as 1. Colour 0 is transparent for
OBJ, so any art using index 4+ **disappears**. In Void Serpent this erased the
serpent's eyes on every heading and the food orb's specular highlight.

Two things must change together, or the art is garbage:

| | Wrong | Right |
|---|---|---|
| bytes per 8x8 tile | 16 | 32 |
| OAM tile offset | `index * 2` | `index * 4` |

### Guarding It
Never trust a successful build or a byte-level spot check. Round-trip the
generated data back to something inspectable and compare it against the source
art — `tools/gengfx.py` does this in `build()` via `decode_tile`, so a
regression fails the generator instead of shipping.

Also decode the art and *look at it* before shipping. The missing eyes were
obvious the moment the tiles were printed as ASCII; they were invisible from
byte counts, offsets, and a clean build.


---

## References

1. **PVSnesLib Documentation & Source (tcc-65816 Limitations):**
   - *tcc-65816* uses 32-bit pointers with a zeroed upper byte, limiting C-level indexing and pointer arithmetic to 16 bits.
   - PVSnesLib VBlank ISR updates variables read by `padsCurrent` and `padsDown` automatically on each non-lag frame.
2. **Super Nintendo Hardware Specification (65816 CPU & Memory Map):**
   - *WRAM Bank `$7E` & `$7F`:* The SNES has 128KB of Work RAM. The first 8KB is mirrored in Bank 0 (`$00:0000-$00:1FFF`).
   - *LoROM Mapping:* Maps ROM in 32KB chunks to `$8000-$FFFF` of banks `$00-$7D` and `$80-$FF`.
