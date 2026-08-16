/**
 * Aether Crucible — Advanced Connected Dungeon Floor Engine
 * Full multi-room floor layout graph generator with 2-way door connectivity,
 * branching rooms (Start, Combat, Crucible Fonts, Elixir Shrines, Boss Arena),
 * persistent room states, and 2.5D shaded architectural topologies.
 */

const SECTOR_BIOMES = [
  {
    name: 'The Overgrown Spores',
    floorColor: '#0c1512',
    floorAltColor: '#101c18',
    tileBorder: 'rgba(16, 185, 129, 0.08)',
    wallTopColor: '#1f3d32',
    wallFrontColor: '#13261f',
    wallBorder: '#34d399',
    accentColor: '#10b981',
    pillarTop: '#064e3b',
    pillarFront: '#022c22',
    chasmColor: '#030806',
    hazardType: 'acid',
    torchColor: '#10b981',
    torchGlow: 'rgba(16, 185, 129, 0.25)'
  },
  {
    name: 'The Molten Foundry',
    floorColor: '#180c0a',
    floorAltColor: '#22110e',
    tileBorder: 'rgba(239, 68, 68, 0.08)',
    wallTopColor: '#451a14',
    wallFrontColor: '#2c0f0a',
    wallBorder: '#f97316',
    accentColor: '#ef4444',
    pillarTop: '#7c2d12',
    pillarFront: '#451a03',
    chasmColor: '#1a0502',
    hazardType: 'fire',
    torchColor: '#ff6600',
    torchGlow: 'rgba(255, 102, 0, 0.35)'
  },
  {
    name: 'The Glacial Vaults',
    floorColor: '#091521',
    floorAltColor: '#0d1d2d',
    tileBorder: 'rgba(6, 182, 212, 0.08)',
    wallTopColor: '#1e3a5f',
    wallFrontColor: '#102238',
    wallBorder: '#38bdf8',
    accentColor: '#06b6d4',
    pillarTop: '#0284c7',
    pillarFront: '#034a75',
    chasmColor: '#020810',
    hazardType: 'ice',
    torchColor: '#00e5ff',
    torchGlow: 'rgba(0, 229, 255, 0.25)'
  },
  {
    name: 'The Core Singularity',
    floorColor: '#100c22',
    floorAltColor: '#161130',
    tileBorder: 'rgba(168, 85, 247, 0.08)',
    wallTopColor: '#3b1d6e',
    wallFrontColor: '#230f45',
    wallBorder: '#c084fc',
    accentColor: '#a855f7',
    pillarTop: '#6b21a8',
    pillarFront: '#3b0764',
    chasmColor: '#05020c',
    hazardType: 'water',
    torchColor: '#d946ef',
    torchGlow: 'rgba(217, 70, 239, 0.3)'
  }
];

class DungeonRoomNode {
  constructor(gridX, gridY, roomType = 'combat') {
    this.gridX = gridX;
    this.gridY = gridY;
    this.roomType = roomType; // 'start', 'combat', 'crucible', 'elixir', 'boss'
    this.visited = false;
    this.cleared = (roomType === 'start');
    this.doors = { north: false, south: false, east: false, west: false };
    this.topology = 'arena';
    this.destructibles = null; // Stored state
    this.shrines = null;
  }
}

class FloorLayout {
  constructor(sectorIndex = 0, targetRooms = 8) {
    this.sectorIndex = sectorIndex;
    this.gridSize = 5;
    this.rooms = new Map(); // key 'x,y' -> DungeonRoomNode
    this.startPos = { x: 2, y: 2 };
    this.bossPos = null;

    this.generateFloor(targetRooms);
  }

  getKey(x, y) {
    return `${x},${y}`;
  }

  getRoom(x, y) {
    return this.rooms.get(this.getKey(x, y)) || null;
  }

