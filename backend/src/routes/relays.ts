import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { RelayDevice, AutomationRule } from '../models/types.js';
import { setRelayState } from '../engine/automationEngine.js';
import { broadcast } from '../websocket/wsServer.js';

const router = Router();

// GET /api/relays
router.get('/', (req: Request, res: Response): void => {
  const { areaId } = req.query;

  let sql = `
    SELECT r.*, d.user_name as device_name, a.name as area_name
    FROM relay_devices r
    JOIN esp_devices d ON r.device_id = d.id
    LEFT JOIN areas a ON r.area_id = a.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (areaId) {
    sql += ' AND r.area_id = ?';
    params.push(areaId);
  }

  const relays = db.all<any>(sql, ...params);
  res.json(relays);
});

// POST /api/relays/:id/toggle (Manual control with safety confirmation)
router.post('/:id/toggle', (req: Request, res: Response): void => {
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

  const result = setRelayState(
    relayId,
    targetState as 0 | 1,
    'manual_user',
    actorName || 'Facility Engineer',
    reason || 'Manual override switch from AgriVault UI',
    !!bypassCooldown
  );

  if (!result.success) {
    res.status(429).json({ error: result.message });
    return;
  }

  broadcast('relay_state_changed', {
    relayId,
    state: targetState,
    triggeredBy: 'manual_user',
    actorName: actorName || 'Operator',
    lastSwitched: new Date().toISOString()
  });

  res.json(result);
});

// PUT /api/relays/:id/mode (Switch between 'manual' and 'automatic')
router.put('/:id/mode', (req: Request, res: Response): void => {
  const relayId = req.params.id;
  const { mode } = req.body;

  if (mode !== 'manual' && mode !== 'automatic') {
    res.status(400).json({ error: 'Mode must be "manual" or "automatic"' });
    return;
  }

  db.run('UPDATE relay_devices SET mode = ? WHERE id = ?', mode, relayId);
  const updated = db.get<RelayDevice>('SELECT * FROM relay_devices WHERE id = ?', relayId);

  broadcast('relay_mode_changed', { relayId, mode });
  res.json({ success: true, relay: updated });
});

// GET /api/relays/:id/actions (Audit activation history)
router.get('/:id/actions', (req: Request, res: Response): void => {
  const relayId = req.params.id;
  const actions = db.all(
    'SELECT * FROM relay_actions WHERE relay_id = ? ORDER BY created_at DESC LIMIT 50',
    relayId
  );
  res.json(actions);
});

// --- Automation Rules ---

// GET /api/relays/rules/all
router.get('/rules/all', (req: Request, res: Response): void => {
  const rules = db.all<any>(
    `SELECT r.*, rd.name as relay_name, rd.target_equipment, a.name as area_name
     FROM automation_rules r
     JOIN relay_devices rd ON r.relay_id = rd.id
     JOIN areas a ON r.area_id = a.id
     ORDER BY r.created_at DESC`
  );
  res.json(rules);
});

// POST /api/relays/rules
router.post('/rules', (req: Request, res: Response): void => {
  const { facilityId, areaId, relayId, name, parameter, triggerCondition, turnOnThreshold, turnOffThreshold } = req.body;

  if (!areaId || !relayId || !name || !parameter || turnOnThreshold === undefined || turnOffThreshold === undefined) {
    res.status(400).json({ error: 'All automation rule fields including hysteresis limits are required' });
    return;
  }

  const id = `rule-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO automation_rules (
      id, facility_id, area_id, relay_id, name, parameter,
      trigger_condition, turn_on_threshold, turn_off_threshold, is_enabled, last_evaluated, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id, facilityId || 'fac-01', areaId, relayId, name, parameter,
    triggerCondition || 'greater_than', turnOnThreshold, turnOffThreshold, now, now
  );

  const created = db.get<AutomationRule>('SELECT * FROM automation_rules WHERE id = ?', id);
  res.status(201).json(created);
});

// PUT /api/relays/rules/:id/toggle
router.put('/rules/:id/toggle', (req: Request, res: Response): void => {
  const ruleId = req.params.id;
  const { isEnabled } = req.body;

  db.run('UPDATE automation_rules SET is_enabled = ? WHERE id = ?', isEnabled ? 1 : 0, ruleId);
  res.json({ success: true, ruleId, isEnabled: !!isEnabled });
});

// DELETE /api/relays/rules/:id
router.delete('/rules/:id', (req: Request, res: Response): void => {
  const ruleId = req.params.id;
  db.run('DELETE FROM automation_rules WHERE id = ?', ruleId);
  res.json({ success: true, message: 'Automation rule deleted' });
});

export default router;
