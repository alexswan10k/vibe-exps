'use strict';
/* Virtual Aquarium — AI Ecosystem (refactored)
 * Keeps: adversarial prey vs predator learning, genetic crossover breeding,
 * curriculum difficulty, experience replay, hiding spots / rocks / currents,
 * seasons, analytics graphs, learning-rate sliders, training log.
 * Fixes: dead-button crashes, double-eat, per-frame NN spam, log spam,
 * blurry canvas, flickering debug overlay, unbalanced speeds, unresponsive layout.
 */

// ---------- Canvas (HiDPI, responsive) ----------
const canvas = document.getElementById('aquarium-canvas');
const ctx = canvas.getContext('2d');
const W = 1280, H = 720;
const SAND_H = 64;
function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

// ---------- Utils ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ---------- Config ----------
const MAX_FISH = 28, MAX_PLANTS = 18, MAX_BUBBLES = 70, MAX_FOOD = 40, MAX_BURSTS = 60;
const BRAIN_KEY = id => `aquarium-${id}-brain-v4`;

// ---------- State ----------
let fish = [], bubbles = [], plants = [], rocks = [], currents = [], hidingSpots = [];
let foods = [], bursts = [], plankton = [];
let paused = false;
let gameTime = 0;
let showNeuralNetwork = false, showDebugWeights = false, showAnalytics = false;

let learningRates = { eatingReward: 0.10, positiveReward: 0.10, negativeReward: 0.10, preySurvival: 0.02, predatorHunting: 0.02 };

// Adversarial / evolution state
let currentRound = 0, roundTime = 0, roundDuration = 1800;
let predatorScore = 0, preyScore = 0, roundActive = false, roundWinner = null;
let initialPreyCount = 0, initialPredatorCount = 0;
let difficultyLevel = 1, preyWinStreak = 0, predatorWinStreak = 0;
let generation = 1, topPreySurvivors = [], topPredatorSurvivors = [];
let topPreyFitness = 0, topPredatorFitness = 0;
let generationHistory = [], populationHistory = [];
let ecosystemHealth = 100, foodScarcity = 0, season = 'spring', seasonTimer = 0;
const SEASON_DURATION = 3600;

const getPredatorSpeedMultiplier = () => 0.72 + difficultyLevel * 0.035; // 0.755 → 1.07
const getPredatorDetectionRange = () => 110 + difficultyLevel * 10;

// ---------- Evolution v2: params + state ----------
let evoParams = { mutationRate: 0.08, crossoverRate: 0.8, tournamentK: 3, elitism: true };
let simSpeed = 1;
let traitHistory = [];       // { gen, preySpeed, preySize, preyVision, predSpeed, predSize, predVision }
let diversity = { prey: 1, predator: 1 };
let stagnation = { prey: 0, predator: 0 };
let lastBest = { prey: 0, predator: 0 };
let bestEver = { prey: 0, predator: 0 };
let selectedFish = null;
let deadPool = []; // brains+genomes of the fallen — selection uses survivors AND dead
let champion = { prey: null, predator: null }; // live fish refs with top fitness
function refreshChampions() {
  let bp = null, bpr = null;
  for (const f of fish) {
    if (f.team === 'prey' && (!bp || f.fitness > bp.fitness)) bp = f;
    if (f.team === 'predator' && (!bpr || f.fitness > bpr.fitness)) bpr = f;
  }
  champion.prey = bp; champion.predator = bpr;
}

// Evolvable body genome — this is what makes evolution VISIBLE.
// Children inherit + mutate: speed, size, vision range, metabolism, color hue.
class Genome {
  constructor(team, a = null, b = null) {
    this.team = team;
    if (a && b && Math.random() < evoParams.crossoverRate) {
      const pick = (k) => Math.random() < 0.5 ? a[k] : b[k];
      this.speed = pick('speed'); this.size = pick('size');
      this.vision = pick('vision'); this.metabolism = pick('metabolism');
      this.hue = pick('hue');
    } else if (a) {
      Object.assign(this, { speed: a.speed, size: a.size, vision: a.vision, metabolism: a.metabolism, hue: a.hue });
    } else {
      this.speed = rand(0.85, 1.15);
      this.size = rand(0.88, 1.18);
      this.vision = rand(0.85, 1.2);
      this.metabolism = rand(0.85, 1.2);
      this.hue = team === 'prey' ? rand(195, 228) : 0;
    }
  }
  mutate(rate) {
    const j = (v, amt, lo, hi) => Math.random() < rate ? clamp(v + rand(-amt, amt), lo, hi) : v;
    this.speed = j(this.speed, 0.12, 0.75, 1.4);
    this.size = j(this.size, 0.1, 0.8, 1.35);
    this.vision = j(this.vision, 0.15, 0.7, 1.5);
    this.metabolism = j(this.metabolism, 0.12, 0.7, 1.4);
    if (this.team === 'prey') this.hue = j(this.hue, 14, 185, 235);
  }
  distance(o) {
    return Math.abs(this.speed - o.speed) + Math.abs(this.size - o.size) +
      Math.abs(this.vision - o.vision) + Math.abs(this.metabolism - o.metabolism);
  }
}

// ---------- Training log (throttled, categorized) ----------
let trainingLog = [];
const MAX_LOG_ENTRIES = 60;
const lastLogAt = {};
function addToTrainingLog(message, type = 'info') {
  const now = performance.now();
  // Throttle spammy categories to 1 per 2s
  if (['eat', 'survival', 'hunt'].includes(type)) {
    if (now - (lastLogAt[type] || 0) < 2000) return;
    lastLogAt[type] = now;
  }
  trainingLog.push({ timestamp: new Date().toLocaleTimeString(), message, type });
  if (trainingLog.length > MAX_LOG_ENTRIES) trainingLog = trainingLog.slice(-MAX_LOG_ENTRIES);
  updateTrainingLogDisplay();
}
const LOG_EMOJI = { eat: '🍽️', catch: '🦈', round: '🏆', evo: '🧬', info: '📝', season: '🌿', diff: '📈', death: '💀' };
function updateTrainingLogDisplay() {
  const c = document.getElementById('log-container');
  if (!c) return;
  c.innerHTML = '';
  for (const e of trainingLog) {
    const d = document.createElement('div');
    d.className = 'log-entry' + (e.type === 'catch' ? ' evt-catch' : e.type === 'round' ? ' evt-round' : e.type === 'evo' ? ' evt-evo' : '');
    d.textContent = `${LOG_EMOJI[e.type] || '📝'} ${e.timestamp}: ${e.message}`;
    c.appendChild(d);
  }
  c.scrollTop = c.scrollHeight;
}

// ---------- Neural Network ----------
class NeuralNetwork {
  constructor(inputSize, hiddenSize, outputSize) {
    this.inputSize = inputSize; this.hiddenSize = hiddenSize; this.outputSize = outputSize;
    this.weightsIH = this.randomMatrix(hiddenSize, inputSize);
    this.weightsHO = this.randomMatrix(outputSize, hiddenSize);
    this.biasH = this.randomMatrix(hiddenSize, 1);
    this.biasO = this.randomMatrix(outputSize, 1);
    this.learningRate = 0.1;
  }
  randomMatrix(r, c) {
    const m = new Array(r);
    for (let i = 0; i < r; i++) { m[i] = new Array(c); for (let j = 0; j < c; j++) m[i][j] = Math.random() * 2 - 1; }
    return m;
  }
  sigmoid(x) { return 1 / (1 + Math.exp(-clamp(x, -50, 50))); }
  predict(inputs) {
    const h = new Array(this.hiddenSize);
    for (let i = 0; i < this.hiddenSize; i++) {
      let s = this.biasH[i][0];
      const row = this.weightsIH[i];
      for (let j = 0; j < this.inputSize; j++) s += row[j] * inputs[j];
      h[i] = Math.tanh(s);
    }
    const o = new Array(this.outputSize);
    for (let i = 0; i < this.outputSize; i++) {
      let s = this.biasO[i][0];
      const row = this.weightsHO[i];
      for (let j = 0; j < this.hiddenSize; j++) s += row[j] * h[j];
      o[i] = this.sigmoid(s);
    }
    return { output: o, hidden: h };
  }
  train(inputs, targets) {
    const { output: o, hidden: h } = this.predict(inputs);
    const oErr = new Array(this.outputSize);
    let mse = 0;
    for (let i = 0; i < this.outputSize; i++) {
      oErr[i] = clamp(targets[i] - o[i], -1, 1);
      mse += oErr[i] * oErr[i];
    }
    mse /= this.outputSize;
    const lr = this.learningRate;
    for (let i = 0; i < this.outputSize; i++) {
      const grad = oErr[i] * o[i] * (1 - o[i]) * lr;
      const row = this.weightsHO[i];
      for (let j = 0; j < this.hiddenSize; j++) row[j] += grad * h[j];
      this.biasO[i][0] += grad;
    }
    for (let i = 0; i < this.hiddenSize; i++) {
      let err = 0;
      for (let k = 0; k < this.outputSize; k++) err += this.weightsHO[k][i] * oErr[k];
      err = clamp(err, -1, 1);
      const grad = err * (1 - h[i] * h[i]) * lr;
      const row = this.weightsIH[i];
      for (let j = 0; j < this.inputSize; j++) row[j] += grad * inputs[j];
      this.biasH[i][0] += grad;
    }
    return mse;
  }
  copy() {
    const c = new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize);
    c.weightsIH = JSON.parse(JSON.stringify(this.weightsIH));
    c.weightsHO = JSON.parse(JSON.stringify(this.weightsHO));
    c.biasH = JSON.parse(JSON.stringify(this.biasH));
    c.biasO = JSON.parse(JSON.stringify(this.biasO));
    return c;
  }
  mutate(rate = 0.1) {
    const m = (mx) => {
      for (let i = 0; i < mx.length; i++) for (let j = 0; j < mx[0].length; j++)
        if (Math.random() < rate) mx[i][j] = clamp(mx[i][j] + rand(-0.5, 0.5), -2, 2);
    };
    m(this.weightsIH); m(this.weightsHO); m(this.biasH); m(this.biasO);
  }
  crossover(partner) {
    const child = new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize);
    const x = (a, b) => a.map((row, i) => row.map((v, j) => Math.random() < 0.5 ? v : b[i][j]));
    child.weightsIH = x(this.weightsIH, partner.weightsIH);
    child.weightsHO = x(this.weightsHO, partner.weightsHO);
    child.biasH = x(this.biasH, partner.biasH);
    child.biasO = x(this.biasO, partner.biasO);
    return child;
  }
  save(key) {
    try { localStorage.setItem(key, JSON.stringify(this)); return true; }
    catch { return false; }
  }
  static load(key, inputSize) {
    try {
      const d = JSON.parse(localStorage.getItem(key));
      if (!d || d.inputSize !== inputSize) return null;
      const n = new NeuralNetwork(d.inputSize, d.hiddenSize, d.outputSize);
      n.weightsIH = d.weightsIH; n.weightsHO = d.weightsHO; n.biasH = d.biasH; n.biasO = d.biasO;
      return n;
    } catch { return null; }
  }
}

