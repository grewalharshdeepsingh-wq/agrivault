import React from 'react';
import { Area } from '../types';
import {
  Thermometer,
  Droplets,
  Wind,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Edit2,
  Trash2,
  X
} from 'lucide-react';

interface AreaCardProps {
  area: Area;
  onClick: () => void;
  onEditArea?: (area: Area) => void;
  onDeleteArea?: (area: Area) => void;
  onUnassignDevice?: (deviceId: string, deviceName: string) => void;
}

export const AreaCard: React.FC<AreaCardProps> = ({
  area,
  onClick,
  onEditArea,
  onDeleteArea,
  onUnassignDevice
}) => {
  const { metrics, health_status, health_score, health_reasons, name, commodity, deviceCount, activeAlertsCount } = area;

  const temp = metrics?.temperature;
  const hum = metrics?.humidity;
  const co2 = metrics?.co2;
  const eth = metrics?.ethylene;
  const nh3 = metrics?.ammonia;
  const voc = metrics?.ethanol;

  const isUnmonitored = !deviceCount || deviceCount === 0;

  // Status Styling
  const statusConfig = isUnmonitored
    ? {
        border: 'border-vault-800 hover:border-vault-700',
        badge: 'bg-vault-800 text-vault-400 border-vault-700',
        dot: 'bg-vault-500',
        label: 'Standby'
      }
    : {
        normal: {
          border: 'border-emerald-500/30 hover:border-emerald-500/60',
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
          label: 'Normal'
        },
        attention: {
          border: 'border-yellow-500/40 hover:border-yellow-500/70',
          badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
          dot: 'bg-yellow-400',
          label: 'Attention'
        },
        warning: {
          border: 'border-amber-500/50 hover:border-amber-500/80',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          dot: 'bg-amber-400',
          label: 'Warning'
        },
        critical: {
          border: 'border-rose-500/60 hover:border-rose-500',
          badge: 'bg-rose-500/25 text-rose-300 border-rose-500/60 animate-pulse',
          dot: 'bg-rose-400',
          label: 'Critical'
        },
        standby: {
          border: 'border-vault-800 hover:border-vault-700',
          badge: 'bg-vault-800 text-vault-400 border-vault-700',
          dot: 'bg-vault-500',
          label: 'Standby'
        }
      }[health_status || 'standby'];

  // Helper for Rate of Change trend
  const renderRoc = (roc?: number, unit = '', period = '30 min') => {
    if (roc === undefined || roc === 0) return null;
    const isUp = roc > 0;
    return (
      <span className={`inline-flex items-center text-[10px] font-mono ${isUp ? 'text-amber-400' : 'text-sky-400'}`}>
        {isUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
        {isUp ? '+' : ''}{roc}{unit} / {period}
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`group bg-vault-900/90 rounded-xl border ${statusConfig.border} p-4 transition-all duration-200 hover:shadow-xl hover:shadow-vault-950/50 cursor-pointer flex flex-col justify-between`}
    >
      {/* Card Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight group-hover:text-agri-400 transition">
                {name}
              </h3>
              {onEditArea && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditArea(area);
                  }}
                  className="p-1 rounded hover:bg-vault-800 text-vault-400 hover:text-agri-300 transition"
                  title="Configure / Rename Room or Assign ESPs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeleteArea && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteArea(area);
                  }}
                  className="p-1 rounded hover:bg-rose-950/60 text-vault-400 hover:text-rose-400 transition"
                  title={`Delete room "${name}"`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-vault-400 font-medium">{commodity}</p>
          </div>

          {/* Health Score & Status Badge */}
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
              {isUnmonitored ? 'Standby — No Sensor' : `${statusConfig.label} (${Math.round(health_score)}%)`}
            </span>
            {activeAlertsCount !== undefined && activeAlertsCount > 0 && (
              <span className="text-[10px] text-rose-400 font-mono font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                {activeAlertsCount} Alert{activeAlertsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Assigned ESP Modules Strip */}
        <div className="flex flex-wrap items-center gap-1.5 my-2">
          {area.devices && area.devices.length > 0 ? (
            area.devices.map((d: any) => (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${
                  d.is_online
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-950/30 text-rose-300 border-rose-500/30'
                }`}
                title={`${d.user_name || d.id} (${d.hardware_type || 'ESP'}) - ${d.is_online ? 'Online' : 'Offline'}`}
              >
                <Cpu className="w-2.5 h-2.5" />
                <span className="truncate max-w-[100px]">{d.user_name || d.id}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${d.is_online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {onUnassignDevice && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnassignDevice(d.id, d.user_name || d.id);
                    }}
                    className="ml-0.5 text-vault-400 hover:text-rose-300 hover:bg-rose-900/40 rounded p-0.5 transition"
                    title={`Unassign ${d.user_name || d.id} from this room`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-vault-500 italic flex items-center gap-1">
              <Cpu className="w-3 h-3 text-vault-600" />
              No ESP connected to this section
            </span>
          )}
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
          {/* Temperature */}
          <div className="bg-vault-950/70 rounded-lg p-2.5 border border-vault-800/80">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" /> Temp
              </span>
              <span className="text-[10px] text-vault-500 font-mono">°C</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-white">
                {temp ? temp.value.toFixed(1) : '--'}
              </span>
              {renderRoc(temp?.rateOfChange, '°C')}
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-vault-950/70 rounded-lg p-2.5 border border-vault-800/80">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span className="flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-sky-400" /> Humidity
              </span>
              <span className="text-[10px] text-vault-500 font-mono">%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-white">
                {hum ? Math.round(hum.value) : '--'}
              </span>
              {renderRoc(hum?.rateOfChange, '%')}
            </div>
          </div>

          {/* CO2 */}
          <div className="bg-vault-950/70 rounded-lg p-2.5 border border-vault-800/80">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span className="flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-emerald-400" /> CO2
              </span>
              <span className="text-[10px] text-vault-500 font-mono">ppm</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-lg font-bold font-mono ${co2 && co2.value > 1300 ? 'text-amber-400' : 'text-white'}`}>
                {co2 ? Math.round(co2.value).toLocaleString() : '--'}
              </span>
              {renderRoc(co2?.rateOfChange, '')}
            </div>
          </div>

          {/* Ethylene */}
          <div className="bg-vault-950/70 rounded-lg p-2 border border-vault-800/60">
            <span className="text-[11px] text-vault-400 block mb-0.5">Ethylene</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {eth ? `${eth.value.toFixed(2)} ppm` : '--'}
            </span>
          </div>

          {/* Ammonia */}
          <div className="bg-vault-950/70 rounded-lg p-2 border border-vault-800/60">
            <span className="text-[11px] text-vault-400 block mb-0.5">Ammonia</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {nh3 ? `${nh3.value.toFixed(1)} ppm` : '--'}
            </span>
          </div>

          {/* Ethanol / VOC */}
          <div className="bg-vault-950/70 rounded-lg p-2 border border-vault-800/60">
            <span className="text-[11px] text-vault-400 block mb-0.5">Ethanol / VOC</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {voc ? `${voc.value.toFixed(1)} ppm` : '--'}
            </span>
          </div>
        </div>

        {/* Operational Health Reasons */}
        {health_reasons && health_reasons.length > 0 && (
          <div className="mt-2 text-xs bg-vault-950/40 rounded p-2 border border-vault-800/40">
            <p className="text-[11px] font-semibold text-vault-400 mb-0.5">Operational Assessment:</p>
            <ul className="space-y-0.5 text-[11px] text-slate-300">
              {health_reasons.slice(0, 2).map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-agri-400 shrink-0">•</span>
                  <span className="line-clamp-1">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="pt-3 mt-2 border-t border-vault-800/60 flex items-center justify-between text-xs text-vault-400">
        <span className="font-mono text-[11px]">
          {deviceCount || 1} ESP Node{deviceCount !== 1 ? 's' : ''} Online
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-agri-400 group-hover:translate-x-1 transition-transform">
          Open Telemetry <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};
