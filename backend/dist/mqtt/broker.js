"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initMqttBroker = initMqttBroker;
exports.publishMqtt = publishMqtt;
exports.getMqttBrokerStatus = getMqttBrokerStatus;
const node_net_1 = __importDefault(require("node:net"));
const aedes_1 = __importDefault(require("aedes"));
const handlers_js_1 = require("./handlers.js");
let aedesInstance = null;
let tcpServer = null;
function initMqttBroker(port = 1883) {
    return new Promise((resolve, reject) => {
        aedesInstance = aedes_1.default();
        tcpServer = node_net_1.default.createServer(aedesInstance.handle);
        // Authentication hook (can enforce device tokens or allow local network mesh)
        aedesInstance.authenticate = (client, username, password, callback) => {
            // In production, validate credentials; accept local ESPs/gateways
            callback(null, true);
        };
        aedesInstance.on('client', (client) => {
            // Client connected
        });
        aedesInstance.on('clientDisconnect', (client) => {
            // Client disconnected
        });
        aedesInstance.on('publish', (packet, client) => {
            if (packet.topic && packet.topic.startsWith('agrivault/')) {
                try {
                    const payloadStr = packet.payload.toString('utf8');
                    (0, handlers_js_1.handleMqttMessage)(packet.topic, payloadStr);
                }
                catch (err) {
                    console.error('[MQTT] Error processing packet:', err);
                }
            }
        });
        tcpServer.listen(port, () => {
            console.log(`[MQTT] Embedded Aedes MQTT broker listening on port ${port}`);
            resolve();
        });
        tcpServer.on('error', (err) => {
            console.error('[MQTT] Broker TCP error:', err.message);
            // If port 1883 is already in use by Mosquitto, don't crash
            resolve();
        });
    });
}
/**
 * Publishes an MQTT message to connected nodes/gateways
 */
function publishMqtt(topic, message) {
    if (!aedesInstance)
        return;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    aedesInstance.publish({
        topic,
        payload: Buffer.from(payload),
        qos: 1,
        retain: false,
        dup: false,
        cmd: 'publish'
    }, (err) => {
        if (err) {
            console.error(`[MQTT] Publish error on ${topic}:`, err);
        }
    });
}
function getMqttBrokerStatus() {
    return {
        isRunning: tcpServer ? tcpServer.listening : false,
        connectedClients: aedesInstance ? aedesInstance.connectedClients : 0
    };
}
