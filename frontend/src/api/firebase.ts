import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, get } from 'firebase/database';
import { ESPDevice, Sensor } from '../types';
import { wsManager } from './websocket';
import { stateMesh } from './stateMesh';

export const firebaseConfig = {
  apiKey: "AIzaSyDCz56EoH_SDzdQA8iEENOM00b3sSsyG4Y",
  authDomain: "agrivault-iot-7a2f.firebaseapp.com",
  databaseURL: "https://agrivault-iot-7a2f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "agrivault-iot-7a2f",
  storageBucket: "agrivault-iot-7a2f.firebasestorage.app",
  messagingSenderId: "53424538585",
  appId: "1:53424538585:web:e781ff8e3529b948d98fc8",
  measurementId: "G-9PNC8TCCE3"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseDb = getDatabase(app);

// In-memory cache of live devices received from Firebase Realtime Database
const firebaseDevicesMap = new Map<string, ESPDevice>();
let isInitialized = false;

function buildSensors(deviceId: string, areaId: string | null, raw: any): Sensor[] {
  if (Array.isArray(raw.sensors) && raw.sensors.length > 0) {
    return raw.sensors;
  }

  const sensors: Sensor[] = [];
  const nowStr = new Date().toISOString();

  if (raw.temperature !== undefined && raw.temperature !== null) {
    const val = Number(raw.temperature);
    sensors.push({
      id: `sens-${deviceId}-temperature`,
      device_id: deviceId,
      area_id: areaId || '',
      sensor_type: 'temperature',
      name: 'Temperature Probe (DS18B20)',
      unit: '°C',
      pin: 'GPIO 4',
      raw_reading: val,
      calibrated_reading: val,
      rate_of_change: 0,
      rate_of_change_period: '30 min',
      calibration_status: 'factory_default',
      confidence_score: 95,
      sensor_health: 'healthy',
      last_reading_time: nowStr
    });
  }

  if (raw.humidity !== undefined && raw.humidity !== null && Number(raw.humidity) > 0) {
    const val = Number(raw.humidity);
    sensors.push({
      id: `sens-${deviceId}-humidity`,
      device_id: deviceId,
      area_id: areaId || '',
      sensor_type: 'humidity',
      name: 'Relative Humidity (DHT11)',
      unit: '%',
      pin: 'GPIO 32',
      raw_reading: val,
      calibrated_reading: val,
      rate_of_change: 0,
      rate_of_change_period: '30 min',
      calibration_status: 'factory_default',
      confidence_score: 90,
      sensor_health: 'healthy',
      last_reading_time: nowStr
    });
  }

  if (raw.mq3 !== undefined && raw.mq3 !== null) {
    const val = Number(raw.mq3);
    sensors.push({
      id: `sens-${deviceId}-mq3`,
      device_id: deviceId,
      area_id: areaId || '',
      sensor_type: 'mq3',
      name: 'Volatiles & Fermentation (MQ-3)',
      unit: 'ppm',
      pin: 'GPIO 35',
      raw_reading: val,
      calibrated_reading: val,
      rate_of_change: 0,
      rate_of_change_period: '30 min',
      calibration_status: 'factory_default',
      confidence_score: 90,
      sensor_health: 'healthy',
      last_reading_time: nowStr
    });
  }

  if (raw.mq135 !== undefined && raw.mq135 !== null) {
    const val = Number(raw.mq135);
    sensors.push({
      id: `sens-${deviceId}-mq135`,
      device_id: deviceId,
      area_id: areaId || '',
      sensor_type: 'mq135',
      name: 'Air Quality & Respiration (MQ-135)',
      unit: 'ppm',
      pin: 'GPIO 34',
      raw_reading: val,
      calibrated_reading: val,
      rate_of_change: 0,
      rate_of_change_period: '30 min',
      calibration_status: 'factory_default',
      confidence_score: 90,
      sensor_health: 'healthy',
      last_reading_time: nowStr
    });
  }

  return sensors;
}

export function rawToESPDevice(id: string, raw: any): ESPDevice {
  const normId = (id || raw.deviceId || raw.id || 'ESP32-UNKNOWN').trim().toUpperCase();
  const assignments = stateMesh.getAssignments();
  const assignedAreaId = assignments[normId] || raw.area_id || raw.areaId || null;

  const lastHb = raw.last_heartbeat || raw.lastHeartbeat || raw.timestamp || new Date().toISOString();
  const lastHbMs = typeof lastHb === 'number' ? lastHb : new Date(lastHb).getTime();
  const isOnline = Date.now() - lastHbMs < 45000 ? 1 : (raw.is_online !== undefined ? raw.is_online : 1);

  return {
    id: normId,
    hardware_id: raw.hardware_id || raw.hardwareId || raw.macAddress || raw.mac_address || normId,
    device_code: raw.device_code || raw.deviceCode || normId,
    device_type: raw.device_type || raw.deviceType || 'SENSOR_NODE',
    registration_status: raw.registration_status || raw.registrationStatus || 'active',
    facility_id: raw.facility_id || raw.facilityId || 'fac-01',
    cold_store_name: raw.cold_store_name || 'Cold Store A',
    zone_name: raw.zone_name || (assignedAreaId ? 'Assigned Room' : 'Unassigned Fleet'),
    area_id: assignedAreaId,
    rack_name: raw.rack_name || 'Rack 1',
    level_name: raw.level_name || 'Level 1',
    pos_x: raw.pos_x ?? 20,
    pos_y: raw.pos_y ?? 20,
    pos_z: raw.pos_z ?? 2,
    gateway_id: raw.gateway_id || null,
    parent_gateway_id: raw.parent_gateway_id || null,
    parent_node_id: raw.parent_node_id || null,
    connection_protocol: raw.connection_protocol || 'Firebase Cloud (Direct HTTPS/TLS)',
    user_name: raw.user_name || raw.userName || raw.deviceName || normId,
    hardware_type: raw.hardware_type || raw.hardwareType || 'ESP32-DevKit-V1',
    firmware_version: raw.firmware_version || raw.firmwareVersion || 'v2.5.0-firebase',
    ip_address: raw.ip_address || raw.ipAddress || '192.168.1.1',
    mac_address: raw.mac_address || raw.macAddress || raw.hardware_id || normId,
    is_online: isOnline ? 1 : 0,
    last_heartbeat: typeof lastHb === 'number' ? new Date(lastHb).toISOString() : lastHb,
    signal_rssi: raw.signal_rssi ?? raw.rssi ?? -60,
    battery_voltage: raw.battery_voltage ?? raw.battery ?? 3.3,
    is_enabled: raw.is_enabled ?? 1,
    is_discovered: 1,
    is_simulated: 0,
    installation_date: raw.installation_date || new Date().toISOString().split('T')[0],
    area_name: raw.area_name || null,
    sensors: buildSensors(normId, assignedAreaId, raw)
  };
}

export function initFirebaseRealtime(): void {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const devicesRef = ref(firebaseDb, 'devices');
    onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      Object.entries(data).forEach(([key, val]: [string, any]) => {
        if (!val || typeof val !== 'object') return;
        if (val.is_simulated === 1 || key.startsWith('AGR-ESP-')) return;

        const dev = rawToESPDevice(key, val);
        firebaseDevicesMap.set(dev.id.toUpperCase(), dev);

        // Forward live update into AgriVault's WebSocket and Mesh managers
        wsManager.emit('device_updated', dev);
        wsManager.emit('device_discovered', { device: dev });
        if (dev.sensors && dev.sensors.length > 0) {
          wsManager.emit('telemetry_update', { deviceId: dev.id, readings: dev.sensors });
        }
      });
    }, (error) => {
      console.warn('[Firebase RTDB] Listen error:', error);
    });
    console.log('[AgriVault] Firebase Realtime Database listener active for Asia-Southeast1 cluster.');
  } catch (err) {
    console.error('[Firebase RTDB] Init error:', err);
  }
}

export function getFirebaseDevices(): ESPDevice[] {
  return Array.from(firebaseDevicesMap.values());
}

export async function setFirebaseRelay(deviceId: string, targetState: boolean): Promise<void> {
  const normId = deviceId.trim().toUpperCase();
  const devRef = ref(firebaseDb, `devices/${normId}`);
  await update(devRef, {
    relayState: targetState ? 1 : 0,
    command: targetState ? 'RELAY_ON' : 'RELAY_OFF',
    commandTimestamp: Date.now()
  });
}
