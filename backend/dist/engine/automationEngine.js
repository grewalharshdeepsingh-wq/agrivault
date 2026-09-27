"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRelayDispatcher = registerRelayDispatcher;
exports.setRelayState = setRelayState;
exports.evaluateAutomationRules = evaluateAutomationRules;
const uuid_1 = require("uuid");
const db_js_1 = require("../database/db.js");
let relayCommandDispatcher = null;
function registerRelayDispatcher(fn) {
    relayCommandDispatcher = fn;
}
/**
 * Checks safety limits (anti-chatter cooldown, max continuous runtime)
 * and executes a safe relay state transition.
 */
function setRelayState(relayId, targetState, triggeredBy, actorId, reason, bypassCooldown = false) {
    const relay = db_js_1.db.get('SELECT * FROM relay_devices WHERE id = ?', relayId);
    if (!relay) {
        return { success: false, message: 'Relay device not found.' };
    }
    // Already in target state
    if (relay.state === targetState) {
        return { success: true, message: `Relay is already ${targetState === 1 ? 'ON' : 'OFF'}.`, relay };
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const lastSwitchedMs = new Date(relay.last_switched).getTime();
    const elapsedSec = (now.getTime() - lastSwitchedMs) / 1000;
    // Anti-chatter cooldown protection (unless manual emergency stop)
    if (!bypassCooldown && triggeredBy !== 'emergency_stop' && elapsedSec < relay.cooldown_period_sec) {
        const waitRemaining = Math.ceil(relay.cooldown_period_sec - elapsedSec);
        return {
            success: false,
            message: `Anti-chatter safety lock active. Please wait ${waitRemaining}s before toggling relay again.`
        };
    }
    // Update DB state
    const prev = relay.state;
    db_js_1.db.run('UPDATE relay_devices SET state = ?, last_switched = ? WHERE id = ?', targetState, nowIso, relayId);
    // Record audit action
    db_js_1.db.run('INSERT INTO relay_actions (id, relay_id, triggered_by, actor_id, previous_state, new_state, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', (0, uuid_1.v4)(), relayId, triggeredBy, actorId, prev, targetState, reason, nowIso);
    // Dispatch hardware control command (MQTT / Hardware driver)
    if (relayCommandDispatcher) {
        relayCommandDispatcher(relay.device_id, relay.gpio_pin, targetState, reason);
    }
    const updatedRelay = db_js_1.db.get('SELECT * FROM relay_devices WHERE id = ?', relayId);
    return {
        success: true,
        message: `Relay switched ${targetState === 1 ? 'ON' : 'OFF'} successfully.`,
        relay: updatedRelay
    };
}
/**
 * Evaluates automation rules for a given area, parameter, and sensor value.
 * Implements strict hysteresis to avoid relay chatter.
 */
function evaluateAutomationRules(areaId, parameter, currentValue) {
    const rules = db_js_1.db.all('SELECT * FROM automation_rules WHERE area_id = ? AND parameter = ? AND is_enabled = 1', areaId, parameter);
    for (const rule of rules) {
        const relay = db_js_1.db.get('SELECT * FROM relay_devices WHERE id = ?', rule.relay_id);
        if (!relay || relay.mode !== 'automatic')
            continue;
        const now = new Date();
        const lastSwitchedMs = new Date(relay.last_switched).getTime();
        const continuousRuntimeSec = relay.state === 1 ? (now.getTime() - lastSwitchedMs) / 1000 : 0;
        // Safety: Auto cutoff if running continuously past max runtime
        if (relay.state === 1 && continuousRuntimeSec > relay.max_continuous_runtime_sec) {
            setRelayState(relay.id, 0, 'safety_timeout', 'system_safety', `Continuous runtime exceeded ${relay.max_continuous_runtime_sec}s safety threshold. Auto-cooling down.`, true);
            continue;
        }
        // HYSTERESIS LOGIC:
        // If trigger is 'greater_than':
        // Turn ON if value >= turn_on_threshold
        // Turn OFF only if value <= turn_off_threshold (which is lower than turn_on_threshold)
        if (rule.trigger_condition === 'greater_than') {
            if (relay.state === 0 && currentValue >= rule.turn_on_threshold) {
                setRelayState(relay.id, 1, 'automation_rule', 'rule_engine', `Rule "${rule.name}": ${parameter} (${currentValue}) >= ON threshold (${rule.turn_on_threshold})`);
            }
            else if (relay.state === 1 && currentValue <= rule.turn_off_threshold) {
                setRelayState(relay.id, 0, 'automation_rule', 'rule_engine', `Rule "${rule.name}": ${parameter} (${currentValue}) <= OFF threshold (${rule.turn_off_threshold})`);
            }
        }
        // If trigger is 'less_than':
        // Turn ON if value <= turn_on_threshold
        // Turn OFF only if value >= turn_off_threshold (which is higher than turn_on_threshold)
        else if (rule.trigger_condition === 'less_than') {
            if (relay.state === 0 && currentValue <= rule.turn_on_threshold) {
                setRelayState(relay.id, 1, 'automation_rule', 'rule_engine', `Rule "${rule.name}": ${parameter} (${currentValue}) <= ON threshold (${rule.turn_on_threshold})`);
            }
            else if (relay.state === 1 && currentValue >= rule.turn_off_threshold) {
                setRelayState(relay.id, 0, 'automation_rule', 'rule_engine', `Rule "${rule.name}": ${parameter} (${currentValue}) >= OFF threshold (${rule.turn_off_threshold})`);
            }
        }
        // Update rule last_evaluated timestamp
        db_js_1.db.run('UPDATE automation_rules SET last_evaluated = ? WHERE id = ?', now.toISOString(), rule.id);
    }
}
