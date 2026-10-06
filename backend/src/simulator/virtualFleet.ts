import { db } from '../database/db.js';
import { gatewayManager } from '../hardware/gatewayManager.js';
import { handleDeviceStatus, handleDeviceTelemetry } from '../mqtt/handlers.js';
import { publishMqtt } from '../mqtt/broker.js';
import { broadcast } from '../websocket/wsServer.js';

export type SimulationScenario =
  | 'normal'
  | 'temp_spike'
  | 'humidity_spike'
  | 'co2_spike'
  | 'gas_anomaly_mq3'
  | 'gas_anomaly_mq135'
  | 'gas_anomaly_ethylene'
  | 'gas_anomaly_ammonia'
  | 'gas_anomaly_ethanol'
  | 'multi_anomaly'
  | 'sensor_offline'
  | 'gateway_offline'
  | 'internet_offline'
  | 'wired_link_offline';

export interface VirtualNodeState {
  deviceId: string;
  hardwareId: string;
  displayName: string;
  facilityId: string;
  coldStoreName: string;
  zoneName: string;
  rackName: string;
  levelName: string;
  posX: number;
  posY: number;
  posZ: number;
  temp: number;
  humidity: number;
  mq3: number;
  mq135: number;
  co2: number;
  ethylene: number;
  ammonia: number;
  ethanol: number;
  battery: number;
  rssi: number;
  offline: boolean;
}

class VirtualFleetEngine {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private currentScenario: SimulationScenario = 'normal';
  private tickCount = 0;
  private nodes: Map<string, VirtualNodeState> = new Map();

  constructor() {
    this.initDefaultNodes();
  }

  public initDefaultNodes() {
    this.nodes.clear();

    this.nodes.set('AGR-ESP-001', {
      deviceId: 'AGR-ESP-001',
      hardwareId: '24:0A:C4:00:00:01',
      displayName: 'North Rack 1 - Level 2',
      facilityId: 'fac-01',
      coldStoreName: 'Cold Store A',
      zoneName: 'North Zone',
      rackName: 'Rack 1',
      levelName: 'Level 2',
      posX: 25.0,
      posY: 30.0,
      posZ: 4.5,
      temp: 3.8,
      humidity: 88.0,
      mq3: 0.45,
      mq135: 18.2,
      co2: 1050,
      ethylene: 0.03,
      ammonia: 1.2,
      ethanol: 0.45,
      battery: 3.32,
      rssi: -56,
      offline: false
    });

    this.nodes.set('AGR-ESP-002', {
      deviceId: 'AGR-ESP-002',
      hardwareId: '24:0A:C4:00:00:02',
      displayName: 'North Rack 2 - Level 1',
      facilityId: 'fac-01',
      coldStoreName: 'Cold Store A',
      zoneName: 'North Zone',
      rackName: 'Rack 2',
      levelName: 'Level 1',
      posX: 40.0,
      posY: 30.0,
      posZ: 2.0,
      temp: 4.1,
      humidity: 89.5,
      mq3: 0.50,
      mq135: 19.0,
      co2: 1120,
      ethylene: 0.04,
      ammonia: 1.4,
      ethanol: 0.50,
      battery: 3.31,
      rssi: -60,
      offline: false
    });

    this.nodes.set('AGR-ESP-003', {
      deviceId: 'AGR-ESP-003',
      hardwareId: '24:0A:C4:00:00:03',
      displayName: 'South Rack 5 - Level 3',
      facilityId: 'fac-01',
      coldStoreName: 'Cold Store A',
      zoneName: 'South Zone',
      rackName: 'Rack 5',
      levelName: 'Level 3',
      posX: 95.0,
      posY: 60.0,
      posZ: 6.8,
      temp: 3.5,
      humidity: 91.0,
      mq3: 0.38,
      mq135: 16.5,
      co2: 920,
      ethylene: 0.02,
      ammonia: 0.9,
      ethanol: 0.38,
      battery: 3.30,
      rssi: -64,
      offline: false
    });

    this.nodes.set('AGR-ESP-004', {
      deviceId: 'AGR-ESP-004',
      hardwareId: '24:0A:C4:00:00:04',
      displayName: 'Door Area Sensor',
      facilityId: 'fac-01',
      coldStoreName: 'Cold Store A',
      zoneName: 'Door Area',
      rackName: 'Entry Bay',
      levelName: 'Ground',
      posX: 145.0,
      posY: 80.0,
      posZ: 2.5,
      temp: 5.2,
      humidity: 82.0,
      mq3: 0.25,
      mq135: 22.0,
      co2: 780,
      ethylene: 0.01,
      ammonia: 0.6,
      ethanol: 0.25,
      battery: 3.33,
      rssi: -52,
      offline: false
    });
  }

