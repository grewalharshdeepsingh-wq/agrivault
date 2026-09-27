import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Area, ESPDevice, Sensor, Alert, RelayDevice, StorageHealthInsight } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  Wind,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Power,
  ToggleRight,
  Cpu,
  History,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trash2,
  Unlink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AreaDetailProps {
  areaId: string;
  onBack: () => void;
  onSelectDevice: (deviceId: string) => void;
}

export const AreaDetail: React.FC<AreaDetailProps> = ({ areaId, onBack, onSelectDevice }) => {
  const { role } = useAuth();
  const [data, setData] = useState<{
    area: Area;
    devices: ESPDevice[];
    sensors: Sensor[];
    alerts: Alert[];
    relays: RelayDevice[];
    events: any[];
    storageInsights: StorageHealthInsight[];
    recentHistory: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeParam, setActiveParam] = useState<string>('temperature');
  const [period, setPeriod] = useState<string>('24h');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [relayActionStatus, setRelayActionStatus] = useState<string | null>(null);

  const canControlRelay = role === 'Owner' || role === 'Admin' || role === 'Operator';

  const loadData = async () => {
    try {
      const res = await api.getArea(areaId);
      setData((prev: any) => (JSON.stringify(prev) === JSON.stringify(res) ? prev : res));

      // Find sensor ID for selected parameter
      const s = res.sensors.find((x: Sensor) => x.sensor_type === activeParam);
      if (s) {
        const hist = await api.getSensorHistory(s.id, period);
        setHistoryData((prev: any) => (JSON.stringify(prev) === JSON.stringify(hist.data || []) ? prev : (hist.data || [])));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [areaId, activeParam, period]);

  const handleToggleRelay = async (relay: RelayDevice) => {
    if (!canControlRelay) {
      alert(`Role ${role} cannot actuate industrial equipment. Operator/Admin required.`);
      return;
    }
    const targetState = relay.state === 1 ? 0 : 1;
    const confirmMsg = `SAFETY CONFIRMATION: Are you sure you want to turn ${targetState === 1 ? 'ON' : 'OFF'} "${relay.name}" (${relay.target_equipment}) in this zone?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setRelayActionStatus('Transmitting actuation command...');
      await api.toggleRelay(relay.id, targetState, true, 'Manual override via Area Detail UI');
      setRelayActionStatus('Relay command executed successfully.');
      loadData();
    } catch (err: any) {
      setRelayActionStatus(`Failed: ${err.message}`);
    }
  };

  const handleDeleteArea = async () => {
    if (!data?.area) return;
    if (!window.confirm(`Are you sure you want to delete room "${data.area.name}"? All connected ESP devices will safely unassign and return to the available fleet.`)) return;
    try {
      await api.deleteArea(areaId);
      onBack();
    } catch (err: any) {
      alert(`Failed to delete room: ${err.message}`);
    }
  };

  const handleUnassignDevice = async (deviceId: string, name: string) => {
    if (!window.confirm(`Unassign "${name}" from this room? It will return to the available fleet.`)) return;
    try {
      await api.unassignDevice(deviceId);
      loadData();
    } catch (err: any) {
      alert(`Failed to unassign device: ${err.message}`);
    }
  };

  const handleDeleteDevice = async (deviceId: string, name: string) => {
    if (!window.confirm(`Permanently unregister and delete device "${name}" (${deviceId})?`)) return;
    try {
      await api.deleteDevice(deviceId);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete device: ${err.message}`);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-vault-400">
        <span className="font-mono text-xs">Loading Area Environmental Telemetry...</span>
      </div>
    );
  }

  const { area, devices, sensors, alerts, relays, events, storageInsights } = data;

  const paramOptions = [
    { id: 'temperature', label: 'Temperature', unit: '°C', color: '#f43f5e' },
    { id: 'humidity', label: 'Humidity', unit: '%', color: '#38bdf8' },
    { id: 'co2', label: 'CO2', unit: 'ppm', color: '#10b981' },
    { id: 'ethylene', label: 'Ethylene', unit: 'ppm', color: '#a855f7' },
    { id: 'ammonia', label: 'Ammonia', unit: 'ppm', color: '#f59e0b' },
    { id: 'ethanol', label: 'Ethanol / VOC', unit: 'ppm', color: '#ec4899' },
  ];

  const currentParamObj = paramOptions.find(p => p.id === activeParam);
  const currentSensor = sensors.find(s => s.sensor_type === activeParam);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-vault-400 hover:text-white transition font-medium self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Facility Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-vault-400 font-mono">Commodity:</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-vault-800 text-slate-200 border border-vault-700">
            {area.commodity}
          </span>
          <button
            onClick={handleDeleteArea}
            className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition ml-1"
            title="Delete this room and unassign its devices"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Room</span>
          </button>
        </div>
      </div>

      {/* Area Banner & Health Status */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{area.name}</h1>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                area.health_status === 'critical'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : area.health_status === 'warning'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : area.health_status === 'attention'
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              }`}
            >
              {area.health_status} ({Math.round(area.health_score)}%)
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-1">
            Zone ID: <span className="font-mono text-vault-300">{area.id}</span> | {devices.length} Connected ESP Node{devices.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Operational Reasons */}
        <div className="bg-vault-950/80 rounded-xl p-3 border border-vault-800 max-w-md text-xs">
          <p className="font-semibold text-vault-300 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-agri-400" />
            <span>Health Status Reasons:</span>
          </p>
          <ul className="space-y-1 text-slate-300 text-[11px]">
            {area.health_reasons?.map((reason, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-agri-400">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Multi-Sensor Intelligence Engine Insights */}
      {storageInsights && storageInsights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Storage Health Engine — Multi-Sensor Compound Insights
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {storageInsights.map((insight) => (
              <div
                key={insight.ruleId}
                className={`rounded-xl border p-4 shadow-md ${
                  insight.severity === 'critical'
                    ? 'bg-rose-950/40 border-rose-500/50'
                    : 'bg-amber-950/40 border-amber-500/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      insight.severity === 'critical'
                        ? 'bg-rose-500/30 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/30 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {insight.severity} Compound Condition
                  </span>
                  <h4 className="text-xs font-bold text-white">{insight.title}</h4>
                </div>
                <p className="text-xs text-slate-200 mb-2 leading-relaxed">{insight.summary}</p>

                <div className="grid sm:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-vault-800/80">
                  <div className="bg-vault-950/70 p-2 rounded border border-vault-800/60">
                    <span className="font-semibold text-amber-400 block mb-1">Possible Causes:</span>
                    <ul className="space-y-0.5 text-slate-300">
                      {insight.potentialCauses.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-vault-950/70 p-2 rounded border border-vault-800/60">
                    <span className="font-semibold text-emerald-400 block mb-1">Recommended Actions:</span>
                    <ul className="space-y-0.5 text-slate-300">
                      {insight.recommendedActions.map((a, i) => (
                        <li key={i}>• {a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Interactive Historical Chart Section */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-4">
        {/* Controls Bar: Parameter Tabs & Time Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-vault-800 pb-4">
          {/* Parameter Picker */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {paramOptions.map((p) => {
              const isActive = activeParam === p.id;
              const s = sensors.find(x => x.sensor_type === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveParam(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 border ${
                    isActive
                      ? 'bg-vault-800 text-white border-vault-600 shadow'
                      : 'bg-vault-950/60 text-vault-400 hover:text-slate-200 border-vault-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                  <span>{p.label}</span>
                  {s && <span className="font-mono text-vault-300 font-normal">{s.calibrated_reading}{p.unit}</span>}
                </button>
              );
            })}
          </div>

          {/* Time Filter Buttons */}
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800 self-start lg:self-center">
            {['1h', '6h', '24h', '7d', '30d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                  period === p ? 'bg-agri-600 text-white shadow' : 'text-vault-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Current Sensor Metric Header */}
        {currentSensor && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-vault-950/60 p-3 rounded-xl border border-vault-800/80 text-xs">
            <div>
              <span className="text-vault-400 block text-[11px]">Calibrated Reading</span>
              <span className="text-lg font-bold font-mono text-white">
                {currentSensor.calibrated_reading} {currentSensor.unit}
              </span>
            </div>
            <div>
              <span className="text-vault-400 block text-[11px]">Raw Sensor Output</span>
              <span className="text-lg font-bold font-mono text-vault-300">
                {currentSensor.raw_reading} (ADC)
              </span>
            </div>
            <div>
              <span className="text-vault-400 block text-[11px]">Rate of Change</span>
              <span className="text-sm font-bold font-mono text-slate-200 flex items-center gap-1 mt-0.5">
                {currentSensor.rate_of_change > 0 ? <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> : <TrendingDown className="w-3.5 h-3.5 text-sky-400" />}
                {currentSensor.rate_of_change > 0 ? '+' : ''}{currentSensor.rate_of_change} {currentSensor.unit} / {currentSensor.rate_of_change_period}
              </span>
            </div>
            <div>
              <span className="text-vault-400 block text-[11px]">Calibration Confidence</span>
              <span className="text-sm font-semibold text-emerald-400 mt-0.5 block">
                {currentSensor.confidence_score}% ({currentSensor.calibration_status})
              </span>
            </div>
          </div>
        )}

        {/* Recharts Line Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(timeStr) => {
                  try {
                    const d = new Date(timeStr);
                    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                  } catch {
                    return timeStr;
                  }
                }}
              />
              <YAxis stroke="#64748b" fontSize={10} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={`${currentParamObj?.label} (${currentParamObj?.unit})`}
                stroke={currentParamObj?.color || '#10b981'}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Relays & Physical Hardware Nodes */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Relay Actuation Card */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ToggleRight className="w-4 h-4 text-agri-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Relay Equipment Actuators
              </h3>
            </div>
            {relayActionStatus && (
              <span className="text-[11px] text-vault-400 font-mono animate-pulse">{relayActionStatus}</span>
            )}
          </div>

          {relays.length === 0 ? (
            <p className="text-xs text-vault-400 py-4">No relay actuators mapped to this area.</p>
          ) : (
            <div className="space-y-3">
              {relays.map((r) => (
                <div
                  key={r.id}
                  className="bg-vault-950 p-3.5 rounded-xl border border-vault-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{r.name}</h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-vault-800 text-vault-400">
                        {r.gpio_pin}
                      </span>
                    </div>
                    <p className="text-xs text-vault-400 mt-0.5">Target: {r.target_equipment} | Mode: {r.mode}</p>
                    <p className="text-[10px] text-vault-500 font-mono mt-0.5">
                      Last Switched: {new Date(r.last_switched).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                        r.state === 1
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-vault-800 text-vault-400'
                      }`}
                    >
                      {r.state === 1 ? 'ON (ACTIVE)' : 'OFF'}
                    </span>

                    <button
                      onClick={() => handleToggleRelay(r)}
                      disabled={!canControlRelay}
                      className={`p-2 rounded-lg transition ${
                        r.state === 1
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                      } disabled:opacity-40 disabled:pointer-events-none`}
                      title="Manual safety toggle"
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected Hardware ESP Devices */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-agri-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Connected ESP Nodes
              </h3>
            </div>
            <span className="text-xs text-vault-400 font-mono">{devices.length} Nodes</span>
          </div>

          <div className="space-y-2.5">
            {devices.map((d) => (
              <div
                key={d.id}
                onClick={() => onSelectDevice(d.id)}
                className="bg-vault-950 p-3 rounded-xl border border-vault-800 hover:border-vault-700 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">{d.user_name}</h4>
                    <span className="text-[10px] font-mono text-vault-400">({d.id})</span>
                  </div>
                  <p className="text-[11px] text-vault-400 mt-0.5">
                    IP: {d.ip_address} | Signal: {d.signal_rssi} dBm | Battery: {d.battery_voltage}V
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      d.is_online === 1 ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  ></span>
                  <span className="text-[11px] font-mono font-medium text-vault-300 mr-2">
                    {d.is_online === 1 ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnassignDevice(d.id, d.user_name || d.id);
                    }}
                    className="px-2 py-1 rounded bg-vault-800 hover:bg-vault-700 text-amber-300 hover:text-amber-200 text-[10px] font-semibold flex items-center gap-1 border border-vault-700 transition"
                    title="Unassign this ESP from this room"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Unassign</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDevice(d.id, d.user_name || d.id);
                    }}
                    className="p-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-400 hover:text-rose-200 transition border border-rose-500/30"
                    title="Permanently remove and unregister device"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
