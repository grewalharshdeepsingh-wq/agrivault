import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Network,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export const GatewayManagementPage: React.FC = () => {
  const { devices } = useApp();
  const [gateways, setGateways] = useState<any[]>([]);
  const [topology, setTopology] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<string | null>(null);

  const fetchGatewayData = async () => {
    try {
      const [gwRes, topoRes] = await Promise.all([
        api.getGateways(),
        api.getGatewayTopology()
      ]);
      setGateways(gwRes);
      setTopology(topoRes);
    } catch (err) {
      console.error('Error fetching gateway data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGatewayData();
    const interval = setInterval(fetchGatewayData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleFlushBuffer = async () => {
    setFlushing(true);
    setFlushResult(null);
    try {
      const res = await api.flushGatewayBuffer();
      setFlushResult(`Buffer flush successful! ${res.flushed_count || 0} buffered readings transmitted to cloud database.`);
      await fetchGatewayData();
    } catch (err: any) {
      setFlushResult(`Flush failed: ${err?.message || 'Error flushing buffer'}`);
    } finally {
      setFlushing(false);
    }
  };

  // Node vs Gateway counts separation (Mandatory Requirement)
  const totalGateways = gateways.length;
  const sensorNodes = devices.filter((d: any) => d.device_type !== 'INNER_GATEWAY' && d.device_type !== 'OUTER_GATEWAY');
  const totalSensorNodes = sensorNodes.length;
  const connectedNodes = sensorNodes.filter((d: any) => d.is_online === 1).length;
  const disconnectedNodes = sensorNodes.filter((d: any) => d.is_online === 0).length;
  const staleNodes = sensorNodes.filter((d: any) => d.staleness_status === 'stale').length;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Central Gateway Infrastructure</h1>
        <p className="text-xs text-vault-400 mt-1">
          Architecture B management for multi-tier insulated cold stores with RS-485 through-wall bridge and offline buffer resilience.
        </p>
      </div>

      {/* Mandatory Node vs Gateway Counts Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 space-y-1">
          <span className="text-xs text-vault-400 font-semibold uppercase tracking-wider block">Deployed Gateways</span>
          <span className="text-2xl font-black font-mono text-agri-400">{totalGateways}</span>
          <span className="text-[10px] text-vault-500 block">Inner + Outer Hubs</span>
        </div>

        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 space-y-1">
          <span className="text-xs text-vault-400 font-semibold uppercase tracking-wider block">Total Sensor Nodes</span>
          <span className="text-2xl font-black font-mono text-white">{totalSensorNodes}</span>
          <span className="text-[10px] text-vault-500 block">Registered end-devices</span>
        </div>

        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 space-y-1">
          <span className="text-xs text-vault-400 font-semibold uppercase tracking-wider block">Connected Nodes</span>
          <span className="text-2xl font-black font-mono text-emerald-400">{connectedNodes}</span>
          <span className="text-[10px] text-emerald-500/80 block">Active telemetry stream</span>
        </div>

        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 space-y-1">
          <span className="text-xs text-vault-400 font-semibold uppercase tracking-wider block">Disconnected Nodes</span>
          <span className="text-2xl font-black font-mono text-rose-400">{disconnectedNodes}</span>
          <span className="text-[10px] text-rose-500/80 block">Heartbeat timeout</span>
        </div>

        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 space-y-1">
          <span className="text-xs text-vault-400 font-semibold uppercase tracking-wider block">Stale Nodes</span>
          <span className="text-2xl font-black font-mono text-amber-400">{staleNodes}</span>
          <span className="text-[10px] text-amber-500/80 block">Unverified conditions</span>
        </div>
      </div>

      {flushResult && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{flushResult}</span>
          </div>
          <button onClick={() => setFlushResult(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Gateway Pair Architecture Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gateways.map((gw: any) => {
          const isInner = gw.gateway_type === 'INNER_GATEWAY' || gw.id.includes('INNER');
          const isOnline = gw.is_online === 1;

          return (
            <div
              key={gw.id}
              className="bg-vault-900 border border-vault-800 rounded-2xl p-6 space-y-5 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl border ${
                      isInner
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-agri-500/10 text-agri-400 border-agri-500/20'
                    }`}>
                      {isInner ? <Radio className="w-6 h-6" /> : <Server className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{gw.name}</h3>
                      <p className="text-xs text-vault-400 font-mono">
                        {isInner ? 'Inner Vault Hub (ESP-NOW Host)' : 'Outer WAN Gateway (Internet Bridge)'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
                    isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {gw.status_detail || (isInner
                    ? 'Gathers radio packets from interior cold room sensor nodes via peer-to-peer ESP-NOW and buffers measurements during WAN loss.'
                    : 'Perimeter gateway mounted outside the insulated wall. Bridges the RS-485 physical bus to the facility internet.')}
                </p>

                <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-vault-400">Gateway ID:</span>
                    <span className="text-slate-200">{gw.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-vault-400">Hardware MAC:</span>
                    <span className="text-slate-200">{gw.mac_address || '24:0A:C4:00:GW:01'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-vault-400">Local Bus Protocol:</span>
                    <span className="text-agri-400 font-bold">{gw.connection_type || 'RS-485'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-vault-400">Wired Through-Wall Link:</span>
                    <span className="text-emerald-400 font-bold">{gw.wired_link_status || 'CONNECTED'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-vault-400">Firmware Version:</span>
                    <span className="text-slate-200">{gw.firmware_version || 'v2.1.0'}</span>
                  </div>
                </div>

                {/* Buffer Capacity and Count */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Offline Flash Buffer</span>
                    <span className="text-vault-400 font-mono">
                      {gw.buffered_count || 0} / {gw.buffer_capacity || 5000} readings
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-vault-950 overflow-hidden border border-vault-800">
                    <div
                      className="h-full bg-agri-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((gw.buffered_count || 0) / (gw.buffer_capacity || 5000)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-vault-800 flex items-center justify-between">
                <span className="text-xs text-vault-400">Last Heartbeat: {gw.last_heartbeat ? new Date(gw.last_heartbeat).toLocaleTimeString() : 'Active'}</span>
                <button
                  onClick={handleFlushBuffer}
                  disabled={flushing}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-xs font-semibold text-slate-200 border border-vault-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-agri-400 ${flushing ? 'animate-spin' : ''}`} />
                  <span>Flush Local Buffer</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Discovered Sensor Nodes Routed Through Central Gateway */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Sensor Nodes Routed via Gateway Architecture</h2>
            <p className="text-xs text-vault-400">
              Downstream sensor nodes authenticated by the Inner Gateway and forwarded across the perimeter link.
            </p>
          </div>
          <span className="text-xs font-mono text-agri-400 font-bold bg-agri-500/10 px-2.5 py-1 rounded border border-agri-500/20">
            {sensorNodes.length} Verified Nodes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-vault-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Device Name</th>
                <th className="p-3">Device ID</th>
                <th className="p-3">Zone Assignment</th>
                <th className="p-3">Local Protocol</th>
                <th className="p-3">RSSI</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800/60 font-mono">
              {sensorNodes.map((n: any) => (
                <tr key={n.id} className="hover:bg-vault-850/50">
                  <td className="p-3 font-sans font-bold text-slate-200">{n.user_name || n.id}</td>
                  <td className="p-3 text-vault-400">{n.id}</td>
                  <td className="p-3 text-slate-300 font-sans">{n.area_name || 'Unassigned'}</td>
                  <td className="p-3 text-emerald-400">{n.connection_protocol || 'ESP-NOW'}</td>
                  <td className="p-3 text-slate-300">{n.signal_rssi || -58} dBm</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      n.is_online === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {n.is_online === 1 ? 'Online' : 'Offline'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
