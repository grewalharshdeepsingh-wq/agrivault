// Multi-Sensor Spatial Gas Dispersion & Biochemical Decay Triangulation Engine
// Computes 3D spatial concentration gradient vectors (\nabla C) to pinpoint gas plume direction
// and matches multi-gas volatile emission signatures to classify specific decay types.

export interface SensorSpatialReading {
  nodeId: string;
  nodeName: string;
  x: number; // meters
  y: number; // meters
  z: number; // meters
  temperature: number; // °C
  humidity: number;    // %
  co2: number;         // ppm
  ammonia: number;     // ppm
  ethanol: number;     // ppm
  ethylene: number;    // ppm
  rateOfChange?: number; // ppm/min
}

export type DecayType =
  | 'bacterial_soft_rot'
  | 'anaerobic_fermentation'
  | 'refrigerant_ammonia_leak'
  | 'fungal_dry_rot'
  | 'ethylene_surge_ripening'
  | 'allium_neck_rot'
  | 'gray_mold_condensation'
  | 'nominal_normal';

export interface DecayDiagnostic {
  decayType: DecayType;
  title: string;
  pathogen: string;
  severity: 'critical' | 'high' | 'warning' | 'normal';
  confidenceScore: number; // 0 - 100%
  description: string;
  primaryGasTrigger: string;
  gasSignature: {
    co2Level: 'Normal' | 'Elevated' | 'Critical';
    ammoniaLevel: 'Normal' | 'Elevated' | 'Critical';
    ethanolLevel: 'Normal' | 'Elevated' | 'Critical';
    ethyleneLevel: 'Normal' | 'Elevated' | 'Critical';
    thermalAnomaly: number; // delta T in °C
  };
  recommendedActions: string[];
}

export interface GasPlumeDirectionResult {
  // Vector & Cardinal Direction
  gradientVector: { dx: number; dy: number; dz: number };
  bearingDegrees: number;    // 0° = North, 90° = East, 180° = South, 270° = West
  cardinalDirection: string; // e.g. "SE (Southeast)", "NNW", etc.
  elevationAngleDegrees: number; // vertical angle: positive = rising plume, negative = pooling
  dispersionIntensity: 'Trace' | 'Moderate' | 'Severe' | 'Critical Plume';
  gradientSteepnessPpmM: number; // ppm per meter

  // Triangulated Gas Source Origin (Epicenter)
  sourceOrigin: {
    x: number; // meters
    y: number; // meters
    z: number; // meters
    nearestBayLabel: string;
    distanceToClosestNodeM: number;
    closestNodeName: string;
  };
  triangulationConfidence: number; // 0 - 100%

  // Diagnosed Decay Classification
  decayDiagnostic: DecayDiagnostic;

  // Contributing Nodes Ranking
  nodesRankedByExposure: {
    nodeId: string;
    nodeName: string;
    compositeGasIntensity: number;
    distanceToSourceM: number;
  }[];
}

// Convert angle in degrees to 16-point cardinal compass heading
export function degreesToCardinal(deg: number): string {
  const cardinals = [
    'North (N)', 'North-Northeast (NNE)', 'Northeast (NE)', 'East-Northeast (ENE)',
    'East (E)', 'East-Southeast (ESE)', 'Southeast (SE)', 'South-Southeast (SSE)',
    'South (S)', 'South-Southwest (SSW)', 'Southwest (SW)', 'West-Southwest (WSW)',
    'West (W)', 'West-Northwest (WNW)', 'Northwest (NW)', 'North-Northwest (NNW)'
  ];
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return cardinals[index];
}