  /**
   * Registers default simulated devices into DB if not present
   */
  public syncNodesToDatabase(): void {
    const now = new Date().toISOString();
    for (const n of this.nodes.values()) {
      const existing = db.get('SELECT id FROM esp_devices WHERE id = ? COLLATE NOCASE', n.deviceId);
      if (!existing) {
        db.run(
          `INSERT INTO esp_devices (
            id, hardware_id, device_code, device_type, registration_status, facility_id, area_id, gateway_id,
            parent_gateway_id, connection_protocol, user_name, hardware_type,
            firmware_version, ip_address, mac_address, is_online, last_heartbeat,
            signal_rssi, battery_voltage, is_enabled, is_discovered, is_simulated, installation_date, created_at,
            cold_store_name, zone_name, rack_name, level_name, pos_x, pos_y, pos_z
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          n.deviceId,
          n.hardwareId,
          n.deviceId,
          'SENSOR_NODE',
          'active',
          n.facilityId,
          null,
          gatewayManager.innerGatewayId,
          gatewayManager.innerGatewayId,
          'ESP-NOW',
          `[SIMULATED] ${n.displayName}`,
          'ESP32-DevKit-V1 (Simulated)',
          '1.4.0-sim',
          '10.0.0.' + n.deviceId.slice(-2),
          n.hardwareId,
          n.offline ? 0 : 1,
          now,
          n.rssi,
          n.battery,
          1,
          0,
          1, // is_simulated = 1
          now.split('T')[0],
          now,
          n.coldStoreName,
          n.zoneName,
          n.rackName,
          n.levelName,
          n.posX,
          n.posY,
          n.posZ
        );

        // Attach sensors
        const types = [
          { type: 'temperature', name: 'DS18B20 Temp Probe', unit: '°C', pin: 'GPIO 4' },
          { type: 'humidity', name: 'DHT11 Humidity Sensor', unit: '%', pin: 'GPIO 32' },
          { type: 'mq3', name: 'MQ3 Gas Sensor', unit: 'ppm', pin: 'GPIO 35' },
          { type: 'mq135', name: 'MQ135 Gas Sensor', unit: 'ppm', pin: 'GPIO 34' },
          { type: 'co2', name: 'CO2 Sensor', unit: 'ppm', pin: 'UART' }
        ];

        for (const s of types) {
          const sId = `sens-${n.deviceId}-${s.type}`;
          db.run(
            `INSERT INTO sensors (
              id, device_id, area_id, sensor_type, name, unit, pin,
              raw_reading, calibrated_reading, rate_of_change, rate_of_change_period,
              calibration_status, confidence_score, sensor_health, last_reading_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sId, n.deviceId, null, s.type, s.name, s.unit, s.pin,
            0, 0, 0, '30 min', 'factory_default', 95, 'healthy', now, now
          );
        }
      }
    }
  }

  public start(intervalMs = 3500): void {
    if (this.isRunning) return;
    this.syncNodesToDatabase();
    this.isRunning = true;
    console.log(`[Simulator] Virtual IoT Fleet started with scenario: "${this.currentScenario}"`);

    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[Simulator] Virtual IoT Fleet stopped.');
  }

