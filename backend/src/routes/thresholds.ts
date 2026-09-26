import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { Threshold } from '../models/types.js';

const router = Router();

// GET /api/thresholds
router.get('/', (req: Request, res: Response): void => {
  const { scopeType, scopeId, facilityId } = req.query;

  let sql = 'SELECT * FROM thresholds WHERE 1=1';
  const params: any[] = [];

  if (scopeType) {
    sql += ' AND scope_type = ?';
    params.push(scopeType);
  }
  if (scopeId) {
    sql += ' AND scope_id = ?';
    params.push(scopeId);
  }

  sql += ' ORDER BY parameter ASC';

  const thresholds = db.all<Threshold>(sql, ...params);
  res.json(thresholds);
});

// POST /api/thresholds (Create or Upsert)
router.post('/', (req: Request, res: Response): void => {
  const { scopeType, scopeId, parameter, minValue, maxValue, warningMin, warningMax } = req.body;

  if (!scopeType || !scopeId || !parameter) {
    res.status(400).json({ error: 'scopeType, scopeId, and parameter are required' });
    return;
  }

  const now = new Date().toISOString();
  const existing = db.get<Threshold>(
    'SELECT * FROM thresholds WHERE scope_type = ? AND scope_id = ? AND parameter = ? LIMIT 1',
    scopeType, scopeId, parameter
  );

  if (existing) {
    db.run(
      `UPDATE thresholds SET
        min_value = ?, max_value = ?, warning_min = ?, warning_max = ?, updated_at = ?
      WHERE id = ?`,
      minValue ?? null, maxValue ?? null, warningMin ?? null, warningMax ?? null, now, existing.id
    );

    const updated = db.get<Threshold>('SELECT * FROM thresholds WHERE id = ?', existing.id);
    res.json(updated);
  } else {
    const id = uuidv4();
    db.run(
      `INSERT INTO thresholds (
        id, scope_type, scope_id, parameter, min_value, max_value, warning_min, warning_max, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, scopeType, scopeId, parameter, minValue ?? null, maxValue ?? null, warningMin ?? null, warningMax ?? null, now, now
    );

    const created = db.get<Threshold>('SELECT * FROM thresholds WHERE id = ?', id);
    res.status(201).json(created);
  }
});

// DELETE /api/thresholds/:id
router.delete('/:id', (req: Request, res: Response): void => {
  const id = req.params.id;
  db.run('DELETE FROM thresholds WHERE id = ?', id);
  res.json({ success: true, message: 'Threshold override removed' });
});

export default router;
