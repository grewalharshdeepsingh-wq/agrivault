"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = exports.isVercel = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_http_1 = __importDefault(require("node:http"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_js_1 = require("./database/db.js");
const seed_js_1 = require("./database/seed.js");
const wsServer_js_1 = require("./websocket/wsServer.js");
const broker_js_1 = require("./mqtt/broker.js");
const alertEngine_js_1 = require("./engine/alertEngine.js");
const automationEngine_js_1 = require("./engine/automationEngine.js");
const heartbeatWatchdog_js_1 = require("./engine/heartbeatWatchdog.js");
const virtualFleet_js_1 = require("./simulator/virtualFleet.js");
// Route handlers
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const facilities_js_1 = __importDefault(require("./routes/facilities.js"));
const areas_js_1 = __importDefault(require("./routes/areas.js"));
const devices_js_1 = __importDefault(require("./routes/devices.js"));
const sensors_js_1 = __importDefault(require("./routes/sensors.js"));
const thresholds_js_1 = __importDefault(require("./routes/thresholds.js"));
const alerts_js_1 = __importDefault(require("./routes/alerts.js"));
const relays_js_1 = __importDefault(require("./routes/relays.js"));
const reports_js_1 = __importDefault(require("./routes/reports.js"));
const system_js_1 = __importDefault(require("./routes/system.js"));
const simulation_js_1 = __importDefault(require("./routes/simulation.js"));
const analytics_js_1 = __importDefault(require("./routes/analytics.js"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = node_http_1.default.createServer(app);
exports.server = server;
exports.isVercel = Boolean(process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_REGION ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION);
// Diagnostic instant ping endpoint (before any middleware or database logic)
app.get(['/api/ping', '/ping'], (req, res) => {
    res.status(200).json({
        status: 'ONLINE',
        app: 'AgriVault IoT Storage Intelligence Engine',
        timestamp: new Date().toISOString(),
        isVercel: exports.isVercel,
        nodeVersion: process.version
    });
});
const PORT = parseInt(process.env.PORT || '4000', 10);
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);
// Global Middleware
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.text({ type: ['text/plain', 'application/json'] }));
// Normalize parsed string body if sent as raw text from microcontrollers
app.use((req, res, next) => {
    if (typeof req.body === 'string') {
        try {
            req.body = JSON.parse(req.body);
        }
        catch {
            // ignore
        }
    }
    next();
});
// Ensure database is initialized before any route handling (crucial for Vercel serverless cold-starts)
let dbReadyPromise = null;
app.use(async (req, res, next) => {
    try {
        if (!dbReadyPromise) {
            dbReadyPromise = (async () => {
                await (0, db_js_1.initDatabase)();
                (0, seed_js_1.seedDatabase)();
            })();
        }
        await dbReadyPromise;
        next();
    }
    catch (err) {
        dbReadyPromise = null; // reset on error so next request can retry
        console.error('[Database Middleware Error]', err);
        res.status(500).json({ error: 'Database initialization error', details: err?.message || String(err) });
    }
});
// API Routes (Mounted on both /api/* and root /* for Vercel Service rewrite resilience)
const apiRoutes = [
    ['/auth', auth_js_1.default],
    ['/facilities', facilities_js_1.default],
    ['/areas', areas_js_1.default],
    ['/devices', devices_js_1.default],
    ['/sensors', sensors_js_1.default],
    ['/thresholds', thresholds_js_1.default],
    ['/alerts', alerts_js_1.default],
    ['/relays', relays_js_1.default],
    ['/reports', reports_js_1.default],
    ['/analytics', analytics_js_1.default],
    ['/system', system_js_1.default],
    ['/simulation', simulation_js_1.default]
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
        node_path_1.default.resolve(process.cwd(), '../frontend/dist'),
        node_path_1.default.resolve(process.cwd(), 'frontend/dist')
    ];
    const frontendDist = possibleDistPaths.find(p => node_fs_1.default.existsSync(p));
    if (frontendDist) {
        app.use(express_1.default.static(frontendDist));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/ws'))
                return next();
            res.sendFile(node_path_1.default.join(frontendDist, 'index.html'));
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
    await (0, db_js_1.initDatabase)();
    (0, seed_js_1.seedDatabase)();
    // 2. Initialize WebSocket Real-Time Broadcasting
    (0, wsServer_js_1.initWebSocketServer)(server);
    // Connect Engine callbacks to WebSocket broadcast
    (0, alertEngine_js_1.registerAlertBroadcast)((event, payload) => {
        (0, wsServer_js_1.broadcast)(event, payload);
    });
    (0, heartbeatWatchdog_js_1.registerStatusBroadcast)((event, payload) => {
        (0, wsServer_js_1.broadcast)(event, payload);
    });
    // Connect Relay Automation commands to both WebSockets and Hardware MQTT
    (0, automationEngine_js_1.registerRelayDispatcher)((deviceId, pin, state, reason) => {
        // 1. WebSocket update to frontend
        (0, wsServer_js_1.broadcast)('relay_hardware_command', { deviceId, pin, state, reason });
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
        (0, broker_js_1.publishMqtt)(directTopic, cmdPayload);
        (0, broker_js_1.publishMqtt)(legacyTopic, cmdPayload);
    });
    // 3. Initialize Embedded MQTT Broker (Port 1883)
    await (0, broker_js_1.initMqttBroker)(MQTT_PORT).catch(err => {
        console.warn('[MQTT] Broker notice:', err.message);
    });
    // 4. Start Heartbeat Watchdog (Checks for dead nodes & offline triggers)
    (0, heartbeatWatchdog_js_1.startHeartbeatWatchdog)(15000);
    // 5. Start HTTP & WebSocket Server
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[HTTP/WS] AgriVault Server running at http://0.0.0.0:${PORT}`);
        console.log(`[HTTP/WS] Real-Time WebSocket stream listening on ws://localhost:${PORT}/ws`);
    });
    // 6. Launch Simulation Engine (Virtual IoT Fleet)
    if (process.env.SIMULATION_ENABLED !== 'false') {
        virtualFleet_js_1.virtualFleet.start(3500);
    }
}
if (!exports.isVercel) {
    bootstrap().catch(err => {
        console.error('[Bootstrap] Startup notice:', err);
    });
}
exports.default = app;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
    module.exports.default = app;
    module.exports.app = app;
    module.exports.server = server;
}
