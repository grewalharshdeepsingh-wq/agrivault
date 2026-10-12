import React, { useState, useEffect } from 'react';
import {
  Layers,
  Thermometer,
  Droplets,
  Wind,
  BookOpen,
  Edit2,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Check,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export const CropProfilesPage: React.FC = () => {
  const { areas, loadInitialData } = useApp();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [assigningProfile, setAssigningProfile] = useState<any | null>(null);
  const [selectedZoneToAssign, setSelectedZoneToAssign] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    variety: '',
    purpose: '',
    storage_stage: 'Holding',
    min_temp: '7.0',
    target_temp: '9.0',
    max_temp: '10.0',
    min_humidity: '90.0',
    target_humidity: '93.0',
    max_humidity: '95.0',
    max_co2_ppm: '2500',
    max_ethylene_ppm: '0.05',
    guidance: '',
    sources: '',
    notes: ''
  });

  const fetchProfiles = async () => {
    try {
      const res = await api.getCropProfiles();
      setProfiles(res);
    } catch (err) {
      console.error('Error fetching crop profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleEditClick = (p: any) => {
    setEditingProfile(p);
    setFormData({
      name: p.name,
      variety: p.variety || '',
      purpose: p.purpose,
      storage_stage: p.storage_stage,
      min_temp: String(p.min_temp),
      target_temp: String(p.target_temp),
      max_temp: String(p.max_temp),
      min_humidity: String(p.min_humidity),
      target_humidity: String(p.target_humidity),
      max_humidity: String(p.max_humidity),
      max_co2_ppm: p.max_co2_ppm ? String(p.max_co2_ppm) : '',
      max_ethylene_ppm: p.max_ethylene_ppm ? String(p.max_ethylene_ppm) : '',
      guidance: p.guidance || '',
      sources: p.sources || '',
      notes: p.notes || ''
    });
    setShowCreateModal(true);
  };

  const handleCreateClick = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      variety: '',
      purpose: 'Bulk Cold Storage',
      storage_stage: 'Holding',
      min_temp: '2.0',
      target_temp: '4.0',
      max_temp: '6.0',
      min_humidity: '90.0',
      target_humidity: '92.0',
      max_humidity: '95.0',
      max_co2_ppm: '2000',
      max_ethylene_ppm: '0.1',
      guidance: 'Standard facility storage protocol.',
      sources: 'Facility internal standard operating procedure.',
      notes: ''
    });
    setShowCreateModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProfile) {
        await api.updateCropProfile(editingProfile.id, {
          ...formData,
          min_temp: parseFloat(formData.min_temp),
          target_temp: parseFloat(formData.target_temp),
          max_temp: parseFloat(formData.max_temp),
          min_humidity: parseFloat(formData.min_humidity),
          target_humidity: parseFloat(formData.target_humidity),
          max_humidity: parseFloat(formData.max_humidity),
          max_co2_ppm: formData.max_co2_ppm ? parseFloat(formData.max_co2_ppm) : null,
          max_ethylene_ppm: formData.max_ethylene_ppm ? parseFloat(formData.max_ethylene_ppm) : null
        });
        setNotification(`Crop profile "${formData.name}" successfully updated.`);
      } else {
        await api.createCropProfile({
          ...formData,
          min_temp: parseFloat(formData.min_temp),
          target_temp: parseFloat(formData.target_temp),
          max_temp: parseFloat(formData.max_temp),
          min_humidity: parseFloat(formData.min_humidity),
          target_humidity: parseFloat(formData.target_humidity),
          max_humidity: parseFloat(formData.max_humidity),
          max_co2_ppm: formData.max_co2_ppm ? parseFloat(formData.max_co2_ppm) : null,
          max_ethylene_ppm: formData.max_ethylene_ppm ? parseFloat(formData.max_ethylene_ppm) : null
        });
        setNotification(`Custom crop profile "${formData.name}" created.`);
      }
      setShowCreateModal(false);
      await fetchProfiles();
    } catch (err: any) {
      alert(err?.message || 'Failed to save crop profile');
    }
  };

  const handleAssignToZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningProfile || !selectedZoneToAssign) return;
    try {
      await api.assignCropProfile(assigningProfile.id, selectedZoneToAssign);
      setNotification(`Profile "${assigningProfile.name}" assigned to storage zone. Thresholds updated automatically.`);
      setAssigningProfile(null);
      await loadInitialData();
    } catch (err: any) {
      alert(err?.message || 'Assignment failed');
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to restore default crop requirements? This resets default profiles to the scientific research baseline (FAO/USDA/PAA).')) {
      return;
    }
    try {
      await api.resetCropProfiles();
      setNotification('Default crop requirements restored to authoritative scientific research baseline.');
      await fetchProfiles();
    } catch (err: any) {
      alert(err?.message || 'Reset failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Crop Storage Requirements Library</h1>
          <p className="text-xs text-vault-400 mt-1">
            Researched post-harvest physiological standards from FAO, USDA, PAA, and UC Davis. Defines temperature, humidity, and atmospheric thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 font-semibold text-xs border border-vault-700 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-vault-400" />
            <span>Restore Research Defaults</span>
          </button>

          <button
            onClick={handleCreateClick}
            className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Profile</span>
          </button>
        </div>
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

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profiles.map((p: any) => (
          <div
            key={p.id}
            className="bg-vault-900 border border-vault-800 rounded-2xl p-6 space-y-5 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{p.name}</h3>
                    {p.is_default === 1 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-agri-500/10 text-agri-400 border border-agri-500/20">
                        Researched Standard
                      </span>
                    )}
                    {p.is_custom === 1 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Customized
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-vault-400 mt-0.5">
                    Purpose: <span className="text-slate-300 font-semibold">{p.purpose}</span> • Stage: <span className="text-slate-300 font-semibold">{p.storage_stage}</span>
                  </p>
                  {p.variety && (
                    <p className="text-[11px] text-vault-500">Varieties: {p.variety}</p>
                  )}
                </div>

                <button
                  onClick={() => handleEditClick(p)}
                  className="p-1.5 rounded-lg hover:bg-vault-800 text-vault-400 hover:text-slate-200 transition-colors"
                  title="Edit Limits"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Threshold Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-vault-400 font-semibold">
                    <Thermometer className="w-4 h-4 text-rose-400" />
                    <span>Temperature Range</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black font-mono text-white">{p.target_temp.toFixed(1)}°C</span>
                    <span className="text-[11px] text-vault-400 font-mono">({p.min_temp.toFixed(1)}° - {p.max_temp.toFixed(1)}°)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-vault-400 font-semibold">
                    <Droplets className="w-4 h-4 text-sky-400" />
                    <span>Relative Humidity</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black font-mono text-white">{p.target_humidity.toFixed(0)}%</span>
                    <span className="text-[11px] text-vault-400 font-mono">({p.min_humidity.toFixed(0)}% - {p.max_humidity.toFixed(0)}%)</span>
                  </div>
                </div>
              </div>

              {/* Atmospheric Limits */}
              {(p.max_co2_ppm || p.max_ethylene_ppm) && (
                <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800 text-xs flex items-center justify-between font-mono">
                  {p.max_co2_ppm && (
                    <span className="text-slate-300">
                      Max CO₂: <b className="text-amber-400">{p.max_co2_ppm} ppm</b>
                    </span>
                  )}
                  {p.max_ethylene_ppm && (
                    <span className="text-slate-300">
                      Ethylene Limit: <b className="text-purple-400">{p.max_ethylene_ppm} ppm</b>
                    </span>
                  )}
                </div>
              )}

              {/* Storage Guidance */}
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-slate-300 block">Post-Harvest Guidance:</span>
                <p className="text-slate-400 leading-relaxed text-[11px] bg-vault-950 p-3 rounded-lg border border-vault-800/80">
                  {p.guidance}
                </p>
              </div>

              {/* Sources */}
              {p.sources && (
                <div className="text-[10px] text-vault-500 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Source: {p.sources}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-vault-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setAssigningProfile(p);
                  setSelectedZoneToAssign(areas[0]?.id || '');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-agri-600/20 hover:bg-agri-600/30 text-agri-300 text-xs font-bold border border-agri-500/30 transition-colors"
              >
                Assign to Storage Zone →
              </button>
              <span className="text-[11px] text-vault-500 font-mono">ID: {p.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">
              {editingProfile ? `Customize Profile: ${editingProfile.name}` : 'Create Custom Crop Profile'}
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Crop Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Storage Purpose</label>
                  <input
                    type="text"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Storage Stage</label>
                  <input
                    type="text"
                    value={formData.storage_stage}
                    onChange={(e) => setFormData({ ...formData, storage_stage: e.target.value })}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              {/* Temperature Limits */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Temp (°C) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.min_temp}
                    onChange={(e) => setFormData({ ...formData, min_temp: e.target.value })}
                    required
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.target_temp}
                    onChange={(e) => setFormData({ ...formData, target_temp: e.target.value })}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Temp (°C) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.max_temp}
                    onChange={(e) => setFormData({ ...formData, max_temp: e.target.value })}
                    required
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              {/* Humidity Limits */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min RH (%) *</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.min_humidity}
                    onChange={(e) => setFormData({ ...formData, min_humidity: e.target.value })}
                    required
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target RH (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.target_humidity}
                    onChange={(e) => setFormData({ ...formData, target_humidity: e.target.value })}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max RH (%) *</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.max_humidity}
                    onChange={(e) => setFormData({ ...formData, max_humidity: e.target.value })}
                    required
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Guidance & Storage Protocol</label>
                <textarea
                  value={formData.guidance}
                  onChange={(e) => setFormData({ ...formData, guidance: e.target.value })}
                  rows={2}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold"
                >
                  Save Requirements
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign to Zone Modal */}
      {assigningProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Assign Profile to Storage Zone</h3>
            <p className="text-xs text-vault-400">
              Applying <b>{assigningProfile.name}</b> will automatically synchronize environmental warning and critical thresholds for the selected zone.
            </p>

            <form onSubmit={handleAssignToZone} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Target Storage Zone</label>
                <select
                  value={selectedZoneToAssign}
                  onChange={(e) => setSelectedZoneToAssign(e.target.value)}
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-slate-100"
                >
                  {areas.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} (Current: {a.commodity})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningProfile(null)}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