  public setScenario(scenario: SimulationScenario): void {
    this.currentScenario = scenario;
    this.tickCount = 0;
    console.log(`[Simulator] Active scenario changed to: "${scenario}"`);

    if (scenario === 'internet_offline') {
      gatewayManager.setInternetStatus(false);
    } else if (scenario === 'wired_link_offline') {
      gatewayManager.setWiredLinkStatus('disconnected');
    } else if (scenario === 'gateway_offline') {
      gatewayManager.setInnerGatewayStatus(false);
    } else if (scenario === 'normal') {
      gatewayManager.setInternetStatus(true);
      gatewayManager.setWiredLinkStatus('connected');
      gatewayManager.setInnerGatewayStatus(true);
      gatewayManager.setOuterGatewayStatus(true);
      this.initDefaultNodes();
    }
  }

  public toggleNodeOffline(deviceId: string, offline: boolean): void {
    const node = this.nodes.get(deviceId.toUpperCase());
    if (node) {
      node.offline = offline;
      db.run('UPDATE esp_devices SET is_online = ? WHERE id = ? COLLATE NOCASE', offline ? 0 : 1, node.deviceId);
      broadcast('device_status_changed', { deviceId: node.deviceId, isOnline: offline ? 0 : 1 });
    }
  }

  public addNode(node: VirtualNodeState): void {
    this.nodes.set(node.deviceId.toUpperCase(), node);
    this.syncNodesToDatabase();
  }

