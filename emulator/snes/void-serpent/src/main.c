/*---------------------------------------------------------------------------------
    VOID SERPENT for Retro-SNES Hub
    A neon snake with void-wrap portals, void hazards, and golden bonuses.
    - D-PAD steers, START pauses / confirms
    - Eat '*' for +10, golden '$' for +50 (limited time)
    - Walls are portals: exit one side, enter the other
    - 'X' void shards and your own tail are lethal
    - Every 4 meals: speed up + new shard spawns
---------------------------------------------------------------------------------*/
#include <snes.h>

extern char snesfont;

/* Board geometry (32x28 text console) */
#define HUD_ROW0 0
#define HUD_ROW1 1
#define HUD_ROW2 2
#define WALL_TOP 3
#define PLAY_TOP 4
#define PLAY_BOTTOM 25
#define WALL_BOTTOM 26
#define HINT_ROW 27
#define PLAY_LEFT 1
#define PLAY_RIGHT 30

#define MAXLEN 100
#define MAXSHARD 12
#define WIN_LEN 80

/* Directions */
#define DIR_UP 0
#define DIR_DOWN 1
#define DIR_LEFT 2
#define DIR_RIGHT 3

/* Game states */
#define ST_TITLE 0
#define ST_PLAY 1
#define ST_OVER 2
#define ST_WIN 3

/* Mutable WRAM state (never const: see CAVEATS.md) */
u8 snake_x[MAXLEN];
u8 snake_y[MAXLEN];
u8 shard_x[MAXSHARD];
u8 shard_y[MAXSHARD];
u8 snake_len;
u8 shard_count;
u8 dir;
u8 next_dir;
u8 food_x, food_y;
u8 bonus_x, bonus_y;
u8 bonus_on;
u16 bonus_timer;
u16 score;
u16 hiscore;
u8 meals;
u8 level;
u8 speed;
u8 state;
u8 paused;
u16 frame;
u16 rng_state;
u16 prev_keys;

/* String buffers in WRAM */
char numbuf[7];
char hudline[33];

void my_srand(u16 s) { rng_state = s; }
u16 my_rand(u16 limit) {
    rng_state = (u16)(rng_state * 109 + 413);
    if (limit == 0) return 0;
    return (u16)((rng_state >> 3) % limit);
}

void clear_screen(void) {
    u8 r;
    for (r = 0; r < 28; r++) {
        consoleDrawText(0, r, "                                ");
    }
}

void draw_char(u8 x, u8 y, char ch) {
    char b[2];
    b[0] = ch;
    b[1] = 0;
    consoleDrawText(x, y, b);
}

/* Print unsigned value with leading zeros into numbuf, width digits */
void fmt_num(u16 val, u8 width) {
    s8 i;
    for (i = width - 1; i >= 0; i--) {
        numbuf[i] = (char)('0' + (val % 10));
        val /= 10;
    }
    numbuf[width] = 0;
}

