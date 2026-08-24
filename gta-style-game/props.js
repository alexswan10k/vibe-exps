// World Props & Collectibles Module

class WorldProp {
    constructor(type, x, y, options = {}) {
        this.type = type; // 'hydrant', 'parking_meter', 'trash_can', 'tree_palm', 'tree_oak', 'street_lamp', 'ramp', 'bench', 'fence'
        this.x = x;
        this.y = y;
        this.angle = options.angle || 0;
        this.width = options.width || 20;
        this.height = options.height || 20;
        this.destroyed = false;
        this.health = options.health || 20;
        this.swayOffset = Math.random() * Math.PI * 2;
        this.color = options.color || '#888';
        this.customData = options.customData || {};
    }

    hit(damage, source = 'car', impactSpeed = 3) {
        if (this.destroyed) return;

        if (this.type === 'tree_palm' || this.type === 'tree_oak') {
            // Trees are very sturdy, only sway heavily
            this.swayOffset += 1.5;
            return;
        }

        if (this.type === 'ramp') {
            // Ramps cannot be destroyed
            return;
        }

        if (this.type === 'fountain' || this.type === 'plane') {
            // Monuments are indestructible
            return;
        }

        this.health -= damage;
        if (this.health <= 0) {
            this.destroyed = true;
            this.onDestruction(impactSpeed);
        }
    }

    onDestruction(impactSpeed = 3) {
        if (typeof particleSystem === 'undefined') return;

        if (this.type === 'hydrant') {
            particleSystem.addHydrantGush(this.x, this.y);
            particleSystem.addDebris(this.x, this.y, 8, '#CC2222');
            if (typeof audioSystem !== 'undefined') audioSystem.playHydrant();
        } else if (this.type === 'parking_meter') {
            particleSystem.addDebris(this.x, this.y, 10, '#888888');
            // Spill coins/cash pickups!
            if (typeof propsManager !== 'undefined') {
                for (let i = 0; i < 3; i++) {
                    let ox = this.x + (Math.random() - 0.5) * 35;
                    let oy = this.y + (Math.random() - 0.5) * 35;
                    propsManager.addPickup('cash', ox, oy, 50 + Math.floor(Math.random() * 50));
                }
            }
            if (typeof audioSystem !== 'undefined') audioSystem.playCrash(1.2);
        } else if (this.type === 'trash_can') {
            particleSystem.addDebris(this.x, this.y, 12, '#338833');
            particleSystem.addSmoke(this.x, this.y);
            if (typeof audioSystem !== 'undefined') audioSystem.playCrash(0.8);
        } else if (this.type === 'street_lamp') {
            particleSystem.addSparks(this.x, this.y, 0, 0, 15);
            particleSystem.addDebris(this.x, this.y, 8, '#555555');
            if (typeof audioSystem !== 'undefined') audioSystem.playCrash(1.0);
        } else if (this.type === 'bench' || this.type === 'fence') {
            particleSystem.addDebris(this.x, this.y, 10, '#8B5A2B');
        }
    }

