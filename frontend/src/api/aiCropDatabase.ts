// Comprehensive Agronomic Post-Harvest Storage Database & Safe Parameters
// Compiled from FAO Post-Harvest Standards, USDA Agricultural Handbook No. 66,
// Potato Association of America (PAA), and UC Davis Postharvest Technology Center.

export interface CropSafeParameters {
  id: string;
  name: string;
  variety: string;
  scientificName: string;
  category: 'Root & Tuber' | 'Allium Bulb' | 'Pome & Stone Fruit' | 'Tropical Fruit' | 'Solanaceous' | 'Cereal Grain' | 'Berry' | 'Citrus' | 'Leafy & Brassica' | 'Custom';
  icon: string;
  
  // Temperature (°C)
  minTemp: number;
  targetTemp: number;
  maxTemp: number;
  freezingPoint: number;
  chillingInjuryThreshold?: number;
  
  // Humidity (%)
  minHumidity: number;
  targetHumidity: number;
  maxHumidity: number;
  
  // Gas & Respiration Limits
  maxCo2Ppm: number;
  co2WarningPpm: number;
  maxEthylenePpm: number;
  ethyleneSensitivity: 'Extreme' | 'High' | 'Moderate' | 'Low' | 'High Producer';
  maxAmmoniaPpm: number;
  maxEthanolPpm: number;

  // Ventilation & Storage
  recommendedAch: number; // Air changes per hour
  airVelocityMs: string;  // Recommended air velocity across pile
  maxStorageLife: string;
  stackingDensityTonnesM3: number; // Stacking density tonnes/m3
  
  // Agronomic Insights & Guidelines
  guidance: string;
  physiologicalHazards: {
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
  }[];
  nodePlacementTips: string[];
}

