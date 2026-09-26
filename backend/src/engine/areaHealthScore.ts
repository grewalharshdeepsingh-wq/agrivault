import { HealthStatus } from '../models/types.js';

export interface AreaScoreResult {
  score: number; // 0.0 - 100.0
  status: HealthStatus;
  reasons: string[];
}

export interface MetricEvaluationInput {
  parameter: string;
  name: string;
  value: number;
  min: number | null;
  max: number | null;
  warningMin: number | null;
  warningMax: number | null;
  rateOfChange: number;
  rateOfChangePeriod: string;
  unit: string;
  sensorHealth: string;
  confidenceScore: number;
}

/**
 * Calculates a rigorous mathematical Area Health Score based on:
 * - Active threshold violations (critical penalty: -25 to -35, warning penalty: -10 to -15)
 * - Rate of change penalty (rapid adverse changes deduct up to -10)
 * - Sensor reliability/confidence factor
 * - Multi-parameter compound penalties
 */
export function calculateAreaHealthScore(metrics: MetricEvaluationInput[]): AreaScoreResult {
  let score = 100.0;
  const reasons: string[] = [];
  let criticalCount = 0;
  let warningCount = 0;

  for (const m of metrics) {
    const val = m.value;
    const unit = m.unit;

    // Check Critical Violations (Min / Max)
    if (m.max !== null && val > m.max) {
      criticalCount++;
      const diff = +(val - m.max).toFixed(2);
      score -= 28.0;
      reasons.push(`${m.name} is ${diff} ${unit} above configured maximum (${m.max} ${unit})`);
    } else if (m.min !== null && val < m.min) {
      criticalCount++;
      const diff = +(m.min - val).toFixed(2);
      score -= 28.0;
      reasons.push(`${m.name} is ${diff} ${unit} below configured minimum (${m.min} ${unit})`);
    } 
    // Check Warning Thresholds
    else if (m.warningMax !== null && val > m.warningMax) {
      warningCount++;
      const diff = +(val - m.warningMax).toFixed(2);
      score -= 12.0;
      reasons.push(`${m.name} is slightly elevated (+${diff} ${unit} above warning threshold)`);
    } else if (m.warningMin !== null && val < m.warningMin) {
      warningCount++;
      const diff = +(m.warningMin - val).toFixed(2);
      score -= 12.0;
      reasons.push(`${m.name} is approaching lower boundary (-${diff} ${unit} below warning threshold)`);
    }

    // Rate of change checks
    if (m.parameter === 'temperature' && Math.abs(m.rateOfChange) >= 0.8) {
      score -= 8.0;
      reasons.push(`Temperature ${m.rateOfChange > 0 ? 'increasing rapidly' : 'dropping rapidly'} (${m.rateOfChange > 0 ? '+' : ''}${m.rateOfChange} ${unit} over ${m.rateOfChangePeriod})`);
    }
    if (m.parameter === 'co2' && m.rateOfChange >= 80) {
      score -= 7.0;
      reasons.push(`CO2 concentration rising sharply (+${m.rateOfChange} ppm over ${m.rateOfChangePeriod})`);
    }
    if (m.parameter === 'ethylene' && m.rateOfChange >= 0.03) {
      score -= 10.0;
      reasons.push(`Ethylene emissions accelerating (+${m.rateOfChange} ppm)`);
    }

    // Sensor health & confidence deduction
    if (m.sensorHealth === 'degraded' || m.confidenceScore < 70) {
      score -= 5.0;
      reasons.push(`${m.name} sensor indicates reduced confidence (${Math.round(m.confidenceScore)}%)`);
    }
  }

  // Compound penalty if 3 or more parameters affected
  if (criticalCount + warningCount >= 3) {
    score -= 15.0;
    reasons.push('Multiple environmental parameters simultaneously deviating from setpoint');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  // Determine Categorical Status
  let status: HealthStatus = 'normal';
  if (score < 50 || criticalCount >= 2) {
    status = 'critical';
  } else if (score < 70 || criticalCount === 1) {
    status = 'warning';
  } else if (score < 88 || warningCount >= 1) {
    status = 'attention';
  } else {
    status = 'normal';
    if (reasons.length === 0) {
      reasons.push('All environmental parameters within optimal target boundaries');
      reasons.push('Sensors functioning nominally with high signal confidence');
    }
  }

  return {
    score,
    status,
    reasons
  };
}
