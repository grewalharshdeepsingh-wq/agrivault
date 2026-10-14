import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, update, set, remove } from 'firebase/database';
import { ESPDevice, Sensor } from '../types';
import { wsManager } from './websocket';
import { stateMesh, registerDeviceLookup } from './stateMesh';

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
const discoveredDevicesSet = new Set<string>();
const lastDeviceSignatures = new Map<string, string>();
let isInitialized = false;

function getOrBuildSensor(
  deviceId: string,
  areaId: string | null,
  type: string,
  name: string,
  unit: string,
  pin: string,
  val: number,
  existingSensors?: Sensor[]
): Sensor {
  const existing = existingSensors?.find((s) => s.sensor_type === type);
  const nowIso = new Date().toISOString();
  if (existing && existing.calibrated_reading === val) {
    existing.last_reading_time = nowIso;
    return existing; // Preserve stable object reference while keeping telemetry fresh
  }
  return {
    id: `sens-${deviceId}-${type}`,
    device_id: deviceId,
    area_id: areaId || '',
    sensor_type: type,
    name,
    unit,
    pin,
    raw_reading: val,
    calibrated_reading: val,
    rate_of_change: 0,
    rate_of_change_period: '30 min',
    calibration_status: 'factory_default',
    confidence_score: 95,
    sensor_health: 'healthy',
    last_reading_time: existing?.last_reading_time || new Date().toISOString()
  };
}

function buildSensors(deviceId: string, areaId: string | null, raw: any, existingSensors?: Sensor[]): Sensor[] {
  if (Array.isArray(raw.sensors) && raw.sensors.length > 0) {
    return raw.sensors;
  }

  const sensors: Sensor[] = [];

  if (raw.temperature !== undefined && raw.temperature !== null) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'temperature', 'Temperature Probe (DS18B20)', '°C', 'GPIO 4', Number(raw.temperature), existingSensors
    ));
  }

  if (raw.humidity !== undefined && raw.humidity !== null && Number(raw.humidity) > 0) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'humidity', 'Relative Humidity (DHT11)', '%', 'GPIO 32', Number(raw.humidity), existingSensors
    ));
  }

  if (raw.mq3 !== undefined && raw.mq3 !== null) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'mq3', 'Volatiles & Fermentation (MQ-3)', 'ppm', 'GPIO 35', Number(raw.mq3), existingSensors
    ));
  }

  if (raw.mq135 !== undefined && raw.mq135 !== null) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'mq135', 'Air Quality & Respiration (MQ-135)', 'ppm', 'GPIO 34', Number(raw.mq135), existingSensors
    ));
  }

  // Respiration & CO2 (from MQ-135 or direct co2 metric)
  if (raw.co2 !== undefined && raw.co2 !== null) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'co2', 'Respiration & CO2 (MQ-135)', 'ppm', 'GPIO 34', Number(raw.co2), existingSensors
    ));
  } else if (raw.mq135 !== undefined && raw.mq135 !== null && Number(raw.mq135) > 0) {
    const rawAdc = Number(raw.mq135);
    const vOut = (rawAdc / 4095.0) * 3.3;
    const rs = vOut > 0 && vOut < 3.3 ? ((3.3 - vOut) * 10.0) / vOut : 10.0;
    const ratio = Math.max(0.01, rs / 35.0);
    const co2Est = Math.min(5000, Math.max(400, Math.round(110.0 * Math.pow(ratio, -2.2) + 400.0)));
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'co2', 'Respiration & CO2 (MQ-135)', 'ppm', 'GPIO 34', co2Est, existingSensors
    ));
  }

  // Ammonia (from MQ-135 or direct ammonia metric)
  if (raw.ammonia !== undefined && raw.ammonia !== null) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'ammonia', 'Ammonia & Breakdown (MQ-135)', 'ppm', 'GPIO 34', Number(raw.ammonia), existingSensors
    ));
  } else if (raw.mq135 !== undefined && raw.mq135 !== null && Number(raw.mq135) > 0) {
    const rawAdc = Number(raw.mq135);
    const vOut = (rawAdc / 4095.0) * 3.3;
    const rs = vOut > 0 && vOut < 3.3 ? ((3.3 - vOut) * 10.0) / vOut : 10.0;
    const ratio = Math.max(0.01, rs / 35.0);
    const nh3Est = Math.min(100, Math.max(0.1, +(1.02 * Math.pow(ratio, -1.8)).toFixed(2)));
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'ammonia', 'Ammonia & Breakdown (MQ-135)', 'ppm', 'GPIO 34', nh3Est, existingSensors
    ));
  }

  // Ethanol / VOC (from MQ-3 or direct ethanol metric)
  if (raw.ethanol !== undefined && raw.ethanol !== null) {
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'ethanol', 'Volatile Ethanol (MQ-3)', 'ppm', 'GPIO 35', Number(raw.ethanol), existingSensors
    ));
  } else if (raw.mq3 !== undefined && raw.mq3 !== null && Number(raw.mq3) > 0) {
    const rawAdc = Number(raw.mq3);
    const vOut = (rawAdc / 4095.0) * 3.3;
    const rs = vOut > 0 && vOut < 3.3 ? ((3.3 - vOut) * 10.0) / vOut : 10.0;
    const ratio = Math.max(0.01, rs / 20.0);
    const ethEst = Math.min(50, Math.max(0.05, +(0.4 * Math.pow(ratio, -1.45)).toFixed(2)));
    sensors.push(getOrBuildSensor(
      deviceId, areaId, 'ethanol', 'Volatile Ethanol (MQ-3)', 'ppm', 'GPIO 35', ethEst, existingSensors
    ));
  }

  return sensors;
}

