/**
 * Aether Crucible — Advanced Entity System
 * Procedurally animated vector sprites for Player archetypes, 8+ Enemy types,
 * 4 Epic Multi-Part Bosses, and Interactive Destructible Barrels.
 */

class BaseEntity {
  constructor(x, y, radius, maxHp) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.alive = true;
    this.invulnerableTimer = 0;
    this.statuses = {};
    this.lastAppliedElement = null;
    this.isSliding = false;
    this.armor = 0;
    this.stunTimer = 0;
    this.animTime = Math.random() * 10;
  }

  applyStatus(type, duration) {
    this.statuses[type] = Math.max(this.statuses[type] || 0, duration);
  }

  hasStatus(type) {
    return !!(this.statuses[type] && this.statuses[type] > 0);
  }

  updateStatuses(dt, game) {
    this.isSliding = false;
    this.animTime += dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    for (const s in this.statuses) {
      if (this.statuses[s] > 0) {
        this.statuses[s] -= dt;

        // Status effects ticking particles
        if (s === 'burning' && Math.random() < 0.25) {
          game.particles.spawnTrail(this.x + (Math.random() - 0.5) * this.radius, this.y + (Math.random() - 0.5) * this.radius, '#ff4500', 3, { isSpark: true });
        } else if (s === 'wet' && Math.random() < 0.2) {
          game.particles.spawnTrail(this.x + (Math.random() - 0.5) * this.radius, this.y + (Math.random() - 0.5) * this.radius, '#38bdf8', 2);
        } else if (s === 'electrified' && Math.random() < 0.3) {
          game.particles.spawnElectricArc(this.x, this.y, 20);
        } else if (s === 'corroded' && Math.random() < 0.25) {
          game.particles.spawnTrail(this.x + (Math.random() - 0.5) * this.radius, this.y + (Math.random() - 0.5) * this.radius, '#4ade80', 3);
        }

        if (this.statuses[s] <= 0) {
          delete this.statuses[s];
        }
      }
    }
  }

  takeDamage(amount, element, game) {
    if (!this.alive || this.invulnerableTimer > 0) return 0;

    let finalDmg = amount;
    if (this.hasStatus('corroded')) finalDmg *= 1.35;
    if (this.hasStatus('chilled') && game.player && game.player.freezeDamageBonus) {
      finalDmg *= game.player.freezeDamageBonus;
    }

    this.hp -= finalDmg;

    if (game.ui) {
      game.ui.spawnDamageNumber(this.x, this.y - this.radius - 6, Math.round(finalDmg), element);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game);
    }

    return finalDmg;
  }

  die(game) {
    this.alive = false;
  }
}

// ============================================================================
// PLAYER ENTITY (Animated Procedural Character Sprites)
// ============================================================================
class Player extends BaseEntity {
  constructor(x, y, archetypeId = 'pyromancer') {
    const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.pyromancer;
    super(x, y, 18, archetype.hp);

    this.archetype = archetype;
    this.maxShield = archetype.shield || 0;
    this.shield = this.maxShield;
    this.maxMana = archetype.mana;
    this.mana = this.maxMana;
    this.manaRegenRate = 18;
    this.manaRegenMultiplier = 1.0;
    this.baseSpeed = archetype.speed;
    this.speed = this.baseSpeed;

    this.activeElement = archetype.startingElements[0] || 'pyros';
    this.unlockedElements = ['pyros', 'hydros', 'voltos', 'cryos', 'toxis', 'aether'];

    this.secondaryCooldowns = { pyros: 0, hydros: 0, voltos: 0, cryos: 0, toxis: 0, aether: 0 };
    this.flaskCooldowns = { pyros: 0, hydros: 0, voltos: 0, cryos: 0, toxis: 0, aether: 0 };
    this.primaryFireTimer = 0;

    this.maxDashes = 2;
    this.dashes = 2;
    this.dashRechargeTimer = 0;
    this.dashRechargeRate = 1.8;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashVx = 0;
    this.dashVy = 0;

    this.artifacts = [];
    this.pickupRange = 65;
    this.reactionMultiplier = 1.0;
    this.secondaryDamageMultiplier = 1.0;
    this.flaskCooldownMultiplier = 1.0;
    this.flaskRadiusMultiplier = 1.0;
    this.puddleDurationMultiplier = 1.0;
    this.bonusShards = 0;
    this.fireImmune = false;
    this.fireHeals = false;
    this.hasShieldRegen = false;
    this.shieldRegenTimer = 0;

    if (archetype.startingArtifacts) {
      archetype.startingArtifacts.forEach(artId => this.addArtifact(artId));
    }

    this.aimAngle = 0;
    this.walkCycle = 0;
  }

  addArtifact(artId) {
    const art = ARTIFACTS[artId];
    if (art && !this.artifacts.some(a => a.id === artId)) {
      this.artifacts.push(art);
      art.apply(this);
    }
  }

