/**
 * AgriVault Gateway & Connection Manager
 * 
 * Manages the real-world hardware & network architecture:
 * Sensor Nodes -> ESP-NOW -> Inner Gateway -> RS-485 Wired Link -> Outer Gateway -> Internet -> AgriVault
 * 
 * Handles:
 * - Inner and Outer Gateway lifecycle
 * - Offline data buffering during link or Internet downtime
 * - Automatic buffer flush on connection restoration
 * - Link simulation (RS-485 / Ethernet / Serial)
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import {
  GatewayTopologySummary,
  GatewayTransportType,
  LinkStatus,
  TelemetryPacket
} from './interfaces.js';
import { broadcast } from '../websocket/wsServer.js';

class GatewayManagerService {
  // Runtime Gateway & Connection States
  private internetOnline = true;
  private outerGatewayOnline = true;
  private innerGatewayOnline = true;
  private wiredLinkStatus: LinkStatus = 'connected';
  private transportType: GatewayTransportType = 'RS485';

  // Buffering Queues (FIFO) for Internet / Link outage resilience
  private innerGatewayBuffer: TelemetryPacket[] = [];
  private outerGatewayBuffer: TelemetryPacket[] = [];
  private readonly MAX_BUFFER_CAPACITY = 5000;

  // Metadata identifiers
  public innerGatewayId = 'GW-INNER-01';
  public outerGatewayId = 'GW-OUTER-01';
  public innerHardwareId = '24:0A:C4:00:IN:01';
  public outerHardwareId = '24:0A:C4:00:OUT:01';

  constructor() {
    this.ensureGatewayRecords();
  }

  /**
   * Initializes or verifies inner & outer gateway rows in database
   */
  public ensureGatewayRecords(): void {
    const now = new Date().toISOString();
    try {
      // Ensure Outer Gateway in DB
      const existingOuter = db.get('SELECT id FROM gateways WHERE id = ?', this.outerGatewayId);
      if (!existingOuter) {
        db.run(
          `INSERT INTO gateways (
            id, facility_id, name, ip_address, mac_address, firmware_version,
            is_online, last_heartbeat, local_network_ssid, status_detail, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          this.outerGatewayId,
          'fac-01',
          'Outer Gateway (Perimeter WAN)',
          '192.168.1.50',
          this.outerHardwareId,
          'v2.1.0-gateway',
          this.outerGatewayOnline ? 1 : 0,
          now,
          'AgriVault-Core-Wi-Fi',
          'Active internet uplink & RS-485 wall bus receiver',
          now
        );
      }

      // Ensure Inner Gateway in DB
      const existingInner = db.get('SELECT id FROM gateways WHERE id = ?', this.innerGatewayId);
      if (!existingInner) {
        db.run(
          `INSERT INTO gateways (
            id, facility_id, name, ip_address, mac_address, firmware_version,
            is_online, last_heartbeat, local_network_ssid, status_detail, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          this.innerGatewayId,
          'fac-01',
          'Inner Gateway (Vault Hub)',
          '10.0.0.10',
          this.innerHardwareId,
          'v2.1.0-inner',
          this.innerGatewayOnline ? 1 : 0,
          now,
          'ESP-NOW Local Mesh',
          'Active wireless ESP-NOW receiver & RS-485 transceiver',
          now
        );
      }
    } catch {
      // Ignore if db not ready during early load
    }
  }

  /**
   * Current topology summary for dashboard and API
   */
  public getTopology(): GatewayTopologySummary {
    const now = new Date().toISOString();
    let totalNodes = 0;
    let onlineNodes = 0;
    let offlineNodes = 0;
    let pendingNodes = 0;

    try {
      const nodes = db.all<any>(
        "SELECT id, is_online, registration_status, is_discovered FROM esp_devices WHERE device_type = 'SENSOR_NODE' OR device_type IS NULL"
      );
      totalNodes = nodes.length;
      for (const n of nodes) {
        const isPending = n.registration_status === 'pending' || (n.is_discovered === 1 && !n.area_id);
        if (isPending) {
          pendingNodes++;
        } else if (n.is_online === 1) {
          onlineNodes++;
        } else {
          offlineNodes++;
        }
      }
    } catch {
      // ignore
    }

    return {
      internet: {
        status: this.internetOnline ? 'ONLINE' : 'OFFLINE',
        lastChecked: now
      },
      outerGateway: {
        id: this.outerGatewayId,
        name: 'Outer Gateway (Perimeter WAN)',
        hardware_id: this.outerHardwareId,
        status: this.outerGatewayOnline ? 'ONLINE' : 'OFFLINE',
        ipAddress: '192.168.1.50',
        bufferedCount: this.outerGatewayBuffer.length,
        bufferCapacity: this.MAX_BUFFER_CAPACITY,
        lastHeartbeat: now
      },
      wiredWallLink: {
        transportType: this.transportType,
        status: this.wiredLinkStatus,
        protocol: this.transportType === 'RS485' ? 'EIA/TIA-485 Differential Half-Duplex' : this.transportType,
        description: 'Cold-store insulated wall penetration cable (Galvanic isolated)',
        maxThroughput: '115,200 baud (approx 11.5 kB/s)',
        latencyMs: this.wiredLinkStatus === 'connected' ? 2.4 : 9999
      },
      innerGateway: {
        id: this.innerGatewayId,
        name: 'Inner Gateway (Cold Vault Hub)',
        hardware_id: this.innerHardwareId,
        status: this.innerGatewayOnline ? 'ONLINE' : 'OFFLINE',
        bufferedCount: this.innerGatewayBuffer.length,
        bufferCapacity: this.MAX_BUFFER_CAPACITY,
        wirelessProtocol: 'ESP-NOW (2.4 GHz 1Mbps Direct Frame)',
        lastHeartbeat: now
      },
      wirelessNetwork: {
        protocol: 'ESP-NOW',
        totalNodes,
        onlineNodes,
        offlineNodes,
        pendingNodes
      }
    };
  }

  /**
   * Routes a telemetry packet from a sensor node through the multi-tier architecture:
   * Sensor Node -> Inner Gateway -> RS-485 Link -> Outer Gateway -> Internet -> AgriVault Backend
   * 
   * Handles offline buffering if any link is down!
   */
  public ingestTelemetry(packet: TelemetryPacket): { delivered: boolean; bufferedTier?: string; reason?: string } {
    // 1. Check Inner Gateway availability
    if (!this.innerGatewayOnline) {
      return { delivered: false, reason: 'Inner Gateway is offline. Wireless packet not received.' };
    }

    // 2. Check RS-485 Wired Link through the wall
    if (this.wiredLinkStatus !== 'connected') {
      // Buffer inside Inner Gateway!
      if (this.innerGatewayBuffer.length < this.MAX_BUFFER_CAPACITY) {
        this.innerGatewayBuffer.push({
          ...packet,
          is_buffered: true,
          buffered_at: new Date().toISOString()
        });
      }
      broadcast('gateway_buffer_updated', {
        tier: 'inner_gateway',
        count: this.innerGatewayBuffer.length
      });
      return {
        delivered: false,
        bufferedTier: 'inner_gateway',
        reason: 'RS-485 wall link disconnected. Packet safely buffered in Inner Gateway flash memory.'
      };
    }

    // 3. Check Outer Gateway availability
    if (!this.outerGatewayOnline) {
      if (this.innerGatewayBuffer.length < this.MAX_BUFFER_CAPACITY) {
        this.innerGatewayBuffer.push({
          ...packet,
          is_buffered: true,
          buffered_at: new Date().toISOString()
        });
      }
      return {
        delivered: false,
        bufferedTier: 'inner_gateway',
        reason: 'Outer Gateway is offline. Packet held in Inner Gateway.'
      };
    }

    // 4. Check Internet WAN connection
    if (!this.internetOnline) {
      // Packet reached Outer Gateway via RS-485, but Internet is down!
      if (this.outerGatewayBuffer.length < this.MAX_BUFFER_CAPACITY) {
        this.outerGatewayBuffer.push({
          ...packet,
          is_buffered: true,
          buffered_at: new Date().toISOString()
        });
      }
      broadcast('gateway_buffer_updated', {
        tier: 'outer_gateway',
        count: this.outerGatewayBuffer.length
      });
      return {
        delivered: false,
        bufferedTier: 'outer_gateway',
        reason: 'Internet connection down. Packet safely buffered in Outer Gateway.'
      };
    }

    // All links operational - direct delivery!
    return { delivered: true };
  }

  /**
   * Flushes any buffered packets when connections recover
   */
  public flushBuffers(processCallback: (packet: TelemetryPacket) => void): { flushedInner: number; flushedOuter: number } {
    let flushedInner = 0;
    let flushedOuter = 0;

    // 1. Flush Inner Gateway to Outer Gateway (if wired link is connected)
    if (this.innerGatewayOnline && this.wiredLinkStatus === 'connected' && this.outerGatewayOnline) {
      const itemsToMove = [...this.innerGatewayBuffer];
      this.innerGatewayBuffer = [];
      for (const item of itemsToMove) {
        if (this.internetOnline) {
          processCallback(item);
          flushedInner++;
        } else {
          this.outerGatewayBuffer.push(item);
        }
      }
    }

    // 2. Flush Outer Gateway to Cloud (if Internet is restored)
    if (this.outerGatewayOnline && this.internetOnline) {
      const itemsToUpload = [...this.outerGatewayBuffer];
      this.outerGatewayBuffer = [];
      for (const item of itemsToUpload) {
        processCallback(item);
        flushedOuter++;
      }
    }

    broadcast('gateway_buffer_flushed', {
      flushedInner,
      flushedOuter,
      remainingInner: this.innerGatewayBuffer.length,
      remainingOuter: this.outerGatewayBuffer.length
    });

    return { flushedInner, flushedOuter };
  }

  // --- Simulation & Control Helpers ---

  public setInternetStatus(online: boolean, onRestore?: (p: TelemetryPacket) => void): void {
    this.internetOnline = online;
    broadcast('network_status_changed', { tier: 'internet', status: online ? 'ONLINE' : 'OFFLINE' });
    if (online && onRestore) {
      this.flushBuffers(onRestore);
    }
  }

  public setOuterGatewayStatus(online: boolean, onRestore?: (p: TelemetryPacket) => void): void {
    this.outerGatewayOnline = online;
    db.run('UPDATE gateways SET is_online = ? WHERE id = ?', online ? 1 : 0, this.outerGatewayId);
    broadcast('network_status_changed', { tier: 'outer_gateway', status: online ? 'ONLINE' : 'OFFLINE' });
    if (online && onRestore) {
      this.flushBuffers(onRestore);
    }
  }

  public setInnerGatewayStatus(online: boolean, onRestore?: (p: TelemetryPacket) => void): void {
    this.innerGatewayOnline = online;
    db.run('UPDATE gateways SET is_online = ? WHERE id = ?', online ? 1 : 0, this.innerGatewayId);
    broadcast('network_status_changed', { tier: 'inner_gateway', status: online ? 'ONLINE' : 'OFFLINE' });
    if (online && onRestore) {
      this.flushBuffers(onRestore);
    }
  }

  public setWiredLinkStatus(status: LinkStatus, onRestore?: (p: TelemetryPacket) => void): void {
    this.wiredLinkStatus = status;
    broadcast('network_status_changed', { tier: 'wired_link', status });
    if (status === 'connected' && onRestore) {
      this.flushBuffers(onRestore);
    }
  }

  public setTransportType(type: GatewayTransportType): void {
    this.transportType = type;
  }

  public isInternetOnline(): boolean {
    return this.internetOnline;
  }

  public isWiredLinkConnected(): boolean {
    return this.wiredLinkStatus === 'connected';
  }

  public getInnerBufferCount(): number {
    return this.innerGatewayBuffer.length;
  }

  public getOuterBufferCount(): number {
    return this.outerGatewayBuffer.length;
  }
}

export const gatewayManager = new GatewayManagerService();
