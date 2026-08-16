/**
 * Aether Crucible — Elemental Matrix & Reactions
 * Defines the 6 primal elements, status effects, and reaction combinations.
 */

const ELEMENTS = {
  pyros: {
    id: 'pyros',
    name: 'Pyros',
    icon: '🔥',
    color: '#ff4500',
    glowColor: 'rgba(255, 69, 0, 0.6)',
    lightColor: '#ff8c00',
    description: 'Primal flame. Ignites organic matter, melts ice, and boils water into steam.',
    primaryName: 'Flame Arc',
    primaryMana: 3,
    secondaryName: 'Pyre Sphere',
    secondaryMana: 25,
    secondaryCooldown: 3.5,
    flaskName: 'Inferno Flask',
    flaskCooldown: 8.0,
    statusEffect: 'burning',
    statusDuration: 4.0
  },
  hydros: {
    id: 'hydros',
    name: 'Hydros',
    icon: '💧',
    color: '#0284c7',
    glowColor: 'rgba(2, 132, 199, 0.6)',
    lightColor: '#38bdf8',
    description: 'Living torrent. Douses flames, creates conductive puddles, and pushes foes.',
    primaryName: 'Aqua Jet',
    primaryMana: 2.5,
    secondaryName: 'Tidal Wave',
    secondaryMana: 20,
    secondaryCooldown: 3.0,
    flaskName: 'Deluge Flask',
    flaskCooldown: 7.5,
    statusEffect: 'wet',
    statusDuration: 6.0
  },
  voltos: {
    id: 'voltos',
    name: 'Voltos',
    icon: '⚡',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.6)',
    lightColor: '#fef08a',
    description: 'Crackling lightning. Arcs through wet targets and metal conduits with critical stuns.',
    primaryName: 'Volt Spark',
    primaryMana: 4,
    secondaryName: 'Chain Thunder',
    secondaryMana: 30,
    secondaryCooldown: 4.0,
    flaskName: 'Tesla Flask',
    flaskCooldown: 9.0,
    statusEffect: 'electrified',
    statusDuration: 3.0
  },
  cryos: {
    id: 'cryos',
    name: 'Cryos',
    icon: '❄️',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    lightColor: '#a5f3fc',
    description: 'Sub-zero frost. Freezes wet targets into fragile statues and forms slippery ice sheets.',
    primaryName: 'Frost Beam',
    primaryMana: 3.5,
    secondaryName: 'Glacial Lance',
    secondaryMana: 24,
    secondaryCooldown: 3.5,
    flaskName: 'Blizzard Flask',
    flaskCooldown: 8.5,
    statusEffect: 'chilled',
    statusDuration: 4.5
  },
  toxis: {
    id: 'toxis',
    name: 'Toxis',
    icon: '☣️',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.6)',
    lightColor: '#86efac',
    description: 'Corrosive venom. Dissolves enemy armor and detonates violently upon contact with fire.',
    primaryName: 'Acid Spray',
    primaryMana: 3,
    secondaryName: 'Blight Pod',
    secondaryMana: 22,
    secondaryCooldown: 3.2,
    flaskName: 'Miasma Flask',
    flaskCooldown: 8.0,
    statusEffect: 'corroded',
    statusDuration: 5.0
  },
  aether: {
    id: 'aether',
    name: 'Aether',
    icon: '🌌',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    lightColor: '#e9d5ff',
    description: 'Gravitational cosmic essence. Pulls enemies and elements into devastating singularity cores.',
    primaryName: 'Grav Pulse',
    primaryMana: 5,
    secondaryName: 'Singularity Well',
    secondaryMana: 38,
    secondaryCooldown: 6.0,
    flaskName: 'Cosmic Core Flask',
    flaskCooldown: 11.0,
    statusEffect: 'tethered',
    statusDuration: 3.5
  }
};

const ELEMENT_KEYS = ['pyros', 'hydros', 'voltos', 'cryos', 'toxis', 'aether'];

