import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ESPDevice, Area } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { stateMesh } from '../api/stateMesh';
import {
  Cpu,
  Globe,
  Radio,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle,
  Wifi,
  Battery,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  X,
  ExternalLink,
  Layers,
  Check,
  Unlink
} from 'lucide-react';

export const DevicesPage: React.FC<{ onSelectDevice?: (id: string) => void }> = ({ onSelectDevice }) => {
  const { overview, refreshOverview } = useApp();
  const { role } = useAuth();
  const [devices, setDevices] = useState<ESPDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [hardwareFilter, setHardwareFilter] = useState<'all' | 'esp32' | 'esp8266'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'assigned'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanningType, setScanningType] = useState<'ESP32' | 'ESP8266' | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Edit / Assign Modal State
  const [editingDevice, setEditingDevice] = useState<ESPDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editAreaId, setEditAreaId] = useState('');

  const canEdit = role === 'Owner' || role === 'Admin' || role === 'Operator';

  const loadDevices = async () => {
    try {
      const rawData = await api.getDevices();
      const data = stateMesh.reconcileDevices(rawData);
      setDevices((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateDiscovery = async (hw: 'ESP32' | 'ESP8266') => {
    setIsScanning(true);
    setScanningType(hw);
    try {
      await api.simulateDiscovery(hw);
      await loadDevices();
      await refreshOverview();
    } finally {
      setIsScanning(false);
      setScanningType(null);
    }
  };

  const handleSaveDevice = async () => {
    if (!editingDevice) return;
    try {
      await api.updateDevice(editingDevice.id, {
        userName: editName,
        areaId: editAreaId || null,
        isDiscovered: editAreaId ? 0 : 1
      });
      setEditingDevice(null);
      await loadDevices();
      await refreshOverview();
    } catch (err: any) {
      alert(`Failed to update device: ${err.message}`);
    }
  };

  const handleUnassignDevice = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to unassign "${name}" from its room? It will return to the available fleet.`)) return;
    try {
      await api.unassignDevice(id);
      await loadDevices();
      await refreshOverview();
    } catch (err: any) {
      alert(`Failed to unassign device: ${err.message}`);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently unregister "${name}" (${id})?`)) return;
    try {
      await api.deleteDevice(id);
      await loadDevices();
      await refreshOverview();
    } catch (err: any) {
      alert(`Failed to delete device: ${err.message}`);
    }
  };

  const areas: Area[] = overview?.areas || [];

  const is8266 = (d: ESPDevice) =>
    (d.hardware_type || '').toUpperCase().includes('8266') || d.id.toUpperCase().includes('8266');

  // Filtered devices based on all criteria
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.user_name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.area_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.hardware_type || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && d.is_online === 1) ||
      (statusFilter === 'offline' && d.is_online === 0);

    const matchesHardware =
      hardwareFilter === 'all' ||
      (hardwareFilter === 'esp8266' && is8266(d)) ||
      (hardwareFilter === 'esp32' && !is8266(d));

    const isAvailable = !d.area_id;
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' && isAvailable) ||
      (availabilityFilter === 'assigned' && !isAvailable);

    return matchesSearch && matchesStatus && matchesHardware && matchesAvailability;
  });

  const availableDevices = devices.filter((d) => !d.area_id);
  const esp32Count = devices.filter((d) => !is8266(d)).length;
  const esp8266Count = devices.filter((d) => is8266(d)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Hardware & ESP Node Fleet
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Direct Internet Sync
            </span>
          </div>
          <p className="text-xs text-vault-400">
            Monitor, auto-discover, and assign ESP32 and ESP8266 microcontrollers connected directly over the Internet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSetupGuide(true)}
            className="px-3 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-vault-700 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-agri-400" />
            <span>Internet Setup Guide</span>
          </button>

          {/* Quick Simulate Buttons for both hardware types */}
          <div className="inline-flex rounded-lg shadow-sm border border-vault-700 overflow-hidden bg-vault-950">
            <button
              onClick={() => handleSimulateDiscovery('ESP32')}
              disabled={isScanning}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              title="Connect an ESP32 node over Internet"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{isScanning && scanningType === 'ESP32' ? 'Connecting...' : '+ Connect ESP32'}</span>
            </button>
            <button
              onClick={() => handleSimulateDiscovery('ESP8266')}
              disabled={isScanning}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition border-l border-vault-700 disabled:opacity-50"
              title="Connect an ESP8266 node over Internet"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isScanning && scanningType === 'ESP8266' ? 'Connecting...' : '+ Connect ESP8266'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Available / Unassigned ESPs Highlight Banner */}
      {availableDevices.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-950/60 via-vault-900 to-indigo-950/60 border border-indigo-500/50 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Available ESP Nodes Detected Over Internet</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500 text-white">
                    {availableDevices.length} READY
                  </span>
                </h4>
                <p className="text-xs text-indigo-200/90 mt-0.5">
                  These microcontrollers have connected over Wi-Fi and are streaming live telemetry without room assignment.
                </p>
              </div>
            </div>

            <button
              onClick={() => setAvailabilityFilter('available')}
              className="text-xs font-semibold text-indigo-300 hover:text-white flex items-center gap-1 transition"
            >
              <span>View all available ({availableDevices.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Available Device Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-indigo-500/20">
            {availableDevices.slice(0, 3).map((dev) => {
              const dev8266 = is8266(dev);
              return (
                <div
                  key={dev.id}
                  className="bg-vault-950/80 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-indigo-400 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                        dev8266
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {dev8266 ? 'ESP8266' : 'ESP32'}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{dev.user_name || dev.id}</p>
                      <p className="text-[10px] font-mono text-vault-400 truncate">
                        {dev.id} • {dev.ip_address || 'Internet WAN'}
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingDevice(dev);
                        setEditName(dev.user_name);
                        setEditAreaId('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold shrink-0 shadow transition"
                    >
                      Assign Room
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-vault-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by device ID, name, or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-vault-950 border border-vault-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-vault-500 focus:outline-none focus:border-agri-500"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Hardware filter */}
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800">
            <span className="text-[10px] font-mono text-vault-500 uppercase px-1.5">Chip:</span>
            {(['all', 'esp32', 'esp8266'] as const).map((hw) => (
              <button
                key={hw}
                onClick={() => setHardwareFilter(hw)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase transition ${
                  hardwareFilter === hw
                    ? hw === 'esp8266'
                      ? 'bg-purple-600 text-white'
                      : hw === 'esp32'
                      ? 'bg-blue-600 text-white'
                      : 'bg-agri-600 text-white'
                    : 'text-vault-400 hover:text-white'
                }`}
              >
                {hw === 'all' ? `All (${devices.length})` : hw === 'esp32' ? `ESP32 (${esp32Count})` : `ESP8266 (${esp8266Count})`}
              </button>
            ))}
          </div>

          {/* Availability filter */}
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800">
            <span className="text-[10px] font-mono text-vault-500 uppercase px-1.5">State:</span>
            {(['all', 'available', 'assigned'] as const).map((av) => (
              <button
                key={av}
                onClick={() => setAvailabilityFilter(av)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition ${
                  availabilityFilter === av
                    ? av === 'available'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-agri-600 text-white'
                    : 'text-vault-400 hover:text-white'
                }`}
              >
                {av === 'all' ? 'All' : av === 'available' ? `Available (${availableDevices.length})` : 'Assigned'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800">
            <span className="text-[10px] font-mono text-vault-500 uppercase px-1.5">Link:</span>
            {(['all', 'online', 'offline'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition ${
                  statusFilter === s ? 'bg-agri-600 text-white' : 'text-vault-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <div className="bg-vault-900/60 border border-dashed border-vault-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-vault-800/80 border border-vault-700/80 text-vault-400 mx-auto flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No ESP Devices Connected</h3>
          <p className="text-xs text-vault-400 max-w-md mx-auto">
            No microcontrollers are currently transmitting. Power on your ESP32 or ESP8266 board connected to Wi-Fi. 
            The moment it transmits to the server, it will appear here automatically under "Available Devices" ready to be named and assigned.
          </p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-vault-900/60 border border-vault-800 rounded-2xl p-8 text-center text-vault-400 text-xs">
          No devices match your current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((d) => {
          const dev8266 = is8266(d);
          const isAvailable = !d.area_id || d.is_discovered === 1;

          return (
            <div
              key={d.id}
              className={`bg-vault-900 rounded-xl border p-4 shadow-md transition flex flex-col justify-between ${
                isAvailable
                  ? 'border-indigo-500/60 bg-gradient-to-br from-vault-900 to-indigo-950/30'
                  : d.is_online === 1
                  ? 'border-vault-800 hover:border-vault-700'
                  : 'border-rose-950/80 bg-rose-950/10'
              }`}
            >
              <div>
                {/* Card Top: Name, Hardware Badge, Online Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-white tracking-tight">{d.user_name}</h3>
                      {/* Chip for Hardware Model */}
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                          dev8266
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        }`}
                      >
                        {dev8266 ? 'ESP8266' : 'ESP32'}
                      </span>
                      {isAvailable && (
                        <span className="text-[9px] font-mono uppercase bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40">
                          AVAILABLE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-vault-400">{d.id}</span>
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" /> Direct Internet
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        d.is_online === 1 ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    ></span>
                    <span className="text-[11px] font-mono font-semibold text-vault-300">
                      {d.is_online === 1 ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Area mapping */}
                <div className="mb-3 text-xs bg-vault-950/70 p-2.5 rounded-lg border border-vault-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-vault-400 block text-[10px] uppercase font-mono">Assigned Storage Zone:</span>
                    <span className="font-semibold text-slate-200">
                      {d.area_name || <em className="text-amber-400 font-normal">Unassigned (Available on Standby)</em>}
                    </span>
                  </div>
                  {isAvailable && canEdit && (
                    <button
                      onClick={() => {
                        setEditingDevice(d);
                        setEditName(d.user_name);
                        setEditAreaId('');
                      }}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold shadow transition"
                    >
                      + Assign
                    </button>
                  )}
                </div>

                {/* Hardware Specs & Health */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono text-[11px]">
                  <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                    <span className="text-vault-500 block text-[9px] uppercase">IP / WAN Address</span>
                    <span className="text-slate-200">{d.ip_address || 'Direct Cloud IP'}</span>
                  </div>
                  <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                    <span className="text-vault-500 block text-[9px] uppercase">Signal (RSSI)</span>
                    <span className="text-slate-200">{d.signal_rssi} dBm</span>
                  </div>
                  <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                    <span className="text-vault-500 block text-[9px] uppercase">Battery / Supply</span>
                    <span className="text-slate-200">{d.battery_voltage}V (Nominal)</span>
                  </div>
                  <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                    <span className="text-vault-500 block text-[9px] uppercase">Firmware & Board</span>
                    <span className="text-slate-200 truncate block">{d.hardware_type || (dev8266 ? 'ESP8266' : 'ESP32')}</span>
                  </div>
                </div>

                {/* Sensors Attached */}
                {d.sensors && d.sensors.length > 0 && (
                  <div className="text-xs">
                    <span className="text-[10px] text-vault-400 font-semibold block mb-1">Attached Sensors:</span>
                    <div className="flex flex-wrap gap-1">
                      {d.sensors.map((s) => (
                        <span
                          key={s.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-vault-800 text-vault-300 font-mono"
                        >
                          {s.sensor_type} ({s.calibrated_reading}{s.unit})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 mt-3 border-t border-vault-800/80 flex items-center justify-between text-xs">
                <span className="text-[10px] text-vault-500 font-mono">
                  Beat: {new Date(d.last_heartbeat).toLocaleTimeString()}
                </span>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    {d.area_id && (
                      <button
                        onClick={() => handleUnassignDevice(d.id, d.user_name)}
                        className="p-1.5 rounded bg-vault-800 hover:bg-amber-900/40 text-vault-400 hover:text-amber-300 transition"
                        title={`Unassign from ${d.area_name || 'Room'}`}
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingDevice(d);
                        setEditName(d.user_name);
                        setEditAreaId(d.area_id || '');
                      }}
                      className="p-1.5 rounded bg-vault-800 hover:bg-vault-700 text-slate-200 transition"
                      title="Configure & Assign"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(d.id, d.user_name)}
                      className="p-1.5 rounded bg-vault-800 hover:bg-rose-900/60 text-vault-400 hover:text-rose-300 transition"
                      title="Unregister Node"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Edit / Assign Modal */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Configure Node: {editingDevice.id}</h3>
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                  is8266(editingDevice) ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {editingDevice.hardware_type || (is8266(editingDevice) ? 'ESP8266' : 'ESP32')} • Internet Direct
                </span>
              </div>
              <button
                onClick={() => setEditingDevice(null)}
                className="text-vault-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-vault-300 mb-1 font-semibold">User-Defined Friendly Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-vault-300 mb-1 font-semibold">Assign to Storage Room / Vault</label>
                <select
                  value={editAreaId}
                  onChange={(e) => setEditAreaId(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500 font-medium"
                >
                  <option value="">-- Available / Standby (Unassigned) --</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.commodity})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-vault-500 mt-1">
                  Assigning this ESP connects its sensors to the room's health score and alert engine.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-vault-800">
              <button
                onClick={() => setEditingDevice(null)}
                className="px-3.5 py-1.5 rounded-lg bg-vault-800 text-slate-300 text-xs hover:bg-vault-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDevice}
                className="px-4 py-1.5 rounded-lg bg-agri-600 text-white text-xs font-semibold hover:bg-agri-500 shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internet Connection Setup Guide Modal */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-vault-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-agri-400" />
                <h3 className="text-base font-bold text-white">
                  Connecting ESP32 & ESP8266 Over the Internet
                </h3>
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                className="text-vault-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-vault-300">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <p className="font-semibold text-emerald-300">Zero Gateway Architecture</p>
                <p className="text-emerald-400/90 text-[11px] mt-0.5">
                  No Raspberry Pi or physical gateway is needed. Your ESP32 and ESP8266 microcontrollers connect directly to your local Wi-Fi and communicate over the Internet with this AgriVault instance.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">Method 1: SoftAP Setup Wizard (On First Boot)</h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
                  <li>Power on the ESP8266 or ESP32 node.</li>
                  <li>On your phone or laptop, connect to the Wi-Fi network: <code className="bg-vault-950 px-1.5 py-0.5 rounded text-agri-300 font-mono">AgriVault-Node-XXXX</code>.</li>
                  <li>Open your browser to <code className="bg-vault-950 px-1.5 py-0.5 rounded text-agri-300 font-mono">http://192.168.4.1</code>.</li>
                  <li>Enter your normal Wi-Fi network credentials and your AgriVault Server URL:
                    <div className="mt-1 p-2 bg-vault-950 rounded font-mono text-[11px] text-agri-300">
                      {window.location.origin}
                    </div>
                  </li>
                  <li>Click <strong>Save and Connect</strong>. The node reboots, connects to the Internet, and automatically appears here!</li>
                </ol>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">Method 2: Direct HTTP REST Ingestion</h4>
                <p className="text-vault-400 mb-2">Send periodic HTTP POST telemetry payloads to:</p>
                <div className="bg-vault-950 p-2.5 rounded-lg border border-vault-800 font-mono text-[11px] text-slate-200">
                  <span className="text-emerald-400 font-bold">POST</span> {window.location.origin}/api/devices/telemetry
                </div>
                <div className="bg-vault-950 p-2.5 rounded-lg border border-vault-800 font-mono text-[10px] text-vault-400 mt-2">
{`{
  "deviceId": "ESP8266-A1B2",
  "hardwareType": "ESP8266-NodeMCU",
  "temperature": 4.5,
  "humidity": 88.0,
  "co2": 850
}`}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">Method 3: Direct MQTT Broker (Port 1883)</h4>
                <p className="text-vault-400 mb-1">Connect your MQTT client directly to this host on port 1883:</p>
                <div className="bg-vault-950 p-2.5 rounded-lg border border-vault-800 font-mono text-[11px] text-agri-300">
                  agrivault/fac-01/device/&lt;DEVICE_ID&gt;/telemetry
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-vault-800">
              <button
                onClick={() => setShowSetupGuide(false)}
                className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
