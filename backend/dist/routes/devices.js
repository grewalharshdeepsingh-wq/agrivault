"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../database/db.js");
const wsServer_js_1 = require("../websocket/wsServer.js");
const handlers_js_1 = require("../mqtt/handlers.js");
const router = (0, express_1.Router)();
// GET /api/devices
router.get('/', (req, res) => {
    const { facilityId, areaId, status, isDiscovered } = req.query;
    let sql = `
    SELECT d.*, a.name as area_name, COALESCE(g.name, 'Direct Internet') as gateway_name
    FROM esp_devices d
    LEFT JOIN areas a ON d.area_id = a.id
    LEFT JOIN gateways g ON d.gateway_id = g.id
    WHERE 1=1
  `;
    const params = [];
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
    }
    else if (status === 'offline') {
        sql += ' AND d.is_online = 0';
    }
    if (isDiscovered !== undefined) {
        sql += ' AND d.is_discovered = ?';
        params.push(isDiscovered === 'true' || isDiscovered === '1' ? 1 : 0);
    }
    sql += ' ORDER BY d.is_discovered DESC, d.user_name ASC';
    const devices = db_js_1.db.all(sql, ...params);
    // Attach sensors to each device
    const enriched = devices.map(d => {
        const sensors = db_js_1.db.all('SELECT * FROM sensors WHERE device_id = ?', d.id);
        return {
            ...d,
            sensors
        };
    });
    res.json(enriched);
});
// GET /api/devices/:id
router.get('/:id', (req, res) => {
    const deviceId = req.params.id;
    const dev = db_js_1.db.get(`SELECT d.*, a.name as area_name, COALESCE(g.name, 'Direct Internet') as gateway_name
     FROM esp_devices d
     LEFT JOIN areas a ON d.area_id = a.id
     LEFT JOIN gateways g ON d.gateway_id = g.id
     WHERE d.id = ?`, deviceId);
    if (!dev) {
        res.status(404).json({ error: 'Device not found' });
        return;
    }
    const sensors = db_js_1.db.all('SELECT * FROM sensors WHERE device_id = ?', deviceId);
    const activeAlerts = db_js_1.db.all("SELECT * FROM alerts WHERE device_id = ? AND status IN ('active', 'acknowledged')", deviceId);
    res.json({
        ...dev,
        sensors,
        activeAlerts
    });
});
// PUT /api/devices/:id
// Handles rename, assign to area, enable/disable, and accept discovered device
router.put('/:id', (req, res) => {
    const deviceId = req.params.id;
    const { userName, areaId, isEnabled, isDiscovered } = req.body;
    const existing = db_js_1.db.get('SELECT * FROM esp_devices WHERE id = ?', deviceId);
    if (!existing) {
        res.status(404).json({ error: 'Device not found' });
        return;
    }
    db_js_1.db.run(`UPDATE esp_devices SET
      user_name = COALESCE(?, user_name),
      area_id = ?,
      is_enabled = COALESCE(?, is_enabled),
      is_discovered = COALESCE(?, is_discovered)
    WHERE id = ?`, userName !== undefined ? userName : null, areaId !== undefined ? areaId : existing.area_id, isEnabled !== undefined ? (isEnabled ? 1 : 0) : null, isDiscovered !== undefined ? (isDiscovered ? 1 : 0) : null, deviceId);
    // If area changed, propagate areaId to all its attached sensors
    if (areaId !== undefined && areaId !== existing.area_id) {
        db_js_1.db.run('UPDATE sensors SET area_id = ? WHERE device_id = ?', areaId, deviceId);
        db_js_1.db.run('UPDATE relay_devices SET area_id = ? WHERE device_id = ?', areaId, deviceId);
    }
    const updated = db_js_1.db.get(`SELECT d.*, a.name as area_name FROM esp_devices d LEFT JOIN areas a ON d.area_id = a.id WHERE d.id = ?`, deviceId);
    (0, wsServer_js_1.broadcast)('device_updated', updated);
    res.json(updated);
});
// DELETE /api/devices/:id
router.delete('/:id', (req, res) => {
    const deviceId = req.params.id;
    const existing = db_js_1.db.get('SELECT * FROM esp_devices WHERE id = ?', deviceId);
    if (!existing) {
        res.status(404).json({ error: 'Device not found' });
        return;
    }
    db_js_1.db.transaction(() => {
        db_js_1.db.run('DELETE FROM alert_events WHERE alert_id IN (SELECT id FROM alerts WHERE device_id = ?)', deviceId);
        db_js_1.db.run('DELETE FROM alerts WHERE device_id = ?', deviceId);
        db_js_1.db.run('DELETE FROM sensor_readings WHERE device_id = ?', deviceId);
        db_js_1.db.run('DELETE FROM relay_devices WHERE device_id = ?', deviceId);
        db_js_1.db.run('DELETE FROM sensors WHERE device_id = ?', deviceId);
        db_js_1.db.run('DELETE FROM esp_devices WHERE id = ?', deviceId);
    });
    (0, wsServer_js_1.broadcast)('device_deleted', { deviceId });
    res.json({ success: true, message: `Device ${deviceId} removed successfully` });
});
// POST /api/devices/discover/simulate
// Triggers an auto-discovery packet for an unconfigured ESP32 or ESP8266 node over Internet
router.post('/discover/simulate', (req, res) => {
    const reqType = req.body?.hardwareType;
    const is8266 = reqType === 'ESP8266' || (!reqType && Math.random() > 0.5);
    const idPrefix = is8266 ? 'ESP8266' : 'ESP32';
    const idSuffix = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    const newDeviceId = `${idPrefix}-${idSuffix}`;
    const hardwareType = is8266 ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1';
    const now = new Date().toISOString();
    db_js_1.db.run(`INSERT INTO esp_devices (
      id, facility_id, area_id, gateway_id, user_name, hardware_type,
      firmware_version, ip_address, mac_address, is_online, last_heartbeat,
      signal_rssi, battery_voltage, is_enabled, is_discovered, installation_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, newDeviceId, 'fac-01', null, null, // Direct internet, no gateway
    `Available ${is8266 ? 'ESP8266' : 'ESP32'}: ${newDeviceId}`, hardwareType, '1.3.0-ota', `192.168.1.${Math.floor(140 + Math.random() * 80)}`, is8266 ? `5C:CF:7F:${idSuffix.slice(0, 2)}:${idSuffix.slice(2, 4)}:A1` : `24:0A:C4:${idSuffix.slice(0, 2)}:${idSuffix.slice(2, 4)}:9A`, 1, now, -58, 3.30, 1, 1, // Discovered (Available)
    now.split('T')[0], now);
    // Attach sensors
    const types = ['temperature', 'humidity', 'co2', 'ammonia', 'ethanol'];
    for (const t of types) {
        const sId = `sens-${newDeviceId}-${t}`;
        const unit = t === 'temperature' ? '°C' : t === 'humidity' ? '%' : 'ppm';
        const pin = is8266
            ? (t === 'temperature' ? 'D2 (GPIO 4)' : t === 'humidity' ? 'D7 (GPIO 13)' : 'A0 (ADC0)')
            : (t === 'temperature' ? 'GPIO 4' : t === 'humidity' ? 'GPIO 32' : 'GPIO 35');
        db_js_1.db.run(`INSERT INTO sensors (
        id, device_id, area_id, sensor_type, name, unit, pin,
        raw_reading, calibrated_reading, rate_of_change, rate_of_change_period,
        calibration_status, confidence_score, sensor_health, last_reading_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, sId, newDeviceId, null, t, `${t.toUpperCase()} Sensor`, unit, pin, 0, 0, 0, '30 min', 'factory_default', 92, 'healthy', now, now);
    }
    const newDev = db_js_1.db.get('SELECT * FROM esp_devices WHERE id = ?', newDeviceId);
    (0, wsServer_js_1.broadcast)('device_discovered', {
        device: newDev,
        hardwareType,
        message: `New ${is8266 ? 'ESP8266' : 'ESP32'} node ${newDeviceId} connected directly over Internet!`
    });
    res.status(201).json({
        success: true,
        message: `Discovered new ${is8266 ? 'ESP8266' : 'ESP32'} node ${newDeviceId} over Internet`,
        device: newDev
    });
});
// POST /api/devices/telemetry
// Direct HTTP REST ingest for ESP8266 & ESP32 modules (works seamlessly over Wi-Fi / WAN / Internet Cloud)
router.post('/telemetry', (req, res) => {
    const payload = req.body || {};
    const deviceId = payload.deviceId || payload.id || req.query.deviceId;
    if (!deviceId || typeof deviceId !== 'string') {
        res.status(400).json({ error: 'Missing or invalid "deviceId" in telemetry payload' });
        return;
    }
    const facilityId = payload.facilityId || 'fac-01';
    const gatewayId = null; // Direct Internet connection, no gateway required
    const isEsp8266 = deviceId.toUpperCase().includes('8266') || (payload.hardwareType && payload.hardwareType.toUpperCase().includes('8266'));
    const hardwareType = payload.hardwareType || (isEsp8266 ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1');
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || payload.ip || '192.168.1.150';
    // 1. Auto-discover or heartbeat device directly over Internet
    (0, handlers_js_1.handleDeviceStatus)(facilityId, gatewayId, deviceId, {
        hardwareType,
        firmwareVersion: payload.firmwareVersion || '1.3.0-ota',
        ipAddress: payload.ipAddress || clientIp,
        macAddress: payload.macAddress || (isEsp8266 ? `5C:CF:7F:${deviceId.slice(-4)}` : `24:0A:C4:${deviceId.slice(-4)}`),
        rssi: payload.rssi !== undefined ? Number(payload.rssi) : -60,
        battery: payload.battery !== undefined ? Number(payload.battery) : 3.3,
        capabilities: payload.capabilities || ['temperature', 'humidity', 'co2', 'ammonia', 'ethanol', 'relay']
    });
    // 2. Ingest sensor readings & trigger alerts/automation
    (0, handlers_js_1.handleDeviceTelemetry)(facilityId, gatewayId, deviceId, {
        ...payload,
        ip: payload.ipAddress || clientIp
    });
    res.status(200).json({
        status: 'ACK',
        deviceId,
        hardwareType,
        connection: 'Direct Internet (Cloud WAN)',
        receivedAt: new Date().toISOString()
    });
});
exports.default = router;
