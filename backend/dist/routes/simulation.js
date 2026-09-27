"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const virtualFleet_js_1 = require("../simulator/virtualFleet.js");
const wsServer_js_1 = require("../websocket/wsServer.js");
const router = (0, express_1.Router)();
// GET /api/simulation/status
router.get('/status', (req, res) => {
    const status = virtualFleet_js_1.virtualFleet.getStatus();
    res.json(status);
});
// POST /api/simulation/scenario
router.post('/scenario', (req, res) => {
    const { scenario } = req.body;
    const validScenarios = [
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
    virtualFleet_js_1.virtualFleet.setScenario(scenario);
    (0, wsServer_js_1.broadcast)('simulation_scenario_changed', { scenario });
    res.json({
        success: true,
        scenario,
        status: virtualFleet_js_1.virtualFleet.getStatus()
    });
});
// POST /api/simulation/toggle
router.post('/toggle', (req, res) => {
    const { enabled } = req.body;
    if (enabled) {
        virtualFleet_js_1.virtualFleet.start();
    }
    else {
        virtualFleet_js_1.virtualFleet.stop();
    }
    const status = virtualFleet_js_1.virtualFleet.getStatus();
    (0, wsServer_js_1.broadcast)('simulation_toggled', status);
    res.json({ success: true, status });
});
exports.default = router;
