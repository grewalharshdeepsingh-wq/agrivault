// AgriVault Complete Database Schema in TypeScript
// Enables reliable compilation and serverless execution without file path dependencies

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    length_ft REAL DEFAULT 162.0,
    width_ft REAL DEFAULT 94.0,
    height_ft REAL DEFAULT 48.0,
    dimensions_unit TEXT DEFAULT 'ft',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    name TEXT NOT NULL,
    commodity TEXT NOT NULL DEFAULT 'General Produce',
    cold_store_name TEXT DEFAULT 'Cold Store A',
    zone_name TEXT DEFAULT 'North Zone',
    rack_name TEXT DEFAULT 'Rack 1',
    pos_x REAL DEFAULT 20.0,
    pos_y REAL DEFAULT 20.0,
    pos_z REAL DEFAULT 2.0,
    health_status TEXT NOT NULL DEFAULT 'normal',
    health_score REAL NOT NULL DEFAULT 100.0,
    health_reasons TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gateways (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    name TEXT NOT NULL,
    gateway_type TEXT DEFAULT 'INNER_GATEWAY', -- 'INNER_GATEWAY', 'OUTER_GATEWAY'
    connection_type TEXT DEFAULT 'RS485',      -- 'RS485', 'Ethernet', 'Serial'
    paired_gateway_id TEXT,
    ip_address TEXT,
    mac_address TEXT,
    firmware_version TEXT DEFAULT 'v2.1.0',
    is_online INTEGER NOT NULL DEFAULT 1,
    last_heartbeat TEXT NOT NULL,
    local_network_ssid TEXT,
    status_detail TEXT DEFAULT 'Active monitoring',
    buffer_capacity INTEGER DEFAULT 5000,
    buffered_count INTEGER DEFAULT 0,
    internet_online INTEGER DEFAULT 1,
    wired_link_status TEXT DEFAULT 'connected',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS esp_devices (
    id TEXT PRIMARY KEY,
    hardware_id TEXT,                         -- Unique hardware MAC address
    device_code TEXT,                         -- Stable logical ID (e.g. AGR-ESP-001)
    device_type TEXT DEFAULT 'SENSOR_NODE',   -- 'SENSOR_NODE', 'INNER_GATEWAY', 'OUTER_GATEWAY'
    registration_status TEXT DEFAULT 'active',-- 'pending', 'active', 'rejected', 'revoked'
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    cold_store_name TEXT DEFAULT 'Cold Store A',
    zone_name TEXT DEFAULT 'North Zone',
    area_id TEXT REFERENCES areas(id),
    rack_name TEXT DEFAULT 'Rack 1',
    level_name TEXT DEFAULT 'Level 1',
    pos_x REAL DEFAULT 20.0,
    pos_y REAL DEFAULT 20.0,
    pos_z REAL DEFAULT 2.0,
    gateway_id TEXT REFERENCES gateways(id),
    parent_gateway_id TEXT,                   -- Inner Gateway ID
    parent_node_id TEXT,                      -- Mesh repeater/parent node ID
    connection_protocol TEXT DEFAULT 'ESP-NOW',
    user_name TEXT NOT NULL,
    hardware_type TEXT NOT NULL DEFAULT 'ESP32-DevKit-V1',
    firmware_version TEXT NOT NULL DEFAULT '1.4.0',
    ip_address TEXT,
    mac_address TEXT,
    is_online INTEGER NOT NULL DEFAULT 1,
    last_heartbeat TEXT NOT NULL,
    signal_rssi INTEGER DEFAULT -58,
    battery_voltage REAL DEFAULT 3.3,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_discovered INTEGER NOT NULL DEFAULT 0,
    is_simulated INTEGER DEFAULT 0,
    installation_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES esp_devices(id),
    area_id TEXT REFERENCES areas(id),
    sensor_type TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    pin TEXT,
    raw_reading REAL DEFAULT 0,
    calibrated_reading REAL DEFAULT 0,
    rate_of_change REAL DEFAULT 0,
    rate_of_change_period TEXT DEFAULT '30 min',
    calibration_status TEXT DEFAULT 'calibrated',
    calibration_date TEXT,
    confidence_score REAL DEFAULT 95.0,
    sensor_health TEXT DEFAULT 'healthy',
    last_reading_time TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id TEXT PRIMARY KEY,
    sensor_id TEXT NOT NULL REFERENCES sensors(id),
    device_id TEXT NOT NULL REFERENCES esp_devices(id),
    area_id TEXT REFERENCES areas(id),
    sensor_type TEXT NOT NULL,
    raw_value REAL NOT NULL,
    calibrated_value REAL NOT NULL,
    unit TEXT NOT NULL,
    is_simulation INTEGER NOT NULL DEFAULT 0,
    is_buffered INTEGER NOT NULL DEFAULT 0,
    buffered_at TEXT,
    recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_area_time ON sensor_readings(area_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_type_time ON sensor_readings(sensor_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device_time ON sensor_readings(device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS thresholds (
    id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    parameter TEXT NOT NULL,
    min_value REAL,
    max_value REAL,
    warning_min REAL,
    warning_max REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    area_id TEXT REFERENCES areas(id),
    device_id TEXT REFERENCES esp_devices(id),
    sensor_id TEXT REFERENCES sensors(id),
    parameter TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    measured_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    potential_issue TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_facility_status ON alerts(facility_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_area_status ON alerts(area_id, status);

CREATE TABLE IF NOT EXISTS alert_events (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL REFERENCES alerts(id),
    event_type TEXT NOT NULL,
    details TEXT NOT NULL,
    actor_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relay_devices (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES esp_devices(id),
    area_id TEXT REFERENCES areas(id),
    name TEXT NOT NULL,
    gpio_pin TEXT NOT NULL DEFAULT 'GPIO 26',
    target_equipment TEXT NOT NULL DEFAULT 'Ventilation Fan',
    state INTEGER NOT NULL DEFAULT 0,
    mode TEXT NOT NULL DEFAULT 'automatic',
    last_switched TEXT NOT NULL,
    total_runtime_seconds INTEGER NOT NULL DEFAULT 0,
    max_continuous_runtime_sec INTEGER NOT NULL DEFAULT 3600,
    cooldown_period_sec INTEGER NOT NULL DEFAULT 300,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relay_actions (
    id TEXT PRIMARY KEY,
    relay_id TEXT NOT NULL REFERENCES relay_devices(id),
    triggered_by TEXT NOT NULL,
    actor_id TEXT,
    previous_state INTEGER NOT NULL,
    new_state INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    area_id TEXT NOT NULL REFERENCES areas(id),
    relay_id TEXT NOT NULL REFERENCES relay_devices(id),
    name TEXT NOT NULL,
    parameter TEXT NOT NULL,
    trigger_condition TEXT NOT NULL DEFAULT 'greater_than',
    turn_on_threshold REAL NOT NULL,
    turn_off_threshold REAL NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_evaluated TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    facility_id TEXT NOT NULL,
    alert_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    channel TEXT NOT NULL DEFAULT 'in_app',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    area_id TEXT REFERENCES areas(id),
    report_type TEXT NOT NULL DEFAULT 'weekly',
    title TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    facility_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
);
`;
