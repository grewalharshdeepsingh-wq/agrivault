import React from 'react';
import { useApp } from '../context/AppContext';
import { AreaCard } from '../components/AreaCard';
import {
  Building2,
  Cpu,
  Layers,
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  Radio,
  ArrowRight,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';

interface DashboardProps {
  onSelectArea: (areaId: string) => void;
  onNavigateToDevices: () => void;
  onNavigateToAlerts: () => void;
  onNavigateToSimulation: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectArea,
  onNavigateToDevices,
  onNavigateToAlerts,
  onNavigateToSimulation
}) => {
  const { overview, setShowOnboarding } = useApp();

  const areas = overview?.areas || [];
  const facility = overview?.facility;
  const connectedESPs = overview?.connectedESPs || 0;
  const offlineESPs = overview?.offlineESPs || 0;
  const activeAlerts = overview?.activeAlertsCount || 0;
  const criticalAlerts = overview?.criticalAlertsCount || 0;
  const avgTemp = overview?.avgTemp !== undefined ? overview.avgTemp : '--';
  const avgHum = overview?.avgHum !== undefined ? overview.avgHum : '--';
  const co2Status = overview?.co2Status || 'Normal';
  const gasStatus = overview?.gasStatus || 'Normal';
  const gateway = overview?.gateway;

  return (
    <div className="space-y-6">
      {/* Top Facility Banner */}
      <div className="bg-gradient-to-r from-vault-900 via-vault-850 to-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-agri-500/5 to-transparent pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-agri-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>Industrial Facility Monitoring</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
              {facility?.name || 'ABC Cold Storage — Central Hub'}
            </h1>
            <p className="text-xs lg:text-sm text-vault-300 mt-1 max-w-2xl">
              {facility?.description ||
                'Real-time automated environmental intelligence for cold rooms, controlled atmosphere storage, and bulk potato vaults.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onNavigateToSimulation}
              className="px-3 py-2 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate Scenarios</span>
            </button>
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-agri-600/30 transition"
            >
              <span>Setup Wizard</span>
            </button>
          </div>
        </div>

        {/* High-Level Industrial KPI Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          {/* Active Areas */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Active Areas</span>
              <Layers className="w-3.5 h-3.5 text-vault-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{areas.length}</p>
            <span className="text-[10px] text-vault-500">Monitored Zones</span>
          </div>

          {/* Connected ESPs */}
          <div
            onClick={onNavigateToDevices}
            className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3 cursor-pointer hover:border-vault-700 transition"
          >
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Connected ESPs</span>
              <Cpu className="w-3.5 h-3.5 text-agri-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-white">{connectedESPs}</span>
              {offlineESPs > 0 && (
                <span className="text-xs font-mono text-rose-400 font-semibold">({offlineESPs} off)</span>
              )}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">Auto-Discovery Active</span>
          </div>

          {/* Active Alerts */}
          <div
            onClick={onNavigateToAlerts}
            className={`rounded-xl p-3 border cursor-pointer transition ${
              criticalAlerts > 0
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                : activeAlerts > 0
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-vault-950/70 border-vault-800/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1 text-vault-400">
              <span>Active Alerts</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{activeAlerts}</p>
            <span className="text-[10px] text-vault-400">
              {criticalAlerts > 0 ? `${criticalAlerts} Critical Attention` : 'All Thresholds Nominal'}
            </span>
          </div>

          {/* Average Facility Temp */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Facility Avg Temp</span>
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{avgTemp}°C</p>
            <span className="text-[10px] text-vault-500">Across All Vaults</span>
          </div>

          {/* Average Humidity */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Facility Avg Hum</span>
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{avgHum}%</p>
            <span className="text-[10px] text-vault-500">Target 80-95%</span>
          </div>

          {/* CO2 & Gas Status */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Air & Gas Quality</span>
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white mt-1">
              CO2: <span className={co2Status === 'Elevated' ? 'text-amber-400' : 'text-emerald-400'}>{co2Status}</span>
            </p>
            <p className="text-[11px] text-vault-400 font-medium">
              VOC/NH3: <span className={gasStatus === 'Elevated' ? 'text-amber-400' : 'text-emerald-400'}>{gasStatus}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Areas Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Monitored Storage Areas</h2>
          <p className="text-xs text-vault-400">
            Real-time multi-sensor values, rate of change trends, and algorithmic area health scores.
          </p>
        </div>
      </div>

      {/* Area Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        {areas.map((area: any) => (
          <AreaCard
            key={area.id}
            area={area}
            onClick={() => onSelectArea(area.id)}
          />
        ))}
      </div>

      {/* Gateway & Offline Resilience Notice */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-200">
              Raspberry Pi Gateway 01 ({gateway?.ip_address || '192.168.1.100'})
            </p>
            <p className="text-vault-400">
              {gateway?.status_detail || 'Online — Local Wi-Fi Mesh operating with local SQLite fallback buffer.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-2.5 py-1 rounded bg-vault-950 border border-vault-800 text-[11px] font-mono text-agri-400">
            BUFFER: 0 PENDING
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            CLOUD SYNCED
          </span>
        </div>
      </div>
    </div>
  );
};
