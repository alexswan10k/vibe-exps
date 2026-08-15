# 🌊 THE ABYSS — a bioluminescent descent

An endless deep-sea exploration game. Pilot a little submersible down an
infinitely procedurally generated trench, managing oxygen while the world
gets darker, stranger, and more dangerous with every metre.

## How to play

Open `index.html` in any modern browser. No build step, no dependencies.

- **WASD / Arrow keys** — steer the submersible
- **Space** — sonar ping
- **Enter** — start / restart

### The loop

- **Oxygen** drains constantly (faster the deeper you go). You die when it hits zero.
- **Sonar** reveals hidden life with an expanding ring — but any **anglerfish**
  within range hears the ping and comes hunting. Silence is safety; pings are greed.
- **Pearls** (bright cyan) grant +50 score and +18 oxygen.
- **Hydrothermal vents** (green glow, bubbling) replenish oxygen while you hover near them.
- **Fish schools** are harmless — bump into them for points and watch them scatter.
- **Jellyfish** sting: oxygen loss, knockback, brief invulnerability.
- **Anglerfish** live below 400 m and become more common the deeper you sink.
  Their glowing lure is your warning — when it starts flashing fast, you're being chased.

### Depth zones

| Depth        | Zone              |
| ------------ | ----------------- |
| 0 – 200 m    | The Sunlight Zone |
| 200 – 1,000  | Twilight Zone     |
| 1,000 – 4,000| Midnight Zone     |
| 4,000 – 6,000| The Abyssopelagic |
| 6,000 – 11,000| The Trench      |
| 11,000 +     | The Hadal Dark    |

Water color, marine snow, and creature density all shift as you descend.
Best depth is saved in `localStorage`.

## Technical notes

- Single self-contained HTML file: canvas 2D rendering, no libraries
- World is generated in deterministic 100 m bands (seeded PRNG per band),
  so the trench is consistent if you ever swim back up
- Trench walls are procedural sine-composite curves; god rays near the surface
- Sound effects are synthesized live with the WebAudio API (no audio files)
- Score = survival trickle + depth zone bonuses (+100) + pearls (+50) + fish (+5) + vent time
