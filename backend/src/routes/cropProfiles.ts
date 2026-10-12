import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { CropProfile } from '../models/types.js';
import { broadcast } from '../websocket/wsServer.js';

const router = Router();

export const DEFAULT_CROP_PROFILES: Omit<CropProfile, 'created_at' | 'updated_at'>[] = [
  {
    id: 'crop-pot-proc',
    name: 'Potatoes (Processing / French Fry & Chips)',
    variety: 'Russet Burbank, Atlantic, Shepody, Innovator',
    purpose: 'Commercial Processing & Frying',
    storage_stage: 'Holding (Cured)',
    min_temp: 7.0,
    target_temp: 9.0,
    max_temp: 10.0,
    min_humidity: 90.0,
    target_humidity: 93.0,
    max_humidity: 95.0,
    max_co2_ppm: 2500,
    max_ethylene_ppm: 0.05,
    guidance: 'Crucial to prevent temperatures falling below 7.0°C to eliminate Cold-Induced Sweetening (CIS). CIS converts starches into reducing sugars (glucose/fructose) leading to dark acrylamide streaks upon high-temperature frying. Maintain pile delta-T within 0.5-1.0°C. High RH (>90%) prevents weight loss and pressure bruising while condensation must be strictly prevented to stop Erwinia soft rot. CO2 must be vented periodically below 2500 ppm to avoid blackheart physiological necrosis.',
    sources: 'Potato Association of America (PAA) Commercial Potato Storage Guidelines; USDA Agricultural Handbook No. 66; Univ. of Idaho Extension Bul. 803.',
    notes: 'Airflow delivery recommended at 15-20 CFM/ton. Do not apply sprout inhibitors before suberization wound healing is complete (typically 14-21 days at 12-15°C).',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-pot-seed',
    name: 'Potatoes (Seed Tubers)',
    variety: 'All Seed Stock Varieties',
    purpose: 'Seed Propagation & Sprout Suppression',
    storage_stage: 'Dormancy Preservation',
    min_temp: 2.5,
    target_temp: 3.5,
    max_temp: 4.5,
    min_humidity: 90.0,
    target_humidity: 93.0,
    max_humidity: 95.0,
    max_co2_ppm: 2000,
    max_ethylene_ppm: 0.02,
    guidance: 'Low holding temperature (3.0-4.0°C) is required to sustain apical dormancy, prevent premature sprout elongation, and preserve carbohydrate reserves for vigorous field emergence. Zero tolerance for free moisture/condensation on tubers which spreads silver scurf (Helminthosporium solani) and bacterial soft rot.',
    sources: 'FAO Post-Harvest Compendium: Potato Production & Storage; Scottish Agricultural College Technical Guide; Wageningen University Potato Standards.',
    notes: 'Never expose seed tubers to ethylene or chemical sprout inhibitors (CIPC/DMN) as this destroys planting vigor.',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-pot-table',
    name: 'Potatoes (Fresh Table Market)',
    variety: 'Yukon Gold, Red Pontiac, Kennebec, Norland',
    purpose: 'Fresh Retail & Culinary Distribution',
    storage_stage: 'Long-term Cold Holding',
    min_temp: 4.0,
    target_temp: 5.0,
    max_temp: 7.0,
    min_humidity: 92.0,
    target_humidity: 95.0,
    max_humidity: 98.0,
    max_co2_ppm: 3000,
    max_ethylene_ppm: 0.1,
    guidance: 'Maintained at 4.0-5.0°C to retard sprouting without requiring excessive chemical treatment. Green skin pigmentation (chlorophyll & solanine glycoalkaloid toxicity) occurs rapidly if exposed to ambient light; storage rooms must remain completely dark.',
    sources: 'USDA ARS Postharvest Quality Guidelines; Cornell Cooperative Extension Vegetable Storage Manual.',
    notes: 'If storing without chemical sprout inhibitors, keep temperature strictly at 4.0°C.',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-wheat-silo',
    name: 'Wheat (Bulk Grain Silo / Storage)',
    variety: 'Hard Red Winter, Soft White, Durum',
    purpose: 'Flour Milling & Food Grain Storage',
    storage_stage: 'Aerated Silo Storage',
    min_temp: 4.0,
    target_temp: 12.0,
    max_temp: 18.0,
    min_humidity: 50.0,
    target_humidity: 60.0,
    max_humidity: 65.0,
    max_co2_ppm: 1200,
    max_ethylene_ppm: 0.0,
    guidance: 'Grain equilibrium moisture content (EMC) must remain strictly below 13.5% (corresponding to interstitial RH <65%). Relative humidity above 65% triggers fungal spore germination (Aspergillus glaucus, Penicillium verrucosum) producing ochratoxin A mycotoxins. Grain temperature above 18°C promotes rusty grain beetle (Cryptolestes ferrugineus) and granary weevil proliferation.',
    sources: 'USDA Grain Inspection, Packers and Stockyards Administration (GIPSA); Kansas State University Post-Harvest Grain Management Guide; FAO Grain Storage Bul. 109.',
    notes: 'Run aeration fans only when ambient relative humidity is low enough to prevent moisture migration.',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-rice-paddy',
    name: 'Rice (Paddy / Rough Grain)',
    variety: 'Indica, Japonica, Basmati Paddy',
    purpose: 'Milling & Grain Preservation',
    storage_stage: 'Bulk Paddy Storage',
    min_temp: 10.0,
    target_temp: 14.0,
    max_temp: 18.0,
    min_humidity: 55.0,
    target_humidity: 62.0,
    max_humidity: 68.0,
    max_co2_ppm: 1200,
    max_ethylene_ppm: 0.0,
    guidance: 'Target moisture content 12.0-13.0%. High temperatures (>20°C) and RH (>70%) cause kernel yellowing, fatty acid breakdown leading to rancidity, and kernel fissuring which severely lowers head rice milling yield.',
    sources: 'International Rice Research Institute (IRRI) Post-Harvest Knowledge Bank; FAO Agricultural Services Bulletin 109.',
    notes: 'Monitor vertical temperature cables for biological hot spots caused by grain respiration.',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-maize-grain',
    name: 'Maize / Corn (Shelled Grain)',
    variety: 'Yellow Dent, Flint Corn',
    purpose: 'Livestock Feed, Starch, Processing',
    storage_stage: 'Silo Holding',
    min_temp: 5.0,
    target_temp: 12.0,
    max_temp: 18.0,
    min_humidity: 55.0,
    target_humidity: 60.0,
    max_humidity: 65.0,
    max_co2_ppm: 1200,
    max_ethylene_ppm: 0.0,
    guidance: 'Maximum safe storage moisture is 14.0%. Temperatures exceeding 18°C combined with relative humidity above 65% create extreme risk of Aspergillus flavus growth and aflatoxin biosynthesis. Aflatoxin concentrations above 20 ppb violate FDA food/feed safety regulations.',
    sources: 'Purdue University Extension Grain Storage Systems; FAO Agricultural Bul. 110: Maize Post-Harvest.',
    notes: 'Regular temperature cable core sampling required every 7 days.',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-onion-cured',
    name: 'Onions (Dry Bulb Storage)',
    variety: 'Yellow Spanish, Red Baron, Sweet Spanish',
    purpose: 'Long-term Winter Storage',
    storage_stage: 'Cold Dry Holding',
    min_temp: 0.0,
    target_temp: 0.5,
    max_temp: 2.0,
    min_humidity: 65.0,
    target_humidity: 68.0,
    max_humidity: 72.0,
    max_co2_ppm: 2000,
    max_ethylene_ppm: 0.05,
    guidance: 'CRITICAL: Onions require low relative humidity (65-70%) unlike virtually all other cold store commodities! High humidity triggers root regrowth and creates optimal conditions for neck rot (Botrytis allii) and black mold (Aspergillus niger). Ensure bulbs are completely field/forced-air cured before cold storage.',
    sources: 'UC Davis Postharvest Technology Center - Onion Storage; Michigan State University Extension Bul. E-2169.',
    notes: 'Continuous gentle ventilation is essential to purge moisture pockets. Do NOT store adjacent to high-humidity produce.',
    is_default: 1,
    is_custom: 0
  },
  {
    id: 'crop-apple-cold',
    name: 'Apples (Cold Storage / CA Holding)',
    variety: 'Gala, Fuji, Honeycrisp, Granny Smith',
    purpose: 'Fresh Fruit Long-term Market',
    storage_stage: 'Controlled / Cold Atmosphere Holding',
    min_temp: -0.5,
    target_temp: 0.5,
    max_temp: 2.0,
    min_humidity: 90.0,
    target_humidity: 93.0,
    max_humidity: 95.0,
    max_co2_ppm: 1500,
    max_ethylene_ppm: 1.0,
    guidance: 'Store between -0.5°C and 1.0°C to minimize respiration. High RH (90-95%) prevents shrivel while maintaining crispness. Apples are heavy ethylene producers and highly susceptible to ethylene-driven softening and physiological disorders (superficial scald, bitter pit). Ethylene scrubbing or 1-MCP treatment is standard practice.',
    sources: 'Washington State University Tree Fruit Research & Extension Center; USDA Agricultural Handbook 66.',
    notes: 'Chilling-sensitive varieties such as Honeycrisp require conditioning at 10°C for 7 days before chilling to avoid soggy breakdown.',
    is_default: 1,
    is_custom: 0
  }
];

