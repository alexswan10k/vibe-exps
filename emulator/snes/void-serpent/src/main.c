/*---------------------------------------------------------------------------------
    VOID SERPENT for Retro-SNES Hub
    A neon snake with void-wrap portals, drifting void shards and golden bonuses.

    - D-PAD steers, START pauses
    - Eat the orb for +10, grab the gold diamond for +50 (timed)
    - Walls are portals: leave one side, re-enter on the other.
      The glowing gates mark where the seam is.
    - Void shards drift on their own clock. They never lunge at you, but you
      can always drive into one -- as with your own tail.
    - Every 4 meals: faster, one more shard, faster shards
    - Reach length 40 to win

    Rendering note: the console text layer is a 16-colour BG, and a BG is always
    opaque, so a backdrop BG behind it could never be seen. Everything on the
    playfield is therefore drawn with OBJ sprites, which layer above every BG.
    Text is confined to the HUD and the full-screen menus.
---------------------------------------------------------------------------------*/
#include <snes.h>
#include "gfx.h"

extern char snesfont;

/* Sprite tiles and palettes are assembled into ROM by data.asm, NOT kept as
   initialised C arrays -- the devkitsnes linker discards main.obj's ".data"
   section, which would leave the graphics zero-filled. */
extern char vsgfx_tiles[];
extern char vpal_snake[];
extern char vpal_food[];
extern char vpal_bonus[];
extern char vpal_shard[];
extern char vpal_fx[];
extern char vpal_portal[];

/* Board geometry: a 32x28 grid of 8x8 text/sprite cells */
#define HUD_ROW0    0
#define HUD_ROW1    1
#define HUD_ROW2    2
#define WALL_TOP    3
#define PLAY_TOP    4
#define PLAY_BOTTOM 25
#define WALL_BOTTOM 26
#define HINT_ROW    27
#define PLAY_LEFT   1
#define PLAY_RIGHT  30

#define START_LEN 5
#define MAXLEN    48   /* stays under the 48 sprite slots reserved for the body */
#define WIN_LEN   40   /* ~39 meals -- reachable, unlike the old 80 */
#define MAXSHARD  12
#define MAXFX     10
#define FX_LIFE   22

/* Directions are ordered so the opposite of d is (d ^ 1). */
#define DIR_UP    0
#define DIR_RIGHT 1
#define DIR_DOWN  2
#define DIR_LEFT  3
#define DIR_OPPOSITE(d) ((u8)((d) ^ 1))

#define ST_TITLE 0
#define ST_PLAY  1
#define ST_DYING 2
#define ST_OVER  3
#define ST_WIN   4

/* Sprite slot map. Lower slot == higher priority, so the gate cores are
   allocated ahead of the gates in order to draw on top of them. */
#define SPR_SNAKE_BASE 0
#define SPR_FOOD       (SPR_SNAKE_BASE + MAXLEN)
#define SPR_BONUS      (SPR_FOOD + 1)
#define SPR_SHARD_BASE (SPR_BONUS + 1)
#define SPR_FX_BASE    (SPR_SHARD_BASE + MAXSHARD)
#define SPR_CORE_BASE  (SPR_FX_BASE + MAXFX)
#define SPR_GATE_BASE  (SPR_CORE_BASE + 4)
#define SPR_TOTAL      (SPR_GATE_BASE + 8)

/* OBJ palette slots. Hardware maps OBJ palette N to CGRAM byte 256 + N*32. */
#define SPRPAL_SNAKE  0
#define SPRPAL_FOOD   1
#define SPRPAL_BONUS  2
#define SPRPAL_SHARD  3
#define SPRPAL_FX     4
#define SPRPAL_PORTAL 5
#define SPRPAL_CGRAM(n) (256 + (n) * 32)

#define SPR_GFX_VRAM 0x2000