  generateFloor(targetRooms = 8) {
    this.rooms.clear();

    // 1. Create Start Room at (2, 2)
    const startRoom = new DungeonRoomNode(this.startPos.x, this.startPos.y, 'combat');
    startRoom.visited = true;
    startRoom.cleared = false;
    startRoom.topology = 'crossroads_spires';
    this.rooms.set(this.getKey(this.startPos.x, this.startPos.y), startRoom);

    // 2. Random Walk Branching
    const roomPositions = [{ x: 2, y: 2 }];
    const directions = [
      { dx: 0, dy: -1, dir: 'north', opp: 'south' },
      { dx: 0, dy: 1, dir: 'south', opp: 'north' },
      { dx: 1, dy: 0, dir: 'east', opp: 'west' },
      { dx: -1, dy: 0, dir: 'west', opp: 'east' }
    ];

    while (this.rooms.size < targetRooms) {
      const source = roomPositions[Math.floor(Math.random() * roomPositions.length)];
      const d = directions[Math.floor(Math.random() * directions.length)];
      const nx = source.x + d.dx;
      const ny = source.y + d.dy;

      if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
        const key = this.getKey(nx, ny);
        if (!this.rooms.has(key)) {
          const newRoom = new DungeonRoomNode(nx, ny, 'combat');
          this.rooms.set(key, newRoom);
          roomPositions.push({ x: nx, y: ny });
        }
      }
    }

    // 3. Connect matching 2-way doors
    this.rooms.forEach(room => {
      directions.forEach(d => {
        const neighbor = this.getRoom(room.gridX + d.dx, room.gridY + d.dy);
        if (neighbor) {
          room.doors[d.dir] = true;
        }
      });
    });

    // 4. Assign Special Room Roles
    // Find furthest room from start for Boss
    let maxDist = -1;
    let furthestPos = null;
    const allRooms = Array.from(this.rooms.values());

    allRooms.forEach(r => {
      if (r === startRoom) return;
      const dist = Math.abs(r.gridX - this.startPos.x) + Math.abs(r.gridY - this.startPos.y);
      if (dist > maxDist) {
        maxDist = dist;
        furthestPos = r;
      }
    });

    if (furthestPos) {
      furthestPos.roomType = 'boss';
      this.bossPos = { x: furthestPos.gridX, y: furthestPos.gridY };
    }

    // Assign one Crucible Room (Upgrade Font)
    const combatRooms = allRooms.filter(r => r.roomType === 'combat' && r !== startRoom);
    if (combatRooms.length > 0) {
      const crucibleRoom = combatRooms.pop();
      crucibleRoom.roomType = 'crucible';
    }

    // Assign one Elixir Room if enough rooms
    if (combatRooms.length > 1) {
      const elixirRoom = combatRooms.pop();
      elixirRoom.roomType = 'elixir';
    }

    // Assign varied topologies to combat rooms
    const topologies = ['chasm_bridges', 'reactor_core', 'labyrinth_ruins', 'quad_sanctum', 'crossroads_spires'];
    combatRooms.forEach((r, idx) => {
      r.topology = topologies[idx % topologies.length];
    });
  }
}

class DungeonMap {
  constructor(tileSize = 48, cols = 24, rows = 15) {
    this.tileSize = tileSize;
    this.cols = cols;
    this.rows = rows;
    this.width = cols * tileSize;
    this.height = rows * tileSize;

    this.grid = [];
    this.sectorIndex = 0;
    this.roomType = 'combat';
    this.activeRoomNode = null;
    this.doorsOpen = false;
    this.doors = { north: false, south: false, east: false, west: false };
    this.shrines = [];
    this.torches = [];
    this.destructibles = [];
    this.roomTopology = 'arena';
  }

