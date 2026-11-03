import { Router, Request, Response } from 'express';

const router = Router();

// Crop database on the backend mirroring agricultural post-harvest standards
const CROP_CATALOG: Record<string, any> = {
  'potatoes-processing': {
    id: 'potatoes-processing',
    name: 'Potatoes (Processing / Chipping & French Fry)',
    category: 'Root & Tuber',
    minTemp: 7.0,
    targetTemp: 9.0,
    maxTemp: 10.0,
    minHumidity: 90.0,
    targetHumidity: 93.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 2500,
    maxEthylenePpm: 0.05,
    maxAmmoniaPpm: 6.0,
    maxEthanolPpm: 3.5,
    chillingInjuryWarning: 'Do not store below 7.0°C to prevent Cold-Induced Sweetening (CIS) dark frying sugars and acrylamide.',
    condensationWarning: 'Keep relative humidity high (90-95%) but prevent free water droplets to stop Erwinia bacterial soft rot.'
  },
  'potatoes-seed': {
    id: 'potatoes-seed',
    name: 'Potatoes (Seed Tubers)',
    category: 'Root & Tuber',
    minTemp: 2.5,
    targetTemp: 3.5,
    maxTemp: 4.5,
    minHumidity: 90.0,
    targetHumidity: 93.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 2000,
    maxEthylenePpm: 0.02,
    maxAmmoniaPpm: 5.0,
    maxEthanolPpm: 2.5,
    dormancyPreservation: 'Keep 3.0-4.0°C to preserve apical dormancy. Zero tolerance for ethylene or chemical sprout suppressants.'
  },
  'onions-cured': {
    id: 'onions-cured',
    name: 'Onions (Cured Dry Bulb Storage)',
    category: 'Allium Bulb',
    minTemp: 0.0,
    targetTemp: 0.5,
    maxTemp: 2.0,
    minHumidity: 65.0,
    targetHumidity: 68.0,
    maxHumidity: 72.0,
    maxCo2Ppm: 2000,
    maxEthylenePpm: 0.05,
    maxAmmoniaPpm: 7.5,
    maxEthanolPpm: 3.0,
    dryAirRequirement: 'CRITICAL: Onions require dry air (65-70% RH). RH above 72% causes neck rot (Botrytis allii) and root regrowth.'
  },
  'apples-cold': {
    id: 'apples-cold',
    name: 'Apples (Crisp Cold & CA Storage)',
    category: 'Pome Fruit',
    minTemp: -0.5,
    targetTemp: 0.5,
    maxTemp: 2.0,
    minHumidity: 90.0,
    targetHumidity: 93.0,
    maxHumidity: 95.0,
    maxCo2Ppm: 1500,
    maxEthylenePpm: 0.05,
    maxAmmoniaPpm: 5.0,
    maxEthanolPpm: 3.0,
    ethyleneWarning: 'Apples produce large volumes of ethylene; never cross-store with leafy vegetables or seed potatoes.'
  },
  'bananas-holding': {
    id: 'bananas-holding',
    name: 'Bananas (Green Holding)',
    category: 'Tropical Fruit',
    minTemp: 13.0,
    targetTemp: 13.8,
    maxTemp: 15.0,
    minHumidity: 90.0,
    targetHumidity: 95.0,
    maxHumidity: 98.0,
    maxCo2Ppm: 2500,
    maxEthylenePpm: 0.01,
    maxAmmoniaPpm: 4.0,
    maxEthanolPpm: 3.0,
    chillWarning: 'Never expose to <13.0°C! Chilling injury causes irreversible skin greying and fails to ripen.'
  },
  'wheat-grain': {
    id: 'wheat-grain',
    name: 'Wheat & Grain (Silo Storage)',
    category: 'Cereal Grain',
    minTemp: 4.0,
    targetTemp: 10.0,
    maxTemp: 18.0,
    minHumidity: 50.0,
    targetHumidity: 58.0,
    maxHumidity: 65.0,
    maxCo2Ppm: 1200,
    maxEthylenePpm: 0.0,
    maxAmmoniaPpm: 3.0,
    maxEthanolPpm: 2.0,
    moistureWarning: 'Keep interstitial RH <65% (grain moisture <13.5%) to stop Aspergillus ochratoxin and aflatoxin molds.'
  }
};

// GET /api/ai-planner/crops
router.get('/crops', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    crops: Object.values(CROP_CATALOG)
  });
});