void draw_hud(void) {
    u8 i;
    /* Row 0: title centered */
    consoleDrawText(0, HUD_ROW0, "         VOID SERPENT         ");
    /* Row 1: SCORE + HI */
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
    hudline[20] = 'L'; hudline[21] = 'V'; hudline[22] = ':';
    fmt_num(level, 2);
    hudline[23] = numbuf[0]; hudline[24] = numbuf[1];
    hudline[27] = 'N'; hudline[28] = ':'; 
    fmt_num(snake_len, 3);
    hudline[29] = numbuf[0]; hudline[30] = numbuf[1]; hudline[31] = numbuf[2];
    consoleDrawText(0, HUD_ROW1, hudline);
    /* Row 2: meals / speed hint */
    consoleDrawText(0, HUD_ROW2, " EAT *+10 $+50  X KILLS  WRAP OK ");
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

void place_food(void) {
    u8 tries;
    u8 x, y;
    for (tries = 0; tries < 200; tries++) {
        x = (u8)(PLAY_LEFT + my_rand((u16)(PLAY_RIGHT - PLAY_LEFT + 1)));
        y = (u8)(PLAY_TOP + my_rand((u16)(PLAY_BOTTOM - PLAY_TOP + 1)));
        if (cell_free(x, y)) {
            food_x = x;
            food_y = y;
            draw_char(food_x, food_y, '*');
            return;
        }
    }
    /* Board nearly full: keep old food */
}

void place_bonus(void) {
    u8 tries;
    u8 x, y;
    for (tries = 0; tries < 120; tries++) {
        x = (u8)(PLAY_LEFT + my_rand((u16)(PLAY_RIGHT - PLAY_LEFT + 1)));
        y = (u8)(PLAY_TOP + my_rand((u16)(PLAY_BOTTOM - PLAY_TOP + 1)));
        if (cell_free(x, y)) {
            bonus_x = x;
            bonus_y = y;
            bonus_on = 1;
            bonus_timer = 300;
            draw_char(bonus_x, bonus_y, '$');
            return;
        }
    }
}

void spawn_shard(void) {
    u8 tries, x, y, i;
    u8 hx, hy;
    if (shard_count >= MAXSHARD) return;
    hx = snake_x[0];
    hy = snake_y[0];
    for (tries = 0; tries < 150; tries++) {
        x = (u8)(PLAY_LEFT + my_rand((u16)(PLAY_RIGHT - PLAY_LEFT + 1)));
        y = (u8)(PLAY_TOP + my_rand((u16)(PLAY_BOTTOM - PLAY_TOP + 1)));
        /* Keep spawn away from head so it never insta-kills */
        if (x + 4 >= hx && hx + 4 >= x && y + 3 >= hy && hy + 3 >= y) continue;
        if (!cell_free(x, y)) continue;
        /* Also avoid sitting on food/bonus visual overlap already checked */
        i = shard_count;
        shard_x[i] = x;
        shard_y[i] = y;
        shard_count++;
        draw_char(x, y, 'X');
        return;
    }
}

void draw_board(void) {
    u8 x, y, i;
    /* Borders */
    consoleDrawText(0, WALL_TOP, "################################");
    consoleDrawText(0, WALL_BOTTOM, "################################");
    for (y = PLAY_TOP; y <= PLAY_BOTTOM; y++) {
        for (x = 0; x < 32; x++) {
            if (x == 0 || x == 31) draw_char(x, y, '#');
            else draw_char(x, y, ' ');
        }
    }
    for (i = 0; i < shard_count; i++) draw_char(shard_x[i], shard_y[i], 'X');
    draw_char(food_x, food_y, '*');
    if (bonus_on) draw_char(bonus_x, bonus_y, '$');
    for (i = 0; i < snake_len; i++) {
        draw_char(snake_x[i], snake_y[i], (i == 0) ? '@' : 'o');
    }
    consoleDrawText(0, HINT_ROW, " D-PAD:MOVE START:PAUSE        ");
}

void reset_game(void) {
    u8 i;
    snake_len = 5;
    /* Start horizontal in the middle, heading right */
    for (i = 0; i < snake_len; i++) {
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
    bonus_on = 0;
    bonus_timer = 0;
    paused = 0;
    frame = 0;
    /* Park food on the head so draw_board's food pixel
       is covered by the snake; place_food() relocates it */
    food_x = snake_x[0];
    food_y = snake_y[0];
    draw_hud();
    draw_board();
    place_food();
}

void recompute_level(void) {
    u8 nl = (u8)(meals / 4 + 1);
    if (nl > 10) nl = 10;
    if (nl != level) {
        level = nl;
        /* speed: 14,13,12,... min 5 */
        speed = (u8)(14 - (level - 1));
        if (speed < 5) speed = 5;
        if (level > 1) spawn_shard();
        draw_hud();
    }
}

void show_title(void) {
    clear_screen();
    consoleDrawText(2, 3,  "============================");
    consoleDrawText(2, 4,  "=                          =");
    consoleDrawText(2, 5,  "=       VOID SERPENT       =");
    consoleDrawText(2, 6,  "=                          =");
    consoleDrawText(2, 7,  "=   A NEON HUNGER IN SPACE =");
    consoleDrawText(2, 8,  "=                          =");
    consoleDrawText(2, 9,  "============================");
    consoleDrawText(4, 12, "EAT * FOR +10 PTS");
    consoleDrawText(4, 13, "GRAB $ FOR +50 PTS");
    consoleDrawText(4, 14, "WALLS ARE PORTALS (WRAP)");
    consoleDrawText(4, 15, "AVOID X SHARDS + TAIL");
    consoleDrawText(4, 17, "D-PAD TO STEER THE HEAD");
    consoleDrawText(4, 18, "START TO PAUSE IN GAME");
    consoleDrawText(6, 22, "PRESS START TO DIVE");
    consoleDrawText(3, 25, "(C) 2026 VOID SERPENT LAB");
}

void show_over(void) {
    clear_screen();
    consoleDrawText(11, 6, "GAME OVER");
    consoleDrawText(6, 9, "THE VOID CLAIMS YOU");
    consoleDrawText(8, 12, "SCORE: ");
    fmt_num(score, 4);
    consoleDrawText(15, 12, numbuf);
    consoleDrawText(8, 13, "BEST:  ");
    fmt_num(hiscore, 4);
    consoleDrawText(15, 13, numbuf);
    consoleDrawText(4, 18, "PRESS START TO RETRY");
}

void show_win(void) {
    clear_screen();
    consoleDrawText(5, 5, "VOID SERPENT MASTER!");
    consoleDrawText(4, 8, "YOU RULE THE WRAPPING VOID");
    consoleDrawText(8, 12, "SCORE: ");
    fmt_num(score, 4);
    consoleDrawText(15, 12, numbuf);
    consoleDrawText(4, 17, "PRESS START TO PLAY AGAIN");
}

/* Returns 1 if died this step */
u8 step_snake(void) {
    u8 nx, ny;
    u8 i;
    u8 old_tx, old_ty;
    u8 grow = 0;
    u8 ate_bonus = 0;

    nx = snake_x[0];
    ny = snake_y[0];
    dir = next_dir;
    if (dir == DIR_UP) ny--;
    else if (dir == DIR_DOWN) ny++;
    else if (dir == DIR_LEFT) nx--;
    else nx++;

    /* Void-wrap portals through the walls */
    if (nx < PLAY_LEFT) nx = PLAY_RIGHT;
    if (nx > PLAY_RIGHT) nx = PLAY_LEFT;
    if (ny < PLAY_TOP) ny = PLAY_BOTTOM;
    if (ny > PLAY_BOTTOM) ny = PLAY_TOP;

    /* Lethal: shards */
    if (is_shard_at(nx, ny)) return 1;

    /* Lethal: self (ignore current tail tip since it moves away,
       unless we are about to grow) */
    for (i = 0; i < snake_len; i++) {
        if (snake_x[i] == nx && snake_y[i] == ny) {
            /* Tail tip exception */
            if (i == snake_len - 1 && !(nx == food_x && ny == food_y)
                && !(bonus_on && nx == bonus_x && ny == bonus_y)) {
                continue;
            }
            return 1;
        }
    }

    if (nx == food_x && ny == food_y) grow = 1;
    if (bonus_on && nx == bonus_x && ny == bonus_y) {
        grow = 1;
        ate_bonus = 1;
    }

    old_tx = snake_x[snake_len - 1];
    old_ty = snake_y[snake_len - 1];

    if (grow) {
        if (snake_len < MAXLEN) {
            for (i = snake_len; i > 0; i--) {
                snake_x[i] = snake_x[i - 1];
                snake_y[i] = snake_y[i - 1];
            }
            snake_len++;
        } else {
            /* At cap: slide like normal move */
            for (i = snake_len - 1; i > 0; i--) {
                snake_x[i] = snake_x[i - 1];
                snake_y[i] = snake_y[i - 1];
            }
            draw_char(old_tx, old_ty, ' ');
        }
        snake_x[0] = nx;
        snake_y[0] = ny;
    } else {
        for (i = snake_len - 1; i > 0; i--) {
            snake_x[i] = snake_x[i - 1];
            snake_y[i] = snake_y[i - 1];
        }
        snake_x[0] = nx;
        snake_y[0] = ny;
        /* Erase vacated tail cell (unless head wrapped onto it) */
        if (!(old_tx == nx && old_ty == ny)) draw_char(old_tx, old_ty, ' ');
    }

    /* Repaint head + previous head (now body) */
    if (snake_len > 1) draw_char(snake_x[1], snake_y[1], 'o');
    draw_char(nx, ny, '@');

    if (grow) {
        if (ate_bonus) {
            score += 50;
            bonus_on = 0;
            bonus_timer = 0;
        } else {
            score += 10;
            meals++;
            if (score > 9999) score = 9999;
            /* Every 5th meal drops a golden bonus */
            if (meals % 5 == 0 && !bonus_on) place_bonus();
            recompute_level();
            place_food();
        }
        if (ate_bonus) {
            /* Bonus eaten: meals unchanged, but still redraw HUD */
        } else {
            /* food eaten already placed new food */
        }
        draw_hud();
        /* Re-draw hint row in case HUD touched it (it does not) */
        if (snake_len >= WIN_LEN) return 2; /* win signal */
    }
    if (score > hiscore) {
        hiscore = score;
        if (hiscore > 9999) hiscore = 9999;
    }
    return 0;
}

int main(void) {
    u16 keys;
    u8 died;

    consoleInit();
    consoleInitText(0, 0, &snesfont);
    setMode(BG_MODE1, 0);
    bgSetDisable(1);
    bgSetDisable(2);
    setScreenOn();

    my_srand(0xACE1);
    hiscore = 0;
    state = ST_TITLE;
    prev_keys = 0;
    show_title();

    while (1) {
        WaitForVBlank();
        frame++;
        /* Cheap entropy every frame */
        rng_state += (u16)(frame & 0x0F);
        keys = padsCurrent(0);
        /* Extra entropy from held buttons */
        if (keys) rng_state += keys;

        if (state == ST_TITLE) {
            if ((keys & KEY_START) && !(prev_keys & KEY_START)) {
                state = ST_PLAY;
                reset_game();
            }
        } else if (state == ST_OVER || state == ST_WIN) {
            if ((keys & KEY_START) && !(prev_keys & KEY_START)) {
                state = ST_TITLE;
                show_title();
            }
        } else if (state == ST_PLAY) {
            /* Pause toggle on fresh START press */
            if ((keys & KEY_START) && !(prev_keys & KEY_START)) {
                paused = !paused;
                if (paused) {
                    consoleDrawText(12, 14, " PAUSED ");
                } else {
                    /* Restore the 8 chars under the label */
                    draw_board();
                    draw_hud();
                }
            }
            if (!paused) {
                /* Steering (no 180-degree reversals) */
                if ((keys & KEY_UP) && dir != DIR_DOWN) next_dir = DIR_UP;
                else if ((keys & KEY_DOWN) && dir != DIR_UP) next_dir = DIR_DOWN;
                else if ((keys & KEY_LEFT) && dir != DIR_RIGHT) next_dir = DIR_LEFT;
                else if ((keys & KEY_RIGHT) && dir != DIR_LEFT) next_dir = DIR_RIGHT;

                /* Bonus expiry */
                if (bonus_on) {
                    if (bonus_timer > 0) bonus_timer--;
                    if (bonus_timer == 0) {
                        bonus_on = 0;
                        /* Only erase if snake not sitting on it */
                        if (!is_snake_at(bonus_x, bonus_y)) draw_char(bonus_x, bonus_y, ' ');
                    }
                }

                if ((frame % speed) == 0) {
                    died = step_snake();
                    if (died == 1) {
                        if (score > hiscore) hiscore = score;
                        state = ST_OVER;
                        show_over();
                    } else if (died == 2) {
                        if (score > hiscore) hiscore = score;
                        state = ST_WIN;
                        show_win();
                    } else {
                        draw_hud();
                    }
                }
            }
        }
        prev_keys = keys;
    }
    return 0;
}
