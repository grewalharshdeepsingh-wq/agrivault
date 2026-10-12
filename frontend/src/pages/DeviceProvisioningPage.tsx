import React, { useState } from 'react';
import {
  Cpu,
  Plus,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  Layers,
  ArrowRight,
  Radio,
  Wifi,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

export const DeviceProvisioningPage: React.FC = () => {
  const { devices, areas, facilities, loadInitialData } = useApp();
  const [activeMethod, setActiveMethod] = useState<'methodA' | 'methodB'>('methodA');

  // Method B Manual / QR Code inputs
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [regCodeInput, setRegCodeInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedFacility, setSelectedFacility] = useState('fac-01');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSensors, setSelectedSensors] = useState<string[]>([
    'temperature',
    'humidity',
    'mq3',
    'mq135',
    'relay'
  ]);
  const [qrScanned, setQrScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Approval modal for Method A
  const [approvingDevice, setApprovingDevice] = useState<any | null>(null);
  const [approveName, setApproveName] = useState('');
  const [approveArea, setApproveArea] = useState('');

  // Pending devices for Method A
  const pendingDevices = devices.filter(
    (d: any) => d.registration_status === 'pending' || (d.is_discovered === 1 && !d.area_id)
  );

  const toggleSensor = (sensorKey: string) => {
    if (selectedSensors.includes(sensorKey)) {
      setSelectedSensors(selectedSensors.filter((s) => s !== sensorKey));
    } else {
      setSelectedSensors([...selectedSensors, sensorKey]);
    }
  };

  const handleManualProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceIdInput.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.provisionDeviceManual({
        deviceId: deviceIdInput.trim().toUpperCase(),
        registrationCode: regCodeInput.trim() || undefined,
        userName: displayName.trim() || `Storage Node (${deviceIdInput.trim().toUpperCase()})`,
        facilityId: selectedFacility,
        areaId: selectedArea || null,
        sensors: selectedSensors
      });
      setSuccessMsg(`Device ${deviceIdInput.trim().toUpperCase()} successfully provisioned! Active monitoring initialized.`);
      setDeviceIdInput('');
      setRegCodeInput('');
      setDisplayName('');
      await loadInitialData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Provisioning failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingDevice) return;
    setLoading(true);
    try {
      await api.approveDevice(approvingDevice.id, {
        userName: approveName.trim() || approvingDevice.user_name || approvingDevice.id,
        areaId: approveArea || null
      });
      setApprovingDevice(null);
      await loadInitialData();
    } catch (err: any) {
      alert(err?.message || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const simulateQrScan = () => {
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    const simulatedDevId = `AGR-ESP-${randomHex}`;
    const oneTimeCode = `ONETIME-${Math.floor(100000 + Math.random() * 900000)}`;
    setDeviceIdInput(simulatedDevId);
    setRegCodeInput(oneTimeCode);
    setDisplayName(`Potato Rack Node (${simulatedDevId})`);
    setQrScanned(true);
    setSuccessMsg(`QR Code scanned! One-time cryptographic token loaded for ${simulatedDevId}. Secret credentials remain protected.`);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Device Provisioning & Enrollment</h1>
        <p className="text-xs text-vault-400 mt-1">
          Secure onboarding workflow supporting both automatic network discovery and manual/QR code authentication.
        </p>
      </div>

      {/* Method Switcher Tabs */}
      <div className="flex border-b border-vault-800">
        <button
          onClick={() => setActiveMethod('methodA')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeMethod === 'methodA'
              ? 'border-agri-500 text-agri-400 bg-agri-500/5'
              : 'border-transparent text-vault-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Method A: Automatic Discovery Queue ({pendingDevices.length})</span>
        </button>

        <button
          onClick={() => setActiveMethod('methodB')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeMethod === 'methodB'
              ? 'border-agri-500 text-agri-400 bg-agri-500/5'
              : 'border-transparent text-vault-400 hover:text-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Method B: Manual Registration & QR Code</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Method A: Automatic Discovery Queue */}
      {activeMethod === 'methodA' && (
        <div className="space-y-6">
          <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Devices Awaiting Operator Approval</h2>
                <p className="text-xs text-vault-400">
                  Newly discovered ESP32 sensor nodes detected over Wi-Fi or ESP-NOW. Arbitrary devices cannot transmit trusted production readings until approved.
                </p>
              </div>

              <button
                onClick={() => api.simulateDiscovery('ESP32').then(loadInitialData)}
                className="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-agri-400" />
                <span>Simulate Node Detection</span>
              </button>
            </div>

            {pendingDevices.length === 0 ? (
              <div className="p-10 rounded-xl bg-vault-950 border border-vault-800 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-vault-600 mx-auto" />
                <p className="text-sm text-slate-300 font-semibold">No devices awaiting approval</p>
                <p className="text-xs text-vault-500 max-w-md mx-auto">
                  When a newly powered ESP32 communicates with AgriVault, its validated identity will appear here for naming and zone assignment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDevices.map((dev: any) => (
                  <div
                    key={dev.id}
                    className="p-4 rounded-xl bg-vault-950 border border-vault-800 hover:border-agri-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{dev.user_name || dev.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pending Approval
                        </span>
                      </div>
                      <p className="text-xs text-vault-400 font-mono">
                        Hardware ID: {dev.hardware_id || dev.mac_address} • Protocol: {dev.connection_protocol || 'Wi-Fi'} • RSSI: {dev.signal_rssi || -58} dBm
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setApprovingDevice(dev);
                          setApproveName(dev.user_name || dev.id);
                          setApproveArea('');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow-sm transition-colors"
                      >
                        Approve & Assign Zone
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Reject device ${dev.id}?`)) {
                            await api.rejectDevice(dev.id);
                            await loadInitialData();
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-vault-850 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs border border-vault-750 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Method B: Manual Registration & QR Code */}
      {activeMethod === 'methodB' && (
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl max-w-2xl mx-auto">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Manual Device Enrollment & QR Scan</h2>
            <p className="text-xs text-vault-400">
              Enroll hardware using permanent Device ID and one-time registration token. QR codes verify ownership without leaking permanent secrets.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-vault-950 border border-vault-800">
            <div className="flex items-center gap-3">
              <QrCode className="w-8 h-8 text-agri-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">Optical QR Code Scanner</p>
                <p className="text-[11px] text-vault-400">Scan QR printed on ESP32 device casing</p>
              </div>
            </div>
            <button
              type="button"
              onClick={simulateQrScan}
              className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 font-semibold text-xs border border-vault-700 transition-colors"
            >
              Simulate Camera Scan
            </button>
          </div>

          <form onSubmit={handleManualProvision} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Permanent Device ID *</label>
                <input
                  type="text"
                  value={deviceIdInput}
                  onChange={(e) => setDeviceIdInput(e.target.value)}
                  placeholder="e.g. AGR-ESP-A1B2C3"
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">One-Time Registration Code</label>
                <input
                  type="text"
                  value={regCodeInput}
                  onChange={(e) => setRegCodeInput(e.target.value)}
                  placeholder="e.g. REG-789456"
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-slate-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Display Label / Name *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Potato Warehouse — North Wall Rack"
                required
                className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Facility</label>
                <select
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-slate-100"
                >
                  {facilities.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Storage Zone</label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2.5 text-slate-100"
                >
                  <option value="">-- Assign Later --</option>
                  {areas.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.commodity})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Supported Sensors */}
            <div className="space-y-2 pt-2">
              <label className="block text-slate-300 font-semibold">Installed Sensor Modules</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'temperature', label: 'DS18B20 Temp (°C)' },
                  { id: 'humidity', label: 'DHT11 Humidity (%RH)' },
                  { id: 'mq3', label: 'MQ-3 Gas Response' },
                  { id: 'mq135', label: 'MQ-135 Air Quality' },
                  { id: 'co2', label: 'NDIR CO2 Sensor' },
                  { id: 'relay', label: '5V Relay Module' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSensor(s.id)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-all ${
                      selectedSensors.includes(s.id)
                        ? 'bg-agri-600/20 border-agri-500/40 text-agri-300'
                        : 'bg-vault-950 border-vault-800 text-vault-400'
                    }`}
                  >
                    {selectedSensors.includes(s.id) ? '✓ ' : '+ '}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-agri-600 hover:bg-agri-500 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-colors mt-4"
            >
              {loading ? 'Enrolling Device...' : 'Authorize & Provision Device'}
            </button>
          </form>
        </div>
      )}

      {/* Approval Modal for Method A */}
      {approvingDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Approve & Bind Discovered Node</h3>
            <p className="text-xs text-vault-400">
              Assign a human-readable display label and storage zone. The permanent hardware identity remains intact.
            </p>

            <form onSubmit={handleApproveDevice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Display Label</label>
                <input
                  type="text"
                  value={approveName}
                  onChange={(e) => setApproveName(e.target.value)}
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Storage Zone</label>
                <select
                  value={approveArea}
                  onChange={(e) => setApproveArea(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                >
                  <option value="">-- Select Zone --</option>
                  {areas.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.commodity})</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApprovingDevice(null)}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold"
                >
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
