import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { GatewayTopology } from '../types';
import {
  Sliders,
  Play,
  Pause,
  AlertTriangle,
  Flame,
  Droplets,
  Wind,
  Apple,
  Skull,
  Wine,
  WifiOff,
  HardDriveDownload,
  Sparkles,
  ShieldAlert,
  Globe,
  Radio,
  Cable,
  Database,
  RefreshCw,
  Cpu,
  Power,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';

export const SimulationPage: React.FC = () => {
  const { simulationStatus, setSimulationScenario, refreshOverview } = useApp();
  const [activeScenario, setActiveScenario] = useState(simulationStatus?.activeScenario || 'normal');
  const [topology, setTopology] = useState<GatewayTopology | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]);

  // Local state for link failures
  const [internetFailed, setInternetFailed] = useState(false);
  const [wiredFailed, setWiredFailed] = useState(false);
  const [innerGatewayFailed, setInnerGatewayFailed] = useState(false);

  const loadData = async () => {
    try {
      const [top, simNodes] = await Promise.all([
        api.getGatewayTopology(),
        fetch('/api/simulation/nodes').then((r) => r.json()).catch(() => [])
      ]);
      setTopology(top);
      if (Array.isArray(simNodes)) setNodes(simNodes);
      if (top) {
        setInternetFailed(top.internet?.status === 'OFFLINE');
        setWiredFailed(top.wiredWallLink?.status === 'disconnected');
        setInnerGatewayFailed(top.innerGateway?.status === 'OFFLINE');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleFailure = async (type: 'internet' | 'wired_link' | 'inner_gateway', currentFailed: boolean) => {
    const nextFailed = !currentFailed;
    try {
      if (type === 'internet') setInternetFailed(nextFailed);
      if (type === 'wired_link') setWiredFailed(nextFailed);
      if (type === 'inner_gateway') setInnerGatewayFailed(nextFailed);

      await api.toggleNetworkFailure(type, nextFailed);
      await loadData();
      await refreshOverview();
    } catch (e: any) {
      alert(`Failed to toggle ${type}: ${e.message}`);
    }
  };

  const handleFlushBuffer = async () => {
    setIsFlushing(true);
    try {
      const res = await api.flushGatewayBuffer();
      alert(`Buffer Flushed Successfully! ${res.flushedCount || 0} readings written to database.`);
      await loadData();
      await refreshOverview();
    } catch (e: any) {
      alert(`Flush failed: ${e.message}`);
    } finally {
      setIsFlushing(false);
    }
  };

  const handleToggleNode = async (deviceId: string, currentlyOffline: boolean) => {
    try {
      await api.toggleSimulatedNode(deviceId, !currentlyOffline);
      await loadData();
    } catch (e: any) {
      alert(`Failed to toggle node: ${e.message}`);
    }
  };

  const scenarios = [
    {
      id: 'normal',
      title: 'Nominal Cold Storage Operations',
      desc: 'Balanced ambient temperatures (1.8°C - 5.2°C), stable humidity (88% - 92%), CO2 < 1,200 ppm, nominal trace gases.',
      icon: Sparkles,
      color: 'text-emerald-400',
      badge: 'Baseline'
    },
    {
      id: 'temp_spike',
      title: 'Refrigeration Failure / Thermal Spike',
      desc: 'Simulates rapid thermal runaway in Area 1 (Potato Storage) climbing up to 8.8°C to trigger critical temperature alarm & cooling relay.',
      icon: Flame,
      color: 'text-rose-400',
      badge: 'Temp Alarm'
    },
    {
      id: 'humidity_spike',
      title: 'Condensation / High-Humidity Saturation',
      desc: 'Relative humidity in Area 2 surges to 98% simulating evaporator coil defrost water pooling and condensation risk.',
      icon: Droplets,
      color: 'text-sky-400',
      badge: 'Condensation'
    },
    {
      id: 'co2_spike',
      title: 'Heavy Produce Respiration CO2 Buildup',
      desc: 'Potato respiration accelerates, generating CO2 up to 1,950 ppm to test fresh-air purge damper activation rules.',
      icon: Wind,
      color: 'text-amber-400',
      badge: 'Air Stagnation'
    },
    {
      id: 'gas_anomaly_ethylene',
      title: 'Ethylene Volatile Surge (Early Ripening)',
      desc: 'Ethylene surges to 0.18 ppm in Area 3 (Controlled Atmosphere Vault) simulating premature apple ripening / sprouting induction.',
      icon: Apple,
      color: 'text-purple-400',
      badge: 'Ripening'
    },
    {
      id: 'gas_anomaly_ammonia',
      title: 'Ammonia Refrigerant Circuit Pin-Hole Leak (MQ-135)',
      desc: 'MQ-135 detects surging NH3 ammonia vapors (6.8 ppm) coupled with rising temperatures, simulating an evaporator coil pin-hole leak.',
      icon: Skull,
      color: 'text-rose-400',
      badge: 'Refrigerant Breach'
    },
    {
      id: 'gas_anomaly_ethanol',
      title: 'Anaerobic Fermentation / Deep-Stack Rot (MQ-3)',
      desc: 'MQ-3 analog sensor detects rising ethanol volatiles (>3.2 ppm) indicating anaerobic core respiration and potential bacterial soft rot.',
      icon: Wine,
      color: 'text-pink-400',
      badge: 'Fermentation'
    },
    {
      id: 'multi_anomaly',
      title: 'Compound Spoilage Risk (Multi-Sensor Rule)',
      desc: 'Simultaneously drives Temperature, Humidity, and CO2 outside preferred limits to activate the Multi-Sensor Storage Health Engine.',
      icon: ShieldAlert,
      color: 'text-rose-500',
      badge: 'Compound'
    },
    {
      id: 'sensor_offline',
      title: 'ESP32 Node Heartbeat Loss / Watchdog Test',
      desc: 'Halts heartbeats from AGR-ESP-001. Gateway watchdog detects silence for >60s and generates a Device Offline Alert.',
      icon: WifiOff,
      color: 'text-amber-400',
      badge: 'Watchdog Test'
    },
    {
      id: 'gateway_offline',
      title: 'WAN / Internet Connection Loss & Buffering',
      desc: 'Simulates internet link severance. Telemetry accumulates in gateway memory ring-buffer without data loss, flushing on restore.',
      icon: HardDriveDownload,
      color: 'text-indigo-400',
      badge: 'Buffer Test'
    }
  ];

  const handleSelectScenario = async (scId: string) => {
    setActiveScenario(scId);
    await setSimulationScenario(scId);
  };

  const totalBuffered = (topology?.innerGateway?.bufferedCount || 0) + (topology?.outerGateway?.bufferedCount || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Sliders className="w-4 h-4" />
          <span>Industrial Hardware Testbed</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Hardware Simulation & Anomaly Test Laboratory
        </h1>
        <p className="text-xs text-vault-400">
          Inject real-world cold-chain hardware failure scenarios: simulate insulated-wall RS-485 link cut, Internet WAN drops, sensor watchdog timeouts, and offline buffer persistence.
        </p>
      </div>

      {/* Hardware Link & Offline Buffering Control Center */}
      <div className="bg-gradient-to-r from-vault-900 via-vault-950 to-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-vault-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Multi-Tier Network Outage & Gateway Buffering Simulator</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  SECTION 15 RESILIENCE
                </span>
              </h3>
              <p className="text-xs text-vault-400 mt-0.5">
                Sever physical communication layers to verify that sensor packets buffer in Inner/Outer gateway FIFO queues without data loss.
              </p>
            </div>
          </div>

          {/* Buffer Flush Trigger */}
          <button
            onClick={handleFlushBuffer}
            disabled={isFlushing || totalBuffered === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md ${
              totalBuffered > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-black animate-pulse'
                : 'bg-vault-800 text-vault-500 cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFlushing ? 'animate-spin' : ''}`} />
            <span>Flush Buffer ({totalBuffered} Queued)</span>
          </button>
        </div>

        {/* Live Topology Status Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Internet Link */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            internetFailed
              ? 'bg-rose-950/30 border-rose-500/60 text-rose-300'
              : 'bg-vault-900/90 border-emerald-500/40 text-emerald-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-vault-400">WAN Uplink</span>
              <Globe className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm mb-2">
              {internetFailed ? 'DISCONNECTED (WAN DOWN)' : 'ONLINE (CONNECTED)'}
            </div>
            <button
              onClick={() => handleToggleFailure('internet', internetFailed)}
              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition ${
                internetFailed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {internetFailed ? 'Restore Internet' : 'Sever Internet WAN'}
            </button>
          </div>

          {/* Outer Gateway */}
          <div className="p-3 rounded-xl border bg-vault-900/90 border-vault-700/80 text-vault-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-vault-400">Outer GW (Outside)</span>
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mb-2">
              <div className="font-bold text-sm text-white">GW-OUTER-01</div>
              <div className="text-[11px] font-mono text-cyan-300">
                Buffer: {topology?.outerGateway?.bufferedCount || 0} / 5,000 pkts
              </div>
            </div>
            <div className="text-[10px] text-vault-400 font-mono">
              Role: WAN MQTT Uplink
            </div>
          </div>

          {/* Wired Wall Link (RS-485) */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            wiredFailed
              ? 'bg-rose-950/30 border-rose-500/60 text-rose-300'
              : 'bg-vault-900/90 border-emerald-500/40 text-emerald-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-vault-400">Wired Wall Link (RS-485)</span>
              <Cable className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm mb-2">
              {wiredFailed ? 'SEVERED (CABLE CUT)' : 'CONNECTED (RS-485 ACTIVE)'}
            </div>
            <button
              onClick={() => handleToggleFailure('wired_link', wiredFailed)}
              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition ${
                wiredFailed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {wiredFailed ? 'Reconnect RS-485' : 'Cut RS-485 Link'}
            </button>
          </div>

          {/* Inner Gateway */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            innerGatewayFailed
              ? 'bg-rose-950/30 border-rose-500/60 text-rose-300'
              : 'bg-vault-900/90 border-vault-700/80 text-vault-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-vault-400">Inner GW (Inside Vault)</span>
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mb-2">
              <div className="font-bold text-sm text-white">GW-INNER-01</div>
              <div className="text-[11px] font-mono text-emerald-300">
                Buffer: {topology?.innerGateway?.bufferedCount || 0} / 5,000 pkts
              </div>
            </div>
            <button
              onClick={() => handleToggleFailure('inner_gateway', innerGatewayFailed)}
              className={`w-full py-1.5 rounded-lg text-xs font-semibold transition ${
                innerGatewayFailed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {innerGatewayFailed ? 'Power On Inner GW' : 'Power Off Inner GW'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Node Heartbeat Toggles */}
      {nodes.length > 0 && (
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-agri-400" />
                <span>Simulated Node Heartbeat Controller</span>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                  [SIMULATED]
                </span>
              </h3>
              <p className="text-xs text-vault-400 mt-0.5">
                Toggle individual sensor nodes online or offline to verify node heartbeat loss, watchdog warnings, and cold-store alert triggering.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {nodes.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  n.offline
                    ? 'bg-rose-950/20 border-rose-900/60'
                    : 'bg-vault-950/80 border-vault-800'
                }`}
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{n.name}</span>
                    <span className="text-[9px] font-mono text-purple-300 bg-purple-500/20 px-1 py-0.2 rounded">
                      SIM
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-vault-400 truncate">
                    {n.id} • {n.mac}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleNode(n.id, Boolean(n.offline))}
                  className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition flex items-center gap-1 ${
                    n.offline
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{n.offline ? 'Offline' : 'Online'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prominent Simulation Label Notice */}
      <div className="bg-indigo-950/40 border border-indigo-500/50 rounded-xl p-4 text-xs flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-white">Simulation Engine Active</p>
            <p className="text-indigo-200">
              Virtual IoT fleet is publishing telemetry every 3.5s through Inner Gateway model with DS18B20, DHT11, MQ3, and MQ135 metrics. All synthetic readings are tagged with <code className="bg-indigo-900/60 px-1 py-0.5 rounded text-indigo-300 font-mono">[SIMULATED]</code>.
            </p>
          </div>
        </div>

        <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-900 text-indigo-200 border border-indigo-700 shrink-0">
          SCENARIO: {activeScenario.toUpperCase()}
        </span>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isSelected = activeScenario === sc.id;

          return (
            <div
              key={sc.id}
              onClick={() => handleSelectScenario(sc.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-vault-850 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
                  : 'bg-vault-900 border-vault-800 hover:border-vault-700 hover:bg-vault-850/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg bg-vault-950 border border-vault-800/80 ${sc.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{sc.title}</h3>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      isSelected
                        ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/40'
                        : 'bg-vault-950 text-vault-400 border-vault-800'
                    }`}
                  >
                    {sc.badge}
                  </span>
                </div>

                <p className="text-xs text-vault-300 leading-relaxed pl-11">{sc.desc}</p>
              </div>

              <div className="pt-3 mt-3 border-t border-vault-800/80 flex items-center justify-between text-xs pl-11">
                <span className="text-[11px] font-mono text-vault-400">
                  {isSelected ? '✓ Currently Emulating' : 'Click to Activate'}
                </span>
                <button
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-vault-800 text-vault-300 hover:text-white hover:bg-vault-700'
                  }`}
                >
                  {isSelected ? 'Active' : 'Trigger'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