  public getNodes(): VirtualNodeState[] {
    return Array.from(this.nodes.values());
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      activeScenario: this.currentScenario,
      activeNodesCount: Array.from(this.nodes.values()).filter(n => !n.offline).length,
      totalSimulatedNodes: this.nodes.size,
      tickCount: this.tickCount,
      topology: gatewayManager.getTopology()
    };
  }

  private tick(): void {
    this.tickCount++;
    const nowIso = new Date().toISOString();

    for (const node of this.nodes.values()) {
      if (node.offline) continue;

      // Handle sensor_offline scenario for AGR-ESP-001
      if (this.currentScenario === 'sensor_offline' && node.deviceId === 'AGR-ESP-001') {
        continue; // Silence to test watchdog offline alert
      }

      // Physics simulation
      this.applyScenarioPhysics(node);

      const packet = {
        node_id: node.deviceId,
        hardware_id: node.hardwareId,
        timestamp: nowIso,
        readings: {
          temperature: +node.temp.toFixed(2),
          humidity: +node.humidity.toFixed(1),
          mq3: +node.mq3.toFixed(2),
          mq135: +node.mq135.toFixed(1),
          co2: Math.round(node.co2),
          ethylene: +node.ethylene.toFixed(3),
          ammonia: +node.ammonia.toFixed(2),
          ethanol: +node.ethanol.toFixed(2)
        },
        temperature: +node.temp.toFixed(2),
        humidity: +node.humidity.toFixed(1),
        mq3: +node.mq3.toFixed(2),
        mq135: +node.mq135.toFixed(1),
        co2: Math.round(node.co2),
        ethylene: +node.ethylene.toFixed(3),
        ammonia: +node.ammonia.toFixed(2),
        ethanol: +node.ethanol.toFixed(2),
        signal_rssi: node.rssi,
        battery_voltage: node.battery,
        firmware_version: '1.4.0-sim',
        is_simulation: true
      };

      // Ingest via Gateway Manager (handles offline buffering if links are down!)
      const result = gatewayManager.ingestTelemetry(packet);

      if (result.delivered) {
        // Direct delivery: update DB & broadcast
        handleDeviceStatus('fac-01', gatewayManager.innerGatewayId, node.deviceId, {
          hardwareType: 'ESP32-DevKit-V1 (Simulated)',
          firmwareVersion: '1.4.0-sim',
          ipAddress: '10.0.0.' + node.deviceId.slice(-2),
          macAddress: node.hardwareId,
          rssi: node.rssi,
          battery: node.battery,
          capabilities: ['temperature', 'humidity', 'mq3', 'mq135', 'co2']
        });

        handleDeviceTelemetry('fac-01', gatewayManager.innerGatewayId, node.deviceId, {
          ...packet.readings,
          deviceId: node.deviceId,
          ip: '10.0.0.' + node.deviceId.slice(-2),
          is_simulation: true
        });

        // Publish to local MQTT broker as well
        publishMqtt(`agrivault/fac-01/device/${node.deviceId}/telemetry`, packet);
      }
    }
  }

  private applyScenarioPhysics(node: VirtualNodeState): void {
    const noise = (Math.random() - 0.5) * 0.1;
    node.temp += noise * 0.15;
    node.humidity += (Math.random() - 0.5) * 0.2;
    node.co2 += (Math.random() - 0.5) * 6;
    node.mq3 += (Math.random() - 0.5) * 0.02;
    node.mq135 += (Math.random() - 0.5) * 0.3;

    switch (this.currentScenario) {
      case 'temp_spike':
        if (node.deviceId === 'AGR-ESP-001') {
          if (node.temp < 8.8) node.temp += 0.35;
        }
        break;

      case 'humidity_spike':
        if (node.deviceId === 'AGR-ESP-002') {
          if (node.humidity < 98.0) node.humidity += 0.8;
        }
        break;

      case 'co2_spike':
        if (node.deviceId === 'AGR-ESP-001') {
          if (node.co2 < 1950) node.co2 += 60;
        }
        break;

      case 'gas_anomaly_mq3':
      case 'gas_anomaly_ethanol':
        if (node.deviceId === 'AGR-ESP-001') {
          if (node.mq3 < 3.2) node.mq3 += 0.25;
          if (node.ethanol < 3.2) node.ethanol += 0.25;
        }
        break;

      case 'gas_anomaly_mq135':
      case 'gas_anomaly_ammonia':
        if (node.deviceId === 'AGR-ESP-002') {
          if (node.mq135 < 85.0) node.mq135 += 5.5;
          if (node.ammonia < 6.8) node.ammonia += 0.45;
          node.temp += 0.1;
        }
        break;

      case 'gas_anomaly_ethylene':
        if (node.deviceId === 'AGR-ESP-003') {
          if (node.ethylene < 0.20) node.ethylene += 0.012;
        }
        break;

      case 'multi_anomaly':
        if (node.deviceId === 'AGR-ESP-001') {
          if (node.temp < 8.5) node.temp += 0.3;
          if (node.humidity < 96.0) node.humidity += 0.6;
          if (node.co2 < 1850) node.co2 += 50;
          if (node.mq3 < 2.8) node.mq3 += 0.2;
        }
        break;

      case 'normal':
      default:
        if (node.deviceId === 'AGR-ESP-001') {
          node.temp += (3.8 - node.temp) * 0.1;
          node.humidity += (88.0 - node.humidity) * 0.1;
          node.co2 += (1050 - node.co2) * 0.1;
          node.mq3 += (0.45 - node.mq3) * 0.1;
          node.mq135 += (18.2 - node.mq135) * 0.1;
        }
        if (node.deviceId === 'AGR-ESP-002') {
          node.temp += (4.1 - node.temp) * 0.1;
          node.humidity += (89.5 - node.humidity) * 0.1;
          node.co2 += (1120 - node.co2) * 0.1;
          node.mq3 += (0.50 - node.mq3) * 0.1;
          node.mq135 += (19.0 - node.mq135) * 0.1;
        }
        if (node.deviceId === 'AGR-ESP-003') {
          node.temp += (3.5 - node.temp) * 0.1;
          node.humidity += (91.0 - node.humidity) * 0.1;
          node.co2 += (920 - node.co2) * 0.1;
        }
        break;
    }
  }
}

export const virtualFleet = new VirtualFleetEngine();
