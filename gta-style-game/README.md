# GTA-Style Game 🚗 — Grand Edition

A top-down 2D open-world crime sandbox, built with HTML5 Canvas and vanilla JavaScript.

## 🎮 What It Is

- A **huge 9,600 × 7,200 px procedurally generated island city** (100×75 blocks) with 20 named districts
- **Node-and-spline road network**: roads are continuous curves defined between junction nodes — an organically wobbling **Grand Circle** beltway plus four named arterials (**Vespucci Boulevard**, **Algonkin Avenue**, **Sunset Drive**, **Kingsway**) and 11 bezier **connector shortcuts** weaving between districts. AI traffic follows lane offsets along the splines, turns at nodes, and stops for junction lights — bridges over water are fully drivable
- An organic street grid with irregular blocks, dead-end yards, limited-access **highways**, roundabouts, and a winding **river** bridged 35 times
- **84 AI cars** and **120 pedestrians**; drivable boats moored at the beach & marina
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
- **The Grand Circle**: an elliptical beltway around downtown, crossing the Liberty River twice on stone bridges
- **Curved boulevards** rendered as smooth carriageways with curbs, double-yellow centerlines and dashed lanes
- Junction nodes with working **traffic lights** and three fountain **roundabouts**
- Winding river with estuary island, riparian parks, wavy coastline, Salty's Pier, marina, Gull Island & Pelican Cay
- Airport (terminal, hangars, airliner, runway ramp), Liberty Bowl Stadium, Pink Palace Casino, 3 fuel stations, 2 Pay 'n' Sprays
- Merged superblocks, courtyards, parking lots, construction sites, container stacks

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
- `worldData.js` - Seeded organic city generator: splined curved roads, Grand Circle beltway, river & bridges, irregular grid, districts
- `world.js` - World parsing, terrain/curve rendering, building merging, prop population
- `car.js` - Vehicle physics/AI, highway speeds, water sinking, Boat class
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
