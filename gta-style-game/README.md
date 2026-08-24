# GTA-Style Game 🚗 — Grand Edition

A top-down 2D open-world crime sandbox, built with HTML5 Canvas and vanilla JavaScript.

## 🎮 What It Is

- **9 districts** across a 5,376 × 3,840 px city: Downtown, Port Docks, Chinatown & Red Light, Central Park, City Plaza, Sunrise Suburbs, **Liberty International Airport**, **Liberty Bowl Stadium**, and the Ocean Beach & Marina
- **64+ AI cars** driving with left-hand traffic rules, lane discipline and collision avoidance
- **80 pedestrians** who flee gunfire, get run over, and drop cash
- **Drivable boats** moored off the beach — take to the open sea (cars sink in deep water!)
- Full **WASTED / BUSTED** death-and-arrest loop with hospital & police-station respawns

## 🕹️ Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move on foot / Drive |
| E | Enter/exit vehicles · Shop · Answer payphone |
| Mouse aim + Click | Shoot (on foot) |
| 1–5 / Scroll | Switch weapons (Fists, Pistol, Shotgun, Uzi, RPG) |
| Space | Handbrake / Brake |
| R | Change radio station (in car) |
| H | Horn |

## ✨ What's Grand

### The Map
- **Airport district**: huge glass terminal, hangars, aircraft parking apron, and a marked runway — with a parked airliner and a stunt ramp at the runway start for high-speed jumps toward the beach
- **Liberty Bowl Stadium**: a massive multi-tile stadium with stands, running track and floodlit pitch
- **Pink Palace Casino** in Chinatown: gamble $100 a pull (47% payout, neon included)
- **Fuel Stations** ×2: stop in the bay to repair your ride for $50
- **City Plaza**: paved square with animated fountains beside Burger Shot
- Living beaches: palm trees, striped umbrellas, deck chairs

### Wanted Level Escalation
- ★★ Cops open fire (drive-by pistol fire, target leading)
- ★★★★ SWAT roll out **and a police helicopter circles overhead** — spotlight at night, door gunner firing bursts
- ★★★★★ **Tanks** shell you with explosive cannon rounds

### Consequences
- Health/armor damage from bullets, explosions, crashes and drowning
- **WASTED**: respawn at General Hospital, lose $300
- **BUSTED** (caught on foot by a stopped cop): respawn at Police HQ, lose $150 and half your ammo
- Brief spawn-protection invulnerability after every release

### Weather System
Living atmosphere cycle: ☀️ clear → ⛅ overcast → 🌧️ rain → ⛈️ thunderstorm
- Rain streaks, wet-asphalt sheen, procedural rain ambience
- Jagged lightning bolts with screen flash and delayed rolling thunder
- Storms dim the world; street lamps, headlights and the chopper's searchlight matter more

### Also In Town
- Payphone missions: Taxi Fare, Police Chase, Mob Hit
- Stunt jumps with airtime/distance cash bonuses
- Pay 'n' Spray (repaint + clear wanted), Ammu-Nation, Burger Shot
- Day/night cycle with headlight beams and street-lamp glows
- Collectible cash piles, medkits, armor and police-bribe stars
- Procedural radio: 3 stations of synthesized basslines
- Circular minimap with landmark blips, runway overlay and helicopter radar ping

## 🛠️ Technical

**Files:**
- `index.html` / `styles.css` - Page shell, HUD, death overlays
- `game.js` - Core loop, weather, helicopter, police escalation, missions, minimap
- `worldData.js` - Procedural city grid generator & district naming
- `world.js` - World parsing, terrain/landmark rendering, prop population
- `car.js` - Vehicle physics/AI, water sinking, Boat class
- `player.js` / `pedestrian.js` - On-foot characters
- `weapons.js` - Bullets, RPG splash damage, NPC fire
- `props.js` - Street props, fountains, airliner, collectibles
- `particles.js` - Skid marks, explosions, rain splashes, hydrants
- `audio.js` - Web Audio engine/radio/sirens/thunder/rain

**Built with:** HTML5 Canvas, Vanilla JS, Web Audio API. No build step.

## 🚀 Running

Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). Click once to enable audio.

---

*Originally built with grok-code-fast; enhanced with code-supernova; Grand Edition adds the airport, stadium, weather, police escalation, boats and the full wasted/busted loop.*
