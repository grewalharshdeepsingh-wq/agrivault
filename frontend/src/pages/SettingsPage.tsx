import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Settings,
  Shield,
  Sliders,
  Save,
  CheckCircle,
  Building2,
  Layers,
  UserCheck
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { overview, refreshOverview } = useApp();
  const { user, role, switchRole } = useAuth();
  const [scopeType, setScopeType] = useState<'facility' | 'area'>('facility');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('area-01');
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form values
  const [tempMin, setTempMin] = useState('2.0');
  const [tempMax, setTempMax] = useState('6.0');
  const [humMin, setHumMin] = useState('80.0');
  const [humMax, setHumMax] = useState('95.0');
  const [co2Max, setCo2Max] = useState('1500.0');
  const [ethyleneMax, setEthyleneMax] = useState('0.15');
  const [ammoniaMax, setAmmoniaMax] = useState('5.0');
  const [ethanolMax, setEthanolMax] = useState('2.0');

  const canEdit = role === 'Owner' || role === 'Admin';
  const areas = overview?.areas || [];

  const loadThresholds = async () => {
    try {
      const scopeId = scopeType === 'facility' ? 'fac-01' : selectedAreaId;
      const data = await api.getThresholds({ scopeType, scopeId });
      setThresholds(data);

      // Populate form
      for (const t of data) {
        if (t.parameter === 'temperature') {
          if (t.min_value !== null) setTempMin(t.min_value.toString());
          if (t.max_value !== null) setTempMax(t.max_value.toString());
        }
        if (t.parameter === 'humidity') {
          if (t.min_value !== null) setHumMin(t.min_value.toString());
          if (t.max_value !== null) setHumMax(t.max_value.toString());
        }
        if (t.parameter === 'co2' && t.max_value !== null) setCo2Max(t.max_value.toString());
        if (t.parameter === 'ethylene' && t.max_value !== null) setEthyleneMax(t.max_value.toString());
        if (t.parameter === 'ammonia' && t.max_value !== null) setAmmoniaMax(t.max_value.toString());
        if (t.parameter === 'ethanol' && t.max_value !== null) setEthanolMax(t.max_value.toString());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadThresholds();
  }, [scopeType, selectedAreaId]);

  const handleSaveThresholds = async () => {
    if (!canEdit) {
      alert(`Role ${role} cannot edit safety thresholds. Owner or Admin required.`);
      return;
    }
    setIsSaving(true);
    setSaveSuccess(false);
    const scopeId = scopeType === 'facility' ? 'fac-01' : selectedAreaId;

    try {
      await Promise.all([
        api.saveThreshold({
          scopeType,
          scopeId,
          parameter: 'temperature',
          minValue: parseFloat(tempMin),
          maxValue: parseFloat(tempMax),
          warningMin: parseFloat(tempMin) + 0.5,
          warningMax: parseFloat(tempMax) - 0.5
        }),
        api.saveThreshold({
          scopeType,
          scopeId,
          parameter: 'humidity',
          minValue: parseFloat(humMin),
          maxValue: parseFloat(humMax),
          warningMin: parseFloat(humMin) + 2.0,
          warningMax: parseFloat(humMax) - 3.0
        }),
        api.saveThreshold({
          scopeType,
          scopeId,
          parameter: 'co2',
          maxValue: parseFloat(co2Max),
          warningMax: parseFloat(co2Max) * 0.8
        }),
        api.saveThreshold({
          scopeType,
          scopeId,
          parameter: 'ethylene',
          maxValue: parseFloat(ethyleneMax),
          warningMax: parseFloat(ethyleneMax) * 0.7
        }),
        api.saveThreshold({
          scopeType,
          scopeId,
          parameter: 'ammonia',
          maxValue: parseFloat(ammoniaMax),
          warningMax: parseFloat(ammoniaMax) * 0.6
        }),
        api.saveThreshold({
          scopeType,
          scopeId,
          parameter: 'ethanol',
          maxValue: parseFloat(ethanolMax),
          warningMax: parseFloat(ethanolMax) * 0.6
        })
      ]);

      setSaveSuccess(true);
      await refreshOverview();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Threshold Configuration & Access Control
        </h1>
        <p className="text-xs text-vault-400">
          Set safe environmental parameters at facility or area-specific levels. Area overrides take precedence over facility defaults.
        </p>
      </div>

      {/* Scope Selector */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xs text-vault-400 font-mono">Configuration Scope:</span>
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800">
            <button
              onClick={() => setScopeType('facility')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                scopeType === 'facility'
                  ? 'bg-agri-600 text-white shadow'
                  : 'text-vault-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Facility Defaults</span>
            </button>
            <button
              onClick={() => setScopeType('area')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                scopeType === 'area'
                  ? 'bg-agri-600 text-white shadow'
                  : 'text-vault-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Area-Specific Override</span>
            </button>
          </div>
        </div>

        {scopeType === 'area' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-vault-400 font-mono">Select Area:</span>
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="bg-vault-950 border border-vault-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-agri-500 font-medium"
            >
              {areas.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.commodity})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Thresholds Form */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-vault-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {scopeType === 'facility' ? 'Global Facility Limits' : `Override Limits for ${areas.find((a: any) => a.id === selectedAreaId)?.name}`}
            </h3>
            <p className="text-xs text-vault-400">
              When readings breach these limits, alerts are generated and automated relays activate.
            </p>
          </div>

          {canEdit && (
            <button
              onClick={handleSaveThresholds}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-agri-600/30 transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Apply Thresholds'}</span>
            </button>
          )}
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Threshold limits updated and active across all background alert evaluation engines!</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="bg-vault-950 p-4 rounded-xl border border-vault-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-rose-400">
              Temperature Thresholds (°C)
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-vault-400 block mb-1">Minimum Allowable</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempMin}
                  disabled={!canEdit}
                  onChange={(e) => setTempMin(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-vault-400 block mb-1">Maximum Allowable</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempMax}
                  disabled={!canEdit}
                  onChange={(e) => setTempMax(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-vault-950 p-4 rounded-xl border border-vault-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-sky-400">
              Humidity Thresholds (%)
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-vault-400 block mb-1">Minimum Target</label>
                <input
                  type="number"
                  step="1"
                  value={humMin}
                  disabled={!canEdit}
                  onChange={(e) => setHumMin(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-vault-400 block mb-1">Maximum Target</label>
                <input
                  type="number"
                  step="1"
                  value={humMax}
                  disabled={!canEdit}
                  onChange={(e) => setHumMax(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Carbon Dioxide (CO2) */}
          <div className="bg-vault-950 p-4 rounded-xl border border-vault-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-emerald-400">
              Carbon Dioxide (ppm)
            </h4>
            <div className="text-xs">
              <label className="text-vault-400 block mb-1">Upper Limit (Ventilation Trigger)</label>
              <input
                type="number"
                step="50"
                value={co2Max}
                disabled={!canEdit}
                onChange={(e) => setCo2Max(e.target.value)}
                className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-1.5 text-white font-mono"
              />
            </div>
          </div>

          {/* Trace Gas Volatiles (Ethylene, Ammonia, Ethanol) */}
          <div className="bg-vault-950 p-4 rounded-xl border border-vault-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-purple-400">
              Trace Volatile Gases (ppm)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-vault-400 block mb-1 text-[11px]">Ethylene</label>
                <input
                  type="number"
                  step="0.01"
                  value={ethyleneMax}
                  disabled={!canEdit}
                  onChange={(e) => setEthyleneMax(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-vault-400 block mb-1 text-[11px]">Ammonia</label>
                <input
                  type="number"
                  step="0.5"
                  value={ammoniaMax}
                  disabled={!canEdit}
                  onChange={(e) => setAmmoniaMax(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-vault-400 block mb-1 text-[11px]">Ethanol/VOC</label>
                <input
                  type="number"
                  step="0.1"
                  value={ethanolMax}
                  disabled={!canEdit}
                  onChange={(e) => setEthanolMax(e.target.value)}
                  className="w-full bg-vault-900 border border-vault-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Access Control Card */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-agri-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Active Role-Based Access Control (RBAC)
          </h3>
        </div>

        <p className="text-xs text-vault-300">
          Currently authenticated as <strong>{user?.name}</strong> with role{' '}
          <span className="font-mono text-agri-400 font-bold uppercase">[{role}]</span>.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
          {[
            { r: 'Owner', desc: 'Full root access, account management, relay override, threshold config' },
            { r: 'Admin', desc: 'Add/configure devices, edit thresholds, acknowledge alerts, relay override' },
            { r: 'Operator', desc: 'Acknowledge/resolve alerts, manual relay control with confirmation' },
            { r: 'Viewer', desc: 'Read-only telemetry graphs, reports view, cannot toggle relays' }
          ].map((item) => (
            <div
              key={item.r}
              onClick={() => switchRole(item.r as any)}
              className={`p-3 rounded-xl border cursor-pointer transition ${
                role === item.r
                  ? 'bg-agri-950/60 border-agri-500 text-white shadow'
                  : 'bg-vault-950 border-vault-800 text-vault-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold mb-1">
                <span>{item.r}</span>
                {role === item.r && <CheckCircle className="w-3.5 h-3.5 text-agri-400" />}
              </div>
              <p className="text-[10px] leading-relaxed text-vault-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
