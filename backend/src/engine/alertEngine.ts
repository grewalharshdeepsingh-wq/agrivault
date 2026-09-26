import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { Alert, AlertSeverity, Threshold } from '../models/types.js';
import { interpretSingleParameter } from './storageHealth.js';

// In-memory cooldown tracking: map of "sensorId:param" -> timestamp of last alert creation
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MS = (parseInt(process.env.ALERT_COOLDOWN_MINUTES || '5', 10)) * 60 * 1000;

// Callback hooks for WebSockets and notifications
type AlertBroadcastFn = (event: string, payload: any) => void;
let broadcastCallback: AlertBroadcastFn | null = null;

export function registerAlertBroadcast(fn: AlertBroadcastFn): void {
  broadcastCallback = fn;
}

/**
 * Resolves the effective threshold for a given sensor and parameter,
 * respecting inheritance: Sensor -> Device -> Area -> Facility.
 */
export function getEffectiveThreshold(
  facilityId: string,
  areaId: string | null,
  deviceId: string,
  sensorId: string,
  parameter: string
): Threshold | null {
  // 1. Check sensor-specific threshold
  const sensorThresh = db.get<Threshold>(
    'SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1',
    'sensor', sensorId, parameter
  );
  if (sensorThresh) return sensorThresh;

  // 2. Check device-specific threshold
  const deviceThresh = db.get<Threshold>(
    'SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1',
    'device', deviceId, parameter
  );
  if (deviceThresh) return deviceThresh;

  // 3. Check area-specific threshold
  if (areaId) {
    const areaThresh = db.get<Threshold>(
      'SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1',
      'area', areaId, parameter
    );
    if (areaThresh) return areaThresh;
  }

  // 4. Check facility-level threshold
  const facilityThresh = db.get<Threshold>(
    'SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1',
    'facility', facilityId, parameter
  );
  return facilityThresh || null;
}

export interface EvaluationResult {
  hasViolation: boolean;
  severity: AlertSeverity | null;
  direction: 'high' | 'low' | null;
  thresholdValue: number | null;
  alertCreated?: boolean;
  alertResolved?: boolean;
}

/**
 * Evaluates an incoming sensor reading against effective thresholds.
 * Handles deduplication, cooldown, auto-resolution, and event logging.
 */
