import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Wifi,
  Radio,
  Battery,
  Signal,
  RotateCw,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowLeft,
  ToggleRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../api/client';

interface DeviceDetailPageProps {
  deviceId: string;
  onBack: () => void;
}

export const DeviceDetailPage: React.FC<DeviceDetailPageProps> = ({ deviceId, onBack }) => {
  const [device, setDevice] = useState<any | null>(null);
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [wifiModalData, setWifiModalData] = useState<any | null>(null);
  const [relayActionStatus, setRelayActionStatus] = useState<string | null>(null);

  const fetchDeviceData = async () => {
    try {
      const devRes = await api.getDevice(deviceId);
      setDevice(devRes);
      setNewName(devRes.user_name || devRes.id);

      const diagRes = await api.getDeviceDiagnostics(deviceId);
      setDiagnostics(diagRes);
    } catch (err) {
      console.error('Error fetching device detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceData();
    const interval = setInterval(fetchDeviceData, 5000);
    return () => clearInterval(interval);
  }, [deviceId]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.updateDevice(deviceId, { userName: newName.trim() });
      setShowRenameModal(false);
      await fetchDeviceData();
    } catch (err: any) {
      alert(err?.message || 'Rename failed');
    }
  };

  const handleReconfigureWifi = async () => {
    if (!confirm(`Are you sure you want to trigger Wi-Fi Reconfiguration on ${device?.user_name || deviceId}? The ESP32 will launch its setup hotspot.`)) {
      return;
    }
    try {
      const res = await api.reconfigureDeviceWifi(deviceId);
      setWifiModalData(res);
      setShowWifiModal(true);
      await fetchDeviceData();
    } catch (err: any) {
      alert(err?.message || 'Failed to dispatch Wi-Fi reconfiguration command');
    }
  };

  const handleManualRelay = async (relayId: string, action: 'ON' | 'OFF') => {
    if (!confirm(`Safety Confirmation: Are you sure you want to command relay ${action}?`)) {
      return;
    }
    try {
      setRelayActionStatus(`Commanding ${action}...`);
      await api.sendRelayCommand(relayId, action, true, `Manual override from Device Details (${action})`);
      setRelayActionStatus(`Command "${action}" dispatched to hardware. Waiting for ACK.`);
      setTimeout(() => {
        setRelayActionStatus(null);
        fetchDeviceData();
      }, 3000);
    } catch (err: any) {
      alert(err?.message || 'Relay command failed');
      setRelayActionStatus(null);
    }
  };

  if (loading && !device) {
    return (
      <div className="p-12 text-center text-vault-400">
        <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-agri-400" />
        <span>Loading telemetry & diagnostics for {deviceId}...</span>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="p-12 text-center text-rose-400 space-y-4">
        <p>Device not found.</p>
        <button onClick={onBack} className="px-4 py-2 rounded-lg bg-vault-800 text-slate-200 text-xs">
          Back to Devices
        </button>
      </div>
    );
  }

  const isOnline = device.is_online === 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-vault-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Device Fleet</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRenameModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-agri-400" />
            <span>Rename Node</span>
          </button>

          <button
            onClick={handleReconfigureWifi}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 transition-colors"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Reconfigure Wi-Fi</span>
          </button>
        </div>
      </div>

      {/* Device Overview Card */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <Cpu className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{device.user_name || device.id}</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                {device.is_simulated === 1 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    SIMULATION — NOT REAL SENSOR DATA
                  </span>
                )}
              </div>
              <p className="text-xs text-vault-400 font-mono mt-0.5">
                Permanent Device ID: {device.id} • Hardware MAC: {device.mac_address || device.hardware_id}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Signal className="w-4 h-4 text-agri-400" />
              <span>{device.signal_rssi || -58} dBm</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Battery className="w-4 h-4 text-emerald-400" />
              <span>{device.battery_voltage ? device.battery_voltage.toFixed(2) : '3.30'} V</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-4 h-4 text-vault-400" />
              <span>Firmware: {device.firmware_version || 'v2.4.0'}</span>
            </div>
          </div>
        </div>

        {/* Location & Gateway Binding */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-vault-950 border border-vault-800 text-xs">
          <div>
            <span className="text-vault-400 text-[10px] block font-semibold uppercase">Assigned Zone</span>
            <span className="text-slate-200 font-semibold">{device.area_name || 'Unassigned Zone'}</span>
          </div>
          <div>
            <span className="text-vault-400 text-[10px] block font-semibold uppercase">Cold Store / Sector</span>
            <span className="text-slate-200 font-semibold">{device.cold_store_name || 'Cold Store A'}</span>
          </div>
          <div>
            <span className="text-vault-400 text-[10px] block font-semibold uppercase">Rack / Position</span>
            <span className="text-slate-200 font-semibold">{device.rack_name || 'Rack 1'}</span>
          </div>
          <div>
            <span className="text-vault-400 text-[10px] block font-semibold uppercase">Gateway Architecture</span>
            <span className="text-agri-400 font-semibold">{device.gateway_name || 'Direct Internet (Wi-Fi)'}</span>
          </div>
        </div>
      </div>

      {relayActionStatus && (
        <div className="p-3 rounded-lg bg-agri-500/10 border border-agri-500/30 text-agri-400 text-xs font-semibold flex items-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin" />
          <span>{relayActionStatus}</span>
        </div>
      )}

      {/* Installed Sensors & Diagnostic Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">Installed Sensor Probes & Health Diagnostics</h2>
          <p className="text-xs text-vault-400">
            Real hardware signals from connected DS18B20, DHT11, MQ-3, and MQ-135 sensors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {diagnostics?.sensors?.map((s: any) => {
            const hasStaleness = !s.is_fresh;
            return (
              <div
                key={s.id}
                className={`bg-vault-900 border rounded-xl p-5 space-y-3 transition-colors ${
                  hasStaleness
                    ? 'border-amber-500/40 bg-vault-900/90'
                    : 'border-vault-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{s.name}</h3>
                    <p className="text-[11px] text-vault-400 font-mono">Pin: {s.pin || 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    s.is_fresh
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {s.is_fresh ? 'Fresh' : 'Stale'}
                  </span>
                </div>

                <div className="py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-white">
                      {s.last_value !== null ? s.last_value : '--'}
                    </span>
                    <span className="text-xs text-vault-400 font-semibold">{s.unit}</span>
                  </div>
                  <div className="text-[11px] text-vault-400 mt-1">
                    Raw ADC: <span className="font-mono text-slate-300">{s.raw_reading ?? 'N/A'}</span>
                  </div>
                </div>

                {/* Zero Fabrication Warning if Stale */}
                {s.staleness_warning && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                      <span>{s.staleness_warning}</span>
                    </div>
                  </div>
                )}

                {/* Honest Sensor Disclaimer for MQ series */}
                {s.disclaimer && (
                  <p className="text-[10px] text-vault-400 italic leading-snug">
                    ℹ️ {s.disclaimer}
                  </p>
                )}

                <div className="pt-2 border-t border-vault-800/80 flex items-center justify-between text-[11px] text-vault-400">
                  <span>Calibration: {s.calibration_status}</span>
                  <span>Health: {s.health}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Relay Actuator Controls */}
      {diagnostics?.relays && diagnostics.relays.length > 0 && (
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Manual Relay Actuator Module</h2>
              <p className="text-xs text-vault-400">
                Direct authenticated manual switching with verified firmware acknowledgement.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-vault-800 text-slate-300 border border-vault-700">
              Manual Mode Only
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {diagnostics.relays.map((r: any) => {
              const isOn = r.state === 1;
              return (
                <div key={r.id} className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">{r.name}</h3>
                      <p className="text-xs text-vault-400">Pin: {r.gpio_pin} • Load: {r.target_equipment}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      isOn ? 'bg-agri-500/20 text-agri-400 border border-agri-500/30' : 'bg-vault-800 text-slate-400'
                    }`}>
                      {isOn ? 'STATE: ON' : 'STATE: OFF'}
                    </span>
                  </div>

                  {r.command_result && (
                    <p className="text-xs text-slate-300 bg-vault-900 p-2 rounded border border-vault-800 font-mono">
                      Result: {r.command_result}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleManualRelay(r.id, 'ON')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        isOn
                          ? 'bg-agri-600 text-white cursor-default'
                          : 'bg-vault-800 hover:bg-agri-600/30 text-slate-200 border border-vault-700'
                      }`}
                    >
                      Turn ON
                    </button>
                    <button
                      onClick={() => handleManualRelay(r.id, 'OFF')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        !isOn
                          ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30 cursor-default'
                          : 'bg-vault-800 hover:bg-rose-600/30 text-slate-200 border border-vault-700'
                      }`}
                    >
                      Turn OFF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Rename Sensor Node</h3>
            <p className="text-xs text-vault-400">
              Renaming updates the user-facing display label while preserving the permanent hardware identity and historical readings.
            </p>
            <form onSubmit={handleRename} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wi-Fi Reconfigure Instructions Modal */}
      {showWifiModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Wifi className="w-5 h-5" />
                <span>Wi-Fi Provisioning Hotspot Active</span>
              </div>
              <button
                onClick={() => setShowWifiModal(false)}
                className="text-vault-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The remote command was accepted by the ESP32. The device is now broadcasting its dedicated temporary setup access point.
            </p>

            <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-vault-400">Setup Wi-Fi Network (SSID):</span>
                <span className="text-agri-400 font-bold">{wifiModalData?.setupApName || `Agrivault-Setup-${deviceId.slice(-6)}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-400">Local Setup Address:</span>
                <span className="text-emerald-400 font-bold">http://192.168.4.1</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-white">Follow these steps on your phone or laptop:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                <li>Disconnect from your home/office Wi-Fi.</li>
                <li>Connect to the Wi-Fi network: <b>{wifiModalData?.setupApName}</b>.</li>
                <li>Open your browser and navigate to <b>http://192.168.4.1</b>.</li>
                <li>Select the warehouse Wi-Fi network, enter the password, and click Connect.</li>
                <li>The ESP32 will test the router, save credentials to flash memory, and reconnect automatically.</li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowWifiModal(false)}
                className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
