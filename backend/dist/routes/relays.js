"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const db_js_1 = require("../database/db.js");
const automationEngine_js_1 = require("../engine/automationEngine.js");
const wsServer_js_1 = require("../websocket/wsServer.js");
const router = (0, express_1.Router)();
// GET /api/relays
router.get('/', (req, res) => {
    const { areaId } = req.query;
    let sql = `
    SELECT r.*, d.user_name as device_name, a.name as area_name
    FROM relay_devices r
    JOIN esp_devices d ON r.device_id = d.id
    LEFT JOIN areas a ON r.area_id = a.id
    WHERE 1=1
  `;
    const params = [];
    if (areaId) {
        sql += ' AND r.area_id = ?';
        params.push(areaId);
    }
    const relays = db_js_1.db.all(sql, ...params);
    res.json(relays);
});
// POST /api/relays/:id/toggle (Manual control with safety confirmation)
router.post('/:id/toggle', (req, res) => {
    const relayId = req.params.id;
    const { targetState, confirmed, reason, actorName, bypassCooldown } = req.body;
    if (targetState === undefined || (targetState !== 0 && targetState !== 1)) {
        res.status(400).json({ error: 'Valid targetState (0 or 1) required' });
        return;
    }
    if (!confirmed) {
        res.status(400).json({
            error: 'Safety confirmation required to manually toggle external industrial load.'
        });
        return;
    }
    const result = (0, automationEngine_js_1.setRelayState)(relayId, targetState, 'manual_user', actorName || 'Facility Engineer', reason || 'Manual override switch from AgriVault UI', !!bypassCooldown);
    if (!result.success) {
        res.status(429).json({ error: result.message });
        return;
    }
    (0, wsServer_js_1.broadcast)('relay_state_changed', {
        relayId,
        state: targetState,
        triggeredBy: 'manual_user',
        actorName: actorName || 'Operator',
        lastSwitched: new Date().toISOString()
    });
    res.json(result);
});
// PUT /api/relays/:id/mode (Switch between 'manual' and 'automatic')
router.put('/:id/mode', (req, res) => {
    const relayId = req.params.id;
    const { mode } = req.body;
    if (mode !== 'manual' && mode !== 'automatic') {
        res.status(400).json({ error: 'Mode must be "manual" or "automatic"' });
        return;
    }
    db_js_1.db.run('UPDATE relay_devices SET mode = ? WHERE id = ?', mode, relayId);
    const updated = db_js_1.db.get('SELECT * FROM relay_devices WHERE id = ?', relayId);
    (0, wsServer_js_1.broadcast)('relay_mode_changed', { relayId, mode });
    res.json({ success: true, relay: updated });
});
// GET /api/relays/:id/actions (Audit activation history)
router.get('/:id/actions', (req, res) => {
    const relayId = req.params.id;
    const actions = db_js_1.db.all('SELECT * FROM relay_actions WHERE relay_id = ? ORDER BY created_at DESC LIMIT 50', relayId);
    res.json(actions);
});
// --- Automation Rules ---
// GET /api/relays/rules/all
router.get('/rules/all', (req, res) => {
    const rules = db_js_1.db.all(`SELECT r.*, rd.name as relay_name, rd.target_equipment, a.name as area_name
     FROM automation_rules r
     JOIN relay_devices rd ON r.relay_id = rd.id
     JOIN areas a ON r.area_id = a.id
     ORDER BY r.created_at DESC`);
    res.json(rules);
});
// POST /api/relays/rules
router.post('/rules', (req, res) => {
    const { facilityId, areaId, relayId, name, parameter, triggerCondition, turnOnThreshold, turnOffThreshold } = req.body;
    if (!areaId || !relayId || !name || !parameter || turnOnThreshold === undefined || turnOffThreshold === undefined) {
        res.status(400).json({ error: 'All automation rule fields including hysteresis limits are required' });
        return;
    }
    const id = `rule-${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    db_js_1.db.run(`INSERT INTO automation_rules (
      id, facility_id, area_id, relay_id, name, parameter,
      trigger_condition, turn_on_threshold, turn_off_threshold, is_enabled, last_evaluated, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, id, facilityId || 'fac-01', areaId, relayId, name, parameter, triggerCondition || 'greater_than', turnOnThreshold, turnOffThreshold, now, now);
    const created = db_js_1.db.get('SELECT * FROM automation_rules WHERE id = ?', id);
    res.status(201).json(created);
});
// PUT /api/relays/rules/:id/toggle
router.put('/rules/:id/toggle', (req, res) => {
    const ruleId = req.params.id;
    const { isEnabled } = req.body;
    db_js_1.db.run('UPDATE automation_rules SET is_enabled = ? WHERE id = ?', isEnabled ? 1 : 0, ruleId);
    res.json({ success: true, ruleId, isEnabled: !!isEnabled });
});
// DELETE /api/relays/rules/:id
router.delete('/rules/:id', (req, res) => {
    const ruleId = req.params.id;
    db_js_1.db.run('DELETE FROM automation_rules WHERE id = ?', ruleId);
    res.json({ success: true, message: 'Automation rule deleted' });
});
exports.default = router;