/* Mutable WRAM state (never const: see CAVEATS.md) */
u8 snake_x[MAXLEN];
u8 snake_y[MAXLEN];
u8 shard_x[MAXSHARD];
u8 shard_y[MAXSHARD];
u8 shard_dir[MAXSHARD];
u8 snake_len;
u8 shard_count;
u8 dir;
u8 next_dir;
u8 food_x, food_y;
u8 bonus_x, bonus_y;
u8 bonus_on;
u16 bonus_timer;
u8 fx_x[MAXFX], fx_y[MAXFX], fx_life[MAXFX];
u8 snake_pal;
u8 board_visible;   /* 0 on the menu screens so stray playfield sprites hide */
u16 score;
u16 hiscore;
u8 meals;
u8 level;
u8 speed;
u8 state;
u8 paused;
u8 dying_timer;
u8 won;
u8 shard_tick;
u16 frame;
u16 rng_state;
u16 prev_keys;

/* Strings built at runtime live in WRAM (.data) rather than .rodata --
   see CAVEATS.md. */
char numbuf[8];
char hudline[33];
char wallrow[33];
char wallline[33];

/* Static HUD text. Every one of these must be 32 columns or shorter: the
   console is 32 wide and an over-long line wraps, scribbling a stray character
   onto the next row (this is how a border corner used to get punched out).
   tools/checkstrings.py enforces it. */
#define TITLE_LINE "        VOID SERPENT          "
#define LEGEND     " * +10  $ +50  X KILLS  WRAPS   "
#define CONTROLS   " D-PAD MOVE   START PAUSE      "
#define PAUSED_BAR "  PAUSED  "

void my_srand(u16 s) { rng_state = s ? s : 1; }

/* xorshift16. The old generator used an LCG with multiplier 109, which has
   poor low-bit behaviour and visibly clumped placements. */
u16 my_rand(u16 limit) {
    u16 x = rng_state;
    x ^= (u16)(x << 7);
    x ^= (u16)(x >> 9);
    x ^= (u16)(x << 8);
    if (x == 0) x = 0xACE1;
    rng_state = x;
    if (limit == 0) return 0;
    return (u16)((x >> 1) % limit);
}

u8 adiff(u8 a, u8 b) { return (u8)(a > b ? a - b : b - a); }

void clear_screen(void) {
    u8 r;
    for (r = 0; r < 28; r++) consoleDrawText(0, r, "                                ");
}

/* Print an unsigned value with leading zeros into numbuf, `width` digits. */
void fmt_num(u16 val, u8 width) {
    s8 i;
    for (i = (s8)width - 1; i >= 0; i--) {
        numbuf[i] = (char)('0' + (val % 10));
        val /= 10;
    }
    numbuf[width] = 0;
}

void build_strings(void) {
    u8 i;
    for (i = 0; i < 32; i++) {
        wallrow[i] = '#';
        wallline[i] = ' ';
    }
    wallrow[32] = 0;
    wallline[0] = '#';
    wallline[31] = '#';
    wallline[32] = 0;
    hudline[32] = 0;
}

/* Walls, title and legend. Drawn as whole rows so we make 26 console calls
   rather than 108. */
void draw_chrome(void) {
    u8 y;
    consoleDrawText(0, HUD_ROW0, TITLE_LINE);
    consoleDrawText(0, HUD_ROW2, LEGEND);
    consoleDrawText(0, HINT_ROW, CONTROLS);
    consoleDrawText(0, WALL_TOP, wallrow);
    consoleDrawText(0, WALL_BOTTOM, wallrow);
    for (y = PLAY_TOP; y <= PLAY_BOTTOM; y++) consoleDrawText(0, y, wallline);
}

