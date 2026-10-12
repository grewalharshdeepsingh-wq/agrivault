import React, { useState } from 'react';
import {
  HelpCircle,
  Wifi,
  Cpu,
  Layers,
  Radio,
  BookOpen,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

export const HelpPage: React.FC = () => {
  const [openSection, setOpenSection] = useState<string>('wifi-setup');

  const toggle = (id: string) => {
    setOpenSection(openSection === id ? '' : id);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">AgriVault Engineering & Operations Guide</h1>
        <p className="text-xs text-vault-400 mt-1">
          Complete hardware wiring guides, Wi-Fi auto-provisioning portal manual, gateway topologies, and postharvest storage troubleshooting.
        </p>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-4">
        {/* Section 1: ESP32 Wi-Fi Auto-Configuration */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => toggle('wifi-setup')}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-vault-850/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-agri-500/10 text-agri-400 border border-agri-500/20">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ESP32 Wi-Fi Auto-Configuration & Dynamic Network Switching</h3>
                <p className="text-xs text-vault-400">Zero re-flashing: Configure router credentials via phone or laptop captive portal</p>
              </div>
            </div>
            {openSection === 'wifi-setup' ? <ChevronUp className="w-5 h-5 text-vault-400" /> : <ChevronDown className="w-5 h-5 text-vault-400" />}
          </button>

          {openSection === 'wifi-setup' && (
            <div className="px-5 pb-6 pt-2 border-t border-vault-800 text-xs text-slate-300 space-y-4 leading-relaxed">
              <p>
                AgriVault ESP32 devices feature built-in <b>SoftAP Captive Portal Provisioning</b>. You never need Arduino IDE or USB programming simply because a warehouse router password changes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-2">
                  <h4 className="font-bold text-white text-xs">Triggering Setup Mode:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                    <li><b>First-time boot:</b> Device automatically starts setup AP if unconfigured.</li>
                    <li><b>Physical Recovery:</b> Press and hold the physical <b>BOOT button (GPIO 0)</b> for 5 seconds.</li>
                    <li><b>Remote Trigger:</b> Click <b>"Reconfigure Wi-Fi"</b> from the device details page on the AgriVault dashboard.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-2">
                  <h4 className="font-bold text-white text-xs">Onboarding Steps:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                    <li>Connect phone or laptop to Wi-Fi: <code>Agrivault-Setup-[MAC]</code></li>
                    <li>Open browser to: <b>http://192.168.4.1</b></li>
                    <li>Click "Rescan" to select the facility Wi-Fi SSID.</li>
                    <li>Enter Wi-Fi password and verify Agrivault server URL.</li>
                    <li>Submit: Credentials persist in Non-Volatile Flash (NVS) across reboots.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Sensor Wiring & Pinouts */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => toggle('wiring')}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-vault-850/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ESP32 Pinout & Sensor Wiring Specifications</h3>
                <p className="text-xs text-vault-400">DS18B20 OneWire, DHT11, MQ-3, MQ-135, and 5V Relay assignments</p>
              </div>
            </div>
            {openSection === 'wiring' ? <ChevronUp className="w-5 h-5 text-vault-400" /> : <ChevronDown className="w-5 h-5 text-vault-400" />}
          </button>

          {openSection === 'wiring' && (
            <div className="px-5 pb-6 pt-2 border-t border-vault-800 text-xs text-slate-300 space-y-4">
              <p>
                Standard pin mapping optimized for <b>ESP32-DevKit-V1 (ESP32-WROOM-32)</b>:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead className="bg-vault-950 text-vault-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Peripheral</th>
                      <th className="p-2.5">ESP32 GPIO</th>
                      <th className="p-2.5">Signal Type</th>
                      <th className="p-2.5">Wiring Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vault-800/60 text-slate-200">
                    <tr>
                      <td className="p-2.5 font-sans font-bold">DS18B20 Temp Probe</td>
                      <td className="p-2.5 text-agri-400">GPIO 4</td>
                      <td className="p-2.5">1-Wire Digital</td>
                      <td className="p-2.5 font-sans">Requires 4.7kΩ pull-up resistor between VCC (3.3V) and Data.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold">DHT11 Humidity</td>
                      <td className="p-2.5 text-agri-400">GPIO 32</td>
                      <td className="p-2.5">Single-bus Digital</td>
                      <td className="p-2.5 font-sans">Connect to 3.3V power pin. Keep lead length under 15m.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold">MQ-135 Air Quality</td>
                      <td className="p-2.5 text-agri-400">GPIO 34</td>
                      <td className="p-2.5">Analog ADC1</td>
                      <td className="p-2.5 font-sans">Heater requires 5V. Analog output connected to ADC1 pin.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold">MQ-3 Volatiles Gas</td>
                      <td className="p-2.5 text-agri-400">GPIO 35</td>
                      <td className="p-2.5">Analog ADC1</td>
                      <td className="p-2.5 font-sans">Requires 24h burn-in time before baseline stabilizing.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold">5V Relay Module</td>
                      <td className="p-2.5 text-agri-400">GPIO 26</td>
                      <td className="p-2.5">Active HIGH</td>
                      <td className="p-2.5 font-sans">Optocoupled relay recommended for inductive fan loads.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold">BOOT Button</td>
                      <td className="p-2.5 text-agri-400">GPIO 0</td>
                      <td className="p-2.5">Active LOW</td>
                      <td className="p-2.5 font-sans">Built-in board button. Hold 5s for Wi-Fi provisioning.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Central Gateway Architecture B */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => toggle('gateway')}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-vault-850/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Central Gateway Setup (Architecture B)</h3>
                <p className="text-xs text-vault-400">Penetrating insulated walls with RS-485 through-wall bridge & offline buffering</p>
              </div>
            </div>
            {openSection === 'gateway' ? <ChevronUp className="w-5 h-5 text-vault-400" /> : <ChevronDown className="w-5 h-5 text-vault-400" />}
          </button>

          {openSection === 'gateway' && (
            <div className="px-5 pb-6 pt-2 border-t border-vault-800 text-xs text-slate-300 space-y-4 leading-relaxed">
              <p>
                In cold stores constructed with 100-200mm polyurethane insulated sandwich panels, Wi-Fi signals cannot penetrate the wall. AgriVault employs an <b>Inner-to-Outer Gateway Bridge</b>:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li><b>Inner Gateway:</b> Positioned inside the cold vault. Collects radio packets from sensor nodes via 2.4GHz ESP-NOW.</li>
                <li><b>Wired RS-485 Bus:</b> Passes through a single 8mm sealed conduit through the wall. Differential signaling immune to industrial motor interference up to 1200 meters.</li>
                <li><b>Outer Gateway:</b> Mounted outside on the perimeter wall. Connected to facility Wi-Fi or Ethernet to upload data to the AgriVault server.</li>
                <li><b>Local Storage Buffering:</b> If internet is disrupted, the gateway caches up to 5,000 readings in SPIFFS/NVS and forwards them automatically upon reconnection.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Section 4: Post-Harvest Agricultural Guidelines */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => toggle('crop-guide')}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-vault-850/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Post-Harvest Agricultural Storage Guidelines</h3>
                <p className="text-xs text-vault-400">Cold-Induced Sweetening (CIS), suberization, and moisture control</p>
              </div>
            </div>
            {openSection === 'crop-guide' ? <ChevronUp className="w-5 h-5 text-vault-400" /> : <ChevronDown className="w-5 h-5 text-vault-400" />}
          </button>

          {openSection === 'crop-guide' && (
            <div className="px-5 pb-6 pt-2 border-t border-vault-800 text-xs text-slate-300 space-y-4 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 space-y-2">
                <h4 className="font-bold text-white text-xs">Potatoes (Processing vs Table vs Seed):</h4>
                <p className="text-[11px] text-slate-300">
                  Processing potatoes (French fries & chips) must NEVER be held below 7.0°C. Cold-Induced Sweetening converts starches into glucose, which reacts with asparagine at frying temperatures to produce dark, bitter acrylamide streaks. Seed tubers are held at 3.0-4.0°C to preserve apical dormancy.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 space-y-2">
                <h4 className="font-bold text-white text-xs">Onions vs Other Root Crops:</h4>
                <p className="text-[11px] text-slate-300">
                  Onions are the primary exception to the high-humidity rule! While potatoes require 90-95% RH to avoid shrinkage, onions MUST be kept in dry conditions (65-70% RH). High humidity causes immediate root regrowth and severe neck rot (Botrytis allii).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
