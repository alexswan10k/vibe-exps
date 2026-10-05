# GTA-Style Game 🚗 — Grand Edition

A top-down 2D open-world crime sandbox, built with HTML5 Canvas and vanilla JavaScript.

## 🎮 What It Is

- A **huge 9,600 × 7,200 px procedurally generated island city** (100×75 blocks) with 20 named districts
- **Destination-driven road network**: 19 curved avenues computed via a minimum-spanning tree over 16 real destinations (every landmark, stadium gate, airport, pier, marina, park) — so every road visibly goes somewhere. Plus an organically wobbling **Grand Circle** beltway and the **Vespucci**/**Algonkin** regional spines. AI traffic follows lane offsets along splines, turns at nodes, stops for lights, and bridge decks are fully drivable over water
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
- **Arterials follow the street grid**: destination avenues are laid as axis-aligned
  doglegs with rounded corners rather than free-floating diagonals, so roads read as
  roads instead of spaghetti. Two named scenic routes (Vespucci / Algonkin) stay
  deliberately curved
- **No accidental cul-de-sacs**: a prune pass drops short dead-end stubs left by grid
  trimming and curve splitting. It skips roads that legitimately run off the map edge,
  never cascades (candidates are collected in one pass, or trimming cascades and eats
  whole streets), and rolls back wholesale if it would ever disconnect the city
- **One junction per intersection**: near-coincident junctions are merged, so a crossing
  can't end up with two sets of lights stacked on top of each other
- **No roads drawn on top of each other**: parallel roads covering the same ground are
  detected and the lower-class one dropped, keeping the arterial
- **Nothing built or mounted in the carriageway**: landmarks that land on a road are
  shrunk or nudged clear, and signal heads step out to whichever kerb is free
- Junction nodes with working **traffic signals** and three fountain **roundabouts**
- Signals are **per-approach, not per-junction**: arms are grouped by bearing so only
  opposing movements share a phase, and each junction cycles GREEN → AMBER → all-red
  clearance. Amber is obeyed only when a car can still stop comfortably. AI traffic
  holds the stop line; the player is free to run reds
- Winding river with estuary island, riparian parks, wavy coastline, Salty's Pier, marina, Gull Island & Pelican Cay
- Airport (terminal, hangars, airliner, runway ramp), Liberty Bowl Stadium, Pink Palace Casino, 3 fuel stations, 2 Pay 'n' Sprays
- **14 building styles**: glass skyscrapers & office towers downtown, pagoda-roofed Chinatown blocks, brownstones, Little Italy shopfronts with striped awnings, industrial warehouses & container stacks, suburbia with victorian painted-ladies, ranch houses, gardens, pools and white-steepled churches
- Merged superblocks, courtyards & alley yards, parking lots, construction sites

### The City Block
- Leftover lots from road clearance are **infilled** rather than left as bare lawn, so the
  street wall stays continuous. Each infill building shrinks-to-fit until it clears the
  carriageway, and is styled to its district (offices downtown, brownstones in Little Italy,
  ranch houses in the suburbs)
- Road-adjacent gaps that can't fit a building become paved **verges** so kerbs read correctly

### Day/Night
- One in-game day per **10 real minutes**, starting mid-morning. Street lamps, traffic
  signals and window lights come on as it darkens
