/**
 * Aether Crucible — Character Archetypes & Artifacts Library
 * Defines playable characters, perks, and 30+ stackable alchemical relics.
 */

const ARCHETYPES = {
  pyromancer: {
    id: 'pyromancer',
    name: 'Ignis Vanguard',
    title: 'Pyre Alchemist',
    icon: '🔥',
    description: 'Master of flame and toxic volatility. High vitality, thrives in close-quarters infernos.',
    hp: 125,
    mana: 100,
    speed: 215,
    shield: 0,
    startingElements: ['pyros', 'toxis'],
    startingArtifacts: ['salamander_heart'],
    passiveName: 'Combustion Core',
    passiveDesc: '+25% Pyros damage. Slaying burning enemies triggers an incendiary shrapnel burst.'
  },
  stormweaver: {
    id: 'stormweaver',
    name: 'Storm Weaver',
    title: 'Galvanic Adept',
    icon: '⚡',
    description: 'High-agility conduction specialist. Chains lightning through deluge fields.',
    hp: 95,
    mana: 120,
    speed: 255,
    shield: 15,
    startingElements: ['voltos', 'hydros'],
    startingArtifacts: ['tesla_coil_core'],
    passiveName: 'Galvanic Flow',
    passiveDesc: '+20% Move speed after dashing. Voltos sparks jump to +2 additional targets.'
  },
  astrologer: {
    id: 'astrologer',
    name: 'Void Astrologer',
    title: 'Cosmic Synthesist',
    icon: '🌌',
    description: 'Gravitational master. Freezes space-time and pulls enemies into catastrophic black holes.',
    hp: 105,
    mana: 130,
    speed: 225,
    shield: 25,
    startingElements: ['cryos', 'aether'],
    startingArtifacts: ['aegis_of_aether'],
    passiveName: 'Event Horizon',
    passiveDesc: 'Dash phases through enemies and leaves a frost vortex. +35% Singularity pull radius.'
  }
};

