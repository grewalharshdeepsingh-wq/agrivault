import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  Calendar,
  Filter,
  CheckCircle2,
  Clock
} from 'lucide-react';
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

export const AnalyticsPage: React.FC = () => {
  const { overview } = useApp();
  const [period, setPeriod] = useState<string>('24h');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [activeParam, setActiveParam] = useState<'temperature' | 'humidity' | 'co2' | 'ammonia' | 'ethanol'>('temperature');
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const areas = overview?.areas || [];

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAnalyticsSummary(period, selectedAreaId || undefined);
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period, selectedAreaId]);

  const roomStats = analyticsData?.roomStats || [];
  const timeSeries = analyticsData?.timeSeries || [];

  // Group comparative time-series data for Recharts
  // Shape: [{ timestamp: '12:00', 'Room 1': 4.2, 'Room 2': 3.9, ... }]
  const chartDataMap: Record<string, any> = {};
  const areaNameMap: Record<string, string> = {};
  roomStats.forEach((r: any) => {
    areaNameMap[r.areaId] = r.name;
  });

  timeSeries
    .filter((pt: any) => pt.sensor_type === activeParam)
    .forEach((pt: any) => {
      if (!chartDataMap[pt.timestamp]) {
        chartDataMap[pt.timestamp] = { timestamp: pt.timestamp };
      }
      const label = areaNameMap[pt.area_id] || pt.area_id;
      chartDataMap[pt.timestamp][label] = pt.val;
    });

  const chartData = Object.values(chartDataMap);

  const colors = ['#10b981', '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#6366f1'];

  // Calculate overall stability score average
  let totalStabilitySum = 0;
  let stabilityCount = 0;
  roomStats.forEach((r: any) => {
    Object.values(r.metrics || {}).forEach((m: any) => {
      if (m?.stabilityScore !== undefined) {
        totalStabilitySum += m.stabilityScore;
        stabilityCount++;
      }
    });
  });
  const avgStability = stabilityCount > 0 ? Math.round(totalStabilitySum / stabilityCount) : 96;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-agri-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>Industrial Telemetry & Environmental Intelligence</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Section Analytics & Statistical Engine
          </h1>
          <p className="text-xs text-vault-400 mt-0.5">
            Statistical deviation tracking, multi-room stability comparisons, and real-time ESP sensor performance.
          </p>
        </div>

        {/* Global Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Room Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vault-900 border border-vault-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-vault-400" />
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-vault-900">All Storage Rooms</option>
              {areas.map((a: any) => (
                <option key={a.id} value={a.id} className="bg-vault-900">
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div className="flex items-center bg-vault-900 border border-vault-800 rounded-lg p-1 text-xs">
            {[
              { id: '1h', label: '1H' },
              { id: '6h', label: '6H' },
              { id: '24h', label: '24H' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md font-mono text-xs transition ${
                  period === p.id
                    ? 'bg-agri-600 text-white font-bold shadow'
                    : 'text-vault-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadAnalytics}
            disabled={isLoading}
            className="p-2 rounded-lg bg-vault-900 hover:bg-vault-800 border border-vault-800 text-vault-300 transition"
            title="Refresh Statistical Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-agri-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Readings */}
        <div className="bg-vault-900/90 border border-vault-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
            <span>Sampled Readings</span>
            <BarChart3 className="w-4 h-4 text-agri-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">
            {analyticsData?.totalReadings?.toLocaleString() || '0'}
          </p>
          <span className="text-[10px] text-vault-500 font-mono">In selected {period} window</span>
        </div>

        {/* Environmental Stability Score */}
        <div className="bg-vault-900/90 border border-vault-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
            <span>Overall Stability Index</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold font-mono text-emerald-400">{avgStability}%</p>
            <span className="text-xs text-vault-400">Optimal Tolerance</span>
          </div>
          <span className="text-[10px] text-vault-500">Readings within target drift threshold</span>
        </div>

        {/* Active Discovered ESP Fleet */}
        <div className="bg-vault-900/90 border border-vault-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
            <span>Hardware Fleet</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold font-mono text-white">
              {analyticsData?.onlineESPs || 0}
              <span className="text-sm font-normal text-vault-400">/{analyticsData?.totalESPs || 0}</span>
            </p>
            <span className="text-xs font-semibold text-emerald-400 font-mono">ONLINE</span>
          </div>
          <span className="text-[10px] text-vault-500">ESP32 & ESP8266 Live Fleet</span>
        </div>

        {/* Excursion / Out of Bounds Alerts */}
        <div className="bg-vault-900/90 border border-vault-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
            <span>Excursion Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">
            {analyticsData?.activeAlerts || 0}
          </p>
          <span className="text-[10px] text-vault-500">Unresolved threshold warnings</span>
        </div>
      </div>

      {/* Comparative Multi-Room Trend Graph */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Comparative Multi-Room Trend Analysis
            </h2>
            <p className="text-xs text-vault-400">
              Cross-section comparison for {activeParam.toUpperCase()} across all monitored areas.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800 self-start sm:self-center">
            {[
              { id: 'temperature', label: 'Temp (°C)', icon: Thermometer },
              { id: 'humidity', label: 'Humidity (%)', icon: Droplets },
              { id: 'co2', label: 'CO2 (ppm)', icon: Wind },
              { id: 'ammonia', label: 'Ammonia (ppm)', icon: Activity },
              { id: 'ethanol', label: 'Ethanol (ppm)', icon: Activity }
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveParam(m.id as any)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                    activeParam === m.id
                      ? 'bg-agri-600 text-white shadow'
                      : 'text-vault-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-vault-500 text-xs">
              No historical data points in this timeframe. Make sure your ESP modules are connected.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {roomStats.map((room: any, idx: number) => (
                  <Line
                    key={room.areaId}
                    type="monotone"
                    dataKey={room.name}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Room-by-Room Statistical Deep-Dive Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Room & Section Statistical Reports</h2>
            <p className="text-xs text-vault-400">
              Min, max, mean, drift standard deviation, and stability rating computed per room.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {roomStats.map((room: any) => (
            <div
              key={room.areaId}
              className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-vault-800 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{room.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-vault-950 text-agri-400 font-mono border border-vault-800">
                        {room.commodity}
                      </span>
                    </div>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      {room.deviceCount} ESP Device{room.deviceCount !== 1 ? 's' : ''} assigned ({room.onlineDeviceCount} online)
                    </p>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    room.health_status === 'critical'
                      ? 'bg-rose-950/40 text-rose-300 border-rose-500/50'
                      : room.health_status === 'warning'
                      ? 'bg-amber-950/40 text-amber-300 border-amber-500/50'
                      : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50'
                  }`}>
                    {Math.round(room.health_score)}% Health Score
                  </span>
                </div>

                {/* Assigned Hardware Modules Chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {room.devices && room.devices.length > 0 ? (
                    room.devices.map((d: any) => (
                      <span
                        key={d.id}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border ${
                          d.is_online
                            ? 'bg-vault-950 text-emerald-300 border-emerald-500/30'
                            : 'bg-vault-950 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        <Cpu className="w-3 h-3 text-vault-400" />
                        <span>{d.user_name || d.id}</span>
                        <span className="text-[10px] text-vault-500 font-sans">({d.hardware_type || 'ESP'})</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.is_online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-vault-500 italic">No ESP hardware assigned to this room yet</span>
                  )}
                </div>

                {/* Statistical Breakdown Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-vault-800 text-vault-400 font-medium">
                        <th className="pb-2">Metric</th>
                        <th className="pb-2">Current</th>
                        <th className="pb-2">Min</th>
                        <th className="pb-2">Max</th>
                        <th className="pb-2">Mean</th>
                        <th className="pb-2">Std Dev</th>
                        <th className="pb-2 text-right">Stability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-vault-800/60 font-mono">
                      {[
                        { key: 'temperature', name: 'Temperature', unit: '°C' },
                        { key: 'humidity', name: 'Humidity', unit: '%' },
                        { key: 'co2', name: 'CO2', unit: 'ppm' },
                        { key: 'ammonia', name: 'Ammonia', unit: 'ppm' },
                        { key: 'ethanol', name: 'Ethanol / VOC', unit: 'ppm' }
                      ].map((param) => {
                        const m = room.metrics?.[param.key];
                        if (!m) return null;
                        return (
                          <tr key={param.key} className="hover:bg-vault-950/40 transition">
                            <td className="py-2 font-sans font-medium text-slate-200">{param.name}</td>
                            <td className="py-2 text-white font-bold">{m.current}{param.unit}</td>
                            <td className="py-2 text-vault-400">{m.min}{param.unit}</td>
                            <td className="py-2 text-vault-400">{m.max}{param.unit}</td>
                            <td className="py-2 text-vault-300">{m.avg}{param.unit}</td>
                            <td className="py-2 text-vault-400">±{m.stdDev}</td>
                            <td className="py-2 text-right">
                              <span className={`inline-flex items-center gap-1 font-bold ${
                                m.stabilityScore >= 90 ? 'text-emerald-400' : m.stabilityScore >= 70 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {m.stabilityScore}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Room Card Footer Note */}
              <div className="mt-3 pt-2 border-t border-vault-800/60 flex items-center justify-between text-[11px] text-vault-500">
                <span>Calculated over {period} rolling telemetry window</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Live Synced
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