void draw_hud(void) {
    u8 i;
    for (i = 0; i < 32; i++) hudline[i] = ' ';
    hudline[32] = 0;
    hudline[0] = 'S'; hudline[1] = 'C'; hudline[2] = ':';
    fmt_num(score, 4);
    hudline[3] = numbuf[0]; hudline[4] = numbuf[1];
    hudline[5] = numbuf[2]; hudline[6] = numbuf[3];
    hudline[9] = 'H'; hudline[10] = 'I'; hudline[11] = ':';
    fmt_num(hiscore, 4);
    hudline[12] = numbuf[0]; hudline[13] = numbuf[1];
    hudline[14] = numbuf[2]; hudline[15] = numbuf[3];
    hudline[18] = 'L'; hudline[19] = 'V'; hudline[20] = ':';
    fmt_num(level, 2);
    hudline[21] = numbuf[0]; hudline[22] = numbuf[1];
    hudline[25] = 'N'; hudline[26] = ':';
    fmt_num(snake_len, 2);
    hudline[27] = numbuf[0]; hudline[28] = numbuf[1];
    consoleDrawText(0, HUD_ROW1, hudline);
}

u8 is_snake_at(u8 x, u8 y) {
    u8 i;
    for (i = 0; i < snake_len; i++) {
        if (snake_x[i] == x && snake_y[i] == y) return 1;
    }
    return 0;
}

u8 is_shard_at(u8 x, u8 y) {
    u8 i;
    for (i = 0; i < shard_count; i++) {
        if (shard_x[i] == x && shard_y[i] == y) return 1;
    }
    return 0;
}

u8 cell_free(u8 x, u8 y) {
    if (is_snake_at(x, y)) return 0;
    if (is_shard_at(x, y)) return 0;
    if (x == food_x && y == food_y) return 0;
    if (bonus_on && x == bonus_x && y == bonus_y) return 0;
    return 1;
}

/* Prefer food at least `far` cells (Chebyshev) from the head so it does not
   keep materialising right under the player's face. Relax if the board is
   too crowded to honour the distance. */
void place_food(void) {
    u8 far, tries, x, y;
    u8 hx = snake_x[0], hy = snake_y[0];
    for (far = 7; far >= 3; far -= 2) {
        for (tries = 0; tries < 120; tries++) {
            x = (u8)(PLAY_LEFT + my_rand(PLAY_RIGHT - PLAY_LEFT + 1));
            y = (u8)(PLAY_TOP + my_rand(PLAY_BOTTOM - PLAY_TOP + 1));
            if (!cell_free(x, y)) continue;
            if (adiff(x, hx) < far || adiff(y, hy) < far) continue;
            food_x = x; food_y = y;
            return;
        }
    }
    for (tries = 0; tries < 200; tries++) {
        x = (u8)(PLAY_LEFT + my_rand(PLAY_RIGHT - PLAY_LEFT + 1));
        y = (u8)(PLAY_TOP + my_rand(PLAY_BOTTOM - PLAY_TOP + 1));
        if (cell_free(x, y)) { food_x = x; food_y = y; return; }
    }
    /* Board effectively full: leave the previous food where it is. */
}

void place_bonus(void) {
    u8 tries, x, y;
    for (tries = 0; tries < 150; tries++) {
        x = (u8)(PLAY_LEFT + my_rand(PLAY_RIGHT - PLAY_LEFT + 1));
        y = (u8)(PLAY_TOP + my_rand(PLAY_BOTTOM - PLAY_TOP + 1));
        if (cell_free(x, y)) {
            bonus_x = x; bonus_y = y; bonus_on = 1;
            bonus_timer = 80; /* steps, not frames -- see the old bug */
            return;
        }
    }
}

void spawn_shard(void) {
    u8 tries, x, y;
    u8 hx = snake_x[0], hy = snake_y[0];
    if (shard_count >= MAXSHARD) return;
    for (tries = 0; tries < 150; tries++) {
        x = (u8)(PLAY_LEFT + my_rand(PLAY_RIGHT - PLAY_LEFT + 1));
        y = (u8)(PLAY_TOP + my_rand(PLAY_BOTTOM - PLAY_TOP + 1));
        /* Never spawn on top of the head -- no cheap deaths on a level up. */
        if (adiff(x, hx) < 4 && adiff(y, hy) < 4) continue;
        if (!cell_free(x, y)) continue;
        shard_x[shard_count] = x;
        shard_y[shard_count] = y;
        shard_dir[shard_count] = (u8)my_rand(4);
        shard_count++;
        return;
    }
}

