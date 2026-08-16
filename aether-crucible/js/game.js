/**
 * Aether Crucible — Main Game Controller & Loop
 * Ties together Audio, Elements, Particles, Map, Entities, UI, and Input.
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.state = 'START_SCREEN'; // 'START_SCREEN', 'PLAYING', 'UPGRADE_PAUSE', 'GAME_OVER', 'VICTORY'

    // Systems
    this.particles = new ParticleSystem(1200);
    this.map = new DungeonMap();
    this.ui = new UIManager(this);

    // Gameplay State
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.collectibles = [];
    this.score = 0;
    this.shards = 0;
    this.currentSector = 0;
    this.currentRoomNumber = 1;
    this.selectedArchetype = 'pyromancer';

    // Room Progression
    this.enemiesRemainingToSpawn = 0;
    this.enemySpawnTimer = 0;
    this.roomCleared = false;
    this.reactionsTriggered = 0;

    // High Score tracking
    this.highScore = parseInt(localStorage.getItem('aether_crucible_highscore') || '0', 10);

    // Input state
    this.input = {
      keys: {},
      mouseX: 0,
      mouseY: 0,
      mouseDown: false,
      rightClickTrigger: false,
      flaskTrigger: false,
      dashTrigger: false,
      isTouchFiring: false,
      touchMove: { x: 0, y: 0 },
      touchAim: { x: 0, y: 0 }
    };

    // Viewport & Camera
    this.camera = { x: 0, y: 0 };
    this.lastTime = performance.now();

    this.initEventListeners();
    this.resizeCanvas();
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Prevent default context menu on right click (used for Secondary ability)
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.state === 'PLAYING') {
        this.input.rightClickTrigger = true;
      }
    });

    // Keyboard Input
    window.addEventListener('keydown', (e) => {
      if (window.soundSystem) window.soundSystem.resume();

      this.input.keys[e.code] = true;
      if (e.key) {
        this.input.keys[e.key] = true;
        this.input.keys[e.key.toLowerCase()] = true;
      }

      if (this.state === 'PLAYING') {
        // Element Switching (Keys 1-6)
        if (e.code === 'Digit1' || e.key === '1') this.player.switchElement('pyros');
        if (e.code === 'Digit2' || e.key === '2') this.player.switchElement('hydros');
        if (e.code === 'Digit3' || e.key === '3') this.player.switchElement('voltos');
        if (e.code === 'Digit4' || e.key === '4') this.player.switchElement('cryos');
        if (e.code === 'Digit5' || e.key === '5') this.player.switchElement('toxis');
        if (e.code === 'Digit6' || e.key === '6') this.player.switchElement('aether');

        // Skills & Flask
        if (e.code === 'KeyQ' || e.code === 'KeyE' || e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') {
          this.input.flaskTrigger = true;
        }
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === ' ') {
          this.input.dashTrigger = true;
        }
        if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
          this.toggleCodexModal();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.input.keys[e.code] = false;
      if (e.key) {
        this.input.keys[e.key] = false;
        this.input.keys[e.key.toLowerCase()] = false;
      }
    });

    // Mouse Input
    const handlePointerMove = (clientX, clientY) => {
      const offsetX = Math.max(0, (window.innerWidth - this.map.width) / 2);
      const offsetY = Math.max(0, (window.innerHeight - this.map.height) / 2);
      this.input.mouseX = clientX - offsetX;
      this.input.mouseY = clientY - offsetY;
    };

    window.addEventListener('mousemove', (e) => {
      handlePointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('mousedown', (e) => {
      if (window.soundSystem) window.soundSystem.resume();
      handlePointerMove(e.clientX, e.clientY);
      if (e.button === 0) {
        this.input.mouseDown = true;
        this.input.clickTrigger = true;
      } else if (e.button === 2) {
        this.input.rightClickTrigger = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.mouseDown = false;
      }
    });

    // Mouse wheel to cycle elements
    window.addEventListener('wheel', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      const currentIdx = ELEMENT_KEYS.indexOf(this.player.activeElement);
      const nextIdx = e.deltaY > 0
        ? (currentIdx + 1) % ELEMENT_KEYS.length
        : (currentIdx - 1 + ELEMENT_KEYS.length) % ELEMENT_KEYS.length;
      this.player.switchElement(ELEMENT_KEYS[nextIdx]);
    }, { passive: true });

    // UI Click Handlers
    this.initUIButtons();
    this.initTouchControls();
  }

  initUIButtons() {
    // Character select cards
    document.querySelectorAll('.character-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedArchetype = card.dataset.archetype;
        if (window.soundSystem) window.soundSystem.playUIClick();
      });
    });

    // Start Game Button
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (window.soundSystem) {
          window.soundSystem.init();
          window.soundSystem.playUIClick();
        }
        document.getElementById('start-modal').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.startNewRun(this.selectedArchetype);
      });
    }

    // Codex Button
    const codexBtn = document.getElementById('codex-btn');
    if (codexBtn) {
      codexBtn.addEventListener('click', () => this.toggleCodexModal());
    }
    const closeCodexBtn = document.getElementById('close-codex-btn');
    if (closeCodexBtn) {
      closeCodexBtn.addEventListener('click', () => this.toggleCodexModal());
    }

    // Retry Button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        document.getElementById('gameover-modal').classList.add('hidden');
        document.getElementById('start-modal').classList.remove('hidden');
        this.state = 'START_SCREEN';
      });
    }

    // Victory Continue Button
    const victoryBtn = document.getElementById('victory-btn');
    if (victoryBtn) {
      victoryBtn.addEventListener('click', () => {
        document.getElementById('victory-modal').classList.add('hidden');
        document.getElementById('start-modal').classList.remove('hidden');
        this.state = 'START_SCREEN';
      });
    }

    // Element slot clicks in HUD
    ELEMENT_KEYS.forEach(k => {
      const slot = document.getElementById(`elem-slot-${k}`);
      if (slot) {
        slot.addEventListener('click', () => {
          if (this.player) this.player.switchElement(k);
        });
      }
    });

    // Secondary & Flask slot clicks
    const secSlot = document.getElementById('secondary-slot');
    if (secSlot) {
      secSlot.addEventListener('click', () => {
        if (this.player) this.input.rightClickTrigger = true;
      });
    }
    const flaskSlot = document.getElementById('flask-slot');
    if (flaskSlot) {
      flaskSlot.addEventListener('click', () => {
        if (this.player) this.input.flaskTrigger = true;
      });
    }
  }

  initTouchControls() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch) {
      document.body.classList.add('touch-enabled');
    }

    const moveZone = document.getElementById('stick-move-zone');
    const moveKnob = document.getElementById('stick-move-knob');
    const aimZone = document.getElementById('stick-aim-zone');
    const aimKnob = document.getElementById('stick-aim-knob');

    let moveTouchId = null;
    let aimTouchId = null;

    if (moveZone) {
      moveZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        moveTouchId = touch.identifier;
        this.handleStickTouch(touch, moveZone, moveKnob, this.input.touchMove);
      }, { passive: false });

      moveZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === moveTouchId) {
            this.handleStickTouch(e.changedTouches[i], moveZone, moveKnob, this.input.touchMove);
          }
        }
      }, { passive: false });

      const endMove = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === moveTouchId) {
            moveTouchId = null;
            this.input.touchMove.x = 0;
            this.input.touchMove.y = 0;
            if (moveKnob) moveKnob.style.transform = 'translate(0, 0)';
          }
        }
      };
      moveZone.addEventListener('touchend', endMove);
      moveZone.addEventListener('touchcancel', endMove);
    }

    if (aimZone) {
      aimZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        aimTouchId = touch.identifier;
        this.input.isTouchFiring = true;
        this.handleStickTouch(touch, aimZone, aimKnob, this.input.touchAim);
      }, { passive: false });

      aimZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === aimTouchId) {
            this.handleStickTouch(e.changedTouches[i], aimZone, aimKnob, this.input.touchAim);
          }
        }
      }, { passive: false });

      const endAim = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === aimTouchId) {
            aimTouchId = null;
            this.input.isTouchFiring = false;
            this.input.touchAim.x = 0;
            this.input.touchAim.y = 0;
            if (aimKnob) aimKnob.style.transform = 'translate(0, 0)';
          }
        }
      };
      aimZone.addEventListener('touchend', endAim);
      aimZone.addEventListener('touchcancel', endAim);
    }

    // Touch Action buttons
    const btnDash = document.getElementById('touch-btn-dash');
    if (btnDash) {
      btnDash.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.input.dashTrigger = true;
      }, { passive: false });
    }

    const btnSec = document.getElementById('touch-btn-sec');
    if (btnSec) {
      btnSec.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.input.rightClickTrigger = true;
      }, { passive: false });
    }

    const btnFlask = document.getElementById('touch-btn-flask');
    if (btnFlask) {
      btnFlask.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.input.flaskTrigger = true;
      }, { passive: false });
    }
  }

  handleStickTouch(touch, zoneEl, knobEl, vector) {
    const rect = zoneEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2 - 10;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * (clampedDist / maxRadius);
    const ny = Math.sin(angle) * (clampedDist / maxRadius);

    vector.x = nx;
    vector.y = ny;

    if (knobEl) {
      knobEl.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
    }
  }

  toggleCodexModal() {
    const modal = document.getElementById('codex-modal');
    if (!modal) return;
    if (modal.classList.contains('hidden')) {
      modal.classList.remove('hidden');
      if (this.state === 'PLAYING') this.state = 'CODEX_PAUSE';
    } else {
      modal.classList.add('hidden');
      if (this.state === 'CODEX_PAUSE') this.state = 'PLAYING';
    }
  }

  startNewRun(archetypeId) {
    this.currentSector = 0;
    this.currentRoomNumber = 1;
    this.score = 0;
    this.shards = 0;
    this.reactionsTriggered = 0;
    this.state = 'PLAYING';

    this.particles.clear();
    this.enemies = [];
    this.projectiles = [];
    this.collectibles = [];

    // Create Player
    this.player = new Player(this.map.width / 2, this.map.height / 2, archetypeId);

    // Setup first room
    this.loadRoom('combat');

    if (window.soundSystem) {
      window.soundSystem.setSector(0);
      window.soundSystem.setTension(0.2);
    }
  }

  loadRoom(roomType) {
    this.particles.clear();
    this.enemies = [];
    this.projectiles = [];
    this.collectibles = [];
    this.roomCleared = (roomType !== 'combat' && roomType !== 'boss');

    // Generate Map
    this.map.generateRoom(this.currentSector, roomType, this.currentRoomNumber);

    // Reset player position to center
    this.player.x = this.map.width / 2;
    this.player.y = this.map.height / 2;

    if (roomType === 'combat') {
      this.enemiesRemainingToSpawn = 5 + this.currentSector * 3 + this.currentRoomNumber * 2;
      this.enemySpawnTimer = 0.5;
      if (window.soundSystem) window.soundSystem.setTension(0.6);
    } else if (roomType === 'boss') {
      this.enemiesRemainingToSpawn = 0;
      const boss = new Boss(this.map.width / 2, this.map.height / 2 - 100, this.currentSector);
      this.enemies.push(boss);
      if (window.soundSystem) {
        window.soundSystem.setTension(1.0);
        window.soundSystem.playBossRoar();
      }
    } else {
      // Crucible / Elixir room
      if (window.soundSystem) window.soundSystem.setTension(0.1);
    }
  }

  triggerReaction(reaction, x, y, target) {
    this.reactionsTriggered++;
    this.score += 150;

    if (window.soundSystem) {
      window.soundSystem.playReaction(reaction.id);
    }

    // Floating reaction banner
    this.ui.spawnReactionBanner(x, y, reaction.name, reaction.color);
    this.particles.triggerScreenShake(7);

    // Reaction Effects
    switch (reaction.id) {
      case 'STEAM_BURST':
        this.particles.spawnShockwave(x, y, 140, '#e2e8f0', 380, 5);
        this.particles.spawnBurst(x, y, 30, '#cbd5e1', 160, 5, { isSmoke: true });
        this.particles.addGroundField(x, y, 80, 'water', 4.0);
        break;

      case 'HYDRO_ELECTRIC':
        this.particles.spawnShockwave(x, y, 180, '#38bdf8', 500, 6);
        // Chain lightning to all nearby wet enemies
        for (const enemy of this.enemies) {
          if (enemy !== target && enemy.alive && enemy.hasStatus('wet')) {
            enemy.takeDamage(40, 'voltos', this);
            enemy.applyStatus('electrified', 2.0);
            enemy.stunTimer = 1.5;
            this.particles.spawnElectricArc(enemy.x, enemy.y, 35);
          }
        }
        break;

      case 'GLACIAL_SHATTER':
        this.particles.spawnShockwave(x, y, 120, '#cffafe', 450, 6);
        // Radial 8 ice shards
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 / 8) * i;
          const proj = new Projectile(x, y, Math.cos(ang) * 450, Math.sin(ang) * 450, 'cryos', 'player', 30, 5, 0.7, { pierces: true });
          this.projectiles.push(proj);
        }
        break;

      case 'BIO_DETONATION':
        this.particles.spawnShockwave(x, y, 220, '#fbbf24', 550, 8);
        this.particles.spawnBurst(x, y, 40, '#f59e0b', 220, 6);
        this.particles.addGroundField(x, y, 90, 'fire', 6.0);
        // AoE damage
        for (const enemy of this.enemies) {
          if (enemy.alive && Math.hypot(enemy.x - x, enemy.y - y) < 140) {
            enemy.takeDamage(60, 'pyros', this);
            enemy.applyStatus('burning', 4.0);
          }
        }
        break;

      case 'CRYO_THERMAL':
        this.particles.spawnShockwave(x, y, 150, '#fda4af', 400, 5);
        if (target) {
          target.applyStatus('corroded', 6.0);
          target.takeDamage(45, 'cryos', this);
        }
        break;

      default:
        this.particles.spawnShockwave(x, y, 160, reaction.color, 420, 5);
        break;
    }
  }

  spawnEnemy() {
    const biome = SECTOR_BIOMES[this.currentSector];
    const elements = ['pyros', 'hydros', 'voltos', 'cryos', 'toxis', 'aether'];
    const elem = elements[Math.floor(Math.random() * elements.length)];

    // Spawn at random edge of room away from player
    let sx = 60 + Math.random() * (this.map.width - 120);
    let sy = 60 + Math.random() * (this.map.height - 120);

    const isRanged = Math.random() < 0.35;
    const hp = 45 + this.currentSector * 20;
    const speed = 120 + Math.random() * 50;

    let enemy;
    if (isRanged) {
      enemy = new RangedEnemy(sx, sy, 14, hp * 0.8, speed * 0.85, elem, 'Aether Sentry');
    } else {
      enemy = new Enemy(sx, sy, 15, hp, speed, elem, 'Crucible Stalker');
    }

    this.enemies.push(enemy);
    this.particles.spawnBurst(sx, sy, 12, '#a855f7', 120);
  }

  onBossDefeated() {
    this.score += 2500;
    this.map.unlockDoors();

    if (this.currentSector >= 3) {
      // Final Boss Defeated — VICTORY!
      setTimeout(() => this.onVictory(), 2000);
    } else {
      // Sector Cleared!
      if (window.soundSystem) window.soundSystem.playRoomClear();
    }
  }

  onGameOver() {
    this.state = 'GAME_OVER';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('aether_crucible_highscore', this.highScore.toString());
    }

    const modal = document.getElementById('gameover-modal');
    const finalScore = document.getElementById('final-score');
    const finalCombos = document.getElementById('final-combos');
    const highScoreEl = document.getElementById('high-score-val');

    if (finalScore) finalScore.textContent = this.score;
    if (finalCombos) finalCombos.textContent = this.reactionsTriggered;
    if (highScoreEl) highScoreEl.textContent = this.highScore;

    if (modal) modal.classList.remove('hidden');
  }

  onVictory() {
    this.state = 'VICTORY';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('aether_crucible_highscore', this.highScore.toString());
    }

    const modal = document.getElementById('victory-modal');
    const victScore = document.getElementById('victory-score');
    const victCombos = document.getElementById('victory-combos');

    if (victScore) victScore.textContent = this.score;
    if (victCombos) victCombos.textContent = this.reactionsTriggered;

    if (modal) modal.classList.remove('hidden');
  }

  advanceToNextRoom(doorDir) {
    this.currentRoomNumber++;

    if (this.currentRoomNumber % 5 === 0) {
      // Boss Room
      this.loadRoom('boss');
    } else if (this.currentRoomNumber % 3 === 0) {
      // Alchemical Crucible Upgrade Room
      this.loadRoom('crucible');
    } else {
      // Standard Combat Room
      this.loadRoom('combat');
    }

    if (this.currentRoomNumber > 5) {
      this.currentSector = Math.min(3, this.currentSector + 1);
      this.currentRoomNumber = 1;
      if (window.soundSystem) window.soundSystem.setSector(this.currentSector);
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Enemy Spawning in Combat Rooms
    if (this.map.roomType === 'combat' && this.enemiesRemainingToSpawn > 0) {
      this.enemySpawnTimer -= dt;
      if (this.enemySpawnTimer <= 0) {
        this.enemySpawnTimer = 1.4;
        this.enemiesRemainingToSpawn--;
        this.spawnEnemy();
      }
    }

    // Room Clear Check
    if (!this.roomCleared && this.map.roomType === 'combat' && this.enemiesRemainingToSpawn === 0 && this.enemies.length === 0) {
      this.roomCleared = true;
      this.map.unlockDoors();
      if (window.soundSystem) {
        window.soundSystem.playRoomClear();
        window.soundSystem.setTension(0.15);
      }
    }

    // Update Player
    if (this.player) {
      this.player.update(dt, this, this.input);

      // Check door passage
      const doorExit = this.map.checkDoorExit(this.player);
      if (doorExit) {
        this.advanceToNextRoom(doorExit);
        return;
      }

      // Check shrine interactions in crucible rooms
      for (const shrine of this.map.shrines) {
        if (!shrine.used && Math.hypot(this.player.x - shrine.x, this.player.y - shrine.y) < shrine.radius + this.player.radius) {
          shrine.used = true;
          this.state = 'UPGRADE_PAUSE';
          this.ui.showUpgradeModal(() => {
            this.state = 'PLAYING';
          });
        }
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);
      if (!e.alive) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this);
      if (!p.active) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.update(dt, this);
      if (!c.active) {
        this.collectibles.splice(i, 1);
      }
    }

    // Update Particle & Ground Field systems
    this.particles.update(dt, this);
    this.ui.update(dt);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply Camera Shake & Viewport centering
    this.ctx.save();

    const shakeX = (Math.random() - 0.5) * this.particles.screenShakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.particles.screenShakeIntensity;

    // Center map on canvas
    const offsetX = Math.max(0, (window.innerWidth - this.map.width) / 2) + shakeX;
    const offsetY = Math.max(0, (window.innerHeight - this.map.height) / 2) + shakeY;
    this.ctx.translate(offsetX, offsetY);

    // 1. Render Map & Floors
    this.map.render(this.ctx);

    // 2. Render Ground Fields (puddles, fire, acid, ice)
    this.particles.renderGround(this.ctx);

    // 3. Render Collectibles
    for (const c of this.collectibles) {
      c.render(this.ctx);
    }

    // 4. Render Enemies
    for (const e of this.enemies) {
      e.render(this.ctx);
    }

    // 5. Render Player
    if (this.player) {
      this.player.render(this.ctx);
    }

    // 6. Render Projectiles
    for (const p of this.projectiles) {
      p.render(this.ctx);
    }

    // 7. Render Particles & Shockwaves
    this.particles.renderParticles(this.ctx);

    // 8. Render Floating Canvas UI (Damage numbers, reaction banners)
    this.ui.renderCanvasUI(this.ctx);

    this.ctx.restore();
  }

  loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }
}

// Instantiate and start game
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
  window.game.start();
});
