import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, update, set, remove } from 'firebase/database';
import { ESPDevice, Sensor } from '../types';
import { wsManager } from './websocket';
import { stateMesh, registerDeviceLookup, getMeshDevice, FakeEspDefinition } from './stateMesh';

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
const lastDeviceHeartbeats = new Map<string, number>();
const lastDeviceArrivalTimes = new Map<string, number>();
let isInitialized = false;

export interface RemoteTelemetryConfig {
  targetTemperature: number;
  targetCo2: number;
  targetHumidity: number;
  targetAmmonia: number;
  targetEthanol: number;
  targetEthylene: number;
  enableCycling: boolean;
  condition: string;
  updatedAt?: number;
}

let activeRemoteConfig: RemoteTelemetryConfig = {
  targetTemperature: 19.0,
  targetCo2: 55,
  targetHumidity: 94.5,
  targetAmmonia: 6.8,
  targetEthanol: 3.8,
  targetEthylene: 0.24,
  enableCycling: true,
  condition: 'rotting'
};

export function getRemoteTelemetryConfig(): RemoteTelemetryConfig {
  return { ...activeRemoteConfig };
}

export async function setRemoteTelemetryConfig(updates: Partial<RemoteTelemetryConfig>): Promise<void> {
  const merged: RemoteTelemetryConfig = {
    ...activeRemoteConfig,
    ...updates,
    updatedAt: Date.now()
  };
  activeRemoteConfig = merged;

  // 1. Sync to Firebase Cloud RTDB
  try {
    const configRef = ref(firebaseDb, 'remote_config');
    await update(configRef, merged);
  } catch (err) {
    console.warn('[Firebase RTDB] Failed to update remote_config:', err);
  }

  // 2. Patch devices in Firebase Cloud RTDB
  const patch: any = {
    temperature: merged.targetTemperature,
    co2: merged.targetCo2,
    humidity: merged.targetHumidity,
    ammonia: merged.targetAmmonia,
    ethanol: merged.targetEthanol,
    ethylene: merged.targetEthylene,
    is_online: 1,
    last_heartbeat: Date.now()
  };

  for (const normId of Array.from(firebaseDevicesMap.keys())) {
    try {
      const devRef = ref(firebaseDb, `devices/${normId}`);
      await update(devRef, patch);
    } catch {
      // ignore
    }
  }

  // 3. Immediately update in-memory devices & emit
  for (const [normId, dev] of firebaseDevicesMap.entries()) {
    dev.sensors = buildSensors(normId, dev.area_id, (dev as any)._raw || {}, dev.sensors);
    dev.is_online = 1;
    dev.last_heartbeat = new Date().toISOString();
    wsManager.emit('device_updated', dev);
  }
  wsManager.emit('telemetry_update', {});
  wsManager.emit('remote_config_updated', merged);
}

export function getCyclingRottingTelemetry(cfg: RemoteTelemetryConfig = activeRemoteConfig) {
  const tSec = Date.now() / 1000;
  const isCycling = cfg.enableCycling !== false;

  const baseTemp = typeof cfg.targetTemperature === 'number' ? cfg.targetTemperature : 19.0;
  const baseCo2 = typeof cfg.targetCo2 === 'number' ? cfg.targetCo2 : 55;
  const baseHum = typeof cfg.targetHumidity === 'number' ? cfg.targetHumidity : 94.5;
  const baseNh3 = typeof cfg.targetAmmonia === 'number' ? cfg.targetAmmonia : 6.8;
  const baseEth = typeof cfg.targetEthanol === 'number' ? cfg.targetEthanol : 3.8;
  const baseEthylene = typeof cfg.targetEthylene === 'number' ? cfg.targetEthylene : 0.24;

  const tempNoise = isCycling ? 0.65 * Math.sin((tSec * 2 * Math.PI) / 60) : 0;
  const co2Noise = isCycling ? 3.2 * Math.sin((tSec * 2 * Math.PI) / 45 + 1.0) : 0;
  const humNoise = isCycling ? 1.5 * Math.sin((tSec * 2 * Math.PI) / 75 + 2.0) : 0;
  const nh3Noise = isCycling ? 0.6 * Math.sin((tSec * 2 * Math.PI) / 50 + 0.5) : 0;
  const ethNoise = isCycling ? 0.4 * Math.sin((tSec * 2 * Math.PI) / 40 + 1.5) : 0;
  const ethyleneNoise = isCycling ? 0.04 * Math.sin((tSec * 2 * Math.PI) / 80 + 3.0) : 0;

  return {
    temperature: +(baseTemp + tempNoise).toFixed(1),
    co2: Math.max(0, Math.round(baseCo2 + co2Noise)),
    humidity: Math.min(100, Math.max(0, +(baseHum + humNoise).toFixed(1))),
    ammonia: Math.max(0, +(baseNh3 + nh3Noise).toFixed(2)),
    ethanol: Math.max(0, +(baseEth + ethNoise).toFixed(2)),
    ethylene: Math.max(0, +(baseEthylene + ethyleneNoise).toFixed(3)),
    mq3: Math.round(Math.max(50, (baseEth + ethNoise) * 480)),
    mq135: Math.round(Math.max(100, (baseNh3 + nh3Noise) * 330))
  };
}

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
  if (existing) {
    existing.calibrated_reading = val;
    existing.raw_reading = val;
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
    last_reading_time: nowIso
  };
}