/* How many snake steps between shard hops. Falls as the level rises. */
u8 shard_period(void) {
    u8 p = (u8)(8 - level / 2);
    if (p < 3) p = 3;
    return p;
}

/* Shards bounce off the walls rather than wrapping (a shard teleporting would
   be unavoidable), and will not step onto the serpent -- so the player can
   only ever die by steering into a shard, never by one lunging at them. */
void move_shards(void) {
    u8 i, d;
    s16 nx, ny;
    for (i = 0; i < shard_count; i++) {
        d = shard_dir[i];
        nx = (s16)shard_x[i];
        ny = (s16)shard_y[i];
        if (d == DIR_UP) ny--;
        else if (d == DIR_DOWN) ny++;
        else if (d == DIR_LEFT) nx--;
        else nx++;

        if (nx < PLAY_LEFT || nx > PLAY_RIGHT || ny < PLAY_TOP || ny > PLAY_BOTTOM) {
            d = DIR_OPPOSITE(d);
            nx = (s16)shard_x[i];
            ny = (s16)shard_y[i];
            if (d == DIR_UP) ny--;
            else if (d == DIR_DOWN) ny++;
            else if (d == DIR_LEFT) nx--;
            else nx++;
            if (nx < PLAY_LEFT || nx > PLAY_RIGHT || ny < PLAY_TOP || ny > PLAY_BOTTOM) continue;
        }
        if (is_snake_at((u8)nx, (u8)ny)) continue;
        if ((u8)nx == food_x && (u8)ny == food_y) continue;
        if (bonus_on && (u8)nx == bonus_x && (u8)ny == bonus_y) continue;

        shard_dir[i] = d;
        shard_x[i] = (u8)nx;
        shard_y[i] = (u8)ny;
    }
}

void fx_spawn(u8 x, u8 y) {
    u8 i;
    for (i = 0; i < MAXFX; i++) {
        if (fx_life[i] == 0) {
            fx_x[i] = x; fx_y[i] = y; fx_life[i] = FX_LIFE;
            return;
        }
    }
    fx_x[0] = x; fx_y[0] = y; fx_life[0] = FX_LIFE;
}

void fx_tick(void) {
    u8 i;
    for (i = 0; i < MAXFX; i++) {
        if (fx_life[i]) fx_life[i]--;
    }
}

/* Sprites ------------------------------------------------------------------*/

void spr_show(u8 slot, u8 cx, u8 cy, u16 tile, u8 pal) {
    u16 id = (u16)slot * 4;
    oamSet(id, (u16)cx * 8, (u16)cy * 8, 0, 0, 0, tile, pal);
    oamSetVisible(id, OBJ_SHOW);
}

void spr_hide(u8 slot) {
    oamSetVisible((u16)slot * 4, OBJ_HIDE);
}

u16 head_tile(u8 d) {
    if (d == DIR_UP) return TID_HEAD_U;
    if (d == DIR_DOWN) return TID_HEAD_D;
    if (d == DIR_LEFT) return TID_HEAD_L;
    return TID_HEAD_R;
}

u16 tail_tile(u8 d) {
    if (d == DIR_UP) return TID_TAIL_U;
    if (d == DIR_DOWN) return TID_TAIL_D;
    if (d == DIR_LEFT) return TID_TAIL_L;
    return TID_TAIL_R;
}