// Elemental Reaction Codex & Definitions
const REACTIONS = {
  STEAM_BURST: {
    id: 'STEAM_BURST',
    name: 'Steam Eruption',
    elements: ['pyros', 'hydros'],
    color: '#e2e8f0',
    multiplier: 1.8,
    description: 'Boiling steam explosion that obscures vision, blinds foes, and deals heavy AoE burn damage.',
    effect: 'blind_burn'
  },
  HYDRO_ELECTRIC: {
    id: 'HYDRO_ELECTRIC',
    name: 'Hydro-Electric Arc',
    elements: ['hydros', 'voltos'],
    color: '#38bdf8',
    multiplier: 2.2,
    description: 'Chains high-voltage lightning through all wet targets and puddles, applying 1.5s Stun.',
    effect: 'chain_stun'
  },
  GLACIAL_SHATTER: {
    id: 'GLACIAL_SHATTER',
    name: 'Glacial Shatter',
    elements: ['cryos', 'voltos'], // Also triggered by heavy kinetic hits on frozen targets
    color: '#cffafe',
    multiplier: 2.5,
    description: 'Shatters solid frozen enemies into 8 high-velocity ice shrapnel piercing nearby foes.',
    effect: 'shatter_nova'
  },
  BIO_DETONATION: {
    id: 'BIO_DETONATION',
    name: 'Bio-Plasmic Detonation',
    elements: ['pyros', 'toxis'],
    color: '#fbbf24',
    multiplier: 2.6,
    description: 'Ignites volatile acid in a massive chemical blast that leaves lingering toxic fire.',
    effect: 'mega_explosion'
  },
  CRYO_THERMAL: {
    id: 'CRYO_THERMAL',
    name: 'Cryo-Thermal Fracture',
    elements: ['pyros', 'cryos'],
    color: '#fda4af',
    multiplier: 1.9,
    description: 'Extreme thermal shock shatters enemy defense (-50% armor) and inflicts brittle damage.',
    effect: 'armor_break'
  },
  PLASMA_CORROSION: {
    id: 'PLASMA_CORROSION',
    name: 'Plasma Ionization',
    elements: ['voltos', 'toxis'],
    color: '#84cc16',
    multiplier: 2.0,
    description: 'Supercharges acid into ionizing plasma that disables enemy ranged firing.',
    effect: 'plasma_dot'
  },
  SOLAR_COLLAPSE: {
    id: 'SOLAR_COLLAPSE',
    name: 'Solar Singularity',
    elements: ['pyros', 'aether'],
    color: '#f97316',
    multiplier: 2.8,
    description: 'Gravitational vortex draws enemies inward and detonates into a radiant solar flare.',
    effect: 'pull_and_explode'
  },
  MAELSTROM: {
    id: 'MAELSTROM',
    name: 'Vortex Maelstrom',
    elements: ['hydros', 'aether'],
    color: '#06b6d4',
    multiplier: 2.1,
    description: 'Spins caught enemies in an inescapable tidal whirlpool that continuously damages them.',
    effect: 'whirlpool'
  },
  EMP_SUPERNOVA: {
    id: 'EMP_SUPERNOVA',
    name: 'Electromagnetic Collapse',
    elements: ['voltos', 'aether'],
    color: '#c084fc',
    multiplier: 2.7,
    description: 'Collapses cosmic electric charge into an EMP blast silencing and shocking the entire room.',
    effect: 'emp_stun'
  },
  ABSOLUTE_ZERO: {
    id: 'ABSOLUTE_ZERO',
    name: 'Event Horizon Freeze',
    elements: ['cryos', 'aether'],
    color: '#bae6fd',
    multiplier: 2.4,
    description: 'Halts time and molecular motion, locking all trapped enemies and projectiles in place.',
    effect: 'time_freeze'
  },
  MIASMA_VORTEX: {
    id: 'MIASMA_VORTEX',
    name: 'Corrosive Graviton',
    elements: ['toxis', 'aether'],
    color: '#4ade80',
    multiplier: 2.5,
    description: 'Vortex of dissolving dark matter that rapidly melts boss armor and health.',
    effect: 'acid_vortex'
  }
};

class ElementMatrix {
  static checkReaction(elem1, elem2) {
    if (!elem1 || !elem2 || elem1 === elem2) return null;

    for (const key in REACTIONS) {
      const reaction = REACTIONS[key];
      if (
        (reaction.elements[0] === elem1 && reaction.elements[1] === elem2) ||
        (reaction.elements[0] === elem2 && reaction.elements[1] === elem1)
      ) {
        return reaction;
      }
    }
    return null;
  }

  static getElementData(elemId) {
    return ELEMENTS[elemId] || ELEMENTS.pyros;
  }
}

window.ELEMENTS = ELEMENTS;
window.ELEMENT_KEYS = ELEMENT_KEYS;
window.REACTIONS = REACTIONS;
window.ElementMatrix = ElementMatrix;