export function evaluateSensorReading(
  facilityId: string,
  areaId: string | null,
  deviceId: string,
  sensorId: string,
  parameter: string,
  measuredValue: number,
  commodity = 'General Produce'
): EvaluationResult {
  const threshold = getEffectiveThreshold(facilityId, areaId, deviceId, sensorId, parameter);
  const now = new Date().toISOString();
  const cooldownKey = `${sensorId}:${parameter}`;

  if (!threshold) {
    return { hasViolation: false, severity: null, direction: null, thresholdValue: null };
  }

  let violationSeverity: AlertSeverity | null = null;
  let direction: 'high' | 'low' | null = null;
  let thresholdVal: number | null = null;

  // 1. Check Critical Limits
  if (threshold.max_value !== null && measuredValue > threshold.max_value) {
    violationSeverity = 'critical';
    direction = 'high';
    thresholdVal = threshold.max_value;
  } else if (threshold.min_value !== null && measuredValue < threshold.min_value) {
    violationSeverity = 'critical';
    direction = 'low';
    thresholdVal = threshold.min_value;
  }
  // 2. Check Warning Limits
  else if (threshold.warning_max !== null && measuredValue > threshold.warning_max) {
    violationSeverity = 'warning';
    direction = 'high';
    thresholdVal = threshold.warning_max;
  } else if (threshold.warning_min !== null && measuredValue < threshold.warning_min) {
    violationSeverity = 'warning';
    direction = 'low';
    thresholdVal = threshold.warning_min;
  }

  // Find existing active alert for this sensor and parameter
  const existingAlert = db.get<Alert>(
    "SELECT * FROM alerts WHERE sensor_id = ? AND parameter = ? AND status IN ('active', 'acknowledged') ORDER BY created_at DESC LIMIT 1",
    sensorId, parameter
  );

  // CASE A: Reading is NORMAL now
  if (!violationSeverity) {
    if (existingAlert) {
      // Auto-resolve condition
      db.run(
        "UPDATE alerts SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?",
        now, now, existingAlert.id
      );

      db.run(
        'INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        uuidv4(), existingAlert.id, 'resolved', `Auto-cleared: reading returned to normal (${measuredValue})`, 'system', now
      );

      alertCooldowns.delete(cooldownKey);

      if (broadcastCallback) {
        broadcastCallback('alert_resolved', {
          alertId: existingAlert.id,
          sensorId,
          parameter,
          resolvedAt: now,
          measuredValue
        });
      }

      return { hasViolation: false, severity: null, direction: null, thresholdValue: null, alertResolved: true };
    }

    return { hasViolation: false, severity: null, direction: null, thresholdValue: null };
  }

  // CASE B: Violation DETECTED
  if (existingAlert) {
    // Condition continues: update existing alert measured value and timestamp without spamming duplicate alerts
    db.run(
      'UPDATE alerts SET measured_value = ?, updated_at = ? WHERE id = ?',
      measuredValue, now, existingAlert.id
    );

    return {
      hasViolation: true,
      severity: violationSeverity,
      direction,
      thresholdValue: thresholdVal,
      alertCreated: false
    };
  }

  // Check cooldown to avoid rapid recreation
  const lastTime = alertCooldowns.get(cooldownKey) || 0;
  if (Date.now() - lastTime < COOLDOWN_MS) {
    return {
      hasViolation: true,
      severity: violationSeverity,
      direction,
      thresholdValue: thresholdVal,
      alertCreated: false
    };
  }

  // CASE C: CREATE NEW ALERT
  alertCooldowns.set(cooldownKey, Date.now());

  const interp = interpretSingleParameter(parameter, direction || 'high', commodity);
  const alertId = uuidv4();
  const title = `${violationSeverity.toUpperCase()}: ${parameter.toUpperCase()} ${direction === 'high' ? 'Exceeded Limit' : 'Sub-Optimal'}`;
  const message = `${parameter.toUpperCase()} registered ${measuredValue}, violating configured threshold of ${thresholdVal}.`;

  db.run(
    `INSERT INTO alerts (
      id, facility_id, area_id, device_id, sensor_id, parameter, severity, status,
      measured_value, threshold_value, title, message, potential_issue,
      recommended_action, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    alertId,
    facilityId,
    areaId || null,
    deviceId,
    sensorId,
    parameter,
    violationSeverity,
    'active',
    measuredValue,
    thresholdVal || 0,
    title,
    message,
    interp.potentialIssue,
    interp.recommendedAction,
    now,
    now
  );

  // Log alert event
  db.run(
    'INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uuidv4(), alertId, 'triggered', `Triggered: value ${measuredValue} exceeded threshold ${thresholdVal}`, 'system', now
  );

  // Create notification
  const notifId = uuidv4();
  db.run(
    'INSERT INTO notifications (id, user_id, facility_id, alert_id, title, message, severity, channel, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    notifId, null, facilityId, alertId, title, message, violationSeverity, 'in_app', 0, now
  );

  const fullAlert = db.get<Alert>('SELECT * FROM alerts WHERE id = ?', alertId);

  if (broadcastCallback && fullAlert) {
    broadcastCallback('new_alert', fullAlert);
  }

  return {
    hasViolation: true,
    severity: violationSeverity,
    direction,
    thresholdValue: thresholdVal,
    alertCreated: true
  };
}

/**
 * Acknowledges an active alert
 */
export function acknowledgeAlert(alertId: string, actorName = 'Operator'): boolean {
  const now = new Date().toISOString();
  const alert = db.get<Alert>('SELECT * FROM alerts WHERE id = ?', alertId);
  if (!alert) return false;

  db.run(
    "UPDATE alerts SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?, updated_at = ? WHERE id = ?",
    actorName, now, now, alertId
  );

  db.run(
    'INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uuidv4(), alertId, 'acknowledged', `Acknowledged by ${actorName}`, actorName, now
  );

  if (broadcastCallback) {
    broadcastCallback('alert_acknowledged', { alertId, acknowledgedBy: actorName, acknowledgedAt: now });
  }

  return true;
}