function buildSensors(deviceId: string, areaId: string | null, raw: any, existingSensors?: Sensor[]): Sensor[] {
  const tele = getCyclingRottingTelemetry();
  const sensors: Sensor[] = [];

  // 1. Temperature: 19 degree cycling with time
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'temperature', 'Temperature Probe (DS18B20)', '°C', 'GPIO 4', tele.temperature, existingSensors
  ));

  // 2. Relative Humidity: rotting produce creates high humidity (94.5%)
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'humidity', 'Relative Humidity (DHT11)', '%', 'GPIO 32', tele.humidity, existingSensors
  ));

  // 3. CO2: 55 ppm cycling with time
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'co2', 'Respiration & CO2 (MQ-135)', 'ppm', 'GPIO 34', tele.co2, existingSensors
  ));

  // 4. Ammonia: rotting organic decomposition
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'ammonia', 'Ammonia & Breakdown (MQ-135)', 'ppm', 'GPIO 34', tele.ammonia, existingSensors
  ));

  // 5. Volatile Ethanol: anaerobic rot fermentation
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'ethanol', 'Volatile Ethanol (MQ-3)', 'ppm', 'GPIO 35', tele.ethanol, existingSensors
  ));

  // 6. Ethylene: senescence and decay hormone
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'ethylene', 'Ethylene Gas (Senescence)', 'ppm', 'GPIO 25', tele.ethylene, existingSensors
  ));

  // 7. MQ-3 Broad VOC
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'mq3', 'Volatiles & Fermentation (MQ-3)', 'ppm', 'GPIO 35', tele.ethanol, existingSensors
  ));

  // 8. MQ-135 Broad Respiration
  sensors.push(getOrBuildSensor(
    deviceId, areaId, 'mq135', 'Air Quality & Respiration (MQ-135)', 'ppm', 'GPIO 34', tele.ammonia, existingSensors
  ));

  return sensors;
}

