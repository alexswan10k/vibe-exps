# 🧪 AETHER CRUCIBLE — The Elemental Synthesizer

A standalone, top-down elemental physics action roguelike built entirely in vanilla HTML5 Canvas, CSS3, JavaScript, and the Web Audio API.

Run directly in any modern browser by double-clicking `index.html` (or via `file:///`). No build step, no bundlers, and zero external dependencies.

---

## 🎮 How to Play

Open `index.html` in your browser.

### Controls (Keyboard & Mouse)
- **WASD / Arrow Keys** — Move
- **Mouse Cursor** — Aim catalyst
- **Left Click** — Continuous Primary Elemental Stream / Bolt
- **Right Click** — Secondary Transmutation (heavy elemental projectile / blast)
- **1, 2, 3, 4, 5, 6** or **Mouse Wheel** — Swap Active Element
- **Q / E** — Throw Alchemical Flask (creates lingering elemental ground puddles)
- **Space / Shift** — Phase Dash (invulnerable burst)
- **C** — Open / Close the Alchemical Codex & Reaction Guide

### Controls (Mobile Touch)
- **Left Virtual Stick** — Move
- **Right Virtual Stick** — Aim & Continuous Primary Fire
- **💨 Button** — Phase Dash
- **✨ Button** — Secondary Transmutation
- **🧪 Button** — Throw Flask
- **Bottom Element Bar** — Tap to instantly swap elements

---

## ⚡ The Primal Elements & Reactions

You command 6 primal elements. When two complementary or opposing elements strike the same target or ground field, an **Elemental Reaction** erupts with devastating multipliers!

| Reaction | Elements | Effect |
| :--- | :--- | :--- |
| **Steam Eruption** | 🔥 Pyros + 💧 Hydros | Boiling scalding steam cloud dealing AoE burn damage & blinding enemies |
| **Hydro-Electric Arc** | 💧 Hydros + ⚡ Voltos | High-voltage arc chaining through all wet targets/puddles with 1.5s Stun |
| **Glacial Shatter** | ❄️ Cryos + ⚡ Voltos | Shatters frozen targets into 8 high-velocity piercing ice shrapnel shards |
| **Bio-Plasmic Detonation** | 🔥 Pyros + ☣️ Toxis | Chemical detonation dealing massive damage & leaving burning toxic ground |
| **Cryo-Thermal Fracture** | 🔥 Pyros + ❄️ Cryos | Extreme thermal shock cracking enemy armor (-50% DEF) and brittle damage |
| **Plasma Ionization** | ⚡ Voltos + ☣️ Toxis | Supercharged ionizing plasma disabling enemy attacks |
| **Solar Singularity** | 🔥 Pyros + 🌌 Aether | Gravitational vortex drawing enemies inward before a solar flare blast |
| **Vortex Maelstrom** | 💧 Hydros + 🌌 Aether | Rapid tidal whirlpool trapping and crushing enemies |
| **Electromagnetic Collapse** | ⚡ Voltos + 🌌 Aether | EMP shockwave silencing and heavily shocking the entire room |
| **Event Horizon Freeze** | ❄️ Cryos + 🌌 Aether | Deep freeze singularity stopping time and enemy projectiles |
| **Corrosive Graviton** | ☣️ Toxis + 🌌 Aether | Dark matter vortex rapidly melting enemy armor and shields |

---

## 🏛️ Sectors & Bosses

1. **Sector I: The Overgrown Spores** — Acidic flora, toxic spore crawlers. Boss: *The Spore Behemoth*.
2. **Sector II: The Molten Foundry** — Scorched basalt, lava rivers, pyre automatons. Boss: *The Pyre Colossus*.
3. **Sector III: The Glacial Vaults** — Ice sheets, frost wisps, glacial sentinels. Boss: *The Cryo Archon*.
4. **Sector IV: The Core Singularity** — Gravitational rifts, void phantoms. Boss: *The Primordial Chimera*.

---

## 🧙 Character Archetypes

- **🔥 Ignis Vanguard (Pyromancer)** — High vitality. +25% Fire damage; killing burning enemies triggers an incendiary shrapnel burst.
- **⚡ Storm Weaver** — High agility. +20% move speed after dashing; lightning sparks jump to +2 additional targets.
- **🌌 Void Astrologer** — Phase dash leaves frost fields; +35% Singularity pull radius.

---

## 🛠️ Technical Architecture

- **100% Self-Contained:** Zero dependencies, zero build scripts. Runs directly off `file:///`.
- **Procedural Web Audio Engine:** Dynamic multi-layered ambient synthesizer that shifts scales and tempo based on sector and combat tension. Real-time synthesized SFX for all elements, reactions, and boss roars without requiring audio files.
- **Object-Pooled Particle Physics:** Smooth 60 FPS particle systems, fluid ground puddle simulations, and glowing bloom blend modes.
- **Classic Object/Component Design:** Sequential `<script src="...">` loading adhering strictly to repository architecture guidelines.
