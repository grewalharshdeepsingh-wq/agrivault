import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { Area, ESPDevice, Sensor, Alert, RelayDevice } from '../models/types.js';
import { evaluateMultiSensorHealth } from '../engine/storageHealth.js';
import { broadcast } from '../websocket/wsServer.js';

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
  const areas = rawAreas.map(a => {
    const devices = db.all('SELECT id, user_name, hardware_type, is_online, ip_address FROM esp_devices WHERE area_id = ?', a.id);
    return {
      ...a,
      devices,
      deviceCount: devices.length,
      health_reasons: typeof a.health_reasons === 'string'
        ? JSON.parse(a.health_reasons || '[]')
        : (a.health_reasons || [])
    };
  });
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

// POST /api/areas
// Creates a new room or section, optionally assigning ESP devices immediately
router.post('/', (req: Request, res: Response): void => {
  const { name, commodity, facilityId, deviceIds } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Room / Section name is required' });
    return;
  }

  const trimmedName = name.trim();
  const areaId = `area-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(16)}`;
  const facId = facilityId || 'fac-01';
  const now = new Date().toISOString();

  const hasDevices = Array.isArray(deviceIds) && deviceIds.length > 0;
  const initialStatus = hasDevices ? 'normal' : 'standby';
  const initialScore = hasDevices ? 100.0 : 0.0;

  db.run(
    `INSERT INTO areas (id, facility_id, name, commodity, health_status, health_score, health_reasons, created_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`,
    areaId, facId, trimmedName, commodity || 'General Produce', initialStatus, initialScore, now
  );

  // Link selected ESP devices
  if (Array.isArray(deviceIds) && deviceIds.length > 0) {
    for (const devId of deviceIds) {
      db.run('UPDATE esp_devices SET area_id = ?, is_discovered = 0 WHERE id = ?', areaId, devId);
      db.run('UPDATE sensors SET area_id = ? WHERE device_id = ?', areaId, devId);
      db.run('UPDATE relay_devices SET area_id = ? WHERE device_id = ?', areaId, devId);
    }
  }

  const created = db.get<any>('SELECT * FROM areas WHERE id = ?', areaId);
  const devices = db.all('SELECT id, user_name, hardware_type, is_online, ip_address FROM esp_devices WHERE area_id = ?', areaId);
  const enriched = {
    ...created,
    devices,
    deviceCount: devices.length,
    health_reasons: []
  };

  broadcast('area_created', enriched);
  res.status(201).json(enriched);
});

// PUT /api/areas/:id
// Renames room or updates commodity type
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
  broadcast('area_updated', updated);
  res.json(updated);
});

// DELETE /api/areas/:id
router.delete('/:id', (req: Request, res: Response): void => {
  const areaId = req.params.id;
  const existing = db.get<Area>('SELECT * FROM areas WHERE id = ?', areaId);
  if (!existing) {
    res.status(404).json({ error: 'Area not found' });
    return;
  }

  db.transaction(() => {
    // Unlink connected devices gracefully instead of destroying hardware rows
    db.run('UPDATE esp_devices SET area_id = NULL WHERE area_id = ?', areaId);
    db.run('UPDATE sensors SET area_id = NULL WHERE area_id = ?', areaId);
    db.run('UPDATE relay_devices SET area_id = NULL WHERE area_id = ?', areaId);
    db.run('DELETE FROM sensor_readings WHERE area_id = ?', areaId);
    db.run('DELETE FROM alerts WHERE area_id = ?', areaId);
    db.run('DELETE FROM automation_rules WHERE area_id = ?', areaId);
    db.run('DELETE FROM areas WHERE id = ?', areaId);
  });

  broadcast('area_deleted', { areaId });
  res.json({ success: true, message: `Room / Section "${existing.name}" removed successfully` });
});

export default router;