// 1. PINPOINT GAS PLUME DIRECTION & EPICENTER TRIANGULATION ALGORITHM
export function analyzeMultiSensorGasDispersion(
  readings: SensorSpatialReading[],
  roomBounds: { length: number; width: number; height: number },
  baseline: { co2: number; ammonia: number; ethanol: number; ethylene: number; temp: number } = {
    co2: 500,
    ammonia: 2.0,
    ethanol: 1.5,
    ethylene: 0.05,
    temp: 8.0
  }
): GasPlumeDirectionResult {
  if (!readings || readings.length === 0) {
    throw new Error('No sensor spatial readings provided for gas dispersion calculation.');
  }

  // Calculate composite gas anomaly for each node
  // Weightings: Ethanol (3.0x), Ammonia (3.5x), Ethylene (8.0x), CO2 normalized (1/300x)
  const nodeAnomalies = readings.map((node) => {
    const deltaCo2 = Math.max(0, node.co2 - baseline.co2);
    const deltaAmmonia = Math.max(0, node.ammonia - baseline.ammonia);
    const deltaEthanol = Math.max(0, node.ethanol - baseline.ethanol);
    const deltaEthylene = Math.max(0, node.ethylene - baseline.ethylene);
    const deltaTemp = node.temperature - baseline.temp;

    // Composite volatile score
    const compositeScore =
      deltaEthanol * 3.0 +
      deltaAmmonia * 3.5 +
      deltaEthylene * 12.0 +
      (deltaCo2 / 150) +
      Math.max(0, deltaTemp) * 1.5;

    return {
      node,
      deltaCo2,
      deltaAmmonia,
      deltaEthanol,
      deltaEthylene,
      deltaTemp,
      compositeScore
    };
  });

  // Sort nodes by anomaly score
  nodeAnomalies.sort((a, b) => b.compositeScore - a.compositeScore);
  const maxScore = nodeAnomalies[0].compositeScore;

  // 2. Spatial Concentration Gradient Vector (\nabla C)
  // Summing directed distance-weighted difference vectors across all sensor pairs:
  let gradX = 0;
  let gradY = 0;
  let gradZ = 0;
  let totalWeight = 0;

  for (let i = 0; i < nodeAnomalies.length; i++) {
    for (let j = 0; j < nodeAnomalies.length; j++) {
      if (i === j) continue;
      const ni = nodeAnomalies[i];
      const nj = nodeAnomalies[j];

      const dx = nj.node.x - ni.node.x;
      const dy = nj.node.y - ni.node.y;
      const dz = nj.node.z - ni.node.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

      // Concentration differential from lower to higher
      const dScore = nj.compositeScore - ni.compositeScore;
      if (dScore > 0) {
        const weight = (dScore / dist) / dist;
        gradX += (dx / dist) * weight;
        gradY += (dy / dist) * weight;
        gradZ += (dz / dist) * weight;
        totalWeight += weight;
      }
    }
  }

  if (totalWeight > 0) {
    gradX /= totalWeight;
    gradY /= totalWeight;
    gradZ /= totalWeight;
  }

  // 3. Compass Bearing Calculation (0° = North / +Y, 90° = East / +X, etc.)
  // Note: in room coordinates: X = Left to Right (East), Y = Back to Front (South)
  const rad = Math.atan2(gradX, -gradY); // standard navigation bearing
  let bearingDeg = Math.round((rad * 180) / Math.PI);
  if (bearingDeg < 0) bearingDeg += 360;

  const elevationRad = Math.atan2(gradZ, Math.sqrt(gradX * gradX + gradY * gradY) || 0.001);
  const elevationDeg = Math.round((elevationRad * 180) / Math.PI);

  // 4. Source Origin (Epicenter) Pinpointing via Non-linear Weighted Trilateration
  let sumWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;

  nodeAnomalies.forEach(({ node, compositeScore }) => {
    // Power weighting (score^2.2) to strongly attract toward peak reading node
    const w = Math.pow(Math.max(0.1, compositeScore), 2.2);
    weightedX += node.x * w;
    weightedY += node.y * w;
    weightedZ += node.z * w;
    sumWeight += w;
  });

  let sourceX = sumWeight > 0 ? weightedX / sumWeight : roomBounds.length / 2;
  let sourceY = sumWeight > 0 ? weightedY / sumWeight : roomBounds.width / 2;
  let sourceZ = sumWeight > 0 ? weightedZ / sumWeight : roomBounds.height / 2;

  // Apply gradient bias push: If gradient is steep, project source slightly beyond highest node
  if (maxScore > 2.0 && totalWeight > 0) {
    const highestNode = nodeAnomalies[0].node;
    sourceX = sourceX * 0.7 + highestNode.x * 0.3 + gradX * 0.4;
    sourceY = sourceY * 0.7 + highestNode.y * 0.3 + gradY * 0.4;
    sourceZ = sourceZ * 0.7 + highestNode.z * 0.3 + gradZ * 0.2;
  }

  // Clamp within actual physical room boundaries
  sourceX = Math.max(0.3, Math.min(roomBounds.length - 0.3, Math.round(sourceX * 10) / 10));
  sourceY = Math.max(0.3, Math.min(roomBounds.width - 0.3, Math.round(sourceY * 10) / 10));
  sourceZ = Math.max(0.3, Math.min(roomBounds.height - 0.2, Math.round(sourceZ * 10) / 10));

  // Determine closest node to calculated epicenter
  let closestDist = Infinity;
  let closestNode = nodeAnomalies[0].node;
  nodeAnomalies.forEach(({ node }) => {
    const d = Math.sqrt(
      Math.pow(node.x - sourceX, 2) +
      Math.pow(node.y - sourceY, 2) +
      Math.pow(node.z - sourceZ, 2)
    );
    if (d < closestDist) {
      closestDist = d;
      closestNode = node;
    }
  });

  // Map to Bay / Sector description
  const xSector = sourceX < roomBounds.length * 0.33 ? 'West Bay A' : sourceX < roomBounds.length * 0.66 ? 'Center Bay B' : 'East Bay C';
  const ySector = sourceY < roomBounds.width * 0.33 ? 'Rear Wall Racks' : sourceY < roomBounds.width * 0.66 ? 'Mid-Storage Core' : 'Front Doorway Dock';
  const zTier = sourceZ < roomBounds.height * 0.35 ? 'Lower Pallet Tier 1' : sourceZ < roomBounds.height * 0.7 ? 'Mid-Stack Tier 2' : 'Top Crown Tier 3';
  const bayLabel = `${xSector} (${ySector}, ${zTier})`;

  // Triangulation confidence calculation
  const spread = Math.sqrt(Math.pow(gradX, 2) + Math.pow(gradY, 2));
  const confidence = Math.min(98, Math.max(45, Math.round(55 + (maxScore > 5 ? 25 : maxScore * 4) + (nodeAnomalies.length >= 3 ? 15 : 5))));

  // Gradient steepness (ppm equivalent per meter)
  const gradientSteepness = Math.round(spread * 10) / 10;
  const dispersionIntensity =
    maxScore > 25 ? 'Critical Plume' : maxScore > 10 ? 'Severe' : maxScore > 3 ? 'Moderate' : 'Trace';

  // 5. MULTI-GAS DECAY SIGNATURE CLASSIFIER ALGORITHM
  const decayDiagnostic = classifyDecaySignature(nodeAnomalies[0], baseline);

  return {
    gradientVector: {
      dx: Math.round(gradX * 100) / 100,
      dy: Math.round(gradY * 100) / 100,
      dz: Math.round(gradZ * 100) / 100
    },
    bearingDegrees: bearingDeg,
    cardinalDirection: degreesToCardinal(bearingDeg),
    elevationAngleDegrees: elevationDeg,
    dispersionIntensity,
    gradientSteepnessPpmM: gradientSteepness,
    sourceOrigin: {
      x: sourceX,
      y: sourceY,
      z: sourceZ,
      nearestBayLabel: bayLabel,
      distanceToClosestNodeM: Math.round(closestDist * 10) / 10,
      closestNodeName: closestNode.nodeName
    },
    triangulationConfidence: confidence,
    decayDiagnostic,
    nodesRankedByExposure: nodeAnomalies.map((na) => ({
      nodeId: na.node.nodeId,
      nodeName: na.node.nodeName,
      compositeGasIntensity: Math.round(na.compositeScore * 10) / 10,
      distanceToSourceM: Math.round(
        Math.sqrt(
          Math.pow(na.node.x - sourceX, 2) +
          Math.pow(na.node.y - sourceY, 2) +
          Math.pow(na.node.z - sourceZ, 2)
        ) * 10
      ) / 10
    }))
  };
}

