import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { CropProfile } from '../models/types.js';

const router = Router();

export interface RiskAdviceItem {
  id: string;
  facility_id: string;
  facility_name: string;
  area_id: string;
  area_name: string;
  crop_name: string;
  crop_profile?: CropProfile;
  detected_condition: string;
  parameter: string;
  actual_value: number | null;
  unit: string;
  target_value: number | null;
  limit_min: number | null;
  limit_max: number | null;
  deviation_description: string;
  severity: 'normal' | 'attention' | 'warning' | 'critical';
  why_it_matters: string;
  possible_explanations: string[];
  what_to_check_first: string[];
  recommended_actions: string[];
  post_verification: string[];
  safety_precautions: string[];
  rule_reference: string;
  scientific_source: string;
  data_quality_notes: string;
  evaluated_at: string;
}

// GET /api/risk-advisor
router.get('/', (req: Request, res: Response): void => {
  const { facilityId } = req.query;

  let areaSql = 'SELECT a.*, f.name as facility_name FROM areas a JOIN facilities f ON a.facility_id = f.id WHERE 1=1';
  const params: any[] = [];
  if (facilityId) {
    areaSql += ' AND a.facility_id = ?';
    params.push(facilityId);
  }

  const areas = db.all<any>(areaSql, ...params);
  const adviceList: RiskAdviceItem[] = [];

  for (const area of areas) {
    // 1. Fetch Crop Profile
    let crop: CropProfile | undefined = undefined;
    if (area.crop_profile_id) {
      crop = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE id = ?', area.crop_profile_id);
    }
    if (!crop) {
      // Find matching crop by commodity name or fallback to Potato processing
      crop = db.get<CropProfile>('SELECT * FROM crop_profiles WHERE name LIKE ? LIMIT 1', `%${area.commodity || 'Potato'}%`) ||
             db.get<CropProfile>('SELECT * FROM crop_profiles LIMIT 1');
    }

    // 2. Fetch connected devices and sensors for this area
    const devices = db.all<any>('SELECT * FROM esp_devices WHERE area_id = ?', area.id);
    const sensors = db.all<any>('SELECT * FROM sensors WHERE area_id = ?', area.id);

    // 3. Check for offline devices in this area
    const offlineDevs = devices.filter(d => d.is_online === 0);
    if (offlineDevs.length > 0) {
      adviceList.push({
        id: `risk-off-${area.id}`,
        facility_id: area.facility_id,
        facility_name: area.facility_name,
        area_id: area.id,
        area_name: area.name,
        crop_name: crop?.name || area.commodity,
        crop_profile: crop,
        detected_condition: `Telemetry Offline: ${offlineDevs.length} sensor node(s) not transmitting`,
        parameter: 'connectivity',
        actual_value: null,
        unit: 'nodes',
        target_value: devices.length,
        limit_min: devices.length,
        limit_max: devices.length,
        deviation_description: `${offlineDevs.map(d => d.user_name || d.id).join(', ')} failed heartbeat window (>60s)`,
        severity: 'warning',
        why_it_matters: 'Current environmental conditions cannot be verified from disconnected devices. Micro-climates, rapid temperature rise, or humidity stratification can occur undetected within unmonitored zones.',
        possible_explanations: [
          'Power disruption to sensor node (check 5V/3.3V power supply).',
          'Facility Wi-Fi router drop or change in network credentials.',
          'Gateway link interruption or RS-485 bus communication fault.',
          'Radio signal attenuation due to heavy steel racking or high moisture pallet shielding.'
        ],
        what_to_check_first: [
          'Verify physical power LED on the affected ESP32 nodes.',
          'Check RSSI signal strength history on the Device Diagnostics page.',
          'Verify if the Central Gateway is online and reporting healthy WAN status.'
        ],
        recommended_actions: [
          'Inspect physical power connections at the storage zone rack.',
          'If Wi-Fi network credentials were changed, utilize the ESP32 Wi-Fi Setup Access Point (Agrivault-Setup-XXXXXX) or press BOOT button for 5s to reconfigure.',
          'Deploy secondary mesh repeaters if node is placed deep within insulated cold store interior.'
        ],
        post_verification: [
          'Confirm device state changes to ONLINE on Agrivault Device Diagnostics.',
          'Verify first packet contains non-stale timestamps before relying on readings.'
        ],
        safety_precautions: [
          'Do NOT climb high pallet racking without proper fall-arrest harness equipment.'
        ],
        rule_reference: 'RULE-NET-01 (Continuous Sensory Telemetry Invariance)',
        scientific_source: 'Agrivault Zero-Fabrication Integrity Standard',
        data_quality_notes: 'Missing telemetry. Status cannot be verified until node reconnects.',
        evaluated_at: new Date().toISOString()
      });
    }

    // 4. Check Temperature Sensors
    const tempSensors = sensors.filter(s => s.sensor_type === 'temperature');
    for (const ts of tempSensors) {
      const val = ts.calibrated_reading ?? ts.raw_reading;
      if (val === null || val === undefined) continue;

      if (crop && val > crop.max_temp) {
        const excess = (val - crop.max_temp).toFixed(1);
        adviceList.push({
          id: `risk-temp-hi-${ts.id}`,
          facility_id: area.facility_id,
          facility_name: area.facility_name,
          area_id: area.id,
          area_name: area.name,
          crop_name: crop.name,
          crop_profile: crop,
          detected_condition: `High Temperature Violation (${val}°C)`,
          parameter: 'temperature',
          actual_value: val,
          unit: '°C',
          target_value: crop.target_temp,
          limit_min: crop.min_temp,
          limit_max: crop.max_temp,
          deviation_description: `Temperature is ${excess}°C above maximum safe threshold (${crop.max_temp}°C).`,
          severity: val > (crop.max_temp + 2.5) ? 'critical' : 'warning',
          why_it_matters: `In ${crop.name}, elevated temperatures increase cellular respiration rates exponentially (Q10 factor of 2.0-2.5). This causes rapid weight loss, accelerated physiological aging, premature sprouting, and creates optimal growth temperatures for fungal storage pathogens (e.g. Fusarium, Phytophthora).`,
          possible_explanations: [
            'Refrigeration unit compressor tripped or refrigerant charge low.',
            'Evaporator coils iced over, blocking chilled air circulation.',
            'Facility loading dock or air-lock doors left open during forklift movement.',
            'Airflow duct damper mechanically stuck in bypass position.',
            'Local heat source or sensor probe dislodged against heating pipe.'
          ],
          what_to_check_first: [
            'Inspect refrigeration control panel for high-pressure or compressor trip alarms.',
            'Check evaporator coil frost accumulation and defrost cycle timer.',
            'Confirm physical placement of sensor probe (ensure it is immersed in pile airflow).'
          ],
          recommended_actions: [
            'Trigger manual defrost cycle if coil is choked with ice.',
            'Inspect secondary refrigeration stage and ensure suction line pressure is normal.',
            'Keep cold store loading doors shut and verify curtain seals.',
            'Increase recirculation fan speed to homogenize pile temperature.'
          ],
          post_verification: [
            'Observe pull-down rate over the next 60 minutes. Temperature should decline steadily at ≥0.4°C per hour.',
            'Verify that relative humidity remains above the target range during rapid chilling to prevent tuber moisture dehydration.'
          ],
          safety_precautions: [
            'Ensure adequate ventilation before entering refrigerated machinery rooms.',
            'Check for refrigerant leak alarms if compressor pressure is abnormal.'
          ],
          rule_reference: 'RULE-TEMP-HIGH (Excess Thermal Respiration)',
          scientific_source: crop.sources || 'USDA Agricultural Handbook 66',
          data_quality_notes: `Sensor: ${ts.name} (${ts.calibration_status}). Confirmed non-stale reading.`,
          evaluated_at: new Date().toISOString()
        });
      } else if (crop && val < crop.min_temp) {
        const deficit = (crop.min_temp - val).toFixed(1);
        adviceList.push({
          id: `risk-temp-lo-${ts.id}`,
          facility_id: area.facility_id,
          facility_name: area.facility_name,
          area_id: area.id,
          area_name: area.name,
          crop_name: crop.name,
          crop_profile: crop,
          detected_condition: `Chilling / Low Temperature Violation (${val}°C)`,
          parameter: 'temperature',
          actual_value: val,
          unit: '°C',
          target_value: crop.target_temp,
          limit_min: crop.min_temp,
          limit_max: crop.max_temp,
          deviation_description: `Temperature is ${deficit}°C below minimum safe threshold (${crop.min_temp}°C).`,
          severity: val < 0.0 ? 'critical' : 'warning',
          why_it_matters: `Temperatures below ${crop.min_temp}°C induce chilling injury or Cold-Induced Sweetening (CIS). In potatoes, CIS triggers invertase enzymes that break starches into reducing sugars, ruining frying quality. In chilling-sensitive fruits, below-target cold causes internal browning, flesh breakdown, and cell rupture.`,
          possible_explanations: [
            'Refrigeration thermostat sensor calibration error or stuck relay.',
            'Winter exterior ambient air infiltration through faulty fresh air louvers.',
            'Direct impingement of evaporator discharge air onto produce.'
          ],
          what_to_check_first: [
            'Check refrigeration thermostat setpoint and motorized fresh air intake louvers.',
            'Verify whether discharge air temperature is falling below 0°C.'
          ],
          recommended_actions: [
            'Modulate refrigeration throttle or cycle off cooling compressor.',
            'Close outdoor economizer louvers if ambient temperature is sub-zero.',
            'Cycle ventilation fans to redistribute ambient vault heat without chilling.'
          ],
          post_verification: [
            'Verify temperature recovers into safe holding band (between ' + crop.min_temp + '°C and ' + crop.max_temp + '°C).',
            'Perform sugar/cutting check on representative tuber samples if cold exposure lasted >48 hours.'
          ],
          safety_precautions: [
            'Prevent ice formation on warehouse walkways and loading ramps.'
          ],
          rule_reference: 'RULE-TEMP-LOW (Chilling Injury & CIS Risk)',
          scientific_source: crop.sources || 'Potato Association of America (PAA)',
          data_quality_notes: `Sensor: ${ts.name}. DS18B20 digital accuracy ±0.5°C.`,
          evaluated_at: new Date().toISOString()
        });
      }
    }

    // 5. Check Humidity Sensors
    const humSensors = sensors.filter(s => s.sensor_type === 'humidity');
    for (const hs of humSensors) {
      const val = hs.calibrated_reading ?? hs.raw_reading;
      if (val === null || val === undefined) continue;

      if (crop && val < crop.min_humidity) {
        const deficit = (crop.min_humidity - val).toFixed(1);
        adviceList.push({
          id: `risk-hum-lo-${hs.id}`,
          facility_id: area.facility_id,
          facility_name: area.facility_name,
          area_id: area.id,
          area_name: area.name,
          crop_name: crop.name,
          crop_profile: crop,
          detected_condition: `Low Relative Humidity (${val}%)`,
          parameter: 'humidity',
          actual_value: val,
          unit: '%',
          target_value: crop.target_humidity,
          limit_min: crop.min_humidity,
          limit_max: crop.max_humidity,
          deviation_description: `Humidity is ${deficit}% below safe minimum (${crop.min_humidity}%).`,
          severity: 'warning',
          why_it_matters: `Deficit relative humidity causes rapid moisture loss and shrinkage. Every 1% of moisture lost represents direct economic weight loss and induces soft texture, skin wrinkling, and pressure bruising susceptibility.`,
          possible_explanations: [
            'Humidification atomizers clogged or water supply tank depleted.',
            'Excessive refrigeration coil run-time acting as a dehumidifier due to oversized temperature differential (TD).',
            'Dry exterior ambient air introduced during ventilation.'
          ],
          what_to_check_first: [
            'Verify humidifier nozzle output and water pump pressure.',
            'Check coil temperature differential (TD); TD > 2.0°C causes excessive moisture condensation out of the air.'
          ],
          recommended_actions: [
            'Activate ultrasonic or high-pressure misting humidifiers.',
            'Adjust refrigeration expansion valve to raise evaporating temperature and reduce dehumidification.',
            'Dampen storage floor alleys with clean water if humidifiers are offline.'
          ],
          post_verification: [
            'Verify humidity rises back to ≥' + crop.min_humidity + '% without causing water droplets to drip from ceilings onto produce piles.'
          ],
          safety_precautions: [
            'Watch for wet floor slipping hazards when operating forklifts.'
          ],
          rule_reference: 'RULE-HUM-LOW (Vapor Pressure Deficit Dehydration)',
          scientific_source: 'UC Davis Postharvest Technology Center',
          data_quality_notes: `Sensor: ${hs.name}. DHT11 capacitive polymer sensor.`,
          evaluated_at: new Date().toISOString()
        });
      } else if (crop && val > crop.max_humidity && crop.max_humidity < 80.0) {
        // High humidity for dry crops like Onions or Grains
        const excess = (val - crop.max_humidity).toFixed(1);
        adviceList.push({
          id: `risk-hum-hi-${hs.id}`,
          facility_id: area.facility_id,
          facility_name: area.facility_name,
          area_id: area.id,
          area_name: area.name,
          crop_name: crop.name,
          crop_profile: crop,
          detected_condition: `Excess Humidity for Dry Commodity (${val}%)`,
          parameter: 'humidity',
          actual_value: val,
          unit: '%',
          target_value: crop.target_humidity,
          limit_min: crop.min_humidity,
          limit_max: crop.max_humidity,
          deviation_description: `Humidity is ${excess}% above maximum threshold for dry commodity (${crop.max_humidity}%).`,
          severity: 'critical',
          why_it_matters: `For ${crop.name}, relative humidity above ${crop.max_humidity}% is catastrophic. It triggers rooting, neck rot (Botrytis allii), black mold, and grain fungal mycotoxins (Aflatoxin, Ochratoxin).`,
          possible_explanations: [
            'Dehumidification system offline or refrigerant defrost failure.',
            'Wet produce introduced without prior forced-air curing.',
            'Water leaks or rainwater ingress into warehouse structure.'
          ],
          what_to_check_first: [
            'Verify dehumidifier drainage lines and compressor operation.',
            'Check building envelope for moisture seepage or roof leaks.'
          ],
          recommended_actions: [
            'Engage auxiliary dehumidification fans immediately.',
            'Introduce dry ambient air when outdoor dew point is lower than warehouse air.',
            'Increase air exchange velocity through bins.'
          ],
          post_verification: [
            'Inspect bulb necks and grain samples for fungal hyphae or musty odor.'
          ],
          safety_precautions: [
            'Wear N95 respiratory protection if mold spores are suspected in grain air.'
          ],
          rule_reference: 'RULE-HUM-HIGH-DRY (Moisture-Triggered Pathogenesis)',
          scientific_source: crop.sources || 'UC Davis Postharvest Technology Center',
          data_quality_notes: `Sensor: ${hs.name}. Relative humidity confirmed high.`,
          evaluated_at: new Date().toISOString()
        });
      }
    }

    // 6. Check Gas Sensors (Honest MQ reporting)
    const mqSensors = sensors.filter(s => s.sensor_type === 'mq3' || s.sensor_type === 'mq135');
    for (const ms of mqSensors) {
      const val = ms.calibrated_reading ?? ms.raw_reading;
      if (val !== null && val !== undefined && val > 300) {
        adviceList.push({
          id: `risk-gas-${ms.id}`,
          facility_id: area.facility_id,
          facility_name: area.facility_name,
          area_id: area.id,
          area_name: area.name,
          crop_name: crop?.name || area.commodity,
          crop_profile: crop,
          detected_condition: `Elevated Gas Sensor Response (${ms.sensor_type.toUpperCase()}: ${val})`,
          parameter: ms.sensor_type,
          actual_value: val,
          unit: 'sensor response',
          target_value: 100,
          limit_min: 0,
          limit_max: 250,
          deviation_description: `Sensor response ratio Rs/R0 indicates elevated volatile reducing gases / VOCs in storage zone atmosphere.`,
          severity: val > 600 ? 'critical' : 'warning',
          why_it_matters: `Elevated volatile organic compound (VOC) or ethanol vapor response frequently correlates with anaerobic fermentation, soft rot bacterial decay, or localized fungal decomposition pockets. However, uncalibrated metal-oxide sensors respond broadly to multiple reducing gases and solvent vapors.`,
          possible_explanations: [
            'Anaerobic micro-climates inside dense produce piles producing ethanol/acetic fermentation.',
            'Localized bacterial soft rot (Erwinia carotovora) break-down pocket in lower bins.',
            'Exhaust fumes from LP-gas or diesel forklifts operating in the vault.',
            'Volatile solvents from recent painting, sealants, or pallet treatments.',
            'Sensor baseline drift or temperature/humidity cross-sensitivity on metal oxide surface.'
          ],
          what_to_check_first: [
            'Check whether forklifts were recently operating in the storage aisle.',
            'Smell airflow exhaust for characteristic fermentation (alcohol/vinegar) or rotten odor.',
            'Verify whether temperature/humidity also shifted rapidly in that sector.'
          ],
          recommended_actions: [
            'Run fresh air purge cycle for 20-30 minutes using ventilation louvers.',
            'Conduct walk-through inspection with portable calibrated gas detector if available.',
            'Inspect lower pallet levels in the affected zone for wet breakdown bags.'
          ],
          post_verification: [
            'Verify that sensor response returns toward baseline after purge cycle.',
            'Confirm no continuing gas elevation once vault is sealed.'
          ],
          safety_precautions: [
            '⚠️ CRITICAL SAFETY NOTICE: NEVER enter an enclosed, poorly ventilated cold storage vault without confirming safe oxygen levels and ventilating the space first! High respiration can deplete oxygen and elevate CO2 to lethal levels.'
          ],
          rule_reference: 'RULE-GAS-VOC (Volatile Biomarker Elevated)',
          scientific_source: 'Postharvest Biology and Technology / Agrivault Honest Sensing Guidelines',
          data_quality_notes: `Sensor: ${ms.name}. Note: MQ-series semiconductor sensors provide non-selective volatile detection. Readings reflect broad gas response, NOT calibrated selective single-gas measurement.`,
          evaluated_at: new Date().toISOString()
        });
      }
    }
  }

  res.json({
    total_advice_items: adviceList.length,
    critical_count: adviceList.filter(a => a.severity === 'critical').length,
    warning_count: adviceList.filter(a => a.severity === 'warning').length,
    items: adviceList,
    generated_at: new Date().toISOString()
  });
});

export default router;
