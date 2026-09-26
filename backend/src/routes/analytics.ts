import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';

const router = Router();

// GET /api/analytics/summary
// Comprehensive statistical metrics and comparative trends across rooms
router.get('/summary', (req: Request, res: Response): void => {
  const period = (req.query.period as string) || '24h';
  const selectedAreaId = req.query.areaId as string;

  let timeFilter = "datetime('now', '-24 hours')";
  let timeGroupFormat = '%H:00';

  if (period === '1h') {
    timeFilter = "datetime('now', '-1 hour')";
    timeGroupFormat = '%H:%M';
  } else if (period === '6h') {
    timeFilter = "datetime('now', '-6 hours')";
    timeGroupFormat = '%H:%M';
  } else if (period === '24h') {
    timeFilter = "datetime('now', '-24 hours')";
    timeGroupFormat = '%H:00';
  } else if (period === '7d') {
    timeFilter = "datetime('now', '-7 days')";
    timeGroupFormat = '%m-%d';
  } else if (period === '30d') {
    timeFilter = "datetime('now', '-30 days')";
    timeGroupFormat = '%m-%d';
  }

  // 1. Fetch areas
  let areas = db.all<any>('SELECT * FROM areas ORDER BY name ASC');
  if (selectedAreaId) {
    areas = areas.filter(a => a.id === selectedAreaId);
  }

  // 2. Compute statistics for each room / section
  const roomStats = areas.map(area => {
    const devices = db.all<any>(
      'SELECT id, user_name, is_online, hardware_type, ip_address, signal_rssi, last_heartbeat FROM esp_devices WHERE area_id = ?',
      area.id
    );

    const params = ['temperature', 'humidity', 'co2', 'ammonia', 'ethanol'];
    const metrics: Record<string, any> = {};

    for (const p of params) {
      const readings = db.all<{ calibrated_value: number; recorded_at: string }>(
        `SELECT calibrated_value, recorded_at FROM sensor_readings
         WHERE area_id = ? AND sensor_type = ? AND recorded_at >= ${timeFilter}
         ORDER BY recorded_at ASC`,
        area.id, p
      );

      const vals = readings.map(r => r.calibrated_value);
      if (vals.length > 0) {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = +(sum / vals.length).toFixed(2);

        // Standard deviation
        const variance = vals.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / vals.length;
        const stdDev = +Math.sqrt(variance).toFixed(2);
        const current = vals[vals.length - 1];

        // Stability index: percentage of readings staying within standard tolerance band
        const tolerance = p === 'temperature' ? 0.8 : p === 'humidity' ? 3.0 : 50;
        const stableCount = vals.filter(v => Math.abs(v - avg) <= tolerance).length;
        const stabilityScore = Math.min(100, Math.round((stableCount / vals.length) * 100));

        metrics[p] = {
          min,
          max,
          avg,
          stdDev,
          current,
          stabilityScore,
          sampleCount: vals.length
        };
      } else {
        metrics[p] = null;
      }
    }

    return {
      areaId: area.id,
      name: area.name,
      commodity: area.commodity,
      health_score: area.health_score,
      health_status: area.health_status,
      devices,
      deviceCount: devices.length,
      onlineDeviceCount: devices.filter(d => d.is_online === 1).length,
      metrics
    };
  });

  // 3. Overall facility KPI aggregates
  const totalReadings = db.get<{ count: number }>(`SELECT count(*) as count FROM sensor_readings WHERE recorded_at >= ${timeFilter}`)?.count || 0;
  const activeAlerts = db.get<{ count: number }>("SELECT count(*) as count FROM alerts WHERE status IN ('active', 'acknowledged')")?.count || 0;
  const totalESPs = db.get<{ count: number }>('SELECT count(*) as count FROM esp_devices')?.count || 0;
  const onlineESPs = db.get<{ count: number }>('SELECT count(*) as count FROM esp_devices WHERE is_online = 1')?.count || 0;

  // 4. Comparative Time-Series trend data (Aggregated by hour/day for graphing)
  const timeSeries = db.all<any>(
    `SELECT strftime('${timeGroupFormat}', recorded_at) as timestamp, area_id, sensor_type, ROUND(AVG(calibrated_value), 2) as val
     FROM sensor_readings
     WHERE recorded_at >= ${timeFilter}
     GROUP BY timestamp, area_id, sensor_type
     ORDER BY recorded_at ASC`
  );

  res.json({
    period,
    totalReadings,
    activeAlerts,
    totalESPs,
    onlineESPs,
    roomStats,
    timeSeries
  });
});

export default router;
