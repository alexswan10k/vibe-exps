/**
 * Aether Crucible — Particle System & Ground Field Simulation
 * High-performance particle physics, fluid puddle simulation, and visual FX.
 */

class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 2;
    this.color = '#fff';
    this.glowColor = null;
    this.alpha = 1;
    this.life = 1;
    this.maxLife = 1;
    this.decay = 0.02;
    this.friction = 0.98;
    this.gravity = 0;
    this.element = null;
    this.isSpark = false;
    this.isSmoke = false;
    this.spin = 0;
    this.angle = 0;
  }

  spawn(x, y, vx, vy, color, radius = 3, life = 1, opts = {}) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.alpha = opts.alpha !== undefined ? opts.alpha : 1;
    this.decay = opts.decay || (1 / (life * 60));
    this.friction = opts.friction !== undefined ? opts.friction : 0.96;
    this.gravity = opts.gravity || 0;
    this.glowColor = opts.glowColor || null;
    this.element = opts.element || null;
    this.isSpark = !!opts.isSpark;
    this.isSmoke = !!opts.isSmoke;
    this.spin = (Math.random() - 0.5) * 0.1;
    this.angle = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (!this.active) return;

    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vx *= Math.pow(this.friction, dt * 60);
    this.vy *= Math.pow(this.friction, dt * 60);
    this.vy += this.gravity * dt * 60;
    this.angle += this.spin;

    this.alpha = Math.max(0, this.life / this.maxLife);
    if (this.isSmoke) {
      this.radius += dt * 8;
    }
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.min(1, this.alpha);

    if (this.glowColor) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.glowColor;
    }

    ctx.fillStyle = this.color;

    if (this.isSpark) {
      // Draw stretched spark line along velocity
      const speed = Math.hypot(this.vx, this.vy);
      const angle = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      ctx.fillRect(-this.radius * (1 + speed * 0.2), -this.radius * 0.5, this.radius * 2 * (1 + speed * 0.2), this.radius);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.radius), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Ground Puddle / Hazard Surface Field
class GroundField {
  constructor(x, y, radius, type, duration = 8.0) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.maxRadius = radius;
    this.type = type; // 'water', 'oil', 'acid', 'ice', 'fire'
    this.duration = duration;
    this.maxDuration = duration;
    this.electrifiedTimer = 0;
    this.tickTimer = 0;
    this.active = true;
  }

  update(dt, game) {
    this.duration -= dt;
    if (this.duration <= 0) {
      this.active = false;
      return;
    }

    if (this.electrifiedTimer > 0) {
      this.electrifiedTimer -= dt;
      // Spawn crackling electricity sparks
      if (Math.random() < 0.3) {
        game.particles.spawnElectricArc(this.x + (Math.random() - 0.5) * this.radius, this.y + (Math.random() - 0.5) * this.radius, 15);
      }
    }

    // Ticking elemental damage or status on passing entities
    this.tickTimer += dt;
    if (this.tickTimer >= 0.25) {
      this.tickTimer = 0;
      this.applyFieldEffects(game);
    }
  }

  applyFieldEffects(game) {
    const allEntities = [game.player, ...game.enemies];
    for (const ent of allEntities) {
      if (!ent || !ent.alive) continue;
      const dist = Math.hypot(ent.x - this.x, ent.y - this.y);
      if (dist < this.radius + ent.radius) {
        if (this.type === 'water') {
          ent.applyStatus('wet', 4.0);
          if (this.electrifiedTimer > 0) {
            ent.takeDamage(12, 'voltos', game);
            ent.applyStatus('electrified', 2.0);
          }
        } else if (this.type === 'acid') {
          ent.applyStatus('corroded', 3.5);
          ent.takeDamage(ent === game.player ? 3 : 8, 'toxis', game);
        } else if (this.type === 'fire') {
          ent.applyStatus('burning', 3.0);
          ent.takeDamage(ent === game.player ? 4 : 14, 'pyros', game);
        } else if (this.type === 'ice') {
          ent.applyStatus('chilled', 2.5);
          ent.isSliding = true;
        }
      }
    }
  }

  render(ctx) {
    if (!this.active) return;
    const progress = this.duration / this.maxDuration;
    const alpha = Math.min(0.65, progress * 0.85);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    switch (this.type) {
      case 'water':
        ctx.fillStyle = this.electrifiedTimer > 0 ? '#38bdf8' : '#0369a1';
        ctx.shadowBlur = this.electrifiedTimer > 0 ? 15 : 0;
        ctx.shadowColor = '#eab308';
        break;
      case 'acid':
        ctx.fillStyle = '#15803d';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4ade80';
        break;
      case 'fire':
        ctx.fillStyle = '#b91c1c';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#ff4500';
        break;
      case 'ice':
        ctx.fillStyle = '#0891b2';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#a5f3fc';
        break;
      case 'oil':
        ctx.fillStyle = '#1e1b4b';
        break;
    }

    ctx.fill();

    // Inner highlight ring
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    ctx.restore();
  }
}

