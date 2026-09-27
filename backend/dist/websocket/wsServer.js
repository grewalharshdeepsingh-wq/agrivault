"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocketServer = initWebSocketServer;
exports.broadcast = broadcast;
exports.getConnectedClientCount = getConnectedClientCount;
const ws_1 = require("ws");
let wss = null;
const clients = new Set();
function initWebSocketServer(server) {
    wss = new ws_1.WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
        ws.isAlive = true;
        clients.add(ws);
        // Send connection greeting
        ws.send(JSON.stringify({
            type: 'connection_ack',
            serverTime: new Date().toISOString(),
            clientCount: clients.size,
            message: 'Connected to AgriVault Real-Time Telemetry Stream'
        }));
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'subscribe_facility') {
                    ws.facilityId = msg.facilityId;
                }
                else if (msg.type === 'subscribe_area') {
                    ws.subscribedAreaId = msg.areaId;
                }
                else if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                }
            }
            catch (err) {
                // ignore malformed frame
            }
        });
        ws.on('close', () => {
            clients.delete(ws);
        });
        ws.on('error', (err) => {
            console.warn('[WebSocket] Client error:', err.message);
            clients.delete(ws);
        });
    });
    // Keep-alive heartbeat interval every 30s
    const pingInterval = setInterval(() => {
        for (const ws of clients) {
            if (!ws.isAlive) {
                clients.delete(ws);
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            ws.ping();
        }
    }, 30000);
    wss.on('close', () => {
        clearInterval(pingInterval);
    });
    console.log('[WebSocket] Real-time WebSocket server attached on /ws');
    return wss;
}
function broadcast(eventType, payload) {
    if (!wss || clients.size === 0)
        return;
    const message = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
    for (const client of clients) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    }
}
function getConnectedClientCount() {
    return clients.size;
}