/* The tail points away from the body, i.e. from segment n-2 to segment n-1. */
u8 tail_dir(void) {
    u8 ax, ay, bx, by;
    if (snake_len < 2) return dir;
    ax = snake_x[snake_len - 1]; ay = snake_y[snake_len - 1];
    bx = snake_x[snake_len - 2]; by = snake_y[snake_len - 2];
    if (adiff(ax, bx) > adiff(ay, by)) return (ax > bx) ? DIR_RIGHT : DIR_LEFT;
    return (ay > by) ? DIR_DOWN : DIR_UP;
}

void render_gates(void) {
    spr_show(SPR_GATE_BASE + 0, 15, WALL_TOP, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 1, 16, WALL_TOP, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 2, 15, WALL_BOTTOM, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 3, 16, WALL_BOTTOM, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 4, 0, 14, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 5, 0, 15, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 6, 31, 14, TID_GATE, SPRPAL_PORTAL);
    spr_show(SPR_GATE_BASE + 7, 31, 15, TID_GATE, SPRPAL_PORTAL);

    /* Pulsing cores sit on the gate centres so the seams read as portals. */
    if ((frame >> 2) & 1) {
        spr_show(SPR_CORE_BASE + 0, 15, WALL_TOP, TID_GATE_CORE, SPRPAL_PORTAL);
        spr_show(SPR_CORE_BASE + 1, 15, WALL_BOTTOM, TID_GATE_CORE, SPRPAL_PORTAL);
        spr_show(SPR_CORE_BASE + 2, 0, 14, TID_GATE_CORE, SPRPAL_PORTAL);
        spr_show(SPR_CORE_BASE + 3, 31, 14, TID_GATE_CORE, SPRPAL_PORTAL);
    } else {
        spr_hide(SPR_CORE_BASE + 0);
        spr_hide(SPR_CORE_BASE + 1);
        spr_hide(SPR_CORE_BASE + 2);
        spr_hide(SPR_CORE_BASE + 3);
    }
}

/* Full repaint every frame. With sprites there is no erase bookkeeping, which
   removes the whole class of "forgot to clear the vacated cell" bugs. */
void render_sprites(void) {
    u8 i;
    u8 t;

    /* The menus are full-screen text. Sprites draw on top of every BG, so the
       playfield has to be switched off entirely or it scribbles over them. */
    if (!board_visible) {
        for (i = 0; i < SPR_TOTAL; i++) spr_hide(i);
        return;
    }

    t = (u8)((frame >> 4) & 1);

    for (i = 0; i < snake_len; i++) {
        if (i == 0) {
            spr_show(i, snake_x[i], snake_y[i], head_tile(dir), snake_pal);
        } else if (i == snake_len - 1) {
            spr_show(i, snake_x[i], snake_y[i], tail_tile(tail_dir()), snake_pal);
        } else {
            spr_show(i, snake_x[i], snake_y[i], TID_BODY, snake_pal);
        }
    }
    for (i = snake_len; i < MAXLEN; i++) spr_hide(i);

    spr_show(SPR_FOOD, food_x, food_y, t ? TID_FOOD_B : TID_FOOD_A, SPRPAL_FOOD);

    if (bonus_on) spr_show(SPR_BONUS, bonus_x, bonus_y, t ? TID_BONUS_B : TID_BONUS_A, SPRPAL_BONUS);
    else spr_hide(SPR_BONUS);

    for (i = 0; i < MAXSHARD; i++) {
        if (i < shard_count) {
            spr_show(SPR_SHARD_BASE + i, shard_x[i], shard_y[i],
                     t ? TID_SHARD_B : TID_SHARD_A, SPRPAL_SHARD);
        } else {
            spr_hide(SPR_SHARD_BASE + i);
        }
    }

    for (i = 0; i < MAXFX; i++) {
        if (fx_life[i]) {
            u8 age = (u8)(FX_LIFE - fx_life[i]);
            u16 tile = TID_FX_R1;
            if (age >= 3) tile = TID_FX_R2;
            if (age >= 6) tile = TID_FX_R3;
            if (age >= 9) tile = TID_FX_R4;
            spr_show(SPR_FX_BASE + i, fx_x[i], fx_y[i], tile, SPRPAL_FX);
        } else {
            spr_hide(SPR_FX_BASE + i);
        }
    }

    render_gates();
}

