import { Area, ESPDevice } from '../types';
import { buildFakeSensors, getFoodProfile } from './foodProfiles';

export interface FakeEspDefinition {
  id: string;
  name: string;
  hardwareType: 'ESP32' | 'ESP8266';
  foodType: string;
  areaId?: string;
  zoneName?: string;
  createdAt?: string;
}

export interface MeshRoom {
  id: string;
  name: string;
  commodity: string;
  facility_id?: string;
  created_at?: string;
}

export interface StateMeshPayload {
  rooms: MeshRoom[];
  assignments: Record<string, string>; // deviceId (uppercase) -> areaId
  deletedRooms: string[];
  deletedDevices: string[];
  fakeEsps?: FakeEspDefinition[];
}

const STORAGE_KEY_ROOMS = 'agrivault_mesh_rooms_v1';
const STORAGE_KEY_ASSIGNMENTS = 'agrivault_mesh_assignments_v1';
const STORAGE_KEY_DELETED_ROOMS = 'agrivault_mesh_deleted_rooms_v1';
const STORAGE_KEY_DELETED_DEVICES = 'agrivault_mesh_deleted_devices_v1';
const STORAGE_KEY_FAKE_ESPS = 'agrivault_mesh_fake_esps_v1';

function safeGetJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSetJson(key: string, val: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // quota exceeded or disabled
  }
}

let deviceLookup: ((id: string) => ESPDevice | undefined) | null = null;
export function registerDeviceLookup(fn: (id: string) => ESPDevice | undefined) {
  deviceLookup = fn;
}

export function getMeshDevice(id: string): ESPDevice | undefined {
  const cleanId = id.trim().toUpperCase();
  if (deviceLookup) {
    const d = deviceLookup(cleanId);
    if (d) return d;
  }
  const fake = stateMesh.getFakeEsps().find(e => e.id.toUpperCase() === cleanId);
  if (fake) {
    const assignments = stateMesh.getAssignments();
    const assignedAreaId = assignments[cleanId] || fake.areaId || null;
    return {
      id: cleanId,
      hardware_id: `24:0A:C4:SIM:${cleanId.slice(-4).padStart(4, '0')}`,
      device_code: cleanId,
      device_type: 'SENSOR_NODE',
      registration_status: 'active',
      facility_id: 'fac-01',
      cold_store_name: 'Cold Store A',
      zone_name: fake.zoneName || 'Diversified Storage Vault',
      area_id: assignedAreaId,
      user_name: fake.name,
      hardware_type: fake.hardwareType === 'ESP8266' ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1',
      firmware_version: 'v2.5.0-virtual',
      ip_address: '192.168.1.155',
      mac_address: `24:0A:C4:SIM:${cleanId.slice(-4).padStart(4, '0')}`,
      is_online: 1,
      last_heartbeat: new Date().toISOString(),
      signal_rssi: -55,
      battery_voltage: 3.3,
      is_enabled: 1,
      is_discovered: 0,
      is_simulated: 1,
      food_type: fake.foodType,
      installation_date: fake.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      sensors: buildFakeSensors(cleanId, assignedAreaId, fake.foodType)
    };
  }
  return undefined;
}

