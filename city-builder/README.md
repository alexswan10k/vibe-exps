# SimCity Classic — Urban Management Simulator

A rich, standalone HTML5 Canvas / PixiJS city management simulation inspired by classic SimCity. Build sprawling metropolises, manage public safety, budget municipal taxes, enact city ordinances, deal with natural disasters, and watch living traffic and Sims roam your streets.

## Features

### 1. 4-Tier Zoning & Development
- **Residential (Green)**: Small Cottages &rarr; Townhouse Rows &rarr; Brick Apartment Complexes &rarr; Luxury High-Rise Towers.
- **Commercial (Blue)**: Corner Stores &rarr; Shopping Arcades &rarr; Commercial Plazas &rarr; Corporate Glass Skyscrapers.
- **Industrial (Orange)**: Workshops &rarr; Factory Yards &rarr; Heavy Manufacturing &rarr; Advanced High-Tech Complexes.
- Dynamic autonomous growth and upgrades driven by RCI market demand, land value, occupancy, and public services (education, healthcare, police coverage).

### 2. Comprehensive Civic Services & Utilities
- **Power**: Coal Power Plants (high output, pollution) and Wind Turbines (clean green power, 1x1 footprint).
- **Water**: Water Towers and River/Coastal Water Pump Stations.
- **Public Safety**: Fire Departments (dispatch fire trucks to active blazes) and Police Precincts (suppress crime and raise land value).
- **Healthcare & Education**: General Hospitals (boost life expectancy and health index) and Community Schools (raise literacy EQ to unlock tier-4 high-tech towers).
- **Civic Landmarks**: City Hall and City Parks.
- **Infrastructure**: Roads and Wooden/Steel Bridges over rivers with automatic bridge detection.

### 3. Economy, Taxes & Municipal Governance
- **Interactive Financial Ledger**: Independent tax rate sliders for Residential, Commercial, and Industrial zones (0% to 20%).
- **City Ordinances**: Enact policies such as *Free Public Transit*, *Smoke Detector Mandate*, *Neighborhood Watch*, *Clean Energy Subsidies*, and *Tourism Promotion*.
- **City Milestones**: Progress from a humble *Settlement* through *Hamlet*, *Village*, *Town*, *City*, *Metropolis*, and *Megalopolis* with cash rewards and unlocks.

### 4. Emergencies & Disasters
- **Fire Simulation**: Spontaneous fires in unwatered, unserved, or high-density areas; fire propagation to adjacent structures; automatic fire truck dispatch and water cannon extinguishing.
- **Disaster Command**: Manually trigger *Meteor Strikes*, *Tornados*, or *Fire Outbreaks* to stress-test your emergency responders.
- **Blackouts & Brownouts**: Rolling power outages when grid capacity is exceeded.

### 5. Living City & Sound Effects
- **Living Traffic**: Sedans, Taxis, City Buses, Freight Trucks, and Emergency Responders (Fire Trucks with flashing siren strobe lights, Police Cruisers).
- **Sims (Pedestrians)**: Pedestrians strolling along sidewalks and visiting parks.
- **Lighting Ambiance**: Day, Sunset, and Night visual modes with glowing windows and streetlights.
- **Web Audio Sound Effects**: 100% offline procedural synthesizer (clicks, build thuds, road laying, demolition crunches, cash registers, sirens, explosions, and milestone fanfares).

### 6. Diagnostic Overlays & Minimap
- **9 Diagnostic Overlays**: Power Grid, Water Pipes, Land Value, Fire Hazard, Crime Rate, Health Index, Education EQ, and Traffic Density.
- **Interactive Minimap**: Real-time overview of the 64x64 territory with a clickable viewport box.
- **SimCity News Ticker**: Dynamic witty news ticker with citizen quotes and breaking emergency alerts.

---

## Controls & Shortcuts

| Action | Shortcut / Mouse |
|---|---|
| **Inspect / Select** | `Q` or Click building |
| **Build Road / Bridge** | `R` (Click & Drag straight line) |
| **Zone Residential** | `1` (Click & Drag rectangle) |
| **Zone Commercial** | `2` (Click & Drag rectangle) |
| **Zone Industrial** | `3` (Click & Drag rectangle) |
| **Dezone / Clear** | `4` (Click & Drag rectangle) |
| **City Park** | `5` |
| **Coal Power Plant** | `6` |
| **Water Tower** | `7` |
| **Demolish / Bulldoze** | `X` or `Delete` |
| **Cycle Overlay** | `O` |
| **Toggle Day / Sunset / Night** | `T` |
| **Pause / Resume** | `Space` |
| **Speed Up / Down** | `+` / `-` |
| **Pan Camera** | Drag with Right/Middle Mouse or Left Drag in Inspect mode |
| **Zoom In / Out** | Mouse Wheel or Touch Pinch |

---

## Running the Game

Simply double-click `index.html` to open directly in any modern web browser. No build steps, bundlers, or servers required!

To run the automated headless simulation test suite:
```bash
node smoke-test.mjs
```
