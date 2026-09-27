"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../database/db.js");
const router = (0, express_1.Router)();
// GET /api/reports/generate
router.get('/generate', (req, res) => {
    const { facilityId = 'fac-01', areaId, period = '24h' } = req.query;
    let timeFilter = "datetime('now', '-24 hours')";
    let periodLabel = 'Last 24 Hours';
    if (period === '1h') {
        timeFilter = "datetime('now', '-1 hour')";
        periodLabel = 'Last 1 Hour';
    }
    else if (period === '6h') {
        timeFilter = "datetime('now', '-6 hours')";
        periodLabel = 'Last 6 Hours';
    }
    else if (period === '24h') {
        timeFilter = "datetime('now', '-24 hours')";
        periodLabel = 'Last 24 Hours';
    }
    else if (period === '7d') {
        timeFilter = "datetime('now', '-7 days')";
        periodLabel = 'Last 7 Days';
    }
    else if (period === '30d') {
        timeFilter = "datetime('now', '-30 days')";
        periodLabel = 'Last 30 Days';
    }
    // Target areas
    let areasToReport = [];
    if (areaId) {
        const singleArea = db_js_1.db.get('SELECT * FROM areas WHERE id = ?', areaId);
        if (singleArea)
            areasToReport = [singleArea];
    }
    else {
        areasToReport = db_js_1.db.all('SELECT * FROM areas WHERE facility_id = ?', facilityId);
    }
    const reports = areasToReport.map(area => {
        // 1. Fetch readings
        const readings = db_js_1.db.all(`SELECT sensor_type, calibrated_value, unit, recorded_at
       FROM sensor_readings
       WHERE area_id = ? AND recorded_at >= ${timeFilter}
       ORDER BY recorded_at ASC`, area.id);
        // Group by parameter
        const params = ['temperature', 'humidity', 'co2', 'ethylene', 'ammonia', 'ethanol'];
        const summary = {};
        for (const p of params) {
            const pReadings = readings.filter(r => r.sensor_type === p).map(r => r.calibrated_value);
            if (pReadings.length > 0) {
                const min = Math.min(...pReadings);
                const max = Math.max(...pReadings);
                const avg = +(pReadings.reduce((a, b) => a + b, 0) / pReadings.length).toFixed(2);
                const current = pReadings[pReadings.length - 1];
                const unit = p === 'temperature' ? '°C' : p === 'humidity' ? '%' : 'ppm';
                summary[p] = { min, max, avg, current, unit, sampleCount: pReadings.length };
            }
        }
        // 2. Fetch threshold violation excursions & events
        const excursions = db_js_1.db.all(`SELECT parameter, severity, measured_value, threshold_value, created_at, resolved_at
       FROM alerts
       WHERE area_id = ? AND created_at >= ${timeFilter}
       ORDER BY created_at DESC`, area.id);
        // 3. Automated Executive Intelligence Synthesis
        const concerns = [];
        const recommendedActions = [];
        const tempExcursions = excursions.filter(e => e.parameter === 'temperature').length;
        const co2Excursions = excursions.filter(e => e.parameter === 'co2').length;
        const humExcursions = excursions.filter(e => e.parameter === 'humidity').length;
        const gasExcursions = excursions.filter(e => ['ammonia', 'ethanol', 'ethylene'].includes(e.parameter)).length;
        if (tempExcursions > 0) {
            concerns.push(`Temperature deviated from configured threshold ${tempExcursions} time(s). Prolonged thermal excursions increase product respiration and dormancy loss.`);
            recommendedActions.push('Inspect refrigeration cycling, evaporator fan distribution, and door seal integrity.');
        }
        if (co2Excursions > 0) {
            concerns.push(`CO2 exceeded limit ${co2Excursions} time(s). Indicates potential stack respiration buildup or insufficient fresh-air exchange.`);
            recommendedActions.push('Review ventilation damper actuator timing and verify exhaust fan operation.');
        }
        if (humExcursions > 0) {
            concerns.push(`Humidity excursions detected (${humExcursions} events). Elevated humidity may stimulate superficial mold or sprout initiation.`);
            recommendedActions.push('Ensure ceiling drip pans drain freely and verify humidity controls.');
        }
        if (gasExcursions > 0) {
            concerns.push(`Volatile trace gas events recorded (${gasExcursions} events). May indicate localized ripening or early biological activity.`);
            recommendedActions.push('Conduct physical inspection of interior pallet stacks.');
        }
        if (concerns.length === 0) {
            concerns.push('Storage environment remained entirely within target specifications throughout this reporting period.');
            recommendedActions.push('Maintain regular preventative maintenance inspection schedule.');
        }
        return {
            areaId: area.id,
            areaName: area.name,
            commodity: area.commodity,
            healthStatus: area.health_status,
            healthScore: area.health_score,
            period: periodLabel,
            parameters: summary,
            excursionCount: excursions.length,
            eventsSummary: [
                tempExcursions > 0 ? `Temperature exceeded limit ${tempExcursions} times` : 'Temperature remained nominal',
                co2Excursions > 0 ? `CO2 concentration elevated ${co2Excursions} times` : 'CO2 levels nominal',
                humExcursions > 0 ? `Humidity exceeded range ${humExcursions} times` : 'Humidity held within range'
            ],
            possibleConcerns: concerns,
            recommendedActions
        };
    });
    res.json({
        facilityId,
        generatedAt: new Date().toISOString(),
        period: periodLabel,
        areasReport: reports
    });
});
// GET /api/reports/export (CSV export)
router.get('/export', (req, res) => {
    const { areaId, period = '24h', format = 'csv' } = req.query;
    let timeFilter = "datetime('now', '-24 hours')";
    if (period === '1h')
        timeFilter = "datetime('now', '-1 hour')";
    if (period === '6h')
        timeFilter = "datetime('now', '-6 hours')";
    if (period === '7d')
        timeFilter = "datetime('now', '-7 days')";
    if (period === '30d')
        timeFilter = "datetime('now', '-30 days')";
    let sql = `
    SELECT r.recorded_at, a.name as area_name, a.commodity, d.user_name as device_name,
           r.sensor_type, r.calibrated_value, r.raw_value, r.unit, r.is_simulation
    FROM sensor_readings r
    JOIN areas a ON r.area_id = a.id
    JOIN esp_devices d ON r.device_id = d.id
    WHERE r.recorded_at >= ${timeFilter}
  `;
    const params = [];
    if (areaId) {
        sql += ' AND r.area_id = ?';
        params.push(areaId);
    }
    sql += ' ORDER BY r.recorded_at DESC LIMIT 5000';
    const rows = db_js_1.db.all(sql, ...params);
    if (format === 'json') {
        res.json(rows);
        return;
    }
    // Format as CSV
    let csv = 'Timestamp,Area,Commodity,Device,Sensor_Type,Calibrated_Value,Raw_Value,Unit,Is_Simulation\n';
    for (const row of rows) {
        csv += `"${row.recorded_at}","${row.area_name}","${row.commodity}","${row.device_name}","${row.sensor_type}",${row.calibrated_value},${row.raw_value},"${row.unit}",${row.is_simulation}\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="agrivault-report-${Date.now()}.csv"`);
    res.send(csv);
});
exports.default = router;
