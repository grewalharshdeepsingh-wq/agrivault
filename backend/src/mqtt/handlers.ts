import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { ESPDevice, Sensor, Area } from '../models/types.js';
import { evaluateSensorReading } from '../engine/alertEngine.js';
import { evaluateAutomationRules } from '../engine/automationEngine.js';
import { calculateAreaHealthScore, MetricEvaluationInput } from '../engine/areaHealthScore.js';
import { recordDeviceHeartbeat } from '../engine/heartbeatWatchdog.js';
import { broadcast } from '../websocket/wsServer.js';

interface ParsedTopic {
  facilityId: string;
  gatewayId?: string;
  deviceId: string;
  action: 'telemetry' | 'status' | 'command' | 'response';
}

export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split('/');
  // Direct over Internet: agrivault / {facId} / device / {devId} / {action}
  if (parts.length === 5 && parts[0] === 'agrivault' && parts[2] === 'device') {
    return {
      facilityId: parts[1],
      gatewayId: undefined,
      deviceId: parts[3],
      action: parts[4] as any
    };
  }
  // Legacy Gateway: agrivault / {facId} / gateway / {gwId} / device / {devId} / {action}
  if (parts.length === 7 && parts[0] === 'agrivault' && parts[2] === 'gateway' && parts[4] === 'device') {
    return {
      facilityId: parts[1],
      gatewayId: parts[3],
      deviceId: parts[5],
      action: parts[6] as any
    };
  }
  return null;
}

export function handleMqttMessage(topic: string, payloadStr: string): void {
  const parsed = parseTopic(topic);
  if (!parsed) return;

  let payload: any;
  try {
    payload = JSON.parse(payloadStr);
  } catch (e) {
    return;
  }

  const { facilityId, gatewayId, deviceId, action } = parsed;

  if (action === 'status') {
    handleDeviceStatus(facilityId, gatewayId, deviceId, payload);
  } else if (action === 'telemetry') {
    handleDeviceTelemetry(facilityId, gatewayId, deviceId, payload);
  } else if (action === 'response') {
    handleDeviceResponse(facilityId, gatewayId, deviceId, payload);
  }
}

/**
 * Handles device discovery & heartbeat status packets
 */