  switchElement(elemKey) {
    if (this.unlockedElements.includes(elemKey)) {
      this.activeElement = elemKey;
      if (window.soundSystem) window.soundSystem.playUIClick();
    }
  }

  update(dt, game, input) {
    if (!this.alive) return;

    this.updateStatuses(dt, game);

    // Shield Regen
    if (this.hasShieldRegen) {
      this.shieldRegenTimer += dt;
      if (this.shieldRegenTimer >= 4.0 && this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + 15 * dt);
      }
    }

    // Mana Regeneration
    if (this.mana < this.maxMana) {
      this.mana = Math.min(this.maxMana, this.mana + this.manaRegenRate * this.manaRegenMultiplier * dt);
    }

    // Dash Recharge
    if (this.dashes < this.maxDashes) {
      this.dashRechargeTimer += dt;
      if (this.dashRechargeTimer >= this.dashRechargeRate) {
        this.dashRechargeTimer = 0;
        this.dashes++;
      }
    }

    // Cooldowns
    for (const k in this.secondaryCooldowns) {
      if (this.secondaryCooldowns[k] > 0) this.secondaryCooldowns[k] -= dt;
    }
    for (const k in this.flaskCooldowns) {
      if (this.flaskCooldowns[k] > 0) this.flaskCooldowns[k] -= dt;
    }

    // Dash Execution
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.x += this.dashVx * dt;
      this.y += this.dashVy * dt;