export const stateMesh = {
  getRooms(): MeshRoom[] {
    return safeGetJson<MeshRoom[]>(STORAGE_KEY_ROOMS, []);
  },

  getAssignments(): Record<string, string> {
    return safeGetJson<Record<string, string>>(STORAGE_KEY_ASSIGNMENTS, {});
  },

  getDeletedRooms(): string[] {
    return safeGetJson<string[]>(STORAGE_KEY_DELETED_ROOMS, []);
  },

  getDeletedDevices(): string[] {
    return safeGetJson<string[]>(STORAGE_KEY_DELETED_DEVICES, []);
  },

  getFakeEsps(): FakeEspDefinition[] {
    return safeGetJson<FakeEspDefinition[]>(STORAGE_KEY_FAKE_ESPS, [
      {
        id: 'AGR-ESP-SIM-APPLES',
        name: 'Apple Vault Node 1',
        hardwareType: 'ESP32',
        foodType: 'apple',
        areaId: 'area-apples-01',
        zoneName: 'Apples Cold Holding',
        createdAt: '2026-11-03T00:00:00.000Z'
      },
      {
        id: 'AGR-ESP-SIM-ONIONS',
        name: 'Onions Dry Silo Node',
        hardwareType: 'ESP8266',
        foodType: 'onion',
        areaId: 'area-onions-01',
        zoneName: 'Onions Cured Storage',
        createdAt: '2026-11-03T00:00:00.000Z'
      }
    ]);
  },

  saveFakeEsp(def: FakeEspDefinition): void {
    const list = this.getFakeEsps();
    const cleanId = def.id.trim().toUpperCase();
    const idx = list.findIndex(e => e.id.toUpperCase() === cleanId);
    const item: FakeEspDefinition = {
      ...def,
      id: cleanId,
      name: def.name.trim() || `Fake ESP Node (${cleanId.slice(-4)})`,
      hardwareType: def.hardwareType || 'ESP32',
      foodType: def.foodType || 'potato',
      createdAt: def.createdAt || new Date().toISOString()
    };
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    safeSetJson(STORAGE_KEY_FAKE_ESPS, list);

    if (def.areaId) {
      this.recordDeviceAssigned(cleanId, def.areaId);
    }
  },

  updateFakeEspFoodType(id: string, foodType: string): void {
    const list = this.getFakeEsps();
    const cleanId = id.trim().toUpperCase();
    const item = list.find(e => e.id.toUpperCase() === cleanId);
    if (item) {
      item.foodType = foodType;
      safeSetJson(STORAGE_KEY_FAKE_ESPS, list);
    }
  },

  deleteFakeEsp(id: string): void {
    const cleanId = id.trim().toUpperCase();
    const list = this.getFakeEsps().filter(e => e.id.toUpperCase() !== cleanId);
    safeSetJson(STORAGE_KEY_FAKE_ESPS, list);
    this.recordDeviceDeleted(cleanId);
  },

  recordRoomCreated(room: Area, deviceIds: string[] = []): void {
    const rooms = this.getRooms();
    const existingIndex = rooms.findIndex(r => r.id === room.id);
    const meshRoom: MeshRoom = {
      id: room.id,
      name: room.name,
      commodity: room.commodity || 'General Produce',
      facility_id: room.facility_id || 'fac-01',
      created_at: room.created_at || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      rooms[existingIndex] = meshRoom;
    } else {
      rooms.push(meshRoom);
    }
    safeSetJson(STORAGE_KEY_ROOMS, rooms);

    // Un-mark from deleted
    const deletedRooms = this.getDeletedRooms().filter(id => id !== room.id);
    safeSetJson(STORAGE_KEY_DELETED_ROOMS, deletedRooms);

    // Record device assignments
    if (deviceIds && deviceIds.length > 0) {
      const assignments = this.getAssignments();
      for (const devId of deviceIds) {
        assignments[devId.trim().toUpperCase()] = room.id;
      }
      safeSetJson(STORAGE_KEY_ASSIGNMENTS, assignments);
    }
  },

  recordRoomUpdated(areaId: string, updates: { name?: string; commodity?: string }): void {
    const rooms = this.getRooms();
    const room = rooms.find(r => r.id === areaId);
    if (room) {
      if (updates.name) room.name = updates.name.trim();
      if (updates.commodity) room.commodity = updates.commodity.trim();
      safeSetJson(STORAGE_KEY_ROOMS, rooms);
    }
  },

  recordRoomDeleted(areaId: string): void {
    const rooms = this.getRooms().filter(r => r.id !== areaId);
    safeSetJson(STORAGE_KEY_ROOMS, rooms);

    // Track in deleted list so serverless instances delete it
    const deletedRooms = this.getDeletedRooms();
    if (!deletedRooms.includes(areaId)) {
      deletedRooms.push(areaId);
      // Keep only last 20
      if (deletedRooms.length > 20) deletedRooms.shift();
      safeSetJson(STORAGE_KEY_DELETED_ROOMS, deletedRooms);
    }

    // Unlink device assignments pointing to this room
    const assignments = this.getAssignments();
    for (const [devId, roomTarget] of Object.entries(assignments)) {
      if (roomTarget === areaId) {
        delete assignments[devId];
      }
    }
    safeSetJson(STORAGE_KEY_ASSIGNMENTS, assignments);
  },

  recordDeviceAssigned(deviceId: string, areaId: string): void {
    const cleanId = deviceId.trim().toUpperCase();
    const assignments = this.getAssignments();
    assignments[cleanId] = areaId;
    safeSetJson(STORAGE_KEY_ASSIGNMENTS, assignments);

    // Remove from deleted devices if present
    const delDevs = this.getDeletedDevices().filter(id => id !== cleanId);
    safeSetJson(STORAGE_KEY_DELETED_DEVICES, delDevs);
  },

  recordDeviceUnassigned(deviceId: string): void {
    const cleanId = deviceId.trim().toUpperCase();
    const assignments = this.getAssignments();
    delete assignments[cleanId];
    safeSetJson(STORAGE_KEY_ASSIGNMENTS, assignments);
  },

  recordDeviceDeleted(deviceId: string): void {
    const cleanId = deviceId.trim().toUpperCase();
    this.recordDeviceUnassigned(cleanId);

    const delDevs = this.getDeletedDevices();
    if (!delDevs.includes(cleanId)) {
      delDevs.push(cleanId);
      if (delDevs.length > 20) delDevs.shift();
      safeSetJson(STORAGE_KEY_DELETED_DEVICES, delDevs);
    }
  },

  encodeSyncHeader(): string {
    try {
      const payload: StateMeshPayload = {
        rooms: this.getRooms(),
        assignments: this.getAssignments(),
        deletedRooms: this.getDeletedRooms(),
        deletedDevices: this.getDeletedDevices()
      };
      const json = JSON.stringify(payload);
      return btoa(unescape(encodeURIComponent(json)));
    } catch {
      return '';
    }
  },

  /**
   * Reconciles remote overview with authoritative client mesh.
   * Prevents cold-started serverless instances from blanking out user-created rooms or device mappings.
   */
  reconcileOverview(remoteOverview: any): any {
    if (!remoteOverview) return remoteOverview;

    const localRooms = this.getRooms();
    const assignments = this.getAssignments();
    const deletedRooms = new Set(this.getDeletedRooms());
    const deletedDevices = new Set(this.getDeletedDevices());

    const remoteAreas: Area[] = Array.isArray(remoteOverview.areas) ? remoteOverview.areas : [];
    const remoteAreaMap = new Map<string, Area>();

    for (const a of remoteAreas) {
      if (!deletedRooms.has(a.id)) {
        remoteAreaMap.set(a.id, a);
      }
    }

    // Merge: ensure all local rooms exist in the merged result
    const mergedAreas: Area[] = [];

    // 1. Process all local rooms first
    for (const lr of localRooms) {
      if (deletedRooms.has(lr.id)) continue;

      const remoteMatch = remoteAreaMap.get(lr.id);
      if (remoteMatch) {
        // Enforce assigned devices based on mesh assignments
        const validDevices = (remoteMatch.devices || []).filter(
          (d: any) => !deletedDevices.has(d.id.toUpperCase())
        );

        mergedAreas.push({
          ...remoteMatch,
          name: lr.name || remoteMatch.name,
          commodity: lr.commodity || remoteMatch.commodity,
          devices: validDevices,
          deviceCount: validDevices.length
        });
        remoteAreaMap.delete(lr.id);
      } else {
        // Room was missing on this remote container instance! Rehydrate it.
        mergedAreas.push({
          id: lr.id,
          facility_id: lr.facility_id || 'fac-01',
          name: lr.name,
          commodity: lr.commodity,
          health_status: 'normal',
          health_score: 100,
          health_reasons: [],
          created_at: lr.created_at || new Date().toISOString(),
          devices: [],
          deviceCount: 0
        });
      }
    }

    // 2. Add any remaining remote areas that are not marked deleted
    for (const [id, extraArea] of remoteAreaMap.entries()) {
      if (!deletedRooms.has(id)) {
        // Also register in local rooms
        this.recordRoomCreated(extraArea);
        mergedAreas.push(extraArea);
      }
    }

    // 3. Attach any assigned devices that are associated with these rooms
    for (const [devId, areaId] of Object.entries(assignments)) {
      if (deletedDevices.has(devId)) continue;
      const targetArea = mergedAreas.find(a => a.id === areaId);
      if (targetArea) {
        if (!targetArea.devices) targetArea.devices = [];
        const liveDev = getMeshDevice(devId);
        const devIdx = targetArea.devices.findIndex((d: any) => d.id.toUpperCase() === devId);
        if (devIdx === -1) {
          targetArea.devices.push(liveDev || ({
            id: devId,
            user_name: `ESP Node: ${devId}`,
            hardware_type: devId.includes('8266') ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1',
            is_online: 1,
            ip_address: '192.168.1.x'
          } as any));
        } else if (liveDev) {
          targetArea.devices[devIdx] = { ...targetArea.devices[devIdx], ...liveDev };
        }
        targetArea.deviceCount = targetArea.devices.length;
      }
    }

    // 4. Propagate real-time metrics into AreaCards for all merged rooms
    for (const targetArea of mergedAreas) {
      targetArea.metrics = {
        temperature: null,
        humidity: null,
        co2: null,
        ethylene: null,
        ammonia: null,
        ethanol: null
      };
      const metricsAny = targetArea.metrics as any;

      if (Array.isArray(targetArea.devices)) {
        for (const d of targetArea.devices) {
          const liveDev = deviceLookup ? deviceLookup(d.id) : undefined;
          const devObj = liveDev || d;
          if (devObj?.sensors && Array.isArray(devObj.sensors)) {
            for (const s of devObj.sensors) {
              const param = (s as any).parameter || s.sensor_type;
              if (param) {
                const val = s.calibrated_reading ?? s.raw_reading;
                if (val !== undefined && val !== null && !isNaN(val)) {
                  // Only treat humidity as valid if it is positive (> 0)
                  if (param === 'humidity' && val <= 0) continue;

                  const metricObj = {
                    value: val,
                    raw: s.raw_reading,
                    unit: s.unit,
                    confidence: 95,
                    health: s.sensor_health || 'healthy'
                  };
                  metricsAny[param] = metricObj;

                  // Ensure AreaCard CO2 and Ammonia cards receive MQ-135 readings if distinct sensors are absent
                  if (param === 'mq135') {
                    if (!metricsAny.co2) metricsAny.co2 = metricObj;
                    if (!metricsAny.ammonia) metricsAny.ammonia = metricObj;
                  }
                  // Ensure AreaCard Ethanol card receives MQ-3 readings if distinct sensor is absent
                  if (param === 'mq3') {
                    if (!metricsAny.ethanol) metricsAny.ethanol = metricObj;
                  }
                }
              }
            }
          }
        }
      }

      // Reflect food rotting condition in health assessment and alerts
      if (metricsAny.temperature?.value !== null && metricsAny.temperature?.value !== undefined) {
        targetArea.health_status = 'critical';
        targetArea.health_score = 18;
        targetArea.activeAlertsCount = 3;
        targetArea.health_reasons = [
          `Severe Thermal Runaway: Temperature at ${metricsAny.temperature.value}°C causing rapid microbial soft rot`,
          `Compound Decomposition: Surging Ammonia (${metricsAny.ammonia?.value || 6.8} ppm) and Ethanol (${metricsAny.ethanol?.value || 3.8} ppm) confirm deep tissue rot`,
          `Excess Humidity: ${metricsAny.humidity?.value || 94.5}% relative humidity triggering virulent spore growth`
        ];
      }
    }

    // 5. Aggregate facility overview metrics from online devices
    const onlineDevs: ESPDevice[] = [];
    const seenOnlineIds = new Set<string>();

    if (Array.isArray(remoteOverview.devices)) {
      for (const d of remoteOverview.devices) {
        const cleanId = (d.id || '').toUpperCase();
        if (cleanId === 'AGR-ESP-000000' || cleanId.endsWith('000000')) continue;
        if (!deletedDevices.has(cleanId)) {
          seenOnlineIds.add(cleanId);
          onlineDevs.push({ ...d, is_online: 1 });
        }
      }
    }

    for (const devId of Object.keys(assignments)) {
      const cleanId = devId.toUpperCase();
      if (cleanId === 'AGR-ESP-000000' || cleanId.endsWith('000000')) continue;
      if (deletedDevices.has(cleanId) || seenOnlineIds.has(cleanId)) continue;
      const liveDev = getMeshDevice(cleanId);
      if (liveDev) {
        seenOnlineIds.add(cleanId);
        onlineDevs.push({ ...liveDev, is_online: 1 });
      }
    }

    // Include fake diversified ESPs in online aggregate
    for (const fake of this.getFakeEsps()) {
      const cleanId = fake.id.toUpperCase();
      if (deletedDevices.has(cleanId) || seenOnlineIds.has(cleanId)) continue;
      seenOnlineIds.add(cleanId);
      const fakeDev = getMeshDevice(cleanId);
      if (fakeDev) {
        onlineDevs.push(fakeDev);
      }
    }

    const connectedESPs = Math.max(remoteOverview.connectedESPs || 1, onlineDevs.length);
    let avgTemp = remoteOverview.avgTemp;
    let avgHum = remoteOverview.avgHum;
    let co2Status = remoteOverview.co2Status;
    let gasStatus = remoteOverview.gasStatus;

    if (onlineDevs.length > 0) {
      const temps: number[] = [];
      const hums: number[] = [];
      const co2s: number[] = [];
      const gases: { nh3: number; eth: number }[] = [];

      for (const d of onlineDevs) {
        if (Array.isArray(d.sensors)) {
          for (const s of d.sensors) {
            const val = s.calibrated_reading ?? s.raw_reading;
            if (val === undefined || val === null || isNaN(val)) continue;
            if (s.sensor_type === 'temperature') temps.push(val);
            if (s.sensor_type === 'humidity' && val > 0) hums.push(val);
            if (s.sensor_type === 'co2') co2s.push(val);
            if (s.sensor_type === 'ammonia') gases.push({ nh3: val, eth: 0 });
            if (s.sensor_type === 'ethanol') gases.push({ nh3: 0, eth: val });
          }
        }
      }

      if (temps.length > 0) {
        avgTemp = +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
      } else {
        avgTemp = 19.0;
      }
      if (hums.length > 0) {
        avgHum = Math.round(hums.reduce((a, b) => a + b, 0) / hums.length);
      } else {
        avgHum = 95;
      }
      if (co2s.length > 0) {
        const currentCo2 = Math.round(co2s.reduce((a, b) => a + b, 0) / co2s.length);
        co2Status = `${currentCo2} ppm (Elevated)`;
      } else {
        co2Status = '55 ppm (Elevated)';
      }
      gasStatus = 'Critical (Rotting)';
    }

    return {
      ...remoteOverview,
      areas: mergedAreas,
      activeAreasCount: Math.max(1, mergedAreas.length),
      connectedESPs: Math.max(1, connectedESPs),
      avgTemp: avgTemp !== undefined && avgTemp !== null ? avgTemp : 19.0,
      avgHum: avgHum !== undefined && avgHum !== null ? avgHum : 95,
      co2Status: co2Status || '55 ppm (Elevated)',
      gasStatus: gasStatus || 'Critical (Rotting)',
      activeAlertsCount: 3,
      criticalAlertsCount: 2,
      overallStatus: 'Critical'
    };
  },

  /**
   * Reconciles device list: enforces that assigned devices are marked with area_id,
   * unassigned devices are marked without area_id, and deleted devices are excluded.
   * Guarantees no device is duplicated.
   */
  reconcileDevices(remoteDevices: ESPDevice[]): ESPDevice[] {
    if (!Array.isArray(remoteDevices)) return [];

    const assignments = this.getAssignments();
    const deletedDevices = new Set(this.getDeletedDevices());
    const rooms = this.getRooms();
    const roomNameMap = new Map(rooms.map(r => [r.id, r.name]));

    const result: ESPDevice[] = [];
    const seenIds = new Set<string>();

    for (const dev of remoteDevices) {
      if (!dev || !dev.id) continue;
      const cleanId = dev.id.trim().toUpperCase();
      if (cleanId === 'AGR-ESP-000000' || cleanId.endsWith('000000')) continue;
      if (deletedDevices.has(cleanId) || seenIds.has(cleanId)) continue;

      seenIds.add(cleanId);
      const assignedAreaId = assignments[cleanId];
      const isOnline = dev.is_online === 1;

      if (assignedAreaId) {
        result.push({
          ...dev,
          area_id: assignedAreaId,
          area_name: roomNameMap.get(assignedAreaId) || dev.area_name || 'Assigned Room',
          is_discovered: 0
        });
      } else {
        result.push({
          ...dev,
          area_id: null,
          area_name: undefined,
          is_discovered: isOnline ? 1 : 0
        });
      }
    }

    // Merge fake diversified ESPs with food types and cycling telemetry
    const fakeEsps = this.getFakeEsps();
    let fakeIdx = 0;
    for (const fake of fakeEsps) {
      const cleanId = fake.id.trim().toUpperCase();
      if (deletedDevices.has(cleanId) || seenIds.has(cleanId)) continue;
      seenIds.add(cleanId);
      fakeIdx++;

      const assignedAreaId = assignments[cleanId] || fake.areaId || null;
      const sensors = buildFakeSensors(cleanId, assignedAreaId, fake.foodType, fakeIdx * 0.7);

      result.push({
        id: cleanId,
        hardware_id: `24:0A:C4:SIM:${cleanId.slice(-4).padStart(4, '0')}`,
        device_code: cleanId,
        device_type: 'SENSOR_NODE',
        registration_status: 'active',
        facility_id: 'fac-01',
        cold_store_name: 'Cold Store A',
        zone_name: fake.zoneName || 'Diversified Storage Vault',
        area_id: assignedAreaId,
        area_name: assignedAreaId ? (roomNameMap.get(assignedAreaId) || fake.zoneName || 'Assigned Room') : undefined,
        user_name: fake.name,
        hardware_type: fake.hardwareType === 'ESP8266' ? 'ESP8266-NodeMCU' : 'ESP32-DevKit-V1',
        firmware_version: 'v2.5.0-virtual',
        ip_address: `192.168.1.${150 + fakeIdx}`,
        mac_address: `24:0A:C4:SIM:${cleanId.slice(-4).padStart(4, '0')}`,
        is_online: 1,
        last_heartbeat: new Date().toISOString(),
        signal_rssi: -55 + (fakeIdx % 5),
        battery_voltage: 3.3,
        is_enabled: 1,
        is_discovered: assignedAreaId ? 0 : 1,
        is_simulated: 1,
        food_type: fake.foodType,
        installation_date: fake.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        sensors
      });
    }

    return result;
  },

  /**
   * Reconciles available discovered devices:
   * Strips out any devices that are offline, assigned to a room, or deleted!
   */
  reconcileDiscovered(remoteDiscovered: ESPDevice[]): ESPDevice[] {
    if (!Array.isArray(remoteDiscovered)) return [];

    const assignments = this.getAssignments();
    const deletedDevices = new Set(this.getDeletedDevices());
    const seenIds = new Set<string>();

    return remoteDiscovered.filter(dev => {
      if (!dev || !dev.id) return false;
      const cleanId = dev.id.trim().toUpperCase();
      if (cleanId === 'AGR-ESP-000000' || cleanId.endsWith('000000')) return false;
      if (deletedDevices.has(cleanId) || seenIds.has(cleanId)) return false;
      seenIds.add(cleanId);

      // Must be currently online and unassigned to be in available list!
      if (dev.is_online !== 1) return false;
      if (assignments[cleanId] || dev.area_id) return false;
      return true;
    });
  }
};
