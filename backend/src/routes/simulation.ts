import { Router, Request, Response } from 'express';
import { virtualFleet, SimulationScenario } from '../simulator/virtualFleet.js';
import { gatewayManager } from '../hardware/gatewayManager.js';
import { broadcast } from '../websocket/wsServer.js';

const router = Router();

// GET /api/simulation/status
router.get('/status', (req: Request, res: Response): void => {
  const status = virtualFleet.getStatus();
  res.json(status);
});

// GET /api/simulation/nodes
router.get('/nodes', (req: Request, res: Response): void => {
  res.json(virtualFleet.getNodes());
});

// POST /api/simulation/scenario
router.post('/scenario', (req: Request, res: Response): void => {
  const { scenario } = req.body;
  const validScenarios: SimulationScenario[] = [
    'normal',
    'temp_spike',
    'humidity_spike',
    'co2_spike',
    'gas_anomaly_mq3',
    'gas_anomaly_mq135',
    'gas_anomaly_ethylene',
    'gas_anomaly_ammonia',
    'gas_anomaly_ethanol',
    'multi_anomaly',
    'sensor_offline',
    'gateway_offline',
    'internet_offline',
    'wired_link_offline'
  ];

  if (!scenario || !validScenarios.includes(scenario)) {
    res.status(400).json({
      error: `Invalid scenario. Allowed scenarios: [${validScenarios.join(', ')}]`
    });
    return;
  }

  virtualFleet.setScenario(scenario);
  broadcast('simulation_scenario_changed', { scenario });

  res.json({
    success: true,
    scenario,
    status: virtualFleet.getStatus()
  });
});

// POST /api/simulation/toggle
router.post('/toggle', (req: Request, res: Response): void => {
  const { enabled } = req.body;
  if (enabled) {
    virtualFleet.start();
  } else {
    virtualFleet.stop();
  }
  const status = virtualFleet.getStatus();
  broadcast('simulation_toggled', status);
  res.json({ success: true, status });
});

// POST /api/simulation/node/toggle
// Disconnects / reconnects a specific node
router.post('/node/toggle', (req: Request, res: Response): void => {
  const { deviceId, offline } = req.body;
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId is required' });
    return;
  }
  virtualFleet.toggleNodeOffline(deviceId, Boolean(offline));
  res.json({ success: true, deviceId, offline: Boolean(offline) });
});

// POST /api/simulation/network-failure
// Test Internet or RS-485 failure and verify buffering
router.post('/network-failure', (req: Request, res: Response): void => {
  const { failureType, isFailed } = req.body;
  // failureType: 'internet' | 'wired_link' | 'inner_gateway'

  if (failureType === 'internet') {
    gatewayManager.setInternetStatus(!isFailed);
  } else if (failureType === 'wired_link') {
    gatewayManager.setWiredLinkStatus(isFailed ? 'disconnected' : 'connected');
  } else if (failureType === 'inner_gateway') {
    gatewayManager.setInnerGatewayStatus(!isFailed);
  }

  res.json({
    success: true,
    failureType,
    isFailed: Boolean(isFailed),
    topology: gatewayManager.getTopology()
  });
});

export default router;
