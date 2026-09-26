import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ESPDevice, Area } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Cpu,
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
  ShieldCheck
} from 'lucide-react';

export const DevicesPage: React.FC<{ onSelectDevice?: (id: string) => void }> = ({ onSelectDevice }) => {
  const { overview, refreshOverview } = useApp();
  const { role } = useAuth();
  const [devices, setDevices] = useState<ESPDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [isScanning, setIsScanning] = useState(false);

  // Edit / Assign Modal State
  const [editingDevice, setEditingDevice] = useState<ESPDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editAreaId, setEditAreaId] = useState('');

  const canEdit = role === 'Owner' || role === 'Admin' || role === 'Operator';

  const loadDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
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

  const handleSimulateDiscovery = async () => {
    setIsScanning(true);
    try {
      await api.simulateDiscovery();
      await loadDevices();
      await refreshOverview();
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveDevice = async () => {
    if (!editingDevice) return;
    try {
      await api.updateDevice(editingDevice.id, {
        userName: editName,
        areaId: editAreaId || null,
        isDiscovered: 0 // Mark accepted
      });
      setEditingDevice(null);
      await loadDevices();
      await refreshOverview();
    } catch (err: any) {
      alert(`Failed to update device: ${err.message}`);
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

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.user_name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.area_name || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && d.is_online === 1) ||
      (statusFilter === 'offline' && d.is_online === 0);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Hardware & ESP Node Management
          </h1>
          <p className="text-xs text-vault-400">
            Automatically discover, configure, assign, and monitor individual ESP32 sensor nodes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateDiscovery}
            disabled={isScanning}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isScanning ? 'Scanning Mesh...' : 'Discover New ESP'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-vault-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by device ID, name, or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-vault-950 border border-vault-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-vault-500 focus:outline-none focus:border-agri-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-vault-400 font-mono">Status:</span>
          {(['all', 'online', 'offline'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? 'bg-agri-600 text-white shadow'
                  : 'bg-vault-950 text-vault-400 hover:text-white border border-vault-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Newly Discovered Device Alert Card (if any pending) */}
      {devices.some((d) => d.is_discovered === 1) && (
        <div className="bg-indigo-950/40 border border-indigo-500/50 rounded-xl p-4 shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Unassigned Hardware Nodes Detected!</h4>
              <p className="text-xs text-indigo-300">
                Central Gateway detected new ESP nodes on the local Wi-Fi mesh. Click Configure to assign them to a storage vault.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((d) => (
          <div
            key={d.id}
            className={`bg-vault-900 rounded-xl border p-4 shadow-md transition flex flex-col justify-between ${
              d.is_discovered === 1
                ? 'border-indigo-500/60 bg-gradient-to-br from-vault-900 to-indigo-950/30'
                : d.is_online === 1
                ? 'border-vault-800 hover:border-vault-700'
                : 'border-rose-950/80 bg-rose-950/10'
            }`}
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">{d.user_name}</h3>
                    {d.is_discovered === 1 && (
                      <span className="text-[9px] font-mono uppercase bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-vault-400">{d.id}</p>
                </div>

                <div className="flex items-center gap-1.5">
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
              <div className="mb-3 text-xs bg-vault-950/70 p-2 rounded border border-vault-800/80">
                <span className="text-vault-400 block text-[10px]">Assigned Zone:</span>
                <span className="font-semibold text-slate-200">
                  {d.area_name || <em className="text-amber-400 font-normal">Unassigned (Standby)</em>}
                </span>
              </div>

              {/* Hardware Specs & Health */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono text-[11px]">
                <div className="bg-vault-950/40 p-1.5 rounded">
                  <span className="text-vault-500 block text-[9px]">IP ADDRESS</span>
                  <span className="text-slate-200">{d.ip_address || '192.168.1.xxx'}</span>
                </div>
                <div className="bg-vault-950/40 p-1.5 rounded">
                  <span className="text-vault-500 block text-[9px]">SIGNAL (RSSI)</span>
                  <span className="text-slate-200">{d.signal_rssi} dBm</span>
                </div>
                <div className="bg-vault-950/40 p-1.5 rounded">
                  <span className="text-vault-500 block text-[9px]">BATTERY / RAIL</span>
                  <span className="text-slate-200">{d.battery_voltage}V (Nominal)</span>
                </div>
                <div className="bg-vault-950/40 p-1.5 rounded">
                  <span className="text-vault-500 block text-[9px]">FIRMWARE</span>
                  <span className="text-slate-200">{d.firmware_version}</span>
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
        ))}
      </div>

      {/* Edit / Assign Modal */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Configure ESP Node: {editingDevice.id}</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-vault-300 mb-1 font-semibold">User-Defined Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-vault-300 mb-1 font-semibold">Assign to Area / Vault</label>
                <select
                  value={editAreaId}
                  onChange={(e) => setEditAreaId(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500 font-medium"
                >
                  <option value="">-- Unassigned (Standby) --</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.commodity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-vault-800">
              <button
                onClick={() => setEditingDevice(null)}
                className="px-3 py-1.5 rounded bg-vault-800 text-slate-300 text-xs hover:bg-vault-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDevice}
                className="px-3 py-1.5 rounded bg-agri-600 text-white text-xs font-semibold hover:bg-agri-500 shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
