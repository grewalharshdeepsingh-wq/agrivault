import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { ESPDevice, Sensor } from '../models/types.js';
import { broadcast } from '../websocket/wsServer.js';
import { handleDeviceStatus, handleDeviceTelemetry } from '../mqtt/handlers.js';
import { globalMeshAssignments } from '../engine/stateMeshEngine.js';
import { gatewayManager } from '../hardware/gatewayManager.js';

const router = Router();

// GET /api/devices
// Supports filtering by facility, coldStore, zone, area, status, registrationStatus, isDiscovered
router.get('/', (req: Request, res: Response): void => {
  const { facilityId, coldStore, zone, areaId, status, registrationStatus, isDiscovered } = req.query;

  let sql = `
    SELECT d.*, a.name as area_name, COALESCE(g.name, 'Inner Gateway (Vault Hub)') as gateway_name
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
  if (coldStore) {
    sql += ' AND d.cold_store_name = ?';
    params.push(coldStore);
  }
  if (zone) {
    sql += ' AND d.zone_name = ?';
    params.push(zone);
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
  if (registrationStatus) {
    sql += ' AND d.registration_status = ?';
    params.push(registrationStatus);
  }
  if (isDiscovered !== undefined) {
    sql += ' AND d.is_discovered = ?';
    params.push(isDiscovered === 'true' || isDiscovered === '1' ? 1 : 0);
  }

  sql += ' ORDER BY CASE WHEN d.registration_status = \'pending\' THEN 0 ELSE 1 END, d.is_discovered DESC, d.user_name ASC';

  const devices = db.all<any>(sql, ...params);

  // Attach sensors to each device
  const enriched = devices.map(d => {
    const sensors = db.all<Sensor>('SELECT * FROM sensors WHERE device_id = ?', d.id);
    return {
      ...d,
      hardware_id: d.hardware_id || d.mac_address,
      device_code: d.device_code || d.id,
      registration_status: d.registration_status || (d.is_discovered === 1 && !d.area_id ? 'pending' : 'active'),
      is_simulated: d.is_simulated || 0,
      sensors
    };
  });

  res.json(enriched);
});

// GET /api/devices/:id
router.get('/:id', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const dev = db.get<any>(
    `SELECT d.*, a.name as area_name, COALESCE(g.name, 'Inner Gateway (Vault Hub)') as gateway_name
     FROM esp_devices d
     LEFT JOIN areas a ON d.area_id = a.id
     LEFT JOIN gateways g ON d.gateway_id = g.id
     WHERE d.id = ? COLLATE NOCASE`,
    deviceId
  );

  if (!dev) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const sensors = db.all<Sensor>('SELECT * FROM sensors WHERE device_id = ?', dev.id);
  const activeAlerts = db.all("SELECT * FROM alerts WHERE device_id = ? AND status IN ('active', 'acknowledged')", dev.id);
  const recentReadings = db.all(
    'SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 60',
    dev.id
  );

  res.json({
    ...dev,
    hardware_id: dev.hardware_id || dev.mac_address,
    device_code: dev.device_code || dev.id,
    registration_status: dev.registration_status || (dev.is_discovered === 1 && !dev.area_id ? 'pending' : 'active'),
    sensors,
    activeAlerts,
    recentReadings
  });
});

// PUT /api/devices/:id
// Handles rename, assign to area, rack, level, coordinates, and moving node
// NOTE: Moving node changes location while preserving permanent hardware identity (hardware_id) and device_id!
router.put('/:id', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const {
    userName,
    deviceCode,
    coldStoreName,
    zoneName,
    areaId,
    rackName,
    levelName,
    posX,
    posY,
    posZ,
    isEnabled,
    isDiscovered,
    registrationStatus,
    parentGatewayId,
    parentNodeId
  } = req.body;

  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ? COLLATE NOCASE', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  let targetDiscovered = existing.is_discovered;
  if (isDiscovered !== undefined) {
    targetDiscovered = isDiscovered ? 1 : 0;
  } else if (areaId !== undefined) {
    targetDiscovered = (areaId && typeof areaId === 'string' && areaId.trim().length > 0) ? 0 : 1;
  }

  const targetAreaId = areaId !== undefined ? (areaId && typeof areaId === 'string' && areaId.trim().length > 0 ? areaId.trim() : null) : existing.area_id;

  db.run(
    `UPDATE esp_devices SET
      user_name = COALESCE(?, user_name),
      device_code = COALESCE(?, device_code),
      cold_store_name = COALESCE(?, cold_store_name),
      zone_name = COALESCE(?, zone_name),
      area_id = ?,
      rack_name = COALESCE(?, rack_name),
      level_name = COALESCE(?, level_name),
      pos_x = COALESCE(?, pos_x),
      pos_y = COALESCE(?, pos_y),
      pos_z = COALESCE(?, pos_z),
      is_enabled = COALESCE(?, is_enabled),
      is_discovered = ?,
      registration_status = COALESCE(?, registration_status),
      parent_gateway_id = COALESCE(?, parent_gateway_id),
      parent_node_id = COALESCE(?, parent_node_id)
    WHERE id = ?`,
    userName !== undefined ? userName : null,
    deviceCode !== undefined ? deviceCode : null,
    coldStoreName !== undefined ? coldStoreName : null,
    zoneName !== undefined ? zoneName : null,
    targetAreaId,
    rackName !== undefined ? rackName : null,
    levelName !== undefined ? levelName : null,
    posX !== undefined ? Number(posX) : null,
    posY !== undefined ? Number(posY) : null,
    posZ !== undefined ? Number(posZ) : null,
    isEnabled !== undefined ? (isEnabled ? 1 : 0) : null,
    targetDiscovered,
    registrationStatus !== undefined ? registrationStatus : null,
    parentGatewayId !== undefined ? parentGatewayId : null,
    parentNodeId !== undefined ? parentNodeId : null,
    existing.id
  );

  // If area changed, propagate areaId to all its attached sensors and relays
  if (areaId !== undefined && targetAreaId !== existing.area_id) {
    db.run('UPDATE sensors SET area_id = ? WHERE device_id = ? COLLATE NOCASE', targetAreaId, existing.id);
    db.run('UPDATE relay_devices SET area_id = ? WHERE device_id = ? COLLATE NOCASE', targetAreaId, existing.id);
  }

  if (targetAreaId) {
    globalMeshAssignments.set(existing.id.toUpperCase(), targetAreaId);
  } else {
    globalMeshAssignments.delete(existing.id.toUpperCase());
  }

  const updated = db.get<any>(
    `SELECT d.*, a.name as area_name FROM esp_devices d LEFT JOIN areas a ON d.area_id = a.id WHERE d.id = ?`,
    existing.id
  );

  broadcast('device_updated', updated);
  res.json(updated);
});

// POST /api/devices/:id/approve
// Approves a pending device: transitions PENDING -> ACTIVE, configures naming and physical area/rack
router.get('/:id/approve', (req, res) => res.status(405).json({ error: 'Use POST' }));
router.post('/:id/approve', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ? COLLATE NOCASE', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const {
    userName,
    deviceCode,
    coldStoreName = 'Cold Store A',
    zoneName = 'North Zone',
    areaId = null,
    rackName = 'Rack 1',
    levelName = 'Level 1',
    posX = 20,
    posY = 20,
    posZ = 2
  } = req.body;

  db.run(
    `UPDATE esp_devices SET
      user_name = COALESCE(?, user_name),
      device_code = COALESCE(?, device_code),
      cold_store_name = ?,
      zone_name = ?,
      area_id = ?,
      rack_name = ?,
      level_name = ?,
      pos_x = ?,
      pos_y = ?,
      pos_z = ?,
      registration_status = 'active',
      is_discovered = 0,
      is_enabled = 1
    WHERE id = ?`,
    userName || existing.user_name,
    deviceCode || existing.device_code || existing.id,
    coldStoreName,
    zoneName,
    areaId || existing.area_id,
    rackName,
    levelName,
    Number(posX),
    Number(posY),
    Number(posZ),
    existing.id
  );

  if (areaId) {
    db.run('UPDATE sensors SET area_id = ? WHERE device_id = ? COLLATE NOCASE', areaId, existing.id);
    globalMeshAssignments.set(existing.id.toUpperCase(), areaId);
  }

  const updated = db.get<any>(
    `SELECT d.*, a.name as area_name FROM esp_devices d LEFT JOIN areas a ON d.area_id = a.id WHERE d.id = ?`,
    existing.id
  );

  broadcast('device_approved', updated);
  broadcast('device_updated', updated);
  res.json({
    success: true,
    message: `Device ${existing.id} successfully approved and registered as ACTIVE.`,
    device: updated
  });
});

// POST /api/devices/:id/reject
// Rejects a pending device
router.post('/:id/reject', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ? COLLATE NOCASE', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  db.run("UPDATE esp_devices SET registration_status = 'rejected', is_enabled = 0 WHERE id = ?", existing.id);
  broadcast('device_rejected', { deviceId: existing.id });
  res.json({ success: true, message: `Device ${existing.id} registration rejected.` });
});

// POST /api/devices/:id/revoke
// Revokes/unregisters an active device
router.post('/:id/revoke', (req: Request, res: Response): void => {
  const deviceId = req.params.id;
  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ? COLLATE NOCASE', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  db.run("UPDATE esp_devices SET registration_status = 'revoked', is_enabled = 0 WHERE id = ?", existing.id);
  broadcast('device_revoked', { deviceId: existing.id });
  res.json({ success: true, message: `Device ${existing.id} registration revoked.` });
});

// DELETE /api/devices/:id
// Completely unregisters and deletes device
router.delete('/:id', (req: Request, res: Response): void => {
  const deviceId = req.params.id;

  const existing = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ? COLLATE NOCASE', deviceId);
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const devId = existing.id;
  globalMeshAssignments.delete(devId.toUpperCase());

  db.transaction(() => {
    db.run('DELETE FROM alert_events WHERE alert_id IN (SELECT id FROM alerts WHERE device_id = ? COLLATE NOCASE)', devId);
    db.run('DELETE FROM alerts WHERE device_id = ? COLLATE NOCASE', devId);
    db.run('DELETE FROM sensor_readings WHERE device_id = ? COLLATE NOCASE', devId);
    db.run('DELETE FROM relay_devices WHERE device_id = ? COLLATE NOCASE', devId);
    db.run('DELETE FROM sensors WHERE device_id = ? COLLATE NOCASE', devId);
    db.run('DELETE FROM esp_devices WHERE id = ? COLLATE NOCASE', devId);
  });

  broadcast('device_deleted', { deviceId: devId });
  res.json({ success: true, message: `Device ${devId} removed successfully` });
});

// POST /api/devices/discover/simulate
// Triggers detection of a new physical ESP32 node via Inner Gateway (ESP-NOW)
// Created with registration_status: 'pending' (Security provision) and clearly labeled as SIMULATED
router.post('/discover/simulate', (req: Request, res: Response): void => {
  const randNum = Math.floor(10 + Math.random() * 89);
  const newDeviceId = `AGR-ESP-${randNum}`;
  const hexPart = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
  const macAddress = `24:0A:C4:${hexPart.slice(0, 2)}:${hexPart.slice(2, 4)}:5A`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO esp_devices (
      id, hardware_id, device_code, device_type, registration_status, facility_id, area_id, gateway_id,
      parent_gateway_id, connection_protocol, user_name, hardware_type,
      firmware_version, ip_address, mac_address, is_online, last_heartbeat,
      signal_rssi, battery_voltage, is_enabled, is_discovered, is_simulated, installation_date, created_at,
      cold_store_name, zone_name, rack_name, level_name, pos_x, pos_y, pos_z
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newDeviceId,
    macAddress,
    newDeviceId,
    'SENSOR_NODE',
    'pending', // Security provision: PENDING REGISTRATION
    'fac-01',
    null,
    gatewayManager.innerGatewayId,
    gatewayManager.innerGatewayId,
    'ESP-NOW',
    `Unassigned Node (${newDeviceId})`,
    'ESP32-DevKit-V1 (ESP-NOW)',
    '1.4.0-espnow',
    'ESP-NOW Direct Peer',
    macAddress,
    1,
    now,
    -58,
    3.30,
    1,
    1, // Discovered
    1, // Clearly SIMULATED
    now.split('T')[0],
    now,
    'Cold Store A',
    'North Zone',
    'Rack 1',
    'Level 2',
    25.0 + Math.random() * 40,
    20.0 + Math.random() * 40,
    2.5
  );

  // Attach sensors: DS18B20 Temp, DHT11 Humidity, MQ3 Gas, MQ135 Gas, CO2
  const types = [
    { type: 'temperature', name: 'DS18B20 Temperature Probe', unit: '°C', pin: 'GPIO 4' },
    { type: 'humidity', name: 'DHT11 Humidity Sensor', unit: '%', pin: 'GPIO 32' },
    { type: 'mq3', name: 'MQ3 Gas / Spoilage Sensor', unit: 'ppm', pin: 'GPIO 35 (ADC1)' },
    { type: 'mq135', name: 'MQ135 Air Quality Sensor', unit: 'ppm', pin: 'GPIO 34 (ADC1)' },
    { type: 'co2', name: 'CO2 Carbon Dioxide Sensor', unit: 'ppm', pin: 'UART' }
  ];

  for (const s of types) {
    const sId = `sens-${newDeviceId}-${s.type}`;
    db.run(
      `INSERT INTO sensors (
        id, device_id, area_id, sensor_type, name, unit, pin,
        raw_reading, calibrated_reading, rate_of_change, rate_of_change_period,
        calibration_status, confidence_score, sensor_health, last_reading_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sId, newDeviceId, null, s.type, s.name, s.unit, s.pin,
      0, 0, 0, '30 min', 'factory_default', 95, 'healthy', now, now
    );
  }

  const newDev = db.get<any>('SELECT * FROM esp_devices WHERE id = ?', newDeviceId);
  broadcast('device_discovered', {
    device: newDev,
    hardwareType: 'ESP32-DevKit-V1',
    message: `New ESP32 sensor node ${newDeviceId} detected via Inner Gateway (ESP-NOW)! Status: PENDING REGISTRATION`
  });

  res.status(201).json({
    success: true,
    message: `Discovered new ESP32 sensor node ${newDeviceId} via Inner Gateway (ESP-NOW)`,
    device: newDev
  });
});

