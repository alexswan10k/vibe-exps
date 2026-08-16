/**
 * Aether Crucible — Procedural Map & Delve Generator
 * Sector biomes, room generation, collision detection, and obstacle rendering.
 */

const SECTOR_BIOMES = [
  {
    name: 'The Overgrown Spores',
    floorColor: '#0b1311',
    floorAltColor: '#0e1815',
    wallColor: '#1a2e26',
    wallBorder: '#2dd4bf',
    accentColor: '#10b981',
    pillarColor: '#064e3b',
    hazardType: 'acid'
  },
  {
    name: 'The Molten Foundry',
    floorColor: '#140c0b',
    floorAltColor: '#1c100e',
    wallColor: '#361510',
    wallBorder: '#f97316',
    accentColor: '#ef4444',
    pillarColor: '#7c2d12',
    hazardType: 'fire'
  },
  {
    name: 'The Glacial Vaults',
    floorColor: '#09131a',
    floorAltColor: '#0c1a24',
    wallColor: '#163147',
    wallBorder: '#38bdf8',
    accentColor: '#06b6d4',
    pillarColor: '#0369a1',
    hazardType: 'ice'
  },
  {
    name: 'The Core Singularity',
    floorColor: '#0d0a17',
    floorAltColor: '#140f24',
    wallColor: '#281a45',
    wallBorder: '#c084fc',
    accentColor: '#a855f7',
    pillarColor: '#581c87',
    hazardType: 'water'
  }
];

class DungeonMap {
  constructor(tileSize = 48, cols = 22, rows = 14) {
    this.tileSize = tileSize;
    this.cols = cols;
    this.rows = rows;
    this.width = cols * tileSize;
    this.height = rows * tileSize;

    this.grid = []; // 0 = empty floor, 1 = solid wall, 2 = destructible pillar, 3 = hazard vent
    this.sectorIndex = 0;
    this.roomType = 'combat'; // 'combat', 'crucible', 'elixir', 'boss'
    this.doorsOpen = false;
    this.doors = { north: false, south: false, east: false, west: false };
    this.shrines = []; // Upgrade fountains or shrines in non-combat rooms

    this.generateRoom(0, 'combat', 1);
  }

