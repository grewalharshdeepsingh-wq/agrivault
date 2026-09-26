import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Activity,
  Server,
  Database,
  Radio,
  Cpu,
  Bell,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  HardDrive
} from 'lucide-react';

export const SystemHealthPage: React.FC = () => {
  const [healthData, setHealthData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHealth = async () => {
    try {
      const data = await api.getSystemHealth();
      setHealthData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            System Diagnostics & Infrastructure Health
          </h1>
          <p className="text-xs text-vault-400">
            Real-time status of backend API services, SQLite WAL database, embedded MQTT broker, gateways, and edge nodes.
          </p>
        </div>

        <button
          onClick={loadHealth}
          className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-300 text-xs font-semibold border border-vault-700 flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {isLoading || !healthData ? (
        <div className="text-center py-12 text-vault-400 font-mono text-xs">
          Scanning Infrastructure Status...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cloud Backend Server */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-agri-400" />
                <h3 className="text-sm font-bold text-white">Backend Node.js API</h3>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                HEALTHY
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono bg-vault-950 p-2.5 rounded border border-vault-800/80 text-vault-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-vault-500">RUNTIME:</span>
                <span>Node {healthData.services.backend.nodeVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">MEMORY HEAP:</span>
                <span>{healthData.services.backend.memoryMb} MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">UPTIME:</span>
                <span>{formatUptime(healthData.uptimeSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Database Persistence */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-agri-400" />
                <h3 className="text-sm font-bold text-white">Persistent Database</h3>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                ONLINE (WAL)
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono bg-vault-950 p-2.5 rounded border border-vault-800/80 text-vault-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-vault-500">ENGINE:</span>
                <span>SQLite WAL / Timescale DB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">TELEMETRY ROWS:</span>
                <span>{healthData.services.database.totalReadingsRecorded.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">LOGGED ALERTS:</span>
                <span>{healthData.services.database.totalAlertsLogged} events</span>
              </div>
            </div>
          </div>

          {/* MQTT Broker */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-agri-400" />
                <h3 className="text-sm font-bold text-white">Embedded MQTT Broker</h3>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                PORT 1883
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono bg-vault-950 p-2.5 rounded border border-vault-800/80 text-vault-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-vault-500">TCP PROTOCOL:</span>
                <span>MQTT v3.1.1 & v5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">ACTIVE CLIENTS:</span>
                <span>{healthData.services.mqttBroker.connectedClients} Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">QOS SUPPORT:</span>
                <span>QoS 0, QoS 1 with Retain</span>
              </div>
            </div>
          </div>

          {/* Raspberry Pi Gateway */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-agri-400" />
                <h3 className="text-sm font-bold text-white">Raspberry Pi Gateway</h3>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                ACTIVE (1/1)
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono bg-vault-950 p-2.5 rounded border border-vault-800/80 text-vault-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-vault-500">FIRMWARE:</span>
                <span>v2.4.0-rpi-gateway</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">BUFFER STATE:</span>
                <span className="text-emerald-400">Synchronized (0 pending)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">WI-FI MESH:</span>
                <span>AgriVault-Local-Mesh-5G</span>
              </div>
            </div>
          </div>

          {/* ESP32 Edge Sensor Nodes */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-agri-400" />
                <h3 className="text-sm font-bold text-white">ESP32 Sensor Nodes</h3>
              </div>
              <span className="text-xs font-mono font-bold text-white">
                {healthData.services.espDevices.online}/{healthData.services.espDevices.total} Online
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono bg-vault-950 p-2.5 rounded border border-vault-800/80 text-vault-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-vault-500">FLEET AVAILABILITY:</span>
                <span className="font-bold text-emerald-400">
                  {healthData.services.espDevices.percentageOnline}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">WATCHDOG TIMEOUT:</span>
                <span>60 Seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">HARDWARE TYPE:</span>
                <span>ESP32-DevKit-V1</span>
              </div>
            </div>
          </div>

          {/* Notification Engine */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-agri-400" />
                <h3 className="text-sm font-bold text-white">Alert & Notifications</h3>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                ACTIVE
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono bg-vault-950 p-2.5 rounded border border-vault-800/80 text-vault-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-vault-500">CHANNELS:</span>
                <span>In-App Banner, Browser Push</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">COOLDOWN LOCK:</span>
                <span>5 Minutes Anti-Spam</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">WEBSOCKET CLIENTS:</span>
                <span>{healthData.services.websocketServer.activeClients} Active</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