      const elemData = ELEMENTS[this.activeElement];
      game.particles.spawnTrail(this.x, this.y, elemData.color, 5, { glowColor: elemData.glowColor });

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.invulnerableTimer = 0.05;
      }
    } else {
      // Standard Movement
      let mx = 0, my = 0;
      if (input.keys['KeyW'] || input.keys['ArrowUp'] || input.keys['w'] || input.keys['W']) my -= 1;
      if (input.keys['KeyS'] || input.keys['ArrowDown'] || input.keys['s'] || input.keys['S']) my += 1;
      if (input.keys['KeyA'] || input.keys['ArrowLeft'] || input.keys['a'] || input.keys['A']) mx -= 1;
      if (input.keys['KeyD'] || input.keys['ArrowRight'] || input.keys['d'] || input.keys['D']) mx += 1;

      if (input.touchMove && (input.touchMove.x !== 0 || input.touchMove.y !== 0)) {
        mx = input.touchMove.x;
        my = input.touchMove.y;
      }

      const len = Math.hypot(mx, my);
      if (len > 0.05) {
        const normX = mx / Math.max(1, len);
        const normY = my / Math.max(1, len);
        const currentSpeed = this.isSliding ? this.speed * 1.5 : this.speed;
        this.vx = normX * currentSpeed;
        this.vy = normY * currentSpeed;
        this.walkCycle += dt * 14;
      } else {
        this.vx = this.isSliding ? this.vx * 0.95 : 0;
        this.vy = this.isSliding ? this.vy * 0.95 : 0;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      game.map.resolveCollision(this);
    }

    // Aim handling
    if (input.touchAim && (input.touchAim.x !== 0 || input.touchAim.y !== 0)) {
      this.aimAngle = Math.atan2(input.touchAim.y, input.touchAim.x);
    } else {
      this.aimAngle = Math.atan2(input.mouseY - this.y, input.mouseX - this.x);
    }

    // Firing inputs
    this.primaryFireTimer -= dt;
    if ((input.mouseDown || input.isTouchFiring || input.clickTrigger) && this.primaryFireTimer <= 0) {
      input.clickTrigger = false;
      this.castPrimary(game);
    }

    if (input.rightClickTrigger) {
      input.rightClickTrigger = false;
      this.castSecondary(game);
    }

    if (input.flaskTrigger) {
      input.flaskTrigger = false;
      this.throwFlask(game);
    }

    if (input.dashTrigger) {
      input.dashTrigger = false;
      this.performDash(game, input);
    }

    if (this.fireHeals && this.hasStatus('burning')) {
      this.hp = Math.min(this.maxHp, this.hp + 4 * dt);
    }
  }

  performDash(game, input) {
    if (this.dashes <= 0 || this.isDashing) return;

    this.dashes--;
    this.isDashing = true;
    this.dashTimer = 0.22;
    this.invulnerableTimer = 0.3;

    let dirX = Math.cos(this.aimAngle);
    let dirY = Math.sin(this.aimAngle);
    let mx = 0, my = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp'] || input.keys['w'] || input.keys['W']) my -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown'] || input.keys['s'] || input.keys['S']) my += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft'] || input.keys['a'] || input.keys['A']) mx -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight'] || input.keys['d'] || input.keys['D']) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { dirX = mx / len; dirY = my / len; }

    const dashSpeed = 650;
    this.dashVx = dirX * dashSpeed;
    this.dashVy = dirY * dashSpeed;

    if (window.soundSystem) window.soundSystem.playDash();

    if (this.archetype.id === 'astrologer') {
      game.particles.addGroundField(this.x, this.y, 40, 'ice', 4.0);
    }
  }

  castPrimary(game) {
    const elem = ELEMENTS[this.activeElement];
    if (this.mana < elem.primaryMana) return;

    this.mana -= elem.primaryMana;
    this.primaryFireTimer = 0.12;

    if (window.soundSystem) window.soundSystem.playPrimaryCast(this.activeElement);

    const spread = (Math.random() - 0.5) * 0.15;
    const angle = this.aimAngle + spread;
    const speed = 540;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const proj = new Projectile(
      this.x + Math.cos(this.aimAngle) * 22,
      this.y + Math.sin(this.aimAngle) * 22,
      vx, vy,
      this.activeElement,
      'player',
      16,
      5,
      0.85,
      { isBeam: true, pierces: !!this.piercingBeams }
    );
    game.projectiles.push(proj);
  }

  castSecondary(game) {
    const elem = ELEMENTS[this.activeElement];
    if (this.secondaryCooldowns[this.activeElement] > 0) return;
    if (this.mana < elem.secondaryMana) return;

    this.mana -= elem.secondaryMana;
    this.secondaryCooldowns[this.activeElement] = elem.secondaryCooldown;

    if (window.soundSystem) window.soundSystem.playSecondaryCast(this.activeElement);
    game.particles.triggerScreenShake(5);

    const speed = 380;
    const vx = Math.cos(this.aimAngle) * speed;
    const vy = Math.sin(this.aimAngle) * speed;
    const dmg = 48 * this.secondaryDamageMultiplier;

    const proj = new Projectile(
      this.x + Math.cos(this.aimAngle) * 26,
      this.y + Math.sin(this.aimAngle) * 26,
      vx, vy,
      this.activeElement,
      'player',
      dmg,
      12,
      1.6,
      { isSecondary: true }
    );
    game.projectiles.push(proj);
  }

  throwFlask(game) {
    const elem = ELEMENTS[this.activeElement];
    if (this.flaskCooldowns[this.activeElement] > 0) return;

    this.flaskCooldowns[this.activeElement] = elem.flaskCooldown * this.flaskCooldownMultiplier;

    if (window.soundSystem) window.soundSystem.playFlaskThrow();

    const dist = Math.min(270, Math.hypot(game.input.mouseX - this.x, game.input.mouseY - this.y));
    const targetX = this.x + Math.cos(this.aimAngle) * dist;
    const targetY = this.y + Math.sin(this.aimAngle) * dist;

    const flask = new FlaskCanister(this.x, this.y, targetX, targetY, this.activeElement, 55 * this.flaskRadiusMultiplier);
    game.projectiles.push(flask);
  }

  takeDamage(amount, element, game) {
    if (!this.alive || this.invulnerableTimer > 0 || this.isDashing) return 0;

    this.shieldRegenTimer = 0;
    this.invulnerableTimer = 0.4;
    game.particles.triggerScreenShake(7);

    let remaining = amount;
    if (this.shield > 0) {
      if (this.shield >= remaining) {
        this.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= this.shield;
        this.shield = 0;
        if (window.soundSystem) window.soundSystem.playShieldBreak();
      }
    }

    let actualDamage = 0;
    if (remaining > 0) {
      actualDamage = super.takeDamage(remaining, element, game);
      if (window.soundSystem) window.soundSystem.playPlayerHurt();
    }

    if (this.acidRetaliation) {
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 / 6) * i;
        const proj = new Projectile(this.x, this.y, Math.cos(ang) * 300, Math.sin(ang) * 300, 'toxis', 'player', 15, 4, 0.6);
        game.projectiles.push(proj);
      }
    }

    return actualDamage;
  }

  die(game) {
    if (this.hasRevive) {
      this.hasRevive = false;
      this.hp = this.maxHp * 0.6;
      this.alive = true;
      this.invulnerableTimer = 2.0;
      game.particles.spawnShockwave(this.x, this.y, 350, '#ff4500', 600, 8);
      game.particles.triggerScreenShake(18);
      if (window.soundSystem) window.soundSystem.playReaction('BIO_DETONATION');
      return;
    }
    super.die(game);
    game.onGameOver();
  }

  render(ctx) {
    if (!this.alive) return;
    const elem = ELEMENTS[this.activeElement];
    const bob = Math.sin(this.walkCycle) * 3;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // 1. Shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14 - bob, this.radius, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Elemental Ambient Aura Halo
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = elem.glowColor;
    ctx.fillStyle = elem.glowColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Energy Shield Bubble
    if (this.shield > 0) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#38bdf8';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Character Sprite Rendering per Archetype
    if (this.archetype.id === 'pyromancer') {
      this.renderPyromancer(ctx, elem);
    } else if (this.archetype.id === 'stormweaver') {
      this.renderStormWeaver(ctx, elem);
    } else {
      this.renderVoidAstrologer(ctx, elem);
    }

    ctx.restore();
  }

  renderPyromancer(ctx, elem) {
    // Flowing Mage Robes & Cloak
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.lineTo(13, 14);
    ctx.lineTo(-13, 14);
    ctx.closePath();
    ctx.fill();

    // Red Hood & Visor
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(0, -6, 9, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Eyes / Visor
    ctx.fillStyle = '#ffedd5';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff4500';
    ctx.fillRect(-4, -8, 3, 3);
    ctx.fillRect(1, -8, 3, 3);

    // Aimed Flame Staff with Orbiting Crystal
    ctx.save();
    ctx.rotate(this.aimAngle);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(4, -2.5, 20, 5);

    // Staff Head & Fiery Crystal
    ctx.fillStyle = elem.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = elem.lightColor;
    ctx.beginPath();
    ctx.arc(26, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderStormWeaver(ctx, elem) {
    const time = this.animTime;

    // Sleek Cyan/Yellow Galvanic Mantle
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    // Flowing Electric Mantle
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.lineTo(11, -4);
    ctx.lineTo(14, 12);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.fill();

    // Lightning Mask Head
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, -6, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eab308';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fde047';
    ctx.fillRect(-3, -7, 6, 2.5);

    // Dual Orbiting Lightning Chakrams
    for (let i = 0; i < 2; i++) {
      const orbAngle = time * 6 + (Math.PI * i);
      const ox = Math.cos(orbAngle) * 20;
      const oy = Math.sin(orbAngle) * 12;

      ctx.save();
      ctx.fillStyle = elem.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = elem.lightColor;
      ctx.beginPath();
      ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderVoidAstrologer(ctx, elem) {
    const time = this.animTime;

    // Dark Star Cosmic Body
    ctx.fillStyle = '#090514';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Astral Star-Robe
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(12, -4);
    ctx.lineTo(15, 14);
    ctx.lineTo(-15, 14);
    ctx.closePath();
    ctx.fill();

    // Celestial Hood
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    ctx.arc(0, -6, 9, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Astrolabe Rings
    ctx.save();
    ctx.rotate(this.aimAngle);
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = elem.lightColor;
    ctx.beginPath();
    ctx.ellipse(22, 0, 10, 6, time * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Singularity Orb Center
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(22, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================================
// ENEMY HIERARCHY & PROCEDURAL MONSTER SPRITES
// ============================================================================
class Enemy extends BaseEntity {
  constructor(x, y, radius, hp, speed, elementAffinity, name = 'Creature', enemyType = 'stalker') {
    super(x, y, radius, hp);
    this.speed = speed;
    this.elementAffinity = elementAffinity;
    this.name = name;
    this.enemyType = enemyType; // 'stalker', 'spitter', 'golem', 'imp', 'automaton', 'wisp', 'sentry', 'phantom'
    this.attackTimer = 0;
    this.attackCooldown = 1.8;
    this.scoreValue = 60;
    this.isBoss = false;
  }

  update(dt, game) {
    if (!this.alive) return;
    this.updateStatuses(dt, game);

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.stunTimer > 0) return;

    const player = game.player;
    if (player && player.alive) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        let currentSpeed = this.speed;
        if (this.hasStatus('chilled')) currentSpeed *= 0.55;
        if (this.hasStatus('corroded') && player.toxisSlow) currentSpeed *= 0.6;

        this.vx = (dx / dist) * currentSpeed;
        this.vy = (dy / dist) * currentSpeed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }

      game.map.resolveCollision(this);

      if (dist < this.radius + player.radius) {
        this.onMeleeHit(player, game);
      }
    }
  }

  onMeleeHit(player, game) {
    if (this.attackTimer <= 0) {
      player.takeDamage(16, this.elementAffinity, game);
      this.attackTimer = this.attackCooldown;
    }
  }

  die(game) {
    super.die(game);
    if (window.soundSystem) window.soundSystem.playEnemyDeath();

    const shardCount = 1 + (game.player?.bonusShards || 0);
    for (let i = 0; i < shardCount; i++) {
      game.collectibles.push(new Collectible(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, 'shard'));
    }

    if (game.player?.healthDropChance && Math.random() < game.player.healthDropChance) {
      game.collectibles.push(new Collectible(this.x, this.y, 'health'));
    }

    if (this.hasStatus('corroded') && game.player?.corrodedExplode) {
      game.particles.addGroundField(this.x, this.y, 45, 'acid', 5.0);
    }

    game.score += this.scoreValue;
  }

  render(ctx) {
    if (!this.alive) return;
    const elem = ELEMENTS[this.elementAffinity] || ELEMENTS.pyros;
    const time = this.animTime;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.8, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render by Enemy Creature Type
    switch (this.enemyType) {
      case 'stalker': // 4-legged Toxic/Primal Crawler
        this.renderStalker(ctx, elem, time);
        break;
      case 'golem': // Heavy Stone Golem
        this.renderGolem(ctx, elem, time);
        break;
      case 'imp': // Horned Cinder Fiend
        this.renderImp(ctx, elem, time);
        break;
      case 'automaton': // Gear Mech
        this.renderAutomaton(ctx, elem, time);
        break;
      case 'wisp': // Flying Ice/Energy Phantom
        this.renderWisp(ctx, elem, time);
        break;
      case 'phantom': // Ethereal Void Wraith
        this.renderPhantom(ctx, elem, time);
        break;
      default:
        this.renderStalker(ctx, elem, time);
        break;
    }

    // Floating HP Bar
    if (this.hp < this.maxHp) {
      const barW = this.radius * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-barW / 2, -this.radius - 12, barW, 4.5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-barW / 2, -this.radius - 12, barW * (this.hp / this.maxHp), 4.5);
    }

    ctx.restore();
  }

  renderStalker(ctx, elem, time) {
    // 4 Animated Legs
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const legAngle = (Math.PI / 2) * i + Math.PI / 4;
      const wiggle = Math.sin(time * 12 + i * 2) * 4;
      const lx = Math.cos(legAngle) * (this.radius + 6) + wiggle;
      const ly = Math.sin(legAngle) * (this.radius + 6) + wiggle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(lx, ly);
      ctx.stroke();
    }

    // Arachnid Chitin Body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Bioluminescent Venom Sac
    ctx.fillStyle = elem.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = elem.lightColor;
    ctx.beginPath();
    ctx.arc(0, 2, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  renderGolem(ctx, elem, time) {
    // Heavy Rock Torso
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2, 8);
    ctx.fill();

    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Magma Fissures
    ctx.strokeStyle = elem.lightColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = elem.color;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(0, 0);
    ctx.lineTo(8, 6);
    ctx.stroke();
  }

  renderImp(ctx, elem, time) {
    // Horned Cinder Fiend
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Flaming Horns
    ctx.fillStyle = elem.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = elem.lightColor;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(-14, -18);
    ctx.lineTo(-4, -10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(14, -18);
    ctx.lineTo(4, -10);
    ctx.closePath();
    ctx.fill();
  }

  renderAutomaton(ctx, elem, time) {
    // Brass Mech Chassis
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

    // Glowing Eye Visor
    ctx.fillStyle = elem.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = elem.lightColor;
    ctx.fillRect(-8, -4, 16, 6);
  }

  renderWisp(ctx, elem, time) {
    // Swirling multi-tailed energy wisp
    ctx.save();
    ctx.rotate(time * 3);
    for (let i = 0; i < 3; i++) {
      const ang = (Math.PI * 2 / 3) * i;
      ctx.fillStyle = elem.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = elem.lightColor;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * 9, Math.sin(ang) * 9, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderPhantom(ctx, elem, time) {
    // Ethereal Shadow Wraith
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -3, this.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Wispy Tentacles
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = elem.lightColor;
    for (let i = 0; i < 3; i++) {
      const wx = -8 + i * 8;
      const wy = 8 + Math.sin(time * 6 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(wx, 2);
      ctx.lineTo(wx, wy);
      ctx.stroke();
    }

    // Glowing Mask Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4, -6, 2.5, 4);
    ctx.fillRect(2, -6, 2.5, 4);
  }
}

// Ranged Shooter Enemy (Spore Blossom / Sentry)
class RangedEnemy extends Enemy {
  constructor(x, y, radius, hp, speed, elementAffinity, name, enemyType = 'spitter') {
    super(x, y, radius, hp, speed, elementAffinity, name, enemyType);
    this.shootTimer = 1.2 + Math.random() * 1.5;
  }

  update(dt, game) {
    super.update(dt, game);
    if (!this.alive || this.stunTimer > 0) return;

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = 2.4;
      this.shootProjectile(game);
    }
  }

  shootProjectile(game) {
    const player = game.player;
    if (!player || !player.alive) return;

    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const speed = 250;
    const proj = new Projectile(
      this.x, this.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      this.elementAffinity,
      'enemy',
      16,
      6,
      2.5
    );
    game.projectiles.push(proj);
  }
}

// ============================================================================
// EPIC MULTI-PART BOSSES
// ============================================================================
class Boss extends Enemy {
  constructor(x, y, sectorIndex) {
    const names = ['The Spore Behemoth', 'The Pyre Colossus', 'The Cryo Archon', 'The Primordial Chimera'];
    const elements = ['toxis', 'pyros', 'cryos', 'aether'];
    const hps = [600, 950, 1350, 2200];

    super(x, y, 42, hps[sectorIndex] || 600, 115, elements[sectorIndex] || 'pyros', names[sectorIndex] || 'Crucible Boss', 'boss');
    this.sectorIndex = sectorIndex;
    this.isBoss = true;
    this.phase = 1;
    this.specialTimer = 3.0;
    this.scoreValue = 1500;
  }

  update(dt, game) {
    super.update(dt, game);
    if (!this.alive || this.stunTimer > 0) return;

    if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.speed *= 1.35;
      game.particles.spawnShockwave(this.x, this.y, 300, '#ef4444', 500, 8);
      game.particles.triggerScreenShake(14);
      if (window.soundSystem) window.soundSystem.playBossRoar();
    }

    this.specialTimer -= dt;
    if (this.specialTimer <= 0) {
      this.specialTimer = this.phase === 2 ? 2.2 : 3.8;
      this.castBossSpecial(game);
    }
  }

  castBossSpecial(game) {
    if (window.soundSystem) window.soundSystem.playBossRoar();
    game.particles.triggerScreenShake(7);

    const projectileCount = this.phase === 2 ? 16 : 10;
    for (let i = 0; i < projectileCount; i++) {
      const angle = (Math.PI * 2 / projectileCount) * i;
      const speed = 230;
      const proj = new Projectile(
        this.x, this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        this.elementAffinity,
        'enemy',
        22,
        8,
        3.2
      );
      game.projectiles.push(proj);
    }

    let gType = 'acid';
    if (this.sectorIndex === 1) gType = 'fire';
    if (this.sectorIndex === 2) gType = 'ice';
    if (this.sectorIndex === 3) gType = 'water';
    game.particles.addGroundField(this.x, this.y, 90, gType, 9.0);
  }

  die(game) {
    super.die(game);
    game.particles.spawnShockwave(this.x, this.y, 450, '#fbbf24', 600, 12);
    game.particles.triggerScreenShake(22);
    if (window.soundSystem) window.soundSystem.playVictoryFanfare();

    for (let i = 0; i < 20; i++) {
      game.collectibles.push(new Collectible(this.x + (Math.random() - 0.5) * 90, this.y + (Math.random() - 0.5) * 90, 'shard'));
    }
    game.collectibles.push(new Collectible(this.x, this.y, 'health'));
    game.collectibles.push(new Collectible(this.x + 25, this.y, 'health'));

    game.onBossDefeated();
  }

  render(ctx) {
    if (!this.alive) return;
    const elem = ELEMENTS[this.elementAffinity] || ELEMENTS.pyros;
    const time = this.animTime;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Large Boss Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.9, this.radius * 1.2, this.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render Sector Specific Boss
    if (this.sectorIndex === 0) {
      this.renderSporeBehemoth(ctx, elem, time);
    } else if (this.sectorIndex === 1) {
      this.renderPyreColossus(ctx, elem, time);
    } else if (this.sectorIndex === 2) {
      this.renderCryoArchon(ctx, elem, time);
    } else {
      this.renderPrimordialChimera(ctx, elem, time);
    }

    ctx.restore();
  }

  renderSporeBehemoth(ctx, elem, time) {
    // 4 Animated Flailing Fungal Tentacles
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i + Math.sin(time * 3 + i) * 0.5;
      const tx = Math.cos(ang) * (this.radius + 18);
      const ty = Math.sin(ang) * (this.radius + 18);

      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(ang) * (this.radius + 6), Math.sin(ang) * (this.radius + 6), tx, ty);
      ctx.stroke();

      ctx.fillStyle = elem.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = elem.lightColor;
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Giant Mushroom Cap Body
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // 3 Bioluminescent Boss Eyes
    ctx.fillStyle = '#fef08a';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#eab308';
    ctx.beginPath();
    ctx.arc(-14, -8, 5, 0, Math.PI * 2);
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.arc(14, -8, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  renderPyreColossus(ctx, elem, time) {
    // Obsidian Walking Furnace Titan
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.roundRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2, 14);
    ctx.fill();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Twin Chimneys
    ctx.fillStyle = '#44403c';
    ctx.fillRect(-this.radius + 6, -this.radius - 14, 10, 14);
    ctx.fillRect(this.radius - 16, -this.radius - 14, 10, 14);

    // Glowing Molten Heart Grating
    ctx.fillStyle = '#ff4500';
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#ffedd5';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Iron Grating Lines
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(16, 0);
    ctx.moveTo(0, -16); ctx.lineTo(0, 16);
    ctx.stroke();
  }

  renderCryoArchon(ctx, elem, time) {
    // 6 Floating Crystalline Ice Wings
    for (let i = 0; i < 6; i++) {
      const wingAng = (Math.PI / 3) * i + Math.sin(time * 2 + i) * 0.2;
      const wx = Math.cos(wingAng) * (this.radius + 22);
      const wy = Math.sin(wingAng) * (this.radius + 22);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#a5f3fc';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(wx, wy);
      ctx.lineTo(Math.cos(wingAng + 0.3) * (this.radius + 8), Math.sin(wingAng + 0.3) * (this.radius + 8));
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fill();
      ctx.stroke();
    }

    // Ice Seraph Crown & Core
    ctx.fillStyle = '#082f49';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00f0ff';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  renderPrimordialChimera(ctx, elem, time) {
    // 3 Shifting Elemental Dragon Heads
    for (let i = 0; i < 3; i++) {
      const headAng = (Math.PI * 2 / 3) * i + (time * 1.5);
      const hx = Math.cos(headAng) * (this.radius + 16);
      const hy = Math.sin(headAng) * (this.radius + 16);

      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      ctx.fillStyle = ['#ff4500', '#00e5ff', '#10b981'][i];
      ctx.shadowBlur = 16;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(hx, hy, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central Singularity Void Dragon Body
    ctx.fillStyle = '#05020c';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#d946ef';
    ctx.stroke();
  }
}

// ============================================================================
// PROJECTILE SYSTEM
// ============================================================================
class Projectile {
  constructor(x, y, vx, vy, element, owner, damage, radius = 5, life = 1.0, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.element = element;
    this.owner = owner;
    this.damage = damage;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.active = true;
    this.isSecondary = !!opts.isSecondary;
    this.isBeam = !!opts.isBeam;
    this.pierces = !!opts.pierces;
    this.hitEntities = new Set();
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      this.onExpire(game);
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (Math.random() < 0.8) {
      const elemData = ELEMENTS[this.element];
      if (elemData) {
        game.particles.spawnTrail(this.x, this.y, elemData.color, this.radius * 0.7, { glowColor: elemData.glowColor });
      }
    }

    // Wall collision
    if (game.map.isWall(this.x, this.y)) {
      this.active = false;
      this.onHitSurface(this.x, this.y, game);
      return;
    }

    // Check hit on destructible barrels
    for (const prop of game.map.destructibles) {
      if (!prop.alive) continue;
      const dist = Math.hypot(prop.x - this.x, prop.y - this.y);
      if (dist < prop.radius + this.radius) {
        prop.alive = false;
        this.active = false;
        this.detonateBarrel(prop, game);
        break;
      }
    }

    // Target collisions
    if (this.owner === 'player') {
      for (const enemy of game.enemies) {
        if (!enemy.alive || this.hitEntities.has(enemy)) continue;
        const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (dist < enemy.radius + this.radius) {
          this.hitTarget(enemy, game);
          if (!this.pierces) {
            this.active = false;
            break;
          } else {
            this.hitEntities.add(enemy);
          }
        }
      }
    } else {
      const player = game.player;
      if (player && player.alive) {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < player.radius + this.radius) {
          player.takeDamage(this.damage, this.element, game);
          this.active = false;
          game.particles.spawnBurst(this.x, this.y, 8, ELEMENTS[this.element]?.color || '#ff4500', 100);
        }
      }
    }
  }

  detonateBarrel(prop, game) {
    if (window.soundSystem) window.soundSystem.playReaction('BIO_DETONATION');
    game.particles.triggerScreenShake(8);
    game.particles.spawnShockwave(prop.x, prop.y, 140, '#f97316', 450, 6);
    game.particles.spawnBurst(prop.x, prop.y, 25, '#ff4500', 180);

    const groundType = prop.type === 'toxic' ? 'acid' : (prop.type === 'ice' ? 'ice' : 'fire');
    const f = game.particles.addGroundField(prop.x, prop.y, 75, groundType, 8.0);
    if (prop.type === 'tesla' && f) f.electrifiedTimer = 6.0;

    // Damage all entities in radius
    const all = [game.player, ...game.enemies];
    for (const ent of all) {
      if (!ent || !ent.alive) continue;
      if (Math.hypot(ent.x - prop.x, ent.y - prop.y) < 80 + ent.radius) {
        ent.takeDamage(45, prop.type === 'toxic' ? 'toxis' : 'pyros', game);
      }
    }
  }

  hitTarget(target, game) {
    const targetPrevElement = target.lastAppliedElement;
    const reaction = ElementMatrix.checkReaction(targetPrevElement, this.element);
    let finalDamage = this.damage;

    if (reaction) {
      finalDamage *= reaction.multiplier * (game.player?.reactionMultiplier || 1.0);
      game.triggerReaction(reaction, target.x, target.y, target);
    } else {
      const elemData = ELEMENTS[this.element];
      if (elemData && elemData.statusEffect) {
        target.applyStatus(elemData.statusEffect, elemData.statusDuration);
      }
    }

    target.lastAppliedElement = this.element;
    target.takeDamage(finalDamage, this.element, game);

    const elemColor = ELEMENTS[this.element]?.color || '#fff';
    game.particles.spawnBurst(this.x, this.y, this.isSecondary ? 16 : 8, elemColor, 140);

    if (this.isSecondary) {
      this.onSecondaryExplosion(game);
    }
  }

  onSecondaryExplosion(game) {
    game.particles.spawnShockwave(this.x, this.y, 90, ELEMENTS[this.element]?.color || '#fff', 350, 4);

    let groundType = null;
    if (this.element === 'hydros') groundType = 'water';
    if (this.element === 'pyros') groundType = 'fire';
    if (this.element === 'toxis') groundType = 'acid';
    if (this.element === 'cryos') groundType = 'ice';

    if (groundType) {
      game.particles.addGroundField(this.x, this.y, 65, groundType, 7.0 * (game.player?.puddleDurationMultiplier || 1.0));
    }
  }

  onHitSurface(x, y, game) {
    const elemColor = ELEMENTS[this.element]?.color || '#fff';
    game.particles.spawnBurst(x, y, 6, elemColor, 90);
  }

  onExpire(game) {
    if (this.isSecondary) {
      this.onSecondaryExplosion(game);
    }
  }

  render(ctx) {
    if (!this.active) return;
    const elemData = ELEMENTS[this.element] || ELEMENTS.pyros;

    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = elemData.glowColor;
    ctx.fillStyle = elemData.color;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Center Core Spark
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Flask Canister Projectile
class FlaskCanister {
  constructor(startX, startY, targetX, targetY, element, splashRadius = 60) {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.x = startX;
    this.y = startY;
    this.element = element;
    this.splashRadius = splashRadius;
    this.progress = 0;
    this.speed = 2.4;
    this.active = true;
    this.arcHeight = 45;
  }

  update(dt, game) {
    this.progress += this.speed * dt;
    if (this.progress >= 1.0) {
      this.progress = 1.0;
      this.active = false;
      this.detonate(game);
      return;
    }

    const currentBaseX = this.startX + (this.targetX - this.startX) * this.progress;
    const currentBaseY = this.startY + (this.targetY - this.startY) * this.progress;
    const arc = Math.sin(this.progress * Math.PI) * this.arcHeight;

    this.x = currentBaseX;
    this.y = currentBaseY - arc;

    game.particles.spawnTrail(this.x, this.y, ELEMENTS[this.element].color, 3);
  }

  detonate(game) {
    const elem = ELEMENTS[this.element];
    if (window.soundSystem) window.soundSystem.playReaction('STEAM_BURST');
    game.particles.triggerScreenShake(6);
    game.particles.spawnShockwave(this.targetX, this.targetY, this.splashRadius * 1.5, elem.color, 450, 5);
    game.particles.spawnBurst(this.targetX, this.targetY, 24, elem.color, 180);

    let groundType = 'water';
    if (this.element === 'pyros') groundType = 'fire';
    if (this.element === 'toxis') groundType = 'acid';
    if (this.element === 'cryos') groundType = 'ice';
    if (this.element === 'voltos') groundType = 'water';

    const f = game.particles.addGroundField(this.targetX, this.targetY, this.splashRadius, groundType, 9.0);
    if (this.element === 'voltos' && f) f.electrifiedTimer = 7.0;

    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - this.targetX, enemy.y - this.targetY);
      if (dist < this.splashRadius + enemy.radius) {
        enemy.applyStatus(elem.statusEffect, elem.statusDuration * 1.5);
        enemy.takeDamage(35, this.element, game);
      }
    }
  }

  render(ctx) {
    if (!this.active) return;
    const elem = ELEMENTS[this.element];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.progress * 15);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = elem.color;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ============================================================================
// COLLECTIBLES (Shards, Health Elixirs)
// ============================================================================
class Collectible {
  constructor(x, y, type = 'shard') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type === 'shard' ? 6 : 8;
    this.active = true;
    this.life = 60.0;
    this.hoverOffset = Math.random() * Math.PI * 2;
  }

  update(dt, game) {
    this.hoverOffset += dt * 3;
    const player = game.player;
    if (!player || !player.alive) return;

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < player.pickupRange) {
      const pullSpeed = 400 * dt;
      this.x += ((player.x - this.x) / dist) * pullSpeed;
      this.y += ((player.y - this.y) / dist) * pullSpeed;
    }

    if (dist < player.radius + this.radius) {
      this.active = false;
      this.onPickup(player, game);
    }
  }

  onPickup(player, game) {
    if (window.soundSystem) window.soundSystem.playPickup();

    if (this.type === 'shard') {
      game.shards += 1;
      game.particles.spawnBurst(this.x, this.y, 6, '#f59e0b', 80);
    } else if (this.type === 'health') {
      player.hp = Math.min(player.maxHp, player.hp + 25);
      game.particles.spawnBurst(this.x, this.y, 10, '#ef4444', 100);
    }
  }

  render(ctx) {
    if (!this.active) return;
    const yOff = Math.sin(this.hoverOffset) * 3;

    ctx.save();
    ctx.translate(this.x, this.y + yOff);

    if (this.type === 'shard') {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#f59e0b';
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1.5, -4.5, 3, 9);
      ctx.fillRect(-4.5, -1.5, 9, 3);
    }

    ctx.restore();
  }
}

window.BaseEntity = BaseEntity;
window.Player = Player;
window.Projectile = Projectile;
window.FlaskCanister = FlaskCanister;
window.Enemy = Enemy;
window.RangedEnemy = RangedEnemy;
window.Boss = Boss;
window.Collectible = Collectible;
