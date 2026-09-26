export type UserRole = 'Owner' | 'Admin' | 'Operator' | 'Viewer';

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Facility {
  id: string;
  organization_id: string;
  name: string;
  location: string;
  description?: string;
  created_at: string;
}

export type HealthStatus = 'normal' | 'attention' | 'warning' | 'critical';

export interface Area {
  id: string;
  facility_id: string;
  name: string;
  commodity: string;
  health_status: HealthStatus;
  health_score: number;
  health_reasons: string[]; // parsed from JSON
  created_at: string;
}

export interface Gateway {
  id: string;
  facility_id: string;
  name: string;
  ip_address?: string;
  mac_address?: string;
  firmware_version: string;
  is_online: number;
  last_heartbeat: string;
  local_network_ssid?: string;
  status_detail: string;
  created_at: string;
}

export interface ESPDevice {
  id: string;
  facility_id: string;
  area_id: string | null;
  gateway_id?: string | null;
  user_name: string;
  hardware_type: string;
  firmware_version: string;
  ip_address?: string;
  mac_address?: string;
  is_online: number;
  last_heartbeat: string;
  signal_rssi: number;
  battery_voltage: number;
  is_enabled: number;
  is_discovered: number;
  installation_date: string;
  created_at: string;
  area_name?: string;
  sensors?: Sensor[];
}

export type SensorType = 
  | 'temperature' 
  | 'humidity' 
  | 'co2' 
  | 'ethylene' 
  | 'ammonia' 
  | 'ethanol' 
  | 'voc' 
  | 'pressure' 
  | 'door' 
  | 'light' 
  | 'power';

export interface Sensor {
  id: string;
  device_id: string;
  area_id: string;
  sensor_type: SensorType;
  name: string;
  unit: string;
  pin?: string;
  raw_reading: number;
  calibrated_reading: number;
  rate_of_change: number;
  rate_of_change_period: string;
  calibration_status: 'calibrated' | 'factory_default' | 'needs_calibration';
  calibration_date?: string;
  confidence_score: number;
  sensor_health: 'healthy' | 'degraded' | 'error';
  last_reading_time?: string;
  created_at: string;
}

export interface SensorReading {
  id: string;
  sensor_id: string;
  device_id: string;
  area_id: string;
  sensor_type: SensorType;
  raw_value: number;
  calibrated_value: number;
  unit: string;
  is_simulation: number;
  recorded_at: string;
}

export interface Threshold {
  id: string;
  scope_type: 'facility' | 'area' | 'device' | 'sensor';
  scope_id: string;
  parameter: SensorType;
  min_value: number | null;
  max_value: number | null;
  warning_min: number | null;
  warning_max: number | null;
  created_at: string;
  updated_at: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  facility_id: string;
  area_id: string;
  device_id: string;
  sensor_id?: string;
  parameter: string;
  severity: AlertSeverity;
  status: AlertStatus;
  measured_value: number;
  threshold_value: number;
  title: string;
  message: string;
  potential_issue: string;
  recommended_action: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  area_name?: string;
  device_name?: string;
}

export interface RelayDevice {
  id: string;
  device_id: string;
  area_id: string;
  name: string;
  gpio_pin: string;
  target_equipment: string;
  state: number; // 0: OFF, 1: ON
  mode: 'manual' | 'automatic';
  last_switched: string;
  total_runtime_seconds: number;
  max_continuous_runtime_sec: number;
  cooldown_period_sec: number;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  facility_id: string;
  area_id: string;
  relay_id: string;
  name: string;
  parameter: string;
  trigger_condition: 'greater_than' | 'less_than';
  turn_on_threshold: number;
  turn_off_threshold: number; // Hysteresis limit
  is_enabled: number;
  last_evaluated?: string;
  created_at: string;
}

export interface TelemetryPayload {
  deviceId: string;
  timestamp?: string;
  temperature?: number;
  humidity?: number;
  co2?: number;
  ethylene?: number;
  ammonia?: number;
  ethanol?: number;
  battery?: number;
  rssi?: number;
  raw?: Record<string, number>;
  is_simulation?: boolean;
}
