/*---------------------------------------------------------------------------------
    Simple console 'hello world' demo for SNES
    Initializes console, sets video mode, and prints text.
---------------------------------------------------------------------------------*/
#include <snes.h>

extern char snesfont;

int main(void) {
    // Initialize SNES console
    consoleInit();

    // Initialize text console with our font
    consoleInitText(0, 0, &snesfont);

    // Put screen in Mode 1 (16 colors) and disable BG1 and BG2 (only BG0 active)
    setMode(BG_MODE1, 0);
    bgSetDisable(1);
    bgSetDisable(2);

    // Draw some text to screen
    consoleDrawText(9, 8, "SNES TOY GAME ENV");
    consoleDrawText(8, 10, "=================");
    consoleDrawText(10, 13, "LIVE HARNESS READY!");
    consoleDrawText(6, 16, "EDIT SRC/MAIN.C TO BUILD");
    consoleDrawText(5, 20, "POWERED BY PVSNESLIB & RUST");

    // Enable screen (turn on display)
    setScreenOn();

    // Loop forever, waiting for vertical blank
    while (1) {
        WaitForVBlank();
    }
    return 0;
}
