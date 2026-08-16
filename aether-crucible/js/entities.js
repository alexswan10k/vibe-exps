/**
 * Aether Crucible — Entities System
 * Player, Enemies, Bosses, Projectiles, and Collectibles.
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
    this.statuses = {}; // { burning: time, wet: time, electrified: time, chilled: time, corroded: time, tethered: time }
    this.lastAppliedElement = null;
    this.isSliding = false;
    this.armor = 0; // percentage reduction
    this.stunTimer = 0;
  }

  applyStatus(type, duration) {
    this.statuses[type] = Math.max(this.statuses[type] || 0, duration);
  }

  hasStatus(type) {
    return !!(this.statuses[type] && this.statuses[type] > 0);
  }

  updateStatuses(dt, game) {
    this.isSliding = false;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;

    for (const s in this.statuses) {
      if (this.statuses[s] > 0) {
        this.statuses[s] -= dt;

        // Status effects ticking
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
    // Corrosion reduces effective defense
    if (this.hasStatus('corroded')) {
      finalDmg *= 1.35;
    }
    // Chilled / Frozen bonus from artifacts
    if (this.hasStatus('chilled') && game.player && game.player.freezeDamageBonus) {
      finalDmg *= game.player.freezeDamageBonus;
    }

    this.hp -= finalDmg;

    // Trigger floating damage text
    if (game.ui) {
      game.ui.spawnDamageNumber(this.x, this.y - this.radius, Math.round(finalDmg), element);
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
// PLAYER ENTITY
// ============================================================================
class Player extends BaseEntity {
  constructor(x, y, archetypeId = 'pyromancer') {
    const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.pyromancer;
    super(x, y, 16, archetype.hp);

    this.archetype = archetype;
    this.maxShield = archetype.shield || 0;
    this.shield = this.maxShield;
    this.maxMana = archetype.mana;
    this.mana = this.maxMana;
    this.manaRegenRate = 18; // mana/sec
    this.manaRegenMultiplier = 1.0;
    this.baseSpeed = archetype.speed;
    this.speed = this.baseSpeed;

    // Elements & Weaponry
    this.activeElement = archetype.startingElements[0] || 'pyros';
    this.unlockedElements = [...archetype.startingElements];
    if (this.unlockedElements.length < 6) {
      // Unlock all 6 for maximum alchemical sandbox fun!
      this.unlockedElements = ['pyros', 'hydros', 'voltos', 'cryos', 'toxis', 'aether'];
    }

    // Cooldowns
    this.secondaryCooldowns = { pyros: 0, hydros: 0, voltos: 0, cryos: 0, toxis: 0, aether: 0 };
    this.flaskCooldowns = { pyros: 0, hydros: 0, voltos: 0, cryos: 0, toxis: 0, aether: 0 };
    this.primaryFireTimer = 0;

    // Dashes / Dodges
    this.maxDashes = 2;
    this.dashes = 2;
    this.dashRechargeTimer = 0;
    this.dashRechargeRate = 1.8;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashVx = 0;
    this.dashVy = 0;

    // Artifacts & Synergies
    this.artifacts = [];
    this.pickupRange = 60;
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

    // Apply starting perks
    if (archetype.startingArtifacts) {
      archetype.startingArtifacts.forEach(artId => {
        this.addArtifact(artId);
      });
    }

    // Aim & Orientation
    this.aimAngle = 0;
    this.aimX = x + 50;
    this.aimY = y;
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

    // Cooldown ticks
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

      // Dash trail particles
      const elemData = ELEMENTS[this.activeElement];
      game.particles.spawnTrail(this.x, this.y, elemData.color, 4, { glowColor: elemData.glowColor });

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.invulnerableTimer = 0.05;
      }
    } else {
      // Standard Movement
      let mx = 0;
      let my = 0;
      if (input.keys['KeyW'] || input.keys['ArrowUp'] || input.keys['w'] || input.keys['W']) my -= 1;
      if (input.keys['KeyS'] || input.keys['ArrowDown'] || input.keys['s'] || input.keys['S']) my += 1;
      if (input.keys['KeyA'] || input.keys['ArrowLeft'] || input.keys['a'] || input.keys['A']) mx -= 1;
      if (input.keys['KeyD'] || input.keys['ArrowRight'] || input.keys['d'] || input.keys['D']) mx += 1;

      // Touch stick movement
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
      } else {
        this.vx = this.isSliding ? this.vx * 0.95 : 0;
        this.vy = this.isSliding ? this.vy * 0.95 : 0;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Handle map wall collisions
      game.map.resolveCollision(this);
    }

    // Aim handling
    if (input.touchAim && (input.touchAim.x !== 0 || input.touchAim.y !== 0)) {
      this.aimAngle = Math.atan2(input.touchAim.y, input.touchAim.x);
    } else {
      this.aimAngle = Math.atan2(input.mouseY - this.y, input.mouseX - this.x);
    }
    this.aimX = this.x + Math.cos(this.aimAngle) * 50;
    this.aimY = this.y + Math.sin(this.aimAngle) * 50;

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

    // Fire healing synergy (Salamander Heart)
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

    // Archetype or artifact bonus
    if (this.archetype.id === 'astrologer') {
      game.particles.addGroundField(this.x, this.y, 40, 'ice', 4.0);
    }
  }

  castPrimary(game) {
    const elem = ELEMENTS[this.activeElement];
    if (this.mana < elem.primaryMana) return;

    this.mana -= elem.primaryMana;
    this.primaryFireTimer = 0.12; // High rate of fire beam/spray

    if (window.soundSystem) window.soundSystem.playPrimaryCast(this.activeElement);

    const spread = (Math.random() - 0.5) * 0.18;
    const angle = this.aimAngle + spread;
    const speed = 520;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const proj = new Projectile(
      this.x + Math.cos(this.aimAngle) * 20,
      this.y + Math.sin(this.aimAngle) * 20,
      vx, vy,
      this.activeElement,
      'player',
      14, // Damage
      4,  // Radius
      0.8, // Lifetime
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
    game.particles.triggerScreenShake(4);

    const speed = 360;
    const vx = Math.cos(this.aimAngle) * speed;
    const vy = Math.sin(this.aimAngle) * speed;
    const dmg = 45 * this.secondaryDamageMultiplier;

    const proj = new Projectile(
      this.x + Math.cos(this.aimAngle) * 24,
      this.y + Math.sin(this.aimAngle) * 24,
      vx, vy,
      this.activeElement,
      'player',
      dmg,
      10, // Radius
      1.6,
      { isSecondary: true }
    );
    game.projectiles.push(proj);
  }

  throwFlask(game) {
    const elem = ELEMENTS[this.activeElement];
    if (this.flaskCooldowns[this.activeElement] > 0) return;

    this.flaskCooldowns[this.activeElement] = elem.flaskCooldown * this.flaskCooldownMultiplier;

    if (window.soundSystem) {
      window.soundSystem.playFlaskThrow();
    }

    const dist = Math.min(260, Math.hypot(game.input.mouseX - this.x, game.input.mouseY - this.y));
    const targetX = this.x + Math.cos(this.aimAngle) * dist;
    const targetY = this.y + Math.sin(this.aimAngle) * dist;

    const flask = new FlaskCanister(
      this.x, this.y,
      targetX, targetY,
      this.activeElement,
      50 * this.flaskRadiusMultiplier
    );
    game.projectiles.push(flask);
  }

  takeDamage(amount, element, game) {
    if (!this.alive || this.invulnerableTimer > 0 || this.isDashing) return 0;

    this.shieldRegenTimer = 0;
    this.invulnerableTimer = 0.4;
    game.particles.triggerScreenShake(7);

    // Apply shield absorption first
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

    // Acid Retaliation Perk
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

    ctx.save();
    ctx.translate(this.x, this.y);

    // Flashing when invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    const elem = ELEMENTS[this.activeElement];

    // Element Aura Glow underneath
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = elem.glowColor;
    ctx.fillStyle = elem.glowColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Player Body (Robe & Mantle)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = elem.color;
    ctx.stroke();

    // Shield Aura
    if (this.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Aiming Staff / Catalyst Orb
    ctx.rotate(this.aimAngle);
    ctx.fillStyle = '#475569';
    ctx.fillRect(8, -2, 14, 4);

    // Glowing Catalyst Focus Crystal
    ctx.fillStyle = elem.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = elem.lightColor;
    ctx.beginPath();
    ctx.arc(24, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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
    this.owner = owner; // 'player' or 'enemy'
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

    // Spawn trail particles
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

    // Check hit targets
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
      // Enemy projectile hitting player
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

  hitTarget(target, game) {
    // Check for Elemental Reaction with target's previous element or status!
    const targetPrevElement = target.lastAppliedElement;
    const reaction = ElementMatrix.checkReaction(targetPrevElement, this.element);

    let finalDamage = this.damage;

    if (reaction) {
      finalDamage *= reaction.multiplier * (game.player?.reactionMultiplier || 1.0);
      game.triggerReaction(reaction, target.x, target.y, target);
    } else {
      // Apply elemental status
      const elemData = ELEMENTS[this.element];
      if (elemData && elemData.statusEffect) {
        target.applyStatus(elemData.statusEffect, elemData.statusDuration);
      }
    }

    target.lastAppliedElement = this.element;
    target.takeDamage(finalDamage, this.element, game);

    // Particle burst
    const elemColor = ELEMENTS[this.element]?.color || '#fff';
    game.particles.spawnBurst(this.x, this.y, this.isSecondary ? 16 : 8, elemColor, 140);

    if (this.isSecondary) {
      this.onSecondaryExplosion(game);
    }
  }

  onSecondaryExplosion(game) {
    game.particles.spawnShockwave(this.x, this.y, 90, ELEMENTS[this.element]?.color || '#fff', 350, 4);

    // Secondary creates corresponding ground puddle
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

    // Center core spark
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
    this.speed = 2.4; // finishes in ~0.45s
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

    // Create huge ground puddle
    let groundType = 'water';
    if (this.element === 'pyros') groundType = 'fire';
    if (this.element === 'toxis') groundType = 'acid';
    if (this.element === 'cryos') groundType = 'ice';
    if (this.element === 'voltos') groundType = 'water'; // electrified water

    const f = game.particles.addGroundField(this.targetX, this.targetY, this.splashRadius, groundType, 9.0);
    if (this.element === 'voltos' && f) {
      f.electrifiedTimer = 7.0;
    }

    // Damage all enemies caught in splash
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

    // Glass Flask Vial shape
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Elemental Core
    ctx.fillStyle = elem.color;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ============================================================================
// ENEMY HIERARCHY & BOSSES
// ============================================================================
class Enemy extends BaseEntity {
  constructor(x, y, radius, hp, speed, elementAffinity, name = 'Creature') {
    super(x, y, radius, hp);
    this.speed = speed;
    this.elementAffinity = elementAffinity;
    this.name = name;
    this.attackTimer = 0;
    this.attackCooldown = 2.0;
    this.scoreValue = 50;
    this.isBoss = false;
  }

  update(dt, game) {
    if (!this.alive) return;
    this.updateStatuses(dt, game);

    if (this.stunTimer > 0) return; // Stunned

    // Basic AI tracking towards player
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

      // Contact melee damage
      if (dist < this.radius + player.radius) {
        this.onMeleeHit(player, game);
      }
    }
  }

  onMeleeHit(player, game) {
    if (this.attackTimer <= 0) {
      player.takeDamage(15, this.elementAffinity, game);
      this.attackTimer = this.attackCooldown;
    }
  }

  die(game) {
    super.die(game);
    if (window.soundSystem) window.soundSystem.playEnemyDeath();

    // Spawning Collectibles
    const shardCount = 1 + (game.player?.bonusShards || 0);
    for (let i = 0; i < shardCount; i++) {
      game.collectibles.push(new Collectible(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, 'shard'));
    }

    if (game.player?.healthDropChance && Math.random() < game.player.healthDropChance) {
      game.collectibles.push(new Collectible(this.x, this.y, 'health'));
    }

    // Blightbloom Spore Perk explosion
    if (this.hasStatus('corroded') && game.player?.corrodedExplode) {
      game.particles.addGroundField(this.x, this.y, 45, 'acid', 5.0);
    }

    game.score += this.scoreValue;
  }

  render(ctx) {
    if (!this.alive) return;
    const elem = ELEMENTS[this.elementAffinity] || ELEMENTS.pyros;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Enemy Body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = elem.glowColor;
    ctx.stroke();

    // Health Bar
    if (this.hp < this.maxHp) {
      const barW = this.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-barW / 2, -this.radius - 8, barW, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-barW / 2, -this.radius - 8, barW * (this.hp / this.maxHp), 4);
    }

    ctx.restore();
  }
}

// Ranged Shooter Enemy
class RangedEnemy extends Enemy {
  constructor(x, y, radius, hp, speed, elementAffinity, name) {
    super(x, y, radius, hp, speed, elementAffinity, name);
    this.shootTimer = 1.0 + Math.random() * 2;
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
    const speed = 240;
    const proj = new Projectile(
      this.x, this.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      this.elementAffinity,
      'enemy',
      16,
      5,
      2.5
    );
    game.projectiles.push(proj);
  }
}

// ============================================================================
// BOSS ENTITY (Multi-Phase)
// ============================================================================
class Boss extends Enemy {
  constructor(x, y, sectorIndex) {
    const names = ['Spore Behemoth', 'Pyre Colossus', 'Cryo Archon', 'The Primordial Chimera'];
    const elements = ['toxis', 'pyros', 'cryos', 'aether'];
    const hps = [500, 850, 1200, 2000];

    super(x, y, 36, hps[sectorIndex] || 500, 110, elements[sectorIndex] || 'pyros', names[sectorIndex] || 'Crucible Boss');
    this.sectorIndex = sectorIndex;
    this.isBoss = true;
    this.phase = 1;
    this.specialTimer = 3.0;
    this.scoreValue = 1000;
  }

  update(dt, game) {
    super.update(dt, game);
    if (!this.alive || this.stunTimer > 0) return;

    // Boss Phase transition at 50% HP
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.speed *= 1.35;
      game.particles.spawnShockwave(this.x, this.y, 280, '#ef4444', 500, 8);
      game.particles.triggerScreenShake(12);
      if (window.soundSystem) window.soundSystem.playBossRoar();
    }

    this.specialTimer -= dt;
    if (this.specialTimer <= 0) {
      this.specialTimer = this.phase === 2 ? 2.5 : 4.0;
      this.castBossSpecial(game);
    }
  }

  castBossSpecial(game) {
    if (window.soundSystem) window.soundSystem.playBossRoar();
    game.particles.triggerScreenShake(6);

    const projectileCount = this.phase === 2 ? 14 : 8;
    for (let i = 0; i < projectileCount; i++) {
      const angle = (Math.PI * 2 / projectileCount) * i;
      const speed = 220;
      const proj = new Projectile(
        this.x, this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        this.elementAffinity,
        'enemy',
        20,
        7,
        3.0
      );
      game.projectiles.push(proj);
    }

    // Drop hazard field on special cast
    let gType = 'acid';
    if (this.sectorIndex === 1) gType = 'fire';
    if (this.sectorIndex === 2) gType = 'ice';
    if (this.sectorIndex === 3) gType = 'water';
    game.particles.addGroundField(this.x, this.y, 80, gType, 8.0);
  }

  die(game) {
    super.die(game);
    game.particles.spawnShockwave(this.x, this.y, 400, '#fbbf24', 600, 10);
    game.particles.triggerScreenShake(20);
    if (window.soundSystem) window.soundSystem.playVictoryFanfare();

    // Drop massive loot
    for (let i = 0; i < 15; i++) {
      game.collectibles.push(new Collectible(this.x + (Math.random() - 0.5) * 80, this.y + (Math.random() - 0.5) * 80, 'shard'));
    }
    game.collectibles.push(new Collectible(this.x, this.y, 'health'));
    game.collectibles.push(new Collectible(this.x + 20, this.y, 'health'));

    game.onBossDefeated();
  }

  render(ctx) {
    if (!this.alive) return;
    const elem = ELEMENTS[this.elementAffinity] || ELEMENTS.pyros;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glowing boss halo
    ctx.shadowBlur = 24;
    ctx.shadowColor = elem.glowColor;
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.stroke();

    // Inner demonic runic core
    ctx.fillStyle = elem.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
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
    this.type = type; // 'shard' or 'health'
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
      // Homing magnet attraction towards player
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
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1.5, -4, 3, 8);
      ctx.fillRect(-4, -1.5, 8, 3);
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
