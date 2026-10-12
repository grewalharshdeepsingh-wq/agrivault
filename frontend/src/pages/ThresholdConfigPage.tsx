import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export const ThresholdConfigPage: React.FC = () => {
  const { areas } = useApp();
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form
  const [scopeType, setScopeType] = useState<'facility' | 'area'>('area');
  const [scopeId, setScopeId] = useState('');
  const [parameter, setParameter] = useState('temperature');
  const [minVal, setMinVal] = useState('4.0');
  const [maxVal, setMaxVal] = useState('10.0');
  const [warnMin, setWarnMin] = useState('5.0');
  const [warnMax, setWarnMax] = useState('9.0');

  const fetchThresholds = async () => {
    try {
      const res = await api.getThresholds();
      setThresholds(res);
      if (areas.length > 0 && !scopeId) {
        setScopeId(areas[0].id);
      }
    } catch (err) {
      console.error('Error fetching thresholds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, [areas]);

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveThreshold({
        scopeType,
        scopeId: scopeId || 'fac-01',
        parameter,
        minValue: parseFloat(minVal),
        maxValue: parseFloat(maxVal),
        warningMin: parseFloat(warnMin),
        warningMax: parseFloat(warnMax)
      });
      setNotification(`Threshold limits for ${parameter} saved successfully.`);
      setShowAddModal(false);
      await fetchThresholds();
    } catch (err: any) {
      alert(err?.message || 'Failed to save threshold');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this threshold rule?')) return;
    try {
      await api.deleteThreshold(id);
      setNotification('Threshold rule removed.');
      await fetchThresholds();
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Environmental Threshold Rules</h1>
          <p className="text-xs text-vault-400 mt-1">
            Configure warning and critical tolerance boundaries, persistence windows, and alert triggers per facility or storage zone.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Threshold Rule</span>
        </button>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Threshold Rules Table */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white">Active Environmental Rule Matrix</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-vault-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Scope</th>
                <th className="p-3">Target Zone / Facility</th>
                <th className="p-3">Parameter</th>
                <th className="p-3">Critical Low</th>
                <th className="p-3">Warning Low</th>
                <th className="p-3">Warning High</th>
                <th className="p-3">Critical High</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800/60 font-mono">
              {thresholds.map((t: any) => {
                const isTemp = t.parameter === 'temperature';
                const unit = isTemp ? '°C' : '%';
                const areaMatch = areas.find((a: any) => a.id === t.scope_id);

                return (
                  <tr key={t.id} className="hover:bg-vault-850/50">
                    <td className="p-3 font-sans capitalize text-slate-300">{t.scope_type}</td>
                    <td className="p-3 font-sans font-bold text-white">
                      {areaMatch ? areaMatch.name : (t.scope_id === 'fac-01' ? 'All Facility Vaults' : t.scope_id)}
                    </td>
                    <td className="p-3 font-sans capitalize text-agri-400 font-semibold">{t.parameter}</td>
                    <td className="p-3 text-rose-400">{t.min_value !== null ? `${t.min_value} ${unit}` : 'None'}</td>
                    <td className="p-3 text-amber-400">{t.warning_min !== null ? `${t.warning_min} ${unit}` : 'None'}</td>
                    <td className="p-3 text-amber-400">{t.warning_max !== null ? `${t.warning_max} ${unit}` : 'None'}</td>
                    <td className="p-3 text-rose-400">{t.max_value !== null ? `${t.max_value} ${unit}` : 'None'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-vault-400 hover:text-rose-400 p-1"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add Threshold Rule</h3>

            <form onSubmit={handleSaveThreshold} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Scope</label>
                  <select
                    value={scopeType}
                    onChange={(e) => setScopeType(e.target.value as any)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="area">Storage Zone</option>
                    <option value="facility">Global Facility</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Parameter</label>
                  <select
                    value={parameter}
                    onChange={(e) => setParameter(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="temperature">Temperature (°C)</option>
                    <option value="humidity">Relative Humidity (%)</option>
                    <option value="mq3">MQ-3 Gas Response</option>
                    <option value="mq135">MQ-135 Gas Response</option>
                  </select>
                </div>
              </div>

              {scopeType === 'area' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Storage Zone</label>
                  <select
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  >
                    {areas.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.commodity})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-rose-400 font-semibold mb-1">Critical Min</label>
                  <input
                    type="number"
                    step="0.1"
                    value={minVal}
                    onChange={(e) => setMinVal(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-amber-400 font-semibold mb-1">Warning Min</label>
                  <input
                    type="number"
                    step="0.1"
                    value={warnMin}
                    onChange={(e) => setWarnMin(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-amber-400 font-semibold mb-1">Warning Max</label>
                  <input
                    type="number"
                    step="0.1"
                    value={warnMax}
                    onChange={(e) => setWarnMax(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-rose-400 font-semibold mb-1">Critical Max</label>
                  <input
                    type="number"
                    step="0.1"
                    value={maxVal}
                    onChange={(e) => setMaxVal(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
