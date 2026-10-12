import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, CheckCircle2, Cpu, Radio, Shield, Box, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export const FacilitiesPage: React.FC = () => {
  const { facilities, loadInitialData } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [lengthFt, setLengthFt] = useState('162');
  const [widthFt, setWidthFt] = useState('94');
  const [heightFt, setHeightFt] = useState('48');
  const [unit, setUnit] = useState('ft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editingFacility) {
        await api.updateFacility(editingFacility.id, {
          name,
          location,
          description,
          length_ft: parseFloat(lengthFt),
          width_ft: parseFloat(widthFt),
          height_ft: parseFloat(heightFt),
          dimensions_unit: unit
        });
      } else {
        await api.createFacility({
          name,
          location,
          description
        });
      }
      await loadInitialData();
      setShowAddModal(false);
      setEditingFacility(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to save facility');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (f: any) => {
    setEditingFacility(f);
    setName(f.name);
    setLocation(f.location);
    setDescription(f.description || '');
    setLengthFt(String(f.length_ft || 162));
    setWidthFt(String(f.width_ft || 94));
    setHeightFt(String(f.height_ft || 48));
    setUnit(f.dimensions_unit || 'ft');
    setShowAddModal(true);
  };

  const openCreate = () => {
    setEditingFacility(null);
    setName('');
    setLocation('');
    setDescription('');
    setLengthFt('160');
    setWidthFt('90');
    setHeightFt('45');
    setUnit('ft');
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Facility Management</h1>
          <p className="text-xs text-vault-400 mt-1">
            Configure multi-facility agricultural cold stores, potato warehouses, and grain terminals.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Storage Facility</span>
        </button>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {facilities.map((f: any) => {
          const l = f.length_ft || 162;
          const w = f.width_ft || 94;
          const h = f.height_ft || 48;
          const u = f.dimensions_unit || 'ft';
          const areaSq = Math.round(l * w);
          const volumeCu = Math.round(l * w * h);

          return (
            <div
              key={f.id}
              className="bg-vault-900 border border-vault-800 rounded-2xl p-6 space-y-4 hover:border-vault-700 transition-all shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-agri-500/10 text-agri-400 border border-agri-500/20">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{f.name}</h3>
                      <p className="text-xs text-vault-400">{f.location}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(f)}
                    className="p-1.5 rounded-lg hover:bg-vault-800 text-vault-400 hover:text-slate-200 transition-colors"
                    title="Edit Facility"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {f.description && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {f.description}
                  </p>
                )}

                <div className="p-3 rounded-xl bg-vault-950 border border-vault-800/80 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-vault-400 text-[10px] block font-semibold uppercase">Dimensions</span>
                    <span className="font-mono text-slate-200">
                      {l} × {w} × {h} {u}
                    </span>
                  </div>
                  <div>
                    <span className="text-vault-400 text-[10px] block font-semibold uppercase">Gross Volume</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {volumeCu.toLocaleString()} {u}³
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-vault-800 flex items-center justify-between text-xs text-vault-400">
                <div className="flex items-center gap-1.5 text-agri-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Monitoring Active</span>
                </div>
                <span>ID: {f.id}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingFacility ? 'Edit Storage Facility' : 'Create Storage Facility'}
              </h3>
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

            <form onSubmit={handleSaveFacility} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Facility Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Potato Warehouse Unit 2"
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Physical Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Sector 12, Agro Hub"
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Purpose</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Bulk potato cold storage with CO2 exhaust dampers"
                  rows={2}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Length</label>
                  <input
                    type="number"
                    value={lengthFt}
                    onChange={(e) => setLengthFt(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Width</label>
                  <input
                    type="number"
                    value={widthFt}
                    onChange={(e) => setWidthFt(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Height</label>
                  <input
                    type="number"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="ft">ft</option>
                    <option value="m">m</option>
                  </select>
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
                  {loading ? 'Saving...' : 'Save Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
