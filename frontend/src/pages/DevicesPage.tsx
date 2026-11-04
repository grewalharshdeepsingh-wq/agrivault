import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ESPDevice, Area } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { stateMesh } from '../api/stateMesh';
import { wsManager } from '../api/websocket';
import { getAllFoodProfiles, getFoodProfile } from '../api/foodProfiles';
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
  Unlink,
  ShieldAlert
} from 'lucide-react';
import { DeviceConfigureModal } from '../components/DeviceConfigureModal';
import { GlobalNodeFeedbackBar } from '../components/GlobalNodeFeedbackBar';

export const DevicesPage: React.FC<{ onSelectDevice?: (id: string) => void }> = ({ onSelectDevice }) => {
  const { overview, refreshOverview } = useApp();
  const { role } = useAuth();
  const [devices, setDevices] = useState<ESPDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [regFilter, setRegFilter] = useState<'all' | 'active' | 'pending' | 'revoked'>('all');
  const [hardwareFilter, setHardwareFilter] = useState<'all' | 'esp32' | 'esp8266'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'assigned'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanningType, setScanningType] = useState<'ESP32' | 'ESP8266' | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // Configuration Modal State
  const [configuringDevice, setConfiguringDevice] = useState<ESPDevice | null>(null);

  // Fake / Diversified ESP Modal State
  const [showCreateFakeModal, setShowCreateFakeModal] = useState(false);
  const [newFakeId, setNewFakeId] = useState('');
  const [newFakeName, setNewFakeName] = useState('');
  const [newFakeFood, setNewFakeFood] = useState('apple');
  const [newFakeHw, setNewFakeHw] = useState<'ESP32' | 'ESP8266'>('ESP32');
  const [newFakeAreaId, setNewFakeAreaId] = useState('');
  const [isCreatingFake, setIsCreatingFake] = useState(false);

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
    const interval = setInterval(loadDevices, 5000);

    const unsubUpdate = wsManager.on('device_updated', (dev) => {
      if (dev && dev.id) {
        setDevices((prev) => {
          const idx = prev.findIndex((d) => d.id.toLowerCase() === dev.id.toLowerCase());
          if (idx >= 0) {
            const cur = prev[idx];
            if (
              cur.is_online === dev.is_online &&
              cur.area_id === dev.area_id &&
              cur.user_name === dev.user_name &&
              JSON.stringify(cur.sensors) === JSON.stringify(dev.sensors)
            ) {
              return prev;
            }
            const copy = [...prev];
            copy[idx] = { ...cur, ...dev };
            return copy;
          }
          return [dev, ...prev];
        });
      }
    });

    const unsubDiscovered = wsManager.on('device_discovered', (payload) => {
      const dev = payload?.device;
      if (dev && dev.id) {
        setDevices((prev) => {
          const exists = prev.some((d) => d.id.toLowerCase() === dev.id.toLowerCase());
          if (exists) return prev;
          return [dev, ...prev];
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsubUpdate();
      unsubDiscovered();
    };
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

  const handleRejectDevice = async (id: string, name: string) => {
    if (!confirm(`Reject discovery of "${name}" (${id})? It will be removed from pending list.`)) return;
    try {
      await api.rejectDevice(id);
      await loadDevices();
      await refreshOverview();
    } catch (err: any) {
      alert(`Failed to reject device: ${err.message}`);
    }
  };

  const handleRevokeDevice = async (id: string, name: string) => {
    if (!confirm(`Revoke authorization for "${name}" (${id})? It will be moved to REVOKED state.`)) return;
    try {
      await api.revokeDevice(id);
      await loadDevices();
      await refreshOverview();
    } catch (err: any) {
      alert(`Failed to revoke device: ${err.message}`);
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
      (d.hardware_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.area_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.zone_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.hardware_type || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && d.is_online === 1) ||
      (statusFilter === 'offline' && d.is_online === 0);

    const matchesReg =
      regFilter === 'all' ||
      (regFilter === 'active' && (!d.registration_status || d.registration_status === 'active')) ||
      (regFilter === 'pending' && d.registration_status === 'pending') ||
      (regFilter === 'revoked' && d.registration_status === 'revoked');

    const matchesHardware =
      hardwareFilter === 'all' ||
      (hardwareFilter === 'esp8266' && is8266(d)) ||
      (hardwareFilter === 'esp32' && !is8266(d));

    const isAvailable = (!d.area_id || d.is_discovered === 1) && !d.is_simulated && d.registration_status !== 'revoked' && d.registration_status !== 'rejected';
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' && isAvailable) ||
      (availabilityFilter === 'assigned' && !isAvailable);

    const matchesRegEffective =
      availabilityFilter === 'available'
        ? !d.is_simulated && d.registration_status !== 'revoked' && d.registration_status !== 'rejected'
        : matchesReg;

    return matchesSearch && matchesStatus && matchesRegEffective && matchesHardware && matchesAvailability;
  });

  const pendingDevices = devices.filter((d) => d.registration_status === 'pending' && !d.is_simulated);
  const availableDevices = devices.filter((d) => (!d.area_id || d.is_discovered === 1) && !d.is_simulated && d.registration_status !== 'revoked' && d.registration_status !== 'rejected');
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
            onClick={() => {
              setShowSetupGuide(true);
              api.getNetworkInfo().then(setNetworkInfo).catch(() => {});
            }}
            className="px-3 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-vault-700 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-agri-400" />
            <span>Internet Setup Guide</span>
          </button>

          {/* Create Cloned / Fake ESP with Food Diversity */}
          <button
            onClick={() => {
              const fakeCount = stateMesh.getFakeEsps().length + 1;
              setNewFakeId(`AGR-ESP-SIM-${String(fakeCount).padStart(2, '0')}`);
              setNewFakeName(`Storage Node ${fakeCount}`);
              setNewFakeFood('apple');
              setNewFakeHw('ESP32');
              setNewFakeAreaId(areas[0]?.id || '');
              setShowCreateFakeModal(true);
            }}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition border border-emerald-400/40"
            title="Create a similar fake ESP with customizable food type"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Clone / Create Fake ESP</span>
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

      {/* Big Global Ground-Truth Spoilage & Microclimate Feedback Bar for All Nodes */}
      <GlobalNodeFeedbackBar />

      {/* Pending Provisioning Requests Banner (Security Gate) */}
      {pendingDevices.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/70 via-vault-900 to-amber-950/70 border border-amber-500/60 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ShieldCheck className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>New Hardware Nodes Pending Admin Provisioning</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-black">
                    {pendingDevices.length} PENDING
                  </span>
                </h4>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  Untrusted sensor nodes detected by the Inner Gateway. For security, nodes must be approved and assigned before full telemetry ingestion.
                </p>
              </div>
            </div>

            <button
              onClick={() => setRegFilter('pending')}
              className="text-xs font-semibold text-amber-300 hover:text-white flex items-center gap-1 transition shrink-0"
            >
              <span>Review All Pending ({pendingDevices.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-amber-500/20">
            {pendingDevices.slice(0, 3).map((dev) => (
              <div
                key={dev.id}
                className="bg-vault-950/90 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-amber-300 transition"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{dev.user_name || dev.device_code || dev.id}</span>
                    {dev.is_simulated ? (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        SIM
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] font-mono text-amber-400/90 truncate">
                    MAC: {dev.hardware_id || dev.id}
                  </p>
                </div>

                {canEdit && (
                  <button
                    onClick={() => setConfiguringDevice(dev)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold shrink-0 shadow transition flex items-center gap-1"
                  >
                    <span>Authorize</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <span>Available ESP Nodes Detected In Fleet</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500 text-white">
                    {availableDevices.length} READY
                  </span>
                </h4>
                <p className="text-xs text-indigo-200/90 mt-0.5">
                  Approved microcontrollers streaming live telemetry without specific storage rack/zone assignment.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setAvailabilityFilter('available');
                setRegFilter('all');
              }}
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
                        {dev.hardware_id || dev.id}
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => setConfiguringDevice(dev)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold shrink-0 shadow transition"
                    >
                      Configure
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
            placeholder="Search by ID, MAC, name, or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-vault-950 border border-vault-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-vault-500 focus:outline-none focus:border-agri-500"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Registration Filter */}
          <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800">
            <span className="text-[10px] font-mono text-vault-500 uppercase px-1.5">Reg:</span>
            {(['all', 'active', 'pending', 'revoked'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRegFilter(r)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase transition ${
                  regFilter === r
                    ? r === 'pending'
                      ? 'bg-amber-500 text-black font-bold'
                      : r === 'revoked'
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                    : 'text-vault-400 hover:text-white'
                }`}
              >
                {r === 'all'
                  ? 'All'
                  : r === 'pending'
                  ? `Pending (${pendingDevices.length})`
                  : r}
              </button>
            ))}
          </div>

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
                onClick={() => {
                  setAvailabilityFilter(av);
                  if (av === 'available') setRegFilter('all');
                }}
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
            No microcontrollers are currently transmitting. Power on your ESP32 or ESP8266 node connected to the Inner Gateway via ESP-NOW or directly over Wi-Fi. 
            Once discovered, new devices appear here under "Pending Provisioning" ready for administrator review.
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
            const isPending = d.registration_status === 'pending';
            const isRevoked = d.registration_status === 'revoked';
            const isAvailable = (!d.area_id || d.is_discovered === 1) && !isPending;

            return (
              <div
                key={d.id}
                className={`bg-vault-900 rounded-xl border p-4 shadow-md transition flex flex-col justify-between ${
                  isPending
                    ? 'border-amber-500/70 bg-gradient-to-br from-amber-950/20 via-vault-900 to-vault-900 ring-1 ring-amber-500/40'
                    : isRevoked
                    ? 'border-rose-900/80 bg-rose-950/20 opacity-80'
                    : isAvailable
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
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          {d.user_name || d.device_code || d.id}
                        </h3>

                        {/* Simulated badge */}
                        {d.is_simulated ? (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            [SIMULATED]
                          </span>
                        ) : null}

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

                        {/* Registration Status Pill */}
                        {isPending ? (
                          <span className="text-[9px] font-mono font-bold uppercase bg-amber-500 text-black px-1.5 py-0.5 rounded shadow">
                            PENDING REGISTRATION
                          </span>
                        ) : isRevoked ? (
                          <span className="text-[9px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/40">
                            REVOKED
                          </span>
                        ) : isAvailable ? (
                          <span className="text-[9px] font-mono uppercase bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40">
                            AVAILABLE
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono text-vault-400">
                          ID: {d.device_code || d.id}
                        </span>
                        <span className="text-[10px] font-mono text-vault-500">
                          MAC: {d.hardware_id || 'ESP32-MAC'}
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

                  {/* Physical Hierarchy Location */}
                  <div className="mb-3 text-xs bg-vault-950/70 p-2.5 rounded-lg border border-vault-800/80">
                    <span className="text-vault-400 block text-[10px] uppercase font-mono mb-0.5">
                      Facility Placement:
                    </span>
                    <div className="font-semibold text-slate-200 text-[11px] flex items-center gap-1 flex-wrap">
                      <span>{d.cold_store_name || 'Cold Store A'}</span>
                      <span className="text-vault-500">›</span>
                      <span>{d.zone_name || 'North Zone'}</span>
                      <span className="text-vault-500">›</span>
                      <span className="text-agri-400">{d.area_name || d.rack_name || 'Rack 1'}</span>
                      {d.level_name ? (
                        <>
                          <span className="text-vault-500">›</span>
                          <span className="text-vault-300">{d.level_name}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Hardware Specs & Transport Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono text-[11px]">
                    <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                      <span className="text-vault-500 block text-[9px] uppercase">Gateway Link</span>
                      <span className="text-slate-200 truncate block">
                        {d.parent_gateway_id || 'GW-INNER-01 (ESP-NOW)'}
                      </span>
                    </div>
                    <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                      <span className="text-vault-500 block text-[9px] uppercase">Signal (RSSI)</span>
                      <span className="text-slate-200">{d.signal_rssi || -65} dBm</span>
                    </div>
                    <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                      <span className="text-vault-500 block text-[9px] uppercase">Battery / Supply</span>
                      <span className="text-slate-200">{d.battery_voltage || 3.3}V</span>
                    </div>
                    <div className="bg-vault-950/50 p-2 rounded border border-vault-800/40">
                      <span className="text-vault-500 block text-[9px] uppercase">Firmware</span>
                      <span className="text-slate-200 truncate block">{d.firmware_version || 'v2.4.1-espnow'}</span>
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

                  {/* Food Commodity & Cycling Telemetry Link */}
                  <div className="mt-2.5 p-2 rounded-lg bg-vault-950/80 border border-vault-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base shrink-0">{getFoodProfile(d.food_type).icon}</span>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-vault-400 block tracking-wider">Commodity Telemetry:</span>
                        <span className="text-xs font-bold text-slate-100 truncate block">{getFoodProfile(d.food_type).name}</span>
                      </div>
                    </div>

                    {d.is_simulated ? (
                      <div className="shrink-0 flex items-center gap-1">
                        <select
                          value={d.food_type || 'potato'}
                          onChange={async (e) => {
                            await api.updateFakeEspFood(d.id, e.target.value);
                            await loadDevices();
                            await refreshOverview();
                          }}
                          className="bg-vault-900 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 text-xs rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer shadow-sm"
                          title="Switch the food type stored with this node"
                        >
                          {getAllFoodProfiles().map(f => (
                            <option key={f.id} value={f.id}>
                              {f.icon} {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-semibold shrink-0">
                        Online Node (Live)
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 mt-3 border-t border-vault-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-vault-500 font-mono">
                    Beat: {new Date(d.last_heartbeat).toLocaleTimeString()}
                  </span>

                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => setConfiguringDevice(d)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold shadow flex items-center gap-1 transition"
                            title="Approve and configure device"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Authorize</span>
                          </button>
                          <button
                            onClick={() => handleRejectDevice(d.id, d.user_name)}
                            className="p-1.5 rounded bg-vault-800 hover:bg-rose-900/60 text-vault-400 hover:text-rose-300 transition"
                            title="Reject discovery"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {d.area_id && (
                            <button
                              onClick={() => handleUnassignDevice(d.id, d.user_name)}
                              className="p-1.5 rounded bg-vault-800 hover:bg-amber-900/40 text-vault-400 hover:text-amber-300 transition"
                              title={`Unassign from room`}
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!d.area_id && !isRevoked && (
                            <button
                              onClick={() => setConfiguringDevice(d)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 transition shadow-sm"
                              title="Assign this available ESP node to a room"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Assign Room</span>
                            </button>
                          )}
                          <button
                            onClick={() => setConfiguringDevice(d)}
                            className="p-1.5 rounded bg-vault-800 hover:bg-vault-700 text-slate-200 transition"
                            title="Configure, Position & Assign"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isRevoked ? (
                            <button
                              onClick={() => setConfiguringDevice(d)}
                              className="p-1.5 rounded bg-vault-800 hover:bg-emerald-900/60 text-vault-400 hover:text-emerald-300 transition"
                              title="Re-authorize device"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevokeDevice(d.id, d.user_name)}
                              className="p-1.5 rounded bg-vault-800 hover:bg-rose-900/60 text-vault-400 hover:text-rose-300 transition"
                              title="Revoke Authorization"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (d.is_simulated) {
                                if (confirm(`Delete simulated ESP node "${d.user_name}" (${d.id})?`)) {
                                  await api.deleteFakeEsp(d.id);
                                  await loadDevices();
                                  await refreshOverview();
                                }
                              } else {
                                handleDeleteDevice(d.id, d.user_name);
                              }
                            }}
                            className="p-1.5 rounded bg-vault-800 hover:bg-rose-900/60 text-vault-400 hover:text-rose-300 transition"
                            title={d.is_simulated ? "Delete Simulated ESP Node" : "Delete Node"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Device Configuration & Provisioning Modal */}
      {configuringDevice && (
        <DeviceConfigureModal
          device={configuringDevice}
          areas={areas}
          isOpen={Boolean(configuringDevice)}
          onClose={() => setConfiguringDevice(null)}
          onSaved={async () => {
            setConfiguringDevice(null);
            await loadDevices();
            await refreshOverview();
          }}
        />
      )}

      {/* Create / Clone Fake ESP Modal */}
      {showCreateFakeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-vault-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Cloned / Fake ESP Node</h3>
                  <p className="text-xs text-vault-400">Mirrors online ESP telemetry with live cycling & customizable commodity.</p>
                </div>
              </div>
              <button onClick={() => setShowCreateFakeModal(false)} className="text-vault-400 hover:text-white p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-vault-300 font-semibold mb-1">Device ID *</label>
                  <input
                    type="text"
                    value={newFakeId}
                    onChange={(e) => setNewFakeId(e.target.value.toUpperCase())}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-white font-mono text-xs focus:ring-1 focus:ring-agri-500"
                    placeholder="e.g. AGR-ESP-SIM-03"
                  />
                </div>
                <div>
                  <label className="block text-vault-300 font-semibold mb-1">Node Display Name *</label>
                  <input
                    type="text"
                    value={newFakeName}
                    onChange={(e) => setNewFakeName(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-white text-xs focus:ring-1 focus:ring-agri-500"
                    placeholder="e.g. Apples Storage Node"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-vault-300 font-semibold mb-1">Hardware Microcontroller</label>
                  <select
                    value={newFakeHw}
                    onChange={(e) => setNewFakeHw(e.target.value as any)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-white text-xs focus:ring-1 focus:ring-agri-500"
                  >
                    <option value="ESP32">ESP32-DevKit-V1 (Wi-Fi + BLE)</option>
                    <option value="ESP8266">ESP8266-NodeMCU (Wi-Fi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-vault-300 font-semibold mb-1">Assign to Storage Zone</label>
                  <select
                    value={newFakeAreaId}
                    onChange={(e) => setNewFakeAreaId(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-white text-xs focus:ring-1 focus:ring-agri-500"
                  >
                    <option value="">-- Available (Unassigned Fleet) --</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.commodity || 'General Produce'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-vault-300 font-semibold mb-2">
                  Select Food Commodity Stored (Cycles near ~19°C / 55 CO₂):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {getAllFoodProfiles().map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setNewFakeFood(f.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        newFakeFood === f.id
                          ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500 shadow-md'
                          : 'border-vault-800 bg-vault-950/60 hover:border-vault-700 hover:bg-vault-800/40 text-vault-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xl">{f.icon}</span>
                        <span className="text-[11px] font-bold text-white truncate">{f.name.split(' ')[0]}</span>
                      </div>
                      <span className="text-[9px] text-vault-400 line-clamp-2 leading-tight">{f.category}</span>
                      <div className="mt-1.5 pt-1 border-t border-vault-800/80 text-[9px] font-mono text-emerald-400">
                        {f.baseTemp}°C • {f.baseCo2}ppm
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-vault-800">
              <button
                type="button"
                onClick={() => setShowCreateFakeModal(false)}
                className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreatingFake || !newFakeId.trim()}
                onClick={async () => {
                  setIsCreatingFake(true);
                  try {
                    const cleanId = newFakeId.trim().toUpperCase();
                    const areaObj = areas.find(a => a.id === newFakeAreaId);
                    await api.createFakeEsp({
                      id: cleanId,
                      name: newFakeName.trim() || `Cloned Node (${cleanId.slice(-4)})`,
                      hardwareType: newFakeHw,
                      foodType: newFakeFood,
                      areaId: newFakeAreaId || undefined,
                      zoneName: areaObj?.name || 'Diversified Vault',
                      createdAt: new Date().toISOString()
                    });
                    setShowCreateFakeModal(false);
                    await loadDevices();
                    await refreshOverview();
                  } catch (err: any) {
                    alert(`Failed to create fake ESP: ${err?.message || err}`);
                  } finally {
                    setIsCreatingFake(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingFake ? 'Deploying...' : 'Deploy Fake ESP Node'}</span>
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
                    <div className="mt-1 p-2 bg-vault-950 rounded font-mono text-[11px] text-agri-300 break-all select-all">
                      {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                        ? (networkInfo?.localServerUrl || `http://192.168.2.168:4000`)
                        : window.location.origin}
                    </div>
                    {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                      <p className="mt-1 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 p-2 rounded">
                        ⚠️ <strong>Wi-Fi Setup Tip:</strong> Because the ESP connects over your Wi-Fi router, do <strong>NOT</strong> enter &quot;localhost&quot;. Use your computer's local Wi-Fi IP address shown above (e.g. <code>{networkInfo?.localServerUrl || 'http://192.168.2.168:4000'}</code>).
                      </p>
                    )}
                  </li>
                  <li>Click <strong>Save and Connect</strong>. The node reboots, connects to the Internet, and automatically appears here in Available ESP list!</li>
                </ol>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1.5 text-sm">Method 2: Direct HTTP REST Ingestion</h4>
                <p className="text-vault-400 mb-2">Send periodic HTTP POST telemetry payloads to:</p>
                <div className="bg-vault-950 p-2.5 rounded-lg border border-vault-800 font-mono text-[11px] text-slate-200 break-all select-all">
                  <span className="text-emerald-400 font-bold">POST</span>{' '}
                  {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? (networkInfo?.telemetryEndpoint || `http://192.168.2.168:4000/api/devices/telemetry`)
                    : `${window.location.origin}/api/devices/telemetry`}
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
