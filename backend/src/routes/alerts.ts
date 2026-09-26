import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { Alert } from '../models/types.js';
import { acknowledgeAlert } from '../engine/alertEngine.js';
import { broadcast } from '../websocket/wsServer.js';

const router = Router();

// GET /api/alerts
router.get('/', (req: Request, res: Response): void => {
  const { facilityId, areaId, status, severity, limit } = req.query;

  let sql = `
    SELECT a.*, ar.name as area_name, d.user_name as device_name
    FROM alerts a
    LEFT JOIN areas ar ON a.area_id = ar.id
    LEFT JOIN esp_devices d ON a.device_id = d.id
    WHERE 1=1
  `;
  const params: any[] = [];

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
    params.push(parseInt(limit as string, 10));
  } else {
    sql += ' LIMIT 100';
  }

  const alerts = db.all<Alert>(sql, ...params);
  res.json(alerts);
});

// POST /api/alerts/:id/acknowledge
router.post('/:id/acknowledge', (req: Request, res: Response): void => {
  const alertId = req.params.id;
  const { actorName } = req.body;

  const success = acknowledgeAlert(alertId, actorName || 'Facility Operator');
  if (!success) {
    res.status(404).json({ error: 'Alert not found or already acknowledged' });
    return;
  }

  const alert = db.get<Alert>('SELECT * FROM alerts WHERE id = ?', alertId);
  res.json({ success: true, alert });
});

// POST /api/alerts/:id/resolve
router.post('/:id/resolve', (req: Request, res: Response): void => {
  const alertId = req.params.id;
  const { actorName, notes } = req.body;
  const now = new Date().toISOString();

  const alert = db.get<Alert>('SELECT * FROM alerts WHERE id = ?', alertId);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  db.run(
    "UPDATE alerts SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?",
    now, now, alertId
  );

  db.run(
    'INSERT INTO alert_events (id, alert_id, event_type, details, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    `evt-${Date.now()}`, alertId, 'resolved', notes || `Manually marked resolved by ${actorName || 'Operator'}`, actorName || 'Operator', now
  );

  broadcast('alert_resolved', {
    alertId,
    resolvedAt: now,
    actorName: actorName || 'Operator'
  });

  const updated = db.get<Alert>('SELECT * FROM alerts WHERE id = ?', alertId);
  res.json({ success: true, alert: updated });
});

// GET /api/alerts/:id/events
router.get('/:id/events', (req: Request, res: Response): void => {
  const alertId = req.params.id;
  const events = db.all('SELECT * FROM alert_events WHERE alert_id = ? ORDER BY created_at ASC', alertId);
  res.json(events);
});

export default router;
