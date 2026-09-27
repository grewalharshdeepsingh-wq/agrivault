"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_os_1 = __importDefault(require("node:os"));
const db_js_1 = require("../database/db.js");
const broker_js_1 = require("../mqtt/broker.js");
const wsServer_js_1 = require("../websocket/wsServer.js");
const router = (0, express_1.Router)();
// GET /api/system/health
router.get('/health', (req, res) => {
    const mqttStatus = (0, broker_js_1.getMqttBrokerStatus)();
    const wsClients = (0, wsServer_js_1.getConnectedClientCount)();
    // Database check
    let dbStatus = 'healthy';
    let totalReadings = 0;
    let totalAlerts = 0;
    try {
        const readingCount = db_js_1.db.get('SELECT count(*) as count FROM sensor_readings');
        totalReadings = readingCount?.count || 0;
        const alertCount = db_js_1.db.get('SELECT count(*) as count FROM alerts');
        totalAlerts = alertCount?.count || 0;
    }
    catch (e) {
        dbStatus = 'degraded';
    }
    // Gateway check
    const gateways = db_js_1.db.all('SELECT * FROM gateways');
    const onlineGateways = gateways.filter(g => g.is_online === 1).length;
    // Devices check
    const devices = db_js_1.db.all('SELECT id, hardware_type, is_online, signal_rssi, last_heartbeat FROM esp_devices WHERE is_enabled = 1');
    const onlineDevices = devices.filter(d => d.is_online === 1).length;
    const totalDevices = devices.length;
    const esp32Count = devices.filter(d => (d.hardware_type || '').includes('ESP32') || d.id.includes('ESP32')).length;
    const esp8266Count = devices.filter(d => (d.hardware_type || '').includes('ESP8266') || d.id.includes('ESP8266')).length;
    // Sensors check
    const sensors = db_js_1.db.all('SELECT id, sensor_health FROM sensors');
    const healthySensors = sensors.filter(s => s.sensor_health === 'healthy').length;
    // System uptime & load
    const uptimeSeconds = Math.round(process.uptime());
    const memUsage = process.memoryUsage();
    res.json({
        status: 'operational',
        serverTime: new Date().toISOString(),
        uptimeSeconds,
        services: {
            backend: {
                status: 'healthy',
                nodeVersion: process.version,
                platform: `${node_os_1.default.type()} ${node_os_1.default.release()}`,
                memoryMb: Math.round(memUsage.heapUsed / 1024 / 1024)
            },
            database: {
                status: dbStatus,
                type: 'SQLite WAL / Embedded Timescale compatible',
                totalReadingsRecorded: totalReadings,
                totalAlertsLogged: totalAlerts
            },
            mqttBroker: {
                status: mqttStatus.isRunning ? 'healthy' : 'offline',
                port: 1883,
                connectedClients: mqttStatus.connectedClients
            },
            websocketServer: {
                status: 'healthy',
                activeClients: wsClients
            },
            directCloudIngest: {
                status: 'healthy',
                protocol: 'Direct Internet (HTTP REST & MQTT)',
                endpoint: '/api/devices/telemetry',
                mqttBrokerPort: 1883,
                gatewayRequired: false
            },
            gateway: {
                status: 'retired',
                mode: 'Direct Internet Architecture (No Gateway Required)',
                totalGateways: 0,
                onlineGateways: 0,
                details: []
            },
            espDevices: {
                status: onlineDevices === totalDevices ? 'healthy' : onlineDevices > 0 ? 'warning' : 'critical',
                online: onlineDevices,
                total: totalDevices,
                esp32Count,
                esp8266Count,
                percentageOnline: totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0
            },
            sensors: {
                status: healthySensors === sensors.length ? 'healthy' : 'warning',
                healthy: healthySensors,
                total: sensors.length
            },
            notifications: {
                status: 'healthy',
                channels: ['in_app', 'browser', 'webhook']
            }
        }
    });
});
exports.default = router;
