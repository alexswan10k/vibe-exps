// World Generation, Representation, and Environment Rendering Module

class World {
    constructor(grid) {
        this.grid = grid;
        this.height = grid.length;
        this.width = grid[0].length;

        this.roads = [];
        this.horizontalRoads = [];
        this.verticalRoads = [];
        this.crossroads = [];
        this.buildings = [];
        this.trafficLights = [];
        this.waterTiles = [];
        this.sandTiles = [];
        this.parkTiles = [];
        this.poolTiles = [];
        this.containerStacks = [];
        this.landmarks = []; // Pay 'n' Spray, Ammu-Nation, Diner, Hospital, Police HQ
        this.stuntRamps = [];

        this.convertToObjects();
        this.populateWorldProps();
    }

    static loadFromEmbedded() {
        const lines = WORLD_DATA.trim().split('\n');
        const grid = lines.map(line => line.trim().split(/\s+/));
        return new World(grid);
    }

    convertToObjects() {
        const cellSize = 96;

        this.roads = [];
        this.horizontalRoads = [];
        this.verticalRoads = [];
        this.crossroads = [];
        this.buildings = [];
        this.trafficLights = [];
        this.waterTiles = [];
        this.sandTiles = [];
        this.parkTiles = [];
        this.poolTiles = [];
        this.containerStacks = [];
        this.landmarks = [];
        this.stuntRamps = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const gameX = x * cellSize;
                const gameY = y * cellSize;
                const tile = this.grid[y][x];

                if (tile === 'H') {
                    this.horizontalRoads.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: 'horizontal' });
                } else if (tile === 'V') {
                    this.verticalRoads.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: 'vertical' });
                } else if (tile === 'C') {
                    this.crossroads.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: 'crossroad' });
                } else if (tile === 'T') {
                    this.crossroads.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: 'crossroad' });
                    this.trafficLights.push({ x: gameX + cellSize / 2, y: gameY + cellSize / 2, state: 'red', timer: Math.floor(Math.random() * 300) });
                } else if (tile === 'W' || tile === 'W_COAST' || tile === 'W_POND') {
                    this.waterTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: tile });
                } else if (tile === 'SAND') {
                    this.sandTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'PARK' || tile === 'GARDEN') {
                    this.parkTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: tile });
                } else if (tile === 'POOL') {
                    this.poolTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'CONT') {
                    this.containerStacks.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                    // Container stacks act as solid buildings
                    this.buildings.push({
                        x: gameX + 8, y: gameY + 8, width: cellSize - 16, height: cellSize - 16,
                        style: 'container', color: ['#D32F2F', '#1976D2', '#388E3C', '#F57C00'][(x + y) % 4]
                    });
                } else if (tile === 'PNS') {
                    // Pay 'n' Spray Garage
                    this.landmarks.push({
                        type: 'pns',
                        name: "Pay 'n' Spray",
                        icon: '🔧',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'pns' });
                } else if (tile === 'AMMU') {
                    // Ammu-Nation Store
                    this.landmarks.push({
                        type: 'ammu',
                        name: "Ammu-Nation",
                        icon: '🔫',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'ammu' });
                } else if (tile === 'DINER') {
                    // Burger Shot / Diner
                    this.landmarks.push({
                        type: 'diner',
                        name: "Burger Shot",
                        icon: '🍔',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'diner' });
                } else if (tile === 'HOSP') {
                    // Hospital
                    this.landmarks.push({
                        type: 'hospital',
                        name: "General Hospital",
                        icon: '➕',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'hospital' });
                } else if (tile === 'PD') {
                    // Police Department
                    this.landmarks.push({
                        type: 'police',
                        name: "Police HQ",
                        icon: '🛡️',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'police' });
                } else if (tile.startsWith('RAMP_')) {
                    let angle = 0;
                    if (tile === 'RAMP_E') angle = 0;
                    if (tile === 'RAMP_S') angle = Math.PI / 2;
                    if (tile === 'RAMP_W') angle = Math.PI;
                    if (tile === 'RAMP_N') angle = -Math.PI / 2;

                    this.stuntRamps.push({ x: gameX + cellSize / 2, y: gameY + cellSize / 2, angle: angle });
                } else if (tile.startsWith('B')) {
                    // Building with distinct style
                    let style = 'standard';
                    if (tile === 'B_DT') style = 'downtown';
                    if (tile === 'B_CT') style = 'chinatown';
                    if (tile === 'B_IND') style = 'industrial';
                    if (tile === 'B_SUB') style = 'suburb';
                    if (tile === 'B_BORDER') style = 'border';

                    this.buildings.push({
                        x: gameX + (style === 'border' ? 0 : 6),
                        y: gameY + (style === 'border' ? 0 : 6),
                        width: cellSize - (style === 'border' ? 0 : 12),
                        height: cellSize - (style === 'border' ? 0 : 12),
                        style: style
                    });
                }
            }
        }
    }

    populateWorldProps() {
        if (typeof propsManager === 'undefined') return;
        propsManager.clear();

        const cellSize = 96;

        // 1. Add Stunt Ramps
        for (let ramp of this.stuntRamps) {
            propsManager.addProp('ramp', ramp.x, ramp.y, { angle: ramp.angle });
        }

        // 2. Add Palm Trees on Beach & Coastal areas
        for (let sand of this.sandTiles) {
            if (Math.random() < 0.45) {
                propsManager.addProp('tree_palm', sand.x + 20 + Math.random() * (cellSize - 40), sand.y + 20 + Math.random() * (cellSize - 40));
            }
        }

        // 3. Add Oak Trees & Benches in Central Park
        for (let park of this.parkTiles) {
            if (Math.random() < 0.6) {
                propsManager.addProp('tree_oak', park.x + 20 + Math.random() * (cellSize - 40), park.y + 20 + Math.random() * (cellSize - 40));
            }
            if (Math.random() < 0.3) {
                propsManager.addProp('bench', park.x + 30 + Math.random() * (cellSize - 60), park.y + 30 + Math.random() * (cellSize - 60));
            }
        }

        // 4. Add Fire Hydrants, Street Lamps & Parking Meters along Roads & Sidewalks
        for (let cross of this.crossroads) {
            // Hydrant near intersection corner
            if (Math.random() < 0.6) {
                propsManager.addProp('hydrant', cross.x - 6, cross.y - 6);
            }
            // Street lamp
            if (Math.random() < 0.5) {
                propsManager.addProp('street_lamp', cross.x + cross.width + 6, cross.y - 6);
            }
        }

        for (let hroad of this.horizontalRoads) {
            if (Math.random() < 0.25) {
                propsManager.addProp('parking_meter', hroad.x + 30, hroad.y - 6);
            }
            if (Math.random() < 0.2) {
                propsManager.addProp('trash_can', hroad.x + 60, hroad.y + hroad.height + 6);
            }
        }

        for (let vroad of this.verticalRoads) {
            if (Math.random() < 0.2) {
                propsManager.addProp('street_lamp', vroad.x - 6, vroad.y + 40);
            }
        }

        // 5. Scatter Collectibles throughout the city
        // Cash piles
        for (let i = 0; i < 35; i++) {
            let r = this.horizontalRoads[Math.floor(Math.random() * this.horizontalRoads.length)];
            if (r) {
                propsManager.addPickup('cash', r.x + Math.random() * r.width, r.y + Math.random() * r.height, 100 + Math.floor(Math.random() * 200));
            }
        }

        // Medkits near Hospital and in Park
        for (let lm of this.landmarks) {
            if (lm.type === 'hospital') {
                propsManager.addPickup('health', lm.bayX - 30, lm.bayY + 30, 50);
                propsManager.addPickup('health', lm.bayX + 30, lm.bayY + 30, 50);
            } else if (lm.type === 'police') {
                propsManager.addPickup('armor', lm.bayX - 30, lm.bayY + 30, 50);
                propsManager.addPickup('star', lm.bayX + 30, lm.bayY + 30, 1);
            } else if (lm.type === 'ammu') {
                propsManager.addPickup('weapon', lm.bayX - 30, lm.bayY + 30, 1);
            }
        }

        // Police Bribe Stars in hidden alleys
        for (let i = 0; i < 8; i++) {
            let b = this.buildings[Math.floor(Math.random() * this.buildings.length)];
            if (b && b.style !== 'border') {
                propsManager.addPickup('star', b.x - 15, b.y - 15, 1);
            }
        }
    }

    getWorldSize() {
        return {
            width: this.width * 96,
            height: this.height * 96
        };
    }

    drawTerrain(ctx, camera, time, lightLevel) {
        const viewMargin = 120;
        const minX = camera.x - viewMargin;
        const maxX = camera.x + camera.width + viewMargin;
        const minY = camera.y - viewMargin;
        const maxY = camera.y + camera.height + viewMargin;

        // 1. Draw Sand / Beach
        ctx.fillStyle = '#EED8AE'; // Warm golden beach sand
        for (let s of this.sandTiles) {
            if (s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY) {
                ctx.fillRect(s.x, s.y, s.width, s.height);
                // Subtle sand texture specks
                ctx.fillStyle = '#DEC090';
                ctx.fillRect(s.x + 20, s.y + 15, 3, 2);
                ctx.fillRect(s.x + 65, s.y + 50, 4, 2);
                ctx.fillStyle = '#EED8AE';
            }
        }

        // 2. Draw Park Grass & Gardens
        ctx.fillStyle = '#388E3C'; // Vibrant park green
        for (let p of this.parkTiles) {
            if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
                ctx.fillRect(p.x, p.y, p.width, p.height);
                // Park stone footpath
                ctx.fillStyle = '#C8B88A';
                ctx.fillRect(p.x + p.width * 0.4, p.y, p.width * 0.2, p.height);
                ctx.fillStyle = '#388E3C';
            }
        }

        // 3. Draw Swimming Pools in Suburbs
        for (let pool of this.poolTiles) {
            if (pool.x >= minX && pool.x <= maxX && pool.y >= minY && pool.y <= maxY) {
                // Concrete patio
                ctx.fillStyle = '#D6D6C8';
                ctx.fillRect(pool.x + 10, pool.y + 10, pool.width - 20, pool.height - 20);
                // Pool water
                ctx.fillStyle = '#00B4D8';
                ctx.fillRect(pool.x + 18, pool.y + 18, pool.width - 36, pool.height - 36);
                // Pool shimmer
                let shimmer = Math.sin(time * 0.003 + pool.x) * 0.2 + 0.8;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.25 * shimmer})`;
                ctx.fillRect(pool.x + 24, pool.y + 24, pool.width - 48, 4);
            }
        }

        // 4. Draw Water (Ocean, Shoreline, and Central Pond) with Animated Waves
        for (let w of this.waterTiles) {
            if (w.x >= minX && w.x <= maxX && w.y >= minY && w.y <= maxY) {
                if (w.type === 'W_POND') {
                    // Park Pond (Deep teal)
                    ctx.fillStyle = '#007799';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                    let wave = Math.sin(time * 0.003 + w.x * 0.05) * 3;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(w.x + 15, w.y + 30 + wave, 40, 2);
                } else if (w.type === 'W_COAST') {
                    // Coastline wave foam
                    ctx.fillStyle = '#0096C7';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                    let waveOffset = Math.sin(time * 0.002 + w.y * 0.04) * 8;
                    // White frothy foam edge
                    ctx.fillStyle = 'rgba(240, 250, 255, 0.75)';
                    ctx.fillRect(w.x - 4 + waveOffset, w.y, 8, w.height);
                } else {
                    // Deep ocean
                    ctx.fillStyle = '#023E8A';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                    let wave1 = Math.sin(time * 0.002 + w.x * 0.03 + w.y * 0.02) * 5;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.fillRect(w.x + 20, w.y + 25 + wave1, 55, 3);
                    ctx.fillRect(w.x + 50, w.y + 65 - wave1, 35, 2.5);
                }
            }
        }
    }

    drawLandmarks(ctx, camera, time) {
        for (let lm of this.landmarks) {
            let flash = Math.sin(time * 0.006) * 0.3 + 0.7;

            // Interactive Zone Bay Marker on Ground
            ctx.save();
            ctx.translate(lm.bayX, lm.bayY);

            if (lm.type === 'pns') {
                // Yellow/Black bay
                ctx.fillStyle = `rgba(255, 215, 0, ${0.3 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("PAY 'N' SPRAY", 0, -42);
            } else if (lm.type === 'ammu') {
                // Red Gun shop bay
                ctx.fillStyle = `rgba(255, 50, 50, ${0.3 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FF3333';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#FF3333';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("AMMU-NATION", 0, -42);
            } else if (lm.type === 'diner') {
                // Orange Diner bay
                ctx.fillStyle = `rgba(255, 150, 0, ${0.3 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FF9900';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#FF9900';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("BURGER SHOT ($20)", 0, -42);
            }
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = World;
}
