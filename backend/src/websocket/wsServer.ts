import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

interface AgriVaultClient extends WebSocket {
  isAlive: boolean;
  facilityId?: string;
  subscribedAreaId?: string;
}

let wss: WebSocketServer | null = null;
const clients = new Set<AgriVaultClient>();

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AgriVaultClient) => {
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

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe_facility') {
          ws.facilityId = msg.facilityId;
        } else if (msg.type === 'subscribe_area') {
          ws.subscribedAreaId = msg.areaId;
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
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

export function broadcast(eventType: string, payload: any): void {
  if (!wss || clients.size === 0) return;
  const message = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