// ---------- Environment entities ----------
class Rock {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.radius = radius;
    this.points = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = radius * rand(0.78, 1.15);
      this.points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 });
    }
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y);
    const g = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 4, 0, 0, this.radius * 1.2);
    g.addColorStop(0, '#8a94a3'); g.addColorStop(1, '#3c4450');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}
class Current {
  constructor(x, y, w, h, fx, fy) {
    this.x = x; this.y = y; this.width = w; this.height = h; this.forceX = fx; this.forceY = fy;
    this.particles = Array.from({ length: 12 }, () => ({ x: Math.random() * w, y: Math.random() * h }));
  }
  update() {
    for (const p of this.particles) {
      p.x += this.forceX * 5; p.y += this.forceY * 5;
      if (p.x < 0) p.x = this.width; if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height; if (p.y > this.height) p.y = 0;
    }
  }
  draw() {
    ctx.save(); ctx.strokeStyle = 'rgba(140,220,255,0.22)'; ctx.lineWidth = 1.5;
    for (const p of this.particles) {
      ctx.beginPath(); ctx.moveTo(this.x + p.x, this.y + p.y);
      ctx.lineTo(this.x + p.x + this.forceX * 12, this.y + p.y + this.forceY * 12); ctx.stroke();
    }
    ctx.restore();
  }
  contains(x, y) { return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height; }
}
class HidingSpot {
  constructor(x, y, radius) { this.x = x; this.y = y; this.radius = radius; this.sway = Math.random() * 10; }
  draw(t) {
    ctx.save();
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    g.addColorStop(0, 'rgba(10,80,40,0.55)'); g.addColorStop(1, 'rgba(10,80,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    // kelp blades
    ctx.strokeStyle = 'rgba(30,140,70,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const bx = this.x + i * 14, sway = Math.sin(t / 40 + this.sway + i) * 8;
      ctx.beginPath(); ctx.moveTo(bx, this.y + this.radius * 0.5);
      ctx.quadraticCurveTo(bx + sway, this.y, bx + sway * 1.5, this.y - this.radius * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
  contains(x, y) { return dist2(x, y, this.x, this.y) < this.radius; }
}
class Plant {
  constructor(x, y) {
    this.x = x; this.y = y ?? (H - SAND_H);
    this.h = rand(30, 70); this.maxH = rand(120, 220);
    this.health = 3; this.maxHealth = 3; this.phase = Math.random() * 10;
    this.segs = 6;
  }
  update() {
    if (this.h < this.maxH) this.h += 0.35;
    if (this.health < this.maxHealth && Math.random() < 0.02) this.health++;
  }
  eat() {
    this.health--;
    if (this.health <= 0) { const i = plants.indexOf(this); if (i > -1) plants.splice(i, 1); return true; }
    return false;
  }
  draw(t) {
    const hr = this.health / this.maxHealth;
    const col = `rgb(20,${Math.floor(120 + 80 * hr)},60)`;
    ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 5;
    ctx.beginPath();
    let px = this.x, py = this.y;
    ctx.moveTo(px, py);
    for (let s = 1; s <= this.segs; s++) {
      const yy = this.y - (this.h / this.segs) * s;
      const xx = this.x + Math.sin(t / 35 + this.phase + s * 0.7) * (s * 2.2);
      ctx.quadraticCurveTo(px + 4, (py + yy) / 2, xx, yy);
      px = xx; py = yy;
    }
    ctx.stroke();
    // leaves
    ctx.fillStyle = col;
    for (let s = 1; s <= this.segs; s += 2) {
      const yy = this.y - (this.h / this.segs) * s;
      const xx = this.x + Math.sin(t / 35 + this.phase + s * 0.7) * (s * 2.2);
      ctx.beginPath(); ctx.ellipse(xx + 8, yy, 12, 5, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(xx - 8, yy - 6, 10, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
class Bubble {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = rand(2, 8);
    this.dy = -rand(0.6, 1.8); this.wob = Math.random() * 10;
  }
  update() {
    this.y += this.dy; this.x += Math.sin((gameTime + this.wob * 10) / 20) * 0.3;
    if (this.y < -10) { this.y = H - SAND_H + rand(0, 20); this.x = Math.random() * W; }
  }
  draw() {
    ctx.save();
    ctx.fillStyle = 'rgba(200,235,255,0.28)';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
class Food {
  constructor(x, y) { this.x = x; this.y = y; this.vy = rand(0.2, 0.5); this.life = 900; }
  update() {
    this.y += this.vy; this.life--;
    if (this.y > H - SAND_H - 4) { this.y = H - SAND_H - 4; this.vy = 0; }
    return this.life > 0;
  }
  draw() {
    ctx.save(); ctx.fillStyle = '#9fe870';
    ctx.beginPath(); ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(this.x - 1, this.y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function spawnBurst(x, y, color, n = 8) {
  for (let i = 0; i < n && bursts.length < MAX_BURSTS; i++) {
    bursts.push({ x, y, vx: rand(-1.5, 1.5), vy: rand(-1.5, 1.5), life: 30, color });
  }
}

// ---------- SmartFish (kept AI, fixed + beautified) ----------
class SmartFish {
  constructor(x, y, team = 'prey', parentBrain = null, genome = null, lineage = null) {
    this.x = clamp(x, 30, W - 30); this.y = clamp(y, 30, H - SAND_H - 20);
    const a = Math.random() * Math.PI * 2;
    this.dx = Math.cos(a); this.dy = Math.sin(a);
    this.team = team;
    this.genome = genome || new Genome(team);
    const baseSize = team === 'predator' ? 24 : rand(13, 17);
    this.baseSize = baseSize;
    this.size = baseSize * this.genome.size;
    this.hunger = rand(0, 30); this.maxHunger = 100;
    this.energy = 50; this.maxEnergy = 100;
    this.starvationTime = 0; this.lifetime = 0;
    this.fitness = 0; this.generation = generation;
    // event counters → rich fitness (evolution v2)
    this.foodEaten = 0; this.catches = 0; this.escapes = 0;
    this.distance = 0; this.hiddenTime = 0; this.schoolTime = 0;
    this._dangerFrames = 0; this._wasInDanger = false;
    this.lineage = lineage || `G${generation}·wild`;
    this.isElite = false;
    this.lastDecision = [0.5, 0.5, 0.2, 0.2];
    this.lastInputs = null; this.decisionCooldown = Math.floor(Math.random() * 10);
    this.previousHidden = new Array(12).fill(0.5); this.hiddenActivations = new Array(12).fill(0.5);
    this.experienceBuffer = []; this.maxExperiences = 50;
    this.replayCounter = 0; this.replayInterval = 150;
    this.inReflexMode = false; this.reflexDistance = 60;
    this.errorHistory = []; this.wiggle = Math.random() * 10;
    this.hue = team === 'predator' ? null : this.genome.hue;
    this.stripeSeed = Math.random() * 10;

    const inputSize = team === 'prey' ? 29 : 28;
    if (parentBrain) { this.brain = parentBrain.copy(); this.brain.mutate(evoParams.mutationRate); }
    else {
      this.brain = NeuralNetwork.load(BRAIN_KEY(team), inputSize) || new NeuralNetwork(inputSize, 12, 4);
    }
    this.lastSave = Date.now();
  }
  visionRange(base) { return base * this.genome.vision; }
  get alive() { return fish.includes(this); }
  update() {
    this.lifetime++; this.wiggle += 0.25;
    this.decisionCooldown--;
    if (Date.now() - this.lastSave > 30000) { this.brain.save(BRAIN_KEY(this.team)); this.lastSave = Date.now(); }

    const hungerRate = (this.team === 'predator' ? 0.22 : 0.32) * this.genome.metabolism;
    this.hunger = Math.min(this.maxHunger + 20, this.hunger + hungerRate);
    if (this.hunger >= this.maxHunger) {
      this.starvationTime++;
      if (this.starvationTime > 700) return this.die(true);
    } else this.starvationTime = 0;

    if (this.decisionCooldown <= 0) {
      this.decisionCooldown = 10;
      this.previousHidden = [...this.hiddenActivations];
      this.lastInputs = this.getSensoryInputs(); // cached — fixes 3x per-frame recompute
      const r = this.brain.predict(this.lastInputs);
      this.lastDecision = r.output; this.hiddenActivations = r.hidden;
      this.recordExperience();
      this.applyDecision();
    } else {
      // keep gliding between decisions
      this.x += this.dx; this.y += this.dy;
    }
    this.collideWorld();
    this.tryEat(); // single eat path — fixes double-eat bug

    if (this.team === 'predator') this.huntPrey();
    else { this.fleeLearn(); this.grazeLearn(); }

    // track survival skill signals (escape / hiding / schooling / roaming)
    this.distance += Math.hypot(this.dx, this.dy);
    if (this.hiddenAt(this.x, this.y)) this.hiddenTime++;
    let danger = false;
    if (this.team === 'prey') {
      for (const o of fish) {
        if (o !== this && o instanceof SmartFish && o.team === 'predator' &&
          dist2(this.x, this.y, o.x, o.y) < 70) { danger = true; break; }
      }
      let matesNear = 0;
      for (const o of fish) {
        if (o !== this && o instanceof SmartFish && o.team === 'prey' &&
          dist2(this.x, this.y, o.x, o.y) < 90) matesNear++;
      }
      if (matesNear >= 2) this.schoolTime++;
    }
    if (danger) { this._dangerFrames++; this._wasInDanger = true; }
    else {
      if (this._wasInDanger && this._dangerFrames > 90) this.escapes++; // survived a chase
      this._dangerFrames = 0; this._wasInDanger = false;
    }

    // natural prey reproduction when thriving — passes genome + brain to child
    if (this.team === 'prey' && this.energy >= this.maxEnergy && fish.length < MAX_FISH && Math.random() < 0.004) {
      this.energy = 20;
      const kidGenome = new Genome('prey', this.genome, this.genome);
      kidGenome.mutate(evoParams.mutationRate);
      const kid = new SmartFish(this.x + rand(-30, 30), this.y + rand(-30, 30), 'prey', this.brain, kidGenome, `G${generation}·child-of-${this.lineage.slice(0, 12)}`);
      fish.push(kid);
      spawnBurst(this.x, this.y, 'rgba(120,200,255,0.8)', 6);
    }

    this.fitness = this.computeFitness();

    this.replayCounter++;
    if (this.replayCounter >= this.replayInterval) { this.replayCounter = 0; this.replayExperiences(); }
  }
  collideWorld() {
    for (const rock of rocks) {
      const d = dist2(this.x, this.y, rock.x, rock.y);
      if (d < rock.radius + this.size && d > 0.01) {
        const a = Math.atan2(this.y - rock.y, this.x - rock.x);
        this.x = rock.x + Math.cos(a) * (rock.radius + this.size + 1);
        this.y = rock.y + Math.sin(a) * (rock.radius + this.size + 1);
        const nx = (this.x - rock.x) / d, ny = (this.y - rock.y) / d;
        const dot = this.dx * nx + this.dy * ny;
        this.dx = (this.dx - 2 * dot * nx) * 0.5; this.dy = (this.dy - 2 * dot * ny) * 0.5;
      }
    }
    for (const c of currents) if (c.contains(this.x, this.y)) { this.dx += c.forceX * 0.05; this.dy += c.forceY * 0.05; }
    const sp = Math.hypot(this.dx, this.dy), maxSp = (this.team === 'predator' ? 3.4 : 3) * this.genome.speed;
    if (sp > maxSp) { this.dx = this.dx / sp * maxSp; this.dy = this.dy / sp * maxSp; }
    if (this.x < this.size) { this.x = this.size; this.dx *= -1; }
    if (this.x > W - this.size) { this.x = W - this.size; this.dx *= -1; }
    if (this.y < this.size) { this.y = this.size; this.dy *= -1; }
    if (this.y > H - SAND_H - this.size * 0.5) { this.y = H - SAND_H - this.size * 0.5; this.dy *= -1; }
  }
  computeFitness() {
    // Rich multi-objective fitness so selection has something to grip.
    if (this.team === 'prey') {
      return this.lifetime * 0.5 + this.energy * 0.6 - this.hunger * 0.5 +
        this.foodEaten * 30 + this.escapes * 18 +
        this.hiddenTime * 0.05 + this.schoolTime * 0.03 + this.distance * 0.015;
    }
    return this.lifetime * 0.4 + this.energy * 0.7 - this.hunger * 0.5 +
      this.catches * 130 + this.foodEaten * 10 + this.distance * 0.01;
  }
  nearest(list, filter) {
    let best = null, bd = Infinity;
    for (const o of list) {
      if (o === this || (filter && !filter(o))) continue;
      const d = dist2(this.x, this.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return { best, bd };
  }
  hiddenAt(x, y) { return hidingSpots.some(s => s.contains(x, y)); }
  getSensoryInputs() {
    const { best: nPlant, bd: plantD } = this.nearest(plants, () => true);
    const { best: nFood, bd: foodD } = this.nearest(foods, () => true);
    let nPred = null, predD = Infinity, nPrey = null, preyD = Infinity;
    for (const o of fish) {
      if (o === this || !(o instanceof SmartFish)) continue;
      const d = dist2(this.x, this.y, o.x, o.y);
      if (o.team === 'predator' && d < predD) { predD = d; nPred = o; }
      if (o.team === 'prey' && d < preyD) {
        if (this.team === 'predator' && this.hiddenAt(o.x, o.y)) continue; // can't see hidden prey
        preyD = d; nPrey = o;
      }
    }
    let mates = 0, foes = 0;
    for (const o of fish) {
      if (o === this || !(o instanceof SmartFish)) continue;
      if (dist2(this.x, this.y, o.x, o.y) < 100) o.team === this.team ? mates++ : foes++;
    }
    const minB = Math.min(this.x, W - this.x, this.y, (H - SAND_H) - this.y);
    const boundUrg = 1 - Math.min(minB / 60, 1);
    let predApproach = 0.5;
    if (nPred) {
      const dot = (nPred.dx || 0) * (this.x - nPred.x) + (nPred.dy || 0) * (this.y - nPred.y);
      const s = Math.hypot(nPred.dx, nPred.dy) * Math.max(predD, 1);
      if (s > 0.05) predApproach = clamp(dot / s + 0.5, 0, 1);
    }
    let preyEscape = 0.5;
    if (nPrey) {
      const dot = (nPrey.dx || 0) * (nPrey.x - this.x) + (nPrey.dy || 0) * (nPrey.y - this.y);
      const s = Math.hypot(nPrey.dx, nPrey.dy) * Math.max(preyD, 1);
      if (s > 0.05) preyEscape = clamp(dot / s + 0.5, 0, 1);
    }
    const mem = this.previousHidden.slice(0, 4).map(v => (v + 1) / 2);
    let nObs = null, obsD = Infinity;
    for (const r of rocks) { const d = dist2(this.x, this.y, r.x, r.y) - r.radius; if (d < obsD) { obsD = d; nObs = r; } }
    const inHide = this.hiddenAt(this.x, this.y) ? 1 : 0;
    const VR = this.visionRange(220); // evolvable vision
    const base = [
      this.hunger / this.maxHunger, this.energy / this.maxEnergy,
      nPlant ? 1 - Math.min(plantD / VR, 1) : (nFood ? 1 - Math.min(foodD / VR, 1) : 0),
      nPlant ? (Math.atan2(nPlant.y - this.y, nPlant.x - this.x) / Math.PI + 1) / 2 : 0.5,
      nPred ? 1 - Math.min(predD / VR, 1) : 0,
      nPred ? (Math.atan2(nPred.y - this.y, nPred.x - this.x) / Math.PI + 1) / 2 : 0.5,
      predApproach,
      nPrey ? 1 - Math.min(preyD / VR, 1) : 0,
      nPrey ? (Math.atan2(nPrey.y - this.y, nPrey.x - this.x) / Math.PI + 1) / 2 : 0.5,
      preyEscape,
      Math.min(mates / 5, 1), Math.min(foes / 5, 1),
      boundUrg,
      clamp((this.x - (W - this.x)) / W + 0.5, 0, 1),
      clamp((this.y - ((H - SAND_H) - this.y)) / (H - SAND_H) + 0.5, 0, 1),
      Math.atan2(this.dy, this.dx) / (Math.PI * 2) + 0.5,
      Math.min(Math.hypot(this.dx, this.dy) / 3, 1),
      this.team === 'predator' ? 1 : 0,
      ...mem,
      nObs ? 1 - Math.min(Math.max(obsD, 0) / 110, 1) : 0,
      nObs ? (Math.atan2(nObs.y - this.y, nObs.x - this.x) / Math.PI + 1) / 2 : 0.5,
      inHide,
    ];
    if (this.team === 'prey') {
      let adx = 0, ady = 0, n = 0, avx = 0, avy = 0;
      for (const o of fish) {
        if (o === this || !(o instanceof SmartFish) || o.team !== 'prey') continue;
        const d = dist2(this.x, this.y, o.x, o.y);
        if (d < 90) { n++; avx += o.dx; avy += o.dy; if (n === 1 || d < Math.hypot(adx, ady)) { adx = o.x - this.x; ady = o.y - this.y; } }
      }
      const al = Math.hypot(adx, ady) || 1;
      base.push((adx / al + 1) / 2, (ady / al + 1) / 2, Math.min(n / 5, 1), (clamp(avx / Math.max(n, 1), -2, 2) + 2) / 4);
    } else {
      let adx = 0, ady = 0, found = false, chasing = 0;
      for (const o of fish) {
        if (o === this || !(o instanceof SmartFish) || o.team !== 'predator') continue;
        const d = dist2(this.x, this.y, o.x, o.y);
        if (d < 110 && (!found || d < Math.hypot(adx, ady))) { adx = o.x - this.x; ady = o.y - this.y; found = true; }
      }
      if (nPrey) for (const o of fish) {
        if (o === this || o.team !== 'predator' || !(o instanceof SmartFish)) continue;
        if (dist2(o.x, o.y, nPrey.x, nPrey.y) < 150) { chasing = 1; break; }
      }
      const al = Math.hypot(adx, ady) || 1;
      base.push((adx / al + 1) / 2, (ady / al + 1) / 2, chasing);
    }
    return base;
  }
  recordExperience() {
    if (!this.lastInputs) return;
    this.experienceBuffer.push({ state: [...this.lastInputs], action: [...this.lastDecision], t: this.lifetime });
    if (this.experienceBuffer.length > this.maxExperiences) this.experienceBuffer.shift();
  }
  replayExperiences() {
    if (this.experienceBuffer.length < 10 || this.team !== 'prey') return;
    for (const e of this.experienceBuffer) {
      if (!e.done && this.lifetime - e.t > 180) {
        e.done = true;
        this.brain.learningRate = learningRates.preySurvival * 0.5;
        this.brain.train(e.state, e.action.map(v => Math.min(1, v * 1.08)));
      }
    }
  }
  applyDecision() {
    const [turn, speedC, , special] = this.lastDecision;
    if (this.team === 'prey') {
      const { best: np, bd } = this.nearest(fish, o => o instanceof SmartFish && o.team === 'predator');
      if (np && bd < this.reflexDistance) {
        const a = Math.atan2(this.y - np.y, this.x - np.x);
        this.dx = Math.cos(a) * 2.6; this.dy = Math.sin(a) * 2.6;
        this.x += this.dx; this.y += this.dy; return;
      }
    }
    const cur = Math.atan2(this.dy, this.dx);
    const na = cur + (turn - 0.5) * Math.PI * 0.5;
    let sp = (0.5 + speedC * 2.0) * this.genome.speed; // evolvable speed
    if (this.team === 'predator') sp *= getPredatorSpeedMultiplier();
    this.dx = Math.cos(na) * sp; this.dy = Math.sin(na) * sp;
    if (special > 0.7 && this.energy > 20) {
      this.dx *= 1.5; this.dy *= 1.5; this.energy -= 5;
    }
    this.x += this.dx; this.y += this.dy;
  }
  tryEat() {
    // food pellets first (prey favorite)
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (dist2(this.x, this.y, f.x, f.y) < this.size + 6) {
        foods.splice(i, 1);
        this.foodEaten++;
        this.hunger = Math.max(0, this.hunger - 30);
        this.energy = Math.min(this.maxEnergy, this.energy + 18);
        this.starvationTime = 0;
        spawnBurst(this.x, this.y, 'rgba(160,255,160,0.8)', 5);
        if (this.lastInputs) {
          this.brain.learningRate = learningRates.eatingReward;
          this.errorHistory.push(this.brain.train(this.lastInputs, [0.9, 0.9, 0.9, 0.9]));
          addToTrainingLog('fish ate food', 'eat');
        }
        return;
      }
    }
    if (this.team === 'predator') return;
    for (let i = plants.length - 1; i >= 0; i--) {
      const p = plants[i];
      if (dist2(this.x, this.y, p.x, p.y - p.h / 2) < this.size + 30 || dist2(this.x, this.y, p.x, this.y) < 60 && Math.abs(this.x - p.x) < 24 && this.y > p.y - p.h) {
        p.eat();
        this.foodEaten++;
        this.hunger = Math.max(0, this.hunger - 40);
        this.energy = Math.min(this.maxEnergy, this.energy + 25);
        this.starvationTime = 0;
        if (bubbles.length < MAX_BUBBLES) bubbles.push(new Bubble(this.x, this.y - 6));
        spawnBurst(this.x, this.y, 'rgba(140,255,170,0.7)', 4);
        if (this.lastInputs) {
          this.brain.learningRate = learningRates.eatingReward;
          this.errorHistory.push(this.brain.train(this.lastInputs, [0.9, 0.9, 0.9, 0.9]));
          if (this.errorHistory.length > 100) this.errorHistory.shift();
          addToTrainingLog('fish ate plant', 'eat');
        }
        return;
      }
    }
  }
  huntPrey() {
    for (let i = fish.length - 1; i >= 0; i--) {
      const prey = fish[i];
      if (prey === this || !(prey instanceof SmartFish) || prey.team !== 'prey') continue;
      if (this.hiddenAt(prey.x, prey.y)) continue;
      if (dist2(this.x, this.y, prey.x, prey.y) < this.size + prey.size * 0.8) {
        fish.splice(i, 1);
        deadPool.push({ brain: prey.brain.copy(), genome: new Genome('prey', prey.genome, prey.genome), fitness: prey.computeFitness(), team: 'prey', lineage: prey.lineage });
        if (deadPool.length > 40) deadPool.shift();
        if (selectedFish === prey) selectedFish = null;
        this.catches++;
        this.hunger = Math.max(0, this.hunger - 55);
        this.energy = Math.min(this.maxEnergy, this.energy + 40);
        this.starvationTime = 0;
        spawnBurst(prey.x, prey.y, 'rgba(255,120,120,0.85)', 10);
        if (this.lastInputs) {
          this.brain.learningRate = learningRates.predatorHunting * 2;
          this.errorHistory.push(this.brain.train(this.lastInputs, [this.lastDecision[0], 0.9, 0.2, 0.8]));
          addToTrainingLog('predator caught prey', 'catch');
        }
        return;
      }
    }
    // steer-training only on decision ticks (not every frame)
    if (this.lastInputs && this.lifetime % 10 === 0) {
      const range = this.visionRange(getPredatorDetectionRange());
      const { best: np, bd } = this.nearest(fish, o => o instanceof SmartFish && o.team === 'prey' && !this.hiddenAt(o.x, o.y));
      if (np && bd < range) {
        const chase = Math.atan2(np.y - this.y, np.x - this.x);
        let d = chase - Math.atan2(this.dy, this.dx);
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        const opp = 1 - bd / range;
        this.brain.learningRate = learningRates.predatorHunting * (0.5 + opp);
        this.errorHistory.push(this.brain.train(this.lastInputs, [clamp(d / (Math.PI * 0.5) * 0.5 + 0.5, 0, 1), 0.8 + opp * 0.2, 0.1, bd < 60 ? 0.9 : 0.2]));
        if (this.errorHistory.length > 100) this.errorHistory.shift();
      }
    }
  }
  fleeLearn() {
    if (!this.lastInputs || this.lifetime % 10 !== 0) return;
    const { best: np, bd } = this.nearest(fish, o => o instanceof SmartFish && o.team === 'predator');
    if (np && bd < 160) {
      const flee = Math.atan2(this.y - np.y, this.x - np.x);
      let d = flee - Math.atan2(this.dy, this.dx);
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const urg = 1 - bd / 160;
      this.brain.learningRate = learningRates.negativeReward * (1 + urg);
      this.errorHistory.push(this.brain.train(this.lastInputs,
        [clamp(d / (Math.PI * 0.5) * 0.5 + 0.5, 0, 1), 0.9, 0.1, bd < 80 ? 0.9 : 0.3]));
      if (this.errorHistory.length > 100) this.errorHistory.shift();
    }
  }
  grazeLearn() {
    if (!this.lastInputs || this.lifetime % 60 !== 0) return;
    if (this.hunger < 40) { // reward calm grazing when full
      this.brain.learningRate = learningRates.preySurvival * 0.4;
      this.brain.train(this.lastInputs, this.lastDecision.map(v => clamp(v, 0.3, 0.7)));
    }
  }
  die(starved = false) {
    deadPool.push({ brain: this.brain.copy(), genome: new Genome(this.team, this.genome, this.genome), fitness: this.computeFitness(), team: this.team, lineage: this.lineage });
    if (deadPool.length > 40) deadPool.shift();
    const i = fish.indexOf(this);
    if (i > -1) fish.splice(i, 1);
    if (selectedFish === this) selectedFish = null;
    spawnBurst(this.x, this.y, 'rgba(180,200,220,0.7)', 6);
    if (starved) addToTrainingLog(`${this.team} starved`, 'death');
  }
  draw(t) {
    const flip = this.dx < 0;
    ctx.save(); ctx.translate(this.x, this.y); if (flip) ctx.scale(-1, 1);
    const s = this.size;
    const wag = Math.sin(this.wiggle) * (0.25 + Math.min(Math.hypot(this.dx, this.dy) / 3, 1) * 0.35);
    const isPred = this.team === 'predator';
    const bodyG = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.7);
    if (isPred) { bodyG.addColorStop(0, '#8d9bab'); bodyG.addColorStop(0.5, '#5a6b7d'); bodyG.addColorStop(1, '#33404e'); }
    else { bodyG.addColorStop(0, '#aee3ff'); bodyG.addColorStop(0.5, `hsl(${this.hue},80%,58%)`); bodyG.addColorStop(1, `hsl(${this.hue},70%,32%)`); }
    // tail
    ctx.save(); ctx.translate(-s * 0.9, 0); ctx.rotate(wag);
    ctx.fillStyle = isPred ? '#3d4c5e' : `hsl(${this.hue},75%,45%)`;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.8, -s * 0.55); ctx.lineTo(-s * 0.8, s * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();
    // dorsal fin
    ctx.fillStyle = isPred ? '#2c3846' : `hsl(${this.hue},70%,38%)`;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.55); ctx.lineTo(s * 0.15, -s * 1.0); ctx.lineTo(s * 0.35, -s * 0.5); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = bodyG;
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    if (!isPred) { // stripes
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = -1; k <= 1; k++) ctx.fillRect(k * s * 0.45 + Math.sin(this.stripeSeed) * 3, -s, 3.5, s * 2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    } else { // gills + teeth
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s * 0.25, 0, s * 0.3, -1, 1); ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.moveTo(s * 0.55, s * 0.28); ctx.lineTo(s * 0.65, s * 0.42); ctx.lineTo(s * 0.75, s * 0.28); ctx.closePath(); ctx.fill();
    }
    // pectoral fin
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.save(); ctx.translate(s * 0.05, s * 0.35); ctx.rotate(0.5 + wag * 0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.32, s * 0.14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // eye (front of fish = +x before flip)
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.15, s * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#101418'; ctx.beginPath(); ctx.arc(s * 0.6, -s * 0.15, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(s * 0.63, -s * 0.18, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 👑 champion crown + elite glow + selection ring (evolution visibility)
    if (champion.prey === this || champion.predator === this) {
      ctx.save(); ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('👑', this.x, this.y - this.size - 12 + Math.sin(gameTime / 20) * 2);
      ctx.strokeStyle = 'rgba(255,215,0,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (this.isElite) {
      ctx.save(); ctx.strokeStyle = 'rgba(0,210,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (selectedFish === this) {
      ctx.save(); ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 9, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (showNeuralNetwork) this.drawMiniBrain();
  }
  drawMiniBrain() {
    const sx = this.x + 26, sy = this.y - 46;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx - 6, sy - 8, 74, 62);
    for (let i = 0; i < 4; i++) {
      const v = this.lastDecision[i] || 0;
      ctx.fillStyle = `rgb(100,${Math.floor(120 + v * 135)},255)`;
      ctx.beginPath(); ctx.arc(sx + 12 + i * 15, sy + 40, 5, 0, Math.PI * 2); ctx.fill();
    }
    const ha = this.hiddenActivations;
    for (let i = 0; i < 6; i++) {
      const v = (ha[i * 2] + 1) / 2;
      ctx.fillStyle = `rgb(${Math.floor(v * 255)},140,140)`;
      ctx.beginPath(); ctx.arc(sx + 5 + i * 11, sy + 12, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'white'; ctx.font = '9px monospace';
    ctx.fillText(this.team === 'prey' ? 'PREY' : 'PRED', sx - 2, sy);
    ctx.restore();
  }
}

// ---------- Environment setup ----------
function initEnvironment() {
  rocks = []; currents = []; hidingSpots = [];
  for (let i = 0; i < 4; i++) rocks.push(new Rock(rand(80, W - 80), rand(H - 220, H - SAND_H - 30), rand(26, 52)));
  currents.push(new Current(180, 120, 380, 90, 0.5, 0));
  currents.push(new Current(650, 420, 380, 90, -0.5, 0));
  for (let i = 0; i < 3; i++) hidingSpots.push(new HidingSpot(rand(150, W - 150), rand(200, H - 200), 62));
  plankton = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * (H - SAND_H), s: rand(0.6, 2), vx: rand(-0.12, 0.12), vy: rand(-0.08, 0.08) }));
}
function seedPlants(n = 8) {
  for (let i = 0; i < n && plants.length < MAX_PLANTS; i++)
    plants.push(new Plant(rand(40, W - 40)));
}

// ---------- Rounds / evolution (kept) ----------
function startAdversarialTraining() {
  currentRound = 0; roundTime = 0; predatorScore = 0; preyScore = 0;
  roundActive = true; roundWinner = null; fish = []; foods = []; deadPool = []; selectedFish = null;
  for (let i = 0; i < 6; i++) fish.push(new SmartFish(rand(60, W * 0.35), rand(80, H - 160), 'prey'));
  for (let i = 0; i < 3; i++) fish.push(new SmartFish(rand(W * 0.65, W - 60), rand(80, H - 160), 'predator'));
  initialPreyCount = fish.filter(f => f.team === 'prey').length;
  initialPredatorCount = fish.filter(f => f.team === 'predator').length;
  refreshChampions();
  addToTrainingLog(`Round 1 — Prey ${initialPreyCount} vs Predators ${initialPredatorCount} (Gen ${generation}, difficulty ${difficultyLevel})`, 'round');
}
function updateAdversarialRound() {
  if (!roundActive) return;
  roundTime++;
  const prey = fish.filter(f => f.team === 'prey').length;
  const pred = fish.filter(f => f.team === 'predator').length;
  if (prey === 0) { roundWinner = 'predators'; predatorScore++; return endRound(); }
  if (pred === 0 && prey > 0) { roundWinner = 'prey'; preyScore++; return endRound(); }
  if (roundTime >= roundDuration) {
    roundWinner = prey > 0 ? 'prey' : 'predators';
    prey > 0 ? preyScore++ : predatorScore++;
    return endRound();
  }
}
function candidatePool(team) {
  // survivors AND the fallen — good genes shouldn't vanish because their body died
  const alive = fish.filter(f => f.team === team).map(f => ({
    brain: f.brain, genome: f.genome, fitness: f.computeFitness(), lineage: f.lineage, aliveRef: f,
  }));
  const dead = deadPool.filter(d => d.team === team).map(d => ({ ...d, aliveRef: null }));
  return [...alive, ...dead].sort((a, b) => b.fitness - a.fitness);
}
function tournamentSelect(pool, k) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (c && (!best || c.fitness > best.fitness)) best = c;
  }
  return best || pool[0];
}
function genomeDiversity(team) {
  const members = fish.filter(f => f.team === team);
  if (members.length < 2) return 0;
  let sum = 0, n = 0;
  for (let i = 0; i < Math.min(members.length, 6); i++)
    for (let j = i + 1; j < Math.min(members.length, 6); j++) {
      sum += members[i].genome.distance(members[j].genome); n++;
    }
  return n ? sum / n : 0;
}
function avgTrait(team, key) {
  const m = fish.filter(f => f.team === team);
  if (!m.length) return 0;
  return m.reduce((s, f) => s + f.genome[key], 0) / m.length;
}
function adaptMutationRate(team, best) {
  const prev = lastBest[team];
  const improved = prev > 0 ? (best - prev) / prev : 1;
  if (best <= prev * 1.005) {
    stagnation[team]++;
    if (stagnation[team] >= 2) {
      evoParams.mutationRate = Math.min(0.3, evoParams.mutationRate * 1.35);
      stagnation[team] = 0;
      addToTrainingLog(`🧬 ${team} stagnated — mutation boosted to ${evoParams.mutationRate.toFixed(3)}`, 'evo');
      syncEvoUI();
    }
  } else {
    stagnation[team] = 0;
    if (improved > 0.08) {
      evoParams.mutationRate = Math.max(0.03, evoParams.mutationRate * 0.88);
      syncEvoUI();
    }
  }
  lastBest[team] = best;
}
function saveHallOfFame(team, entry) {
  try {
    localStorage.setItem(`aquarium-halloffame-${team}-v4`, JSON.stringify({
      fitness: entry.fitness, lineage: entry.lineage, gen: generation,
      genome: entry.genome,
      brain: { inputSize: entry.brain.inputSize, hiddenSize: entry.brain.hiddenSize, outputSize: entry.brain.outputSize, weightsIH: entry.brain.weightsIH, weightsHO: entry.brain.weightsHO, biasH: entry.brain.biasH, biasO: entry.brain.biasO },
    }));
  } catch { /* ignore */ }
}
function endRound() {
  roundActive = false;
  const preyPool = candidatePool('prey');
  const predPool = candidatePool('predator');
  const preyAvg = preyPool.length ? preyPool.reduce((s, c) => s + c.fitness, 0) / preyPool.length : 0;
  const predAvg = predPool.length ? predPool.reduce((s, c) => s + c.fitness, 0) / predPool.length : 0;
  topPreySurvivors = preyPool.slice(0, 3).map(c => ({ brain: c.brain.copy(), genome: new Genome('prey', c.genome, c.genome), fitness: c.fitness, lineage: c.lineage }));
  topPredatorSurvivors = predPool.slice(0, 3).map(c => ({ brain: c.brain.copy(), genome: new Genome('predator', c.genome, c.genome), fitness: c.fitness, lineage: c.lineage }));
  const bestPrey = topPreySurvivors[0]?.fitness || 0;
  const bestPred = topPredatorSurvivors[0]?.fitness || 0;
  diversity.prey = genomeDiversity('prey'); diversity.predator = genomeDiversity('predator');
  adaptMutationRate('prey', bestPrey); adaptMutationRate('predator', bestPred);
  if (bestPrey > bestEver.prey) {
    bestEver.prey = bestPrey;
    if (topPreySurvivors[0]) saveHallOfFame('prey', topPreySurvivors[0]);
    addToTrainingLog(`🏆 New all-time prey champion: ${bestPrey.toFixed(0)} fitness!`, 'evo');
  }
  if (bestPred > bestEver.predator) {
    bestEver.predator = bestPred;
    if (topPredatorSurvivors[0]) saveHallOfFame('predator', topPredatorSurvivors[0]);
    addToTrainingLog(`🏆 New all-time predator champion: ${bestPred.toFixed(0)} fitness!`, 'evo');
  }
  if (topPreySurvivors[0]) topPreyFitness = Math.max(topPreyFitness, bestPrey);
  if (topPredatorSurvivors[0]) topPredatorFitness = Math.max(topPredatorFitness, bestPred);
  generationHistory.push({
    gen: generation, preyFitness: bestPrey, predatorFitness: bestPred,
    preyAvg, predAvg,
    preySurvivors: fish.filter(f => f.team === 'prey').length,
    predatorSurvivors: fish.filter(f => f.team === 'predator').length,
  });
  if (generationHistory.length > 30) generationHistory.shift();
  traitHistory.push({
    gen: generation,
    preySpeed: avgTrait('prey', 'speed'), preySize: avgTrait('prey', 'size'), preyVision: avgTrait('prey', 'vision'),
    predSpeed: avgTrait('predator', 'speed'), predSize: avgTrait('predator', 'size'), predVision: avgTrait('predator', 'vision'),
  });
  if (traitHistory.length > 30) traitHistory.shift();
  if (roundWinner === 'prey') {
    preyWinStreak++; predatorWinStreak = 0;
    if (preyWinStreak >= 3 && difficultyLevel < 10) { difficultyLevel++; preyWinStreak = 0; addToTrainingLog(`Difficulty increased to ${difficultyLevel}`, 'diff'); }
  } else {
    predatorWinStreak++; preyWinStreak = 0;
    if (predatorWinStreak >= 3 && difficultyLevel > 1) { difficultyLevel--; predatorWinStreak = 0; addToTrainingLog(`Difficulty decreased to ${difficultyLevel}`, 'diff'); }
  }
  showBanner(`${roundWinner === 'prey' ? '🐟 PREY SURVIVE' : '🦈 PREDATORS WIN'} — Gen ${generation} next…`);
  addToTrainingLog(`Round ${currentRound + 1} complete: ${roundWinner} wins (P ${predatorScore} – ${preyScore} p)`, 'round');
  setTimeout(() => { if (!paused) startNextRound(); else pendingRound = true; }, 2500);
}
let pendingRound = false;
function breed(team, count, survivors, xRange) {
  if (!survivors.length) {
    for (let i = 0; i < count; i++) fish.push(new SmartFish(rand(...xRange), rand(80, H - 180), team));
    return;
  }
  // Elitism: exact clone of the best — the bloodline never regresses
  if (evoParams.elitism) {
    const champ = survivors[0];
    const elite = new SmartFish(rand(...xRange), rand(80, H - 180), team,
      champ.brain, new Genome(team, champ.genome, champ.genome), `G${generation + 1}·elite←${(champ.lineage || '').slice(0, 16)}`);
    elite.isElite = true;
    fish.push(elite);
  }
  while (fish.filter(f => f.team === team).length < count) {
    const p1 = tournamentSelect(survivors, evoParams.tournamentK);
    const p2 = tournamentSelect(survivors, evoParams.tournamentK);
    const brain = (p1 && p2 && p1 !== p2) ? p1.brain.crossover(p2.brain) : (p1 || survivors[0]).brain.copy();
    brain.mutate(evoParams.mutationRate);
    const genome = new Genome(team, p1?.genome || null, p2?.genome || null);
    genome.mutate(evoParams.mutationRate * 1.2);
    const kid = new SmartFish(rand(...xRange), rand(80, H - 180), team, brain, genome,
      `G${generation + 1}·${(p1?.lineage || '?').slice(0, 8)}×${(p2?.lineage || '?').slice(0, 8)}`);
    fish.push(kid);
  }
}
function startNextRound() {
  currentRound++; roundTime = 0; roundActive = true; roundWinner = null;
  generation++;
  fish = []; deadPool = []; selectedFish = null;
  breed('prey', 6, topPreySurvivors, [60, W * 0.35]);
  breed('predator', 3, topPredatorSurvivors, [W * 0.65, W - 60]);
  initialPreyCount = 6; initialPredatorCount = 3;
  refreshChampions();
  if (topPreySurvivors[0]) topPreySurvivors[0].brain.save(BRAIN_KEY('prey'));
  if (topPredatorSurvivors[0]) topPredatorSurvivors[0].brain.save(BRAIN_KEY('predator'));
  const th = traitHistory[traitHistory.length - 1];
  const traitNote = th ? ` · prey spd ${th.preySpeed.toFixed(2)} vis ${th.preyVision.toFixed(2)} · pred spd ${th.predSpeed.toFixed(2)}` : '';
  addToTrainingLog(`Generation ${generation} — Round ${currentRound + 1} begins (mut ${evoParams.mutationRate.toFixed(3)})${traitNote}`, 'evo');
}
let bannerTimeout = null;
function showBanner(text) {
  const b = document.getElementById('round-banner');
  if (!b) return;
  b.textContent = text; b.classList.remove('hidden'); b.style.opacity = '1';
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => { b.style.opacity = '0'; setTimeout(() => b.classList.add('hidden'), 400); }, 2300);
}

// ---------- Ecosystem ----------
function updateEcosystem() {
  seasonTimer++;
  if (seasonTimer >= SEASON_DURATION) {
    seasonTimer = 0;
    season = { spring: 'summer', summer: 'fall', fall: 'winter', winter: 'spring' }[season];
    addToTrainingLog(`Season changed to ${season}`, 'season');
  }
  const rate = { spring: 300, summer: 200, fall: 500, winter: 1100 }[season];
  if (gameTime % rate === 0 && plants.length < MAX_PLANTS) plants.push(new Plant(rand(40, W - 40)));
  const density = (plants.length / MAX_PLANTS) * 100;
  foodScarcity = 100 - density;
  ecosystemHealth = clamp(60 + density * 0.4 - Math.max(0, fish.length - 12) * 2, 5, 100);
  if (gameTime % 300 === 0) {
    populationHistory.push({
      time: gameTime,
      preyCount: fish.filter(f => f.team === 'prey').length,
      predatorCount: fish.filter(f => f.team === 'predator').length,
      plantCount: plants.length,
    });
    if (populationHistory.length > 50) populationHistory.shift();
  }
}

// ---------- Background rendering ----------
function drawBackground(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const seasonal = season === 'winter' ? [8, 60, 95] : season === 'summer' ? [20, 120, 170] : [12, 95, 145];
  g.addColorStop(0, `rgb(${seasonal[0] + 30},${seasonal[1] + 60},${seasonal[2] + 60})`);
  g.addColorStop(0.55, `rgb(${seasonal[0]},${seasonal[1]},${seasonal[2]})`);
  g.addColorStop(1, '#03141f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // light rays
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const bx = 180 + i * 300 + Math.sin(t / 300 + i * 2) * 30;
    const grad = ctx.createLinearGradient(bx, 0, bx + 120, H);
    grad.addColorStop(0, 'rgba(180,230,255,0.13)'); grad.addColorStop(1, 'rgba(180,230,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 70, 0); ctx.lineTo(bx + 190, H); ctx.lineTo(bx + 90, H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // plankton
  ctx.save(); ctx.fillStyle = 'rgba(200,230,255,0.4)';
  for (const p of plankton) ctx.fillRect(p.x, p.y, p.s, p.s);
  ctx.restore();
  // sand
  const sg = ctx.createLinearGradient(0, H - SAND_H, 0, H);
  sg.addColorStop(0, '#c2a06e'); sg.addColorStop(1, '#6e5836');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(0, H - SAND_H + 8);
  for (let x = 0; x <= W; x += 64) ctx.lineTo(x, H - SAND_H + 8 + Math.sin(x / 120 + 2) * 5);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 24; i++) {
    const px = (i * 173) % W, py = H - SAND_H + 14 + (i * 37) % 44;
    ctx.beginPath(); ctx.ellipse(px, py, 5 + (i % 4), 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- Analytics ----------
function updateAnalyticsUI() {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('stat-gen', generation);
  set('stat-ecosystem', `${Math.round(ecosystemHealth)}%`);
  set('stat-scarcity', `${Math.round(foodScarcity)}%`);
  set('hud-prey', fish.filter(f => f.team === 'prey').length);
  set('hud-pred', fish.filter(f => f.team === 'predator').length);
  set('hud-round', currentRound + 1);
  set('hud-gen', generation);
  set('hud-diff', `${difficultyLevel}/10`);
  set('hud-season', season);
  const fill = document.getElementById('round-timer-fill');
  if (fill) fill.style.width = `${clamp(roundTime / roundDuration * 100, 0, 100)}%`;
  set('hud-best', bestEver.prey > 0 || bestEver.predator > 0 ? `${Math.max(bestEver.prey, bestEver.predator).toFixed(0)}` : '—');
  set('stat-best-prey', `${topPreyFitness.toFixed(0)}`);
  set('stat-best-pred', `${topPredatorFitness.toFixed(0)}`);
  set('stat-diversity', `${diversity.prey.toFixed(2)} / ${diversity.predator.toFixed(2)}`);
  set('stat-mut', evoParams.mutationRate.toFixed(3));
  set('evo-status', `Gen ${generation} · best ${Math.max(topPreyFitness, topPredatorFitness).toFixed(0)} · all-time ${Math.max(bestEver.prey, bestEver.predator).toFixed(0)} · mut ${evoParams.mutationRate.toFixed(3)} · div ${diversity.prey.toFixed(2)}/${diversity.predator.toFixed(2)}`);
  const spd = document.getElementById('speed-btn'); if (spd) spd.textContent = `⏩ ${simSpeed}×`;
  if (showAnalytics) { drawFitnessGraph(); drawPopulationGraph(); drawTraitGraph(); }
}
function drawFitnessGraph() {
  const c = document.getElementById('fitness-graph'); if (!c) return;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  if (generationHistory.length < 2) {
    g.fillStyle = '#888'; g.font = '12px sans-serif'; g.textAlign = 'center';
    g.fillText('Waiting for next generation…', c.width / 2, c.height / 2); return;
  }
  const max = Math.max(...generationHistory.map(d => Math.max(d.preyFitness, d.predatorFitness, 1)));
  const X = i => 24 + (i / (generationHistory.length - 1)) * (c.width - 40);
  const Y = v => c.height - 20 - (v / max) * (c.height - 44);
  g.strokeStyle = '#64a9ff'; g.lineWidth = 2; g.beginPath();
  generationHistory.forEach((d, i) => i ? g.lineTo(X(i), Y(d.preyFitness)) : g.moveTo(X(i), Y(d.preyFitness)));
  g.stroke();
  g.strokeStyle = '#ff7a7a'; g.beginPath();
  generationHistory.forEach((d, i) => i ? g.lineTo(X(i), Y(d.predatorFitness)) : g.moveTo(X(i), Y(d.predatorFitness)));
  g.stroke();
}
function drawPopulationGraph() {
  const c = document.getElementById('population-graph'); if (!c) return;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  if (populationHistory.length < 2) {
    g.fillStyle = '#888'; g.font = '12px sans-serif'; g.textAlign = 'center';
    g.fillText('Collecting population data…', c.width / 2, c.height / 2); return;
  }
  const max = 20;
  const X = i => 24 + (i / (populationHistory.length - 1)) * (c.width - 40);
  const Y = v => c.height - 20 - (v / max) * (c.height - 44);
  const area = (key, col) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(X(0), Y(0));
    populationHistory.forEach((d, i) => g.lineTo(X(i), Y(d[key])));
    g.lineTo(X(populationHistory.length - 1), Y(0)); g.fill();
  };
  area('preyCount', 'rgba(100,169,255,0.3)');
  area('predatorCount', 'rgba(255,122,122,0.3)');
  g.strokeStyle = '#7bff9e'; g.lineWidth = 1.5; g.beginPath();
  populationHistory.forEach((d, i) => i ? g.lineTo(X(i), Y(d.plantCount)) : g.moveTo(X(i), Y(d.plantCount)));
  g.stroke();
}
function drawTraitGraph() {
  const c = document.getElementById('trait-graph'); if (!c) return;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  if (traitHistory.length < 2) {
    g.fillStyle = '#888'; g.font = '12px sans-serif'; g.textAlign = 'center';
    g.fillText('Traits evolve over generations…', c.width / 2, c.height / 2); return;
  }
  const series = [
    { key: 'preySpeed', col: '#64a9ff' }, { key: 'preyVision', col: '#7bff9e' },
    { key: 'predSpeed', col: '#ff7a7a' }, { key: 'predVision', col: '#ffb74d' },
  ];
  const lo = 0.7, hi = 1.5;
  const X = i => 24 + (i / (traitHistory.length - 1)) * (c.width - 40);
  const Y = v => c.height - 20 - ((v - lo) / (hi - lo)) * (c.height - 44);
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath();
  g.moveTo(24, Y(1)); g.lineTo(c.width - 16, Y(1)); g.stroke();
  for (const s of series) {
    g.strokeStyle = s.col; g.lineWidth = 2; g.beginPath();
    traitHistory.forEach((d, i) => i ? g.lineTo(X(i), Y(d[s.key])) : g.moveTo(X(i), Y(d[s.key])));
    g.stroke();
  }
}
function syncEvoUI() {
  const s = document.getElementById('evo-mutation-rate');
  const v = document.getElementById('evo-mutation-value');
  if (s) s.value = evoParams.mutationRate.toFixed(3);
  if (v) v.textContent = evoParams.mutationRate.toFixed(3);
  updateAnalyticsUI();
}
function forceEvolve() {
  if (!roundActive) { startNextRound(); return; }
  if (roundWinner) return;
  roundWinner = fish.filter(f => f.team === 'prey').length > 0 ? 'prey' : 'predators';
  roundWinner === 'prey' ? preyScore++ : predatorScore++;
  addToTrainingLog(`⚡ Forced evolution — jumping to generation ${generation + 1}`, 'evo');
  endRound();
}
function loadHallOfFame() {
  for (const team of ['prey', 'predator']) {
    try {
      const d = JSON.parse(localStorage.getItem(`aquarium-halloffame-${team}-v4`));
      if (d && d.fitness > bestEver[team]) bestEver[team] = d.fitness;
    } catch { /* ignore */ }
  }
}
// --- Fish inspector: click a fish to see its genome + fitness breakdown ---
function drawInspectorLink() {
  if (!selectedFish) return;
  ctx.save(); ctx.strokeStyle = 'rgba(0,255,136,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(selectedFish.x, selectedFish.y - selectedFish.size - 10, selectedFish.x, 8); ctx.stroke(); ctx.restore();
}
function updateInspector() {
  const card = document.getElementById('fish-inspector');
  if (!card) return;
  if (!selectedFish) { card.classList.add('hidden'); return; }
  const f = selectedFish;
  card.classList.remove('hidden');
  const set = (id, v) => { const e = card.querySelector(`[data-f="${id}"]`); if (e) e.textContent = v; };
  set('team', f.team === 'prey' ? '🐟 Prey' : '🦈 Predator');
  set('fit', f.computeFitness().toFixed(0));
  set('gen', `G${f.generation} · ${f.lineage}`);
  set('stats', `age ${f.lifetime} · food ${f.foodEaten} · ${f.team === 'prey' ? `escapes ${f.escapes} · hidden ${Math.floor(f.hiddenTime / 60)}s` : `catches ${f.catches}`}`);
  set('genome', `spd ${f.genome.speed.toFixed(2)} · size ${f.genome.size.toFixed(2)} · vis ${f.genome.vision.toFixed(2)} · met ${f.genome.metabolism.toFixed(2)}${f.team === 'prey' ? ` · hue ${Math.round(f.genome.hue)}` : ''}`);
  set('elite', f.isElite ? '⭐ elite bloodline' : (champion.prey === f || champion.predator === f ? '👑 current champion' : ''));
}
function drawDebugWeights() {
  const smart = fish.filter(f => f instanceof SmartFish);
  if (!smart.length) return;
  const prey = smart.find(f => f.team === 'prey');
  const pred = smart.find(f => f.team === 'predator');
  const panels = [[prey, 'PREY BRAIN', '#64a9ff'], [pred, 'PREDATOR BRAIN', '#ff7a7a']].filter(p => p[0]);
  panels.forEach(([f, title, color], idx) => {
    const x = 12 + idx * 300, y = 12, w = 288, h = 150;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color; ctx.font = 'bold 11px monospace'; ctx.fillText(title, x + 8, y + 16);
    // deterministic weight heatmap (no Math.random flicker — the old bug)
    const flat = [...f.brain.weightsIH.flat(), ...f.brain.weightsHO.flat()];
    const cell = 7;
    flat.slice(0, 300).forEach((wt, i) => {
      const cx = x + 8 + (i % 38) * cell, cy = y + 26 + Math.floor(i / 38) * cell;
      const v = clamp(Math.abs(wt) / 2, 0, 1);
      ctx.fillStyle = wt > 0 ? `rgba(110,255,150,${0.15 + v * 0.85})` : `rgba(255,130,130,${0.15 + v * 0.85})`;
      ctx.fillRect(cx, cy, cell - 1, cell - 1);
    });
    const err = f.errorHistory[f.errorHistory.length - 1];
    ctx.fillStyle = 'white'; ctx.font = '10px monospace';
    ctx.fillText(`fit ${f.fitness.toFixed(0)} · err ${err !== undefined ? err.toFixed(4) : '—'}`, x + 8, y + h - 8);
    ctx.restore();
  });
}

// ---------- Main loop ----------
let lastFrame = performance.now(), fps = 60;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrame) / 16.7, 3); lastFrame = now;
  fps = fps * 0.95 + (1000 / Math.max(now - (animate._p || now - 16), 1)) * 0.05;
  animate._p = now;
  if (paused) return;
  const steps = Math.min(Math.round(dt * simSpeed), 4 * simSpeed);
  for (let s = 0; s < steps; s++) {
    gameTime++;
    updateEcosystem();
    updateAdversarialRound();
    for (const p of plankton) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; }
    currents.forEach(c => c.update());
    plants.forEach(p => p.update());
    bubbles.forEach(b => b.update());
    for (let i = foods.length - 1; i >= 0; i--) if (!foods[i].update()) foods.splice(i, 1);
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0) bursts.splice(i, 1);
    }
    [...fish].forEach(f => f.update());
    if (fish.filter(f => f.team === 'prey').length === 0 && fish.filter(f => f.team === 'predator').length === 0 && roundActive) {
      roundWinner = 'prey'; preyScore++; endRound();
    }
  }
  drawBackground(gameTime);
  hidingSpots.forEach(s => s.draw(gameTime));
  currents.forEach(c => c.draw());
  plants.forEach(p => p.draw(gameTime));
  rocks.forEach(r => r.draw());
  foods.forEach(f => f.draw());
  bubbles.forEach(b => b.draw());
  [...fish].sort((a, b) => a.size - b.size).forEach(f => f.draw(gameTime));
  bursts.forEach(b => {
    ctx.save(); ctx.globalAlpha = clamp(b.life / 30, 0, 1); ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });
  if (showDebugWeights) drawDebugWeights();
  if (gameTime % 30 === 0) refreshChampions();
  if (selectedFish && !fish.includes(selectedFish)) selectedFish = null;
  drawInspectorLink();
  if (gameTime % 15 === 0) {
    updateAnalyticsUI();
    updateInspector();
    const fe = document.getElementById('hud-fps'); if (fe) fe.textContent = Math.round(clamp(fps, 0, 120));
  }
}

// ---------- UI ----------
function addFish(team) {
  if (fish.length >= MAX_FISH) { addToTrainingLog('Tank full — remove fish by letting nature run', 'info'); return; }
  team = team || (Math.random() > 0.68 ? 'predator' : 'prey');
  const f = new SmartFish(rand(80, W - 80), rand(80, H - 200), team);
  if (team === 'predator') f.size = 24;
  fish.push(f);
  addToTrainingLog(`Added ${team} fish`, 'info');
}
function dropFood(x, y) {
  for (let i = 0; i < 6 && foods.length < MAX_FOOD; i++)
    foods.push(new Food((x ?? rand(100, W - 100)) + rand(-24, 24), (y ?? 120) + rand(-10, 10)));
}
function resetEverything() {
  try { localStorage.clear(); } catch { /* ignore */ }
  fish = []; bubbles = []; plants = []; foods = []; bursts = []; deadPool = [];
  trainingLog = []; generationHistory = []; populationHistory = []; traitHistory = [];
  currentRound = 0; predatorScore = 0; preyScore = 0; generation = 1;
  topPreySurvivors = []; topPredatorSurvivors = []; topPreyFitness = 0; topPredatorFitness = 0;
  bestEver = { prey: 0, predator: 0 }; lastBest = { prey: 0, predator: 0 };
  stagnation = { prey: 0, predator: 0 }; diversity = { prey: 1, predator: 1 };
  evoParams.mutationRate = 0.08; simSpeed = 1; selectedFish = null;
  difficultyLevel = 1; preyWinStreak = 0; predatorWinStreak = 0;
  ecosystemHealth = 100; foodScarcity = 0; season = 'spring'; seasonTimer = 0; gameTime = 0;
  syncEvoUI();
  initEnvironment(); seedPlants(8);
  for (let i = 0; i < 12; i++) bubbles.push(new Bubble(Math.random() * W, Math.random() * H));
  updateTrainingLogDisplay();
  startAdversarialTraining();
  addToTrainingLog('Everything reset — fresh ecosystem', 'evo');
}

function setupUI() {
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
  on('add-fish', () => addFish());
  on('add-prey', () => addFish('prey'));
  on('add-predator', () => addFish('predator'));
  on('add-food', () => { dropFood(); addToTrainingLog('Dropped food', 'eat'); });
  on('add-bubble', () => { for (let i = 0; i < 5 && bubbles.length < MAX_BUBBLES; i++) bubbles.push(new Bubble(Math.random() * W, H - 60)); });
  const pauseBtn = document.getElementById('pause-btn');
  const togglePause = () => {
    paused = !paused;
    if (pauseBtn) { pauseBtn.textContent = paused ? '▶️ Resume' : '⏸️ Pause'; pauseBtn.classList.toggle('paused', paused); }
    if (!paused && pendingRound) { pendingRound = false; startNextRound(); }
  };
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
  setupUI.togglePause = togglePause;
  on('clear-log', () => { trainingLog = []; updateTrainingLogDisplay(); });

  const slider = (id, valId, key) => {
    const s = document.getElementById(id), v = document.getElementById(valId);
    if (s) s.addEventListener('input', e => {
      learningRates[key] = parseFloat(e.target.value);
      if (v) v.textContent = learningRates[key].toFixed(2);
    });
  };
  slider('eating-reward-rate', 'eating-rate-value', 'eatingReward');
  slider('positive-reward-rate', 'positive-rate-value', 'positiveReward');
  slider('negative-reward-rate', 'negative-rate-value', 'negativeReward');
  slider('prey-survival-rate', 'prey-rate-value', 'preySurvival');
  slider('predator-hunting-rate', 'predator-rate-value', 'predatorHunting');

  on('evolve-now', forceEvolve);
  const speedBtn = document.getElementById('speed-btn');
  const cycleSpeed = () => {
    simSpeed = simSpeed >= 4 ? 1 : simSpeed * 2;
    addToTrainingLog(`Simulation speed ${simSpeed}×`, 'info');
    updateAnalyticsUI();
  };
  if (speedBtn) speedBtn.addEventListener('click', cycleSpeed);
  setupUI.cycleSpeed = cycleSpeed;
  const mutSlider = document.getElementById('evo-mutation-rate');
  if (mutSlider) mutSlider.addEventListener('input', e => {
    evoParams.mutationRate = clamp(parseFloat(e.target.value) || 0.08, 0.01, 0.3);
    const v = document.getElementById('evo-mutation-value');
    if (v) v.textContent = evoParams.mutationRate.toFixed(3);
  });

  // click a fish to inspect it, otherwise drop food
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    const y = (e.clientY - r.top) / r.height * H;
    let hit = null, hd = 26;
    for (const f of fish) {
      const d = dist2(x, y, f.x, f.y);
      if (d < hd + f.size * 0.4) { hd = d; hit = f; }
    }
    if (hit) { selectedFish = hit; updateInspector(); }
    else { selectedFish = null; updateInspector(); dropFood(x, y); }
  });

  // floating toolbar
  const bar = document.createElement('div');
  bar.id = 'floating-toolbar';
  document.body.appendChild(bar);
  const mk = (label, icon, key, fn, active) => {
    const b = document.createElement('button');
    b.className = 'toolbar-btn' + (active ? ' active' : '');
    b.innerHTML = `<span>${icon}</span> ${label} <span class="key-hint">${key}</span>`;
    b.addEventListener('click', () => { fn(); syncToolbar(); });
    bar.appendChild(b); return b;
  };
  const toggleUI = () => {
    for (const s of ['.controls', '.controls-container', '.hero'])
      document.querySelector(s)?.classList.toggle('hidden');
  };
  const toggleAnalytics = () => {
    showAnalytics = !showAnalytics;
    document.getElementById('analytics-dashboard')?.classList.toggle('hidden', !showAnalytics);
  };
  const btns = [
    mk('UI', '⌨️', 'H', toggleUI, true),
    mk('Neural', '🧠', 'N', () => { showNeuralNetwork = !showNeuralNetwork; }, false),
    mk('Brains', '📊', 'D', () => { showDebugWeights = !showDebugWeights; }, false),
    mk('Analytics', '📈', 'A', toggleAnalytics, false),
    mk('Reset', '🔄', 'R', () => { if (confirm('Delete saved brains and reset?')) resetEverything(); }, false),
  ];
  function syncToolbar() {
    btns[1].classList.toggle('active', showNeuralNetwork);
    btns[2].classList.toggle('active', showDebugWeights);
    btns[3].classList.toggle('active', showAnalytics);
  }
  setupUI.syncToolbar = syncToolbar;

  window.addEventListener('keydown', e => {
    if (e.target.matches('input')) return;
    const k = e.key.toLowerCase();
    if (k === 'h') { toggleUI(); syncToolbar(); }
    else if (k === 'n') { showNeuralNetwork = !showNeuralNetwork; syncToolbar(); }
    else if (k === 'd') { showDebugWeights = !showDebugWeights; syncToolbar(); }
    else if (k === 'a') { toggleAnalytics(); syncToolbar(); }
    else if (k === 'e') { forceEvolve(); }
    else if (k === '1') { simSpeed = 1; updateAnalyticsUI(); }
    else if (k === '2') { simSpeed = 2; updateAnalyticsUI(); }
    else if (k === '3') { simSpeed = 4; updateAnalyticsUI(); }
    else if (k === 'r') { if (confirm('Delete saved brains and reset?')) resetEverything(); }
    else if (k === ' ') { e.preventDefault(); togglePause(); }
    else if (k === 'escape') { selectedFish = null; updateInspector(); }
  });
}

// ---------- Boot ----------
loadHallOfFame();
initEnvironment();
seedPlants(8);
for (let i = 0; i < 14; i++) bubbles.push(new Bubble(Math.random() * W, Math.random() * H));
setupUI();
updateTrainingLogDisplay();
addToTrainingLog('Training session started — adversarial AI ecosystem live', 'evo');
setTimeout(startAdversarialTraining, 600);
requestAnimationFrame(animate);