/* Game flow ----------------------------------------------------------------*/

void recompute_level(void) {
    u8 nl = (u8)(meals / 4 + 1);
    if (nl > 10) nl = 10;
    if (nl != level) {
        level = nl;
        speed = (u8)(14 - (level - 1));
        if (speed < 5) speed = 5;
        if (level > 1) spawn_shard();
    }
}

void reset_game(void) {
    u8 i;
    clear_screen();
    snake_len = START_LEN;
    for (i = 0; i < START_LEN; i++) {
        snake_x[i] = (u8)(14 - i);
        snake_y[i] = 14;
    }
    dir = DIR_RIGHT;
    next_dir = DIR_RIGHT;
    score = 0;
    meals = 0;
    level = 1;
    speed = 14;
    shard_count = 0;
    shard_tick = 0;
    bonus_on = 0;
    bonus_timer = 0;
    paused = 0;
    dying_timer = 0;
    won = 0;
    snake_pal = SPRPAL_SNAKE;
    board_visible = 1;
    for (i = 0; i < MAXFX; i++) fx_life[i] = 0;
    /* Park food off-board so cell_free() ignores it before the first spawn. */
    food_x = 0; food_y = 0;

    draw_chrome();
    place_food();
    draw_hud();
}

/* 0 = survived, 1 = died, 2 = won */
u8 step_snake(void) {
    u8 nx, ny, i;
    u8 grow = 0, ate_bonus = 0;

    if (bonus_on) {
        if (bonus_timer > 0) bonus_timer--;
        if (bonus_timer == 0) bonus_on = 0;
    }

    dir = next_dir;
    nx = snake_x[0];
    ny = snake_y[0];
    if (dir == DIR_UP) ny--;
    else if (dir == DIR_DOWN) ny++;
    else if (dir == DIR_LEFT) nx--;
    else nx++;

    /* Void-wrap portals through the walls */
    if (nx < PLAY_LEFT) nx = PLAY_RIGHT;
    if (nx > PLAY_RIGHT) nx = PLAY_LEFT;
    if (ny < PLAY_TOP) ny = PLAY_BOTTOM;
    if (ny > PLAY_BOTTOM) ny = PLAY_TOP;

    if (++shard_tick >= shard_period()) {
        shard_tick = 0;
        move_shards();
    }

    if (is_shard_at(nx, ny)) return 1;

    /* Self collision. The tail tip is survivable unless we are growing into it,
       because that cell does not actually vacate this step. */
    for (i = 0; i < snake_len; i++) {
        if (snake_x[i] != nx || snake_y[i] != ny) continue;
        if (i == snake_len - 1 && nx != food_x && ny != food_y
            && !(bonus_on && nx == bonus_x && ny == bonus_y)) continue;
        return 1;
    }

    if (nx == food_x && ny == food_y) grow = 1;
    if (bonus_on && nx == bonus_x && ny == bonus_y) {
        grow = 1;
        ate_bonus = 1;
    }

    for (i = (u8)(snake_len - 1); i > 0; i--) {
        snake_x[i] = snake_x[i - 1];
        snake_y[i] = snake_y[i - 1];
    }
    snake_x[0] = nx;
    snake_y[0] = ny;
    if (grow && snake_len < MAXLEN) snake_len++;

    if (grow) {
        fx_spawn(nx, ny);
        if (ate_bonus) {
            score += 50;
            bonus_on = 0;
            bonus_timer = 0;
        } else {
            score += 10;
            meals++;
            if (meals % 5 == 0 && !bonus_on) place_bonus();
            recompute_level();
            place_food();
        }
        if (score > 9999) score = 9999;
        if (snake_len >= WIN_LEN) return 2;
    }
    if (score > hiscore) hiscore = score;
    return 0;
}

