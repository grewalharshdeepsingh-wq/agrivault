import React, { useState } from 'react';
import { Layers, Plus, Thermometer, Droplets, AlertTriangle, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

interface StorageZonesPageProps {
  onSelectZone: (zoneId: string) => void;
  onNavigateToCropProfiles: () => void;
}

export const StorageZonesPage: React.FC<StorageZonesPageProps> = ({
  onSelectZone,
  onNavigateToCropProfiles
}) => {
  const { areas, overview, loadInitialData } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [commodity, setCommodity] = useState('Potatoes (Processing / French Fry & Chips)');
  const [coldStoreName, setColdStoreName] = useState('Cold Store A');
  const [zoneName, setZoneName] = useState('North Zone');
  const [rackName, setRackName] = useState('Rack 1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createAreaDirect({
        name,
        commodity,
        facilityId: overview?.facility?.id || 'fac-01'
      });
      await loadInitialData();
      setShowAddModal(false);
      setName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create storage zone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Storage Zones & Vault Sections</h1>
          <p className="text-xs text-vault-400 mt-1">
            Compartmentalized monitoring zones with crop profile compliance, micro-climate tracking, and hot spot detection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToCropProfiles}
            className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 font-semibold text-xs border border-vault-700 transition-colors"
          >
            Manage Crop Profiles
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Storage Zone</span>
          </button>
        </div>
      </div>

      {/* Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {areas.map((a: any) => {
          const isWarning = a.health_status === 'warning' || a.health_status === 'critical';
          const score = Math.round(a.health_score ?? 100);

          return (
            <div
              key={a.id}
              onClick={() => onSelectZone(a.id)}
              className="bg-vault-900 border border-vault-800 hover:border-vault-700 rounded-2xl p-6 space-y-4 cursor-pointer transition-all hover:bg-vault-850 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-agri-500/10 text-agri-400 border border-agri-500/20">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{a.name}</h3>
                      <p className="text-xs text-vault-400">{a.cold_store_name || 'Cold Store A'} • {a.rack_name || 'Rack 1'}</p>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-black font-mono border ${
                    score >= 90
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : score >= 70
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {score}% Health
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800 text-xs flex items-center justify-between">
                  <span className="text-vault-400 font-medium">Assigned Crop:</span>
                  <span className="text-agri-300 font-bold truncate max-w-[180px]">{a.commodity || 'General Produce'}</span>
                </div>

                {/* Health Reasons if any */}
                {a.health_reasons && Array.isArray(a.health_reasons) && a.health_reasons.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                    {a.health_reasons.map((r: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span className="truncate">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-vault-800 flex items-center justify-between text-xs text-vault-400">
                <span className="flex items-center gap-1 text-slate-300">
                  <Activity className="w-3.5 h-3.5 text-agri-400" />
                  <span>Inspect Zone Telemetry</span>
                </span>
                <ChevronRight className="w-4 h-4 text-vault-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Zone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create Storage Zone</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-vault-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateZone} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Zone / Room Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Potato Cell 3 (North Racks)"
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Crop / Commodity Profile</label>
                <select
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                >
                  <option value="Potatoes (Processing / French Fry & Chips)">Potatoes (Processing / French Fry & Chips)</option>
                  <option value="Potatoes (Seed Tubers)">Potatoes (Seed Tubers)</option>
                  <option value="Potatoes (Fresh Table Market)">Potatoes (Fresh Table Market)</option>
                  <option value="Wheat (Bulk Grain Silo / Storage)">Wheat (Bulk Grain Silo)</option>
                  <option value="Rice (Paddy / Rough Grain)">Rice (Paddy Grain)</option>
                  <option value="Maize / Corn (Shelled Grain)">Maize / Corn (Shelled Grain)</option>
                  <option value="Onions (Dry Bulb Storage)">Onions (Dry Bulb Storage)</option>
                  <option value="Apples (Cold Storage / CA Holding)">Apples (Cold CA Holding)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cold Store Sector</label>
                  <input
                    type="text"
                    value={coldStoreName}
                    onChange={(e) => setColdStoreName(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Rack / Bin Identifier</label>
                  <input
                    type="text"
                    value={rackName}
                    onChange={(e) => setRackName(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg bg-vault-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold"
                >
                  {loading ? 'Creating...' : 'Create Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
