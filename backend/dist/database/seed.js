"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const db_js_1 = require("./db.js");
function seedDatabase() {
    (0, db_js_1.initDatabase)();
    const existingOrg = db_js_1.db.get('SELECT id FROM organizations LIMIT 1');
    if (existingOrg) {
        // Check if ESP8266 node is present; if not, add it
        const has8266 = db_js_1.db.get('SELECT id FROM esp_devices WHERE id = ?', 'ESP8266-C4B12');
        if (!has8266) {
            console.log('[Seed] Adding available ESP8266 node...');
            const now = new Date().toISOString();
            db_js_1.db.run('INSERT OR IGNORE INTO esp_devices (id, facility_id, area_id, gateway_id, user_name, hardware_type, firmware_version, ip_address, mac_address, is_online, last_heartbeat, signal_rssi, battery_voltage, is_enabled, is_discovered, installation_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'ESP8266-C4B12', 'fac-01', null, null, 'Available ESP8266: ESP8266-C4B12', 'ESP8266-NodeMCU', '1.3.0-ota', '192.168.1.142', '5C:CF:7F:C4:B1:11', 1, now, -61, 3.30, 1, 1, '2026-01-15', now);
            // Add sensors
            db_js_1.db.run('INSERT OR IGNORE INTO sensors (id, device_id, area_id, sensor_type, name, unit, pin, raw_reading, calibrated_reading, rate_of_change, rate_of_change_period, calibration_status, confidence_score, sensor_health, last_reading_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'sens-ESP8266-C4B12-temperature', 'ESP8266-C4B12', null, 'temperature', 'DS18B20 Probe', '°C', 'D2 (GPIO 4)', 5.6, 5.6, 0.1, '30 min', 'calibrated', 96.0, 'healthy', now, now);
            db_js_1.db.run('INSERT OR IGNORE INTO sensors (id, device_id, area_id, sensor_type, name, unit, pin, raw_reading, calibrated_reading, rate_of_change, rate_of_change_period, calibration_status, confidence_score, sensor_health, last_reading_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'sens-ESP8266-C4B12-humidity', 'ESP8266-C4B12', null, 'humidity', 'Humidity Sensor', '%', 'D7 (GPIO 13)', 89.2, 89.2, 0.0, '30 min', 'calibrated', 96.0, 'healthy', now, now);
            db_js_1.db.run('INSERT OR IGNORE INTO sensors (id, device_id, area_id, sensor_type, name, unit, pin, raw_reading, calibrated_reading, rate_of_change, rate_of_change_period, calibration_status, confidence_score, sensor_health, last_reading_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 'sens-ESP8266-C4B12-co2', 'ESP8266-C4B12', null, 'co2', 'Analog Gas Sensor', 'ppm', 'A0 (ADC0)', 510, 910, 5, '30 min', 'calibrated', 96.0, 'healthy', now, now);
        }
        // Also ensure gateway_id is null on all devices to reflect direct internet
        db_js_1.db.run('UPDATE esp_devices SET gateway_id = NULL');
        console.log('[Seed] Database ready with direct internet ESP32 and ESP8266 nodes.');
        return;
    }
    console.log('[Seed] Seeding database with initial production structures...');
    const now = new Date().toISOString();
    const orgId = 'org-agrivault-01';
    const facId = 'fac-01';
    const gwId = 'gw-01';
    // 1. Organization
    db_js_1.db.run('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)', orgId, 'AgriVault Cold Storage & Logistics Corp', now);
    // 2. Users (Admin, Operator, Viewer)
    const passwordHash = bcryptjs_1.default.hashSync('agrivault2026!', 10);
    const users = [
        { id: 'usr-admin', name: 'Dr. Harshdeep Singh (Chief Facility Engineer)', email: 'admin@agrivault.io', role: 'Owner' },
        { id: 'usr-operator', name: 'Elena Rostova (Lead Warehouse Operator)', email: 'operator@agrivault.io', role: 'Operator' },
        { id: 'usr-viewer', name: 'Marcus Vance (Cold Chain Inspector)', email: 'viewer@agrivault.io', role: 'Viewer' }
    ];
    for (const u of users) {
        db_js_1.db.run('INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', u.id, orgId, u.name, u.email, passwordHash, u.role, now, now);
    }
    // 3. Facility
    db_js_1.db.run('INSERT INTO facilities (id, organization_id, name, location, description, created_at) VALUES (?, ?, ?, ?, ?, ?)', facId, orgId, 'ABC Cold Storage — Central Hub', 'Sector 12, Agri-Logistics Park, Punjab / NCR', 'Main commercial cold vault facility with 4 monitored zones, controlled atmosphere, and potato storage.', now);
    // 4. Areas
    const areas = [
        {
            id: 'area-01',
            name: 'Area 1 — Potato Storage (North Vault)',
            commodity: 'Potatoes (Russet & Burbank)',
            health_status: 'normal',
            health_score: 96.5,
            health_reasons: JSON.stringify(['Temperature and humidity within optimal potato dormancy range', 'CO2 levels stable at ~1,100 ppm'])
        },
        {
            id: 'area-02',
            name: 'Area 2 — Potato Storage (South Vault)',
            commodity: 'Seed Potatoes (Kufri Jyoti)',
            health_status: 'attention',
            health_score: 84.0,
            health_reasons: JSON.stringify(['CO2 concentration slightly elevated (1,340 ppm)', 'Ventilation recommended'])
        },
        {
            id: 'area-03',
            name: 'Area 3 — Controlled Atmosphere (Fruit Vault)',
            commodity: 'Apples & Pears (Controlled Atmosphere)',
            health_status: 'normal',
            health_score: 94.0,
            health_reasons: JSON.stringify(['Ethylene trace levels < 0.05 ppm', 'Chiller maintaining 1.8°C'])
        },
        {
            id: 'area-04',
            name: 'Area 4 — Loading Dock & Transit Bay',
            commodity: 'Cross-Dock Shipping & Transit Pallets',
            health_status: 'normal',
            health_score: 99.0,
            health_reasons: JSON.stringify(['Ambient loading conditions normal', 'All bay doors sealed'])
        }
    ];
    for (const a of areas) {
        db_js_1.db.run('INSERT INTO areas (id, facility_id, name, commodity, health_status, health_score, health_reasons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', a.id, facId, a.name, a.commodity, a.health_status, a.health_score, a.health_reasons, now);
    }
    // 5. Gateways
    db_js_1.db.run('INSERT INTO gateways (id, facility_id, name, ip_address, mac_address, firmware_version, is_online, last_heartbeat, local_network_ssid, status_detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', gwId, facId, 'Gateway 01 — Raspberry Pi 4 Local Hub', '192.168.1.100', 'B8:27:EB:5A:C4:21', 'v2.4.0-rpi-gateway', 1, now, 'AgriVault-Local-Mesh-5G', 'Online — 5 ESP nodes active, buffering queue empty, cloud link active', now);
    // 6. ESP Devices
    const devices = [
        {
            id: 'ESP32-A7F21',
            name: 'North Storage Sensor 1 (Stack Level)',
            area_id: 'area-01',
            hardware: 'ESP32-DevKit-V1',
            ip: '192.168.1.121',
            rssi: -56,
            battery: 3.32,
            is_online: 1,
            is_discovered: 0
        },
        {
            id: 'ESP32-B8E34',
            name: 'North Storage Sensor 2 (Ceiling/Vent Level)',
            area_id: 'area-01',
            hardware: 'ESP32-DevKit-V1',
            ip: '192.168.1.122',
            rssi: -62,
            battery: 3.29,
            is_online: 1,
            is_discovered: 0
        },
        {
            id: 'ESP32-C9D45',
            name: 'South Storage Sensor 1',
            area_id: 'area-02',
            hardware: 'ESP32-DevKit-V1',
            ip: '192.168.1.123',
            rssi: -59,
            battery: 3.31,
            is_online: 1,
            is_discovered: 0
        },
        {
            id: 'ESP32-D1F56',
            name: 'Fruit CA Chamber Sensor Node',
            area_id: 'area-03',
            hardware: 'ESP32-DevKit-V1',
            ip: '192.168.1.124',
            rssi: -64,
            battery: 3.30,
            is_online: 1,
            is_discovered: 0
        },
        {
            id: 'ESP32-E2A67',
            name: 'Loading Dock Environmental Node',
            area_id: 'area-04',
            hardware: 'ESP32-DevKit-V1',
            ip: '192.168.1.125',
            rssi: -50,
            battery: 3.33,
            is_online: 1,
            is_discovered: 0
        },
        {
            id: 'ESP32-F3B78',
            name: 'Available ESP32: ESP32-F3B78',
            area_id: null,
            hardware: 'ESP32-DevKit-V1',
            ip: '192.168.1.135',
            rssi: -68,
            battery: 3.28,
            is_online: 1,
            is_discovered: 1 // Available & pending room assignment
        },
        {
            id: 'ESP8266-C4B12',
            name: 'Available ESP8266: ESP8266-C4B12',
            area_id: null,
            hardware: 'ESP8266-NodeMCU',
            ip: '192.168.1.142',
            rssi: -61,
            battery: 3.30,
            is_online: 1,
            is_discovered: 1 // Available & pending room assignment
        }
    ];
    for (const d of devices) {
        db_js_1.db.run('INSERT INTO esp_devices (id, facility_id, area_id, gateway_id, user_name, hardware_type, firmware_version, ip_address, mac_address, is_online, last_heartbeat, signal_rssi, battery_voltage, is_enabled, is_discovered, installation_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', d.id, facId, d.area_id, null, d.name, d.hardware, '1.3.0-ota', d.ip, d.id.includes('8266') ? `5C:CF:7F:${d.id.slice(8, 10)}:${d.id.slice(10, 12)}:11` : `24:0A:C4:${d.id.slice(6, 8)}:${d.id.slice(8, 10)}:11`, d.is_online, now, d.rssi, d.battery, 1, d.is_discovered, '2026-01-15', now);
    }
    // 7. Sensors & Baseline Readings
    const sensorConfigs = [
        // Area 1 - ESP32-A7F21
        { dev: 'ESP32-A7F21', area: 'area-01', type: 'temperature', name: 'DS18B20 Temp Probe (Stack)', unit: '°C', pin: 'GPIO 4', raw: 4.8, cal: 4.8, roc: -0.2 },
        { dev: 'ESP32-A7F21', area: 'area-01', type: 'humidity', name: 'Capacitive Humidity Sensor', unit: '%', pin: 'GPIO 32', raw: 88.0, cal: 88.0, roc: 0.5 },
        { dev: 'ESP32-A7F21', area: 'area-01', type: 'co2', name: 'MQ-135 CO2 Surrogate', unit: 'ppm', pin: 'GPIO 35', raw: 620, cal: 1120, roc: 25 },
        { dev: 'ESP32-A7F21', area: 'area-01', type: 'ethylene', name: 'Electro-Chemical Ethylene Sensor', unit: 'ppm', pin: 'GPIO 33', raw: 0.04, cal: 0.04, roc: 0.00 },
        { dev: 'ESP32-A7F21', area: 'area-01', type: 'ammonia', name: 'MQ-135 Ammonia Sensor', unit: 'ppm', pin: 'GPIO 35', raw: 1.8, cal: 1.8, roc: 0.1 },
        { dev: 'ESP32-A7F21', area: 'area-01', type: 'ethanol', name: 'MQ-3 VOC / Fermentation Sensor', unit: 'ppm', pin: 'GPIO 34', raw: 0.6, cal: 0.6, roc: 0.0 },
        // Area 2 - ESP32-C9D45
        { dev: 'ESP32-C9D45', area: 'area-02', type: 'temperature', name: 'DS18B20 Temp Probe (Mid-Rack)', unit: '°C', pin: 'GPIO 4', raw: 5.2, cal: 5.2, roc: 0.3 },
        { dev: 'ESP32-C9D45', area: 'area-02', type: 'humidity', name: 'Capacitive Humidity Sensor', unit: '%', pin: 'GPIO 32', raw: 91.0, cal: 91.0, roc: 1.2 },
        { dev: 'ESP32-C9D45', area: 'area-02', type: 'co2', name: 'MQ-135 CO2 Surrogate', unit: 'ppm', pin: 'GPIO 35', raw: 780, cal: 1340, roc: 45 },
        { dev: 'ESP32-C9D45', area: 'area-02', type: 'ethylene', name: 'Electro-Chemical Ethylene Sensor', unit: 'ppm', pin: 'GPIO 33', raw: 0.07, cal: 0.07, roc: 0.01 },
        { dev: 'ESP32-C9D45', area: 'area-02', type: 'ammonia', name: 'MQ-135 Ammonia Sensor', unit: 'ppm', pin: 'GPIO 35', raw: 2.1, cal: 2.1, roc: 0.0 },
        { dev: 'ESP32-C9D45', area: 'area-02', type: 'ethanol', name: 'MQ-3 VOC / Fermentation Sensor', unit: 'ppm', pin: 'GPIO 34', raw: 0.9, cal: 0.9, roc: 0.1 },
        // Area 3 - ESP32-D1F56 (Fruit CA)
        { dev: 'ESP32-D1F56', area: 'area-03', type: 'temperature', name: 'DS18B20 Temp Probe (Air Return)', unit: '°C', pin: 'GPIO 4', raw: 1.8, cal: 1.8, roc: 0.0 },
        { dev: 'ESP32-D1F56', area: 'area-03', type: 'humidity', name: 'Capacitive Humidity Sensor', unit: '%', pin: 'GPIO 32', raw: 92.5, cal: 92.5, roc: -0.1 },
        { dev: 'ESP32-D1F56', area: 'area-03', type: 'co2', name: 'MQ-135 CO2 Surrogate', unit: 'ppm', pin: 'GPIO 35', raw: 480, cal: 850, roc: -10 },
        { dev: 'ESP32-D1F56', area: 'area-03', type: 'ethylene', name: 'Electro-Chemical Ethylene Sensor', unit: 'ppm', pin: 'GPIO 33', raw: 0.03, cal: 0.03, roc: 0.00 },
        { dev: 'ESP32-D1F56', area: 'area-03', type: 'ammonia', name: 'MQ-135 Ammonia Sensor', unit: 'ppm', pin: 'GPIO 35', raw: 0.8, cal: 0.8, roc: 0.0 },
        { dev: 'ESP32-D1F56', area: 'area-03', type: 'ethanol', name: 'MQ-3 VOC / Fermentation Sensor', unit: 'ppm', pin: 'GPIO 34', raw: 0.4, cal: 0.4, roc: 0.0 },
        // Area 4 - ESP32-E2A67 (Loading Dock)
        { dev: 'ESP32-E2A67', area: 'area-04', type: 'temperature', name: 'DS18B20 Temp Probe (Dock Floor)', unit: '°C', pin: 'GPIO 4', raw: 11.4, cal: 11.4, roc: 0.8 },
        { dev: 'ESP32-E2A67', area: 'area-04', type: 'humidity', name: 'Capacitive Humidity Sensor', unit: '%', pin: 'GPIO 32', raw: 68.0, cal: 68.0, roc: -1.0 },
        { dev: 'ESP32-E2A67', area: 'area-04', type: 'co2', name: 'MQ-135 CO2 Surrogate', unit: 'ppm', pin: 'GPIO 35', raw: 320, cal: 560, roc: 5 },
        { dev: 'ESP32-E2A67', area: 'area-04', type: 'ethylene', name: 'Electro-Chemical Ethylene Sensor', unit: 'ppm', pin: 'GPIO 33', raw: 0.01, cal: 0.01, roc: 0.00 },
        { dev: 'ESP32-E2A67', area: 'area-04', type: 'ammonia', name: 'MQ-135 Ammonia Sensor', unit: 'ppm', pin: 'GPIO 35', raw: 0.5, cal: 0.5, roc: 0.0 },
        { dev: 'ESP32-E2A67', area: 'area-04', type: 'ethanol', name: 'MQ-3 VOC / Fermentation Sensor', unit: 'ppm', pin: 'GPIO 34', raw: 0.2, cal: 0.2, roc: 0.0 },
        // Discovered Available ESP32-F3B78
        { dev: 'ESP32-F3B78', area: null, type: 'temperature', name: 'DS18B20 Probe', unit: '°C', pin: 'GPIO 4', raw: 4.5, cal: 4.5, roc: 0.0 },
        { dev: 'ESP32-F3B78', area: null, type: 'humidity', name: 'Humidity Sensor', unit: '%', pin: 'GPIO 32', raw: 87.5, cal: 87.5, roc: 0.0 },
        { dev: 'ESP32-F3B78', area: null, type: 'co2', name: 'MQ-135 Gas Sensor', unit: 'ppm', pin: 'GPIO 35', raw: 400, cal: 720, roc: 0 },
        // Discovered Available ESP8266-C4B12
        { dev: 'ESP8266-C4B12', area: null, type: 'temperature', name: 'DS18B20 Probe', unit: '°C', pin: 'D2 (GPIO 4)', raw: 5.6, cal: 5.6, roc: 0.1 },
        { dev: 'ESP8266-C4B12', area: null, type: 'humidity', name: 'Humidity Sensor', unit: '%', pin: 'D7 (GPIO 13)', raw: 89.2, cal: 89.2, roc: 0.0 },
        { dev: 'ESP8266-C4B12', area: null, type: 'co2', name: 'Analog Gas Sensor', unit: 'ppm', pin: 'A0 (ADC0)', raw: 510, cal: 910, roc: 5 }
    ];
    for (const s of sensorConfigs) {
        const sId = `sens-${s.dev}-${s.type}`;
        db_js_1.db.run('INSERT INTO sensors (id, device_id, area_id, sensor_type, name, unit, pin, raw_reading, calibrated_reading, rate_of_change, rate_of_change_period, calibration_status, calibration_date, confidence_score, sensor_health, last_reading_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', sId, s.dev, s.area, s.type, s.name, s.unit, s.pin, s.raw, s.cal, s.roc, '30 min', 'calibrated', '2026-01-20', 96.0, 'healthy', now, now);
    }
    // 8. Relays
    const relays = [
        {
            id: 'relay-01',
            dev: 'ESP32-A7F21',
            area: 'area-01',
            name: 'Area 1 Exhaust Fan / Vent Actuator',
            pin: 'GPIO 26',
            target: 'Ventilation Fan',
            state: 0,
            mode: 'automatic'
        },
        {
            id: 'relay-02',
            dev: 'ESP32-C9D45',
            area: 'area-02',
            name: 'Area 2 Purge Blower',
            pin: 'GPIO 26',
            target: 'Exhaust Blower',
            state: 0,
            mode: 'automatic'
        },
        {
            id: 'relay-03',
            dev: 'ESP32-D1F56',
            area: 'area-03',
            name: 'CA Chamber Circulation Booster',
            pin: 'GPIO 26',
            target: 'Circulation Fan',
            state: 0,
            mode: 'manual'
        }
    ];
    for (const r of relays) {
        db_js_1.db.run('INSERT INTO relay_devices (id, device_id, area_id, name, gpio_pin, target_equipment, state, mode, last_switched, total_runtime_seconds, max_continuous_runtime_sec, cooldown_period_sec, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r.id, r.dev, r.area, r.name, r.pin, r.target, r.state, r.mode, now, 1420, 3600, 300, now);
    }
    // 9. Automation Rules (Safe Hysteresis!)
    const rules = [
        {
            id: 'rule-01',
            fac: facId,
            area: 'area-01',
            relay: 'relay-01',
            name: 'High Temp Auto-Ventilation with Hysteresis',
            param: 'temperature',
            condition: 'greater_than',
            turn_on: 6.5,
            turn_off: 4.8 // 1.7°C hysteresis
        },
        {
            id: 'rule-02',
            fac: facId,
            area: 'area-02',
            relay: 'relay-02',
            name: 'CO2 Purge Automation with Hysteresis',
            param: 'co2',
            condition: 'greater_than',
            turn_on: 1400.0,
            turn_off: 1050.0 // 350 ppm hysteresis prevents chatter
        }
    ];
    for (const r of rules) {
        db_js_1.db.run('INSERT INTO automation_rules (id, facility_id, area_id, relay_id, name, parameter, trigger_condition, turn_on_threshold, turn_off_threshold, is_enabled, last_evaluated, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r.id, r.fac, r.area, r.relay, r.name, r.param, r.condition, r.turn_on, r.turn_off, 1, now, now);
    }
    // 10. Threshold Configurations (Facility Defaults & Area Overrides)
    const defaultThresholds = [
        { scope_type: 'facility', scope_id: facId, param: 'temperature', min: 2.0, max: 6.0, warn_min: 2.5, warn_max: 5.5 },
        { scope_type: 'facility', scope_id: facId, param: 'humidity', min: 80.0, max: 95.0, warn_min: 82.0, warn_max: 92.0 },
        { scope_type: 'facility', scope_id: facId, param: 'co2', min: 0.0, max: 1500.0, warn_min: 0.0, warn_max: 1200.0 },
        { scope_type: 'facility', scope_id: facId, param: 'ethylene', min: 0.0, max: 0.15, warn_min: 0.0, warn_max: 0.08 },
        { scope_type: 'facility', scope_id: facId, param: 'ammonia', min: 0.0, max: 5.0, warn_min: 0.0, warn_max: 3.0 },
        { scope_type: 'facility', scope_id: facId, param: 'ethanol', min: 0.0, max: 2.0, warn_min: 0.0, warn_max: 1.2 },
        // Area 3 (Apples CA Chamber) custom overrides:
        { scope_type: 'area', scope_id: 'area-03', param: 'temperature', min: 1.0, max: 3.0, warn_min: 1.2, warn_max: 2.5 },
        { scope_type: 'area', scope_id: 'area-03', param: 'ethylene', min: 0.0, max: 0.06, warn_min: 0.0, warn_max: 0.04 }
    ];
    for (const t of defaultThresholds) {
        db_js_1.db.run('INSERT INTO thresholds (id, scope_type, scope_id, parameter, min_value, max_value, warning_min, warning_max, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (0, uuid_1.v4)(), t.scope_type, t.scope_id, t.param, t.min, t.max, t.warn_min, t.warn_max, now, now);
    }
    // 11. Initial Alert (Example of intelligent interpretation)
    const alertId = 'alert-sample-01';
    db_js_1.db.run('INSERT INTO alerts (id, facility_id, area_id, device_id, sensor_id, parameter, severity, status, measured_value, threshold_value, title, message, potential_issue, recommended_action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', alertId, facId, 'area-02', 'ESP32-C9D45', 'sens-ESP32-C9D45-co2', 'co2', 'warning', 'active', 1340, 1200, 'Elevated CO2 Concentration in Area 2', 'Carbon dioxide concentration reached 1,340 ppm, exceeding the warning threshold of 1,200 ppm.', 'Elevated carbon dioxide may indicate reduced airflow, stack respiration, or inadequate fresh-air exchange in the storage vault.', 'Inspect ventilation damper actuators, check air circulation fans, and investigate possible product respiration increase.', now, now);
    db_js_1.db.run('INSERT INTO alert_events (id, alert_id, event_type, details, created_at) VALUES (?, ?, ?, ?, ?)', (0, uuid_1.v4)(), alertId, 'triggered', 'CO2 reading 1340 ppm crossed warning threshold 1200 ppm', now);
    // 12. Pre-populate 24 hours of realistic historical readings
    console.log('[Seed] Generating 24-hour historical time-series readings for analytics...');
    const hoursToGenerate = 24;
    const pointsPerHour = 4; // every 15 min
    const totalPoints = hoursToGenerate * pointsPerHour;
    const currentTimeMs = Date.now();
    for (const s of sensorConfigs) {
        const sId = `sens-${s.dev}-${s.type}`;
        let baseVal = s.cal;
        for (let i = totalPoints; i >= 0; i--) {
            const pointTime = new Date(currentTimeMs - i * 15 * 60 * 1000).toISOString();
            // Add realistic smooth organic fluctuation
            const noise = (Math.sin(i * 0.25) * 0.4) + ((Math.random() - 0.5) * 0.15);
            let val = baseVal + noise;
            if (s.type === 'co2')
                val = Math.round(baseVal + (Math.sin(i * 0.2) * 80) + ((Math.random() - 0.5) * 20));
            if (s.type === 'ethylene')
                val = Math.max(0.01, +(baseVal + (Math.sin(i * 0.15) * 0.01) + ((Math.random() - 0.5) * 0.005)).toFixed(3));
            if (s.type === 'ammonia')
                val = Math.max(0.2, +(baseVal + (Math.sin(i * 0.1) * 0.2) + ((Math.random() - 0.5) * 0.08)).toFixed(2));
            if (s.type === 'ethanol')
                val = Math.max(0.1, +(baseVal + (Math.sin(i * 0.18) * 0.15) + ((Math.random() - 0.5) * 0.05)).toFixed(2));
            if (s.type === 'temperature')
                val = +val.toFixed(2);
            if (s.type === 'humidity')
                val = +val.toFixed(1);
            db_js_1.db.run('INSERT INTO sensor_readings (id, sensor_id, device_id, area_id, sensor_type, raw_value, calibrated_value, unit, is_simulation, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (0, uuid_1.v4)(), sId, s.dev, s.area, s.type, val, val, s.unit, 0, pointTime);
        }
    }
    console.log('[Seed] Database successfully populated with real facility structure, sensors, rules, and historical time-series data.');
}
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
    seedDatabase();
}
