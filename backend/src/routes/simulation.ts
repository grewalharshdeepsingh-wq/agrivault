import { Router, Request, Response } from 'express';
import { virtualFleet, SimulationScenario } from '../simulator/virtualFleet.js';
import { broadcast } from '../websocket/wsServer.js';

const router = Router();

// GET /api/simulation/status
router.get('/status', (req: Request, res: Response): void => {
  const status = virtualFleet.getStatus();
  res.json(status);
});

// POST /api/simulation/scenario
router.post('/scenario', (req: Request, res: Response): void => {
  const { scenario } = req.body;
  const validScenarios: SimulationScenario[] = [
    'normal',
    'temp_spike',
    'humidity_spike',
    'co2_spike',
    'gas_anomaly_ethylene',
    'gas_anomaly_ammonia',
    'gas_anomaly_ethanol',
    'multi_anomaly',
    'sensor_offline',
    'gateway_offline'
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

export default router;