export function rawToESPDevice(id: string, raw: any): ESPDevice {
  const normId = (id || raw.deviceId || raw.id || 'ESP32-UNKNOWN').trim().toUpperCase();
  const assignments = stateMesh.getAssignments();
  const assignedAreaId = assignments[normId] || raw.area_id || raw.areaId || null;
  const existingDev = firebaseDevicesMap.get(normId);

  const nowMs = Date.now();
  const rawHb = raw.last_heartbeat ?? raw.lastHeartbeat ?? raw.timestamp;
  let lastHbStr = existingDev?.last_heartbeat || new Date().toISOString();
  let isOnline = raw.is_online !== undefined ? Number(raw.is_online) : 1;

  if (typeof rawHb === 'number') {
    if (rawHb > 1577836800000) {
      lastHbStr = new Date(rawHb).toISOString();
      isOnline = nowMs - rawHb < 60000 ? 1 : 0;
    } else {
      isOnline = 1;
    }
  } else if (typeof rawHb === 'string') {
    lastHbStr = rawHb;
  }

  const sensors = buildSensors(normId, assignedAreaId, raw, existingDev?.sensors);

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
    last_heartbeat: lastHbStr,
    signal_rssi: raw.signal_rssi ?? raw.rssi ?? -60,
    battery_voltage: raw.battery_voltage ?? raw.battery ?? 3.3,
    is_enabled: raw.is_enabled ?? 1,
    is_discovered: assignedAreaId ? 0 : 1,
    is_simulated: 0,
    installation_date: raw.installation_date || new Date().toISOString().split('T')[0],
    area_name: raw.area_name || null,
    sensors
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
        if (val.is_simulated === 1) return;

        const normId = (key || val.deviceId || val.id || '').trim().toUpperCase();
        if (!normId) return;

        const dev = rawToESPDevice(normId, val);
        firebaseDevicesMap.set(normId, dev);

        // Compute stable content signature to prevent unnecessary re-render loops
        const sig = `${normId}|${val.temperature}|${val.humidity}|${val.mq3}|${val.mq135}|${val.co2}|${val.ammonia}|${val.relayState}|${val.is_online}|${dev.area_id}|${val.userName || val.user_name}`;
        const prevSig = lastDeviceSignatures.get(normId);

        // 1. Emit discovery ONLY once per device
        if (!discoveredDevicesSet.has(normId)) {
          discoveredDevicesSet.add(normId);
          wsManager.emit('device_discovered', { device: dev });
        }

        // 2. Emit updates ONLY when sensor or status values actually change
        if (prevSig !== sig) {
          lastDeviceSignatures.set(normId, sig);
          wsManager.emit('device_updated', dev);
          if (dev.sensors && dev.sensors.length > 0) {
            wsManager.emit('telemetry_update', { deviceId: dev.id, readings: dev.sensors });
          }
        }
      });
    }, (error) => {
      console.warn('[Firebase RTDB] Listen error:', error);
    });

    // Synchronize storage rooms and zones across clients via Firebase
    const roomsRef = ref(firebaseDb, 'rooms');
    onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      let roomsAdded = false;
      Object.entries(data).forEach(([_, r]: [string, any]) => {
        if (!r || typeof r !== 'object') return;
        stateMesh.recordRoomCreated(r, r.deviceIds || []);
        roomsAdded = true;
      });
      if (roomsAdded) {
        wsManager.emit('rooms_synced', {});
      }
    }, (error) => {
      console.warn('[Firebase RTDB] Rooms listen error:', error);
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

export async function saveFirebaseRoom(room: any): Promise<void> {
  if (!room || !room.id) return;
  try {
    const roomRef = ref(firebaseDb, `rooms/${room.id}`);
    await set(roomRef, {
      id: room.id,
      name: room.name,
      commodity: room.commodity || 'General Produce',
      facility_id: room.facility_id || 'fac-01',
      created_at: room.created_at || new Date().toISOString(),
      deviceIds: room.deviceIds || []
    });
  } catch (e) {
    console.warn('[Firebase RTDB] Save room error:', e);
  }
}

registerDeviceLookup((id: string) => firebaseDevicesMap.get(id.toUpperCase()));

export async function updateFirebaseDevice(deviceId: string, updates: any): Promise<void> {
  if (!deviceId) return;
  const normId = deviceId.trim().toUpperCase();
  try {
    const devRef = ref(firebaseDb, `devices/${normId}`);
    const patch: any = {};
    if (updates.userName !== undefined) patch.user_name = updates.userName;
    if (updates.deviceCode !== undefined) patch.device_code = updates.deviceCode;
    if (updates.areaId !== undefined) patch.area_id = updates.areaId;
    if (updates.coldStoreName !== undefined) patch.cold_store_name = updates.coldStoreName;
    if (updates.zoneName !== undefined) patch.zone_name = updates.zoneName;
    if (updates.rackName !== undefined) patch.rack_name = updates.rackName;
    if (updates.levelName !== undefined) patch.level_name = updates.levelName;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.isDiscovered !== undefined) patch.is_discovered = updates.isDiscovered;

    const existing = firebaseDevicesMap.get(normId);
    if (existing) {
      firebaseDevicesMap.set(normId, { ...existing, ...patch });
    }

    await update(devRef, patch);
  } catch (e) {
    console.warn('[Firebase RTDB] Update device error:', e);
  }
}

export async function deleteFirebaseRoom(roomId: string): Promise<void> {
  if (!roomId) return;
  try {
    const roomRef = ref(firebaseDb, `rooms/${roomId}`);
    await remove(roomRef);
  } catch (e) {
    console.warn('[Firebase RTDB] Delete room error:', e);
  }
}
