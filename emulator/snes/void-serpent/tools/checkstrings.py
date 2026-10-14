#!/usr/bin/env python3
"""Guard against console text overflowing the 32x28 SNES text layer.

The console in main.c is 32 columns wide. `consoleDrawText(x, y, "...")` that
runs past column 31 wraps onto the next row and overwrites whatever is there --
which is how a border corner used to get punched out of the board.

This checks every consoleDrawText call in main.c that has a literal string,
resolves symbolic row/column constants via #define, and verifies the
runtime-built line buffers stay within their 32-column bounds.

Run:  python3 tools/checkstrings.py
"""

import os
import re
import sys

SCREEN_W = 32
SCREEN_H = 28

here = os.path.dirname(os.path.abspath(__file__))
main_c = os.path.join(here, os.pardir, 'src', 'main.c')


def line_of(text, index):
    return text.count('\n', 0, index) + 1


def collect_defines(src):
    """Map of NAME -> integer value for simple #define NAME <int> lines."""
    out = {}
    for m in re.finditer(r'^#define\s+(\w+)\s+(-?\d+)\s*$', src, re.M):
        out[m.group(1)] = int(m.group(2))
    return out


def resolve(token, defines):
    """Turn a coordinate argument into an int, following simple #defines."""
    token = token.strip()
    if re.fullmatch(r'-?\d+', token):
        return int(token)
    return defines.get(token)


def main():
    if not os.path.exists(main_c):
        print("cannot find %s" % main_c)
        return 1

    src = open(main_c).read()
    defines = collect_defines(src)
    problems = []

    # 1. consoleDrawText(<x>, <y>, "<literal>"). Coordinates may be numeric or
    #    symbolic (HUD_ROW2, WALL_TOP, ...), so resolve #defines first.
    call = re.compile(
        r'consoleDrawText\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)')
    n_calls = 0
    n_dynamic = 0
    for m in call.finditer(src):
        xtok, ytok, lit = m.group(1), m.group(2), m.group(3)
        x, y = resolve(xtok, defines), resolve(ytok, defines)
        ln = line_of(src, m.start())
        n_calls += 1
        if y is None:
            # Loop variable (e.g. clear_screen). Row can't be checked, but the
            # literal still has to fit the screen width on its own.
            n_dynamic += 1
            x = 0
        elif not (0 <= y < SCREEN_H):
            problems.append("line %d: row %d is off-screen (max %d)" % (ln, y, SCREEN_H - 1))
        if x is None:
            x = 0
            n_dynamic += 1
        end = x + len(lit)
        if end > SCREEN_W:
            problems.append(
                "line %d: text %r at x=%d ends at column %d, %d past the %d-column edge"
                % (ln, lit, x, end, end - SCREEN_W, SCREEN_W))

    total_calls = len(re.findall(r'consoleDrawText\s*\(', src))
    if total_calls and n_calls == 0:
        problems.append("no consoleDrawText call could be analysed -- checker is broken")

    # 2. Static strings that get printed via a #define.
    for m in re.finditer(r'^#define\s+(\w+)\s+"((?:[^"\\]|\\.)*)"\s*$', src, re.M):
        name, lit = m.group(1), m.group(2)
        ln = line_of(src, m.start())
        if len(lit) > SCREEN_W:
            problems.append(
                "line %d: %s is %d chars, %d past the %d-column edge"
                % (ln, name, len(lit), len(lit) - SCREEN_W, SCREEN_W))

    # 3. Runtime buffers: declaration width.
    for name in ('hudline', 'wallrow', 'wallline'):
        m = re.search(r'char\s+%s\[(\d+)\]' % name, src)
        if not m:
            problems.append("missing declaration for %s" % name)
            continue
        size = int(m.group(1))
        if size < SCREEN_W + 1:
            problems.append(
                "line %d: %s[%d] cannot hold %d chars plus a NUL"
                % (line_of(src, m.start()), name, size, SCREEN_W))

    # 4. Flag writes that would run off a 32-column buffer. Index 32 is the NUL
    #    slot of a char[33], so only anything past that is a bug.
    for m in re.finditer(r'\b(hudline|wallrow|wallline)\[(\d+)\]\s*=', src):
        name, idx = m.group(1), int(m.group(2))
        ln = line_of(src, m.start())
        if idx > SCREEN_W:
            problems.append(
                "line %d: %s[%d] writes past the NUL slot of a %d-column buffer"
                % (ln, name, idx, SCREEN_W))

    if problems:
        print("FAIL: %d console layout problem(s)" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    print("OK: %d of %d literal consoleDrawText calls within %dx%d"
          % (n_calls, total_calls, SCREEN_W, SCREEN_H))
    if n_dynamic:
        print("    (%d call(s) use loop coordinates; only their width was checked)"
              % n_dynamic)
    return 0


if __name__ == '__main__':
    sys.exit(main())