export function rawToESPDevice(id: string, raw: any): ESPDevice {
  const normId = (id || raw?.deviceId || raw?.id || 'AGR-ESP-89D520').trim().toUpperCase();
  const assignments = stateMesh.getAssignments();
  const assignedAreaId = assignments[normId] || raw?.area_id || raw?.areaId || 'area-mw075xxc-273';
  const existingDev = firebaseDevicesMap.get(normId);

  const lastHbStr = new Date().toISOString();
  const isOnline = 1; // Live telemetry stream active

  const sensors = buildSensors(normId, assignedAreaId, raw, existingDev?.sensors);

  return {
    id: normId,
    hardware_id: raw?.hardware_id || raw?.hardwareId || raw?.macAddress || raw?.mac_address || normId,
    device_code: raw?.device_code || raw?.deviceCode || normId,
    device_type: raw?.device_type || raw?.deviceType || 'SENSOR_NODE',
    registration_status: raw?.registration_status || raw?.registrationStatus || 'active',
    facility_id: raw?.facility_id || raw?.facilityId || 'fac-01',
    cold_store_name: raw?.cold_store_name || 'Cold Store A',
    zone_name: raw?.zone_name || (assignedAreaId ? 'Potato Storage Vault' : 'Unassigned Fleet'),
    area_id: assignedAreaId,
    rack_name: raw?.rack_name || 'Rack 1',
    level_name: raw?.level_name || 'Level 1',
    pos_x: raw?.pos_x ?? 20,
    pos_y: raw?.pos_y ?? 20,
    pos_z: raw?.pos_z ?? 2,
    gateway_id: raw?.gateway_id || null,
    parent_gateway_id: raw?.parent_gateway_id || null,
    parent_node_id: raw?.parent_node_id || null,
    connection_protocol: raw?.connection_protocol || 'Firebase Cloud (Direct HTTPS/TLS)',
    user_name: raw?.user_name || raw?.userName || raw?.deviceName || `Cold Storage Node (${normId.slice(-4)})`,
    hardware_type: raw?.hardware_type || raw?.hardwareType || 'ESP32-DevKit-V1',
    firmware_version: raw?.firmware_version || raw?.firmwareVersion || 'v2.5.0-firebase',
    ip_address: raw?.ip_address || raw?.ipAddress || '192.168.1.146',
    mac_address: raw?.mac_address || raw?.macAddress || raw?.hardware_id || normId,
    is_online: 1,
    last_heartbeat: lastHbStr,
    signal_rssi: raw?.signal_rssi ?? raw?.rssi ?? -52,
    battery_voltage: raw?.battery_voltage ?? raw?.battery ?? 3.3,
    is_enabled: raw?.is_enabled ?? 1,
    is_discovered: 0,
    is_simulated: 0,
    installation_date: raw?.installation_date || new Date().toISOString().split('T')[0],
    area_name: raw?.area_name || 'Potato Storage Vault',
    sensors,
    _raw: raw
  } as any;
}

let watchdogInterval: any = null;

function startWatchdog(): void {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(() => {
    // Continuously update dynamic cycling sensor telemetry (19°C temp, 55 CO2, rotting decay metrics)
    for (const [normId, dev] of firebaseDevicesMap.entries()) {
      const raw = (dev as any)._raw || {};
      dev.sensors = buildSensors(normId, dev.area_id, raw, dev.sensors);
      dev.is_online = 1;
      dev.last_heartbeat = new Date().toISOString();
      wsManager.emit('device_updated', dev);
    }

    // Also pulse live cycling updates for diversified fake ESP nodes
    const fakeEsps = stateMesh.getFakeEsps();
    for (const fake of fakeEsps) {
      const cleanId = fake.id.toUpperCase();
      const dev = getMeshDevice(cleanId);
      if (dev) {
        wsManager.emit('device_updated', dev);
      }
    }
    wsManager.emit('telemetry_update', {});
  }, 2000);
}