void start_dying(u8 win) {
    won = win;
    dying_timer = 110;
    snake_pal = SPRPAL_SNAKE;
    fx_spawn(snake_x[0], snake_y[0]);
    fx_spawn(snake_x[0], snake_y[0]);
}

void burst_at_head(void) {
    s16 bx = (s16)snake_x[0] + (s16)my_rand(7) - 3;
    s16 by = (s16)snake_y[0] + (s16)my_rand(7) - 3;
    if (bx >= PLAY_LEFT && bx <= PLAY_RIGHT && by >= PLAY_TOP && by <= PLAY_BOTTOM) {
        fx_spawn((u8)bx, (u8)by);
    }
}

void show_title(void) {
    board_visible = 0;
    clear_screen();
    consoleDrawText(2, 3,  "============================");
    consoleDrawText(2, 4,  "=                          =");
    consoleDrawText(2, 5,  "=       VOID SERPENT       =");
    consoleDrawText(2, 6,  "=                          =");
    consoleDrawText(2, 7,  "=  A NEON HUNGER IN SPACE  =");
    consoleDrawText(2, 8,  "=                          =");
    consoleDrawText(2, 9,  "============================");
    consoleDrawText(4, 12, " EAT THE ORB FOR +10 PTS");
    consoleDrawText(4, 13, " GRAB THE GOLD FOR +50");
    consoleDrawText(4, 14, " VOID SHARDS DRIFT AND KILL");
    consoleDrawText(4, 15, " SO DOES YOUR OWN TAIL");
    consoleDrawText(3, 17, " WALLS ARE PORTALS -- THE");
    consoleDrawText(3, 18, " GLOWING GATES MARK THE SEAM");
    consoleDrawText(4, 20, " D-PAD STEER  START PAUSE");
    consoleDrawText(5, 23, " PRESS START TO DIVE");
    consoleDrawText(3, 26, "(C) 2026 VOID SERPENT LAB");
}

void show_over(void) {
    board_visible = 0;
    clear_screen();
    consoleDrawText(10, 5, "GAME OVER");
    consoleDrawText(6, 8, "THE VOID CLAIMS YOU");
    consoleDrawText(7, 11, "LENGTH");
    fmt_num(snake_len, 2);
    consoleDrawText(16, 11, numbuf);
    consoleDrawText(7, 12, "SCORE");
    fmt_num(score, 4);
    consoleDrawText(16, 12, numbuf);
    consoleDrawText(7, 13, "BEST");
    fmt_num(hiscore, 4);
    consoleDrawText(16, 13, numbuf);
    consoleDrawText(5, 18, "PRESS START TO DIVE AGAIN");
}

void show_win(void) {
    board_visible = 0;
    clear_screen();
    consoleDrawText(5, 5, "VOID SERPENT MASTER");
    consoleDrawText(4, 8, "YOU RULE THE WRAPPING VOID");
    consoleDrawText(7, 11, "FINAL SCORE");
    fmt_num(score, 4);
    consoleDrawText(18, 11, numbuf);
    consoleDrawText(4, 17, "PRESS START TO DIVE AGAIN");
}

