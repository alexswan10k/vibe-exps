/*---------------------------------------------------------------------------------
    Super Mario ASCII Clone for Retro-SNES Hub
    A fully playable text-mode platformer with physics, scrolling, and enemies.
---------------------------------------------------------------------------------*/
#include <snes.h>
#include <stdbool.h>
#include <stdlib.h>

#define MAP_WIDTH 120
#define MAP_HEIGHT 28
#define VIEW_WIDTH 32
#define VIEW_HEIGHT 28

extern char snesfont;

// Level template structure (HUD and level layout)
const char* level_template[MAP_HEIGHT] = {
    "                                                                                                                        ",
    "  SUPER MARIO ASCII                                                                                                     ",
    "  SCORE: 000000   LIVES: 3                                                                                              ",
    "  ====================================================================================================================  ",
    "                                                                                                                        ",
    "                                                                                                                        ",
    "                                                                                                                        ",
    "                                                                                                                        ",
    "                                                                                                                        ",
    "                                            $                                                                           ",
    "                                            [?]                                                                         ",
    "                                                 $ $ $                                                                  ",
    "                                                 [=====]                                                                ",
    "                                                                       $                                                ",
    "                                                                       [?]                                              ",
    "                                                                                                                        ",
    "                      [===]                                                                                             ",
    "                      $ $ $                                                                                             ",
    "                                       [===]                 |  |                                                       ",
    "                                       $ $ $                 |  |            [===]                                      ",
    "_______________        _____     ____________________        |  |        _____________     __________________       >>>>",
    "               |      |     |   |                    |       |  |       |             |   |                  |      ====",
    "               |      |     |   |                    |       |__|       |             |   |                  |      ====",
    "               |      |     |   |                    |                  |             |   |                  |      ====",
    "               |      |     |   |                    |                  |             |   |                  |      ====",
    "               |      |     |   |                    |                  |             |   |                  |      ====",
    "               |      |     |   |                    |                  |             |   |                  |      ====",
    "               |      |     |   |                    |                  |             |   |                  |      ===="
};

// Mutable level map loaded in WRAM
char level_map[MAP_HEIGHT][MAP_WIDTH + 1];

// Game variables
u32 score = 0;
u8 lives = 3;
bool game_won = false;
bool game_over_state = false;

// Entity coordinates scaled by 256 for subpixel precision (fixed point)
s16 mario_x, mario_y;
s16 mario_vx, mario_vy;
bool on_ground = false;

// Camera viewport column
u16 camera_x = 0;
u16 last_camera_x = 0;

// Goomba variables
s16 goomba_x, goomba_y;
s16 goomba_vx, goomba_vy;
bool goomba_active = true;

// Grid tracking for erasing/redrawing characters
s16 mario_grid_x, mario_grid_y;
s16 mario_last_x, mario_last_y;
s16 goomba_grid_x, goomba_grid_y;
s16 goomba_last_x, goomba_last_y;

// HUD Updates
void update_hud_score(u32 val) {
    u32 temp = val;
    s8 i;
    for (i = 14; i >= 9; i--) {
        level_map[2][i] = '0' + (temp % 10);
        temp /= 10;
    }
}

void update_hud_lives(u8 val) {
    level_map[2][25] = '0' + (val % 10);
}

void draw_screen(u16 cam_x) {
    char row_buf[33];
    u8 r, c;
    row_buf[32] = 0;
    for (r = 0; r < VIEW_HEIGHT; r++) {
        for (c = 0; c < VIEW_WIDTH; c++) {
            row_buf[c] = level_map[r][cam_x + c];
        }
        consoleDrawText(0, r, row_buf);
    }
}

// Reset level map and entities
void reset_game() {
    u8 r;
    u16 c;
    score = 0;
    lives = 3;
    game_won = false;
    game_over_state = false;
    
    // Copy template to active level map
    for (r = 0; r < MAP_HEIGHT; r++) {
        for (c = 0; c < MAP_WIDTH; c++) {
            level_map[r][c] = level_template[r][c];
        }
        level_map[r][MAP_WIDTH] = 0;
    }
    
    // Initial HUD update
    update_hud_score(score);
    update_hud_lives(lives);

    // Initial position
    mario_x = 4 * 256;
    mario_y = 19 * 256;
    mario_vx = 0;
    mario_vy = 0;
    on_ground = true;
    
    mario_grid_x = mario_x >> 8;
    mario_grid_y = mario_y >> 8;
    mario_last_x = mario_grid_x;
    mario_last_y = mario_grid_y;
    
    // Goomba start
    goomba_x = 42 * 256;
    goomba_y = 19 * 256;
    goomba_vx = -64; // moves left initially
    goomba_vy = 0;
    goomba_active = true;
    
    goomba_grid_x = goomba_x >> 8;
    goomba_grid_y = goomba_y >> 8;
    goomba_last_x = goomba_grid_x;
    goomba_last_y = goomba_grid_y;

    camera_x = 0;
    last_camera_x = 0;
    
    // Initial draw
    draw_screen(camera_x);
}

