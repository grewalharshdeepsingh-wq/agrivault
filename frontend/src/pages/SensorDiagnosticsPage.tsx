import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Cpu,
  Layers,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  Search
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SensorDiagnosticsPage: React.FC = () => {
  const { devices, areas } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Gather sensors from all devices
  const sensorList: any[] = [];
  devices.forEach((dev: any) => {
    if (dev.sensors && Array.isArray(dev.sensors)) {
      dev.sensors.forEach((s: any) => {
        const readingTime = s.last_reading_time ? new Date(s.last_reading_time).getTime() : 0;
        const now = Date.now();
        const ageSec = Math.max(0, Math.floor((now - readingTime) / 1000));
        const isFresh = ageSec <= 90 && dev.is_online === 1;

        sensorList.push({
          ...s,
          device_name: dev.user_name || dev.id,
          device_id: dev.id,
          mac_address: dev.mac_address || dev.hardware_id,
          is_device_online: dev.is_online === 1,
          area_name: dev.area_name || 'Unassigned Zone',
          is_fresh: isFresh,
          age_sec: ageSec,
          staleness_warning: !isFresh
            ? (s.last_reading_time
                ? `Last valid reading received at ${new Date(s.last_reading_time).toLocaleTimeString()}. Current conditions cannot be verified.`
                : 'Measurement unavailable.')
            : null
        });
      });
    }
  });

  const filtered = sensorList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.area_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || s.sensor_type === filterType;
    return matchesSearch && matchesType;
  });

  const totalFresh = sensorList.filter((s) => s.is_fresh).length;
  const totalStale = sensorList.filter((s) => !s.is_fresh).length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sensor Health & Signal Diagnostics</h1>
          <p className="text-xs text-vault-400 mt-1">
            Zero-fabrication telemetry diagnostics verifying ADC response curves, calibration confidence, and data staleness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              {totalFresh} Fresh Probes
            </span>
            <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              {totalStale} Stale / Offline
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-vault-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search probes by sensor name, device, or storage zone..."
            className="w-full bg-vault-900 border border-vault-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-vault-500 focus:outline-none focus:border-agri-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-vault-900 border border-vault-800 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-agri-500"
        >
          <option value="all">All Sensor Technologies</option>
          <option value="temperature">DS18B20 1-Wire Temperature</option>
          <option value="humidity">DHT11 Relative Humidity</option>
          <option value="mq3">MQ-3 Volatiles Gas</option>
          <option value="mq135">MQ-135 Air Quality Gas</option>
          <option value="co2">NDIR Carbon Dioxide</option>
        </select>
      </div>

      {/* Diagnostics Table */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white">Diagnostic Signal Audit</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-vault-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Sensor Probe</th>
                <th className="p-3">Zone & Host Device</th>
                <th className="p-3">Current Value</th>
                <th className="p-3">Raw ADC</th>
                <th className="p-3">Signal Freshness</th>
                <th className="p-3">Calibration State</th>
                <th className="p-3">Plausibility Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800/60 font-mono">
              {filtered.map((s) => {
                const isGas = s.sensor_type === 'mq3' || s.sensor_type === 'mq135';
                const val = s.calibrated_reading ?? s.raw_reading;

                return (
                  <tr key={s.id} className="hover:bg-vault-850/50">
                    <td className="p-3 font-sans">
                      <span className="font-bold text-slate-200 block">{s.name}</span>
                      <span className="text-[10px] text-vault-400 font-mono">Pin: {s.pin || 'N/A'}</span>
                    </td>
                    <td className="p-3 font-sans">
                      <span className="text-slate-300 font-semibold block">{s.area_name}</span>
                      <span className="text-[10px] text-vault-400 font-mono">{s.device_name}</span>
                    </td>
                    <td className="p-3">
                      {s.is_fresh ? (
                        <span className="font-bold text-white">
                          {val !== null ? `${val} ${s.unit}` : 'N/A'}
                        </span>
                      ) : (
                        <span className="text-amber-400 text-[11px] font-sans">
                          {s.staleness_warning}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-vault-300">{s.raw_reading ?? 'N/A'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                        s.is_fresh
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {s.is_fresh ? `Fresh (${s.age_sec}s)` : 'Stale'}
                      </span>
                    </td>
                    <td className="p-3 font-sans capitalize text-slate-300">
                      {s.calibration_status || 'Factory Standard'}
                    </td>
                    <td className="p-3 font-sans">
                      {isGas ? (
                        <span className="text-[11px] text-vault-400 italic">
                          Non-selective semiconductor response
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Plausible Range</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
