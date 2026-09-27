"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const db_js_1 = require("../database/db.js");
const router = (0, express_1.Router)();
// GET /api/thresholds
router.get('/', (req, res) => {
    const { scopeType, scopeId, facilityId } = req.query;
    let sql = 'SELECT * FROM thresholds WHERE 1=1';
    const params = [];
    if (scopeType) {
        sql += ' AND scope_type = ?';
        params.push(scopeType);
    }
    if (scopeId) {
        sql += ' AND scope_id = ?';
        params.push(scopeId);
    }
    sql += ' ORDER BY parameter ASC';
    const thresholds = db_js_1.db.all(sql, ...params);
    res.json(thresholds);
});
// POST /api/thresholds (Create or Upsert)
router.post('/', (req, res) => {
    const { scopeType, scopeId, parameter, minValue, maxValue, warningMin, warningMax } = req.body;
    if (!scopeType || !scopeId || !parameter) {
        res.status(400).json({ error: 'scopeType, scopeId, and parameter are required' });
        return;
    }
    const now = new Date().toISOString();
    const existing = db_js_1.db.get('SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1', scopeType, scopeId, parameter);
    if (existing) {
        db_js_1.db.run(`UPDATE thresholds SET
        min_value = ?, max_value = ?, warning_min = ?, warning_max = ?, updated_at = ?
      WHERE id = ?`, minValue ?? null, maxValue ?? null, warningMin ?? null, warningMax ?? null, now, existing.id);
        const updated = db_js_1.db.get('SELECT * FROM thresholds WHERE id = ?', existing.id);
        res.json(updated);
    }
    else {
        const id = (0, uuid_1.v4)();
        db_js_1.db.run(`INSERT INTO thresholds (
        id, scope_type, scope_id, parameter, min_value, max_value, warning_min, warning_max, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, scopeType, scopeId, parameter, minValue ?? null, maxValue ?? null, warningMin ?? null, warningMax ?? null, now, now);
        const created = db_js_1.db.get('SELECT * FROM thresholds WHERE id = ?', id);
        res.status(201).json(created);
    }
});
// DELETE /api/thresholds/:id
router.delete('/:id', (req, res) => {
    const id = req.params.id;
    db_js_1.db.run('DELETE FROM thresholds WHERE id = ?', id);
    res.json({ success: true, message: 'Threshold override removed' });
});
exports.default = router;
