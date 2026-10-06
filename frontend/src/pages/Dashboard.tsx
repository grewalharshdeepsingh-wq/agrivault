import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AreaCard } from '../components/AreaCard';
import { api } from '../api/client';
import { wsManager } from '../api/websocket';
import { stateMesh } from '../api/stateMesh';
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
  Edit2,
  MapPin,
  Search,
  Filter,
  Cable
} from 'lucide-react';
import { NetworkTopologyBar } from '../components/NetworkTopologyBar';
import { ColdStoreMap } from '../components/ColdStoreMap';
import { DeviceConfigureModal } from '../components/DeviceConfigureModal';

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
  const hasLiveHardware = connectedESPs > 0;
  const avgTemp = hasLiveHardware && overview?.avgTemp !== null && overview?.avgTemp !== undefined ? `${overview.avgTemp}°C` : '--';
  const avgHum = hasLiveHardware && overview?.avgHum !== null && overview?.avgHum !== undefined ? `${overview.avgHum}%` : '--';
  const co2Status = hasLiveHardware ? (overview?.co2Status || 'No Data') : 'No Data';
  const gasStatus = hasLiveHardware ? (overview?.gasStatus || 'No Data') : 'No Data';
  const gateway = overview?.gateway;

  // Room / Section Management State
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Area | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCommodity, setRoomCommodity] = useState('Potato (Bulk Store)');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [allDevices, setAllDevices] = useState<ESPDevice[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab & Hardware Management State
  const [activeTab, setActiveTab] = useState<'rooms' | 'map' | 'nodes'>('rooms');
  const [configuringDevice, setConfiguringDevice] = useState<ESPDevice | null>(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeZoneFilter, setNodeZoneFilter] = useState('all');
  const [nodeStatusFilter, setNodeStatusFilter] = useState<'all' | 'online' | 'offline' | 'pending'>('all');

  // Load all available ESP devices for assignment
  const fetchDevices = async () => {
    try {
      const rawDevs = await api.getDevices();
      const devs = stateMesh.reconcileDevices(rawDevs);
      setAllDevices((prev) => (JSON.stringify(prev) === JSON.stringify(devs) ? prev : devs));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);

    const unsubUpdate = wsManager.on('device_updated', (dev) => {
      if (dev && dev.id) {
        setAllDevices((prev) => {
          const exists = prev.some((d) => d.id.toLowerCase() === dev.id.toLowerCase());
          if (exists) {
            return prev.map((d) => (d.id.toLowerCase() === dev.id.toLowerCase() ? { ...d, ...dev } : d));
          }
          return [dev, ...prev];
        });
      }
    });

    const unsubDiscovered = wsManager.on('device_discovered', (payload) => {
      const dev = payload?.device;
      if (dev && dev.id) {
        setAllDevices((prev) => {
          const exists = prev.some((d) => d.id.toLowerCase() === dev.id.toLowerCase());
          if (exists) {
            return prev.map((d) => (d.id.toLowerCase() === dev.id.toLowerCase() ? { ...d, ...dev } : d));
          }
          return [dev, ...prev];
        });
      }
    });

    const unsubDeleted = wsManager.on('device_deleted', (payload) => {
      if (payload?.deviceId) {
        setAllDevices((prev) => prev.filter((d) => d.id.toLowerCase() !== payload.deviceId.toLowerCase()));
      }
    });

    return () => {
      clearInterval(interval);
      unsubUpdate();
      unsubDiscovered();
      unsubDeleted();
    };
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
      const createdArea = await api.createAreaDirect({
        name: roomName.trim(),
        commodity: roomCommodity,
        deviceIds: selectedDeviceIds
      });

      // Optimistically update device mappings locally
      if (selectedDeviceIds.length > 0 && createdArea?.id) {
        setAllDevices((prev) =>
          prev.map((d) =>
            selectedDeviceIds.includes(d.id)
              ? { ...d, area_id: createdArea.id, is_discovered: 0 }
              : d
          )
        );
      }

      setShowAddRoomModal(false);
      await Promise.all([refreshOverview(), fetchDevices()]);
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
          await api.updateDevice(dev.id, { areaId: null, isDiscovered: 1 });
        }
      }

      setEditingRoom(null);
      await Promise.all([refreshOverview(), fetchDevices()]);
    } catch (err: any) {
      alert(`Error updating room: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Room from Modal
  const handleDeleteRoom = async () => {
    if (!editingRoom) return;
    if (!confirm(`Are you sure you want to remove room "${editingRoom.name}"? Connected ESP devices will remain registered and unassigned.`)) return;

    setIsSubmitting(true);
    try {
      await api.deleteArea(editingRoom.id);
      setEditingRoom(null);
      await Promise.all([refreshOverview(), fetchDevices()]);
    } catch (err: any) {
      alert(`Error deleting room: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Delete Room from Card
  const handleDeleteAreaDirect = async (area: Area) => {
    if (!confirm(`Are you sure you want to delete room "${area.name}"? Attached ESP devices will safely unassign and return to the available fleet.`)) return;
    try {
      await api.deleteArea(area.id);
      await Promise.all([refreshOverview(), fetchDevices()]);
    } catch (err: any) {
      alert(`Error deleting room: ${err.message}`);
    }
  };

  // Direct Unassign Device from Room Card
  const handleUnassignDeviceDirect = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Unassign "${deviceName}" from this room? It will return to the available fleet.`)) return;
    try {
      await api.unassignDevice(deviceId);
      await Promise.all([refreshOverview(), fetchDevices()]);
    } catch (err: any) {
      alert(`Error unassigning device: ${err.message}`);
    }
  };

  // Direct Delete / Unregister Device from Room Card
  const handleDeleteDeviceDirect = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Are you sure you want to permanently unregister and delete "${deviceName}" (${deviceId})?`)) return;
    try {
      await api.deleteDevice(deviceId);
      await Promise.all([refreshOverview(), fetchDevices()]);
    } catch (err: any) {
      alert(`Error deleting device: ${err.message}`);
    }
  };

  // Toggle device selection
  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  // Unassigned available ESP devices
  const pendingDiscoveredESPs = allDevices.filter(d => !d.area_id);

  return (
    <div className="space-y-6">
      {/* Real-Time Hardware Architecture & Network Topology Bar */}
      <NetworkTopologyBar onFlushBuffer={() => { refreshOverview(); fetchDevices(); }} />

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

          {/* Total ESP Nodes */}
          <div
            onClick={() => setActiveTab('nodes')}
            className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3 cursor-pointer hover:border-vault-700 transition"
          >
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Total ESP Nodes</span>
              <Cpu className="w-3.5 h-3.5 text-agri-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-white">{allDevices.length}</span>
              {offlineESPs > 0 && (
                <span className="text-xs font-mono text-rose-400 font-semibold">({offlineESPs} off)</span>
              )}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 text-agri-400" /> ESP-NOW Mesh ({connectedESPs} on)
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
            <span className="text-[10px] text-vault-500">
              {hasLiveHardware ? 'Across All Vaults' : 'No Live ESP Connected'}
            </span>
          </div>

          {/* Average Humidity */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Facility Avg Hum</span>
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-white">{avgHum}</p>
            <span className="text-[10px] text-vault-500">
              {hasLiveHardware ? 'Target 80-95%' : 'No Live ESP Connected'}
            </span>
          </div>

          {/* CO2 & Gas Status */}
          <div className="bg-vault-950/70 border border-vault-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-vault-400 text-xs mb-1">
              <span>Air & Gas Quality</span>
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white mt-1">
              CO2:{' '}
              <span
                className={
                  !hasLiveHardware || co2Status === 'No Data'
                    ? 'text-vault-400 font-normal'
                    : co2Status === 'Elevated' || co2Status === 'Critical'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {hasLiveHardware ? co2Status : 'No ESP'}
              </span>
            </p>
            <p className="text-[11px] text-vault-400 font-medium">
              VOC/NH3:{' '}
              <span
                className={
                  !hasLiveHardware || gasStatus === 'No Data'
                    ? 'text-vault-400 font-normal'
                    : gasStatus === 'Elevated'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {hasLiveHardware ? gasStatus : 'No ESP'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* New Device Detected / Pending Registration Banner */}
      {allDevices.filter(d => d.registration_status === 'pending' || (d.is_discovered === 1 && !d.area_id)).length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/70 via-vault-900 to-amber-950/70 border border-amber-500/60 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span>New Device Detected ({allDevices.filter(d => d.registration_status === 'pending' || (d.is_discovered === 1 && !d.area_id)).length} Pending Approval)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-black">
                    PENDING REGISTRATION
                  </span>
                </p>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  Microcontroller detected via Inner Gateway (ESP-NOW). Secure authorization requires assigning device ID, name, and zone before activating telemetry.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const firstPending = allDevices.find(d => d.registration_status === 'pending' || (d.is_discovered === 1 && !d.area_id));
                if (firstPending) setConfiguringDevice(firstPending);
              }}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs shadow-md transition shrink-0"
            >
              Configure & Approve
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-3 pt-3 border-t border-amber-500/20">
            {allDevices
              .filter(d => d.registration_status === 'pending' || (d.is_discovered === 1 && !d.area_id))
              .map((d) => (
                <div
                  key={d.id}
                  className="bg-vault-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-3 shadow"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {d.connection_protocol || 'ESP-NOW'}
                    </span>
                    <div>
                      <span className="font-bold text-white block">{d.device_code || d.id}</span>
                      <span className="text-[10px] font-mono text-vault-400">MAC: {d.hardware_id || d.mac_address || '24:0A:C4:XX:XX'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfiguringDevice(d)}
                    className="px-2.5 py-1 rounded bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow transition flex items-center gap-1"
                  >
                    <span>Configure</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vault-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'rooms' ? 'bg-agri-600 text-white shadow-md' : 'text-vault-400 hover:text-white hover:bg-vault-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Storage Rooms & Sections</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 text-white font-mono">{areas.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'map' ? 'bg-agri-600 text-white shadow-md' : 'text-vault-400 hover:text-white hover:bg-vault-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Cold Store 2D Layout Map</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 text-white font-mono">
              {facility?.length_ft || 162}×{facility?.width_ft || 94} ft
            </span>
          </button>

          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'nodes' ? 'bg-agri-600 text-white shadow-md' : 'text-vault-400 hover:text-white hover:bg-vault-800/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>All ESP Hardware Nodes</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 text-white font-mono">{allDevices.length}</span>
          </button>
        </div>

        {activeTab === 'rooms' && (
          <button
            onClick={openCreateModal}
            className="px-3 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Room</span>
          </button>
        )}
      </div>

      {/* TAB 1: Storage Rooms & Sections (Card Grid) */}
      {activeTab === 'rooms' && (
        <div>
          {areas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {areas.map((area: any) => (
                <AreaCard
                  key={area.id}
                  area={area}
                  onClick={() => onSelectArea(area.id)}
                  onEditArea={() => openEditModal(area)}
                  onDeleteArea={() => handleDeleteAreaDirect(area)}
                  onUnassignDevice={(devId, devName) => handleUnassignDeviceDirect(devId, devName)}
                  onDeleteDevice={(devId, devName) => handleDeleteDeviceDirect(devId, devName)}
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
                Click "+ Add Room" to create your storage room section and assign an ESP32 node to begin monitoring.
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
        </div>
      )}

      {/* TAB 2: Cold Store 2D Spatial Layout Map */}
      {activeTab === 'map' && (
        <ColdStoreMap
          facility={facility}
          devices={allDevices}
          onSelectDevice={(id) => {
            const d = allDevices.find(x => x.id === id);
            if (d) setConfiguringDevice(d);
          }}
          onRefreshFacility={() => {
            refreshOverview();
            fetchDevices();
          }}
        />
      )}

      {/* TAB 3: All ESP Hardware Nodes (Comprehensive Table & Filter) */}
      {activeTab === 'nodes' && (
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">ESP32 & ESP8266 Physical Fleet</h3>
              <p className="text-xs text-vault-400">
                Individual hardware nodes transmitting DS18B20 temp, DHT11 humidity, MQ3, and MQ135 sensor streams.
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-vault-400" />
                <input
                  type="text"
                  placeholder="Search Node, MAC, or Rack..."
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  className="bg-vault-950 border border-vault-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-vault-500 focus:outline-none focus:border-agri-500 w-52"
                />
              </div>

              <select
                value={nodeStatusFilter}
                onChange={(e) => setNodeStatusFilter(e.target.value as any)}
                className="bg-vault-950 border border-vault-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-agri-500"
              >
                <option value="all">All Statuses</option>
                <option value="online">Online Only</option>
                <option value="offline">Offline Only</option>
                <option value="pending">Pending Approval</option>
              </select>
            </div>
          </div>

          {/* Nodes Table */}
          <div className="overflow-x-auto rounded-xl border border-vault-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-vault-950/80 text-vault-400 font-semibold border-b border-vault-800">
                <tr>
                  <th className="py-2.5 px-3">Node / Device ID</th>
                  <th className="py-2.5 px-3">Hardware MAC</th>
                  <th className="py-2.5 px-3">Zone & Rack</th>
                  <th className="py-2.5 px-3">Temperature</th>
                  <th className="py-2.5 px-3">Humidity</th>
                  <th className="py-2.5 px-3">MQ3 Gas</th>
                  <th className="py-2.5 px-3">MQ135 Gas</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Signal</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-800/60 font-mono">
                {allDevices
                  .filter((d) => {
                    const matchesSearch =
                      !nodeSearch ||
                      d.user_name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
                      d.id.toLowerCase().includes(nodeSearch.toLowerCase()) ||
                      (d.hardware_id && d.hardware_id.toLowerCase().includes(nodeSearch.toLowerCase())) ||
                      (d.rack_name && d.rack_name.toLowerCase().includes(nodeSearch.toLowerCase()));

                    const matchesStatus =
                      nodeStatusFilter === 'all' ||
                      (nodeStatusFilter === 'online' && d.is_online === 1) ||
                      (nodeStatusFilter === 'offline' && d.is_online === 0) ||
                      (nodeStatusFilter === 'pending' && d.registration_status === 'pending');

                    return matchesSearch && matchesStatus;
                  })
                  .map((d) => {
                    const temp = d.sensors?.find((s) => s.sensor_type === 'temperature')?.calibrated_reading;
                    const hum = d.sensors?.find((s) => s.sensor_type === 'humidity')?.calibrated_reading;
                    const mq3 = d.sensors?.find((s) => s.sensor_type === 'mq3' || s.sensor_type === 'ethanol')?.calibrated_reading;
                    const mq135 = d.sensors?.find((s) => s.sensor_type === 'mq135' || s.sensor_type === 'ammonia')?.calibrated_reading;
                    const isPending = d.registration_status === 'pending';

                    return (
                      <tr key={d.id} className="hover:bg-vault-800/30 transition font-sans">
                        <td className="py-2.5 px-3 font-medium text-white">
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-agri-400 shrink-0" />
                            <div>
                              <span className="font-bold block">{d.user_name || d.id}</span>
                              <span className="text-[10px] font-mono text-agri-400 font-bold">{d.device_code || d.id}</span>
                              {d.is_simulated === 1 && (
                                <span className="ml-1 text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                                  SIMULATED
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-vault-300">
                          {d.hardware_id || d.mac_address || '--'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-vault-300">
                          <div>
                            <span className="font-semibold text-white">{d.zone_name || 'North Zone'}</span>
                            <span className="block text-[10px] text-vault-400">
                              {d.rack_name || 'Rack 1'} • {d.level_name || 'Level 1'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-xs">
                          {temp !== undefined && d.is_online === 1 ? (
                            <span className={temp > 6 ? 'text-rose-400' : 'text-emerald-400'}>
                              {temp.toFixed(1)}°C
                            </span>
                          ) : (
                            <span className="text-vault-500">--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-xs">
                          {hum !== undefined && d.is_online === 1 ? (
                            <span className="text-sky-400">{Math.round(hum)}%</span>
                          ) : (
                            <span className="text-vault-500">--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs">
                          {mq3 !== undefined && d.is_online === 1 ? (
                            <span className={mq3 > 1.8 ? 'text-amber-400 font-bold' : 'text-vault-300'}>
                              {mq3.toFixed(2)} ppm
                            </span>
                          ) : (
                            <span className="text-vault-500">--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs">
                          {mq135 !== undefined && d.is_online === 1 ? (
                            <span className={mq135 > 50 ? 'text-amber-400 font-bold' : 'text-vault-300'}>
                              {mq135.toFixed(1)} ppm
                            </span>
                          ) : (
                            <span className="text-vault-500">--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              PENDING
                            </span>
                          ) : d.is_online === 1 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ONLINE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              OFFLINE
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-vault-400">
                          {d.signal_rssi ? `${d.signal_rssi} dBm` : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setConfiguringDevice(d)}
                            className="px-2.5 py-1 rounded-md bg-vault-800 hover:bg-vault-700 text-vault-200 text-xs font-semibold border border-vault-700 transition"
                          >
                            Configure
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
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

      {/* Device Configuration & Registration Approval Modal */}
      <DeviceConfigureModal
        device={configuringDevice}
        areas={areas}
        isOpen={Boolean(configuringDevice)}
        onClose={() => setConfiguringDevice(null)}
        onSaved={() => {
          refreshOverview();
          fetchDevices();
        }}
      />

      {/* Industrial Hardware Architecture Notice */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-agri-500/10 text-agri-400 border border-agri-500/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-200 flex items-center gap-2">
              <span>Industrial Multi-Tier IoT Architecture</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ESP-NOW + RS-485 + PERIMETER GATEWAY
              </span>
            </p>
            <p className="text-vault-400">
              Sensor Nodes (ESP-NOW) ➔ Inner Gateway (Vault Hub) ➔ RS-485 Wall Conduit ➔ Outer Gateway ➔ Cloud Engine.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-2.5 py-1 rounded bg-vault-950 border border-vault-800 text-[11px] font-mono text-amber-400 flex items-center gap-1">
            <Cable className="w-3 h-3" /> RS-485 Half-Duplex
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ACTIVE MONITORING
          </span>
        </div>
      </div>
    </div>
  );
};

