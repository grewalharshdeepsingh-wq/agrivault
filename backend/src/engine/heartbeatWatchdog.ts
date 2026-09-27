import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { ESPDevice } from '../models/types.js';

const HEARTBEAT_TIMEOUT_SEC = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '90', 10);

type DeviceStatusBroadcastFn = (event: string, payload: any) => void;
let statusBroadcastFn: DeviceStatusBroadcastFn | null = null;

export function registerStatusBroadcast(fn: DeviceStatusBroadcastFn): void {
  statusBroadcastFn = fn;
}

/**
 * Updates device heartbeat on telemetry or ping arrival.
 * Restores ONLINE status if previously marked offline.
 */
export function recordDeviceHeartbeat(deviceId: string, rssi?: number, ip?: string): void {
  const now = new Date().toISOString();
  const cleanId = deviceId.trim().toUpperCase();
  const dev = db.get<ESPDevice>('SELECT * FROM esp_devices WHERE id = ? COLLATE NOCASE', cleanId);
  if (!dev) return;

  const wasOffline = dev.is_online === 0;

  db.run(
    'UPDATE esp_devices SET is_online = 1, last_heartbeat = ?, signal_rssi = COALESCE(?, signal_rssi), ip_address = COALESCE(?, ip_address) WHERE id = ? COLLATE NOCASE',
    now, rssi ?? null, ip ?? null, dev.id
  );

  // If restored from offline, resolve offline alert and notify UI
  if (wasOffline) {
    db.run(
      "UPDATE alerts SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE device_id = ? COLLATE NOCASE AND parameter = 'connectivity' AND status IN ('active', 'acknowledged')",
      now, now, dev.id
    );

    if (statusBroadcastFn) {
      statusBroadcastFn('device_online', {
        deviceId: dev.id,
        userName: dev.user_name,
        areaId: dev.area_id,
        lastHeartbeat: now
      });
    }
  }
}

/**
 * Periodic Watchdog Timer:
 * Scans for devices exceeding heartbeat timeout and generates offline alerts.
 */
export function checkDeviceHeartbeats(): void {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  // 1. Check ESP Devices
  const devices = db.all<ESPDevice>('SELECT * FROM esp_devices WHERE is_enabled = 1');
  for (const dev of devices) {
    const lastBeatMs = new Date(dev.last_heartbeat).getTime();
    const elapsedSec = (nowMs - lastBeatMs) / 1000;

    if (dev.is_online === 1 && elapsedSec > HEARTBEAT_TIMEOUT_SEC) {
      // Mark OFFLINE
      db.run('UPDATE esp_devices SET is_online = 0 WHERE id = ?', dev.id);

      // Create Device Offline Alert
      const alertId = uuidv4();
      const title = `ESP Node Offline: ${dev.user_name}`;
      const message = `${dev.user_name} (${dev.id}) has not transmitted a heartbeat for ${Math.round(elapsedSec)} seconds. Sensor telemetry from this area may be incomplete.`;
      const issue = 'Potential causes: local 2.4GHz Wi-Fi interference, breadboard/probe power loss, or hardware freeze.';
      const action = 'Inspect ESP status LED on board, verify 5V/3.3V power adapter, and check internet Wi-Fi router / WAN connectivity.';

      // Deduplicate alert
      const existing = db.get(
        "SELECT id FROM alerts WHERE device_id = ? AND parameter = 'connectivity' AND status IN ('active', 'acknowledged')",
        dev.id
      );

      if (!existing) {
        db.run(
          `INSERT INTO alerts (
            id, facility_id, area_id, device_id, sensor_id, parameter, severity, status,
            measured_value, threshold_value, title, message, potential_issue,
            recommended_action, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          alertId, dev.facility_id, dev.area_id || null, dev.id, null, 'connectivity',
          'warning', 'active', Math.round(elapsedSec), HEARTBEAT_TIMEOUT_SEC,
          title, message, issue, action, nowIso, nowIso
        );

        db.run(
          'INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          uuidv4(), alertId, 'triggered', `Device heartbeat lost: silent for ${Math.round(elapsedSec)}s`, 'watchdog', nowIso
        );
      }

      if (statusBroadcastFn) {
        statusBroadcastFn('device_offline', {
          deviceId: dev.id,
          userName: dev.user_name,
          areaId: dev.area_id,
          elapsedSeconds: Math.round(elapsedSec)
        });
      }
    }
  }
}

let watchdogInterval: NodeJS.Timeout | null = null;

export function startHeartbeatWatchdog(intervalMs = 15000): void {
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    try {
      checkDeviceHeartbeats();
    } catch (e) {
      console.error('[Watchdog] Error during heartbeat evaluation:', e);
    }
  }, intervalMs);
  console.log(`[Watchdog] Heartbeat watchdog initialized (timeout = ${HEARTBEAT_TIMEOUT_SEC}s, interval = ${intervalMs / 1000}s).`);
}

export function stopHeartbeatWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}
