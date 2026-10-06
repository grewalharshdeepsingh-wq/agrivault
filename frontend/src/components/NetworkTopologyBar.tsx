import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { wsManager } from '../api/websocket';
import { GatewayTopology } from '../types';
import {
  Globe,
  Wifi,
  WifiOff,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Cable,
  Radio,
  CheckCircle2,
  AlertTriangle,
  HardDrive
} from 'lucide-react';

interface NetworkTopologyBarProps {
  onFlushBuffer?: () => void;
}

export const NetworkTopologyBar: React.FC<NetworkTopologyBarProps> = ({ onFlushBuffer }) => {
  const [topology, setTopology] = useState<GatewayTopology | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastFlushedMessage, setLastFlushedMessage] = useState<string | null>(null);

  const fetchTopology = async () => {
    try {
      const top = await api.getGatewayTopology();
      setTopology(top);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 4000);

    const unsubBuffer = wsManager.on('gateway_buffer_updated', () => fetchTopology());
    const unsubFlushed = wsManager.on('gateway_buffer_flushed', (data) => {
      fetchTopology();
      setLastFlushedMessage(`Flushed ${data.flushedInner + data.flushedOuter} readings!`);
      setTimeout(() => setLastFlushedMessage(null), 4000);
    });
    const unsubStatus = wsManager.on('network_status_changed', () => fetchTopology());

    return () => {
      clearInterval(interval);
      unsubBuffer();
      unsubFlushed();
      unsubStatus();
    };
  }, []);

  const handleFlush = async () => {
    setIsFlushing(true);
    try {
      const res = await api.flushGatewayBuffer();
      setLastFlushedMessage(`Recovered ${res.flushedInner + res.flushedOuter} buffered readings.`);
      setTimeout(() => setLastFlushedMessage(null), 4000);
      await fetchTopology();
      if (onFlushBuffer) onFlushBuffer();
    } catch (err: any) {
      alert(`Flush failed: ${err.message}`);
    } finally {
      setIsFlushing(false);
    }
  };

  if (!topology) return null;

  const totalBuffered = (topology.innerGateway.bufferedCount || 0) + (topology.outerGateway.bufferedCount || 0);
  const isInternetOnline = topology.internet.status === 'ONLINE';
  const isOuterOnline = topology.outerGateway.status === 'ONLINE';
  const isWiredConnected = topology.wiredWallLink.status === 'connected';
  const isInnerOnline = topology.innerGateway.status === 'ONLINE';

  return (
    <div className="bg-vault-900/90 border border-vault-800 rounded-xl p-3.5 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Architecture Pipeline Flow */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-vault-400 mr-1 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-agri-400" />
            Hardware Path:
          </span>

          {/* 1. ESP Nodes */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-vault-950 border border-vault-800">
            <Cpu className="w-3 h-3 text-agri-400" />
            <span className="font-semibold text-white">ESP Nodes</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">({topology.wirelessNetwork.onlineNodes})</span>
            {topology.wirelessNetwork.offlineNodes > 0 && (
              <span className="text-[10px] text-rose-400 font-mono font-semibold">({topology.wirelessNetwork.offlineNodes} off)</span>
            )}
          </div>

          <span className="text-vault-500 font-mono text-[10px] hidden sm:inline flex items-center">
            <ArrowRight className="w-3 h-3" />
            <span className="text-[9px] text-cyan-400 font-sans ml-0.5">ESP-NOW</span>
          </span>

          {/* 2. Inner Gateway */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs ${
              isInnerOnline
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isInnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="font-semibold">Inner GW</span>
            <span className="text-[9px] font-mono opacity-80">(Inside Vault)</span>
          </div>

          <span className="text-vault-500 font-mono text-[10px] hidden sm:inline flex items-center">
            <ArrowRight className="w-3 h-3" />
            <span className="text-[9px] text-amber-400 font-sans ml-0.5">RS-485 Wall Cable</span>
          </span>

          {/* 3. RS-485 Wall Link */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${
              isWiredConnected
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <Cable className="w-3 h-3" />
            <span className="font-semibold">Wired Link</span>
            <span className="text-[10px] uppercase font-mono font-bold">
              {isWiredConnected ? 'Connected' : 'Cut'}
            </span>
          </div>

          <span className="text-vault-500 font-mono text-[10px] hidden sm:inline">
            <ArrowRight className="w-3 h-3" />
          </span>

          {/* 4. Outer Gateway */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs ${
              isOuterOnline
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isOuterOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-semibold">Outer GW</span>
            <span className="text-[9px] font-mono opacity-80">(Perimeter)</span>
          </div>

          <span className="text-vault-500 font-mono text-[10px] hidden sm:inline">
            <ArrowRight className="w-3 h-3" />
          </span>

          {/* 5. Internet Uplink */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs ${
              isInternetOnline
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            {isInternetOnline ? <Globe className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
            <span className="font-semibold">Internet WAN</span>
            <span className="text-[10px] uppercase font-mono font-bold">
              {isInternetOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Buffering Status & Flush Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {totalBuffered > 0 && (
            <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-500/50 text-amber-300 px-3 py-1 rounded-lg text-xs animate-pulse">
              <HardDrive className="w-3.5 h-3.5" />
              <span>
                <strong>{totalBuffered}</strong> readings buffered in gateway memory
              </span>
            </div>
          )}

          {lastFlushedMessage && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lastFlushedMessage}
            </span>
          )}

          {totalBuffered > 0 && isInternetOnline && isOuterOnline && isWiredConnected && (
            <button
              onClick={handleFlush}
              disabled={isFlushing}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isFlushing ? 'animate-spin' : ''}`} />
              <span>Flush & Replay Buffer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
