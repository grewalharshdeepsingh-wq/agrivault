"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../database/db.js");
const alertEngine_js_1 = require("../engine/alertEngine.js");
const wsServer_js_1 = require("../websocket/wsServer.js");
const router = (0, express_1.Router)();
// GET /api/alerts
router.get('/', (req, res) => {
    const { facilityId, areaId, status, severity, limit } = req.query;
    let sql = `
    SELECT a.*, ar.name as area_name, d.user_name as device_name
    FROM alerts a
    LEFT JOIN areas ar ON a.area_id = ar.id
    LEFT JOIN esp_devices d ON a.device_id = d.id
    WHERE 1=1
  `;
    const params = [];
    if (facilityId) {
        sql += ' AND a.facility_id = ?';
        params.push(facilityId);
    }
    if (areaId) {
        sql += ' AND a.area_id = ?';
        params.push(areaId);
    }
    if (status) {
        sql += ' AND a.status = ?';
        params.push(status);
    }
    if (severity) {
        sql += ' AND a.severity = ?';
        params.push(severity);
    }
    sql += " ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, a.created_at DESC";
    if (limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(limit, 10));
    }
    else {
        sql += ' LIMIT 100';
    }
    const alerts = db_js_1.db.all(sql, ...params);
    res.json(alerts);
});
// POST /api/alerts/:id/acknowledge
router.post('/:id/acknowledge', (req, res) => {
    const alertId = req.params.id;
    const { actorName } = req.body;
    const success = (0, alertEngine_js_1.acknowledgeAlert)(alertId, actorName || 'Facility Operator');
    if (!success) {
        res.status(404).json({ error: 'Alert not found or already acknowledged' });
        return;
    }
    const alert = db_js_1.db.get('SELECT * FROM alerts WHERE id = ?', alertId);
    res.json({ success: true, alert });
});
// POST /api/alerts/:id/resolve
router.post('/:id/resolve', (req, res) => {
    const alertId = req.params.id;
    const { actorName, notes } = req.body;
    const now = new Date().toISOString();
    const alert = db_js_1.db.get('SELECT * FROM alerts WHERE id = ?', alertId);
    if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
    }
    db_js_1.db.run("UPDATE alerts SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?", now, now, alertId);
    db_js_1.db.run('INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', `evt-${Date.now()}`, alertId, 'resolved', notes || `Manually marked resolved by ${actorName || 'Operator'}`, actorName || 'Operator', now);
    (0, wsServer_js_1.broadcast)('alert_resolved', {
        alertId,
        resolvedAt: now,
        actorName: actorName || 'Operator'
    });
    const updated = db_js_1.db.get('SELECT * FROM alerts WHERE id = ?', alertId);
    res.json({ success: true, alert: updated });
});
// GET /api/alerts/:id/events
router.get('/:id/events', (req, res) => {
    const alertId = req.params.id;
    const events = db_js_1.db.all('SELECT * FROM alert_events WHERE alert_id = ? ORDER BY created_at ASC', alertId);
    res.json(events);
});
exports.default = router;