// Check solid tile collision
bool is_solid(char c) {
    return c == '=' || c == '_' || c == '[' || c == ']' || c == '?' || c == '|' || c == 'x';
}

char get_tile(s16 col, s16 row) {
    if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
        return ' ';
    }
    return level_map[row][col];
}

// Collision resolution helper
void handle_mario_physics() {
    // Left/Right Inputs
    u16 keys = padsCurrent(0);
    if (keys & KEY_LEFT) {
        mario_vx -= 24;
        if (mario_vx < -384) mario_vx = -384;
    } else if (keys & KEY_RIGHT) {
        mario_vx += 24;
        if (mario_vx > 384) mario_vx = 384;
    } else {
        // Apply friction
        mario_vx = (mario_vx * 7) / 8;
        if (abs(mario_vx) < 16) mario_vx = 0;
    }

    // Jump Input
    u16 keys_down = padsDown(0);
    if ((keys_down & (KEY_A | KEY_B)) && on_ground) {
        mario_vy = -1280; // strong upward jump
        on_ground = false;
    }

    // Gravity
    mario_vy += 48;
    if (mario_vy > 1024) mario_vy = 1024; // cap fall speed

    // Calculate temporary positions
    s16 new_x = mario_x + mario_vx;
    s16 new_y = mario_y + mario_vy;

    // 1. Horizontal Collision
    s16 left_col = new_x >> 8;
    s16 right_col = (new_x + 240) >> 8; // width is ~0.94 characters
    s16 top_row = mario_y >> 8;
    s16 bottom_row = (mario_y + 240) >> 8;

    if (mario_vx > 0) {
        if (is_solid(get_tile(right_col, top_row)) || is_solid(get_tile(right_col, bottom_row))) {
            new_x = (right_col << 8) - 256;
            mario_vx = 0;
        }
    } else if (mario_vx < 0) {
        if (is_solid(get_tile(left_col, top_row)) || is_solid(get_tile(left_col, bottom_row))) {
            new_x = (left_col + 1) << 8;
            mario_vx = 0;
        }
    }
    mario_x = new_x;

    // 2. Vertical Collision
    left_col = mario_x >> 8;
    right_col = (mario_x + 240) >> 8;
    top_row = new_y >> 8;
    bottom_row = (new_y + 240) >> 8;

    if (mario_vy > 0) {
        // Falling
        if (is_solid(get_tile(left_col, bottom_row)) || is_solid(get_tile(right_col, bottom_row))) {
            new_y = (bottom_row << 8) - 256;
            mario_vy = 0;
            on_ground = true;
        }
    } else if (mario_vy < 0) {
        // Jumping Up - Head collision
        if (is_solid(get_tile(left_col, top_row)) || is_solid(get_tile(right_col, top_row))) {
            new_y = (top_row + 1) << 8;
            mario_vy = 0;
            
            // Check block hit
            s16 block_x = (mario_x + 128) >> 8;
            if (get_tile(block_x, top_row) == '?') {
                level_map[top_row][block_x] = 'x'; // Turn into empty hit block
                score += 100;
                update_hud_score(score);
                // Force HUD redraw row 2
                draw_screen(camera_x);
            }
        }
    }
    mario_y = new_y;

    // Bound check
    if (mario_x < 0) mario_x = 0;
    if (mario_x > (MAP_WIDTH - 2) * 256) mario_x = (MAP_WIDTH - 2) * 256;

    // Fall into a pit check
    if (mario_y > 25 * 256) {
        if (lives > 1) {
            lives--;
            // Reset position
            mario_x = 4 * 256;
            mario_y = 19 * 256;
            mario_vx = 0;
            mario_vy = 0;
            on_ground = true;
            update_hud_lives(lives);
            draw_screen(camera_x);
        } else {
            lives = 0;
            update_hud_lives(lives);
            game_over_state = true;
        }
    }

    // Update grid indices
    mario_grid_x = mario_x >> 8;
    mario_grid_y = mario_y >> 8;

    // Check coin collection or win condition
    char standing_tile = get_tile(mario_grid_x, mario_grid_y);
    if (standing_tile == '$') {
        level_map[mario_grid_y][mario_grid_x] = ' ';
        score += 200;
        update_hud_score(score);
        draw_screen(camera_x);
    } else if (standing_tile == '>') {
        game_won = true;
    }
}