export const CROP_DATABASE: Record<string, CropSafeParameters> = {
  'potatoes-processing': {
    id: 'potatoes-processing',
    name: 'Potatoes (Processing / Chipping & French Fry)',
    variety: 'Russet Burbank, Atlantic, Shepody, Innovator',
    scientificName: 'Solanum tuberosum',
    category: 'Root & Tuber',
    icon: '🥔',
    minTemp: 7.0,
    targetTemp: 9.0,
    maxTemp: 10.0,
    freezingPoint: -0.8,
    chillingInjuryThreshold: 6.5,
    minHumidity: 90.0,
    targetHumidity: 93.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 2500,
    co2WarningPpm: 2000,
    maxEthylenePpm: 0.05,
    ethyleneSensitivity: 'High',
    maxAmmoniaPpm: 6.0,
    maxEthanolPpm: 3.5,
    recommendedAch: 1.5,
    airVelocityMs: '0.15 - 0.25 m/s through pile',
    maxStorageLife: '8 - 10 Months',
    stackingDensityTonnesM3: 0.65,
    guidance: 'Crucial: Never allow temperature to drop below 7.0°C! Temperatures below 7.0°C trigger Cold-Induced Sweetening (CIS), rapidly converting starch to reducing sugars (glucose/fructose) which cause dark, burnt acrylamide fry color. High RH (90-95%) prevents shrink weight loss and pressure bruising, but avoid condensation to prevent bacterial soft rot (Erwinia carotovora). Vent CO2 regularly below 2500 ppm to avoid blackheart physiological necrosis.',
    physiologicalHazards: [
      {
        title: 'Cold-Induced Sweetening (CIS)',
        description: 'Temperatures below 7.0°C cause starch hydrolysis into reducing sugars, ruining frying quality and increasing carcinogenic acrylamide formation upon frying.',
        severity: 'critical'
      },
      {
        title: 'Blackheart (CO2 Suffocation)',
        description: 'CO2 levels above 2500-3000 ppm cause inner tuber core asphyxiation and black rot necrosis.',
        severity: 'critical'
      },
      {
        title: 'Condensation Soft Rot (Erwinia)',
        description: 'Moisture dripping from ceilings or uninsulated ducts onto pile creates anaerobic moisture films, causing rapid tuber liquefaction.',
        severity: 'warning'
      }
    ],
    nodePlacementTips: [
      'Mount primary reference node under evaporator return intake to measure bulk return temperature and average CO2 load.',
      'Insert core penetration temperature probe at 1.2m depth into middle of pile to detect biological self-heating respiration hot spots.',
      'Place doorway node at 1.5m height near loading bay to catch warm air infiltration during shipping doors opening.'
    ]
  },

  'potatoes-seed': {
    id: 'potatoes-seed',
    name: 'Potatoes (Seed Tubers)',
    variety: 'All Commercial Seed Varieties',
    scientificName: 'Solanum tuberosum',
    category: 'Root & Tuber',
    icon: '🌱',
    minTemp: 2.5,
    targetTemp: 3.5,
    maxTemp: 4.5,
    freezingPoint: -0.8,
    chillingInjuryThreshold: 2.0,
    minHumidity: 90.0,
    targetHumidity: 93.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 2000,
    co2WarningPpm: 1500,
    maxEthylenePpm: 0.02,
    ethyleneSensitivity: 'Extreme',
    maxAmmoniaPpm: 5.0,
    maxEthanolPpm: 2.5,
    recommendedAch: 1.0,
    airVelocityMs: '0.12 - 0.20 m/s',
    maxStorageLife: '7 - 9 Months',
    stackingDensityTonnesM3: 0.65,
    guidance: 'Low holding temperature (3.0-4.0°C) is strictly required to sustain apical eye dormancy, prevent premature sprout elongation, and preserve carbohydrate reserves for field emergence. Zero tolerance for ethylene or chemical sprout suppressants (CIPC), which permanently destroy planting vigor.',
    physiologicalHazards: [
      {
        title: 'Apical Dormancy Loss & Premature Sprouting',
        description: 'Temperatures above 4.5°C break dormancy, leading to rapid sprout elongation and loss of planting vigor.',
        severity: 'critical'
      },
      {
        title: 'Ethylene Desiccation',
        description: 'Ethylene levels > 0.05 ppm cause erratic sprouting and reduced tuber count upon planting.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Focus nodes in lower 1/3 of wooden crate stacks where cool air pools to ensure freezing thresholds are never breached.',
      'Place node at highest pallet layer to detect upward heat plumes and dormancy-breaking warm pockets.'
    ]
  },

  'potatoes-table': {
    id: 'potatoes-table',
    name: 'Potatoes (Table / Fresh Retail Market)',
    variety: 'Yukon Gold, Red Pontiac, Kennebec, Norland',
    scientificName: 'Solanum tuberosum',
    category: 'Root & Tuber',
    icon: '🥔',
    minTemp: 4.0,
    targetTemp: 5.0,
    maxTemp: 7.0,
    freezingPoint: -0.8,
    chillingInjuryThreshold: 3.5,
    minHumidity: 92.0,
    targetHumidity: 95.0,
    maxHumidity: 98.0,
    maxCo2Ppm: 3000,
    co2WarningPpm: 2200,
    maxEthylenePpm: 0.1,
    ethyleneSensitivity: 'Moderate',
    maxAmmoniaPpm: 6.5,
    maxEthanolPpm: 3.5,
    recommendedAch: 1.2,
    airVelocityMs: '0.15 - 0.22 m/s',
    maxStorageLife: '6 - 9 Months',
    stackingDensityTonnesM3: 0.65,
    guidance: 'Maintained at 4.0-5.0°C to retard sprouting without excessive chemical treatment. Storage vaults must remain in 100% complete darkness to prevent green skin pigmentation (chlorophyll & toxic solanine glycoalkaloids).',
    physiologicalHazards: [
      {
        title: 'Greening & Solanine Formation',
        description: 'Exposure to light creates chlorophyll greening and poisonous solanine bitter glycoalkaloids.',
        severity: 'critical'
      },
      {
        title: 'Pressure Bruising & Dehydration',
        description: 'RH below 90% causes weight loss and sunken flattened areas at crate contact points.',
        severity: 'warning'
      }
    ],
    nodePlacementTips: [
      'Install light sensors alongside environmental nodes to verify zero-lux dark storage compliance.',
      'Place RH probes near ceiling and return wall to detect moisture condensation zones.'
    ]
  },

  'onions-cured': {
    id: 'onions-cured',
    name: 'Onions (Cured Dry Bulb Storage)',
    variety: 'Yellow Spanish, Red Baron, Sweet Spanish',
    scientificName: 'Allium cepa',
    category: 'Allium Bulb',
    icon: '🧅',
    minTemp: 0.0,
    targetTemp: 0.5,
    maxTemp: 2.0,
    freezingPoint: -1.2,
    chillingInjuryThreshold: -0.5,
    minHumidity: 65.0,
    targetHumidity: 68.0,
    maxHumidity: 72.0,
    maxCo2Ppm: 2000,
    co2WarningPpm: 1500,
    maxEthylenePpm: 0.05,
    ethyleneSensitivity: 'High',
    maxAmmoniaPpm: 7.5,
    maxEthanolPpm: 3.0,
    recommendedAch: 2.5,
    airVelocityMs: '0.25 - 0.40 m/s continuous',
    maxStorageLife: '6 - 8 Months',
    stackingDensityTonnesM3: 0.55,
    guidance: 'CRITICAL DIFFERENCE: Onions require DRY relative humidity (65-70%) unlike virtually all other cold store produce! Relative humidity above 72% immediately stimulates root growth, breaks dormancy, and creates ideal conditions for Botrytis allii neck rot and Aspergillus niger black mold.',
    physiologicalHazards: [
      {
        title: 'Neck Rot (Botrytis allii) & Black Mold',
        description: 'RH > 72% creates fungal spore germination in neck tissues, destroying bulb structure from the inside out.',
        severity: 'critical'
      },
      {
        title: 'Root Regrowth & Sprouting',
        description: 'Excessive moisture and temperatures > 2.0°C stimulate root emergence and inner shoot development.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Place nodes across floor return channels to ensure dry air circulation penetrates bottom bulk bins.',
      'Monitor humidity gradient closely; if RH exceeds 72%, trigger continuous ventilation fans immediately.'
    ]
  },

  'apples-cold': {
    id: 'apples-cold',
    name: 'Apples (Crisp Cold & CA Storage)',
    variety: 'Gala, Honeycrisp, Fuji, Granny Smith, Red Delicious',
    scientificName: 'Malus domestica',
    category: 'Pome & Stone Fruit',
    icon: '🍎',
    minTemp: -0.5,
    targetTemp: 0.5,
    maxTemp: 2.0,
    freezingPoint: -1.7,
    chillingInjuryThreshold: 0.0,
    minHumidity: 90.0,
    targetHumidity: 93.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 1500,
    co2WarningPpm: 1200,
    maxEthylenePpm: 0.05,
    ethyleneSensitivity: 'High Producer',
    maxAmmoniaPpm: 5.0,
    maxEthanolPpm: 3.0,
    recommendedAch: 1.0,
    airVelocityMs: '0.10 - 0.18 m/s',
    maxStorageLife: '9 - 12 Months',
    stackingDensityTonnesM3: 0.45,
    guidance: 'Apples are climacteric fruit and major ethylene producers! Keep temperature strictly within -0.5°C to 1.5°C to retard respiration. Controlled Atmosphere (CA) chambers maintain 1.5-2.0% O2 and 1.0-1.5% CO2. Never store apples in the same vault as leafy greens, carrots, or seed potatoes, as apple ethylene will cause rapid deterioration.',
    physiologicalHazards: [
      {
        title: 'Ethylene Auto-Catalytic Ripening',
        description: 'Self-emitted ethylene accelerates softening, skin scald, and internal breakdown unless scrubbed continuously.',
        severity: 'critical'
      },
      {
        title: 'Freezing Injury',
        description: 'Fruit flesh freezes below -1.7°C, causing brown water-soaked flesh collapse upon thawing.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Install ethylene-capable gas sensor in upper stagnation eddies where ethylene gas concentrates.',
      'Position temperature nodes at lower bin levels close to cooling coil discharge to prevent freeze burn.'
    ]
  },

  'bananas-holding': {
    id: 'bananas-holding',
    name: 'Bananas (Green Commercial Holding)',
    variety: 'Cavendish, Grande Naine',
    scientificName: 'Musa acuminata',
    category: 'Tropical Fruit',
    icon: '🍌',
    minTemp: 13.0,
    targetTemp: 13.8,
    maxTemp: 15.0,
    freezingPoint: -0.8,
    chillingInjuryThreshold: 12.8,
    minHumidity: 90.0,
    targetHumidity: 95.0,
    maxHumidity: 98.0,
    maxCo2Ppm: 2500,
    co2WarningPpm: 2000,
    maxEthylenePpm: 0.01,
    ethyleneSensitivity: 'Extreme',
    maxAmmoniaPpm: 4.0,
    maxEthanolPpm: 3.0,
    recommendedAch: 2.0,
    airVelocityMs: '0.20 - 0.30 m/s',
    maxStorageLife: '3 - 5 Weeks',
    stackingDensityTonnesM3: 0.40,
    guidance: 'EXTREME CHILL SENSITIVITY: Bananas MUST NOT be exposed to temperatures below 13.0°C! Temperatures below 13°C cause irreversible chilling injury within 12 hours: sub-epidermal latex cells coagulate, causing permanent dull grayish skin discoloration, failure to ripen, and astringent pulp.',
    physiologicalHazards: [
      {
        title: 'Chilling Injury (<13.0°C)',
        description: 'Greyish/smoky peel discoloration, hardening of pulp core, failure to convert starch to sugar.',
        severity: 'critical'
      },
      {
        title: 'Accidental Ethylene Triggering',
        description: 'Trace ethylene (>0.05 ppm) triggers premature autocatalytic ripening, leading to yellowing in transit.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Position low-temperature alarms with zero tolerance (<13.0°C alarm trip).',
      'Deploy node near evaporator cold-air throw boundary to verify supply air never drops below 13.0°C.'
    ]
  },

  'tomatoes-fresh': {
    id: 'tomatoes-fresh',
    name: 'Tomatoes (Vine-Fresh & Mature Green)',
    variety: 'Roma, Beefsteak, Round Cherry, Vine Cluster',
    scientificName: 'Solanum lycopersicum',
    category: 'Solanaceous',
    icon: '🍅',
    minTemp: 10.0,
    targetTemp: 12.5,
    maxTemp: 15.0,
    freezingPoint: -0.6,
    chillingInjuryThreshold: 10.0,
    minHumidity: 88.0,
    targetHumidity: 92.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 2000,
    co2WarningPpm: 1500,
    maxEthylenePpm: 0.1,
    ethyleneSensitivity: 'High Producer',
    maxAmmoniaPpm: 5.5,
    maxEthanolPpm: 3.5,
    recommendedAch: 1.5,
    airVelocityMs: '0.15 - 0.25 m/s',
    maxStorageLife: '2 - 4 Weeks',
    stackingDensityTonnesM3: 0.38,
    guidance: 'Tomatoes are chilling sensitive! Never store mature green or partially-ripe tomatoes below 10°C, as chilling causes surface pitting, failure to develop red lycopene pigment, uneven softening, and catastrophic Alternaria rot.',
    physiologicalHazards: [
      {
        title: 'Chilling Injury (<10°C)',
        description: 'Pitting on cuticle, failure to ripen, watery breakdown, and Alternaria tenuis black fungal rot.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Place node at center pallet height to detect heat generated by ripening fruit.',
      'Monitor ethylene buildup in upper airspace.'
    ]
  },

  'wheat-grain': {
    id: 'wheat-grain',
    name: 'Wheat & Cereal Grain (Aerated Silo)',
    variety: 'Hard Red Winter, Soft White, Durum',
    scientificName: 'Triticum aestivum',
    category: 'Cereal Grain',
    icon: '🌾',
    minTemp: 4.0,
    targetTemp: 10.0,
    maxTemp: 18.0,
    freezingPoint: -15.0,
    minHumidity: 50.0,
    targetHumidity: 58.0,
    maxHumidity: 65.0,
    maxCo2Ppm: 1200,
    co2WarningPpm: 900,
    maxEthylenePpm: 0.0,
    ethyleneSensitivity: 'Low',
    maxAmmoniaPpm: 3.0,
    maxEthanolPpm: 2.0,
    recommendedAch: 0.5,
    airVelocityMs: '0.05 - 0.15 m/s aerated',
    maxStorageLife: '12 - 36 Months',
    stackingDensityTonnesM3: 0.80,
    guidance: 'Grain equilibrium moisture content (EMC) must stay strictly below 13.5% (air RH <65%). RH above 65% triggers fungal spore germination (Aspergillus glaucus, Penicillium verrucosum) producing toxic ochratoxin A and aflatoxins. Grain temperature above 18°C causes weevil infestation.',
    physiologicalHazards: [
      {
        title: 'Mycotoxin Biosynthesis & Mold Heating',
        description: 'Moisture >65% triggers fungal hot spots where biological activity drives grain temperature to 40-50°C.',
        severity: 'critical'
      },
      {
        title: 'Insect Pest Infestation',
        description: 'Temperatures above 18°C accelerate reproductive cycles of Cryptolestes and Sitophilus weevils.',
        severity: 'warning'
      }
    ],
    nodePlacementTips: [
      'Hang vertical multi-sensor thermocouple cables through silo center, midway, and wall sectors.',
      'Place CO2 sensor in overhead headspace; rising CO2 is the #1 earliest indicator of hidden fungal or insect biological hotspots.'
    ]
  },

  'rice-paddy': {
    id: 'rice-paddy',
    name: 'Rice (Paddy & Rough Grain)',
    variety: 'Basmati, Indica Long Grain, Japonica',
    scientificName: 'Oryza sativa',
    category: 'Cereal Grain',
    icon: '🍚',
    minTemp: 10.0,
    targetTemp: 14.0,
    maxTemp: 18.0,
    freezingPoint: -12.0,
    minHumidity: 55.0,
    targetHumidity: 62.0,
    maxHumidity: 68.0,
    maxCo2Ppm: 1200,
    co2WarningPpm: 950,
    maxEthylenePpm: 0.0,
    ethyleneSensitivity: 'Low',
    maxAmmoniaPpm: 3.5,
    maxEthanolPpm: 2.0,
    recommendedAch: 0.6,
    airVelocityMs: '0.08 - 0.16 m/s',
    maxStorageLife: '12 - 24 Months',
    stackingDensityTonnesM3: 0.60,
    guidance: 'Target moisture content 12.0-13.0%. High temperatures (>20°C) and RH (>70%) cause grain yellowing, fatty acid oxidation leading to rancid aroma, and kernel fissuring which destroys head rice milling yield.',
    physiologicalHazards: [
      {
        title: 'Milling Yield Degradation',
        description: 'Moisture swings cause thermal shock fissuring; kernels shatter upon dehusking.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Monitor top grain surface where condensation cycles occur when warm ambient roof air meets cold grain surface.'
    ]
  },

  'carrots-bulk': {
    id: 'carrots-bulk',
    name: 'Carrots (Bulk Cold Storage)',
    variety: 'Nantes, Imperator, Chantenay',
    scientificName: 'Daucus carota',
    category: 'Root & Tuber',
    icon: '🥕',
    minTemp: 0.0,
    targetTemp: 0.5,
    maxTemp: 1.5,
    freezingPoint: -1.1,
    chillingInjuryThreshold: -0.5,
    minHumidity: 95.0,
    targetHumidity: 98.0,
    maxHumidity: 100.0,
    maxCo2Ppm: 2000,
    co2WarningPpm: 1500,
    maxEthylenePpm: 0.01,
    ethyleneSensitivity: 'Extreme',
    maxAmmoniaPpm: 4.5,
    maxEthanolPpm: 2.5,
    recommendedAch: 1.2,
    airVelocityMs: '0.10 - 0.20 m/s',
    maxStorageLife: '6 - 9 Months',
    stackingDensityTonnesM3: 0.60,
    guidance: 'Carrots require ultra-high humidity (95-98%) to prevent rubbery flaccidity and shriveling. EXTREME ETHYLENE SENSITIVITY: Exposure to trace ethylene (>0.02 ppm) induces isocoumarin synthesis, rendering carrots unbearably bitter and unmarketable. Never store with apples or pears!',
    physiologicalHazards: [
      {
        title: 'Isocoumarin Bitterness (Ethylene Injury)',
        description: 'Ethylene triggers secondary metabolism producing bitter isocoumarins within 48-72 hours.',
        severity: 'critical'
      },
      {
        title: 'Sclerotinia White Mold',
        description: 'Rapid spread in stagnant high-humidity pockets; requires gentle continuous air circulation.',
        severity: 'warning'
      }
    ],
    nodePlacementTips: [
      'Install ethylene monitoring at intake vents.',
      'Place humidity probes throughout pallet stacks to maintain 95%+ RH without pooling standing water.'
    ]
  },

  'citrus-oranges': {
    id: 'citrus-oranges',
    name: 'Citrus & Oranges (Ventilated Cold Storage)',
    variety: 'Valencia, Navel, Mandarin, Clementine',
    scientificName: 'Citrus sinensis',
    category: 'Citrus',
    icon: '🍊',
    minTemp: 3.5,
    targetTemp: 5.5,
    maxTemp: 8.0,
    freezingPoint: -1.4,
    chillingInjuryThreshold: 3.0,
    minHumidity: 88.0,
    targetHumidity: 92.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 2000,
    co2WarningPpm: 1400,
    maxEthylenePpm: 0.05,
    ethyleneSensitivity: 'Moderate',
    maxAmmoniaPpm: 5.0,
    maxEthanolPpm: 3.5,
    recommendedAch: 2.0,
    airVelocityMs: '0.20 - 0.30 m/s',
    maxStorageLife: '2 - 3 Months',
    stackingDensityTonnesM3: 0.50,
    guidance: 'Oranges are susceptible to chilling injury if held below 3.0°C (rind pitting, brown staining, off-flavor development). Maintain good ventilation to remove carbon dioxide and prevent stem-end rind breakdown.',
    physiologicalHazards: [
      {
        title: 'Chilling Pitting (<3°C)',
        description: 'Sunken brown blemishes on flavedo rind, accelerating Penicillium digitatum green mold.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Mount nodes near floor and return air channels to monitor temperature stability above 3.5°C.'
    ]
  },

  'grapes-table': {
    id: 'grapes-table',
    name: 'Table Grapes (Cold Storage with SO2)',
    variety: 'Crimson, Thompson Seedless, Flame, Autumn Royal',
    scientificName: 'Vitis vinifera',
    category: 'Berry',
    icon: '🍇',
    minTemp: -0.8,
    targetTemp: -0.2,
    maxTemp: 0.8,
    freezingPoint: -2.1,
    chillingInjuryThreshold: -1.0,
    minHumidity: 90.0,
    targetHumidity: 95.0,
    maxHumidity: 98.0,
    maxCo2Ppm: 1500,
    co2WarningPpm: 1200,
    maxEthylenePpm: 0.02,
    ethyleneSensitivity: 'High',
    maxAmmoniaPpm: 4.0,
    maxEthanolPpm: 3.0,
    recommendedAch: 1.0,
    airVelocityMs: '0.10 - 0.18 m/s',
    maxStorageLife: '2 - 5 Months',
    stackingDensityTonnesM3: 0.45,
    guidance: 'Store as close to the freezing point (-0.5°C to 0.0°C) as possible without freezing berries. High relative humidity (90-95%) prevents rachis (stem) browning and berry shattering. Botrytis cinerea (gray mold) control requires SO2 treatment pads.',
    physiologicalHazards: [
      {
        title: 'Gray Mold (Botrytis cinerea)',
        description: 'Can grow slowly even at 0°C; creates nest rot across entire lug boxes.',
        severity: 'critical'
      },
      {
        title: 'Stem Browning & Berry Shatter',
        description: 'RH < 90% causes stem desiccation and fruit drop from pedicels.',
        severity: 'warning'
      }
    ],
    nodePlacementTips: [
      'Maintain tight temp precision within ±0.3°C; place temperature sensors directly at air discharge from coils.'
    ]
  },

  'garlic-cured': {
    id: 'garlic-cured',
    name: 'Garlic (Cured Dry Cold Storage)',
    variety: 'Hardneck & Softneck Garlic',
    scientificName: 'Allium sativum',
    category: 'Allium Bulb',
    icon: '🧄',
    minTemp: -1.5,
    targetTemp: -0.5,
    maxTemp: 1.0,
    freezingPoint: -2.7,
    chillingInjuryThreshold: -2.0,
    minHumidity: 60.0,
    targetHumidity: 68.0,
    maxHumidity: 70.0,
    maxCo2Ppm: 1800,
    co2WarningPpm: 1300,
    maxEthylenePpm: 0.03,
    ethyleneSensitivity: 'High',
    maxAmmoniaPpm: 6.5,
    maxEthanolPpm: 2.5,
    recommendedAch: 1.8,
    airVelocityMs: '0.20 - 0.35 m/s',
    maxStorageLife: '6 - 9 Months',
    stackingDensityTonnesM3: 0.50,
    guidance: 'Like onions, garlic MUST be kept in dry air (60-70% RH). Avoid the 5°C to 15°C temperature zone at all costs, as this range rapidly triggers clove sprouting and rooting! Keep either cold (-1°C to 0°C) or room temperature (above 20°C).',
    physiologicalHazards: [
      {
        title: 'Sprout Induction Danger Zone',
        description: 'Holding between 5°C and 15°C immediately induces rapid sprouting, ruining commercial value.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Place humidity nodes inside storage bins to verify humidity does not spike above 70% RH.'
    ]
  },

  'strawberries-fresh': {
    id: 'strawberries-fresh',
    name: 'Strawberries & Berries (Pre-Cooled Cold Chain)',
    variety: 'Albion, Camarosa, Monterey, San Andreas',
    scientificName: 'Fragaria ananassa',
    category: 'Berry',
    icon: '🍓',
    minTemp: 0.0,
    targetTemp: 0.5,
    maxTemp: 2.0,
    freezingPoint: -0.8,
    chillingInjuryThreshold: -0.2,
    minHumidity: 90.0,
    targetHumidity: 94.0,
    maxHumidity: 98.0,
    maxCo2Ppm: 15000, // Strawberries benefit from elevated CO2 (10-15%) to suppress Botrytis!
    co2WarningPpm: 20000,
    maxEthylenePpm: 0.05,
    ethyleneSensitivity: 'Moderate',
    maxAmmoniaPpm: 4.0,
    maxEthanolPpm: 4.5,
    recommendedAch: 2.5,
    airVelocityMs: '0.15 - 0.25 m/s',
    maxStorageLife: '7 - 14 Days',
    stackingDensityTonnesM3: 0.30,
    guidance: 'Perishable cold chain critical! Rapid forced-air cooling within 2 hours of harvest to 0°C is required. Unique characteristic: Strawberries benefit from modified atmosphere with 10-15% CO2 (100,000-150,000 ppm in pallet shrouds) which directly suppresses Botrytis grey mold and retains firmness without off-flavor.',
    physiologicalHazards: [
      {
        title: 'Botrytis Cinerea (Grey Mold)',
        description: 'Fastest postharvest pathogen; doubles decay rate for every 2°C rise above 0°C.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Install fast-response thermistors on cooling pallet return airstream.',
      'Monitor pallet containment covers for seal integrity.'
    ]
  },

  'mangoes-holding': {
    id: 'mangoes-holding',
    name: 'Mangoes (Holding & Shipping)',
    variety: 'Tommy Atkins, Kent, Keitt, Alphonso, Kesar',
    scientificName: 'Mangifera indica',
    category: 'Tropical Fruit',
    icon: '🥭',
    minTemp: 11.5,
    targetTemp: 13.0,
    maxTemp: 14.5,
    freezingPoint: -1.0,
    chillingInjuryThreshold: 11.0,
    minHumidity: 88.0,
    targetHumidity: 92.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 3000,
    co2WarningPpm: 2200,
    maxEthylenePpm: 0.05,
    ethyleneSensitivity: 'High Producer',
    maxAmmoniaPpm: 5.0,
    maxEthanolPpm: 3.5,
    recommendedAch: 1.5,
    airVelocityMs: '0.15 - 0.25 m/s',
    maxStorageLife: '3 - 4 Weeks',
    stackingDensityTonnesM3: 0.45,
    guidance: 'Tropical commodity with severe chilling sensitivity below 11.0°C! Chilling injury results in greyish scald-like skin discoloration, sunken pits, uneven ripening, flesh browning, and off-flavor synthesis.',
    physiologicalHazards: [
      {
        title: 'Chilling Scald (<11°C)',
        description: 'Lenticel spotting, pitting, internal pulp breakdown, and anthracnose infection susceptibility.',
        severity: 'critical'
      }
    ],
    nodePlacementTips: [
      'Never allow cold coil supply air below 11.5°C; place temperature sensors directly at evaporator fan mouth.'
    ]
  }
};

export interface AiNodePlacement {
  id: string;
  name: string;
  role: string;
  tag: 'reference' | 'core' | 'infiltration' | 'deadzone' | 'stratification' | 'aisle';
  coordinates: {
    x: number;       // meters from left wall (0 -> Length)
    y: number;       // meters from back wall (0 -> Width)
    z: number;       // height in meters from floor (0 -> Height)
    xPct: number;    // % from 0 to 100
    yPct: number;    // % from 0 to 100
    zPct: number;    // % from 0 to 100
  };
  recommendedSensors: string[];
  priority: 'Critical' | 'High' | 'Recommended';
  rationale: string;
  installationTip: string;
  hazardsMonitored: string[];
}

export interface AiPlacementPlan {
  roomDimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'm' | 'ft';
    floorAreaM2: number;
    volumeM3: number;
  };
  crop: CropSafeParameters;
  stackingMethod: 'pallet_racks' | 'bulk_pile' | 'wooden_bins' | 'silo';
  coolingUnitPosition: 'north_wall' | 'south_wall' | 'ceiling_center' | 'east_wall';
  doorPosition: 'south_wall' | 'north_wall' | 'east_wall' | 'west_wall';
  tonnageEstimate: number;
  fillPercentage: number;
  recommendedNodeCount: number;
  nodes: AiNodePlacement[];
  airflowAnalysis: {
    supplyThrowMeters: number;
    estimatedAirExchangeHours: number;
    stagnationRiskScore: 'Low' | 'Moderate' | 'High';
    deadZoneLocations: string[];
  };
  summaryRecommendation: string;
}

// AI Node Positioning Calculation Engine
export function calculateOptimalNodePlacements(params: {
  length: number;
  width: number;
  height: number;
  unit: 'm' | 'ft';
  cropId: string;
  customCrop?: Partial<CropSafeParameters>;
  stackingMethod: 'pallet_racks' | 'bulk_pile' | 'wooden_bins' | 'silo';
  coolingUnitPosition: 'north_wall' | 'south_wall' | 'ceiling_center' | 'east_wall';
  doorPosition: 'south_wall' | 'north_wall' | 'east_wall' | 'west_wall';
  fillPercentage: number;
}): AiPlacementPlan {
  // Normalize to meters for calculations
  const unitFactor = params.unit === 'ft' ? 0.3048 : 1.0;
  const l = params.length * unitFactor;
  const w = params.width * unitFactor;
  const h = params.height * unitFactor;
  
  const floorAreaM2 = Math.round(l * w * 10) / 10;
  const volumeM3 = Math.round(l * w * h * 10) / 10;
  
  const crop = (params.cropId === 'custom' && params.customCrop
    ? { ...CROP_DATABASE['potatoes-processing'], ...params.customCrop, id: 'custom', name: params.customCrop.name || 'Custom Produce' }
    : CROP_DATABASE[params.cropId]) || CROP_DATABASE['potatoes-processing'];

  // Calculate produce weight stored
  const tonnageEstimate = Math.round(volumeM3 * (params.fillPercentage / 100) * (crop.stackingDensityTonnesM3 || 0.6));

  // Determine optimal number of nodes based on facility aerodynamics
  let nodeCount = 3;
  if (volumeM3 < 120) {
    nodeCount = 2; // small room
  } else if (volumeM3 <= 450) {
    nodeCount = 3; // medium room
  } else if (volumeM3 <= 1000) {
    nodeCount = 4; // commercial room
  } else if (volumeM3 <= 2500) {
    nodeCount = 5; // large vault
  } else {
    nodeCount = 6; // industrial mega storage
  }

  const nodes: AiNodePlacement[] = [];

  // 1. NODE 1: RETURN AIR REFERENCE NODE
  // Positioned directly on the wall holding the cooling evaporator return air grille (at 75-80% height)
  let n1X = l * 0.5;
  let n1Y = w * 0.1;
  if (params.coolingUnitPosition === 'south_wall') {
    n1Y = w * 0.9;
  } else if (params.coolingUnitPosition === 'east_wall') {
    n1X = l * 0.9;
    n1Y = w * 0.5;
  }
  const n1Z = Math.min(h * 0.78, h - 0.4);

  nodes.push({
    id: 'node-01-return-air',
    name: 'Node 1: Return Air Reference',
    role: 'Primary HVAC Return & Integrated Respiration Benchmark',
    tag: 'reference',
    coordinates: {
      x: Math.round(n1X * 100) / 100,
      y: Math.round(n1Y * 100) / 100,
      z: Math.round(n1Z * 100) / 100,
      xPct: Math.round((n1X / l) * 100),
      yPct: Math.round((n1Y / w) * 100),
      zPct: Math.round((n1Z / h) * 100)
    },
    recommendedSensors: ['High-Precision SHT31 / DS18B20 Temp', 'Capacitive Humidity RH%', 'NDIR CO2 Sensor (SCD30/MH-Z19)'],
    priority: 'Critical',
    rationale: 'Placed directly at the suction intake of the evaporator coil. This measures the bulk blended air returning from the entire produce mass, giving the most reliable overall vault temperature and integrated biological respiration CO2 rate without false readings from direct cooling discharge blasts.',
    installationTip: 'Mount 40cm below the evaporator return grille using a vibration-damped bracket. Do not position in direct front of blower discharge.',
    hazardsMonitored: ['Overall Vault Thermal Drift', 'Bulk Respiration CO2 Accumulation', 'HVAC Cycle Short-Cycling']
  });

  // 2. NODE 2: DEEP CORE / BIOLOGICAL HOTSPOT NODE
  // Embedded deep in the center pile or center pallet rack at 35-40% height
  const n2X = l * 0.5;
  const n2Y = w * 0.5;
  const n2Z = Math.max(0.8, h * 0.35);

  nodes.push({
    id: 'node-02-core-hotspot',
    name: 'Node 2: Internal Core Hotspot',
    role: 'Biological Core Respiration & Anaerobic Decay Detection',
    tag: 'core',
    coordinates: {
      x: Math.round(n2X * 100) / 100,
      y: Math.round(n2Y * 100) / 100,
      z: Math.round(n2Z * 100) / 100,
      xPct: Math.round((n2X / l) * 100),
      yPct: Math.round((n2Y / w) * 100),
      zPct: Math.round((n2Z / h) * 100)
    },
    recommendedSensors: ['Stainless Steel Penetration Temp Probe (DS18B20)', 'MQ-135 (NH3/Ammonia Spoilage)', 'MQ-3 (Ethanol/Fermentation VOC)'],
    priority: 'Critical',
    rationale: `The geometric center of the stored produce has the poorest natural convective cooling. Respiration heat builds up here first. If rot or anaerobic fermentation begins (soft rot in ${crop.name}), temperature spikes and alcohol/ammonia volatile gases emit here 48-72 hours before any visible signs appear on the outer crates.`,
    installationTip: 'Insert a 1-meter stainless steel penetration probe horizontally between pallet crates into the core mass, connecting back to the wall-mounted wireless transmitter.',
    hazardsMonitored: ['Self-Accelerating Biological Hotspots', 'Anaerobic Alcoholic Fermentation', 'Soft Rot Bacterial Breakdown']
  });

  // 3. NODE 3: INFILTRATION & CONDENSATION BARRIER NODE
  // Positioned near primary access door at 1.5m height
  let n3X = l * 0.2;
  let n3Y = w * 0.85;
  if (params.doorPosition === 'north_wall') {
    n3Y = w * 0.15;
  } else if (params.doorPosition === 'east_wall') {
    n3X = l * 0.85;
    n3Y = w * 0.3;
  } else if (params.doorPosition === 'west_wall') {
    n3X = l * 0.15;
    n3Y = w * 0.3;
  }
  const n3Z = Math.min(1.6, h * 0.4);

  nodes.push({
    id: 'node-03-door-infiltration',
    name: 'Node 3: Infiltration & Dew-Point Barrier',
    role: 'Door Ingress Thermal Shock & Condensation Monitoring',
    tag: 'infiltration',
    coordinates: {
      x: Math.round(n3X * 100) / 100,
      y: Math.round(n3Y * 100) / 100,
      z: Math.round(n3Z * 100) / 100,
      xPct: Math.round((n3X / l) * 100),
      yPct: Math.round((n3Y / w) * 100),
      zPct: Math.round((n3Z / h) * 100)
    },
    recommendedSensors: ['Fast-Response Temp/RH (SHT31)', 'Surface Condensation Optical Sensor'],
    priority: nodeCount >= 3 ? 'Critical' : 'Recommended',
    rationale: 'Every time loading doors open for forklifts or crate inspection, warm outside humid air rushes in. When humid air contacts cold crop surfaces, moisture condenses instantly. Free water films are the #1 catalyst for fungal spore germination and Erwinia bacterial soft rot.',
    installationTip: 'Mount 1.8 meters inside the doorway on the adjacent wall, facing the aisle at eye level (1.5m).',
    hazardsMonitored: ['Door Seal Infiltration Heat Leaks', 'Dew-Point Condensation Wetting', 'Forklift Traffic Thermal Shock']
  });

  // 4. NODE 4: DEAD AIR & SPOILAGE GAS POOL NODE
  // Positioned in the aerodynamic shadow corner opposite the cooling unit
  if (nodeCount >= 4) {
    let n4X = l * 0.85;
    let n4Y = w * 0.85;
    if (params.coolingUnitPosition === 'south_wall') {
      n4Y = w * 0.15;
    }
    const n4Z = Math.min(1.2, h * 0.3);

    nodes.push({
      id: 'node-04-dead-air-corner',
      name: 'Node 4: Dead-Air & Gas Stagnation Zone',
      role: 'Microclimate Shadow & Heavy Volatile Gas Trap',
      tag: 'deadzone',
      coordinates: {
        x: Math.round(n4X * 100) / 100,
        y: Math.round(n4Y * 100) / 100,
        z: Math.round(n4Z * 100) / 100,
        xPct: Math.round((n4X / l) * 100),
        yPct: Math.round((n4Y / w) * 100),
        zPct: Math.round((n4Z / h) * 100)
      },
      recommendedSensors: ['SGP30 VOC / Ethylene Sensor', 'MQ-135 Gas Sensor', 'Air Velocity Anemometer Probe'],
      priority: 'High',
      rationale: 'Located in the aerodynamic dead zone where cooling throw velocity drops below 0.1 m/s. Heavy gases (CO2 is 1.5x heavier than air; ethylene and mold spores) pool in these corners, triggering localized premature ripening and fungal nesting.',
      installationTip: 'Place in the far lower corner 0.8m above floor level, shielded from direct floor sweeping.',
      hazardsMonitored: ['Ethylene Stratification Pockets', 'CO2 Pooling Asphyxiation', 'Microclimate Mold Nesting']
    });
  }

  // 5. NODE 5: UPPER THERMAL STRATIFICATION CROWN NODE
  if (nodeCount >= 5) {
    const n5X = l * 0.3;
    const n5Y = w * 0.5;
    const n5Z = Math.min(h - 0.5, h * 0.88);

    nodes.push({
      id: 'node-05-ceiling-crown',
      name: 'Node 5: Upper Thermal Stratification',
      role: 'Ceiling Heat Ingress & Thermal Gradient Analysis',
      tag: 'stratification',
      coordinates: {
        x: Math.round(n5X * 100) / 100,
        y: Math.round(n5Y * 100) / 100,
        z: Math.round(n5Z * 100) / 100,
        xPct: Math.round((n5X / l) * 100),
        yPct: Math.round((n5Y / w) * 100),
        zPct: Math.round((n5Z / h) * 100)
      },
      recommendedSensors: ['Digital Thermometer (DS18B20)', 'High-Range RH% Sensor'],
      priority: 'Recommended',
      rationale: 'Solar radiation and roof heat transfer create a warm buoyant air layer beneath the ceiling. This node continuously measures delta-T between ceiling crown and floor level to detect stratification and guide destratification fan speed.',
      installationTip: 'Suspend 40-50cm below ceiling roof deck away from direct light fixtures.',
      hazardsMonitored: ['Roof Thermal Ingress', 'Ceiling Drip / Dew Formation', 'Top-Layer Crop Dehydration']
    });
  }

  // 6. NODE 6: INTERMEDIATE FORKLIFT AISLE / MIDWAY MESH NODE
  if (nodeCount >= 6) {
    const n6X = l * 0.75;
    const n6Y = w * 0.35;
    const n6Z = Math.max(1.5, h * 0.5);

    nodes.push({
      id: 'node-06-intermediate-aisle',
      name: 'Node 6: Intermediate Aisle & Mesh Repeater',
      role: 'Cross-Ventilation Gradient & Wireless Mesh Bridge',
      tag: 'aisle',
      coordinates: {
        x: Math.round(n6X * 100) / 100,
        y: Math.round(n6Y * 100) / 100,
        z: Math.round(n6Z * 100) / 100,
        xPct: Math.round((n6X / l) * 100),
        yPct: Math.round((n6Y / w) * 100),
        zPct: Math.round((n6Z / h) * 100)
      },
      recommendedSensors: ['Temp / Humidity Sensor', 'ESP-NOW / Zigbee Mesh Router'],
      priority: 'Recommended',
      rationale: 'In large warehouses over 1,500 m³, physical pallet bulk blocks RF radio signals and creates mid-aisle airflow turbulence. This node fills the spatial coverage gap and acts as an ESP-NOW wireless repeating node.',
      installationTip: 'Mount to central structural column or pallet racking upright at 2.0m height with protective bollard bracket.',
      hazardsMonitored: ['Mid-Vault Airflow Stagnation', 'RF Signal Blindspots', 'Rack-to-Rack Temperature Variations']
    });
  }

  // Calculate airflow metrics
  const supplyThrowMeters = Math.round(l * 0.75 * 10) / 10;
  const stagnationRisk = volumeM3 > 800 && nodeCount < 4 ? 'High' : volumeM3 > 400 ? 'Moderate' : 'Low';

  return {
    roomDimensions: {
      length: params.length,
      width: params.width,
      height: params.height,
      unit: params.unit,
      floorAreaM2,
      volumeM3
    },
    crop,
    stackingMethod: params.stackingMethod,
    coolingUnitPosition: params.coolingUnitPosition,
    doorPosition: params.doorPosition,
    tonnageEstimate,
    fillPercentage: params.fillPercentage,
    recommendedNodeCount: nodes.length,
    nodes,
    airflowAnalysis: {
      supplyThrowMeters,
      estimatedAirExchangeHours: Math.round((volumeM3 / (floorAreaM2 * 12)) * 10) / 10,
      stagnationRiskScore: stagnationRisk,
      deadZoneLocations: [
        'Far corner opposite evaporator return',
        'Floor boundary behind lower pallet tiers',
        'Directly above doorway threshold'
      ]
    },
    summaryRecommendation: `For ${crop.name} in a ${params.length}×${params.width}×${params.height}${params.unit} vault (${volumeM3} m³ holding approx. ${tonnageEstimate} tonnes), AgriVault AI recommends deploying ${nodes.length} synchronized wireless nodes. This eliminates blind spots across your ${floorAreaM2} m² footprint, continuously guarding against ${crop.physiologicalHazards[0]?.title || 'biological spoilage'}.`
  };
}
