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

- **The surface is real.** You start floating under an actual water line —
  sky, sun, birds, animated waves. The ocean ends there; dive down with S.
- **Oxygen** drains constantly (faster the deeper you go). You die when it hits zero.
- **Sonar** reveals hidden life with an expanding ring — but any **anglerfish**
  within range hears the ping and comes hunting. Silence is safety; pings are greed.
- **Pearls** (bright cyan) grant +50 score and +22 oxygen.
- **Hydrothermal vents** (green glow, bubbling) replenish oxygen while you hover near them.
- **Upgrade cores** (spinning colored cubes, below 250m) — collect to upgrade
  **Engine** (thrust), **O₂ tank** (capacity + refill), or **Sonar** (range + cooldown).
  Three levels each; excess cores convert to bonus score. Track your builds in the HUD.
- **Fish schools** are harmless — bump into them for points and watch them scatter.
- **Jellyfish** sting: oxygen loss, knockback, brief invulnerability.
- **Anglerfish** live below 400 m and become more common the deeper you sink.
  Their glowing lure is your warning — when it starts flashing fast, you're being chased.

### Big encounters

- **🐋 The whale** — occasionally a giant whale drifts across your path, singing.
  Swim close for +250. It spouts if it's near the surface.
- **🌊 Current surges** — below 1,200 m the trench periodically convulses;
  watch for the warning and brace (or enjoy the ride).
- **🐉 The leviathan** — below 7,500 m, a massive bioluminescent serpent
  periodically hunts the trench. A deep rumble warns you. It follows your depth.
  Do not touch it.

### The depth gauge

A vertical gauge on the right shows the water color by zone, your position,
and markers for nearby **pearls** (cyan), **vents** (green), **cores** (colored),
and **anglerfish** (red diamond — pulsing when one is hunting you).

### Depth zones

| Depth        | Zone              |
| ------------ | ----------------- |
| 0 – 200 m    | The Sunlight Zone |
| 200 – 1,000  | Twilight Zone     |
| 1,000 – 4,000| Midnight Zone     |
| 4,000 – 6,000| The Abyssopelagic |
| 6,000 – 11,000| The Trench      |
| 11,000 +     | The Hadal Dark    |

Water color, marine snow, creature density, and the ambient pressure drone
all shift as you descend. Best depth is saved in `localStorage`.

## Technical notes

- Single self-contained HTML file: canvas 2D rendering, no libraries
- World is generated in deterministic 100 m bands (seeded PRNG per band),
  so the trench is consistent if you ever swim back up
- Trench walls are procedural sine-composite curves; god rays + a rendered
  sky/sun/wave surface near the top
- Sound is synthesized live with the WebAudio API (no audio files): sonar pings,
  whale song, leviathan rumble, pickups, and a depth-scaled ambient drone
- Score = survival trickle + zone bonuses (+100) + pearls (+50) + fish (+5)
  + cores (+100) + whale encounters (+250) + vent time
