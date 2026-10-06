export type UserRole = 'Owner' | 'Admin' | 'Operator' | 'Viewer';

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type HealthStatus = 'normal' | 'attention' | 'warning' | 'critical';

export interface AreaMetricData {
  value: number;
  raw: number;
  unit: string;
  rateOfChange: number;
  rateOfChangePeriod: string;
  health: string;
  confidence: number;
}

export interface Area {
  id: string;
  facility_id: string;
  name: string;
  commodity: string;
  health_status: HealthStatus;
  health_score: number;
  health_reasons: string[];
  created_at: string;
  devices?: any[];
  deviceCount?: number;
  activeAlertsCount?: number;
  metrics?: {
    temperature: AreaMetricData | null;
    humidity: AreaMetricData | null;
    co2: AreaMetricData | null;
    ethylene: AreaMetricData | null;
    ammonia: AreaMetricData | null;
    ethanol: AreaMetricData | null;
  };
}

export interface Facility {
  id: string;
  organization_id: string;
  name: string;
  location: string;
  description?: string;
  length_ft?: number;
  width_ft?: number;
  height_ft?: number;
  dimensions_unit?: string;
  created_at: string;
}

export interface Gateway {
  id: string;
  facility_id: string;
  name: string;
  gateway_type?: 'INNER_GATEWAY' | 'OUTER_GATEWAY';
  connection_type?: 'RS485' | 'Ethernet' | 'Serial';
  paired_gateway_id?: string | null;
  ip_address?: string;
  mac_address?: string;
  firmware_version: string;
  is_online: number;
  last_heartbeat: string;
  local_network_ssid?: string;
  status_detail: string;
  buffer_capacity?: number;
  buffered_count?: number;
  internet_online?: number;
  wired_link_status?: string;
}

export interface GatewayTopology {
  internet: {
    status: 'ONLINE' | 'OFFLINE';
    lastChecked: string;
  };
  outerGateway: {
    id: string;
    name: string;
    hardware_id: string;
    status: 'ONLINE' | 'OFFLINE';
    ipAddress?: string;
    bufferedCount: number;
    bufferCapacity: number;
    lastHeartbeat: string;
  };
  wiredWallLink: {
    transportType: string;
    status: 'connected' | 'disconnected' | 'degraded';
    protocol: string;
    description: string;
    maxThroughput: string;
    latencyMs: number;
  };
  innerGateway: {
    id: string;
    name: string;
    hardware_id: string;
    status: 'ONLINE' | 'OFFLINE';
    bufferedCount: number;
    bufferCapacity: number;
    wirelessProtocol: string;
    lastHeartbeat: string;
  };
  wirelessNetwork: {
    protocol: 'ESP-NOW';
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    pendingNodes: number;
  };
}

export interface Sensor {
  id: string;
  device_id: string;
  area_id: string;
  sensor_type: string;
  name: string;
  unit: string;
  pin?: string;
  raw_reading: number;
  calibrated_reading: number;
  rate_of_change: number;
  rate_of_change_period: string;
  calibration_status: string;
  calibration_date?: string;
  confidence_score: number;
  sensor_health: string;
  last_reading_time?: string;
}

export interface ESPDevice {
  id: string;
  hardware_id?: string;
  device_code?: string;
  device_type?: 'SENSOR_NODE' | 'INNER_GATEWAY' | 'OUTER_GATEWAY' | 'RELAY_NODE';
  registration_status?: 'pending' | 'active' | 'rejected' | 'revoked';
  facility_id: string;
  cold_store_name?: string;
  zone_name?: string;
  area_id: string | null;
  rack_name?: string;
  level_name?: string;
  pos_x?: number;
  pos_y?: number;
  pos_z?: number;
  gateway_id?: string;
  parent_gateway_id?: string;
  parent_node_id?: string;
  connection_protocol?: string;
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
  is_simulated?: number;
  installation_date: string;
  area_name?: string;
  sensors?: Sensor[];
}

export interface Alert {
  id: string;
  facility_id: string;
  area_id: string;
  device_id: string;
  sensor_id?: string;
  parameter: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
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
  state: number; // 0 or 1
  mode: 'manual' | 'automatic';
  last_switched: string;
  total_runtime_seconds: number;
  max_continuous_runtime_sec: number;
  cooldown_period_sec: number;
  area_name?: string;
  device_name?: string;
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
  turn_off_threshold: number;
  is_enabled: number;
  last_evaluated?: string;
  relay_name?: string;
  target_equipment?: string;
  area_name?: string;
}

export interface StorageHealthInsight {
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  potentialCauses: string[];
  recommendedActions: string[];
}