// 2. MULTI-GAS VOLATILE BIOCHEMICAL SIGNATURE CLASSIFIER
function classifyDecaySignature(
  peakData: {
    node: SensorSpatialReading;
    deltaCo2: number;
    deltaAmmonia: number;
    deltaEthanol: number;
    deltaEthylene: number;
    deltaTemp: number;
  },
  baseline: { co2: number; ammonia: number; ethanol: number; ethylene: number; temp: number }
): DecayDiagnostic {
  const { node, deltaCo2, deltaAmmonia, deltaEthanol, deltaEthylene, deltaTemp } = peakData;

  const co2Level = node.co2 > 2500 ? 'Critical' : node.co2 > 1200 ? 'Elevated' : 'Normal';
  const ammoniaLevel = node.ammonia > 10.0 ? 'Critical' : node.ammonia > 4.5 ? 'Elevated' : 'Normal';
  const ethanolLevel = node.ethanol > 6.0 ? 'Critical' : node.ethanol > 2.5 ? 'Elevated' : 'Normal';
  const ethyleneLevel = node.ethylene > 0.4 ? 'Critical' : node.ethylene > 0.15 ? 'Elevated' : 'Normal';

  // SIGNATURE 1: REFRIGERANT AMMONIA LEAK (Industrial Hardware Emergency)
  // Extreme Ammonia spike with NO corresponding biological Ethanol or CO2 rise
  if (node.ammonia > 12.0 && deltaEthanol < 1.0 && deltaCo2 < 400) {
    return {
      decayType: 'refrigerant_ammonia_leak',
      title: '🚨 Industrial Anhydrous Ammonia (NH3) Refrigerant Leak',
      pathogen: 'Non-Biological Mechanical Failure (Coil / Valve Seal Rupture)',
      severity: 'critical',
      confidenceScore: 97,
      description: 'Acute spike in ammonia (NH3) without matching biological fermentation volatiles (ethanol/CO2). Indicates a pressurized refrigeration pipeline or evaporator coil leak.',
      primaryGasTrigger: `Ammonia NH3 Surge: ${node.ammonia} ppm (Baseline: ${baseline.ammonia} ppm)`,
      gasSignature: { co2Level, ammoniaLevel: 'Critical', ethanolLevel: 'Normal', ethyleneLevel: 'Normal', thermalAnomaly: deltaTemp },
      recommendedActions: [
        'IMMEDIATE LIFE SAFETY: Evacuate cold storage personnel immediately; do not enter without SCBA gear.',
        'Shut off main liquid line solenoid valves to isolate evaporator coil.',
        'Activate emergency vault exhaust fans to purge hazardous ammonia vapor.'
      ]
    };
  }

  // SIGNATURE 2: BACTERIAL SOFT ROT (Erwinia / Pectobacterium carotovorum)
  // High Ethanol + High Ammonia + Sharp CO2 + Localized Heat Rise
  if (node.ethanol > 3.0 && node.ammonia > 5.0 && (deltaTemp > 0.8 || node.co2 > 1800)) {
    return {
      decayType: 'bacterial_soft_rot',
      title: '🦠 Active Bacterial Soft Rot (Pectobacterium / Erwinia carotovora)',
      pathogen: 'Pectobacterium carotovorum subsp. carotovorum (Erwinia)',
      severity: 'critical',
      confidenceScore: 95,
      description: 'Classic biochemical signature of bacterial maceration: pectin breakdown produces volatile ammonia and alcohol fermentation vapors accompanied by biological self-heating.',
      primaryGasTrigger: `Correlated Ethanol (${node.ethanol} ppm) & Ammonia (${node.ammonia} ppm) with +${Math.round(deltaTemp * 10) / 10}°C Heat Spike`,
      gasSignature: { co2Level, ammoniaLevel, ethanolLevel, ethyleneLevel, thermalAnomaly: deltaTemp },
      recommendedActions: [
        'Isolate the pinpointed pallet stack immediately; bacterial soft rot liquefies adjacent tubers via moisture film dripping within 24 hours.',
        'Quarantine surrounding 3 pallet bays to prevent forklift spore spreading.',
        'Increase continuous drying ventilation across the bay to evaporate free surface moisture.'
      ]
    };
  }

  // SIGNATURE 3: ANAEROBIC FERMENTATION / BLACKHEART ASPHYXIATION
  // Massive Ethanol + Extreme CO2 + Normal/Low Ammonia (Suffocation)
  if (node.ethanol > 4.5 && node.co2 > 2800 && node.ammonia < 5.0) {
    return {
      decayType: 'anaerobic_fermentation',
      title: '⚠️ Deep Core Anaerobic Fermentation & Blackheart Suffocation',
      pathogen: 'Physiological Asphyxiation (Sub-surface Oxygen Starvation)',
      severity: 'critical',
      confidenceScore: 93,
      description: 'Massive surge in alcohol fermentation volatiles (ethanol) and severe CO2 accumulation. Core produce is oxygen-starved due to inadequate air penetration or excessive pile depth.',
      primaryGasTrigger: `Severe Ethanol (${node.ethanol} ppm) & CO2 (${node.co2} ppm) Suffocation Spike`,
      gasSignature: { co2Level: 'Critical', ammoniaLevel: 'Normal', ethanolLevel: 'Critical', ethyleneLevel, thermalAnomaly: deltaTemp },
      recommendedActions: [
        'Trigger maximum fresh-air purge cycle immediately to displace anaerobic gas buildup.',
        'Check sub-floor ventilation air ducts for debris blockages or fan motor trip.',
        'Inspect internal core samples for blackheart internal necrosis.'
      ]
    };
  }

  // SIGNATURE 4: AUTO-CATALYTIC ETHYLENE RIPENING & ACCELERATED SENESCENCE
  // High Ethylene + Rising Respiration without initial Rot Volatiles
  if (node.ethylene > 0.25 && node.ammonia < 4.0 && node.ethanol < 3.0) {
    return {
      decayType: 'ethylene_surge_ripening',
      title: '🍎 Auto-Catalytic Climacteric Ripening & Senescence Surge',
      pathogen: 'Hormonal Ethylene Cascade (Premature Produce Softening)',
      severity: 'warning',
      confidenceScore: 91,
      description: 'Accelerated ethylene emission detected. In climacteric crops (or cross-contamination), ethylene acts as a hormonal trigger, triggering rapid starch breakdown, chlorophyll degradation, and flesh softening.',
      primaryGasTrigger: `Ethylene C2H4 Plume: ${node.ethylene} ppm (Safe limit: ${baseline.ethylene} ppm)`,
      gasSignature: { co2Level, ammoniaLevel: 'Normal', ethanolLevel: 'Normal', ethyleneLevel: 'Critical', thermalAnomaly: deltaTemp },
      recommendedActions: [
        'Engage chemical potassium permanganate (KMnO4) or catalytic ethylene scrubbers.',
        'Verify door seals to ensure ethylene-producing commodities (apples/bananas) are not cross-ventilating.',
        'Lower room setpoint temperature by 0.5°C to retard metabolic respiration.'
      ]
    };
  }

  // SIGNATURE 5: ALLIUM NECK ROT & VOLATILE SULFUR BREAKDOWN
  if (node.ammonia > 6.0 && node.humidity > 75.0) {
    return {
      decayType: 'allium_neck_rot',
      title: '🧅 Allium Neck Rot & Volatile Sulfur Breakdown (Botrytis allii)',
      pathogen: 'Botrytis allii / Aspergillus niger',
      severity: 'high',
      confidenceScore: 89,
      description: 'Volatile ammonia and allicin breakdown detected alongside elevated relative humidity. High moisture triggers fungal spore germination in neck tissues.',
      primaryGasTrigger: `Ammonia (${node.ammonia} ppm) combined with Excessive Humidity (${node.humidity}% RH)`,
      gasSignature: { co2Level, ammoniaLevel: 'Elevated', ethanolLevel: 'Normal', ethyleneLevel, thermalAnomaly: deltaTemp },
      recommendedActions: [
        'Force continuous low-RH ventilation (target 65-70% RH) to dry outer protective skins.',
        'Inspect neck firmness of bulbs in the targeted pallet bay.'
      ]
    };
  }

  // SIGNATURE 6: FUNGAL DRY ROT / LATE BLIGHT
  if (node.co2 > 1600 || node.ethylene > 0.1) {
    return {
      decayType: 'fungal_dry_rot',
      title: '🍄 Early-Stage Fungal Dry Rot & Mycelial Colonization (Fusarium)',
      pathogen: 'Fusarium sambucinum / Phytophthora infestans',
      severity: 'high',
      confidenceScore: 84,
      description: 'Gradual rise in biological CO2 respiration and localized micro-ethylene emission without excessive wet liquefaction. Typical of dry rot necrotic lesions.',
      primaryGasTrigger: `Metabolic Respiration Anomaly: CO2 ${node.co2} ppm with Ethylene ${node.ethylene} ppm`,
      gasSignature: { co2Level: 'Elevated', ammoniaLevel: 'Normal', ethanolLevel: 'Normal', ethyleneLevel: 'Elevated', thermalAnomaly: deltaTemp },
      recommendedActions: [
        'Perform visual core inspection at targeted coordinates for sunken brown corky rot.',
        'Avoid mechanical vibration or jarring of crates which dislodges fungal conidia.'
      ]
    };
  }

  // SIGNATURE 7: CONDENSATION GRAY MOLD
  if (node.humidity > 95.0) {
    return {
      decayType: 'gray_mold_condensation',
      title: '💧 Condensation Risk & Gray Mold Nesting (Botrytis cinerea)',
      pathogen: 'Botrytis cinerea Conidia Germination',
      severity: 'warning',
      confidenceScore: 80,
      description: 'Near dew-point saturation creates free moisture films on produce cuticle, allowing rapid Botrytis nesting.',
      primaryGasTrigger: `Saturation Humidity: ${node.humidity}% RH (Near Dew-Point)`,
      gasSignature: { co2Level: 'Normal', ammoniaLevel: 'Normal', ethanolLevel: 'Normal', ethyleneLevel: 'Normal', thermalAnomaly: deltaTemp },
      recommendedActions: [
        'Increase room circulation fan speed to break boundary layer stagnation.',
        'Check evaporator defrost pan drain line for overflows.'
      ]
    };
  }

  // DEFAULT: NOMINAL STABLE CONDITION
  return {
    decayType: 'nominal_normal',
    title: '🟢 Nominal Storage Atmosphere — Zero Pathogenic Volatiles',
    pathogen: 'None (Healthy Storage Metabolism)',
    severity: 'normal',
    confidenceScore: 99,
    description: 'All sensor nodes report balanced baseline conditions. No anomalous spatial gradients, fermentation volatiles, or pathogen markers detected.',
    primaryGasTrigger: 'All Volatile Analytes Within Baseline Range',
    gasSignature: { co2Level: 'Normal', ammoniaLevel: 'Normal', ethanolLevel: 'Normal', ethyleneLevel: 'Normal', thermalAnomaly: 0 },
    recommendedActions: [
      'Maintain standard automated 24/7 environmental monitoring.',
      'Regular routine inspection as scheduled.'
    ]
  };
}
