/**
 * AgriVault Hardware & Network Abstraction Interfaces
 * 
 * Provides clean modular abstractions for:
 * - Device, SensorNode, InnerGateway, OuterGateway
 * - GatewayConnection (RS485, Ethernet, Serial, SimulatedWired)
 * - Sensor, TelemetryPacket, NodeHeartbeat, DeviceRegistration
 * 
 * Allows future transport/hardware upgrades (LoRa, industrial PLC, CAN bus, Raspberry Pi)
 * without rewriting the application or cloud logic.
 */

export type DeviceType = 'SENSOR_NODE' | 'INNER_GATEWAY' | 'OUTER_GATEWAY' | 'RELAY_NODE';
export type DeviceConnectionStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'UNKNOWN';
export type RegistrationStatus = 'pending' | 'active' | 'rejected' | 'revoked';
export type GatewayTransportType = 'RS485' | 'Ethernet' | 'Serial' | 'SimulatedWired';
export type LinkStatus = 'connected' | 'disconnected' | 'degraded';

export interface BaseDevice {
  id: string;                      // Stable logical ID (e.g., AGR-ESP-001)
  hardware_id: string;             // Permanent hardware identity (e.g., ESP32 MAC address)
  device_type: DeviceType;
  display_name: string;
  facility_id: string;
  is_online: number;
  last_seen: string;
  is_simulated: number;
  created_at: string;
}

export interface SensorNodeModel extends BaseDevice {
  device_type: 'SENSOR_NODE';
  cold_store_name: string;
  zone_name: string;
  area_name: string;
  area_id: string | null;
  rack_name: string;
  level_name: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  parent_gateway_id: string | null; // Inner Gateway ID
  parent_node_id: string | null;    // For future multi-hop mesh/repeater
  connection_protocol: 'ESP-NOW' | 'Wi-Fi' | 'RS-485' | 'BLE-Mesh';
  firmware_version: string;
  signal_rssi: number;
  battery_voltage: number;
  registration_status: RegistrationStatus;
}

export interface InnerGatewayModel extends BaseDevice {
  device_type: 'INNER_GATEWAY';
  paired_outer_gateway_id: string | null;
  wired_connection_type: GatewayTransportType;
  wired_link_status: LinkStatus;
  buffer_capacity: number;
  buffered_count: number;
  discovered_nodes_count: number;
  active_nodes_count: number;
}

export interface OuterGatewayModel extends BaseDevice {
  device_type: 'OUTER_GATEWAY';
  paired_inner_gateway_id: string | null;
  wired_connection_type: GatewayTransportType;
  wired_link_status: LinkStatus;
  internet_online: number;
  ip_address?: string;
  buffer_capacity: number;
  buffered_count: number;
}

export interface GatewayConnection {
  transportType: GatewayTransportType;
  status: LinkStatus;
  baudRate?: number;
  flowControl?: boolean;
  latencyMs: number;
  throughputBps: number;
  bufferedPackets: number;
  lastTransmission: string;
}

export interface SensorReadingMeasurement {
  sensor_type: string;             // 'temperature', 'humidity', 'mq3', 'mq135', 'co2', etc.
  value: number;
  unit: string;
  raw_value?: number;
}

export interface TelemetryPacket {
  node_id: string;                 // Stable device ID (e.g., AGR-ESP-001)
  hardware_id: string;             // ESP32 MAC address
  timestamp: string;
  readings: Record<string, number | SensorReadingMeasurement>;
  temperature?: number;            // DS18B20 (°C)
  humidity?: number;               // DHT11 (%)
  mq3?: number;                    // MQ3 Gas / Ethanol (ppm / raw)
  mq135?: number;                  // MQ135 Gas / Air Quality (ppm / raw)
  co2?: number;
  ammonia?: number;
  ethanol?: number;
  signal_rssi?: number;
  battery_voltage?: number;
  firmware_version?: string;
  parent_gateway_id?: string;
  parent_node_id?: string;
  is_buffered?: boolean;
  buffered_at?: string;
  is_simulation?: boolean;
}

export interface NodeHeartbeat {
  node_id: string;
  hardware_id: string;
  timestamp: string;
  connection_status: DeviceConnectionStatus;
  last_seen: string;
  signal_strength?: number;
  battery_voltage?: number;
  firmware_version?: string;
}

export interface DeviceRegistrationRequest {
  hardware_id: string;             // MAC address
  device_code?: string;            // Preferred device ID (e.g., AGR-ESP-012)
  display_name: string;
  facility_id: string;
  cold_store_name?: string;
  zone_name: string;
  area_id?: string;
  rack_name?: string;
  level_name?: string;
  pos_x?: number;
  pos_y?: number;
  pos_z?: number;
  description?: string;
  parent_gateway_id?: string;
}

export interface GatewayTopologySummary {
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
    transportType: GatewayTransportType;
    status: LinkStatus;
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
