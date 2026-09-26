import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { ESPDevice, Sensor } from '../models/types.js';
import { broadcast } from '../websocket/wsServer.js';
import { handleDeviceStatus, handleDeviceTelemetry } from '../mqtt/handlers.js';

const router = Router();

// GET /api/devices
router.get('/', (req: Request, res: Response): void => {
  const { facilityId, areaId, status, isDiscovered } = req.query;

  let sql = `
    SELECT d.*, a.name as area_name, g.name as gateway_name
    FROM esp_devices d
    LEFT JOIN areas a ON d.area_id = a.id
    LEFT JOIN gateways g ON d.gateway_id = g.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (facilityId) {
    sql += ' AND d.facility_id = ?';
    params.push(facilityId);
  }
  if (areaId) {
    sql += ' AND d.area_id = ?';
    params.push(areaId);
  }
  if (status === 'online') {
    sql += ' AND d.is_online = 1';
  } else if (status === 'offline') {
    sql += ' AND d.is_online = 0';
  }
  if (isDiscovered !== undefined) {
    sql += ' AND d.is_discovered = ?';
    params.push(isDiscovered === 'true' || isDiscovered === '1' ? 1 : 0);
  }

  sql += ' ORDER BY d.is_discovered DESC, d.user_name ASC';

  const devices = db.all<any>(sql, ...params);

  // Attach sensors to each device
  const enriched = devices.map(d => {
    const sensors = db.all<Sensor>('SELECT * FROM sensors WHERE device_id = ?', d.id);
    return {
      ...d,
      sensors
    };
  });

  res.json(enriched);
});

// GET /api/devices/:id
router.get('/:id', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const dev = db.get<any>(
    `SELECT d.*, a.name as area_name, g.name as gateway_name
     FROM esp_devices d
     LEFT JOIN areas a ON d.area_id = a.id
     LEFT JOIN gateways g ON d.gateway_id = g.id
     WHERE d.id = ?`,
    deviceId
  );

  if (!dev) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const sensors = db.all<Sensor>('SELECT * FROM sensors WHERE device_id = ?', deviceId);
  const activeAlerts = db.all("SELECT * FROM alerts WHERE device_id = ? AND status IN ('active', 'acknowledged')", deviceId);

  res.json({
    ...dev,
    sensors,
    activeAlerts
  });
});

// PUT /api/devices/:id
// Handles rename, assign to area, enable/disable, and accept discovered device
router.put('/:id', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const { userName, areaId, isEnabled, isDiscovered } = req.body;

  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ?', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  db.run(
    `UPDATE esp_devices SET
      user_name = COALESCE(?, user_name),
      area_id = ?,
      is_enabled = COALESCE(?, is_enabled),
      is_discovered = COALESCE(?, is_discovered)
    WHERE id = ?`,
    userName !== undefined ? userName : null,
    areaId !== undefined ? areaId : existing.area_id,
    isEnabled !== undefined ? (isEnabled ? 1 : 0) : null,
    isDiscovered !== undefined ? (isDiscovered ? 1 : 0) : null,
    deviceId
  );

  // If area changed, propagate areaId to all its attached sensors
  if (areaId !== undefined && areaId !== existing.area_id) {
    db.run('UPDATE sensors SET area_id = ? WHERE device_id = ?', areaId, deviceId);
    db.run('UPDATE relay_devices SET area_id = ? WHERE device_id = ?', areaId, deviceId);
  }

  const updated = db.get<any>(
    `SELECT d.*, a.name as area_name FROM esp_devices d LEFT JOIN areas a ON d.area_id = a.id WHERE d.id = ?`,
    deviceId
  );

  broadcast('device_updated', updated);
  res.json(updated);
});

// DELETE /api/devices/:id
router.delete('/:id', (req: Request, res: Response): void => {
  const deviceId = req.params.id;

  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ?', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  db.transaction(() => {
    db.run('DELETE FROM sensor_readings WHERE device_id = ?', deviceId);
    db.run('DELETE FROM sensors WHERE device_id = ?', deviceId);
    db.run('DELETE FROM alerts WHERE device_id = ?', deviceId);
    db.run('DELETE FROM relay_devices WHERE device_id = ?', deviceId);
    db.run('DELETE FROM esp_devices WHERE id = ?', deviceId);
  });

  broadcast('device_deleted', { deviceId });
  res.json({ success: true, message: `Device ${deviceId} removed successfully` });
});

// POST /api/devices/discover/simulate
// Triggers an auto-discovery packet for an unconfigured ESP node
router.post('/discover/simulate', (req: Request, res: Response): void => {
  const idSuffix = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
  const newDeviceId = `ESP32-${idSuffix}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO esp_devices (
      id, facility_id, area_id, gateway_id, user_name, hardware_type,
      firmware_version, ip_address, mac_address, is_online, last_heartbeat,
      signal_rssi, battery_voltage, is_enabled, is_discovered, installation_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newDeviceId,
    'fac-01',
    null,
    'gw-01',
    `Discovered Node: ${newDeviceId}`,
    'ESP32-DevKit-V1',
    '1.2.0',
    `192.168.1.${Math.floor(140 + Math.random() * 80)}`,
    `24:0A:C4:${idSuffix.slice(0, 2)}:${idSuffix.slice(2, 4)}:9A`,
    1,
    now,
    -58,
    3.30,
    1,
    1, // Discovered
    now.split('T')[0],
    now
  );

  // Attach sensors
  const types = ['temperature', 'humidity', 'co2', 'ammonia', 'ethanol'];
  for (const t of types) {
    const sId = `sens-${newDeviceId}-${t}`;
    const unit = t === 'temperature' ? '°C' : t === 'humidity' ? '%' : 'ppm';
    db.run(
      `INSERT INTO sensors (
        id, device_id, area_id, sensor_type, name, unit, pin,
        raw_reading, calibrated_reading, rate_of_change, rate_of_change_period,
        calibration_status, confidence_score, sensor_health, last_reading_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sId, newDeviceId, null, t, `${t.toUpperCase()} Sensor`, unit, 'GPIO',
      0, 0, 0, '30 min', 'factory_default', 92, 'healthy', now, now
    );
  }

  const newDev = db.get<any>('SELECT * FROM esp_devices WHERE id = ?', newDeviceId);
  broadcast('device_discovered', { device: newDev, message: `New hardware node ${newDeviceId} discovered!` });

  res.status(201).json({
    success: true,
    message: `Discovered new ESP32 node ${newDeviceId}`,
    device: newDev
  });
});

// POST /api/devices/telemetry
// Direct HTTP REST ingest for ESP8266 & ESP32 modules (works seamlessly over Wi-Fi / WAN / Cloud)
router.post('/telemetry', (req: Request, res: Response): void => {
  const payload = req.body || {};
  const deviceId = payload.deviceId || payload.id || req.query.deviceId;

  if (!deviceId || typeof deviceId !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "deviceId" in telemetry payload' });
    return;
  }

  const facilityId = payload.facilityId || 'fac-01';
  const gatewayId = payload.gatewayId || 'gw-01';
  const hardwareType = payload.hardwareType || (deviceId.toUpperCase().includes('8266') ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1');
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || payload.ip || '192.168.1.150';

  // 1. Auto-discover or heartbeat device
  handleDeviceStatus(facilityId, gatewayId, deviceId, {
    hardwareType,
    firmwareVersion: payload.firmwareVersion || '1.3.0-ota',
    ipAddress: payload.ipAddress || clientIp,
    macAddress: payload.macAddress || `MAC-${deviceId}`,
    rssi: payload.rssi !== undefined ? Number(payload.rssi) : -60,
    battery: payload.battery !== undefined ? Number(payload.battery) : 3.3,
    capabilities: payload.capabilities || ['temperature', 'humidity', 'co2', 'ammonia', 'ethanol', 'relay']
  });

  // 2. Ingest sensor readings & trigger alerts/automation
  handleDeviceTelemetry(facilityId, gatewayId, deviceId, {
    ...payload,
    ip: payload.ipAddress || clientIp
  });

  res.status(200).json({
    status: 'ACK',
    deviceId,
    receivedAt: new Date().toISOString()
  });
});

export default router;
