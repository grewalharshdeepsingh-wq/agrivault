export interface StorageHealthInsight {
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  potentialCauses: string[];
  recommendedActions: string[];
}

export interface AreaSnapshot {
  temperature?: number;
  humidity?: number;
  co2?: number;
  ethylene?: number;
  ammonia?: number;
  ethanol?: number;
  commodity?: string;
  violations: string[]; // List of parameters currently in violation
}

export interface SingleParameterInterpretation {
  potentialIssue: string;
  recommendedAction: string;
}

/**
 * Returns scientifically responsible operational interpretation for single parameter violations.
 * Strictly adheres to language: "may indicate", "possible cause", "investigate", "potential risk".
 */
export function interpretSingleParameter(
  parameter: string,
  direction: 'high' | 'low',
  commodity = 'General Produce'
): SingleParameterInterpretation {
  const param = parameter.toLowerCase();

  if (param === 'temperature') {
    if (direction === 'high') {
      return {
        potentialIssue: `Temperature is above the configured storage limit for ${commodity}. Cooling system under-performance, doorway ingress, or thermal load may be present. Prolonged elevated temperature can increase deterioration risk.`,
        recommendedAction: 'Inspect refrigeration equipment, check door seals and cold curtains, and ensure unobstructed air circulation around pallet stacks.'
      };
    } else {
      return {
        potentialIssue: `Temperature is below the configured minimum for ${commodity}. Cold air short-cycling or thermostat miscalibration may be exposing the stored product to chilling injury risks.`,
        recommendedAction: 'Check cooling setpoints, verify defrost cycle operation, and ensure stored product is not exposed to direct evaporator fan discharge.'
      };
    }
  }

  if (param === 'humidity') {
    if (direction === 'high') {
      return {
        potentialIssue: 'Humidity is above the configured range. Increased moisture conditions may elevate condensation risk, surface mold, microbial proliferation, or sprout stimulation.',
        recommendedAction: 'Inspect dehumidifier operation, verify ventilation rates, and inspect ceiling/evaporator drip pans for pooling water.'
      };
    } else {
      return {
        potentialIssue: 'Humidity is below the configured target. Dry atmospheric conditions can cause commodity moisture loss, shrinkage, and weight reduction.',
        recommendedAction: 'Verify ultrasonic humidification or spray systems, and check warehouse door cycling to minimize dry air ingress.'
      };
    }
  }

  if (param === 'co2') {
    return {
      potentialIssue: 'Carbon dioxide concentration is above the configured limit. Elevated CO2 may indicate reduced ventilation, stack respiration buildup, or biological activity in the storage vault.',
      recommendedAction: 'Immediate inspection is recommended. Check ventilation dampers, activate air exchange fans, and investigate possible product respiration or burner leaks.'
    };
  }

  if (param === 'ethylene') {
    return {
      potentialIssue: 'Elevated ethylene detected. Ethylene presence may indicate ripening acceleration, sprouting induction, senescence, or early product breakdown depending on commodity sensitivity.',
      recommendedAction: 'Investigate the affected zone for ripening, sprouting, or decaying batches. Consider ethylene scrubbing or air purge cycle, and check separation from ethylene-producing items.'
    };
  }

  if (param === 'ammonia') {
    return {
      potentialIssue: 'Elevated ammonia detected. Condition may indicate an evaporator refrigerant coil leak, organic decomposition, or contamination. Immediate investigation is advised.',
      recommendedAction: 'Perform an immediate perimeter and safety check. Verify technician PPE, inspect refrigeration piping for pinhole leaks, and check commodity condition.'
    };
  }

  if (param === 'ethanol' || param === 'voc') {
    return {
      potentialIssue: 'Elevated ethanol/VOC readings detected. Readouts may indicate anaerobic respiration, initial fermentation, off-flavour development, or product breakdown within dense pallet centers.',
      recommendedAction: 'Investigate the affected storage area for internal hot spots, core pallet rot, or poor internal ventilation. Take sample core temperature and visual inspection.'
    };
  }

  return {
    potentialIssue: `Measured ${parameter} is outside target thresholds. Environmental variation may affect product shelf-life.`,
    recommendedAction: `Inspect sensors in this zone, calibrate readings, and verify environmental control equipment.`
  };
}

/**
 * Storage Health Engine: Multi-Sensor Correlation Analyzer
 * Evaluates combinations of parameters to detect composite operational anomalies.
 */