void handle_goomba_physics() {
    if (!goomba_active) return;

    // Gravity
    goomba_vy += 48;
    if (goomba_vy > 1024) goomba_vy = 1024;

    s16 new_x = goomba_x + goomba_vx;
    s16 new_y = goomba_y + goomba_vy;

    // Horizontal collision
    s16 left_col = new_x >> 8;
    s16 right_col = (new_x + 240) >> 8;
    s16 top_row = goomba_y >> 8;
    s16 bottom_row = (goomba_y + 240) >> 8;

    if (goomba_vx > 0) {
        if (is_solid(get_tile(right_col, top_row)) || is_solid(get_tile(right_col, bottom_row))) {
            new_x = (right_col << 8) - 256;
            goomba_vx = -goomba_vx; // reverse
        }
    } else if (goomba_vx < 0) {
        if (is_solid(get_tile(left_col, top_row)) || is_solid(get_tile(left_col, bottom_row))) {
            new_x = (left_col + 1) << 8;
            goomba_vx = -goomba_vx; // reverse
        }
    }
    goomba_x = new_x;

    // Vertical collision
    left_col = goomba_x >> 8;
    right_col = (goomba_x + 240) >> 8;
    top_row = new_y >> 8;
    bottom_row = (new_y + 240) >> 8;

    if (goomba_vy > 0) {
        if (is_solid(get_tile(left_col, bottom_row)) || is_solid(get_tile(right_col, bottom_row))) {
            new_y = (bottom_row << 8) - 256;
            goomba_vy = 0;
        }
    }
    goomba_y = new_y;

    // Fall check
    if (goomba_y > 25 * 256) {
        goomba_active = false;
    }

    goomba_grid_x = goomba_x >> 8;
    goomba_grid_y = goomba_y >> 8;

    // Collision with Mario
    if (mario_grid_x == goomba_grid_x && abs(mario_grid_y - goomba_grid_y) <= 1) {
        // Mario jumps on Goomba head
        if (mario_vy > 0 && mario_grid_y < goomba_grid_y) {
            goomba_active = false;
            mario_vy = -600; // bounce
            score += 150;
            update_hud_score(score);
            draw_screen(camera_x);
        } else {
            // Damage Mario
            if (lives > 1) {
                lives--;
                mario_x = 4 * 256;
                mario_y = 19 * 256;
                mario_vx = 0;
                mario_vy = 0;
                on_ground = true;
                update_hud_lives(lives);
                draw_screen(camera_x);
            } else {
                lives = 0;
                update_hud_lives(lives);
                game_over_state = true;
            }
        }
    }
}

void update_camera() {
    // Let camera track Mario
    if (mario_grid_x > camera_x + 20) {
        camera_x = mario_grid_x - 20;
    } else if (mario_grid_x < camera_x + 8) {
        if (mario_grid_x >= 8) {
            camera_x = mario_grid_x - 8;
        } else {
            camera_x = 0;
        }
    }
    // Clamp camera
    if (camera_x > MAP_WIDTH - VIEW_WIDTH) {
        camera_x = MAP_WIDTH - VIEW_WIDTH;
    }
}

int main(void) {
    // 1. Initialize Console text
    consoleInit();
    consoleInitText(0, 0, &snesfont);

    // 2. Put Screen in Mode 1
    setMode(BG_MODE1, 0);
    bgSetDisable(1);
    bgSetDisable(2);
    setScreenOn();

    // 3. Reset Game State (Initial Draw)
    reset_game();

    while (1) {
        // Wait for VBlank
        WaitForVBlank();

        if (game_won) {
            // Win screen
            consoleDrawText(8, 12, "  LEVEL CLEAR!  ");
            consoleDrawText(8, 14, "PRESS START TO RESET");
            if (padsDown(0) & KEY_START) {
                reset_game();
            }
            continue;
        }

        if (game_over_state) {
            // Game over screen
            consoleDrawText(10, 12, " GAME OVER ");
            consoleDrawText(8, 14, "PRESS START TO RESET");
            if (padsDown(0) & KEY_START) {
                reset_game();
            }
            continue;
        }

        // Save last positions for erasing
        mario_last_x = mario_grid_x;
        mario_last_y = mario_grid_y;
        if (goomba_active) {
            goomba_last_x = goomba_grid_x;
            goomba_last_y = goomba_grid_y;
        }

        // Game simulation
        handle_mario_physics();
        handle_goomba_physics();
        update_camera();

        // Render pass
        if (camera_x != last_camera_x) {
            // Direct screen update if camera shifted
            draw_screen(camera_x);
            last_camera_x = camera_x;
        } else {
            // Restore tiles at previous character locations from level_map WRAM
            if (mario_last_x >= camera_x && mario_last_x < camera_x + VIEW_WIDTH) {
                char old_tile[2] = { get_tile(mario_last_x, mario_last_y), 0 };
                consoleDrawText(mario_last_x - camera_x, mario_last_y, old_tile);
            }
            if (goomba_active && goomba_last_x >= camera_x && goomba_last_x < camera_x + VIEW_WIDTH) {
                char old_tile[2] = { get_tile(goomba_last_x, goomba_last_y), 0 };
                consoleDrawText(goomba_last_x - camera_x, goomba_last_y, old_tile);
            }

            // Render characters at new positions
            if (goomba_active && goomba_grid_x >= camera_x && goomba_grid_x < camera_x + VIEW_WIDTH) {
                consoleDrawText(goomba_grid_x - camera_x, goomba_grid_y, "G");
            }
            if (mario_grid_x >= camera_x && mario_grid_x < camera_x + VIEW_WIDTH) {
                consoleDrawText(mario_grid_x - camera_x, mario_grid_y, "M");
            }
        }
    }
    return 0;
}
