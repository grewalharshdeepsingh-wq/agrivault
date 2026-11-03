import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Radio,
  Sparkles,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Snowflake,
  Wind,
  Thermometer,
  Droplets,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Plus,
  Trash2,
  Cpu
} from 'lucide-react';
import { api } from '../api/client';
import { wsManager } from '../api/websocket';
import { stateMesh, FakeEspDefinition } from '../api/stateMesh';
import { getAllFoodProfiles, getFoodProfile } from '../api/foodProfiles';
import { RemoteTelemetryConfig, getRemoteTelemetryConfig, setRemoteTelemetryConfig } from '../api/firebase';

interface Preset {
  id: string;
  name: string;
  condition: string;
  icon: any;
  badge: string;
  badgeColor: string;
  description: string;
  values: {
    targetTemperature: number;
    targetCo2: number;
    targetHumidity: number;
    targetAmmonia: number;
    targetEthanol: number;
    targetEthylene: number;
  };
}

const PRESETS: Preset[] = [
  {
    id: 'rotting',
    name: 'Food Rotting & Spoilage',
    condition: 'rotting',
    icon: Flame,
    badge: 'Rotting Produce',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    description: '19°C warm storage with anaerobic fermentation alcohols and protein decomposition amines.',
    values: {
      targetTemperature: 19.0,
      targetCo2: 55,
      targetHumidity: 94.5,
      targetAmmonia: 6.8,
      targetEthanol: 3.8,
      targetEthylene: 0.24
    }
  },
  {
    id: 'normal',
    name: 'Nominal Cold Storage',
    condition: 'normal',
    icon: Snowflake,
    badge: 'Fresh & Healthy',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    description: 'Balanced holding conditions (4°C, 89% RH, minimal trace gases) for long-term dormancy.',
    values: {
      targetTemperature: 4.0,
      targetCo2: 950,
      targetHumidity: 89.0,
      targetAmmonia: 0.8,
      targetEthanol: 0.3,
      targetEthylene: 0.02
    }
  },
  {
    id: 'thermal_runaway',
    name: 'Refrigeration Failure',
    condition: 'overheating',
    icon: Zap,
    badge: 'Thermal Runaway',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    description: 'Compressor trip driving rapid warming (24°C) and heavy respiration buildup.',
    values: {
      targetTemperature: 24.5,
      targetCo2: 1750,
      targetHumidity: 78.0,
      targetAmmonia: 2.1,
      targetEthanol: 1.2,
      targetEthylene: 0.15
    }
  },
  {
    id: 'ammonia_leak',
    name: 'Refrigerant Circuit Leak',
    condition: 'refrigerant_leak',
    icon: Wind,
    badge: 'Ammonia Spike',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    description: 'Pinhole coil leak flooding vault with 8.5 ppm NH3 vapors.',
    values: {
      targetTemperature: 11.5,
      targetCo2: 800,
      targetHumidity: 92.0,
      targetAmmonia: 8.5,
      targetEthanol: 0.4,
      targetEthylene: 0.04
    }
  }
];