    draw(ctx, time, lightLevel) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.destroyed) {
            // Draw ruined base
            if (this.type === 'hydrant') {
                ctx.fillStyle = '#991111';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.type === 'parking_meter' || this.type === 'street_lamp') {
                ctx.fillStyle = '#444';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.type === 'trash_can') {
                ctx.fillStyle = '#225522';
                ctx.fillRect(-6, -4, 12, 8);
            }
            ctx.restore();
            return;
        }

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(3, 3, this.width / 2 + 2, this.height / 2 + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.type === 'hydrant') {
            // Fire Hydrant
            ctx.fillStyle = '#DD2222';
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFDD33'; // brass cap
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // side nozzles
            ctx.fillStyle = '#881111';
            ctx.fillRect(-8, -2, 16, 4);
        } else if (this.type === 'parking_meter') {
            // Parking meter
            ctx.fillStyle = '#888888';
            ctx.fillRect(-3, -3, 6, 6);
            ctx.fillStyle = '#111111';
            ctx.fillRect(-2, -2, 4, 2); // glass screen
            ctx.fillStyle = '#22DD44'; // green meter light
            ctx.fillRect(-1, 0, 2, 1.5);
        } else if (this.type === 'trash_can') {
            // Green wheelie / metal trash can
            ctx.fillStyle = '#2E7D32';
            ctx.fillRect(-8, -8, 16, 16);
            ctx.strokeStyle = '#1B5E20';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-8, -8, 16, 16);
            ctx.fillStyle = '#1B5E20';
            ctx.fillRect(-9, -9, 18, 4); // lid
        } else if (this.type === 'tree_palm') {
            // Palm Tree with swaying fronds
            let sway = Math.sin(time * 0.002 + this.swayOffset) * 4;
            // Trunk base
            ctx.fillStyle = '#8D6E63';
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            // Palm Fronds
            ctx.fillStyle = '#2E7D32';
            for (let i = 0; i < 6; i++) {
                let frondAngle = (i / 6) * Math.PI * 2 + (sway * 0.02);
                ctx.save();
                ctx.rotate(frondAngle);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(15, -6 + sway, 28, 0);
                ctx.quadraticCurveTo(15, 6 + sway, 0, 0);
                ctx.fill();
                ctx.restore();
            }
            // Coconut cluster
            ctx.fillStyle = '#4E342E';
            ctx.beginPath();
            ctx.arc(2, 2, 3, 0, Math.PI * 2);
            ctx.arc(-2, 1, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'tree_oak') {
            // Oak / Park Tree
            let sway = Math.sin(time * 0.002 + this.swayOffset) * 3;
            // Trunk
            ctx.fillStyle = '#5D4037';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            // Outer foliage
            ctx.fillStyle = '#1B5E20';
            ctx.beginPath();
            ctx.arc(sway * 0.5, sway * 0.5, 24, 0, Math.PI * 2);
            ctx.fill();
            // Inner lighter foliage layers
            ctx.fillStyle = '#388E3C';
            ctx.beginPath();
            ctx.arc(-4 + sway * 0.8, -4, 16, 0, Math.PI * 2);
            ctx.arc(5 + sway * 0.6, 5, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#66BB6A';
            ctx.beginPath();
            ctx.arc(2 + sway, -3, 10, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'street_lamp') {
            // Street lamp pole
            ctx.fillStyle = '#37474F';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ECEFF1';
            ctx.fillRect(-2, -10, 4, 8); // lamp arm

            // Lamp glow at night
            if (lightLevel < 0.7) {
                let glowAlpha = (1.0 - lightLevel) * 0.7;
                let grad = ctx.createRadialGradient(0, -10, 2, 0, -10, 65);
                grad.addColorStop(0, `rgba(255, 240, 160, ${glowAlpha})`);
                grad.addColorStop(0.5, `rgba(255, 230, 120, ${glowAlpha * 0.35})`);
                grad.addColorStop(1, 'rgba(255, 230, 120, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, -10, 65, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.type === 'ramp') {
            // Insane Stunt Ramp (Yellow / Black hazard stripes)
            ctx.fillStyle = '#F57F17'; // Gold ramp base
            ctx.fillRect(-15, -12, 30, 24);
            ctx.strokeStyle = '#212121';
            ctx.lineWidth = 2;
            ctx.strokeRect(-15, -12, 30, 24);

            // Diagonal hazard stripes
            ctx.fillStyle = '#212121';
            for (let i = -12; i <= 12; i += 8) {
                ctx.beginPath();
                ctx.moveTo(i, -12);
                ctx.lineTo(i + 6, -12);
                ctx.lineTo(i + 2, 12);
                ctx.lineTo(i - 4, 12);
                ctx.closePath();
                ctx.fill();
            }

            // Ramp lip / arrow pointing forward
            ctx.fillStyle = '#FFEB3B';
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(8, -8);
            ctx.lineTo(8, 8);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'bench') {
            // Park bench
            ctx.fillStyle = '#6D4C41';
            ctx.fillRect(-14, -6, 28, 12);
            ctx.fillStyle = '#3E2723';
            ctx.fillRect(-14, -2, 28, 2); // slat line
            ctx.fillStyle = '#263238'; // cast iron legs
            ctx.fillRect(-15, -7, 3, 14);
            ctx.fillRect(12, -7, 3, 14);
        } else if (this.type === 'fountain') {
            // Stone basin
            ctx.fillStyle = '#8E8E8E';
            ctx.beginPath();
            ctx.arc(0, 0, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#616161';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Water
            ctx.fillStyle = '#4FC3F7';
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            // Expanding ripple ring
            let rip = (time * 0.0012) % 1;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - rip)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 4 + rip * 15, 0, Math.PI * 2);
            ctx.stroke();
            // Center pillar + spinning water jets
            ctx.fillStyle = '#757575';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 240, 255, 0.8)';
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 6; i++) {
                let a = (i / 6) * Math.PI * 2 + time * 0.001;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(Math.cos(a) * 9, Math.sin(a) * 9 - 6, Math.cos(a) * 14, Math.sin(a) * 14);
                ctx.stroke();
            }
        } else if (this.type === 'plane') {
            // Parked airliner - big!
            // Fuselage
            ctx.fillStyle = '#ECEFF1';
            ctx.beginPath();
            ctx.ellipse(0, 0, 62, 13, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#90A4AE';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Red nose cone
            ctx.fillStyle = '#D32F2F';
            ctx.beginPath();
            ctx.arc(62, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            // Cockpit glass
            ctx.fillStyle = '#263238';
            ctx.beginPath();
            ctx.ellipse(52, 0, 7, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Window strip
            ctx.fillStyle = '#546E7A';
            for (let i = -50; i < 40; i += 8) {
                ctx.fillRect(i, -3, 3, 3);
            }
            // Swept wings
            ctx.fillStyle = '#CFD8DC';
            ctx.beginPath();
            ctx.moveTo(8, -6); ctx.lineTo(-34, -52); ctx.lineTo(-46, -50); ctx.lineTo(-12, -4);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(8, 6); ctx.lineTo(-34, 52); ctx.lineTo(-46, 50); ctx.lineTo(-12, 4);
            ctx.closePath();
            ctx.fill();
            // Engines
            ctx.fillStyle = '#78909C';
            ctx.beginPath();
            ctx.ellipse(-18, -30, 9, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-18, 30, 9, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tail fin
            ctx.fillStyle = '#D32F2F';
            ctx.beginPath();
            ctx.moveTo(-56, -4); ctx.lineTo(-74, -26); ctx.lineTo(-64, -26); ctx.lineTo(-50, -6);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'umbrella') {
            // Beach umbrella with gentle sway
            ctx.rotate(Math.sin(time * 0.002 + this.swayOffset) * 0.08);
            // Pole
            ctx.fillStyle = '#6D4C41';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            // Canopy wedges
            for (let i = 0; i < 8; i++) {
                ctx.fillStyle = i % 2 === 0 ? (this.color || '#EF5350') : '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, 17, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
                ctx.closePath();
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 17, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'deckchair') {
            // Striped deck chair
            for (let i = -12; i < 12; i += 6) {
                ctx.fillStyle = (i / 6) % 2 === 0 ? '#29B6F6' : '#FFFFFF';
                ctx.fillRect(i, -6, 6, 12);
            }
            ctx.strokeStyle = '#8D6E63';
            ctx.lineWidth = 3;
            ctx.strokeRect(-12, -7, 24, 14);
        }

        ctx.restore();
    }
}

class WorldPickup {
    constructor(type, x, y, value = 100) {
        this.type = type; // 'cash', 'health', 'armor', 'star', 'weapon'
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = 14;
        this.active = true;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.rotation = 0;
    }

    update(player, game) {
        if (!this.active) return;
        this.rotation += 0.05;

        // Check player distance
        let px = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
        let py = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;
        let dist = Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2);

        if (dist < 32) {
            this.collect(player, game);
        }
    }

    collect(player, game) {
        this.active = false;
        if (typeof particleSystem !== 'undefined') {
            particleSystem.addCashSparkles(this.x, this.y);
        }

        if (this.type === 'cash') {
            if (typeof playerMoney !== 'undefined') playerMoney += this.value;
            if (typeof score !== 'undefined') score += this.value;
            if (typeof audioSystem !== 'undefined') audioSystem.playPickup('cash');
        } else if (this.type === 'health') {
            if (typeof playerHealth !== 'undefined') {
                playerHealth = Math.min(100, playerHealth + this.value);
            }
            if (typeof audioSystem !== 'undefined') audioSystem.playPickup('health');
        } else if (this.type === 'armor') {
            if (typeof playerArmor !== 'undefined') {
                playerArmor = Math.min(100, playerArmor + this.value);
            }
            if (typeof audioSystem !== 'undefined') audioSystem.playPickup('armor');
        } else if (this.type === 'star') {
            if (typeof wantedLevel !== 'undefined' && wantedLevel > 0) {
                wantedLevel = Math.max(0, wantedLevel - 1);
            }
            if (typeof audioSystem !== 'undefined') audioSystem.playPickup('star');
        } else if (this.type === 'weapon') {
            // Weapon crate: replenishes ammo
            if (typeof playerAmmo !== 'undefined') {
                playerAmmo[2] = Math.min(60, playerAmmo[2] + 15);
                playerAmmo[3] = Math.min(300, playerAmmo[3] + 80);
                playerAmmo[4] = Math.min(10, playerAmmo[4] + 3);
            }
            if (typeof audioSystem !== 'undefined') audioSystem.playPickup('weapon');
        }
    }

    draw(ctx, time) {
        if (!this.active) return;
        let bounce = Math.sin(time * 0.005 + this.floatOffset) * 4;
        let drawY = this.y + bounce;

        ctx.save();
        ctx.translate(this.x, drawY);

        // Shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, -bounce + 8, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3D spinning pickup
        let scaleX = Math.cos(this.rotation);

        if (this.type === 'cash') {
            // Green money bill
            ctx.scale(scaleX, 1);
            ctx.fillStyle = '#00C853';
            ctx.fillRect(-10, -6, 20, 12);
            ctx.strokeStyle = '#B9F6CA';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-10, -6, 20, 12);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
        } else if (this.type === 'health') {
            // Red Cross Heart / Medkit
            ctx.scale(scaleX, 1);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-8, -8, 16, 16);
            ctx.strokeStyle = '#D50000';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-8, -8, 16, 16);
            ctx.fillStyle = '#D50000';
            ctx.fillRect(-6, -2, 12, 4);
            ctx.fillRect(-2, -6, 4, 12);
        } else if (this.type === 'armor') {
            // Blue Shield / Vest
            ctx.scale(scaleX, 1);
            ctx.fillStyle = '#2979FF';
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(8, -4);
            ctx.lineTo(6, 6);
            ctx.lineTo(0, 9);
            ctx.lineTo(-6, 6);
            ctx.lineTo(-8, -4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#E0F7FA';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (this.type === 'star') {
            // Gold Police Bribe Star
            ctx.scale(scaleX, 1);
            ctx.fillStyle = '#FFD600';
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);
        } else if (this.type === 'weapon') {
            // Green Ammo Crate
            ctx.scale(scaleX, 1);
            ctx.fillStyle = '#33691E';
            ctx.fillRect(-8, -6, 16, 12);
            ctx.strokeStyle = '#8BC34A';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-8, -6, 16, 12);
            ctx.fillStyle = '#FFEB3B';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AMMO', 0, 0);
        }

        ctx.restore();
    }
}

