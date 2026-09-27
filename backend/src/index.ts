import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { initDatabase } from './database/db.js';
import { seedDatabase } from './database/seed.js';
import { initWebSocketServer, broadcast } from './websocket/wsServer.js';
import { initMqttBroker, publishMqtt } from './mqtt/broker.js';
import { registerAlertBroadcast } from './engine/alertEngine.js';
import { registerRelayDispatcher } from './engine/automationEngine.js';
import { registerStatusBroadcast, startHeartbeatWatchdog } from './engine/heartbeatWatchdog.js';
import { virtualFleet } from './simulator/virtualFleet.js';

// Route handlers
import authRoutes from './routes/auth.js';
import facilityRoutes from './routes/facilities.js';
import areaRoutes from './routes/areas.js';
import deviceRoutes from './routes/devices.js';
import sensorRoutes from './routes/sensors.js';
import thresholdRoutes from './routes/thresholds.js';
import alertRoutes from './routes/alerts.js';
import relayRoutes from './routes/relays.js';
import reportRoutes from './routes/reports.js';
import systemRoutes from './routes/system.js';
import simulationRoutes from './routes/simulation.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '4000', 10);
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);

// Global Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['text/plain', 'application/json'] }));

// Normalize parsed string body if sent as raw text from microcontrollers
app.use((req, res, next) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // ignore
    }
  }
  next();
});

// Ensure database is initialized before any route handling (crucial for Vercel serverless cold-starts)
app.use(async (req, res, next) => {
  try {
    await initDatabase();
    next();
  } catch (err: any) {
    console.error('[Database Middleware Error]', err);
    res.status(500).json({ error: 'Database initialization error', details: err?.message || String(err) });
  }
});

// API Routes (Mounted on both /api/* and root /* for Vercel Service rewrite resilience)
const apiRoutes: [string, any][] = [
  ['/auth', authRoutes],
  ['/facilities', facilityRoutes],
  ['/areas', areaRoutes],
  ['/devices', deviceRoutes],
  ['/sensors', sensorRoutes],
  ['/thresholds', thresholdRoutes],
  ['/alerts', alertRoutes],
  ['/relays', relayRoutes],
  ['/reports', reportRoutes],
  ['/analytics', analyticsRoutes],
  ['/system', systemRoutes],
  ['/simulation', simulationRoutes]
];

for (const [routePath, handler] of apiRoutes) {
  app.use(`/api${routePath}`, handler);
  app.use(routePath, handler);
}

// Root diagnostic route
app.get(['/api', '/api/ping', '/ping'], (req, res) => {
  res.json({
    app: 'AgriVault IoT Storage Intelligence Engine',
    version: '1.0.0',
    status: 'ONLINE',
    time: new Date().toISOString(),
    endpoints: [
      '/api/auth', '/api/facilities', '/api/areas', '/api/devices',
      '/api/sensors', '/api/thresholds', '/api/alerts', '/api/relays',
      '/api/reports', '/api/system/health', '/api/simulation'
    ]
  });
});

// Serve compiled PWA frontend assets if dist folder exists (local standalone mode only)
if (!process.env.VERCEL) {
  const possibleDistPaths = [
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist')
  ];
  const frontendDist = possibleDistPaths.find(p => fs.existsSync(p));
  if (frontendDist) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
    console.log(`[HTTP] Serving production frontend PWA build from ${frontendDist}`);
  }
}

async function bootstrap() {
  // In Vercel serverless environment, background TCP broker and persistent listeners are skipped
  if (process.env.VERCEL) {
    console.log('[AgriVault] Running in Vercel Serverless environment.');
    return;
  }

  console.log('====================================================');
  console.log('       ❄️ AGRIvault Industrial IoT Platform');
  console.log('   Storage Intelligence & Multi-Zone Environmental Hub');
  console.log('====================================================');

  // 1. Initialize persistent Database
  await initDatabase();
  seedDatabase();

  // 2. Initialize WebSocket Real-Time Broadcasting
  initWebSocketServer(server);

  // Connect Engine callbacks to WebSocket broadcast
  registerAlertBroadcast((event, payload) => {
    broadcast(event, payload);
  });

  registerStatusBroadcast((event, payload) => {
    broadcast(event, payload);
  });

  // Connect Relay Automation commands to both WebSockets and Hardware MQTT
  registerRelayDispatcher((deviceId, pin, state, reason) => {
    // 1. WebSocket update to frontend
    broadcast('relay_hardware_command', { deviceId, pin, state, reason });

    // 2. Hardware MQTT topic: direct over internet (and legacy gateway fallback)
    const directTopic = `agrivault/fac-01/device/${deviceId}/command`;
    const legacyTopic = `agrivault/fac-01/gateway/gw-01/device/${deviceId}/command`;
    const cmdPayload = {
      command: 'SET_RELAY',
      pin,
      state,
      reason,
      timestamp: new Date().toISOString()
    };
    publishMqtt(directTopic, cmdPayload);
    publishMqtt(legacyTopic, cmdPayload);
  });

  // 3. Initialize Embedded MQTT Broker (Port 1883)
  await initMqttBroker(MQTT_PORT).catch(err => {
    console.warn('[MQTT] Broker notice:', err.message);
  });

  // 4. Start Heartbeat Watchdog (Checks for dead nodes & offline triggers)
  startHeartbeatWatchdog(15000);

  // 5. Start HTTP & WebSocket Server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP/WS] AgriVault Server running at http://0.0.0.0:${PORT}`);
    console.log(`[HTTP/WS] Real-Time WebSocket stream listening on ws://localhost:${PORT}/ws`);
  });

  // 6. Launch Simulation Engine (Virtual IoT Fleet)
  if (process.env.SIMULATION_ENABLED !== 'false') {
    virtualFleet.start(3500);
  }
}

bootstrap().catch(err => {
  console.error('[Bootstrap] Startup notice:', err);
});

export default app;
export { app, server };

