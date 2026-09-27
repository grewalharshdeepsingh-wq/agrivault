"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.virtualFleet = void 0;
const broker_js_1 = require("../mqtt/broker.js");
class VirtualFleetEngine {
    isRunning = false;
    timer = null;
    currentScenario = 'normal';
    tickCount = 0;
    nodes = new Map();
    constructor() {
        this.initDefaultNodes();
    }
    initDefaultNodes() {
        this.nodes.set('ESP32-A7F21', {
            deviceId: 'ESP32-A7F21',
            facilityId: 'fac-01',
            gatewayId: 'gw-01',
            temp: 4.8,
            humidity: 88.0,
            co2: 1100,
            ethylene: 0.04,
            ammonia: 1.8,
            ethanol: 0.6,
            battery: 3.32,
            rssi: -56,
            offline: false
        });
        this.nodes.set('ESP32-C9D45', {
            deviceId: 'ESP32-C9D45',
            facilityId: 'fac-01',
            gatewayId: 'gw-01',
            temp: 5.2,
            humidity: 90.5,
            co2: 1250,
            ethylene: 0.06,
            ammonia: 2.1,
            ethanol: 0.8,
            battery: 3.31,
            rssi: -60,
            offline: false
        });
        this.nodes.set('ESP32-D1F56', {
            deviceId: 'ESP32-D1F56',
            facilityId: 'fac-01',
            gatewayId: 'gw-01',
            temp: 1.8,
            humidity: 92.0,
            co2: 820,
            ethylene: 0.03,
            ammonia: 0.8,
            ethanol: 0.4,
            battery: 3.30,
            rssi: -65,
            offline: false
        });
        this.nodes.set('ESP32-E2A67', {
            deviceId: 'ESP32-E2A67',
            facilityId: 'fac-01',
            gatewayId: 'direct',
            temp: 11.2,
            humidity: 68.0,
            co2: 560,
            ethylene: 0.01,
            ammonia: 0.5,
            ethanol: 0.2,
            battery: 3.33,
            rssi: -52,
            offline: false
        });
        this.nodes.set('ESP8266-C4B12', {
            deviceId: 'ESP8266-C4B12',
            facilityId: 'fac-01',
            gatewayId: 'direct',
            temp: 5.6,
            humidity: 89.2,
            co2: 950,
            ethylene: 0.02,
            ammonia: 0.9,
            ethanol: 0.3,
            battery: 3.28,
            rssi: -58,
            offline: false
        });
    }
    start(intervalMs = 4000) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log(`[Simulator] Virtual IoT Fleet started with scenario: "${this.currentScenario}"`);
        this.timer = setInterval(() => {
            this.tick();
        }, intervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('[Simulator] Virtual IoT Fleet stopped.');
    }
    setScenario(scenario) {
        this.currentScenario = scenario;
        this.tickCount = 0;
        console.log(`[Simulator] Active scenario changed to: "${scenario}"`);
        // Reset node baseline when returning to normal
        if (scenario === 'normal') {
            this.initDefaultNodes();
        }
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeScenario: this.currentScenario,
            activeNodesCount: Array.from(this.nodes.values()).filter(n => !n.offline).length,
            totalSimulatedNodes: this.nodes.size,
            tickCount: this.tickCount
        };
    }
    tick() {
        this.tickCount++;
        for (const node of this.nodes.values()) {
            // Handle Gateway Offline scenario
            if (this.currentScenario === 'gateway_offline') {
                // Drop all gateway transmissions
                return;
            }
            // Handle Sensor Offline scenario for ESP32-A7F21
            if (this.currentScenario === 'sensor_offline' && node.deviceId === 'ESP32-A7F21') {
                // Cease transmitting to trigger watchdog offline alert
                continue;
            }
            // Apply Scenario physics
            this.applyScenarioPhysics(node);
            // Construct direct MQTT telemetry topic over Internet
            const topic = `agrivault/${node.facilityId}/device/${node.deviceId}/telemetry`;
            // Build realistic payload
            const payload = {
                deviceId: node.deviceId,
                timestamp: new Date().toISOString(),
                temperature: +node.temp.toFixed(2),
                humidity: +node.humidity.toFixed(1),
                co2: Math.round(node.co2),
                ethylene: +node.ethylene.toFixed(3),
                ammonia: +node.ammonia.toFixed(2),
                ethanol: +node.ethanol.toFixed(2),
                battery: node.battery,
                rssi: node.rssi,
                raw: {
                    temperature: +(node.temp * 1.02).toFixed(2),
                    co2: Math.round(node.co2 * 0.55), // ADC reading
                    ammonia: +(node.ammonia * 0.9).toFixed(2),
                    ethanol: +(node.ethanol * 0.85).toFixed(2)
                },
                is_simulation: true
            };
            // Publish directly via embedded MQTT broker
            (0, broker_js_1.publishMqtt)(topic, payload);
        }
    }
    applyScenarioPhysics(node) {
        // Basic natural thermal & air fluctuation
        const noise = (Math.random() - 0.5) * 0.1;
        node.temp += noise * 0.2;
        node.humidity += (Math.random() - 0.5) * 0.3;
        node.co2 += (Math.random() - 0.5) * 8;
        switch (this.currentScenario) {
            case 'temp_spike':
                if (node.deviceId === 'ESP32-A7F21') {
                    // Gradual realistic thermal runaway up to 8.8°C
                    if (node.temp < 8.8)
                        node.temp += 0.35;
                }
                break;
            case 'humidity_spike':
                if (node.deviceId === 'ESP32-C9D45') {
                    // Condensation saturation event up to 98%
                    if (node.humidity < 98.0)
                        node.humidity += 0.9;
                }
                break;
            case 'co2_spike':
                if (node.deviceId === 'ESP32-A7F21') {
                    // Heavy stack respiration up to 1,950 ppm
                    if (node.co2 < 1950)
                        node.co2 += 65;
                }
                break;
            case 'gas_anomaly_ethylene':
                if (node.deviceId === 'ESP32-D1F56') {
                    // Sudden ripening volatile surge up to 0.19 ppm
                    if (node.ethylene < 0.19)
                        node.ethylene += 0.012;
                }
                break;
            case 'gas_anomaly_ammonia':
                if (node.deviceId === 'ESP32-C9D45') {
                    // Pin-hole refrigerant leak up to 6.8 ppm
                    if (node.ammonia < 6.8)
                        node.ammonia += 0.45;
                    node.temp += 0.1; // Chiller starts struggling
                }
                break;
            case 'gas_anomaly_ethanol':
                if (node.deviceId === 'ESP32-A7F21') {
                    // Anaerobic fermentation / soft rot indicator
                    if (node.ethanol < 3.4)
                        node.ethanol += 0.25;
                }
                break;
            case 'multi_anomaly':
                if (node.deviceId === 'ESP32-A7F21') {
                    // High Temp + High Humidity + High CO2 -> Spoilage Risk rule trigger!
                    if (node.temp < 8.4)
                        node.temp += 0.3;
                    if (node.humidity < 96.5)
                        node.humidity += 0.7;
                    if (node.co2 < 1850)
                        node.co2 += 50;
                }
                break;
            case 'normal':
            default:
                // Gentle bounds recovery to baseline
                if (node.deviceId === 'ESP32-A7F21') {
                    node.temp += (4.8 - node.temp) * 0.1;
                    node.humidity += (88.0 - node.humidity) * 0.1;
                    node.co2 += (1100 - node.co2) * 0.1;
                    node.ethanol += (0.6 - node.ethanol) * 0.1;
                }
                if (node.deviceId === 'ESP32-C9D45') {
                    node.temp += (5.2 - node.temp) * 0.1;
                    node.humidity += (90.5 - node.humidity) * 0.1;
                    node.co2 += (1250 - node.co2) * 0.1;
                    node.ammonia += (2.1 - node.ammonia) * 0.1;
                }
                if (node.deviceId === 'ESP32-D1F56') {
                    node.temp += (1.8 - node.temp) * 0.1;
                    node.ethylene += (0.03 - node.ethylene) * 0.1;
                }
                break;
        }
    }
}
exports.virtualFleet = new VirtualFleetEngine();