export const RemoteControlPage: React.FC = () => {
  const [config, setConfig] = useState<RemoteTelemetryConfig>(getRemoteTelemetryConfig());
  const [isApplying, setIsApplying] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [autoApply, setAutoApply] = useState(true);
  const [fakeEsps, setFakeEsps] = useState<FakeEspDefinition[]>(stateMesh.getFakeEsps());
  const [newFakeName, setNewFakeName] = useState('');
  const [newFakeFood, setNewFakeFood] = useState('apple');
  const [showAddFake, setShowAddFake] = useState(false);
  const [livePreview, setLivePreview] = useState<{
    temperature: number;
    co2: number;
    humidity: number;
    ammonia: number;
    ethanol: number;
    ethylene: number;
  }>({
    temperature: 19.0,
    co2: 55,
    humidity: 94.5,
    ammonia: 6.8,
    ethanol: 3.8,
    ethylene: 0.24
  });

  // Keep state synchronized with remote config events from Firebase
  useEffect(() => {
    const unsub = wsManager.on('remote_config_updated', (newCfg: RemoteTelemetryConfig) => {
      setConfig((prev) => ({ ...prev, ...newCfg }));
    });
    return unsub;
  }, []);

  // Compute live fluctuating preview
  useEffect(() => {
    const updatePreview = () => {
      const tSec = Date.now() / 1000;
      const isCycling = config.enableCycling !== false;
      const baseTemp = config.targetTemperature;
      const baseCo2 = config.targetCo2;
      const baseHum = config.targetHumidity;
      const baseNh3 = config.targetAmmonia;
      const baseEth = config.targetEthanol;
      const baseEthylene = config.targetEthylene;

      const tempNoise = isCycling ? 0.65 * Math.sin((tSec * 2 * Math.PI) / 60) : 0;
      const co2Noise = isCycling ? 3.2 * Math.sin((tSec * 2 * Math.PI) / 45 + 1.0) : 0;
      const humNoise = isCycling ? 1.5 * Math.sin((tSec * 2 * Math.PI) / 75 + 2.0) : 0;
      const nh3Noise = isCycling ? 0.6 * Math.sin((tSec * 2 * Math.PI) / 50 + 0.5) : 0;
      const ethNoise = isCycling ? 0.4 * Math.sin((tSec * 2 * Math.PI) / 40 + 1.5) : 0;
      const ethyleneNoise = isCycling ? 0.04 * Math.sin((tSec * 2 * Math.PI) / 80 + 3.0) : 0;

      setLivePreview({
        temperature: +(baseTemp + tempNoise).toFixed(1),
        co2: Math.max(0, Math.round(baseCo2 + co2Noise)),
        humidity: Math.min(100, Math.max(0, +(baseHum + humNoise).toFixed(1))),
        ammonia: Math.max(0, +(baseNh3 + nh3Noise).toFixed(2)),
        ethanol: Math.max(0, +(baseEth + ethNoise).toFixed(2)),
        ethylene: Math.max(0, +(baseEthylene + ethyleneNoise).toFixed(3))
      });
    };

    updatePreview();
    const interval = setInterval(updatePreview, 1000);
    return () => clearInterval(interval);
  }, [config]);

  const handleApply = async (patch: Partial<RemoteTelemetryConfig>) => {
    setIsApplying(true);
    try {
      await setRemoteTelemetryConfig(patch);
      setFeedbackMsg('Parameters successfully transmitted to Firebase Cloud RTDB.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (e: any) {
      setFeedbackMsg(`Transmission failed: ${e.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const handleSliderChange = (key: keyof RemoteTelemetryConfig, val: any) => {
    const updated = { ...config, [key]: val };
    setConfig(updated);
    if (autoApply) {
      handleApply({ [key]: val });
    }
  };

  const handlePresetSelect = (preset: Preset) => {
    const patch = {
      ...preset.values,
      condition: preset.condition
    };
    setConfig((prev) => ({ ...prev, ...patch }));
    handleApply(patch);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Cloud Database Remote Controller</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>Cloud Connected</span>
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-1">
            Remotely command baseline values in the Vercel & Firebase database while keeping dynamic time-based sinusoidal cycling active.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/remote_control.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 flex items-center gap-1.5 transition"
            title="Open standalone mobile remote app"
          >
            <span>Open Standalone Web App</span>
            <ExternalLink className="w-3.5 h-3.5 text-agri-400" />
          </a>
        </div>
      </div>

      {/* Cloud Status Banner */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Firebase Realtime Cloud Database</h3>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">● ACTIVE SYNCHRONIZATION</span>
            </div>
            <p className="text-[11px] text-vault-400 font-mono">
              Cluster: agrivault-iot-7a2f-default-rtdb.asia-southeast1.firebasedatabase.app
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <label className="flex items-center gap-2 text-xs text-vault-300 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="rounded bg-vault-950 border-vault-700 text-agri-500 focus:ring-0"
            />
            <span>Instant Auto-Transmit</span>
          </label>

          <button
            onClick={() => handleApply(config)}
            disabled={isApplying}
            className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-agri-600/30 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
            <span>{isApplying ? 'Pushing...' : 'Push to Cloud DB'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Live Cycling Telemetry Readout Strip */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-vault-400 mb-2.5 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-agri-400 animate-pulse" />
          <span>Live Cycling Telemetry Output (Broadcasting to All Connected Vaults)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-3">
            <span className="text-[10px] text-vault-400 block font-semibold">Temperature</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-rose-400">{livePreview.temperature}</span>
              <span className="text-[10px] text-vault-500 font-mono">°C</span>
            </div>
            <span className="text-[9px] text-vault-500 font-mono">Base: {config.targetTemperature}°C</span>
          </div>

          <div className="bg-vault-900 border border-vault-800 rounded-xl p-3">
            <span className="text-[10px] text-vault-400 block font-semibold">Respiration CO2</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-400">{livePreview.co2}</span>
              <span className="text-[10px] text-vault-500 font-mono">ppm</span>
            </div>
            <span className="text-[9px] text-vault-500 font-mono">Base: {config.targetCo2}</span>
          </div>

          <div className="bg-vault-900 border border-vault-800 rounded-xl p-3">
            <span className="text-[10px] text-vault-400 block font-semibold">Relative Humidity</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-sky-400">{livePreview.humidity}</span>
              <span className="text-[10px] text-vault-500 font-mono">%</span>
            </div>
            <span className="text-[9px] text-vault-500 font-mono">Base: {config.targetHumidity}%</span>
          </div>

          <div className="bg-vault-900 border border-vault-800 rounded-xl p-3">
            <span className="text-[10px] text-vault-400 block font-semibold">Ammonia (NH3)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-400">{livePreview.ammonia}</span>
              <span className="text-[10px] text-vault-500 font-mono">ppm</span>
            </div>
            <span className="text-[9px] text-vault-500 font-mono">Base: {config.targetAmmonia} ppm</span>
          </div>

          <div className="bg-vault-900 border border-vault-800 rounded-xl p-3">
            <span className="text-[10px] text-vault-400 block font-semibold">Ethanol / VOC</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-400">{livePreview.ethanol}</span>
              <span className="text-[10px] text-vault-500 font-mono">ppm</span>
            </div>
            <span className="text-[9px] text-vault-500 font-mono">Base: {config.targetEthanol} ppm</span>
          </div>

          <div className="bg-vault-900 border border-vault-800 rounded-xl p-3">
            <span className="text-[10px] text-vault-400 block font-semibold">Ethylene (C2H4)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-indigo-400">{livePreview.ethylene}</span>
              <span className="text-[10px] text-vault-500 font-mono">ppm</span>
            </div>
            <span className="text-[9px] text-vault-500 font-mono">Base: {config.targetEthylene} ppm</span>
          </div>
        </div>
      </div>

      {/* Preset Action Scenarios */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-vault-400 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Physiological Presets (1-Click Cloud Transmission)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = config.condition === p.condition;
            return (
              <div
                key={p.id}
                onClick={() => handlePresetSelect(p)}
                className={`bg-vault-900 rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-xl flex flex-col justify-between ${
                  isSelected
                    ? 'border-agri-500 ring-1 ring-agri-500/50 bg-vault-900/95'
                    : 'border-vault-800 hover:border-vault-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                    <Icon className="w-4 h-4 text-vault-400" />
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">{p.name}</h3>
                  <p className="text-[11px] text-vault-400 leading-snug">{p.description}</p>
                </div>

                <div className="pt-3 mt-3 border-t border-vault-800/80 text-[10px] font-mono text-vault-300 grid grid-cols-2 gap-1">
                  <span>Temp: {p.values.targetTemperature}°C</span>
                  <span>CO2: {p.values.targetCo2}</span>
                  <span>RH: {p.values.targetHumidity}%</span>
                  <span>NH3: {p.values.targetAmmonia} ppm</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Granular Sliders & Inputs */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-vault-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-4 h-4 text-agri-400" />
              <span>Granular Cloud Telemetry Calibration</span>
            </h2>
            <p className="text-xs text-vault-400">
              Fine-tune the baseline target values. The simulated sensors continuously oscillate around these numbers.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-vault-200 cursor-pointer bg-vault-950 px-3 py-1.5 rounded-lg border border-vault-800">
            <input
              type="checkbox"
              checked={config.enableCycling}
              onChange={(e) => handleSliderChange('enableCycling', e.target.checked)}
              className="rounded bg-vault-900 border-vault-700 text-agri-500 focus:ring-0"
            />
            <span>Enable Time-Based Cycling (~90s Period)</span>
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Temperature Slider */}
          <div className="space-y-2 bg-vault-950/60 p-4 rounded-xl border border-vault-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-rose-400" /> Base Temperature (°C)
              </span>
              <span className="font-mono text-rose-400 font-bold text-sm">{config.targetTemperature}°C</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={config.targetTemperature}
              onChange={(e) => handleSliderChange('targetTemperature', parseFloat(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-vault-500 font-mono">
              <span>0°C (Chilled)</span>
              <span>19°C (Rotting / Spoilage)</span>
              <span>40°C (Extreme Heat)</span>
            </div>
          </div>

          {/* CO2 Slider */}
          <div className="space-y-2 bg-vault-950/60 p-4 rounded-xl border border-vault-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-emerald-400" /> Base CO2 Concentration (ppm)
              </span>
              <span className="font-mono text-emerald-400 font-bold text-sm">{config.targetCo2} ppm</span>
            </div>
            <input
              type="range"
              min="0"
              max="3000"
              step="5"
              value={config.targetCo2}
              onChange={(e) => handleSliderChange('targetCo2', parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-vault-500 font-mono">
              <span>0 ppm</span>
              <span>55 ppm</span>
              <span>1200 ppm (Elevated)</span>
              <span>3000 ppm</span>
            </div>
          </div>

          {/* Relative Humidity Slider */}
          <div className="space-y-2 bg-vault-950/60 p-4 rounded-xl border border-vault-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-sky-400" /> Base Relative Humidity (%)
              </span>
              <span className="font-mono text-sky-400 font-bold text-sm">{config.targetHumidity}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="0.5"
              value={config.targetHumidity}
              onChange={(e) => handleSliderChange('targetHumidity', parseFloat(e.target.value))}
              className="w-full accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-vault-500 font-mono">
              <span>20% (Dry)</span>
              <span>85-90% (Standard)</span>
              <span>95% (Condensation / Soft Rot)</span>
            </div>
          </div>

          {/* Ammonia Slider */}
          <div className="space-y-2 bg-vault-950/60 p-4 rounded-xl border border-vault-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-amber-400" /> Ammonia & Breakdown (ppm)
              </span>
              <span className="font-mono text-amber-400 font-bold text-sm">{config.targetAmmonia} ppm</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="0.1"
              value={config.targetAmmonia}
              onChange={(e) => handleSliderChange('targetAmmonia', parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-vault-500 font-mono">
              <span>0 ppm (Nominal)</span>
              <span>4.0 ppm (Warning)</span>
              <span>6.8 ppm (Severe Tissue Rot)</span>
            </div>
          </div>

          {/* Volatile Ethanol Slider */}
          <div className="space-y-2 bg-vault-950/60 p-4 rounded-xl border border-vault-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" /> Volatile Ethanol / VOC (ppm)
              </span>
              <span className="font-mono text-amber-400 font-bold text-sm">{config.targetEthanol} ppm</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={config.targetEthanol}
              onChange={(e) => handleSliderChange('targetEthanol', parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-vault-500 font-mono">
              <span>0 ppm</span>
              <span>1.8 ppm (Warning)</span>
              <span>3.8 ppm (Anaerobic Rot)</span>
            </div>
          </div>

          {/* Ethylene Slider */}
          <div className="space-y-2 bg-vault-950/60 p-4 rounded-xl border border-vault-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Ethylene Senescence (ppm)
              </span>
              <span className="font-mono text-indigo-400 font-bold text-sm">{config.targetEthylene} ppm</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.01"
              value={config.targetEthylene}
              onChange={(e) => handleSliderChange('targetEthylene', parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-vault-500 font-mono">
              <span>0 ppm</span>
              <span>0.10 ppm (Decay Surge)</span>
              <span>0.24 ppm (High Rot)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Diversity & Food Commodity Section */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-vault-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Fleet Diversification: Online ESPs & Cloned Food Nodes</span>
            </h2>
            <p className="text-xs text-vault-400">
              The online ESP32 remains connected. You can clone similar fake ESPs that oscillate near baseline (~19°C / 55 CO₂) with customized food types.
            </p>
          </div>

          <button
            onClick={() => {
              setNewFakeName(`Storage Node ${fakeEsps.length + 1}`);
              setNewFakeFood('apple');
              setShowAddFake(!showAddFake);
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Clone Fake ESP</span>
          </button>
        </div>

        {/* Quick Add Form */}
        {showAddFake && (
          <div className="bg-vault-950 p-4 rounded-xl border border-emerald-500/40 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Deploy New Cloned Food Node</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-vault-400 mb-1 font-semibold">Node Name</label>
                <input
                  type="text"
                  value={newFakeName}
                  onChange={(e) => setNewFakeName(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg p-2 text-white text-xs"
                  placeholder="e.g. Apples Vault Node"
                />
              </div>
              <div>
                <label className="block text-vault-400 mb-1 font-semibold">Food Stored</label>
                <select
                  value={newFakeFood}
                  onChange={(e) => setNewFakeFood(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg p-2 text-white text-xs"
                >
                  {getAllFoodProfiles().map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.icon} {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={async () => {
                    const id = `AGR-ESP-SIM-${String(fakeEsps.length + 1).padStart(2, '0')}`;
                    await api.createFakeEsp({
                      id,
                      name: newFakeName.trim() || `Cloned Node (${id.slice(-4)})`,
                      hardwareType: 'ESP32',
                      foodType: newFakeFood,
                      zoneName: `${getFoodProfile(newFakeFood).name.split(' ')[0]} Storage Vault`,
                      createdAt: new Date().toISOString()
                    });
                    setFakeEsps(stateMesh.getFakeEsps());
                    setShowAddFake(false);
                    setFeedbackMsg(`Fake node "${id}" deployed with commodity ${getFoodProfile(newFakeFood).name}.`);
                    setTimeout(() => setFeedbackMsg(null), 3000);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow"
                >
                  Deploy Node
                </button>
                <button
                  onClick={() => setShowAddFake(false)}
                  className="px-3 py-2 bg-vault-800 hover:bg-vault-700 text-vault-400 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fleet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Online Real ESP */}
          <div className="bg-vault-950 p-3.5 rounded-xl border border-vault-700 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-bold text-white">AGR-ESP-89D520</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  Online Hardware
                </span>
              </div>
              <p className="text-[11px] text-vault-400 mb-2">Physical ESP32 node connected via Firebase Cloud stream.</p>
              <div className="p-2 rounded bg-vault-900 border border-vault-800 text-xs flex items-center justify-between">
                <span className="text-vault-400">Commodity:</span>
                <span className="font-bold text-slate-200">🥔 Potatoes (Bulk Store)</span>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-vault-800 text-[10px] font-mono text-emerald-400 flex justify-between">
              <span>Live: {livePreview.temperature}°C</span>
              <span>CO2: {livePreview.co2} ppm</span>
              <span>Cycle: 60s Sine</span>
            </div>
          </div>

          {/* Fake ESPs */}
          {fakeEsps.map((f, idx) => {
            const prof = getFoodProfile(f.foodType);
            const tSec = Date.now() / 1000;
            const phi = prof.phaseOffset + idx * 0.7;
            const liveTemp = +(prof.baseTemp + 0.65 * Math.sin((tSec * 2 * Math.PI) / 60 + phi)).toFixed(1);
            const liveCo2 = Math.round(prof.baseCo2 + 3.2 * Math.sin((tSec * 2 * Math.PI) / 45 + 1.0 + phi));

            return (
              <div
                key={f.id}
                className="bg-vault-950 p-3.5 rounded-xl border border-vault-700 shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                      <span className="text-xs font-bold text-white truncate">{f.name}</span>
                    </div>
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-1.5 py-0.5 rounded-full font-bold">
                      Simulated Clone
                    </span>
                  </div>

                  <div className="p-2 rounded bg-vault-900 border border-vault-800 text-xs space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-vault-400">Food Stored:</span>
                      <span className="font-bold text-white">{prof.icon} {prof.name.split(' ')[0]}</span>
                    </div>

                    <div className="pt-1 border-t border-vault-800 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-vault-400">Switch Food:</span>
                      <select
                        value={f.foodType || 'potato'}
                        onChange={async (e) => {
                          await api.updateFakeEspFood(f.id, e.target.value);
                          setFakeEsps(stateMesh.getFakeEsps());
                          setFeedbackMsg(`Food for "${f.id}" switched to ${getFoodProfile(e.target.value).name}.`);
                          setTimeout(() => setFeedbackMsg(null), 3000);
                        }}
                        className="bg-vault-950 border border-vault-700 text-emerald-300 text-[11px] rounded px-1.5 py-0.5"
                      >
                        {getAllFoodProfiles().map((fp) => (
                          <option key={fp.id} value={fp.id}>
                            {fp.icon} {fp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-vault-800 text-[10px] font-mono text-teal-300 flex items-center justify-between">
                  <span>{liveTemp}°C • {liveCo2} ppm</span>
                  <button
                    onClick={async () => {
                      if (confirm(`Remove fake ESP "${f.name}" (${f.id})?`)) {
                        await api.deleteFakeEsp(f.id);
                        setFakeEsps(stateMesh.getFakeEsps());
                      }
                    }}
                    className="text-vault-500 hover:text-rose-400 p-1 rounded"
                    title="Delete Fake Node"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
