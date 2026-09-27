"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../database/db.js");
const router = (0, express_1.Router)();
// GET /api/sensors/:id
router.get('/:id', (req, res) => {
    const sensorId = req.params.id;
    const sensor = db_js_1.db.get(`SELECT s.*, d.user_name as device_name, d.ip_address, a.name as area_name
     FROM sensors s
     JOIN esp_devices d ON s.device_id = d.id
     LEFT JOIN areas a ON s.area_id = a.id
     WHERE s.id = ?`, sensorId);
    if (!sensor) {
        res.status(404).json({ error: 'Sensor not found' });
        return;
    }
    // Get active threshold for this sensor
    const threshold = db_js_1.db.get(`SELECT * FROM thresholds
     WHERE (scope_type = 'sensor' AND scope_id = ?)
        OR (scope_type = 'device' AND scope_id = ?)
        OR (scope_type = 'area' AND scope_id = ?)
        OR (scope_type = 'facility')
     ORDER BY CASE scope_type
        WHEN 'sensor' THEN 1
        WHEN 'device' THEN 2
        WHEN 'area' THEN 3
        WHEN 'facility' THEN 4
     END LIMIT 1`, sensorId, sensor.device_id, sensor.area_id);
    res.json({
        ...sensor,
        threshold: threshold || null
    });
});
// GET /api/sensors/:id/history
// Returns downsampled / aggregated time-series graph points
router.get('/:id/history', (req, res) => {
    const sensorId = req.params.id;
    const period = req.query.period || '24h';
    let timeFilter = "datetime('now', '-24 hours')";
    let intervalBucketMinutes = 15;
    if (period === '1h') {
        timeFilter = "datetime('now', '-1 hour')";
        intervalBucketMinutes = 1;
    }
    else if (period === '6h') {
        timeFilter = "datetime('now', '-6 hours')";
        intervalBucketMinutes = 5;
    }
    else if (period === '24h') {
        timeFilter = "datetime('now', '-24 hours')";
        intervalBucketMinutes = 15;
    }
    else if (period === '7d') {
        timeFilter = "datetime('now', '-7 days')";
        intervalBucketMinutes = 60;
    }
    else if (period === '30d') {
        timeFilter = "datetime('now', '-30 days')";
        intervalBucketMinutes = 240; // 4 hours
    }
    // Fetch readings
    const rawPoints = db_js_1.db.all(`SELECT calibrated_value, raw_value, recorded_at, is_simulation
     FROM sensor_readings
     WHERE sensor_id = ? AND recorded_at >= ${timeFilter}
     ORDER BY recorded_at ASC`, sensorId);
    // If there are too many raw points, downsample them into neat visual buckets
    let dataPoints = rawPoints;
    if (rawPoints.length > 150) {
        const step = Math.ceil(rawPoints.length / 100);
        dataPoints = rawPoints.filter((_, idx) => idx % step === 0);
    }
    // Calculate statistics: min, max, avg, current, rate of change
    const values = rawPoints.map(p => p.calibrated_value);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    const avg = values.length > 0 ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0;
    const current = values.length > 0 ? values[values.length - 1] : 0;
    const first = values.length > 0 ? values[0] : 0;
    const rateOfChange = +(current - first).toFixed(2);
    res.json({
        sensorId,
        period,
        stats: {
            min,
            max,
            avg,
            current,
            rateOfChange,
            totalSamples: rawPoints.length
        },
        data: dataPoints.map(p => ({
            time: p.recorded_at,
            value: p.calibrated_value,
            raw: p.raw_value,
            isSimulation: p.is_simulation === 1
        }))
    });
});
// POST /api/sensors/:id/calibrate
router.post('/:id/calibrate', (req, res) => {
    const sensorId = req.params.id;
    const { offset, referenceReading } = req.body;
    const sensor = db_js_1.db.get('SELECT * FROM sensors WHERE id = ?', sensorId);
    if (!sensor) {
        res.status(404).json({ error: 'Sensor not found' });
        return;
    }
    const now = new Date().toISOString();
    let newCalibrated = sensor.calibrated_reading;
    if (referenceReading !== undefined) {
        newCalibrated = parseFloat(referenceReading);
    }
    else if (offset !== undefined) {
        newCalibrated += parseFloat(offset);
    }
    db_js_1.db.run(`UPDATE sensors SET
      calibrated_reading = ?,
      calibration_status = 'calibrated',
      calibration_date = ?,
      confidence_score = 98.0
    WHERE id = ?`, newCalibrated, now, sensorId);
    const updated = db_js_1.db.get('SELECT * FROM sensors WHERE id = ?', sensorId);
    res.json({
        success: true,
        message: 'Sensor calibrated successfully',
        sensor: updated
    });
});
exports.default = router;