// POST /api/ai-planner/recommend
router.post('/recommend', (req: Request, res: Response) => {
  try {
    const { length = 15, width = 10, height = 5, unit = 'm', cropId = 'potatoes-processing', stackingMethod = 'pallet_racks', coolingUnitPosition = 'north_wall', doorPosition = 'south_wall' } = req.body;

    const unitFactor = unit === 'ft' ? 0.3048 : 1.0;
    const l = Number(length) * unitFactor;
    const w = Number(width) * unitFactor;
    const h = Number(height) * unitFactor;

    const floorArea = Math.round(l * w * 10) / 10;
    const volume = Math.round(l * w * h * 10) / 10;

    const crop = CROP_CATALOG[cropId] || CROP_CATALOG['potatoes-processing'];

    let nodeCount = 3;
    if (volume < 120) nodeCount = 2;
    else if (volume <= 450) nodeCount = 3;
    else if (volume <= 1000) nodeCount = 4;
    else if (volume <= 2500) nodeCount = 5;
    else nodeCount = 6;

    const nodes = [
      {
        id: 'node-01',
        name: 'Node 1: Return Air Reference',
        x: Math.round(l * 0.5 * 10) / 10,
        y: Math.round(w * 0.1 * 10) / 10,
        z: Math.round(Math.min(h * 0.78, h - 0.4) * 10) / 10,
        role: 'Primary HVAC Return & Integrated Respiration Benchmark',
        rationale: 'Measures bulk return air from produce stack before cooling coil conditioning.'
      },
      {
        id: 'node-02',
        name: 'Node 2: Internal Core Hotspot',
        x: Math.round(l * 0.5 * 10) / 10,
        y: Math.round(w * 0.5 * 10) / 10,
        z: Math.round(Math.max(0.8, h * 0.35) * 10) / 10,
        role: 'Biological Core Respiration & Anaerobic Decay Detection',
        rationale: 'Penetration probe in center stack catches self-heating and anaerobic alcohol/ammonia volatile emissions.'
      },
      {
        id: 'node-03',
        name: 'Node 3: Infiltration & Dew-Point Barrier',
        x: Math.round(l * 0.2 * 10) / 10,
        y: Math.round(w * 0.85 * 10) / 10,
        z: Math.round(Math.min(1.6, h * 0.4) * 10) / 10,
        role: 'Door Ingress Thermal Shock & Condensation Monitoring',
        rationale: 'Detects warm humid air ingress and dew-point condensation when loading doors open.'
      }
    ];

    if (nodeCount >= 4) {
      nodes.push({
        id: 'node-04',
        name: 'Node 4: Dead-Air & Stagnation Shadow',
        x: Math.round(l * 0.85 * 10) / 10,
        y: Math.round(w * 0.85 * 10) / 10,
        z: Math.round(Math.min(1.2, h * 0.3) * 10) / 10,
        role: 'Microclimate Shadow & Heavy Volatile Gas Trap',
        rationale: 'Corner where cooling airflow velocity drops below 0.1 m/s; ethylene and heavy CO2 pool here.'
      });
    }

    res.json({
      success: true,
      dimensions: { length, width, height, unit, floorArea, volume },
      crop,
      recommendedNodeCount: nodes.length,
      nodes,
      safeRanges: {
        temperature: { min: crop.minTemp, target: crop.targetTemp, max: crop.maxTemp, unit: '°C' },
        humidity: { min: crop.minHumidity, target: crop.targetHumidity, max: crop.maxHumidity, unit: '%' },
        co2Ppm: { safe: crop.maxCo2Ppm, warning: crop.maxCo2Ppm * 0.85 },
        ethylenePpm: { safe: crop.maxEthylenePpm },
        ammoniaPpm: { safe: crop.maxAmmoniaPpm },
        ethanolPpm: { safe: crop.maxEthanolPpm }
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'AI Planner calculation failed', details: err?.message || String(err) });
  }
});

// POST /api/ai-planner/decay-analysis
// Multi-sensor gradient tracking to pinpoint gas plume direction & decay type
router.post('/decay-analysis', (req: Request, res: Response) => {
  try {
    const { readings = [], roomBounds = { length: 15, width: 10, height: 5 } } = req.body;

    if (!Array.isArray(readings) || readings.length === 0) {
      res.status(400).json({ error: 'Sensor readings array required' });
      return;
    }

    // Compute composite volatile scores
    const nodeScores = readings.map((r: any) => {
      const co2 = Number(r.co2) || 500;
      const nh3 = Number(r.ammonia) || 2.0;
      const eth = Number(r.ethanol) || 1.0;
      const c2h4 = Number(r.ethylene) || 0.05;
      const temp = Number(r.temperature) || 8.0;

      const score = (eth * 3.0) + (nh3 * 3.5) + (c2h4 * 12.0) + (co2 / 200) + Math.max(0, temp - 8.0) * 1.5;
      return { node: r, score, co2, nh3, eth, c2h4, temp };
    });

    nodeScores.sort((a, b) => b.score - a.score);
    const peak = nodeScores[0];

    // Compute spatial gradient vector (\nabla C)
    let gradX = 0;
    let gradY = 0;
    let gradZ = 0;
    let wSum = 0;

    for (let i = 0; i < nodeScores.length; i++) {
      for (let j = 0; j < nodeScores.length; j++) {
        if (i === j) continue;
        const ni = nodeScores[i];
        const nj = nodeScores[j];
        const dx = (nj.node.x || 0) - (ni.node.x || 0);
        const dy = (nj.node.y || 0) - (ni.node.y || 0);
        const dz = (nj.node.z || 0) - (ni.node.z || 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

        const dScore = nj.score - ni.score;
        if (dScore > 0) {
          const w = (dScore / dist) / dist;
          gradX += (dx / dist) * w;
          gradY += (dy / dist) * w;
          gradZ += (dz / dist) * w;
          wSum += w;
        }
      }
    }

    if (wSum > 0) {
      gradX /= wSum;
      gradY /= wSum;
      gradZ /= wSum;
    }

    const rad = Math.atan2(gradX, -gradY);
    let bearingDeg = Math.round((rad * 180) / Math.PI);
    if (bearingDeg < 0) bearingDeg += 360;

    // Weighted source epicenter
    let sumW = 0, wx = 0, wy = 0, wz = 0;
    nodeScores.forEach((ns) => {
      const w = Math.pow(Math.max(0.1, ns.score), 2.2);
      wx += (ns.node.x || 0) * w;
      wy += (ns.node.y || 0) * w;
      wz += (ns.node.z || 0) * w;
      sumW += w;
    });

    const sourceX = sumW > 0 ? Math.round((wx / sumW) * 10) / 10 : roomBounds.length / 2;
    const sourceY = sumW > 0 ? Math.round((wy / sumW) * 10) / 10 : roomBounds.width / 2;
    const sourceZ = sumW > 0 ? Math.round((wz / sumW) * 10) / 10 : roomBounds.height / 2;

    // Classify decay type based on volatile fingerprint
    let decayType = 'nominal';
    let diagnosis = 'Nominal Storage Atmosphere';
    let pathogen = 'None';
    let urgency = 'normal';

    if (peak.nh3 > 12.0 && peak.eth < 1.5 && peak.co2 < 800) {
      decayType = 'refrigerant_ammonia_leak';
      diagnosis = '🚨 Refrigerant Ammonia (NH3) Pipeline Leak';
      pathogen = 'Mechanical Evaporator Coil / Valve Rupture';
      urgency = 'critical';
    } else if (peak.eth > 3.0 && peak.nh3 > 5.0) {
      decayType = 'bacterial_soft_rot';
      diagnosis = '🦠 Active Bacterial Soft Rot (Erwinia carotovora)';
      pathogen = 'Pectobacterium carotovorum (Erwinia)';
      urgency = 'critical';
    } else if (peak.eth > 4.0 && peak.co2 > 2500) {
      decayType = 'anaerobic_fermentation';
      diagnosis = '⚠️ Anaerobic Core Fermentation & Blackheart Suffocation';
      pathogen = 'Physiological Respiration Asphyxiation';
      urgency = 'critical';
    } else if (peak.c2h4 > 0.25) {
      decayType = 'ethylene_surge';
      diagnosis = '🍎 Auto-Catalytic Ethylene Ripening Surge';
      pathogen = 'Climacteric Senescence Cascade';
      urgency = 'warning';
    }

    res.json({
      success: true,
      bearingDegrees: bearingDeg,
      sourceOrigin: { x: sourceX, y: sourceY, z: sourceZ },
      gradientVector: { dx: gradX, dy: gradY, dz: gradZ },
      decayType,
      diagnosis,
      pathogen,
      urgency,
      peakNode: peak.node.nodeName || peak.node.nodeId
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Decay analysis failed', details: err?.message || String(err) });
  }
});

export default router;
