-- AgriVault Complete Database Schema
-- Compatible with SQLite (local/embedded) & PostgreSQL / TimescaleDB (cloud)

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
    role TEXT NOT NULL DEFAULT 'Viewer', -- 'Owner', 'Admin', 'Operator', 'Viewer'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    name TEXT NOT NULL,
    commodity TEXT NOT NULL DEFAULT 'General Produce',
    health_status TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'attention', 'warning', 'critical'
    health_score REAL NOT NULL DEFAULT 100.0,
    health_reasons TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gateways (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    name TEXT NOT NULL,
    ip_address TEXT,
    mac_address TEXT,
    firmware_version TEXT DEFAULT 'v1.4.2',
    is_online INTEGER NOT NULL DEFAULT 1,
    last_heartbeat TEXT NOT NULL,
    local_network_ssid TEXT,
    status_detail TEXT DEFAULT 'Active monitoring',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS esp_devices (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    area_id TEXT REFERENCES areas(id),
    gateway_id TEXT REFERENCES gateways(id),
    user_name TEXT NOT NULL,
    hardware_type TEXT NOT NULL DEFAULT 'ESP32-DevKit-V1',
    firmware_version TEXT NOT NULL DEFAULT '1.2.0',
    ip_address TEXT,
    mac_address TEXT,
    is_online INTEGER NOT NULL DEFAULT 1,
    last_heartbeat TEXT NOT NULL,
    signal_rssi INTEGER DEFAULT -58,
    battery_voltage REAL DEFAULT 3.3,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_discovered INTEGER NOT NULL DEFAULT 0,
    installation_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES esp_devices(id),
    area_id TEXT REFERENCES areas(id),
    sensor_type TEXT NOT NULL, -- 'temperature', 'humidity', 'co2', 'ethylene', 'ammonia', 'ethanol', etc.
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    pin TEXT,
    raw_reading REAL DEFAULT 0,
    calibrated_reading REAL DEFAULT 0,
    rate_of_change REAL DEFAULT 0,
    rate_of_change_period TEXT DEFAULT '30 min',
    calibration_status TEXT DEFAULT 'calibrated', -- 'calibrated', 'factory_default', 'needs_calibration'
    calibration_date TEXT,
    confidence_score REAL DEFAULT 95.0,
    sensor_health TEXT DEFAULT 'healthy', -- 'healthy', 'degraded', 'error'
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
    recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_area_time ON sensor_readings(area_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_type_time ON sensor_readings(sensor_type, recorded_at DESC);

CREATE TABLE IF NOT EXISTS thresholds (
    id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL, -- 'facility', 'area', 'device', 'sensor'
    scope_id TEXT NOT NULL,
    parameter TEXT NOT NULL, -- 'temperature', 'humidity', 'co2', 'ethylene', 'ammonia', 'ethanol'
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
    severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
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
    event_type TEXT NOT NULL, -- 'triggered', 'acknowledged', 'resolved', 'escalated'
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
    state INTEGER NOT NULL DEFAULT 0, -- 0 = OFF, 1 = ON
    mode TEXT NOT NULL DEFAULT 'automatic', -- 'manual', 'automatic'
    last_switched TEXT NOT NULL,
    total_runtime_seconds INTEGER NOT NULL DEFAULT 0,
    max_continuous_runtime_sec INTEGER NOT NULL DEFAULT 3600,
    cooldown_period_sec INTEGER NOT NULL DEFAULT 300,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relay_actions (
    id TEXT PRIMARY KEY,
    relay_id TEXT NOT NULL REFERENCES relay_devices(id),
    triggered_by TEXT NOT NULL, -- 'manual_user', 'automation_rule', 'emergency_stop', 'safety_timeout'
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
    turn_off_threshold REAL NOT NULL, -- Hysteresis turn off
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