class PropsManager {
    constructor() {
        this.props = [];
        this.pickups = [];
    }

    addProp(type, x, y, options = {}) {
        const prop = new WorldProp(type, x, y, options);
        this.props.push(prop);
        return prop;
    }

    addPickup(type, x, y, value = 100) {
        const pickup = new WorldPickup(type, x, y, value);
        this.pickups.push(pickup);
        return pickup;
    }

    clear() {
        this.props = [];
        this.pickups = [];
    }

    update(player, cars, game) {
        // Update pickups
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];
            p.update(player, game);
            if (!p.active) {
                this.pickups.splice(i, 1);
            }
        }

        // Check car collisions with props
        for (let prop of this.props) {
            if (prop.destroyed) continue;

            for (let car of cars) {
                if (car.exploded) continue;

                let cx = car.x + car.width / 2;
                let cy = car.y + car.height / 2;
                let dist = Math.sqrt((cx - prop.x) ** 2 + (cy - prop.y) ** 2);

                if (dist < (car.width / 2 + prop.width / 2)) {
                    let speed = Math.abs(car.speed) || 1;

                    if (prop.type === 'ramp') {
                        // Stunt Ramp Collision! Trigger Car Jump
                        if (speed > 2.5 && !car.isAirborne) {
                            car.launchStuntJump(prop.angle, speed);
                        }
                    } else if (speed > 1.2) {
                        prop.hit(speed * 10, 'car', speed);
                        if (prop.type === 'tree_palm' || prop.type === 'tree_oak') {
                            // Tree slows car down heavily
                            car.speed *= 0.5;
                            car.vx *= 0.5;
                            car.vy *= 0.5;
                        }
                    }
                }
            }
        }
    }

    draw(ctx, camera, time, lightLevel) {
        const viewMargin = 120;
        const minX = camera.x - viewMargin;
        const maxX = camera.x + camera.width + viewMargin;
        const minY = camera.y - viewMargin;
        const maxY = camera.y + camera.height + viewMargin;

        // Draw props within viewport
        for (let prop of this.props) {
            if (prop.x >= minX && prop.x <= maxX && prop.y >= minY && prop.y <= maxY) {
                prop.draw(ctx, time, lightLevel);
            }
        }

        // Draw pickups within viewport
        for (let pickup of this.pickups) {
            if (pickup.x >= minX && pickup.x <= maxX && pickup.y >= minY && pickup.y <= maxY) {
                pickup.draw(ctx, time);
            }
        }
    }
}

const propsManager = new PropsManager();
