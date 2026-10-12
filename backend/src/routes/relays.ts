import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { RelayDevice, AutomationRule } from '../models/types.js';
import { broadcast } from '../websocket/wsServer.js';
import { publishMqtt } from '../mqtt/broker.js';

const router = Router();

// Store active command timeout timers in memory
const pendingTimeouts = new Map<string, NodeJS.Timeout>();

// GET /api/relays
router.get('/', (req: Request, res: Response): void => {
  const { areaId, deviceId } = req.query;

  let sql = `
    SELECT r.*, d.user_name as device_name, d.is_online as device_online, a.name as area_name
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
  if (deviceId) {
    sql += ' AND r.device_id = ?';
    params.push(deviceId);
  }

  const relays = db.all<any>(sql, ...params);
  res.json(relays);
});

// GET /api/relays/:id
router.get('/:id', (req: Request, res: Response): void => {
  const relay = db.get<any>(
    `SELECT r.*, d.user_name as device_name, d.is_online as device_online, a.name as area_name
     FROM relay_devices r
     JOIN esp_devices d ON r.device_id = d.id
     LEFT JOIN areas a ON r.area_id = a.id
     WHERE r.id = ?`,
    req.params.id
  );

  if (!relay) {
    res.status(404).json({ error: 'Relay not found' });
    return;
  }
  res.json(relay);
});

// POST /api/relays/:id/command (Authenticated Manual ON/OFF Control)
// State Flow: IDLE -> COMMAND_REQUESTED -> (Device ACK) -> COMMAND_ACKNOWLEDGED -> (Device Report) -> STATE_REPORTED
router.post('/:id/command', (req: Request, res: Response): void => {
  const relayId = req.params.id;
  const { action, confirmed, reason, actorId, actorName, actorRole } = req.body;

  if (action !== 'ON' && action !== 'OFF') {
    res.status(400).json({ error: 'Invalid action. Must be "ON" or "OFF".' });
    return;
  }

  if (!confirmed) {
    res.status(400).json({
      error: 'Safety confirmation required: User must explicitly confirm intent to energize/de-energize industrial equipment.'
    });
    return;
  }

  const relay = db.get<any>(
    'SELECT r.*, d.user_name as device_name, d.is_online as device_online, d.id as dev_id FROM relay_devices r JOIN esp_devices d ON r.device_id = d.id WHERE r.id = ?',
    relayId
  );

  if (!relay) {
    res.status(404).json({ error: 'Relay device not found.' });
    return;
  }

  const targetState = action === 'ON' ? 1 : 0;
  const now = new Date().toISOString();
  const operatorName = actorName || 'Facility Operator';
  const role = actorRole || 'Operator';

  // 1. Set status to COMMAND_REQUESTED
  const pendingCmd = `REQUEST_${action}`;
  db.run(
    `UPDATE relay_devices SET
      pending_command = ?,
      command_status = 'COMMAND_REQUESTED',
      command_requested_at = ?,
      command_result = 'Awaiting hardware acknowledgement from ESP32 node...'
    WHERE id = ?`,
    pendingCmd,
    now,
    relayId
  );

  // 2. Record in Audit Log
  const logId = `audit-${uuidv4().slice(0, 8)}`;
  db.run(
    `INSERT INTO audit_logs (id, user_id, facility_id, action, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, 'relay', ?, ?, ?)`,
    logId,
    actorId || 'usr-operator',
    'fac-01',
    `MANUAL_RELAY_${action}`,
    relayId,
    JSON.stringify({
      operator: operatorName,
      role,
      reason: reason || 'Manual control command issued via Agrivault Dashboard',
      target_equipment: relay.target_equipment,
      gpio_pin: relay.gpio_pin,
      device_id: relay.dev_id
    }),
    now
  );

  // 3. Dispatch command to ESP32 via MQTT and WebSocket
  const commandPayload = {
    command: 'SET_RELAY',
    relayId,
    deviceId: relay.dev_id,
    pin: relay.gpio_pin,
    targetState,
    action,
    timestamp: now,
    operator: operatorName
  };

  const directTopic = `agrivault/fac-01/device/${relay.dev_id}/command`;
  publishMqtt(directTopic, commandPayload);

  broadcast('relay_command_dispatched', {
    relayId,
    deviceId: relay.dev_id,
    action,
    targetState,
    status: 'COMMAND_REQUESTED',
    message: `Command "${action}" transmitted to device ${relay.device_name}. Waiting for device ACK.`
  });

  // 4. Set 10-second timeout watchdog in memory: If device doesn't respond, mark COMMAND_TIMED_OUT
  if (pendingTimeouts.has(relayId)) {
    clearTimeout(pendingTimeouts.get(relayId)!);
  }

  const timeoutId = setTimeout(() => {
    const current = db.get<any>('SELECT command_status FROM relay_devices WHERE id = ?', relayId);
    if (current && current.command_status === 'COMMAND_REQUESTED') {
      db.run(
        `UPDATE relay_devices SET
          command_status = 'COMMAND_TIMED_OUT',
          command_result = 'Command not confirmed: ESP32 device did not acknowledge within 10s timeout window.'
        WHERE id = ?`,
        relayId
      );

      broadcast('relay_command_timeout', {
        relayId,
        status: 'COMMAND_TIMED_OUT',
        result: 'Command not confirmed: Hardware timeout'
      });
    }
    pendingTimeouts.delete(relayId);
  }, 10000);

  pendingTimeouts.set(relayId, timeoutId);

  const updated = db.get<RelayDevice>('SELECT * FROM relay_devices WHERE id = ?', relayId);
  res.json({
    success: true,
    message: `Command "${action}" sent to ${relay.device_name}. Awaiting acknowledgement.`,
    relay: updated
  });
});

// POST /api/relays/:id/ack (Device acknowledges command receipt)
router.post('/:id/ack', (req: Request, res: Response): void => {
  const relayId = req.params.id;
  const { deviceId, status = 'OK' } = req.body;
  const now = new Date().toISOString();

  const relay = db.get<RelayDevice>('SELECT * FROM relay_devices WHERE id = ?', relayId);
  if (!relay) {
    res.status(404).json({ error: 'Relay not found' });
    return;
  }

  db.run(
    `UPDATE relay_devices SET
      command_status = 'COMMAND_ACKNOWLEDGED',
      last_acknowledged_at = ?,
      command_result = 'Command acknowledged by firmware, executing hardware pin transition.'
    WHERE id = ?`,
    now,
    relayId
  );

  broadcast('relay_command_acknowledged', {
    relayId,
    deviceId,
    status: 'COMMAND_ACKNOWLEDGED',
    timestamp: now
  });

  res.json({ status: 'ACK_CONFIRMED', relayId });
});

// POST /api/relays/:id/report-state (Device reports confirmed physical state)
router.post('/:id/report-state', (req: Request, res: Response): void => {
  const relayId = req.params.id;
  const { newState, physicalConfirmed = 1 } = req.body;
  const now = new Date().toISOString();

  if (newState === undefined || (newState !== 0 && newState !== 1)) {
    res.status(400).json({ error: 'newState must be 0 or 1' });
    return;
  }

  const current = db.get<RelayDevice>('SELECT * FROM relay_devices WHERE id = ?', relayId);
  if (!current) {
    res.status(404).json({ error: 'Relay not found' });
    return;
  }

  // Clear any pending timeout
  if (pendingTimeouts.has(relayId)) {
    clearTimeout(pendingTimeouts.get(relayId)!);
    pendingTimeouts.delete(relayId);
  }

  db.run(
    `UPDATE relay_devices SET
      state = ?,
      last_confirmed_state = ?,
      command_status = 'STATE_REPORTED',
      pending_command = NULL,
      physical_feedback_confirmed = ?,
      command_result = ?,
      last_switched = ?
    WHERE id = ?`,
    newState,
    newState,
    physicalConfirmed ? 1 : 0,
    `State successfully verified: Relay is ${newState === 1 ? 'ON' : 'OFF'} (Confirmed via firmware GPIO feedback).`,
    now,
    relayId
  );

  // Record action history
  db.run(
    `INSERT INTO relay_actions (id, relay_id, triggered_by, actor_id, previous_state, new_state, reason, created_at)
     VALUES (?, ?, 'firmware_report', 'esp32-node', ?, ?, 'Confirmed state report from microcontroller', ?)`,
    `act-${uuidv4().slice(0, 8)}`,
    relayId,
    current.state,
    newState,
    now
  );

  broadcast('relay_state_reported', {
    relayId,
    newState,
    status: 'STATE_REPORTED',
    physicalConfirmed: !!physicalConfirmed,
    timestamp: now
  });

  const updated = db.get<RelayDevice>('SELECT * FROM relay_devices WHERE id = ?', relayId);
  res.json({ success: true, relay: updated });
});

// GET /api/relays/:id/actions
router.get('/:id/actions', (req: Request, res: Response): void => {
  const relayId = req.params.id;
  const actions = db.all(
    'SELECT * FROM relay_actions WHERE relay_id = ? ORDER BY created_at DESC LIMIT 50',
    relayId
  );
  res.json(actions);
});

export default router;
