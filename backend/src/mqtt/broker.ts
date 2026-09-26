import net from 'node:net';
import aedes from 'aedes';
import { handleMqttMessage } from './handlers.js';

let aedesInstance: any = null;
let tcpServer: net.Server | null = null;

export function initMqttBroker(port = 1883): Promise<void> {
  return new Promise((resolve, reject) => {
    aedesInstance = (aedes as any)();

    tcpServer = net.createServer(aedesInstance.handle);

    // Authentication hook (can enforce device tokens or allow local network mesh)
    aedesInstance.authenticate = (client: any, username: string, password: Buffer, callback: any) => {
      // In production, validate credentials; accept local ESPs/gateways
      callback(null, true);
    };

    aedesInstance.on('client', (client: any) => {
      // Client connected
    });

    aedesInstance.on('clientDisconnect', (client: any) => {
      // Client disconnected
    });

    aedesInstance.on('publish', (packet: any, client: any) => {
      if (packet.topic && packet.topic.startsWith('agrivault/')) {
        try {
          const payloadStr = packet.payload.toString('utf8');
          handleMqttMessage(packet.topic, payloadStr);
        } catch (err) {
          console.error('[MQTT] Error processing packet:', err);
        }
      }
    });

    tcpServer.listen(port, () => {
      console.log(`[MQTT] Embedded Aedes MQTT broker listening on port ${port}`);
      resolve();
    });

    tcpServer.on('error', (err: any) => {
      console.error('[MQTT] Broker TCP error:', err.message);
      // If port 1883 is already in use by Mosquitto, don't crash
      resolve();
    });
  });
}

/**
 * Publishes an MQTT message to connected nodes/gateways
 */
export function publishMqtt(topic: string, message: object | string): void {
  if (!aedesInstance) return;
  const payload = typeof message === 'string' ? message : JSON.stringify(message);

  aedesInstance.publish(
    {
      topic,
      payload: Buffer.from(payload),
      qos: 1,
      retain: false,
      dup: false,
      cmd: 'publish'
    },
    (err: any) => {
      if (err) {
        console.error(`[MQTT] Publish error on ${topic}:`, err);
      }
    }
  );
}

export function getMqttBrokerStatus(): { isRunning: boolean; connectedClients: number } {
  return {
    isRunning: tcpServer ? tcpServer.listening : false,
    connectedClients: aedesInstance ? aedesInstance.connectedClients : 0
  };
}
