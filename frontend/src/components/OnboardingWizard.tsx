import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Building2,
  Cpu,
  Radio,
  Sliders,
  Bell,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';

export const OnboardingWizard: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { refreshOverview, refreshAlerts } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredNode, setDiscoveredNode] = useState<any>(null);

  // Form states
  const [facName, setFacName] = useState('ABC Cold Storage — Valley Hub');
  const [facLocation, setFacLocation] = useState('Agri-Logistics Sector 4');
  const [areaName, setAreaName] = useState('Area 1 — Potato Storage');
  const [devName, setDevName] = useState('North Storage Sensor 1');
  const [tempMax, setTempMax] = useState('6.0');
  const [humMin, setHumMin] = useState('80.0');

  if (!isOpen) return null;

  const steps = [
    { num: 1, title: 'Create Account', desc: 'Enterprise profile & RBAC configuration' },
    { num: 2, title: 'Create Facility', desc: 'Define warehouse & cold storage premises' },
    { num: 3, title: 'Add Gateway', desc: 'Pair Raspberry Pi 4 Central Controller' },
    { num: 4, title: 'Discover ESPs', desc: 'Scan local Wi-Fi mesh for sensor nodes' },
    { num: 5, title: 'Assign to Area', desc: 'Map physical hardware to storage vaults' },
    { num: 6, title: 'Rename Devices', desc: 'Assign human-readable industrial names' },
    { num: 7, title: 'Sensor Thresholds', desc: 'Configure safe environmental limits' },
    { num: 8, title: 'Alert Engine', desc: 'Set notification channels & hysteresis' },
    { num: 9, title: 'Sensor Test', desc: 'Verify telemetry data streams' },
    { num: 10, title: 'System Ready', desc: '24/7 continuous monitoring armed' }
  ];

  const handleSimulateScan = async () => {
    setIsScanning(true);
    try {
      const res = await api.simulateDiscovery();
      setDiscoveredNode(res.device);
    } finally {
      setIsScanning(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 10) {
      setCurrentStep(currentStep + 1);
    } else {
      refreshOverview();
      refreshAlerts();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-vault-900 border border-vault-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-vault-800 flex items-center justify-between bg-vault-950/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-agri-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              AgriVault Guided System Setup Wizard
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-vault-800 text-vault-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 bg-vault-900 border-b border-vault-800/80">
          <div className="flex items-center justify-between text-xs text-vault-400 mb-1.5 font-medium">
            <span>Step {currentStep} of 10: {steps[currentStep - 1].title}</span>
            <span className="font-mono text-agri-400">{Math.round((currentStep / 10) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-vault-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-agri-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 10) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm">
          {/* Step 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 1: Account & Credentials Configured</h3>
              <p className="text-vault-300">
                You are currently signed in under the enterprise role <strong className="text-agri-400">Chief Facility Engineer (Owner)</strong> with multi-tenant access.
              </p>
              <div className="p-4 bg-vault-950 rounded-xl border border-vault-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-vault-400">Organization:</span>
                  <span className="text-white font-medium">AgriVault Industrial Foods Corp</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vault-400">Admin Email:</span>
                  <span className="text-white font-mono">admin@agrivault.io</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vault-400">Security Clearance:</span>
                  <span className="text-emerald-400 font-semibold">Level 4 — Full Actuator & Relay Access</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 2: Create Storage Facility</h3>
              <p className="text-vault-300">
                Enter warehouse facility profile details to group environmental zones and gateways.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">Facility Name</label>
                  <input
                    type="text"
                    value={facName}
                    onChange={(e) => setFacName(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">Location / Sector</label>
                  <input
                    type="text"
                    value={facLocation}
                    onChange={(e) => setFacLocation(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 3: Connect Central Gateway</h3>
              <p className="text-vault-300">
                The central Raspberry Pi acts as the on-premise local gateway, collecting data even during network blackouts.
              </p>
              <div className="p-4 bg-vault-950 rounded-xl border border-vault-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Gateway 01 — Raspberry Pi 4</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                    PAIRED & ONLINE
                  </span>
                </div>
                <p className="text-xs text-vault-400 font-mono">IP: 192.168.1.100 | Port: 1883 | Local Buffer: Active</p>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 4: Scan & Discover ESP Nodes</h3>
              <p className="text-vault-300">
                No manual IP typing required. AgriVault listens for MQTT discovery packets and broadcasts automatically.
              </p>
              <div className="p-4 bg-vault-950 rounded-xl border border-vault-800 text-center space-y-3">
                <button
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className="px-4 py-2 bg-agri-600 hover:bg-agri-500 text-white rounded-lg font-semibold text-xs transition shadow"
                >
                  {isScanning ? 'Scanning Wi-Fi Mesh...' : 'Scan for New ESP Nodes'}
                </button>
                {discoveredNode && (
                  <div className="mt-3 p-3 bg-vault-900 border border-agri-500/40 rounded-lg text-left">
                    <p className="text-xs text-agri-400 font-bold">✓ Node Discovered: {discoveredNode.id}</p>
                    <p className="text-xs text-vault-400">IP: {discoveredNode.ip_address} | RSSI: {discoveredNode.signal_rssi} dBm</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5 */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 5: Assign ESP to Storage Area</h3>
              <p className="text-vault-300">Choose which vault or chiller room this hardware node will monitor.</p>
              <select
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-agri-500"
              >
                <option value="Area 1 — Potato Storage">Area 1 — Potato Storage (North Vault)</option>
                <option value="Area 2 — Potato Storage">Area 2 — Potato Storage (South Vault)</option>
                <option value="Area 3 — Controlled Atmosphere">Area 3 — Controlled Atmosphere (Fruit Vault)</option>
                <option value="Area 4 — Loading Dock">Area 4 — Loading Dock & Transit Bay</option>
              </select>
            </div>
          )}

          {/* Step 6 */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 6: Rename Device</h3>
              <p className="text-vault-300">Set a clear operational label for staff.</p>
              <input
                type="text"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-agri-500"
              />
            </div>
          )}

          {/* Step 7 */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 7: Configure Safe Thresholds</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">Max Temperature (°C)</label>
                  <input
                    type="number"
                    value={tempMax}
                    onChange={(e) => setTempMax(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">Min Humidity (%)</label>
                  <input
                    type="number"
                    value={humMin}
                    onChange={(e) => setHumMin(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 8 */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 8: Configure Alert Engine</h3>
              <div className="p-4 bg-vault-950 rounded-xl border border-vault-800 space-y-2 text-xs">
                <label className="flex items-center gap-2 text-slate-200">
                  <input type="checkbox" defaultChecked className="rounded text-agri-500" />
                  <span>Real-time in-app alert banner & audible chime</span>
                </label>
                <label className="flex items-center gap-2 text-slate-200">
                  <input type="checkbox" defaultChecked className="rounded text-agri-500" />
                  <span>Browser notifications (Push API enabled)</span>
                </label>
                <label className="flex items-center gap-2 text-slate-200">
                  <input type="checkbox" defaultChecked className="rounded text-agri-500" />
                  <span>5-minute cooldown deduplication to prevent notification storm</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 9 */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Step 9: Test Sensors & Signal Check</h3>
              <div className="p-4 bg-vault-950 rounded-xl border border-vault-800 space-y-2 text-xs font-mono">
                <p className="text-emerald-400">✓ DS18B20 Temp Probe: 4.8°C (Signal High)</p>
                <p className="text-emerald-400">✓ Capacitive Humidity: 88% (Signal High)</p>
                <p className="text-emerald-400">✓ MQ-135 Gas Sensor: 1,120 ppm (Nominal)</p>
                <p className="text-emerald-400">✓ 5V Relay Actuator: Ready (GPIO 26 Low)</p>
              </div>
            </div>
          )}

          {/* Step 10 */}
          {currentStep === 10 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">System Ready for 24/7 Production Operation</h3>
              <p className="text-vault-300 max-w-md mx-auto text-xs">
                AgriVault is now actively logging telemetry, evaluating compound storage health rules, and buffering records locally.
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-vault-800 bg-vault-950/60 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded bg-vault-800 hover:bg-vault-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded bg-agri-600 hover:bg-agri-500 text-white shadow-lg shadow-agri-600/30 transition"
          >
            <span>{currentStep === 10 ? 'Finish & Enter Platform' : 'Next Step'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
