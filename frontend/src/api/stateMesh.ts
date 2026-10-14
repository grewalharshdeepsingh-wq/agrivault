import { Area, ESPDevice } from '../types';

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
}

const STORAGE_KEY_ROOMS = 'agrivault_mesh_rooms_v1';
const STORAGE_KEY_ASSIGNMENTS = 'agrivault_mesh_assignments_v1';
const STORAGE_KEY_DELETED_ROOMS = 'agrivault_mesh_deleted_rooms_v1';
const STORAGE_KEY_DELETED_DEVICES = 'agrivault_mesh_deleted_devices_v1';

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
        const liveDev = deviceLookup ? deviceLookup(devId) : undefined;
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
    }

    // 5. Aggregate facility overview metrics from online devices
    const onlineDevs: ESPDevice[] = [];
    const seenOnlineIds = new Set<string>();

    if (Array.isArray(remoteOverview.devices)) {
      for (const d of remoteOverview.devices) {
        const cleanId = (d.id || '').toUpperCase();
        if (cleanId === 'AGR-ESP-000000' || cleanId.endsWith('000000')) continue;
        if (d.is_online === 1 && !deletedDevices.has(cleanId)) {
          seenOnlineIds.add(cleanId);
          onlineDevs.push(d);
        }
      }
    }

    if (deviceLookup) {
      for (const devId of Object.keys(assignments)) {
        const cleanId = devId.toUpperCase();
        if (cleanId === 'AGR-ESP-000000' || cleanId.endsWith('000000')) continue;
        if (deletedDevices.has(cleanId) || seenOnlineIds.has(cleanId)) continue;
        const liveDev = deviceLookup(cleanId);
        if (liveDev && liveDev.is_online === 1) {
          seenOnlineIds.add(cleanId);
          onlineDevs.push(liveDev);
        }
      }
    }

    const connectedESPs = Math.max(remoteOverview.connectedESPs || 0, onlineDevs.length);
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
        avgTemp = null;
      }
      if (hums.length > 0) {
        avgHum = Math.round(hums.reduce((a, b) => a + b, 0) / hums.length);
      } else {
        avgHum = null;
      }
      if (co2s.length > 0) {
        const maxCo2 = Math.max(...co2s);
        co2Status = maxCo2 > 1400 ? 'Critical' : maxCo2 > 1200 ? 'Elevated' : 'Normal';
      }
      if (gases.length > 0) {
        const anyElevated = gases.some(g => g.nh3 > 4.0 || g.eth > 1.8);
        gasStatus = anyElevated ? 'Elevated' : 'Normal';
      }
    }

    return {
      ...remoteOverview,
      areas: mergedAreas,
      activeAreasCount: mergedAreas.length,
      connectedESPs,
      avgTemp: avgTemp !== undefined && avgTemp !== null ? avgTemp : remoteOverview.avgTemp,
      avgHum: avgHum !== undefined && avgHum !== null ? avgHum : remoteOverview.avgHum,
      co2Status: co2Status || remoteOverview.co2Status || 'Normal',
      gasStatus: gasStatus || remoteOverview.gasStatus || 'Normal'
    };
  },

  /**
   * Reconciles device list: enforces that assigned devices are marked with area_id,
   * unassigned devices are marked without area_id, and deleted devices are excluded.
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
      const cleanId = dev.id.trim().toUpperCase();
      if (deletedDevices.has(cleanId)) continue;

      seenIds.add(cleanId);
      const assignedAreaId = assignments[cleanId];

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
          is_discovered: 1
        });
      }
    }

    return result;
  },

  /**
   * Reconciles available discovered devices:
   * Strips out any devices that have been assigned to a room or deleted!
   */
  reconcileDiscovered(remoteDiscovered: ESPDevice[]): ESPDevice[] {
    if (!Array.isArray(remoteDiscovered)) return [];

    const assignments = this.getAssignments();
    const deletedDevices = new Set(this.getDeletedDevices());

    return remoteDiscovered.filter(dev => {
      const cleanId = dev.id.trim().toUpperCase();
      if (deletedDevices.has(cleanId)) return false;
      if (assignments[cleanId] || dev.area_id) return false; // Assigned to a room! Cannot be in available list!
      return true;
    });
  }
};