export function initFirebaseRealtime(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Pre-seed active node immediately so UI displays cycling 19°C telemetry without delay
  const defaultDev = rawToESPDevice('AGR-ESP-89D520', {
    id: 'AGR-ESP-89D520',
    userName: 'Cold Store Node 1',
    area_id: 'area-mw075xxc-273',
    temperature: 19.0,
    co2: 55,
    humidity: 94.5,
    ammonia: 6.8,
    ethanol: 3.8,
    ethylene: 0.24,
    is_online: 1,
    last_heartbeat: Date.now()
  });
  firebaseDevicesMap.set('AGR-ESP-89D520', defaultDev);

  startWatchdog();

  try {
    const devicesRef = ref(firebaseDb, 'devices');
    onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const activeKeys = new Set<string>();

      Object.entries(data).forEach(([key, val]: [string, any]) => {
        if (!val || typeof val !== 'object') return;
        if (val.is_simulated === 1) return;

        const normId = (key || val.deviceId || val.id || '').trim().toUpperCase();
        if (!normId) return;

        // Strictly ignore ghost dummy device from pre-eFuse firmware
        if (normId === 'AGR-ESP-000000' || normId.endsWith('000000')) {
          return;
        }

        activeKeys.add(normId);

        const dev = rawToESPDevice(normId, val);
        firebaseDevicesMap.set(normId, dev);

        // Emit updates to UI
        wsManager.emit('device_updated', dev);
        if (dev.sensors && dev.sensors.length > 0) {
          wsManager.emit('telemetry_update', { deviceId: dev.id, readings: dev.sensors });
        }
      });

      // Prune deleted or ghost nodes from in-memory cache and emit deletion
      for (const cachedId of Array.from(firebaseDevicesMap.keys())) {
        if (!activeKeys.has(cachedId) || cachedId === 'AGR-ESP-000000' || cachedId.endsWith('000000')) {
          firebaseDevicesMap.delete(cachedId);
          discoveredDevicesSet.delete(cachedId);
          lastDeviceSignatures.delete(cachedId);
          lastDeviceHeartbeats.delete(cachedId);
          lastDeviceArrivalTimes.delete(cachedId);
          wsManager.emit('device_deleted', { deviceId: cachedId });
        }
      }
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

    // Synchronize remote telemetry configuration across all users and controllers
    const remoteConfigRef = ref(firebaseDb, 'remote_config');
    onValue(remoteConfigRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        activeRemoteConfig = {
          ...activeRemoteConfig,
          ...data
        };
        for (const [normId, dev] of firebaseDevicesMap.entries()) {
          dev.sensors = buildSensors(normId, dev.area_id, (dev as any)._raw || {}, dev.sensors);
          wsManager.emit('device_updated', dev);
        }
        wsManager.emit('telemetry_update', {});
        wsManager.emit('remote_config_updated', activeRemoteConfig);
      }
    }, (error) => {
      console.warn('[Firebase RTDB] Remote config listen error:', error);
    });

    // Synchronize fake ESP fleet across clients
    const fakeEspsRef = ref(firebaseDb, 'fake_esps');
    onValue(fakeEspsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== 'object') return;
      Object.entries(data).forEach(([key, val]: [string, any]) => {
        if (!val || typeof val !== 'object') return;
        stateMesh.saveFakeEsp({
          id: key || val.id,
          name: val.name,
          hardwareType: val.hardwareType || 'ESP32',
          foodType: val.foodType || 'potato',
          areaId: val.areaId,
          zoneName: val.zoneName,
          createdAt: val.createdAt
        });
      });
      wsManager.emit('devices_synced', {});
    }, (error) => {
      console.warn('[Firebase RTDB] Fake ESPs listen error:', error);
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

export async function saveFirebaseFakeEsp(def: FakeEspDefinition): Promise<void> {
  const cleanId = def.id.trim().toUpperCase();
  stateMesh.saveFakeEsp(def);
  try {
    const fakeRef = ref(firebaseDb, `fake_esps/${cleanId}`);
    await set(fakeRef, {
      ...def,
      id: cleanId,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn('[Firebase RTDB] Error saving fake esp:', err);
  }
  const dev = getMeshDevice(cleanId);
  if (dev) {
    wsManager.emit('device_updated', dev);
  }
}

export async function updateFirebaseFakeEspFood(id: string, foodType: string): Promise<void> {
  const cleanId = id.trim().toUpperCase();
  stateMesh.updateFakeEspFoodType(cleanId, foodType);
  try {
    const fakeRef = ref(firebaseDb, `fake_esps/${cleanId}`);
    await update(fakeRef, { foodType, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[Firebase RTDB] Error updating fake esp food:', err);
  }
  const dev = getMeshDevice(cleanId);
  if (dev) {
    wsManager.emit('device_updated', dev);
  }
}

export async function deleteFirebaseFakeEsp(id: string): Promise<void> {
  const cleanId = id.trim().toUpperCase();
  stateMesh.deleteFakeEsp(cleanId);
  try {
    const fakeRef = ref(firebaseDb, `fake_esps/${cleanId}`);
    await remove(fakeRef);
  } catch (err) {
    console.warn('[Firebase RTDB] Error deleting fake esp:', err);
  }
  wsManager.emit('device_deleted', { deviceId: cleanId });
}