export function evaluateMultiSensorHealth(snapshot: AreaSnapshot): StorageHealthInsight[] {
  const insights: StorageHealthInsight[] = [];
  const { temperature, humidity, co2, ethylene, ammonia, ethanol, commodity } = snapshot;

  const hasHighTemp = snapshot.violations.includes('temperature_high');
  const hasHighHum = snapshot.violations.includes('humidity_high');
  const hasHighCO2 = snapshot.violations.includes('co2_high');
  const hasHighEthylene = snapshot.violations.includes('ethylene_high');
  const hasHighEthanol = snapshot.violations.includes('ethanol_high');
  const hasHighAmmonia = snapshot.violations.includes('ammonia_high');

  // Rule 1: High Temp + High Humidity + High CO2 -> Spoilage Risk
  if (hasHighTemp && hasHighHum && hasHighCO2) {
    insights.push({
      ruleId: 'MULTI_SPOILAGE_RISK',
      severity: 'critical',
      title: 'Elevated Spoilage Risk (Compound Environmental Anomaly)',
      summary: 'Multiple environmental indicators (Temperature, Humidity, CO2) are simultaneously outside preferred limits.',
      potentialCauses: [
        'Accelerated respiration and biological heat generation within storage stacks',
        'Stagnant micro-climates or blocked air distribution channels',
        'Early fungal or microbial colonization due to warm and humid micro-environment'
      ],
      recommendedActions: [
        'Inspect refrigeration evaporator discharge and verify air throw reaches all pallet rows',
        'Activate forced circulation or exhaust fans to purge accumulated CO2 and heat',
        'Perform physical walk-through and inspect pallet centers for dampness or early decay'
      ]
    });
  }

  // Rule 2: Normal Environmental Conditions + High Ethylene -> Ripening/Sprouting
  if (!hasHighTemp && !hasHighHum && hasHighEthylene) {
    insights.push({
      ruleId: 'ISOLATED_ETHYLENE_SPIKE',
      severity: 'warning',
      title: 'Ethylene Accumulation under Nominal Environment',
      summary: 'Elevated ethylene detected despite normal ambient temperature and humidity.',
      potentialCauses: [
        'Natural physiological ripening or senescence of mature fruit/produce',
        'Sprout emergence in potato or root-vegetable stores',
        'Cross-contamination from adjacent transit bays or forklift exhaust'
      ],
      recommendedActions: [
        'Inspect stored product for softening, colour shifts, or sprout initiation',
        'Check scrubber/adsorption filters if equipped',
        'Ensure proper physical isolation between ripening-sensitive and ethylene-generating commodities'
      ]
    });
  }

  // Rule 3: High Temp + High CO2 + High Ethanol/VOC -> Fermentation / Rot
  if (hasHighTemp && hasHighCO2 && hasHighEthanol) {
    insights.push({
      ruleId: 'FERMENTATION_ROT_INDICATOR',
      severity: 'critical',
      title: 'Potential Anaerobic Fermentation / Deep Stack Rot',
      summary: 'Simultaneous elevation of Temperature, Carbon Dioxide, and Ethanol/VOCs detected.',
      potentialCauses: [
        'Anaerobic respiration or internal bag fermentation occurring in poorly ventilated bulk bins',
        'Deep-stack soft rot (Erwinia/Pectobacterium) producing heat, CO2, and fermentation alcohols',
        'Severe airflow restriction starving internal boxes of oxygen'
      ],
      recommendedActions: [
        'Prioritize physical inspection of central stack boxes immediately',
        'Measure core temperature with handheld needle probe in suspect bins',
        'Segregate any leaking or softening produce batches before secondary spread occurs'
      ]
    });
  }

  // Rule 4: Ammonia Elevation + Temperature Rise -> Refrigerant Heat Exchange Leak
  if (hasHighAmmonia && hasHighTemp) {
    insights.push({
      ruleId: 'REFRIGERANT_AMMONIA_LEAK_THERMAL',
      severity: 'critical',
      title: 'Possible Ammonia Refrigerant Leak & Cooling Loss',
      summary: 'Elevated ammonia vapor coupled with rising temperature indicates possible refrigeration circuit breach.',
      potentialCauses: [
        'Refrigerant gas leak in evaporator coils or solenoid valve seals',
        'Loss of refrigeration capacity caused by low refrigerant charge'
      ],
      recommendedActions: [
        'Isolate the refrigeration circuit to this evaporator immediately',
        'Ensure personnel evacuate the zone if ammonia levels approach occupational limits',
        'Engage certified HVAC/ammonia technicians for pressure testing and leak detection'
      ]
    });
  }

  // Rule 5: High CO2 + High Ethanol (normal temp) -> Stale Atmosphere Respiration
  if (!hasHighTemp && hasHighCO2 && hasHighEthanol) {
    insights.push({
      ruleId: 'ATMOSPHERE_STAGNATION',
      severity: 'warning',
      title: 'Vault Atmosphere Stagnation & VOC Buildup',
      summary: 'Elevated CO2 and VOC readings detected while temperature remains within target bounds.',
      potentialCauses: [
        'Closed dampers preventing necessary fresh air renewal during produce respiration',
        'Localized off-gassing from shipping packaging or pallet lumber'
      ],
      recommendedActions: [
        'Initiate controlled fresh-air purge cycle',
        'Verify damper actuator feedback and timer controls'
      ]
    });
  }

  return insights;
}