  loadRoomFromNode(sectorIndex, roomNode) {
    this.sectorIndex = Math.min(SECTOR_BIOMES.length - 1, sectorIndex);
    this.activeRoomNode = roomNode;
    this.roomType = roomNode.roomType;
    roomNode.visited = true;

    this.doorsOpen = roomNode.cleared;
    this.doors = { ...roomNode.doors };
    this.roomTopology = roomNode.topology;
    this.shrines = [];
    this.torches = [];
    this.destructibles = [];

    // Initialize blank floor grid
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));

    // Outer boundary walls
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          this.grid[r][c] = 1;
        }
      }
    }

    // Carve door openings in walls ONLY where doors exist
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);
    if (this.doors.north) { this.grid[0][midC] = 0; this.grid[0][midC - 1] = 0; }
    if (this.doors.south) { this.grid[this.rows - 1][midC] = 0; this.grid[this.rows - 1][midC - 1] = 0; }
    if (this.doors.east) { this.grid[midR][this.cols - 1] = 0; this.grid[midR - 1][this.cols - 1] = 0; }
    if (this.doors.west) { this.grid[midR][0] = 0; this.grid[midR - 1][0] = 0; }

    // Place decorative wall torches near doors
    if (this.doors.north) {
      this.torches.push({ x: (midC - 3) * this.tileSize, y: 12 }, { x: (midC + 3) * this.tileSize, y: 12 });
    }
    if (this.doors.south) {
      this.torches.push({ x: (midC - 3) * this.tileSize, y: (this.rows - 1) * this.tileSize + 36 }, { x: (midC + 3) * this.tileSize, y: (this.rows - 1) * this.tileSize + 36 });
    }
    if (this.doors.east) {
      this.torches.push({ x: (this.cols - 1) * this.tileSize + 36, y: (midR - 3) * this.tileSize }, { x: (this.cols - 1) * this.tileSize + 36, y: (midR + 3) * this.tileSize });
    }
    if (this.doors.west) {
      this.torches.push({ x: 12, y: (midR - 3) * this.tileSize }, { x: 12, y: (midR + 3) * this.tileSize });
    }

    // Build room architectural features
    if (roomNode.roomType === 'combat') {
      this.buildTopology(roomNode.topology);
      if (!roomNode.cleared) {
        this.spawnEnvironmentalProps();
      }
    } else if (roomNode.roomType === 'boss') {
      this.buildGrandColosseum();
      if (!roomNode.cleared) {
        this.spawnEnvironmentalProps();
      }
    } else if (roomNode.roomType === 'crucible') {
      this.buildCrucibleChamber();
    } else if (roomNode.roomType === 'elixir') {
      this.buildElixirChamber();
    }
  }

  buildTopology(topology) {
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    switch (topology) {
      case 'chasm_bridges':
        for (let r = 2; r < this.rows - 2; r++) {
          for (let c = 5; c <= 7; c++) this.grid[r][c] = 4;
          for (let c = this.cols - 8; c <= this.cols - 6; c++) this.grid[r][c] = 4;
        }
        for (let c = 5; c <= 7; c++) { this.grid[midR][c] = 0; this.grid[midR - 1][c] = 0; }
        for (let c = this.cols - 8; c <= this.cols - 6; c++) { this.grid[midR][c] = 0; this.grid[midR - 1][c] = 0; }
        this.grid[midR - 3][midC] = 3;
        this.grid[midR + 3][midC] = 3;
        break;

      case 'reactor_core':
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
          const r = Math.round(midR + Math.sin(angle) * 3.5);
          const c = Math.round(midC + Math.cos(angle) * 5.0);
          if (r > 1 && r < this.rows - 2 && c > 1 && c < this.cols - 2) {
            this.grid[r][c] = 2;
          }
        }
        this.grid[midR][midC] = 3;
        break;

      case 'labyrinth_ruins':
        const wallSegments = [
          [3, 4, 3, 7], [3, 16, 3, 19],
          [11, 4, 11, 7], [11, 16, 11, 19],
          [5, 9, 8, 9], [5, 14, 8, 14]
        ];
        wallSegments.forEach(([r1, c1, r2, c2]) => {
          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              this.grid[r][c] = 1;
            }
          }
        });
        break;

      case 'quad_sanctum':
        for (let r = 3; r <= 5; r++) {
          this.grid[r][5] = 2;
          this.grid[r][this.cols - 6] = 2;
        }
        for (let r = this.rows - 6; r <= this.rows - 4; r++) {
          this.grid[r][5] = 2;
          this.grid[r][this.cols - 6] = 2;
        }
        this.grid[midR - 3][midC - 4] = 3;
        this.grid[midR - 3][midC + 4] = 3;
        this.grid[midR + 3][midC - 4] = 3;
        this.grid[midR + 3][midC + 4] = 3;
        break;

      case 'crossroads_spires':
      default:
        const spires = [
          [4, 6], [4, this.cols - 7],
          [this.rows - 5, 6], [this.rows - 5, this.cols - 7],
          [midR, 8], [midR, this.cols - 9]
        ];
        spires.forEach(([r, c]) => { this.grid[r][c] = 2; });
        break;
    }
  }

  buildGrandColosseum() {
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    const corners = [
      [3, 4], [3, 5], [4, 4],
      [3, this.cols - 5], [3, this.cols - 6], [4, this.cols - 5],
      [this.rows - 4, 4], [this.rows - 4, 5], [this.rows - 5, 4],
      [this.rows - 4, this.cols - 5], [this.rows - 4, this.cols - 6], [this.rows - 5, this.cols - 5]
    ];
    corners.forEach(([r, c]) => { this.grid[r][c] = 2; });

    this.grid[midR - 4][midC - 6] = 3;
    this.grid[midR - 4][midC + 6] = 3;
    this.grid[midR + 4][midC - 6] = 3;
    this.grid[midR + 4][midC + 6] = 3;
  }

  buildCrucibleChamber() {
    for (let r = 3; r <= this.rows - 4; r += 3) {
      this.grid[r][6] = 2;
      this.grid[r][this.cols - 7] = 2;
    }

    this.shrines.push({
      x: this.width / 2,
      y: this.height / 2,
      radius: 34,
      type: 'crucible',
      used: false,
      name: 'Alchemical Crucible Font'
    });
  }

  buildElixirChamber() {
    this.shrines.push({
      x: this.width / 2,
      y: this.height / 2,
      radius: 34,
      type: 'elixir',
      used: false,
      name: 'Elixir of Transmutation'
    });
  }

  spawnEnvironmentalProps() {
    const barrelTypes = ['fire', 'toxic', 'ice', 'tesla'];
    const propCount = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < propCount; i++) {
      const r = 2 + Math.floor(Math.random() * (this.rows - 4));
      const c = 2 + Math.floor(Math.random() * (this.cols - 4));

      const isCenter = Math.abs(r - this.rows / 2) < 2 && Math.abs(c - this.cols / 2) < 2;
      if (this.grid[r][c] === 0 && !isCenter) {
        const type = barrelTypes[Math.floor(Math.random() * barrelTypes.length)];
        this.destructibles.push({
          x: c * this.tileSize + this.tileSize / 2,
          y: r * this.tileSize + this.tileSize / 2,
          radius: 16,
          type: type,
          hp: 20,
          alive: true
        });
      }
    }
  }

  unlockDoors() {
    this.doorsOpen = true;
    if (this.activeRoomNode) {
      this.activeRoomNode.cleared = true;
    }
  }

  isWall(x, y) {
    if (!this.grid || !this.grid.length) return true;
    const c = Math.floor(x / this.tileSize);
    const r = Math.floor(y / this.tileSize);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols || !this.grid[r]) return true;

    // Locked doors behave as solid perimeter walls
    if (!this.doorsOpen) {
      if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) return true;
    }

    const tile = this.grid[r][c];
    return tile === 1 || tile === 2 || tile === 4;
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
        let isSolid = (this.grid[r][c] === 1 || this.grid[r][c] === 2 || this.grid[r][c] === 4);
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

    if (this.doors.north && entity.y <= 16) return 'north';
    if (this.doors.south && entity.y >= this.height - 16) return 'south';
    if (this.doors.east && entity.x >= this.width - 16) return 'east';
    if (this.doors.west && entity.x <= 16) return 'west';

    return null;
  }

  render(ctx) {
    if (!this.grid || !this.grid.length || !this.grid[0]) return;
    const biome = SECTOR_BIOMES[this.sectorIndex] || SECTOR_BIOMES[0];
    const now = Date.now() / 1000;

    // 1. Draw Floor & Chasms
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.tileSize;
        const y = r * this.tileSize;
        const tile = this.grid[r][c];

        if (tile === 4) {
          ctx.fillStyle = biome.chasmColor;
          ctx.fillRect(x, y, this.tileSize, this.tileSize);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(x, y, this.tileSize, 6);
          ctx.fillRect(x, y, 6, this.tileSize);
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? biome.floorColor : biome.floorAltColor;
          ctx.fillRect(x, y, this.tileSize, this.tileSize);
          ctx.strokeStyle = biome.tileBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
        }
      }
    }

    // 2. Draw Walls & Pillars
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.tileSize;
        const y = r * this.tileSize;
        const tile = this.grid[r][c];

        if (tile === 1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(x, y + this.tileSize - 4, this.tileSize, 10);
          ctx.fillStyle = biome.wallFrontColor;
          ctx.fillRect(x, y + 10, this.tileSize, this.tileSize - 10);
          ctx.fillStyle = biome.wallTopColor;
          ctx.fillRect(x, y, this.tileSize, 10);
          ctx.strokeStyle = biome.wallBorder;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, this.tileSize, this.tileSize);
        } else if (tile === 2) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.beginPath();
          ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2 + 8, this.tileSize / 2 - 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = biome.pillarFront;
          ctx.fillRect(x + 6, y + 12, this.tileSize - 12, this.tileSize - 16);

          ctx.fillStyle = biome.pillarTop;
          ctx.beginPath();
          ctx.arc(x + this.tileSize / 2, y + 14, this.tileSize / 2 - 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = biome.accentColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (tile === 3) {
          ctx.save();
          const pulse = Math.sin(now * 3 + (r + c)) * 0.3 + 0.7;
          ctx.fillStyle = '#05070e';
          ctx.beginPath();
          ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 15 * pulse;
          ctx.shadowColor = biome.accentColor;
          ctx.strokeStyle = biome.accentColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 3. Draw Torches
    for (const t of this.torches) {
      const flicker = Math.sin(now * 8 + t.x * 0.1) * 3 + Math.cos(now * 12 + t.y * 0.1) * 2;
      ctx.save();
      const grad = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, 70 + flicker);
      grad.addColorStop(0, biome.torchGlow);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 75 + flicker, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.fillRect(t.x - 3, t.y - 2, 6, 8);

      ctx.fillStyle = biome.torchColor;
      ctx.shadowBlur = 14;
      ctx.shadowColor = biome.torchColor;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Props & Barrels
    for (const prop of this.destructibles) {
      if (!prop.alive) continue;
      this.renderProp(ctx, prop);
    }

    // 5. Draw Connected Doors ONLY
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);
    const doorColor = this.doorsOpen ? '#22c55e' : '#ef4444';
    const doorGlow = this.doorsOpen ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.5)';

    ctx.save();
    ctx.shadowBlur = this.doorsOpen ? 20 : 8;
    ctx.shadowColor = doorGlow;
    ctx.fillStyle = doorColor;

    if (this.doors.north) {
      ctx.fillRect((midC - 1) * this.tileSize, 0, this.tileSize * 2, 10);
    }
    if (this.doors.south) {
      ctx.fillRect((midC - 1) * this.tileSize, this.height - 10, this.tileSize * 2, 10);
    }
    if (this.doors.east) {
      ctx.fillRect(this.width - 10, (midR - 1) * this.tileSize, 10, this.tileSize * 2);
    }
    if (this.doors.west) {
      ctx.fillRect(0, (midR - 1) * this.tileSize, 10, this.tileSize * 2);
    }
    ctx.restore();

    // 6. Draw Crucible Shrines
    for (const shrine of this.shrines) {
      if (shrine.used) continue;
      ctx.save();
      ctx.translate(shrine.x, shrine.y);

      const pulse = Math.sin(now * 3) * 0.15 + 1.0;
      ctx.shadowBlur = 30 * pulse;
      ctx.shadowColor = '#a855f7';

      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, shrine.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '28px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shrine.type === 'crucible' ? '⚗️' : '✨', 0, 0);
      ctx.restore();
    }
  }

  renderProp(ctx, prop) {
    ctx.save();
    ctx.translate(prop.x, prop.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 8, prop.radius, prop.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    let barrelColor = '#ef4444';
    let ringColor = '#f97316';
    let icon = '🔥';

    if (prop.type === 'toxic') { barrelColor = '#10b981'; ringColor = '#34d399'; icon = '☣️'; }
    if (prop.type === 'ice') { barrelColor = '#06b6d4'; ringColor = '#38bdf8'; icon = '❄️'; }
    if (prop.type === 'tesla') { barrelColor = '#eab308'; ringColor = '#fde047'; icon = '⚡'; }

    ctx.fillStyle = barrelColor;
    ctx.beginPath();
    ctx.roundRect(-prop.radius, -prop.radius - 2, prop.radius * 2, prop.radius * 2 + 4, 6);
    ctx.fill();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '13px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 2);

    ctx.restore();
  }
}

window.DungeonRoomNode = DungeonRoomNode;
window.FloorLayout = FloorLayout;
window.DungeonMap = DungeonMap;
window.SECTOR_BIOMES = SECTOR_BIOMES;