// Helper to seed defaults if table is empty
export function initDefaultCropProfiles(): void {
  const count = db.get<{ count: number }>('SELECT count(*) as count FROM crop_profiles');
  if (!count || count.count === 0) {
    const now = new Date().toISOString();
    for (const p of DEFAULT_CROP_PROFILES) {
      db.run(
        `INSERT INTO crop_profiles (
          id, name, variety, purpose, storage_stage, min_temp, target_temp, max_temp,
          min_humidity, target_humidity, max_humidity, max_co2_ppm, max_ethylene_ppm,
          guidance, sources, notes, is_default, is_custom, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.name, p.variety, p.purpose, p.storage_stage, p.min_temp, p.target_temp, p.max_temp,
        p.min_humidity, p.target_humidity, p.max_humidity, p.max_co2_ppm, p.max_ethylene_ppm,
        p.guidance, p.sources, p.notes, 1, 0, now, now
      );
    }
  }
}

// GET /api/crop-profiles
router.get('/', (req: Request, res: Response): void => {
  initDefaultCropProfiles();
  const profiles = db.all<CropProfile>('SELECT * FROM crop_profiles ORDER BY is_default DESC, name ASC');
  res.json(profiles);
});

// GET /api/crop-profiles/:id
router.get('/:id', (req: Request, res: Response): void => {
  initDefaultCropProfiles();
  const profile = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE id = ?', req.params.id);
  if (!profile) {
    res.status(404).json({ error: 'Crop profile not found' });
    return;
  }
  res.json(profile);
});

// POST /api/crop-profiles
router.post('/', (req: Request, res: Response): void => {
  const {
    name, variety, purpose, storage_stage,
    min_temp, target_temp, max_temp,
    min_humidity, target_humidity, max_humidity,
    max_co2_ppm, max_ethylene_ppm,
    guidance, sources, notes
  } = req.body;

  if (!name || min_temp === undefined || max_temp === undefined || min_humidity === undefined || max_humidity === undefined) {
    res.status(400).json({ error: 'Missing required crop profile fields (name, temperature limits, humidity limits)' });
    return;
  }

  const id = `crop-custom-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO crop_profiles (
      id, name, variety, purpose, storage_stage, min_temp, target_temp, max_temp,
      min_humidity, target_humidity, max_humidity, max_co2_ppm, max_ethylene_ppm,
      guidance, sources, notes, is_default, is_custom, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
    id, name, variety || '', purpose || 'Custom Storage', storage_stage || 'Holding',
    Number(min_temp), Number(target_temp ?? (Number(min_temp) + Number(max_temp)) / 2), Number(max_temp),
    Number(min_humidity), Number(target_humidity ?? (Number(min_humidity) + Number(max_humidity)) / 2), Number(max_humidity),
    max_co2_ppm !== undefined ? Number(max_co2_ppm) : null,
    max_ethylene_ppm !== undefined ? Number(max_ethylene_ppm) : null,
    guidance || 'Custom crop storage profile configured by facility operator.',
    sources || 'Facility internal standard operating procedure.',
    notes || '',
    now, now
  );

  const created = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE id = ?', id);
  broadcast('crop_profile_created', created);
  res.status(201).json(created);
});

// PUT /api/crop-profiles/:id
router.put('/:id', (req: Request, res: Response): void => {
  const id = req.params.id;
  const existing = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE id = ?', id);
  if (!existing) {
    res.status(404).json({ error: 'Crop profile not found' });
    return;
  }

  const {
    name, variety, purpose, storage_stage,
    min_temp, target_temp, max_temp,
    min_humidity, target_humidity, max_humidity,
    max_co2_ppm, max_ethylene_ppm,
    guidance, sources, notes
  } = req.body;

  const now = new Date().toISOString();

  db.run(
    `UPDATE crop_profiles SET
      name = COALESCE(?, name),
      variety = COALESCE(?, variety),
      purpose = COALESCE(?, purpose),
      storage_stage = COALESCE(?, storage_stage),
      min_temp = COALESCE(?, min_temp),
      target_temp = COALESCE(?, target_temp),
      max_temp = COALESCE(?, max_temp),
      min_humidity = COALESCE(?, min_humidity),
      target_humidity = COALESCE(?, target_humidity),
      max_humidity = COALESCE(?, max_humidity),
      max_co2_ppm = COALESCE(?, max_co2_ppm),
      max_ethylene_ppm = COALESCE(?, max_ethylene_ppm),
      guidance = COALESCE(?, guidance),
      sources = COALESCE(?, sources),
      notes = COALESCE(?, notes),
      is_custom = 1,
      updated_at = ?
    WHERE id = ?`,
    name !== undefined ? name : null,
    variety !== undefined ? variety : null,
    purpose !== undefined ? purpose : null,
    storage_stage !== undefined ? storage_stage : null,
    min_temp !== undefined ? Number(min_temp) : null,
    target_temp !== undefined ? Number(target_temp) : null,
    max_temp !== undefined ? Number(max_temp) : null,
    min_humidity !== undefined ? Number(min_humidity) : null,
    target_humidity !== undefined ? Number(target_humidity) : null,
    max_humidity !== undefined ? Number(max_humidity) : null,
    max_co2_ppm !== undefined ? Number(max_co2_ppm) : null,
    max_ethylene_ppm !== undefined ? Number(max_ethylene_ppm) : null,
    guidance !== undefined ? guidance : null,
    sources !== undefined ? sources : null,
    notes !== undefined ? notes : null,
    now,
    id
  );

  const updated = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE id = ?', id);
  broadcast('crop_profile_updated', updated);
  res.json(updated);
});

// POST /api/crop-profiles/:id/assign
// Assign crop profile to a storage zone / area
router.post('/:id/assign', (req: Request, res: Response): void => {
  const profileId = req.params.id;
  const { areaId } = req.body;

  if (!areaId) {
    res.status(400).json({ error: 'areaId is required to assign crop profile' });
    return;
  }

  const profile = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE id = ?', profileId);
  if (!profile) {
    res.status(404).json({ error: 'Crop profile not found' });
    return;
  }

  db.run(
    'UPDATE areas SET crop_profile_id = ?, commodity = ? WHERE id = ?',
    profileId,
    profile.name,
    areaId
  );

  // Update or synchronize thresholds for this area based on the assigned crop profile
  const existingTempThresh = db.get("SELECT id FROM thresholds WHERE scope_id = ? AND parameter = 'temperature'", areaId);
  const now = new Date().toISOString();
  if (existingTempThresh) {
    db.run(
      'UPDATE thresholds SET min_value = ?, max_value = ?, warning_min = ?, warning_max = ?, updated_at = ? WHERE id = ?',
      profile.min_temp - 1.0, profile.max_temp + 1.0, profile.min_temp, profile.max_temp, now, existingTempThresh.id
    );
  } else {
    db.run(
      `INSERT INTO thresholds (id, scope_type, scope_id, parameter, min_value, max_value, warning_min, warning_max, created_at, updated_at)
       VALUES (?, 'area', ?, 'temperature', ?, ?, ?, ?, ?, ?)`,
      `thresh-${uuidv4().slice(0, 8)}`, areaId, profile.min_temp - 1.0, profile.max_temp + 1.0, profile.min_temp, profile.max_temp, now, now
    );
  }

  const existingHumThresh = db.get("SELECT id FROM thresholds WHERE scope_id = ? AND parameter = 'humidity'", areaId);
  if (existingHumThresh) {
    db.run(
      'UPDATE thresholds SET min_value = ?, max_value = ?, warning_min = ?, warning_max = ?, updated_at = ? WHERE id = ?',
      profile.min_humidity - 5.0, profile.max_humidity + 2.0, profile.min_humidity, profile.max_humidity, now, existingHumThresh.id
    );
  } else {
    db.run(
      `INSERT INTO thresholds (id, scope_type, scope_id, parameter, min_value, max_value, warning_min, warning_max, created_at, updated_at)
       VALUES (?, 'area', ?, 'humidity', ?, ?, ?, ?, ?, ?)`,
      `thresh-${uuidv4().slice(0, 8)}`, areaId, profile.min_humidity - 5.0, profile.max_humidity + 2.0, profile.min_humidity, profile.max_humidity, now, now
    );
  }

  broadcast('area_crop_assigned', { areaId, profileId, profileName: profile.name });
  res.json({ success: true, message: `Crop profile "${profile.name}" successfully assigned to zone ${areaId}.` });
});

// POST /api/crop-profiles/reset-defaults
// Restores original researched default profiles with explicit confirmation
router.post('/reset-defaults', (req: Request, res: Response): void => {
  const { confirmed } = req.body;
  if (!confirmed) {
    res.status(400).json({ error: 'Explicit confirmation required to restore original defaults.' });
    return;
  }

  const now = new Date().toISOString();
  db.run("DELETE FROM crop_profiles WHERE is_default = 1");

  for (const p of DEFAULT_CROP_PROFILES) {
    db.run(
      `INSERT INTO crop_profiles (
        id, name, variety, purpose, storage_stage, min_temp, target_temp, max_temp,
        min_humidity, target_humidity, max_humidity, max_co2_ppm, max_ethylene_ppm,
        guidance, sources, notes, is_default, is_custom, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      p.id, p.name, p.variety, p.purpose, p.storage_stage, p.min_temp, p.target_temp, p.max_temp,
      p.min_humidity, p.target_humidity, p.max_humidity, p.max_co2_ppm, p.max_ethylene_ppm,
      p.guidance, p.sources, p.notes, now, now
    );
  }

  const all = db.all<CropProfile>('SELECT * FROM crop_profiles ORDER BY is_default DESC, name ASC');
  broadcast('crop_profiles_reset', all);
  res.json({ success: true, message: 'All default crop profiles restored to scientific research baseline.', profiles: all });
});

export default router;