  generateRoom(sectorIndex, roomType, roomNumber) {
    this.sectorIndex = Math.min(SECTOR_BIOMES.length - 1, sectorIndex);
    this.roomType = roomType;
    this.doorsOpen = (roomType !== 'combat' && roomType !== 'boss');
    this.doors = { north: true, south: roomNumber > 1, east: true, west: true };
    this.shrines = [];

    // Initialize blank grid
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));

    // Outer boundary walls
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          this.grid[r][c] = 1; // Solid Wall
        }
      }
    }

    // Carve door openings in middle of walls
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);
    if (this.doors.north) { this.grid[0][midC] = 0; this.grid[0][midC - 1] = 0; }
    if (this.doors.south) { this.grid[this.rows - 1][midC] = 0; this.grid[this.rows - 1][midC - 1] = 0; }
    if (this.doors.east) { this.grid[midR][this.cols - 1] = 0; this.grid[midR - 1][this.cols - 1] = 0; }
    if (this.doors.west) { this.grid[midR][0] = 0; this.grid[midR - 1][0] = 0; }

    // Place interior architectural features depending on room type
    if (roomType === 'combat') {
      this.generateCombatObstacles();
    } else if (roomType === 'crucible') {
      // Place Alchemical Crucible Fountain in center
      this.shrines.push({
        x: this.width / 2,
        y: this.height / 2,
        radius: 28,
        type: 'crucible',
        used: false,
        name: 'Alchemical Crucible Font'
      });
    } else if (roomType === 'elixir') {
      this.shrines.push({
        x: this.width / 2,
        y: this.height / 2,
        radius: 28,
        type: 'elixir',
        used: false,
        name: 'Elixir of Transmutation'
      });
    }
  }

  generateCombatObstacles() {
    // Symmetrical pillars / obstacles
    const patterns = [
      // 4 Corner Pillars
      () => {
        const offsets = [[5, 4], [this.cols - 6, 4], [5, this.rows - 5], [this.cols - 6, this.rows - 5]];
        offsets.forEach(([c, r]) => {
          this.grid[r][c] = 2; // Destructible pillar
          this.grid[r][c + 1] = 2;
        });
      },
      // Central Alchemical Ring
      () => {
        const midC = Math.floor(this.cols / 2);
        const midR = Math.floor(this.rows / 2);
        this.grid[midR - 2][midC - 2] = 2;
        this.grid[midR - 2][midC + 2] = 2;
        this.grid[midR + 2][midC - 2] = 2;
        this.grid[midR + 2][midC + 2] = 2;
      },
      // Hazard Vents
      () => {
        const midC = Math.floor(this.cols / 2);
        const midR = Math.floor(this.rows / 2);
        this.grid[midR - 3][midC] = 3; // Hazard Vent
        this.grid[midR + 3][midC] = 3;
      }
    ];

    const chosenPattern = patterns[Math.floor(Math.random() * patterns.length)];
    chosenPattern();
  }

  unlockDoors() {
    this.doorsOpen = true;
  }

  isWall(x, y) {
    if (!this.grid || !this.grid.length) return true;
    const c = Math.floor(x / this.tileSize);
    const r = Math.floor(y / this.tileSize);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols || !this.grid[r]) return true;

    // If doors are locked, door gaps act as walls
    if (!this.doorsOpen) {
      if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) return true;
    }

    return this.grid[r][c] === 1 || this.grid[r][c] === 2;
  }

  resolveCollision(entity) {
    if (!this.grid || !this.grid.length) return;
    const rad = entity.radius;
    const startC = Math.max(0, Math.floor((entity.x - rad) / this.tileSize));
    const endC = Math.min(this.cols - 1, Math.floor((entity.x + rad) / this.tileSize));
    const startR = Math.max(0, Math.floor((entity.y - rad) / this.tileSize));
    const endR = Math.min(this.rows - 1, Math.floor((entity.y + rad) / this.tileSize));

    for (let r = startR; r <= endR; r++) {
      if (!this.grid[r]) continue;
      for (let c = startC; c <= endC; c++) {
        let isSolid = (this.grid[r][c] === 1 || this.grid[r][c] === 2);
        if (!this.doorsOpen && (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1)) {
          isSolid = true;
        }

        if (isSolid) {
          const tileLeft = c * this.tileSize;
          const tileTop = r * this.tileSize;
          const nearestX = Math.max(tileLeft, Math.min(entity.x, tileLeft + this.tileSize));
          const nearestY = Math.max(tileTop, Math.min(entity.y, tileTop + this.tileSize));

          const dx = entity.x - nearestX;
          const dy = entity.y - nearestY;
          const dist = Math.hypot(dx, dy);

          if (dist < rad && dist > 0) {
            const overlap = rad - dist;
            entity.x += (dx / dist) * overlap;
            entity.y += (dy / dist) * overlap;
          }
        }
      }
    }
  }

  checkDoorExit(entity) {
    if (!this.doorsOpen) return null;
    const midC = Math.floor(this.cols / 2) * this.tileSize;
    const midR = Math.floor(this.rows / 2) * this.tileSize;

    if (entity.y <= 12) return 'north';
    if (entity.y >= this.height - 12) return 'south';
    if (entity.x >= this.width - 12) return 'east';
    if (entity.x <= 12) return 'west';

    return null;
  }

  render(ctx) {
    if (!this.grid || !this.grid.length || !this.grid[0]) return;
    const biome = SECTOR_BIOMES[this.sectorIndex] || SECTOR_BIOMES[0];

    // 1. Draw Floor Tiles
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.tileSize;
        const y = r * this.tileSize;

        ctx.fillStyle = (r + c) % 2 === 0 ? biome.floorColor : biome.floorAltColor;
        ctx.fillRect(x, y, this.tileSize, this.tileSize);

        // Tile border grid pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, this.tileSize, this.tileSize);
      }
    }

    // 2. Draw Walls and Pillars
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.tileSize;
        const y = r * this.tileSize;
        const tile = this.grid[r][c];

        if (tile === 1) { // Wall
          ctx.fillStyle = biome.wallColor;
          ctx.fillRect(x, y, this.tileSize, this.tileSize);

          ctx.strokeStyle = biome.wallBorder;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, this.tileSize, this.tileSize);
        } else if (tile === 2) { // Destructible Pillar
          ctx.fillStyle = biome.pillarColor;
          ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);

          ctx.strokeStyle = biome.accentColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
        } else if (tile === 3) { // Hazard Vent
          ctx.fillStyle = '#020617';
          ctx.beginPath();
          ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = biome.accentColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // 3. Draw Door Waypoints / Portals
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    const doorColor = this.doorsOpen ? '#22c55e' : '#ef4444';
    ctx.save();
    ctx.shadowBlur = this.doorsOpen ? 18 : 6;
    ctx.shadowColor = doorColor;
    ctx.fillStyle = doorColor;

    if (this.doors.north) {
      ctx.fillRect((midC - 1) * this.tileSize, 0, this.tileSize * 2, 8);
    }
    if (this.doors.south) {
      ctx.fillRect((midC - 1) * this.tileSize, this.height - 8, this.tileSize * 2, 8);
    }
    if (this.doors.east) {
      ctx.fillRect(this.width - 8, (midR - 1) * this.tileSize, 8, this.tileSize * 2);
    }
    if (this.doors.west) {
      ctx.fillRect(0, (midR - 1) * this.tileSize, 8, this.tileSize * 2);
    }
    ctx.restore();

    // 4. Draw Shrines / Upgrade Fonts
    for (const shrine of this.shrines) {
      if (shrine.used) continue;
      ctx.save();
      ctx.translate(shrine.x, shrine.y);

      ctx.shadowBlur = 25;
      ctx.shadowColor = '#a855f7';
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, shrine.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Alchemical Icon in center
      ctx.font = '24px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shrine.type === 'crucible' ? '⚗️' : '✨', 0, 0);

      ctx.restore();
    }
  }
}

window.DungeonMap = DungeonMap;
window.SECTOR_BIOMES = SECTOR_BIOMES;
