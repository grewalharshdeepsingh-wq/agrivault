import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AreaCard } from '../components/AreaCard';
import { api } from '../api/client';
import { Area, ESPDevice } from '../types';
import {
  Building2,
  Cpu,
  Layers,
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  Radio,
  Globe,
  ArrowRight,
  Sparkles,
  Wifi,
  WifiOff,
  Plus,
  X,
  Check,
  Trash2,
  Settings2,
  Edit2
} from 'lucide-react';

interface DashboardProps {
  onSelectArea: (areaId: string) => void;
  onNavigateToDevices: () => void;
  onNavigateToAlerts: () => void;
  onNavigateToSimulation: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectArea,
  onNavigateToDevices,
  onNavigateToAlerts,
  onNavigateToSimulation
}) => {
  const { overview, refreshOverview, discoveredDevices } = useApp();

  const areas = overview?.areas || [];
  const facility = overview?.facility;
  const connectedESPs = overview?.connectedESPs || 0;
  const offlineESPs = overview?.offlineESPs || 0;
  const activeAlerts = overview?.activeAlertsCount || 0;
  const criticalAlerts = overview?.criticalAlertsCount || 0;
  const avgTemp = overview?.avgTemp !== null && overview?.avgTemp !== undefined ? `${overview.avgTemp}°C` : '--';
  const avgHum = overview?.avgHum !== null && overview?.avgHum !== undefined ? `${overview.avgHum}%` : '--';
  const co2Status = overview?.co2Status || 'No Data';
  const gasStatus = overview?.gasStatus || 'No Data';
  const gateway = overview?.gateway;

  // Room / Section Management State
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Area | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCommodity, setRoomCommodity] = useState('Potato (Bulk Store)');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [allDevices, setAllDevices] = useState<ESPDevice[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all available ESP devices for assignment
  const fetchDevices = async () => {
    try {
      const devs = await api.getDevices();
      setAllDevices((prev) => (JSON.stringify(prev) === JSON.stringify(devs) ? prev : devs));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 6000);
    return () => clearInterval(interval);
  }, []);

  // Open Create Modal
  const openCreateModal = () => {
    setRoomName('');
    setRoomCommodity('Potato (Bulk Store)');
    setSelectedDeviceIds([]);
    setShowAddRoomModal(true);
  };

  // Open Edit Modal for a Room
  const openEditModal = (area: Area) => {
    setEditingRoom(area);
    setRoomName(area.name);
    setRoomCommodity(area.commodity || 'General Produce');
    // Pre-select devices currently assigned to this area
    const assignedIds = allDevices.filter(d => d.area_id === area.id).map(d => d.id);
    setSelectedDeviceIds(assignedIds);
  };

  // Handle Save New Room
  const handleSaveNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createAreaDirect({
        name: roomName.trim(),
        commodity: roomCommodity,
        deviceIds: selectedDeviceIds
      });
      setShowAddRoomModal(false);
      await refreshOverview();
      await fetchDevices();
    } catch (err: any) {
      alert(`Error creating room: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Existing Room
  const handleSaveEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !roomName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.updateArea(editingRoom.id, {
        name: roomName.trim(),
        commodity: roomCommodity
      });

      // Update device mappings
      for (const dev of allDevices) {
        const isSelected = selectedDeviceIds.includes(dev.id);
        const wasInThisRoom = dev.area_id === editingRoom.id;

        if (isSelected && !wasInThisRoom) {
          await api.updateDevice(dev.id, { areaId: editingRoom.id, isDiscovered: 0 });
        } else if (!isSelected && wasInThisRoom) {
          await api.updateDevice(dev.id, { areaId: null });
        }
      }

      setEditingRoom(null);
      await refreshOverview();
      await fetchDevices();
    } catch (err: any) {
      alert(`Error updating room: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Room
  const handleDeleteRoom = async () => {
    if (!editingRoom) return;
    if (!confirm(`Are you sure you want to remove room "${editingRoom.name}"? Connected ESP devices will remain registered and unassigned.`)) return;

    setIsSubmitting(true);
    try {
      await api.deleteArea(editingRoom.id);
      setEditingRoom(null);
      await refreshOverview();
      await fetchDevices();
    } catch (err: any) {
      alert(`Error deleting room: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle device selection
  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  const pendingDiscoveredESPs = allDevices.filter(d => d.is_discovered === 1 || !d.area_id);

  return (
    <div className="space-y-6">
      {/* Top Facility Banner */}
      <div className="bg-gradient-to-r from-vault-900 via-vault-850 to-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-agri-500/5 to-transparent pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-agri-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>Industrial Facility Monitoring</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
              {facility?.name || 'ABC Cold Storage — Central Hub'}
            </h1>
            <p className="text-xs lg:text-sm text-vault-300 mt-1 max-w-2xl">
              {facility?.description ||
                'Real-time automated environmental intelligence for cold rooms, controlled atmosphere storage, and bulk potato vaults.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-agri-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Room / Section</span>
            </button>
            <button
              onClick={onNavigateToSimulation}
              className="px-3 py-2 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate</span>
            </button>
          </div>
        </div>

        {/* High-Level Industrial KPI Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          {/* Active Areas */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Active Areas</span>
              <Layers className="w-3.5 h-3.5 text-vault-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{areas.length}</p>
            <span className="text-[10px] text-vault-500">Monitored Zones</span>
          </div>

          {/* Connected ESPs */}
          <div
            onClick={onNavigateToDevices}
            className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3 cursor-pointer hover:border-vault-700 transition"
          >
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Connected ESPs</span>
              <Cpu className="w-3.5 h-3.5 text-agri-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-white">{connectedESPs}</span>
              {offlineESPs > 0 && (
                <span className="text-xs font-mono text-rose-400 font-semibold">({offlineESPs} off)</span>
              )}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" /> Direct Internet (WAN)
            </span>
          </div>

          {/* Active Alerts */}
          <div
            onClick={onNavigateToAlerts}
            className={`rounded-xl p-3 border cursor-pointer transition ${
              criticalAlerts > 0
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                : activeAlerts > 0
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-vault-950/70 border-vault-800/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1 text-vault-400">
              <span>Active Alerts</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{activeAlerts}</p>
            <span className="text-[10px] text-vault-400">
              {criticalAlerts > 0 ? `${criticalAlerts} Critical Attention` : 'All Thresholds Nominal'}
            </span>
          </div>

          {/* Average Facility Temp */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Facility Avg Temp</span>
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{avgTemp}</p>
            <span className="text-[10px] text-vault-500">Across All Vaults</span>
          </div>

          {/* Average Humidity */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Facility Avg Hum</span>
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{avgHum}</p>
            <span className="text-[10px] text-vault-500">Target 80-95%</span>
          </div>

          {/* CO2 & Gas Status */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Air & Gas Quality</span>
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white mt-1">
              CO2: <span className={co2Status === 'Elevated' ? 'text-amber-400' : 'text-emerald-400'}>{co2Status}</span>
            </p>
            <p className="text-[11px] text-vault-400 font-medium">
              VOC/NH3: <span className={gasStatus === 'Elevated' ? 'text-amber-400' : 'text-emerald-400'}>{gasStatus}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Discovered / Available ESPs Quick Prompt */}
      {pendingDiscoveredESPs.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-950/60 via-vault-900 to-indigo-950/60 border border-indigo-500/50 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{pendingDiscoveredESPs.length} Available ESP Node{pendingDiscoveredESPs.length > 1 ? 's' : ''} Connected Over Internet</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500 text-white">
                    READY FOR ROOM SETUP
                  </span>
                </p>
                <p className="text-xs text-indigo-200/90 mt-0.5">
                  Microcontrollers detected via direct Wi-Fi/WAN link and streaming telemetry. Assign them to a storage room.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openCreateModal}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                + Create Room for Device
              </button>
              <button
                onClick={onNavigateToDevices}
                className="px-3.5 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-medium border border-vault-700 transition"
              >
                View Available Fleet
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-indigo-500/20">
            {pendingDiscoveredESPs.map((d) => {
              const dev8266 = (d.hardware_type || '').includes('8266') || d.id.includes('8266');
              return (
                <div
                  key={d.id}
                  className="bg-vault-950/90 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      dev8266
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {dev8266 ? 'ESP8266' : 'ESP32'}
                  </span>
                  <span className="font-semibold text-white">{d.user_name || d.id}</span>
                  <span className="text-[10px] font-mono text-vault-400">({d.ip_address || 'Internet WAN'})</span>
                  <button
                    onClick={() => {
                      setRoomName('');
                      setRoomCommodity('Potato (Bulk Store)');
                      setSelectedDeviceIds([d.id]);
                      setShowAddRoomModal(true);
                    }}
                    className="ml-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-200 underline"
                  >
                    Assign
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Areas Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Monitored Storage Rooms & Sections</h2>
          <p className="text-xs text-vault-400">
            Real-time multi-sensor values from assigned ESPs, rate-of-change, and section health.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-3 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Room</span>
        </button>
      </div>

      {/* Area Cards Grid */}
      {areas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {areas.map((area: any) => (
            <AreaCard
              key={area.id}
              area={area}
              onClick={() => onSelectArea(area.id)}
              onEditArea={() => openEditModal(area)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-vault-900/60 border border-dashed border-vault-800 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-vault-800/80 border border-vault-700/80 text-vault-400 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Monitored Rooms Configured Yet</h3>
          <p className="text-xs text-vault-400 max-w-md mx-auto">
            {pendingDiscoveredESPs.length > 0
              ? 'An ESP is connected and waiting to be assigned! Click "+ Add Room" below to name your room and link the device.'
              : 'Power on your ESP32 or ESP8266. Once it connects to Wi-Fi, it will be detected automatically so you can assign it to a room.'}
          </p>
          <div className="pt-2">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold shadow transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Your First Room</span>
            </button>
          </div>
        </div>
      )}

      {/* Create / Add Room Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-vault-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Add Monitored Room / Section</h3>
                <p className="text-xs text-vault-400">Define a room and select which ESP sensor modules monitor it.</p>
              </div>
              <button
                onClick={() => setShowAddRoomModal(false)}
                className="p-1 rounded-lg hover:bg-vault-800 text-vault-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room / Section Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Room 01, Grain Silo B, Fruit Vault North"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-sm text-white placeholder-vault-500 focus:outline-none focus:border-agri-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Commodity / Storage Type
                </label>
                <select
                  value={roomCommodity}
                  onChange={(e) => setRoomCommodity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-sm text-white focus:outline-none focus:border-agri-500"
                >
                  <option value="Potato (Bulk Store)">Potato (Bulk Store)</option>
                  <option value="Potato (Seed Store)">Potato (Seed Store)</option>
                  <option value="Apples & Pears">Apples & Pears (CA Storage)</option>
                  <option value="Onions & Garlic">Onions & Garlic</option>
                  <option value="Grapes & Berries">Grapes & Berries</option>
                  <option value="Citrus Fruits">Citrus Fruits</option>
                  <option value="Grain & Cereal Silos">Grain & Cereal Silos</option>
                  <option value="General Cold Storage">General Cold Storage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assign ESP Modules to this Room
                </label>
                <p className="text-[11px] text-vault-400 mb-2">
                  Select available ESP32 / ESP8266 devices. Their sensor streams will feed directly into this room card.
                </p>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-vault-800 rounded-lg p-2 bg-vault-950/60">
                  {allDevices.length === 0 ? (
                    <p className="text-xs text-vault-500 p-2">No ESP devices detected yet. Turn on an ESP module to auto-discover.</p>
                  ) : (
                    allDevices.map((dev) => {
                      const isSelected = selectedDeviceIds.includes(dev.id);
                      return (
                        <div
                          key={dev.id}
                          onClick={() => toggleDeviceSelection(dev.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border text-xs transition ${
                            isSelected
                              ? 'bg-agri-950/40 border-agri-500/50 text-agri-200'
                              : 'bg-vault-900/60 border-vault-800 text-slate-300 hover:bg-vault-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-vault-700 text-agri-500 focus:ring-0"
                            />
                            <div>
                              <p className="font-semibold text-white">{dev.user_name || dev.id}</p>
                              <span className="text-[10px] text-vault-400 font-mono">
                                {dev.id} • {dev.hardware_type || 'ESP'} • {dev.ip_address}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            dev.is_online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {dev.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-vault-800">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !roomName.trim()}
                  className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                >
                  {isSubmitting ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Configure Room Modal */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-vault-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Configure: {editingRoom.name}</h3>
                <p className="text-xs text-vault-400">Rename section or manage assigned ESP hardware modules.</p>
              </div>
              <button
                onClick={() => setEditingRoom(null)}
                className="p-1 rounded-lg hover:bg-vault-800 text-vault-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room / Section Name *
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-sm text-white focus:outline-none focus:border-agri-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Commodity / Storage Type
                </label>
                <select
                  value={roomCommodity}
                  onChange={(e) => setRoomCommodity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-vault-950 border border-vault-700 text-sm text-white focus:outline-none focus:border-agri-500"
                >
                  <option value="Potato (Bulk Store)">Potato (Bulk Store)</option>
                  <option value="Potato (Seed Store)">Potato (Seed Store)</option>
                  <option value="Apples & Pears">Apples & Pears (CA Storage)</option>
                  <option value="Onions & Garlic">Onions & Garlic</option>
                  <option value="Grapes & Berries">Grapes & Berries</option>
                  <option value="Citrus Fruits">Citrus Fruits</option>
                  <option value="Grain & Cereal Silos">Grain & Cereal Silos</option>
                  <option value="General Cold Storage">General Cold Storage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned ESP Modules
                </label>
                <p className="text-[11px] text-vault-400 mb-2">
                  Check devices to assign to this room; uncheck to detach.
                </p>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-vault-800 rounded-lg p-2 bg-vault-950/60">
                  {allDevices.map((dev) => {
                    const isSelected = selectedDeviceIds.includes(dev.id);
                    return (
                      <div
                        key={dev.id}
                        onClick={() => toggleDeviceSelection(dev.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border text-xs transition ${
                          isSelected
                            ? 'bg-agri-950/40 border-agri-500/50 text-agri-200'
                            : 'bg-vault-900/60 border-vault-800 text-slate-300 hover:bg-vault-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-vault-700 text-agri-500 focus:ring-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-white">{dev.user_name || dev.id}</p>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                  (dev.hardware_type || '').includes('8266') || dev.id.includes('8266')
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                }`}
                              >
                                {(dev.hardware_type || '').includes('8266') || dev.id.includes('8266') ? 'ESP8266' : 'ESP32'}
                              </span>
                              {!dev.area_id && (
                                <span className="text-[9px] font-mono uppercase bg-indigo-500/30 text-indigo-300 px-1 py-0.5 rounded border border-indigo-500/40">
                                  Available
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-vault-400 font-mono">
                              {dev.id} • {dev.ip_address || 'Internet WAN'} • Direct Internet
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          dev.is_online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {dev.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-vault-800">
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Room</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRoom(null)}
                    className="px-4 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !roomName.trim()}
                    className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Cloud IoT Architecture Notice */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-200 flex items-center gap-2">
              <span>Direct Cloud IoT Architecture</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ZERO HARDWARE GATEWAY
              </span>
            </p>
            <p className="text-vault-400">
              ESP32 & ESP8266 nodes stream telemetry directly over Wi-Fi and Internet to cloud REST & MQTT endpoints.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-2.5 py-1 rounded bg-vault-950 border border-vault-800 text-[11px] font-mono text-agri-400">
            REST /telemetry | MQTT :1883
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            INTERNET LIVE
          </span>
        </div>
      </div>
    </div>
  );
};