export function handleDeviceStatus(
  facilityId: string,
  gatewayId: string | undefined | null,
  deviceId: string,
  payload: {
    hardwareType?: string;
    firmwareVersion?: string;
    ipAddress?: string;
    macAddress?: string;
    rssi?: number;
    battery?: number;
    capabilities?: string[]; // e.g. ['temperature', 'humidity', 'co2', 'ammonia', 'relay']
  }
): void {
  const now = new Date().toISOString();
  let dev = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ?', deviceId);

  if (!dev) {
    // 1. AUTO-DISCOVER NEW DEVICE OVER INTERNET!
    const isEsp8266 = deviceId.toUpperCase().includes('8266') || (payload.hardwareType && payload.hardwareType.toUpperCase().includes('8266'));
    const hwType = payload.hardwareType || (isEsp8266 ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1');
    const mac = payload.macAddress || (isEsp8266 ? '5C:CF:7F:00:00:01' : '24:0A:C4:00:00:01');
    const defaultName = `${isEsp8266 ? 'ESP8266' : 'ESP32'} Node: ${deviceId}`;
    const validGw = gatewayId ? db.get('SELECT id FROM gateways WHERE id = ?', gatewayId) : null;
    const finalGatewayId = validGw ? gatewayId : null;

    db.run(
      `INSERT INTO esp_devices (
        id, facility_id, area_id, gateway_id, user_name, hardware_type,
        firmware_version, ip_address, mac_address, is_online, last_heartbeat,
        signal_rssi, battery_voltage, is_enabled, is_discovered, installation_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      deviceId,
      facilityId,
      null, // unassigned initially
      finalGatewayId,
      defaultName,
      hwType,
      payload.firmwareVersion || '1.3.0-ota',
      payload.ipAddress || '192.168.1.199',
      mac,
      1,
      now,
      payload.rssi || -55,
      payload.battery || 3.3,
      1,
      1, // marked as newly discovered
      now.split('T')[0],
      now
    );

    // Auto-create sensor rows for reported capabilities
    const caps = payload.capabilities || ['temperature', 'humidity', 'co2', 'ammonia', 'ethanol'];
    for (const cap of caps) {
      if (cap === 'relay') continue;
      const sId = `sens-${deviceId}-${cap}`;
      let unit = 'ppm';
      let pin = isEsp8266 ? 'D1 (GPIO 5)' : 'GPIO 35';
      if (cap === 'temperature') { unit = '°C'; pin = isEsp8266 ? 'D2 (GPIO 4)' : 'GPIO 4'; }
      if (cap === 'humidity') { unit = '%'; pin = isEsp8266 ? 'D7 (GPIO 13)' : 'GPIO 32'; }
      if (cap === 'ethanol') { pin = isEsp8266 ? 'A0 (ADC0)' : 'GPIO 34'; }

      db.run(
        `INSERT INTO sensors (
          id, device_id, area_id, sensor_type, name, unit, pin,
          raw_reading, calibrated_reading, rate_of_change, rate_of_change_period,
          calibration_status, confidence_score, sensor_health, last_reading_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sId, deviceId, null, cap, `${cap.toUpperCase()} Sensor`, unit, pin,
        0, 0, 0, '30 min', 'factory_default', 90, 'healthy', now, now
      );
    }

    dev = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ?', deviceId);

    // Broadcast newly discovered device to UI
    broadcast('device_discovered', {
      device: dev,
      capabilities: caps,
      message: `New ${isEsp8266 ? 'ESP8266' : 'ESP32'} node ${deviceId} connected directly over Internet!`
    });
    console.log(`[Discovery] Auto-registered new ${isEsp8266 ? 'ESP8266' : 'ESP32'} sensor node: ${deviceId} (Direct Internet)`);
  } else {
    // Existing device heartbeat update
    recordDeviceHeartbeat(deviceId, payload.rssi, payload.ipAddress);
  }
}

/**
 * Ingests live telemetry readings, updates DB, checks thresholds & automation,
 * updates Area Health Score, and broadcasts to frontends via WebSocket.
 */
export function handleDeviceTelemetry(
  facilityId: string,
  gatewayId: string | undefined | null,
  deviceId: string,
  payload: Record<string, any>
): void {
  const now = new Date().toISOString();
  recordDeviceHeartbeat(deviceId, payload.rssi, payload.ip);

  const dev = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ?', deviceId);
  const areaId = dev?.area_id || null;
  const isSimulation = payload.is_simulation ? 1 : 0;

  const supportedSensors = ['temperature', 'humidity', 'co2', 'ethylene', 'ammonia', 'ethanol', 'voc'];
  const updatedSensors: any[] = [];

  for (const param of supportedSensors) {
    if (payload[param] !== undefined && payload[param] !== null) {
      const val = parseFloat(payload[param]);
      if (isNaN(val)) continue;

      const sensorId = `sens-${deviceId}-${param}`;
      const rawVal = payload.raw?.[param] !== undefined ? parseFloat(payload.raw[param]) : val;

      // Fetch previous reading to calculate Rate of Change
      const prevSensor = db.get<Sensor>('SELECT * FROM sensors WHERE id = ?', sensorId);
      let roc = 0;
      if (prevSensor) {
        roc = +(val - prevSensor.calibrated_reading).toFixed(2);
      }

      // Upsert sensor
      if (prevSensor) {
        db.run(
          `UPDATE sensors SET
            raw_reading = ?, calibrated_reading = ?, rate_of_change = ?,
            area_id = ?, last_reading_time = ?
          WHERE id = ?`,
          rawVal, val, roc, areaId, now, sensorId
        );
      } else {
        let unit = 'ppm';
        if (param === 'temperature') unit = '°C';
        if (param === 'humidity') unit = '%';

        db.run(
          `INSERT INTO sensors (
            id, device_id, area_id, sensor_type, name, unit, pin,
            raw_reading, calibrated_reading, rate_of_change, rate_of_change_period,
            calibration_status, confidence_score, sensor_health, last_reading_time, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sensorId, deviceId, areaId, param, `${param.toUpperCase()} Probe`, unit, 'GPIO',
          rawVal, val, roc, '30 min', 'calibrated', 95.0, 'healthy', now, now
        );
      }

      // Append time-series history
      db.run(
        `INSERT INTO sensor_readings (
          id, sensor_id, device_id, area_id, sensor_type, raw_value, calibrated_value, unit, is_simulation, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(), sensorId, deviceId, areaId, param, rawVal, val, prevSensor?.unit || 'ppm', isSimulation, now
      );

      // Evaluate Thresholds & Alerts
      const commodity = areaId ? db.get<Area>('SELECT commodity FROM areas WHERE id = ?', areaId)?.commodity : 'General Produce';
      evaluateSensorReading(facilityId, areaId, deviceId, sensorId, param, val, commodity);

      // Evaluate Relay Automation Rules
      if (areaId) {
        evaluateAutomationRules(areaId, param, val);
      }

      updatedSensors.push({
        sensorId,
        parameter: param,
        value: val,
        raw: rawVal,
        rateOfChange: roc,
        unit: prevSensor?.unit || (param === 'temperature' ? '°C' : param === 'humidity' ? '%' : 'ppm')
      });
    }
  }

  // Recalculate Area Health Score if assigned
  let areaHealthUpdate = null;
  if (areaId && areaId !== 'unassigned') {
    const areaSensors = db.all<Sensor>(
      "SELECT s.*, t.min_value, t.max_value, t.warning_min, t.warning_max FROM sensors s LEFT JOIN thresholds t ON t.scope_type = 'facility' AND t.parameter = s.sensor_type WHERE s.area_id = ?",
      areaId
    );

    const metricInputs: MetricEvaluationInput[] = areaSensors.map(s => ({
      parameter: s.sensor_type,
      name: s.name,
      value: s.calibrated_reading,
      min: (s as any).min_value,
      max: (s as any).max_value,
      warningMin: (s as any).warning_min,
      warningMax: (s as any).warning_max,
      rateOfChange: s.rate_of_change,
      rateOfChangePeriod: s.rate_of_change_period,
      unit: s.unit,
      sensorHealth: s.sensor_health,
      confidenceScore: s.confidence_score
    }));

    const healthResult = calculateAreaHealthScore(metricInputs);
    db.run(
      'UPDATE areas SET health_status = ?, health_score = ?, health_reasons = ? WHERE id = ?',
      healthResult.status, healthResult.score, JSON.stringify(healthResult.reasons), areaId
    );

    areaHealthUpdate = {
      areaId,
      healthStatus: healthResult.status,
      healthScore: healthResult.score,
      healthReasons: healthResult.reasons
    };
  }

  // Broadcast Real-Time Telemetry to Web/Desktop/Mobile clients
  broadcast('telemetry_update', {
    deviceId,
    areaId,
    timestamp: now,
    sensors: updatedSensors,
    areaHealth: areaHealthUpdate,
    battery: payload.battery,
    rssi: payload.rssi,
    isSimulation
  });
}

export function handleDeviceResponse(facilityId: string, gatewayId: string | undefined | null, deviceId: string, payload: any): void {
  // Command execution ack from device
  broadcast('device_command_ack', {
    deviceId,
    payload,
    timestamp: new Date().toISOString()
  });
}
