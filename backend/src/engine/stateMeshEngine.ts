import { db } from '../database/db.js';
import { broadcast } from '../websocket/wsServer.js';

export interface MeshRoom {
  id: string;
  name: string;
  commodity: string;
  facility_id?: string;
  created_at?: string;
}

export interface StateMeshPayload {
  rooms?: MeshRoom[];
  assignments?: Record<string, string>; // deviceId (uppercase) -> areaId
  deletedRooms?: string[];
  deletedDevices?: string[];
}

export const globalMeshAssignments = new Map<string, string>();
export const globalMeshRooms = new Map<string, MeshRoom>();

/**
 * Rehydrates serverless container's SQLite database with authoritative
 * client state mesh ledger to completely prevent container desync and flickering.
 */
export function applyStateMesh(payload: StateMeshPayload): void {
  if (!payload || typeof payload !== 'object') return;

  const now = new Date().toISOString();

  // 1. Synchronize Rooms
  if (Array.isArray(payload.rooms) && payload.rooms.length > 0) {
    for (const r of payload.rooms) {
      if (!r || !r.id || !r.name) continue;
      const cleanName = String(r.name).trim();
      const cleanCommodity = r.commodity ? String(r.commodity).trim() : 'General Produce';
      const cleanFacId = r.facility_id || 'fac-01';
      const cleanCreated = r.created_at || now;

      globalMeshRooms.set(r.id, {
        id: r.id,
        name: cleanName,
        commodity: cleanCommodity,
        facility_id: cleanFacId,
        created_at: cleanCreated
      });

      try {
        const existing = db.get<{ id: string; name: string; commodity: string }>('SELECT id, name, commodity FROM areas WHERE id = ?', r.id);
        if (!existing) {
          db.run(
            `INSERT INTO areas (id, facility_id, name, commodity, health_status, health_score, health_reasons, created_at)
             VALUES (?, ?, ?, ?, 'normal', 100.0, '[]', ?)`,
            r.id, cleanFacId, cleanName, cleanCommodity, cleanCreated
          );
        } else if (existing.name !== cleanName || existing.commodity !== cleanCommodity) {
          db.run('UPDATE areas SET name = ?, commodity = ? WHERE id = ?', cleanName, cleanCommodity, r.id);
        }
      } catch (err: any) {
        console.warn('[StateMesh] Error reconciling area:', err?.message || err);
      }
    }
  }

  // 2. Handle Deleted Rooms
  if (Array.isArray(payload.deletedRooms) && payload.deletedRooms.length > 0) {
    for (const delId of payload.deletedRooms) {
      if (!delId) continue;
      globalMeshRooms.delete(delId);
      // Remove any assignments referencing this deleted room
      for (const [dId, targetRoom] of globalMeshAssignments.entries()) {
        if (targetRoom === delId) globalMeshAssignments.delete(dId);
      }
      try {
        db.transaction(() => {
          db.run('UPDATE esp_devices SET area_id = NULL, is_discovered = 1 WHERE area_id = ?', delId);
          db.run('UPDATE sensors SET area_id = NULL WHERE area_id = ?', delId);
          db.run('UPDATE relay_devices SET area_id = NULL WHERE area_id = ?', delId);
          db.run('DELETE FROM sensor_readings WHERE area_id = ?', delId);
          db.run('DELETE FROM alerts WHERE area_id = ?', delId);
          db.run('DELETE FROM automation_rules WHERE area_id = ?', delId);
          db.run('DELETE FROM areas WHERE id = ?', delId);
        });
      } catch (err: any) {
        console.warn('[StateMesh] Error deleting room:', err?.message || err);
      }
    }
  }

  // 3. Synchronize Device Assignments
  if (payload.assignments && typeof payload.assignments === 'object') {
    for (const [rawDevId, areaId] of Object.entries(payload.assignments)) {
      if (!rawDevId || !areaId) continue;
      const cleanDevId = rawDevId.trim().toUpperCase();
      globalMeshAssignments.set(cleanDevId, areaId);

      try {
        // Ensure room exists before assigning
        const areaExists = db.get('SELECT id FROM areas WHERE id = ?', areaId);
        if (areaExists) {
          db.run('UPDATE esp_devices SET area_id = ?, is_discovered = 0 WHERE id = ? COLLATE NOCASE', areaId, cleanDevId);
          db.run('UPDATE sensors SET area_id = ? WHERE device_id = ? COLLATE NOCASE', areaId, cleanDevId);
          db.run('UPDATE relay_devices SET area_id = ? WHERE device_id = ? COLLATE NOCASE', areaId, cleanDevId);
        }
      } catch (err: any) {
        console.warn('[StateMesh] Error applying device assignment:', err?.message || err);
      }
    }
  }

  // 4. Handle Deleted Devices
  if (Array.isArray(payload.deletedDevices) && payload.deletedDevices.length > 0) {
    for (const delDev of payload.deletedDevices) {
      if (!delDev) continue;
      const cleanDevId = delDev.trim().toUpperCase();
      globalMeshAssignments.delete(cleanDevId);
      try {
        db.run('DELETE FROM alert_events WHERE alert_id IN (SELECT id FROM alerts WHERE device_id = ? COLLATE NOCASE)', cleanDevId);
        db.run('DELETE FROM alerts WHERE device_id = ? COLLATE NOCASE', cleanDevId);
        db.run('DELETE FROM sensor_readings WHERE device_id = ? COLLATE NOCASE', cleanDevId);
        db.run('DELETE FROM relay_devices WHERE device_id = ? COLLATE NOCASE', cleanDevId);
        db.run('DELETE FROM sensors WHERE device_id = ? COLLATE NOCASE', cleanDevId);
        db.run('DELETE FROM esp_devices WHERE id = ? COLLATE NOCASE', cleanDevId);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Express Middleware that decodes x-agrivault-mesh header on every request
 * and instantly rehydrates this container's in-memory SQLite tables.
 */
export function stateMeshMiddleware(req: any, res: any, next: any): void {
  const meshHeader = req.headers['x-agrivault-mesh'];
  if (meshHeader && typeof meshHeader === 'string') {
    try {
      const decoded = Buffer.from(meshHeader, 'base64').toString('utf8');
      const payload: StateMeshPayload = JSON.parse(decoded);
      applyStateMesh(payload);
    } catch {
      // ignore malformed header
    }
  }
  next();
}