const ARTIFACTS = {
  // --- COMMON (Tiers) ---
  heavy_crucible: {
    id: 'heavy_crucible',
    name: 'Reinforced Crucible',
    rarity: 'common',
    icon: '🛡️',
    description: '+30 Maximum Health.',
    apply: (p) => { p.maxHp += 30; p.hp += 30; }
  },
  aether_wellspring: {
    id: 'aether_wellspring',
    name: 'Aether Wellspring',
    rarity: 'common',
    icon: '🔮',
    description: '+35 Max Mana and +25% Mana regeneration speed.',
    apply: (p) => { p.maxMana += 35; p.manaRegenMultiplier *= 1.25; }
  },
  mercury_boots: {
    id: 'mercury_boots',
    name: 'Quicksilver Greaves',
    rarity: 'common',
    icon: '👢',
    description: '+18% Movement Speed and +1 Dash charge.',
    apply: (p) => { p.speed *= 1.18; p.maxDashes += 1; p.dashes += 1; }
  },
  hydra_flask: {
    id: 'hydra_flask',
    name: 'Hydra Flask',
    rarity: 'common',
    icon: '🧪',
    description: '-25% Flask cooldown and +15% Flask AoE radius.',
    apply: (p) => { p.flaskCooldownMultiplier *= 0.75; p.flaskRadiusMultiplier *= 1.15; }
  },
  stormcloud_vane: {
    id: 'stormcloud_vane',
    name: 'Stormcloud Vane',
    rarity: 'common',
    icon: '💧',
    description: 'Water puddles and steam clouds linger 40% longer and have +25% larger radius.',
    apply: (p) => { p.puddleDurationMultiplier *= 1.4; }
  },
  volatile_concoction: {
    id: 'volatile_concoction',
    name: 'Volatile Concoction',
    rarity: 'common',
    icon: '💥',
    description: 'All elemental secondary skills deal +25% direct impact damage.',
    apply: (p) => { p.secondaryDamageMultiplier *= 1.25; }
  },
  vortex_magnet: {
    id: 'vortex_magnet',
    name: 'Singularity Magnet',
    rarity: 'common',
    icon: '🧲',
    description: 'Triples pickup attraction range for Aether Shards and Health Vials.',
    apply: (p) => { p.pickupRange *= 3.0; }
  },
  viper_catalyst: {
    id: 'viper_catalyst',
    name: 'Viper Catalyst',
    rarity: 'common',
    icon: '🐍',
    description: 'Toxis acid applies 40% slower enemy movement on top of corrosion.',
    apply: (p) => { p.toxisSlow = true; }
  },
  midas_transmuter: {
    id: 'midas_transmuter',
    name: 'Midas Transmuter',
    rarity: 'common',
    icon: '🪙',
    description: 'Destroying barrels, crates, and mineral veins yields double Aether Shards.',
    apply: (p) => { p.bonusShards = (p.bonusShards || 0) + 1; }
  },
  blightbloom_spore: {
    id: 'blightbloom_spore',
    name: 'Blightbloom Spore',
    rarity: 'common',
    icon: '🍄',
    description: 'Enemies slain while Corroded burst into an expanding toxic cloud.',
    apply: (p) => { p.corrodedExplode = true; }
  },

  // --- RARE ---
  salamander_heart: {
    id: 'salamander_heart',
    name: 'Salamander Heart',
    rarity: 'rare',
    icon: '🦎',
    description: 'Standing inside burning ground or fire regenerates 4 HP/sec instead of hurting you.',
    apply: (p) => { p.fireImmune = true; p.fireHeals = true; }
  },
  tesla_coil_core: {
    id: 'tesla_coil_core',
    name: 'Tesla Coil Core',
    rarity: 'rare',
    icon: '⚡',
    description: 'Electrified enemies periodically fire homing spark bolts at nearby foes.',
    apply: (p) => { p.teslaCoil = true; }
  },
  boreal_prism: {
    id: 'boreal_prism',
    name: 'Boreal Prism',
    rarity: 'rare',
    icon: '💎',
    description: 'Chilled and Frozen enemies take +45% bonus damage from all attacks.',
    apply: (p) => { p.freezeDamageBonus = 1.45; }
  },
  aegis_of_aether: {
    id: 'aegis_of_aether',
    name: 'Aegis of Aether',
    rarity: 'rare',
    icon: '💠',
    description: 'Grants 35 Energy Shield that automatically regenerates after 4s without taking damage.',
    apply: (p) => { p.maxShield += 35; p.shield += 35; p.hasShieldRegen = true; }
  },
  blood_alchemist_phial: {
    id: 'blood_alchemist_phial',
    name: 'Blood Phial',
    rarity: 'rare',
    icon: '🩸',
    description: 'Slaying an enemy has a 25% chance to immediately spawn a restorative health orb.',
    apply: (p) => { p.healthDropChance = 0.25; }
  },
  superconductor_ring: {
    id: 'superconductor_ring',
    name: 'Superconductor Ring',
    rarity: 'rare',
    icon: '💍',
    description: 'Hydro-Electric reactions arc indefinitely through all wet targets with 100% crit chance.',
    apply: (p) => { p.superconductor = true; }
  },
  cryo_pyre_dynamo: {
    id: 'cryo_pyre_dynamo',
    name: 'Thermal Shock Dynamo',
    rarity: 'rare',
    icon: '☯️',
    description: 'Triggering Cryo-Thermal reactions creates a double radial frostfire shockwave.',
    apply: (p) => { p.thermalShockwave = true; }
  },
  overcharge_reactor: {
    id: 'overcharge_reactor',
    name: 'Overcharge Reactor',
    rarity: 'rare',
    icon: '🔋',
    description: 'When at full Mana, casting any Secondary skill consumes 0 mana and deals +80% damage.',
    apply: (p) => { p.overcharge = true; }
  },
  chrono_sands: {
    id: 'chrono_sands',
    name: 'Chrono Sands',
    rarity: 'rare',
    icon: '⏳',
    description: 'Dashing slows time by 45% for 1.2 seconds while you move at full speed.',
    apply: (p) => { p.chronoDash = true; }
  },
  acidic_carapace: {
    id: 'acidic_carapace',
    name: 'Acidic Carapace',
    rarity: 'rare',
    icon: '🪲',
    description: 'Taking damage releases a burst of 6 corrosive acid spikes in all directions.',
    apply: (p) => { p.acidRetaliation = true; }
  },
  frigid_mantle: {
    id: 'frigid_mantle',
    name: 'Frigid Mantle',
    rarity: 'rare',
    icon: '❄️',
    description: 'Taking melee damage instantly flash-freezes the attacking enemy for 2.0s.',
    apply: (p) => { p.frostRetaliation = true; }
  },

  // --- LEGENDARY ---
  philosophers_crucible: {
    id: 'philosophers_crucible',
    name: "Philosopher's Crucible",
    rarity: 'legendary',
    icon: '⚗️',
    description: 'All elemental reactions trigger with +50% explosive magnitude and drop 2x Shards.',
    apply: (p) => { p.reactionMultiplier *= 1.5; p.bonusShards = (p.bonusShards || 0) + 2; }
  },
  prismatic_lens: {
    id: 'prismatic_lens',
    name: 'Prismatic Lens',
    rarity: 'legendary',
    icon: '🌈',
    description: 'Primary elemental beams pierce infinitely through all enemies and obstacles.',
    apply: (p) => { p.piercingBeams = true; }
  },
  absolute_zero_core: {
    id: 'absolute_zero_core',
    name: 'Absolute Zero Core',
    rarity: 'legendary',
    icon: '🧊',
    description: 'Cryos hits instantly shatter and execute non-boss enemies below 25% Health.',
    apply: (p) => { p.executeFrozen = true; }
  },
  phoenix_ash: {
    id: 'phoenix_ash',
    name: 'Phoenix Ash',
    rarity: 'legendary',
    icon: '🪶',
    description: 'Upon taking fatal damage, resurrect with 60% HP and unleash a screen-clearing inferno (1/run).',
    apply: (p) => { p.hasRevive = true; }
  },
  singularity_supernova_engine: {
    id: 'singularity_supernova_engine',
    name: 'Singularity Engine',
    rarity: 'legendary',
    icon: '🌌',
    description: 'Aether Singularity Wells implode 2x faster with +100% gravitational suction force.',
    apply: (p) => { p.singularityEngine = true; }
  },
  entropy_catalyst: {
    id: 'entropy_catalyst',
    name: 'Entropy Catalyst',
    rarity: 'legendary',
    icon: '⚛️',
    description: 'Triggering 3 different reactions within 5 seconds summons an apocalyptic meteor strike.',
    apply: (p) => { p.entropyCatalyst = true; }
  }
};

class ArtifactManager {
  static getArtifact(id) {
    return ARTIFACTS[id] || null;
  }

  static getRandomArtifactPool(count = 3, existingIds = []) {
    const allKeys = Object.keys(ARTIFACTS).filter(id => !existingIds.includes(id));
    const shuffled = allKeys.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(id => ARTIFACTS[id]);
  }
}

window.ARCHETYPES = ARCHETYPES;
window.ARTIFACTS = ARTIFACTS;
window.ArtifactManager = ArtifactManager;
