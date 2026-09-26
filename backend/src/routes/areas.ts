import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { Area, ESPDevice, Sensor, Alert, RelayDevice } from '../models/types.js';
import { evaluateMultiSensorHealth } from '../engine/storageHealth.js';

const router = Router();

// GET /api/areas
router.get('/', (req: Request, res: Response): void => {
  const { facilityId } = req.query;
  let sql = 'SELECT * FROM areas';
  const params: any[] = [];
  if (facilityId) {
    sql += ' WHERE facility_id = ?';
    params.push(facilityId);
  }
  sql += ' ORDER BY name ASC';
  const rawAreas = db.all<any>(sql, ...params);
  const areas = rawAreas.map(a => ({
    ...a,
    health_reasons: typeof a.health_reasons === 'string'
      ? JSON.parse(a.health_reasons || '[]')
      : (a.health_reasons || [])
  }));
  res.json(areas);
});

// GET /api/areas/:id
router.get('/:id', (req: Request, res: Response): void => {
  const areaId = req.params.id;
  const rawArea = db.get<any>('SELECT * FROM areas WHERE id = ?', areaId);

  if (!rawArea) {
    res.status(404).json({ error: 'Area not found' });
    return;
  }

  const area: Area = {
    ...rawArea,
    health_reasons: typeof rawArea.health_reasons === 'string'
      ? JSON.parse(rawArea.health_reasons || '[]')
      : (rawArea.health_reasons || [])
  };

  // 1. Connected Devices
  const devices = db.all<ESPDevice>('SELECT * FROM esp_devices WHERE area_id = ?', areaId);

  // 2. Sensors in this area
  const sensors = db.all<Sensor>('SELECT * FROM sensors WHERE area_id = ?', areaId);

  // 3. Active & recent alerts in this area
  const alerts = db.all<Alert>(
    'SELECT * FROM alerts WHERE area_id = ? ORDER BY created_at DESC LIMIT 15',
    areaId
  );

  // 4. Relays in this area
  const relays = db.all<RelayDevice>('SELECT * FROM relay_devices WHERE area_id = ?', areaId);

  // 5. Recent Alert / Automation Events
  const events = db.all(
    `SELECT e.*, a.title as alert_title, a.parameter
     FROM alert_events e
     JOIN alerts a ON e.alert_id = a.id
     WHERE a.area_id = ?
     ORDER BY e.created_at DESC LIMIT 10`,
    areaId
  );

  // 6. Multi-Sensor Storage Health Intelligence Insights
  const violations: string[] = [];
  const snapshot: Record<string, number> = {};

  for (const s of sensors) {
    snapshot[s.sensor_type] = s.calibrated_reading;
    const thresh = db.get<any>(
      "SELECT * FROM thresholds WHERE (scope_type = 'area' AND scope_id = ?) OR (scope_type = 'facility') AND parameter = ? LIMIT 1",
      areaId, s.sensor_type
    );
    if (thresh) {
      if (thresh.max_value !== null && s.calibrated_reading > thresh.max_value) {
        violations.push(`${s.sensor_type}_high`);
      } else if (thresh.min_value !== null && s.calibrated_reading < thresh.min_value) {
        violations.push(`${s.sensor_type}_low`);
      }
    }
  }

  const storageInsights = evaluateMultiSensorHealth({
    temperature: snapshot.temperature,
    humidity: snapshot.humidity,
    co2: snapshot.co2,
    ethylene: snapshot.ethylene,
    ammonia: snapshot.ammonia,
    ethanol: snapshot.ethanol,
    commodity: area.commodity,
    violations
  });

  // 7. Recent time-series samples for 24h graphs
  const recentHistory = db.all(
    `SELECT sensor_type, calibrated_value, recorded_at
     FROM sensor_readings
     WHERE area_id = ? AND recorded_at >= datetime('now', '-24 hours')
     ORDER BY recorded_at ASC`,
    areaId
  );

  res.json({
    area,
    devices,
    sensors,
    alerts,
    relays,
    events,
    storageInsights,
    recentHistory
  });
});

// PUT /api/areas/:id
router.put('/:id', (req: Request, res: Response): void => {
  const areaId = req.params.id;
  const { name, commodity } = req.body;

  const existing = db.get<Area>('SELECT * FROM areas WHERE id = ?', areaId);
  if (!existing) {
    res.status(404).json({ error: 'Area not found' });
    return;
  }

  db.run(
    'UPDATE areas SET name = COALESCE(?, name), commodity = COALESCE(?, commodity) WHERE id = ?',
    name, commodity, areaId
  );

  const updated = db.get<Area>('SELECT * FROM areas WHERE id = ?', areaId);
  res.json(updated);
});

export default router;
