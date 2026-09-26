import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { Facility, Area, Gateway, ESPDevice, Sensor, Alert } from '../models/types.js';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/facilities
router.get('/', (req: Request, res: Response): void => {
  const facilities = db.all<Facility>('SELECT * FROM facilities ORDER BY created_at DESC');
  res.json(facilities);
});

// GET /api/facilities/:id/overview
router.get('/:id/overview', (req: Request, res: Response): void => {
  const facilityId = req.params.id;
  const facility = db.get<Facility>('SELECT * FROM facilities WHERE id = ?', facilityId);

  if (!facility) {
    res.status(404).json({ error: 'Facility not found' });
    return;
  }

  // 1. Areas
  const rawAreas = db.all<any>('SELECT * FROM areas WHERE facility_id = ? ORDER BY name ASC', facilityId);
  const areas = rawAreas.map(a => ({
    ...a,
    health_reasons: typeof a.health_reasons === 'string' ? JSON.parse(a.health_reasons || '[]') : (a.health_reasons || [])
  }));

  // 2. Gateway
  const gateway = db.get<Gateway>('SELECT * FROM gateways WHERE facility_id = ? LIMIT 1', facilityId);

  // 3. Devices
  const devices = db.all<ESPDevice>('SELECT * FROM esp_devices WHERE facility_id = ?', facilityId);
  const connectedESPs = devices.filter(d => d.is_online === 1 && d.is_discovered === 0).length;
  const offlineESPs = devices.filter(d => d.is_online === 0 && d.is_discovered === 0).length;
  const pendingDiscovery = devices.filter(d => d.is_discovered === 1).length;
  const unassignedESPs = devices.filter(d => !d.area_id).length;
  const esp32Count = devices.filter(d => (d.hardware_type || '').includes('ESP32') || d.id.includes('ESP32')).length;
  const esp8266Count = devices.filter(d => (d.hardware_type || '').includes('ESP8266') || d.id.includes('ESP8266')).length;

  // 4. Alerts
  const activeAlerts = db.all<Alert>(
    "SELECT * FROM alerts WHERE facility_id = ? AND status IN ('active', 'acknowledged')",
    facilityId
  );
  const criticalAlertsCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningAlertsCount = activeAlerts.filter(a => a.severity === 'warning').length;

  // 5. Aggregate Sensor Averages
  const tempSensors = db.all<Sensor>(
    "SELECT s.* FROM sensors s JOIN esp_devices d ON s.device_id = d.id WHERE d.facility_id = ? AND s.sensor_type = 'temperature' AND d.is_online = 1",
    facilityId
  );
  const humSensors = db.all<Sensor>(
    "SELECT s.* FROM sensors s JOIN esp_devices d ON s.device_id = d.id WHERE d.facility_id = ? AND s.sensor_type = 'humidity' AND d.is_online = 1",
    facilityId
  );
  const co2Sensors = db.all<Sensor>(
    "SELECT s.* FROM sensors s JOIN esp_devices d ON s.device_id = d.id WHERE d.facility_id = ? AND s.sensor_type = 'co2' AND d.is_online = 1",
    facilityId
  );
  const gasSensors = db.all<Sensor>(
    "SELECT s.* FROM sensors s JOIN esp_devices d ON s.device_id = d.id WHERE d.facility_id = ? AND s.sensor_type IN ('ammonia', 'ethanol', 'ethylene') AND d.is_online = 1",
    facilityId
  );

  const avgTemp = tempSensors.length > 0
    ? +(tempSensors.reduce((acc, s) => acc + s.calibrated_reading, 0) / tempSensors.length).toFixed(1)
    : 0;
  const avgHum = humSensors.length > 0
    ? Math.round(humSensors.reduce((acc, s) => acc + s.calibrated_reading, 0) / humSensors.length)
    : 0;

  const maxCO2 = co2Sensors.length > 0
    ? Math.max(...co2Sensors.map(s => s.calibrated_reading))
    : 0;

  const co2Status = maxCO2 > 1400 ? 'Critical' : maxCO2 > 1200 ? 'Elevated' : 'Normal';

  const anyGasElevated = gasSensors.some(s => {
    if (s.sensor_type === 'ammonia' && s.calibrated_reading > 4.0) return true;
    if (s.sensor_type === 'ethanol' && s.calibrated_reading > 1.8) return true;
    if (s.sensor_type === 'ethylene' && s.calibrated_reading > 0.10) return true;
    return false;
  });

  // Overall Facility Status
  let overallStatus = 'Normal';
  if (criticalAlertsCount > 0 || areas.some(a => a.health_status === 'critical')) {
    overallStatus = 'Critical';
  } else if (warningAlertsCount > 0 || areas.some(a => a.health_status === 'warning')) {
    overallStatus = 'Warning';
  } else if (areas.some(a => a.health_status === 'attention')) {
    overallStatus = 'Attention';
  }

  // Enrich each area with its latest primary metrics
  const enrichedAreas = areas.map(area => {
    const areaSensors = db.all<Sensor>('SELECT * FROM sensors WHERE area_id = ?', area.id);
    const areaAlerts = activeAlerts.filter(a => a.area_id === area.id);
    const areaDevices = devices.filter(d => d.area_id === area.id);

    const getParamData = (param: string) => {
      const s = areaSensors.find(x => x.sensor_type === param);
      if (!s) return null;
      return {
        value: s.calibrated_reading,
        raw: s.raw_reading,
        unit: s.unit,
        rateOfChange: s.rate_of_change,
        rateOfChangePeriod: s.rate_of_change_period,
        health: s.sensor_health,
        confidence: s.confidence_score
      };
    };

    return {
      ...area,
      devices: areaDevices,
      deviceCount: areaDevices.length,
      activeAlertsCount: areaAlerts.length,
      metrics: {
        temperature: getParamData('temperature'),
        humidity: getParamData('humidity'),
        co2: getParamData('co2'),
        ethylene: getParamData('ethylene'),
        ammonia: getParamData('ammonia'),
        ethanol: getParamData('ethanol')
      }
    };
  });

  res.json({
    facility,
    overallStatus,
    activeAreasCount: areas.length,
    connectedESPs,
    offlineESPs,
    pendingDiscovery,
    unassignedESPs,
    esp32Count,
    esp8266Count,
    activeAlertsCount: activeAlerts.length,
    criticalAlertsCount,
    warningAlertsCount,
    avgTemp,
    avgHum,
    co2Status,
    gasStatus: anyGasElevated ? 'Elevated' : 'Normal',
    gateway: gateway || null,
    areas: enrichedAreas
  });
});

// POST /api/facilities
router.post('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { name, location, description } = req.body;
  if (!name || !location) {
    res.status(400).json({ error: 'Facility name and location are required' });
    return;
  }

  const facilityId = `fac-${uuidv4().slice(0, 8)}`;
  const orgId = req.user?.organization_id || 'org-agrivault-01';
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO facilities (id, organization_id, name, location, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    facilityId, orgId, name, location, description || '', now
  );

  const newFac = db.get<Facility>('SELECT * FROM facilities WHERE id = ?', facilityId);
  res.status(201).json(newFac);
});

// POST /api/facilities/:id/areas
router.post('/:id/areas', authenticate, (req: Request, res: Response): void => {
  const facilityId = req.params.id;
  const { name, commodity } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Area name is required' });
    return;
  }

  const areaId = `area-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO areas (id, facility_id, name, commodity, health_status, health_score, health_reasons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    areaId, facilityId, name, commodity || 'General Produce', 'normal', 100.0, JSON.stringify(['Newly configured zone nominal']), now
  );

  const newArea = db.get<Area>('SELECT * FROM areas WHERE id = ?', areaId);
  res.status(201).json(newArea);
});

export default router;
