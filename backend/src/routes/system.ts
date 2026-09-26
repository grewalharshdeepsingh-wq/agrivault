import { Router, Request, Response } from 'express';
import os from 'node:os';
import { db } from '../database/db.js';
import { getMqttBrokerStatus } from '../mqtt/broker.js';
import { getConnectedClientCount } from '../websocket/wsServer.js';

const router = Router();

// GET /api/system/health
router.get('/health', (req: Request, res: Response): void => {
  const mqttStatus = getMqttBrokerStatus();
  const wsClients = getConnectedClientCount();

  // Database check
  let dbStatus = 'healthy';
  let totalReadings = 0;
  let totalAlerts = 0;
  try {
    const readingCount = db.get<{ count: number }>('SELECT count(*) as count FROM sensor_readings');
    totalReadings = readingCount?.count || 0;
    const alertCount = db.get<{ count: number }>('SELECT count(*) as count FROM alerts');
    totalAlerts = alertCount?.count || 0;
  } catch (e) {
    dbStatus = 'degraded';
  }

  // Gateway check
  const gateways = db.all<any>('SELECT * FROM gateways');
  const onlineGateways = gateways.filter(g => g.is_online === 1).length;

  // Devices check
  const devices = db.all<any>('SELECT id, is_online, signal_rssi, last_heartbeat FROM esp_devices WHERE is_enabled = 1');
  const onlineDevices = devices.filter(d => d.is_online === 1).length;
  const totalDevices = devices.length;

  // Sensors check
  const sensors = db.all<any>('SELECT id, sensor_health FROM sensors');
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
        platform: `${os.type()} ${os.release()}`,
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
      gateway: {
        status: onlineGateways > 0 ? 'healthy' : 'warning',
        totalGateways: gateways.length,
        onlineGateways,
        details: gateways
      },
      espDevices: {
        status: onlineDevices === totalDevices ? 'healthy' : onlineDevices > 0 ? 'warning' : 'critical',
        online: onlineDevices,
        total: totalDevices,
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

export default router;
