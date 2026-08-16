/**
 * Aether Crucible — UI & HUD Controller
 * Manages canvas floating text, DOM HUD updates, modals, codex, and touch controls.
 */

class UIManager {
  constructor(game) {
    this.game = game;
    this.damageNumbers = [];
    this.reactionBanners = [];
    this.tooltipEl = document.getElementById('tooltip');

    this.initDOM();
  }

  initDOM() {
    // Populate Codex Table in Codex Modal
    const codexContainer = document.getElementById('codex-grid');
    if (codexContainer) {
      codexContainer.innerHTML = '';
      for (const key in REACTIONS) {
        const r = REACTIONS[key];
        const elem1 = ELEMENTS[r.elements[0]];
        const elem2 = ELEMENTS[r.elements[1]];

        const item = document.createElement('div');
        item.className = 'codex-item';
        item.innerHTML = `
          <div class="codex-combo" style="color: ${r.color};">
            <span>${elem1.icon} ${elem1.name}</span>
            <span>+</span>
            <span>${elem2.icon} ${elem2.name}</span>
            <span>➔</span>
            <span>${r.name}</span>
          </div>
          <div class="codex-effect">${r.description}</div>
        `;
        codexContainer.appendChild(item);
      }
    }
  }

  spawnDamageNumber(x, y, amount, element = 'pyros') {
    const elemData = ELEMENTS[element] || ELEMENTS.pyros;
    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y,
      text: amount.toString(),
      color: elemData.color || '#fff',
      alpha: 1.0,
      life: 0.85,
      maxLife: 0.85,
      vy: -55
    });
  }

  spawnReactionBanner(x, y, reactionName, color = '#fbbf24') {
    this.reactionBanners.push({
      x: x,
      y: y - 25,
      text: reactionName,
      color: color,
      alpha: 1.0,
      life: 1.2,
      maxLife: 1.2,
      vy: -35,
      scale: 1.2
    });
  }

  update(dt) {
    // Update floating damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.life -= dt;
      d.y += d.vy * dt;
      d.alpha = Math.max(0, d.life / d.maxLife);
      if (d.life <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }

    // Update reaction banners
    for (let i = this.reactionBanners.length - 1; i >= 0; i--) {
      const b = this.reactionBanners[i];
      b.life -= dt;
      b.y += b.vy * dt;
      b.alpha = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        this.reactionBanners.splice(i, 1);
      }
    }

    this.updateHUD();
    this.renderMinimap();
  }

  updateHUD() {
    const player = this.game.player;
    if (!player) return;

    // HP & Shield
    const hpFill = document.getElementById('hp-fill');
    const shieldOverlay = document.getElementById('shield-overlay');
    const hpVal = document.getElementById('hp-val');
    if (hpFill && hpVal) {
      const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
      hpFill.style.width = `${hpPct}%`;
      hpVal.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    }
    if (shieldOverlay) {
      const shieldPct = player.maxShield > 0 ? (player.shield / player.maxShield) * 100 : 0;
      shieldOverlay.style.width = `${shieldPct}%`;
    }

    // Mana
    const manaFill = document.getElementById('mana-fill');
    const manaVal = document.getElementById('mana-val');
    if (manaFill && manaVal) {
      const manaPct = Math.max(0, Math.min(100, (player.mana / player.maxMana) * 100));
      manaFill.style.width = `${manaPct}%`;
      manaVal.textContent = `${Math.ceil(player.mana)} / ${player.maxMana}`;
    }

    // Dash Pips
    const pipsContainer = document.getElementById('dash-pips');
    if (pipsContainer) {
      pipsContainer.innerHTML = '';
      for (let i = 0; i < player.maxDashes; i++) {
        const pip = document.createElement('div');
        pip.className = `dash-pip ${i < player.dashes ? 'ready' : ''}`;
        pipsContainer.appendChild(pip);
      }
    }

    // Active Element Selection
    ELEMENT_KEYS.forEach(k => {
      const slot = document.getElementById(`elem-slot-${k}`);
      if (slot) {
        if (player.activeElement === k) {
          slot.classList.add('active');
        } else {
          slot.classList.remove('active');
        }
      }
    });

    // Secondary Skill Cooldown Overlay
    const secSlot = document.getElementById('secondary-slot');
    const secCdOverlay = document.getElementById('secondary-cd');
    if (secSlot && secCdOverlay) {
      const cd = player.secondaryCooldowns[player.activeElement] || 0;
      if (cd > 0) {
        secSlot.classList.add('cooling');
        secCdOverlay.textContent = cd.toFixed(1);
      } else {
        secSlot.classList.remove('cooling');
        secCdOverlay.textContent = '';
      }
    }

    // Flask Cooldown Overlay
    const flaskSlot = document.getElementById('flask-slot');
    const flaskCdOverlay = document.getElementById('flask-cd');
    if (flaskSlot && flaskCdOverlay) {
      const cd = player.flaskCooldowns[player.activeElement] || 0;
      if (cd > 0) {
        flaskSlot.classList.add('cooling');
        flaskCdOverlay.textContent = cd.toFixed(1);
      } else {
        flaskSlot.classList.remove('cooling');
        flaskCdOverlay.textContent = '';
      }
    }

    // Sector & Room Info
    const sectorTitle = document.getElementById('sector-title');
    const roomCounter = document.getElementById('room-counter');
    const shardCount = document.getElementById('shard-count');
    if (sectorTitle) {
      sectorTitle.textContent = SECTOR_BIOMES[this.game.currentSector]?.name || 'The Crucible';
    }
    if (roomCounter && this.game.currentFloor) {
      const visitedCount = Array.from(this.game.currentFloor.rooms.values()).filter(r => r.visited).length;
      const totalCount = this.game.currentFloor.rooms.size;
      roomCounter.textContent = `Sector ${this.game.currentSector + 1} (${visitedCount}/${totalCount} Rooms)`;
    }
    if (shardCount) {
      shardCount.textContent = this.game.shards;
    }

    // Boss Bar
    const bossBar = document.getElementById('boss-bar-container');
    const bossFill = document.getElementById('boss-hp-fill');
    const bossName = document.getElementById('boss-name');
    const currentBoss = this.game.enemies.find(e => e.isBoss && e.alive);
    if (bossBar && bossFill && bossName) {
      if (currentBoss) {
        bossBar.classList.remove('hidden');
        bossName.textContent = currentBoss.name;
        const bPct = Math.max(0, Math.min(100, (currentBoss.hp / currentBoss.maxHp) * 100));
        bossFill.style.width = `${bPct}%`;
      } else {
        bossBar.classList.add('hidden');
      }
    }

    // Artifacts Rack
    this.updateArtifactsRack(player);
  }

  updateArtifactsRack(player) {
    const rack = document.getElementById('artifacts-rack');
    if (!rack) return;

    // Check if count changed
    if (rack.childElementCount !== player.artifacts.length) {
      rack.innerHTML = '';
      player.artifacts.forEach(art => {
        const pill = document.createElement('div');
        pill.className = 'artifact-pill';
        pill.textContent = art.icon;
        pill.title = `${art.name} (${art.rarity.toUpperCase()}): ${art.description}`;
        pill.addEventListener('mouseenter', (e) => {
          this.showTooltip(e.clientX, e.clientY, `<strong>${art.name}</strong><br><span style="color:#94a3b8">${art.description}</span>`);
        });
        pill.addEventListener('mouseleave', () => this.hideTooltip());
        rack.appendChild(pill);
      });
    }
  }

  showTooltip(x, y, html) {
    if (!this.tooltipEl) return;
    this.tooltipEl.innerHTML = html;
    this.tooltipEl.style.left = `${Math.min(window.innerWidth - 240, x + 15)}px`;
    this.tooltipEl.style.top = `${Math.max(10, y - 40)}px`;
    this.tooltipEl.style.opacity = '1';
  }

  hideTooltip() {
    if (!this.tooltipEl) return;
    this.tooltipEl.style.opacity = '0';
  }

  showUpgradeModal(onSelectCallback) {
    const modal = document.getElementById('upgrade-modal');
    const container = document.getElementById('upgrade-cards-container');
    if (!modal || !container) return;

    container.innerHTML = '';
    const choices = ArtifactManager.getRandomArtifactPool(3, this.game.player.artifacts.map(a => a.id));

    choices.forEach(art => {
      const card = document.createElement('div');
      card.className = `upgrade-card ${art.rarity}`;
      card.innerHTML = `
        <div class="upgrade-icon">${art.icon}</div>
        <div class="upgrade-name">${art.name}</div>
        <div class="upgrade-rarity">${art.rarity}</div>
        <div class="upgrade-desc">${art.description}</div>
      `;
      card.addEventListener('click', () => {
        modal.classList.add('hidden');
        this.game.player.addArtifact(art.id);
        if (window.soundSystem) window.soundSystem.playPickup();
        if (onSelectCallback) onSelectCallback();
      });
      container.appendChild(card);
    });

    modal.classList.remove('hidden');
  }

  renderMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const floor = this.game.currentFloor;
    const currentRoom = this.game.currentRoom;
    if (!floor || !currentRoom) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark Map Background
    ctx.fillStyle = 'rgba(7, 10, 18, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = 20;
    const cellH = 14;
    const gap = 5;
    const marginX = 8;
    const marginY = 5;

    // 1. Draw Door Connector Corridors between adjacent rooms
    floor.rooms.forEach(room => {
      if (!room.visited) return;
      const rx = marginX + room.gridX * (cellW + gap);
      const ry = marginY + room.gridY * (cellH + gap);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;

      if (room.doors.north) {
        ctx.beginPath();
        ctx.moveTo(rx + cellW / 2, ry);
        ctx.lineTo(rx + cellW / 2, ry - gap);
        ctx.stroke();
      }
      if (room.doors.south) {
        ctx.beginPath();
        ctx.moveTo(rx + cellW / 2, ry + cellH);
        ctx.lineTo(rx + cellW / 2, ry + cellH + gap);
        ctx.stroke();
      }
      if (room.doors.east) {
        ctx.beginPath();
        ctx.moveTo(rx + cellW, ry + cellH / 2);
        ctx.lineTo(rx + cellW + gap, ry + cellH / 2);
        ctx.stroke();
      }
      if (room.doors.west) {
        ctx.beginPath();
        ctx.moveTo(rx, ry + cellH / 2);
        ctx.lineTo(rx - gap, ry + cellH / 2);
        ctx.stroke();
      }
    });

    // 2. Draw Room Nodes
    for (let gy = 0; gy < floor.gridSize; gy++) {
      for (let gx = 0; gx < floor.gridSize; gx++) {
        const room = floor.getRoom(gx, gy);
        if (!room) continue;

        const rx = marginX + gx * (cellW + gap);
        const ry = marginY + gy * (cellH + gap);

        const isCurrent = (currentRoom.gridX === gx && currentRoom.gridY === gy);

        // Check if room is adjacent to any visited room
        const isDiscovered = room.visited || [
          floor.getRoom(gx, gy - 1),
          floor.getRoom(gx, gy + 1),
          floor.getRoom(gx + 1, gy),
          floor.getRoom(gx - 1, gy)
        ].some(n => n && n.visited);

        if (room.visited) {
          // Room Fill by Type
          let fillColor = '#1e293b';
          let icon = '';
          if (room.roomType === 'start') { fillColor = '#0f766e'; icon = '🏠'; }
          if (room.roomType === 'crucible') { fillColor = '#6d28d9'; icon = '⚗️'; }
          if (room.roomType === 'elixir') { fillColor = '#047857'; icon = '🧪'; }
          if (room.roomType === 'boss') { fillColor = '#b91c1c'; icon = '💀'; }
          if (room.roomType === 'combat') { icon = room.cleared ? '✓' : '⚔️'; }

          ctx.fillStyle = fillColor;
          ctx.fillRect(rx, ry, cellW, cellH);

          // Room Border
          ctx.strokeStyle = isCurrent ? '#38bdf8' : (room.cleared ? '#22c55e' : 'rgba(255, 255, 255, 0.2)');
          ctx.lineWidth = isCurrent ? 2 : 1;
          ctx.strokeRect(rx, ry, cellW, cellH);

          // Glowing pulse on current room
          if (isCurrent) {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#38bdf8';
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(rx, ry, cellW, cellH);
            ctx.restore();
          }

          // Room Icon
          if (icon) {
            ctx.fillStyle = '#fff';
            ctx.font = '9px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, rx + cellW / 2, ry + cellH / 2 + 1);
          }
        } else if (isDiscovered) {
          // Undiscovered adjacent room (Fog of War)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.fillRect(rx, ry, cellW, cellH);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(rx, ry, cellW, cellH);
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.font = '8px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', rx + cellW / 2, ry + cellH / 2);
        }
      }
    }

    this.updateSectorTracker();
  }

  updateSectorTracker() {
    const tracker = document.getElementById('minimap-sector-tracker');
    if (!tracker || !this.game.currentFloor) return;

    const currentRoom = this.game.currentRoom;
    let label = 'Combat';
    if (currentRoom.roomType === 'start') label = 'Entrance';
    if (currentRoom.roomType === 'crucible') label = 'Crucible Font';
    if (currentRoom.roomType === 'elixir') label = 'Elixir Shrine';
    if (currentRoom.roomType === 'boss') label = 'Boss Chamber';

    const status = currentRoom.cleared ? 'Cleared' : 'Hostile';
    tracker.innerHTML = `<span style="color: #38bdf8;">${label}</span> • <span style="color: ${currentRoom.cleared ? '#4ade80' : '#ef4444'};">${status}</span>`;
  }

  renderCanvasUI(ctx) {
    // Render floating damage numbers
    ctx.save();
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';

    for (const d of this.damageNumbers) {
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = d.color;
      ctx.fillText(d.text, d.x, d.y);
    }

    // Render Reaction Banners
    ctx.font = '900 18px Cinzel, serif';
    for (const b of this.reactionBanners) {
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = b.color;
      ctx.fillText(`⚡ ${b.text} ⚡`, b.x, b.y);
    }

    ctx.restore();
  }
}

window.UIManager = UIManager;
