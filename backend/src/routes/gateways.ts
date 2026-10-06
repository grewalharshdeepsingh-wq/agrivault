import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { gatewayManager } from '../hardware/gatewayManager.js';
import { handleDeviceTelemetry, handleDeviceStatus } from '../mqtt/handlers.js';
import { TelemetryPacket } from '../hardware/interfaces.js';

const router = Router();

// GET /api/gateways
router.get('/', (req: Request, res: Response): void => {
  const gateways = db.all('SELECT * FROM gateways ORDER BY created_at ASC');
  const topology = gatewayManager.getTopology();

  const enriched = gateways.map((g: any) => ({
    ...g,
    is_online: g.id === gatewayManager.innerGatewayId
      ? (topology.innerGateway.status === 'ONLINE' ? 1 : 0)
      : (topology.outerGateway.status === 'ONLINE' ? 1 : 0),
    buffered_count: g.id === gatewayManager.innerGatewayId
      ? topology.innerGateway.bufferedCount
      : topology.outerGateway.bufferedCount,
    wired_link_status: topology.wiredWallLink.status
  }));

  res.json(enriched);
});

// GET /api/gateways/topology
// Returns the complete multi-tier network and gateway status
router.get('/topology', (req: Request, res: Response): void => {
  const topology = gatewayManager.getTopology();
  res.json(topology);
});

// POST /api/gateways/buffer-flush
// Triggers flushing and ingestion of buffered offline readings
router.post('/buffer-flush', (req: Request, res: Response): void => {
  const result = gatewayManager.flushBuffers((packet: TelemetryPacket) => {
    handleDeviceTelemetry('fac-01', gatewayManager.innerGatewayId, packet.node_id, {
      ...packet.readings,
      deviceId: packet.node_id,
      timestamp: packet.timestamp,
      is_buffered: true,
      buffered_at: packet.buffered_at,
      is_simulation: packet.is_simulation
    });
  });

  res.json({
    success: true,
    message: `Buffers flushed successfully. Processed ${result.flushedInner} from Inner Gateway and ${result.flushedOuter} from Outer Gateway.`,
    ...result
  });
});

// POST /api/gateways/telemetry
// Gateway batch ingest endpoint (used by Outer Gateway when transmitting live or buffered blocks)
router.post('/telemetry', (req: Request, res: Response): void => {
  const body = req.body;
  const packets: any[] = Array.isArray(body) ? body : Array.isArray(body?.readings) ? body.readings : [body];

  let ingested = 0;
  for (const p of packets) {
    if (!p.deviceId && !p.id) continue;
    const devId = (p.deviceId || p.id).toUpperCase();
    const facilityId = p.facilityId || 'fac-01';

    handleDeviceStatus(facilityId, gatewayManager.innerGatewayId, devId, {
      hardwareType: p.hardwareType || 'ESP32-DevKit-V1',
      firmwareVersion: p.firmwareVersion || '1.4.0',
      ipAddress: p.ipAddress || '192.168.1.150',
      macAddress: p.macAddress || p.hardware_id,
      rssi: p.rssi,
      battery: p.battery
    });

    handleDeviceTelemetry(facilityId, gatewayManager.innerGatewayId, devId, p);
    ingested++;
  }

  res.json({
    success: true,
    ingestedCount: ingested,
    gateway: gatewayManager.outerGatewayId,
    receivedAt: new Date().toISOString()
  });
});

// POST /api/gateways/control
// Used by simulation/settings to control network tiers
router.post('/control', (req: Request, res: Response): void => {
  const { internetOnline, outerGatewayOnline, innerGatewayOnline, wiredLinkStatus, transportType } = req.body;

  const onRestore = (packet: TelemetryPacket) => {
    handleDeviceTelemetry('fac-01', gatewayManager.innerGatewayId, packet.node_id, {
      ...packet.readings,
      deviceId: packet.node_id,
      timestamp: packet.timestamp,
      is_buffered: true,
      buffered_at: packet.buffered_at,
      is_simulation: packet.is_simulation
    });
  };

  if (internetOnline !== undefined) {
    gatewayManager.setInternetStatus(Boolean(internetOnline), onRestore);
  }
  if (outerGatewayOnline !== undefined) {
    gatewayManager.setOuterGatewayStatus(Boolean(outerGatewayOnline), onRestore);
  }
  if (innerGatewayOnline !== undefined) {
    gatewayManager.setInnerGatewayStatus(Boolean(innerGatewayOnline), onRestore);
  }
  if (wiredLinkStatus !== undefined) {
    gatewayManager.setWiredLinkStatus(wiredLinkStatus, onRestore);
  }
  if (transportType !== undefined) {
    gatewayManager.setTransportType(transportType);
  }

  res.json({
    success: true,
    topology: gatewayManager.getTopology()
  });
});

export default router;