// POST /api/devices/telemetry
// Primary telemetry ingest route: routed through gatewayManager for offline buffering resilience
router.post('/telemetry', (req: Request, res: Response): void => {
  const payload = req.body || {};
  const rawDeviceId = payload.deviceId || payload.id || req.query.deviceId;

  if (!rawDeviceId || typeof rawDeviceId !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "deviceId" in telemetry payload' });
    return;
  }

  const deviceId = rawDeviceId.trim().toUpperCase();
  const facilityId = payload.facilityId || 'fac-01';
  const hardwareType = payload.hardwareType || 'ESP32-DevKit-V1';
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || payload.ip || '192.168.1.150';
  const mac = payload.macAddress || payload.hardware_id || `24:0A:C4:${deviceId.slice(-4)}`;

  // Multi-tier architecture check & buffering
  const routing = gatewayManager.ingestTelemetry({
    node_id: deviceId,
    hardware_id: mac,
    timestamp: payload.timestamp || new Date().toISOString(),
    readings: payload,
    temperature: payload.temperature,
    humidity: payload.humidity,
    mq3: payload.mq3,
    mq135: payload.mq135,
    co2: payload.co2,
    ammonia: payload.ammonia,
    ethanol: payload.ethanol,
    signal_rssi: payload.rssi,
    battery_voltage: payload.battery,
    firmware_version: payload.firmwareVersion,
    is_simulation: payload.is_simulation
  });

  if (!routing.delivered) {
    // Reading was safely buffered in Inner or Outer Gateway
    res.status(202).json({
      status: 'BUFFERED',
      bufferedTier: routing.bufferedTier,
      reason: routing.reason,
      deviceId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Gateway link & Internet are open: ingest directly
  handleDeviceStatus(facilityId, gatewayManager.innerGatewayId, deviceId, {
    hardwareType,
    firmwareVersion: payload.firmwareVersion || '1.4.0',
    ipAddress: payload.ipAddress || clientIp,
    macAddress: mac,
    rssi: payload.rssi !== undefined ? Number(payload.rssi) : -58,
    battery: payload.battery !== undefined ? Number(payload.battery) : 3.3,
    capabilities: payload.capabilities || ['temperature', 'humidity', 'mq3', 'mq135', 'co2']
  });

  handleDeviceTelemetry(facilityId, gatewayManager.innerGatewayId, deviceId, {
    ...payload,
    deviceId,
    ip: payload.ipAddress || clientIp
  });

  res.status(200).json({
    status: 'ACK',
    deviceId,
    path: 'Sensor -> ESP-NOW -> Inner GW -> RS-485 -> Outer GW -> Cloud',
    receivedAt: new Date().toISOString()
  });
});

export default router;
