"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAlertBroadcast = registerAlertBroadcast;
exports.getEffectiveThreshold = getEffectiveThreshold;
exports.evaluateSensorReading = evaluateSensorReading;
exports.acknowledgeAlert = acknowledgeAlert;
const uuid_1 = require("uuid");
const db_js_1 = require("../database/db.js");
const storageHealth_js_1 = require("./storageHealth.js");
// In-memory cooldown tracking: map of "sensorId:param" -> timestamp of last alert creation
const alertCooldowns = new Map();
const COOLDOWN_MS = (parseInt(process.env.ALERT_COOLDOWN_MINUTES || '5', 10)) * 60 * 1000;
let broadcastCallback = null;
function registerAlertBroadcast(fn) {
    broadcastCallback = fn;
}
/**
 * Resolves the effective threshold for a given sensor and parameter,
 * respecting inheritance: Sensor -> Device -> Area -> Facility.
 */
function getEffectiveThreshold(facilityId, areaId, deviceId, sensorId, parameter) {
    // 1. Check sensor-specific threshold
    const sensorThresh = db_js_1.db.get('SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1', 'sensor', sensorId, parameter);
    if (sensorThresh)
        return sensorThresh;
    // 2. Check device-specific threshold
    const deviceThresh = db_js_1.db.get('SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1', 'device', deviceId, parameter);
    if (deviceThresh)
        return deviceThresh;
    // 3. Check area-specific threshold
    if (areaId) {
        const areaThresh = db_js_1.db.get('SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1', 'area', areaId, parameter);
        if (areaThresh)
            return areaThresh;
    }
    // 4. Check facility-level threshold
    const facilityThresh = db_js_1.db.get('SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1', 'facility', facilityId, parameter);
    return facilityThresh || null;
}
/**
 * Evaluates an incoming sensor reading against effective thresholds.
 * Handles deduplication, cooldown, auto-resolution, and event logging.
 */
function evaluateSensorReading(facilityId, areaId, deviceId, sensorId, parameter, measuredValue, commodity = 'General Produce') {
    const threshold = getEffectiveThreshold(facilityId, areaId, deviceId, sensorId, parameter);
    const now = new Date().toISOString();
    const cooldownKey = `${sensorId}:${parameter}`;
    if (!threshold) {
        return { hasViolation: false, severity: null, direction: null, thresholdValue: null };
    }
    let violationSeverity = null;
    let direction = null;
    let thresholdVal = null;
    // 1. Check Critical Limits
    if (threshold.max_value !== null && measuredValue > threshold.max_value) {
        violationSeverity = 'critical';
        direction = 'high';
        thresholdVal = threshold.max_value;
    }
    else if (threshold.min_value !== null && measuredValue < threshold.min_value) {
        violationSeverity = 'critical';
        direction = 'low';
        thresholdVal = threshold.min_value;
    }
    // 2. Check Warning Limits
    else if (threshold.warning_max !== null && measuredValue > threshold.warning_max) {
        violationSeverity = 'warning';
        direction = 'high';
        thresholdVal = threshold.warning_max;
    }
    else if (threshold.warning_min !== null && measuredValue < threshold.warning_min) {
        violationSeverity = 'warning';
        direction = 'low';
        thresholdVal = threshold.warning_min;
    }
    // Find existing active alert for this sensor and parameter
    const existingAlert = db_js_1.db.get("SELECT * FROM alerts WHERE sensor_id = ? AND parameter = ? AND status IN ('active', 'acknowledged') ORDER BY created_at DESC LIMIT 1", sensorId, parameter);
    // CASE A: Reading is NORMAL now
    if (!violationSeverity) {
        if (existingAlert) {
            // Auto-resolve condition
            db_js_1.db.run("UPDATE alerts SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?", now, now, existingAlert.id);
            db_js_1.db.run('INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', (0, uuid_1.v4)(), existingAlert.id, 'resolved', `Auto-cleared: reading returned to normal (${measuredValue})`, 'system', now);
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
        db_js_1.db.run('UPDATE alerts SET measured_value = ?, updated_at = ? WHERE id = ?', measuredValue, now, existingAlert.id);
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
    const interp = (0, storageHealth_js_1.interpretSingleParameter)(parameter, direction || 'high', commodity);
    const alertId = (0, uuid_1.v4)();
    const title = `${violationSeverity.toUpperCase()}: ${parameter.toUpperCase()} ${direction === 'high' ? 'Exceeded Limit' : 'Sub-Optimal'}`;
    const message = `${parameter.toUpperCase()} registered ${measuredValue}, violating configured threshold of ${thresholdVal}.`;
    db_js_1.db.run(`INSERT INTO alerts (
      id, facility_id, area_id, device_id, sensor_id, parameter, severity, status,
      measured_value, threshold_value, title, message, potential_issue,
      recommended_action, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, alertId, facilityId, areaId || null, deviceId, sensorId, parameter, violationSeverity, 'active', measuredValue, thresholdVal || 0, title, message, interp.potentialIssue, interp.recommendedAction, now, now);
    // Log alert event
    db_js_1.db.run('INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', (0, uuid_1.v4)(), alertId, 'triggered', `Triggered: value ${measuredValue} exceeded threshold ${thresholdVal}`, 'system', now);
    // Create notification
    const notifId = (0, uuid_1.v4)();
    db_js_1.db.run('INSERT INTO notifications (id, user_id, facility_id, alert_id, title, message, severity, channel, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', notifId, null, facilityId, alertId, title, message, violationSeverity, 'in_app', 0, now);
    const fullAlert = db_js_1.db.get('SELECT * FROM alerts WHERE id = ?', alertId);
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
function acknowledgeAlert(alertId, actorName = 'Operator') {
    const now = new Date().toISOString();
    const alert = db_js_1.db.get('SELECT * FROM alerts WHERE id = ?', alertId);
    if (!alert)
        return false;
    db_js_1.db.run("UPDATE alerts SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?, updated_at = ? WHERE id = ?", actorName, now, now, alertId);
    db_js_1.db.run('INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', (0, uuid_1.v4)(), alertId, 'acknowledged', `Acknowledged by ${actorName}`, actorName, now);
    if (broadcastCallback) {
        broadcastCallback('alert_acknowledged', { alertId, acknowledgedBy: actorName, acknowledgedAt: now });
    }
    return true;
}