// Shockwave / Ring Effect
class Shockwave {
  constructor(x, y, maxRadius, color, speed = 400, lineWidth = 4) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.maxRadius = maxRadius;
    this.color = color;
    this.speed = speed;
    this.lineWidth = lineWidth;
    this.active = true;
  }

  update(dt) {
    this.radius += this.speed * dt;
    if (this.radius >= this.maxRadius) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!this.active) return;
    const progress = this.radius / this.maxRadius;
    const alpha = (1 - progress) * 0.8;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(1, this.lineWidth * (1 - progress * 0.5));
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Particle System Manager
class ParticleSystem {
  constructor(poolSize = 1000) {
    this.poolSize = poolSize;
    this.particles = Array.from({ length: poolSize }, () => new Particle());
    this.groundFields = [];
    this.shockwaves = [];
    this.screenShakeIntensity = 0;
    this.screenShakeDecay = 0.92;
  }

  getAvailableParticle() {
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.particles[i].active) return this.particles[i];
    }
    return this.particles[0]; // fallback
  }

  spawnBurst(x, y, count, color, speed = 120, radius = 3, opts = {}) {
    for (let i = 0; i < count; i++) {
      const p = this.getAvailableParticle();
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      const vx = Math.cos(angle) * spd / 60;
      const vy = Math.sin(angle) * spd / 60;
      p.spawn(x, y, vx, vy, color, radius * (0.6 + Math.random() * 0.8), 0.3 + Math.random() * 0.5, opts);
    }
  }

  spawnTrail(x, y, color, radius = 3, opts = {}) {
    const p = this.getAvailableParticle();
    const vx = (Math.random() - 0.5) * 1.5;
    const vy = (Math.random() - 0.5) * 1.5;
    p.spawn(x, y, vx, vy, color, radius, 0.25 + Math.random() * 0.2, { ...opts, friction: 0.9 });
  }

  spawnElectricArc(x, y, length = 30) {
    const p = this.getAvailableParticle();
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * (length / 60);
    const vy = Math.sin(angle) * (length / 60);
    p.spawn(x, y, vx, vy, '#fef08a', 2, 0.12, { isSpark: true, glowColor: '#eab308' });
  }

  spawnShockwave(x, y, maxRadius, color, speed = 450, lineWidth = 4) {
    this.shockwaves.push(new Shockwave(x, y, maxRadius, color, speed, lineWidth));
  }

  addGroundField(x, y, radius, type, duration = 8.0) {
    // Check if field already overlaps similar type to refresh
    for (const f of this.groundFields) {
      if (f.active && f.type === type && Math.hypot(f.x - x, f.y - y) < radius * 0.6) {
        f.duration = Math.max(f.duration, duration);
        f.radius = Math.min(f.maxRadius * 1.5, f.radius + 15);
        return f;
      }
    }
    const field = new GroundField(x, y, radius, type, duration);
    this.groundFields.push(field);
    return field;
  }

  triggerScreenShake(amount) {
    this.screenShakeIntensity = Math.min(30, this.screenShakeIntensity + amount);
  }

  update(dt, game) {
    // Update particles
    for (let i = 0; i < this.poolSize; i++) {
      if (this.particles[i].active) {
        this.particles[i].update(dt);
      }
    }

    // Update ground fields
    for (let i = this.groundFields.length - 1; i >= 0; i--) {
      const f = this.groundFields[i];
      f.update(dt, game);
      if (!f.active) {
        this.groundFields.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.update(dt);
      if (!s.active) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Decay screenshake
    if (this.screenShakeIntensity > 0.05) {
      this.screenShakeIntensity *= Math.pow(this.screenShakeDecay, dt * 60);
    } else {
      this.screenShakeIntensity = 0;
    }
  }

  renderGround(ctx) {
    for (const f of this.groundFields) {
      f.render(ctx);
    }
  }

  renderParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.poolSize; i++) {
      if (this.particles[i].active) {
        this.particles[i].render(ctx);
      }
    }

    for (const s of this.shockwaves) {
      s.render(ctx);
    }

    ctx.restore();
  }

  clear() {
    for (let i = 0; i < this.poolSize; i++) {
      this.particles[i].active = false;
    }
    this.groundFields = [];
    this.shockwaves = [];
    this.screenShakeIntensity = 0;
  }
}

window.ParticleSystem = ParticleSystem;
