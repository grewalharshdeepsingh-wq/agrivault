import React, { useState, useEffect } from 'react';
import {
  Radio,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Clock,
  Layers,
  Cpu,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

export const LiveMonitoringPage: React.FC = () => {
  const { devices, areas, overview } = useApp();
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Flatten all sensors from all devices
  const allSensors: any[] = [];
  devices.forEach((dev: any) => {
    if (dev.sensors && Array.isArray(dev.sensors)) {
      dev.sensors.forEach((s: any) => {
        allSensors.push({
          ...s,
          device_name: dev.user_name || dev.id,
          device_id: dev.id,
          is_device_online: dev.is_online === 1,
          area_id: dev.area_id,
          area_name: dev.area_name || 'Unassigned Zone',
          is_simulated: dev.is_simulated === 1
        });
      });
    }
  });

  const filteredSensors = selectedAreaId === 'all'
    ? allSensors
    : allSensors.filter((s) => s.area_id === selectedAreaId);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Live Environmental Sensory Grid</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Stream</span>
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-1">
            Zero-fabrication telemetry grid directly displaying authenticated ESP32 readings across cold store sectors.
          </p>
        </div>

        {/* Zone Selector Filter */}
        <div className="flex items-center gap-3">
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="bg-vault-900 border border-vault-750 text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-agri-500"
          >
            <option value="all">All Storage Zones ({allSensors.length} sensors)</option>
            {areas.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name} ({a.commodity})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Live Sensor Cards */}
      {filteredSensors.length === 0 ? (
        <div className="p-12 rounded-2xl bg-vault-900 border border-vault-800 text-center space-y-3">
          <Radio className="w-10 h-10 text-vault-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Telemetry Sensors Registered</h3>
          <p className="text-xs text-vault-400 max-w-md mx-auto">
            Connect an ESP32 sensor node via Wi-Fi or gateway provisioning to populate live sensory data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSensors.map((s: any) => {
            const isTemp = s.sensor_type === 'temperature';
            const isHum = s.sensor_type === 'humidity';
            const isGas = s.sensor_type === 'mq3' || s.sensor_type === 'mq135';

            // Staleness evaluation
            const readingTime = s.last_reading_time ? new Date(s.last_reading_time).getTime() : 0;
            const now = Date.now();
            const ageSec = Math.max(0, Math.floor((now - readingTime) / 1000));
            const isFresh = ageSec <= 90 && s.is_device_online;

            const val = s.calibrated_reading ?? s.raw_reading;

            return (
              <div
                key={s.id}
                className={`bg-vault-900 border rounded-2xl p-5 space-y-3 shadow-lg transition-all flex flex-col justify-between ${
                  !isFresh
                    ? 'border-amber-500/40 bg-vault-900/90'
                    : 'border-vault-800 hover:border-vault-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${
                        isTemp ? 'bg-rose-500/10 text-rose-400' :
                        isHum ? 'bg-sky-500/10 text-sky-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {isTemp ? <Thermometer className="w-4 h-4" /> : isHum ? <Droplets className="w-4 h-4" /> : <Wind className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white truncate max-w-[150px]">{s.name}</h3>
                        <p className="text-[10px] text-vault-400">{s.area_name}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isFresh
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {isFresh ? 'Fresh' : 'Stale'}
                    </span>
                  </div>

                  {/* Large Value Display */}
                  <div className="py-2">
                    {isFresh ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-white tracking-tight">
                          {val !== null && val !== undefined ? Number(val).toFixed(isTemp ? 1 : 0) : '--'}
                        </span>
                        <span className="text-xs text-vault-400 font-bold">{s.unit}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-400 font-mono py-1">
                        Unverified conditions
                      </div>
                    )}

                    {isGas && (
                      <p className="text-[10px] text-vault-400 italic mt-1 leading-snug">
                        Raw ADC: {s.raw_reading || 0} (Broad uncalibrated gas response)
                      </p>
                    )}
                  </div>

                  {/* Staleness Message if older than threshold */}
                  {!isFresh && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-snug">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <span>
                          {s.last_reading_time
                            ? `Last valid reading received at ${new Date(s.last_reading_time).toLocaleTimeString()}. Current conditions cannot be verified.`
                            : 'Measurement unavailable.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-vault-800 text-[10px] text-vault-500 flex items-center justify-between font-mono">
                  <span className="truncate max-w-[120px]">Node: {s.device_name}</span>
                  <span>Pin: {s.pin || 'N/A'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