int main(void) {
    u16 keys;
    u8 r, res;

    consoleInit();
    consoleInitText(0, 0, &snesfont);
    /* Text on a near-black void so the HUD bars blend into the playfield. */
    consoleSetTextCol(RGB5(26, 31, 31), RGB5(0, 0, 6));

    setMode(BG_MODE1, 0);
    bgSetDisable(1);
    bgSetDisable(2);

    /* Tile upload + OBSEL. The palette argument is ignored in practice: it
       lands at CGRAM byte 128, which the hardware does not use for these
       slots, so every palette is copied to its real address straight after. */
    oamInitGfxSet(vsgfx_tiles, VSGFX_TILES_SIZE, vpal_snake, VSGFX_PAL_SIZE,
                  0, SPR_GFX_VRAM, OBJ_SIZE8);
    dmaCopyCGram(vpal_snake, SPRPAL_CGRAM(SPRPAL_SNAKE), VSGFX_PAL_SIZE);
    dmaCopyCGram(vpal_food, SPRPAL_CGRAM(SPRPAL_FOOD), VSGFX_PAL_SIZE);
    dmaCopyCGram(vpal_bonus, SPRPAL_CGRAM(SPRPAL_BONUS), VSGFX_PAL_SIZE);
    dmaCopyCGram(vpal_shard, SPRPAL_CGRAM(SPRPAL_SHARD), VSGFX_PAL_SIZE);
    dmaCopyCGram(vpal_fx, SPRPAL_CGRAM(SPRPAL_FX), VSGFX_PAL_SIZE);
    dmaCopyCGram(vpal_portal, SPRPAL_CGRAM(SPRPAL_PORTAL), VSGFX_PAL_SIZE);

    build_strings();

    for (r = 0; r < MAXFX; r++) fx_life[r] = 0;
    for (r = 0; r < SPR_TOTAL; r++) spr_hide(r);

    my_srand(0xACE1);
    hiscore = 0;   /* session-only: the cart has no battery-backed SRAM */
    state = ST_TITLE;
    prev_keys = 0;
    frame = 0;

    setScreenOn();
    show_title();

    while (1) {
        WaitForVBlank();
        frame++;
        rng_state += (u16)(frame & 0x0F);
        keys = padsCurrent(0);
        if (keys) rng_state += keys;

        if (state == ST_TITLE) {
            if ((keys & KEY_START) && !(prev_keys & KEY_START)) {
                reset_game();
                state = ST_PLAY;
            }
        } else if (state == ST_OVER || state == ST_WIN) {
            /* One press goes straight back into a fresh run. */
            if ((keys & KEY_START) && !(prev_keys & KEY_START)) {
                reset_game();
                state = ST_PLAY;
            }
        } else if (state == ST_DYING) {
            fx_tick();
            snake_pal = (u8)(((frame >> 2) & 1) ? SPRPAL_SHARD : SPRPAL_SNAKE);
            if (dying_timer % 9 == 0) burst_at_head();
            if (--dying_timer == 0) {
                if (score > hiscore) hiscore = score;
                if (won) { state = ST_WIN; show_win(); }
                else { state = ST_OVER; show_over(); }
            }
        } else {
            if ((keys & KEY_START) && !(prev_keys & KEY_START)) {
                paused = !paused;
                if (paused) {
                    consoleDrawText(11, HUD_ROW2, PAUSED_BAR);
                } else {
                    clear_screen();
                    draw_chrome();
                    draw_hud();
                }
            }
            if (!paused) {
                /* Steering. The guard tests next_dir (the pending heading) rather
                   than dir, so a quick UP-then-DOWN tap within one step can no
                   longer flip the snake into its own neck. */
                if ((keys & KEY_UP) && next_dir != DIR_DOWN) next_dir = DIR_UP;
                else if ((keys & KEY_DOWN) && next_dir != DIR_UP) next_dir = DIR_DOWN;
                else if ((keys & KEY_LEFT) && next_dir != DIR_RIGHT) next_dir = DIR_LEFT;
                else if ((keys & KEY_RIGHT) && next_dir != DIR_LEFT) next_dir = DIR_RIGHT;

                if ((frame % speed) == 0) {
                    res = step_snake();
                    if (res == 1) start_dying(0);
                    else if (res == 2) start_dying(1);
                    draw_hud();
                }
                fx_tick();
            }
        }

        render_sprites();
        prev_keys = keys;
    }
    return 0;
}
