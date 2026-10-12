import React from 'react';
import {
  ShieldCheck,
  Cpu,
  Wifi,
  Radio,
  BarChart3,
  Thermometer,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
  onNavigateToAuth: () => void;
  onNavigateToProvisioning: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onNavigateToAuth,
  onNavigateToProvisioning
}) => {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-vault-900 via-vault-950 to-vault-900 border border-vault-800 p-8 lg:p-12 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-agri-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-agri-500/10 border border-agri-500/30 text-agri-400 text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-agri-400 animate-pulse" />
            AGRIVAULT INDUSTRIAL IOT PLATFORM v2.4
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Agricultural Storage Monitoring & <span className="text-transparent bg-clip-text bg-gradient-to-r from-agri-400 to-emerald-300">Cold Chain Intelligence</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            A production-ready platform designed for cold stores, potato warehouses, grain silos, and bulk agricultural facilities. Connects ESP32 telemetry nodes across insulated walls, enforces researched crop storage profiles, detects environmental anomalies in real time, and prevents produce spoilage with zero data fabrication.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onEnterApp}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-sm shadow-lg shadow-agri-600/30 transition-all hover:scale-[1.02]"
            >
              <span>Launch Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onNavigateToProvisioning}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-vault-800 hover:bg-vault-700 border border-vault-700 text-slate-200 font-semibold text-sm transition-all"
            >
              <Cpu className="w-4 h-4 text-agri-400" />
              <span>Connect ESP32 Device</span>
            </button>

            <button
              onClick={onNavigateToAuth}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-vault-850 hover:bg-vault-750 text-slate-300 font-medium text-sm transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Operator Authentication</span>
            </button>
          </div>
        </div>
      </section>

      {/* Dual Architecture Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Two Supported ESP32 Networking Architectures</h2>
          <p className="text-sm text-vault-400 mt-1">
            Engineered to overcome thick insulated cold store polyurethane sandwich panels and remote agricultural silos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Architecture A */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-6 space-y-4 hover:border-vault-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-agri-400 px-2.5 py-1 rounded bg-agri-500/10 border border-agri-500/20">
                Architecture A
              </span>
              <Wifi className="w-5 h-5 text-agri-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Direct Internet Connection</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ideal for facilities where facility Wi-Fi covers the storage zones directly. Each ESP32 maintains its own persistent credentials, verifies network reachability, and communicates directly over TLS/HTTPS or MQTT.
            </p>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 font-mono text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-agri-400">●</span> ESP32 Sensor Node (Wi-Fi Station)
              </div>
              <div className="pl-4 text-vault-500">↓ WPA2/WPA3 Facility Wi-Fi</div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-agri-400">●</span> Outbound Internet Gateway
              </div>
              <div className="pl-4 text-vault-500">↓ Authenticated REST / MQTT</div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-emerald-400">●</span> AgriVault Backend & Live Dashboard
              </div>
            </div>
            <ul className="text-xs text-vault-300 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-agri-400" />
                <span>Zero inbound port forwarding required (outbound authenticated telemetry)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-agri-400" />
                <span>Captive Portal setup (Agrivault-Setup-XXXXXX) for field Wi-Fi switching</span>
              </li>
            </ul>
          </div>

          {/* Architecture B */}
          <div className="bg-vault-900 border border-vault-800 rounded-xl p-6 space-y-4 hover:border-vault-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                Architecture B
              </span>
              <Radio className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Central Gateway Architecture</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Designed for airtight cold rooms where 150mm insulated polyurethane panels block RF signals. Interior nodes communicate via peer-to-peer ESP-NOW to an Inner Gateway, linked through the wall via wired RS-485 to an Outer Gateway.
            </p>
            <div className="p-3 rounded-lg bg-vault-950 border border-vault-800 font-mono text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-emerald-400">●</span> Interior ESP32 Nodes (ESP-NOW)
              </div>
              <div className="pl-4 text-vault-500">↓ Local 2.4GHz Direct Peer Mesh</div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-emerald-400">●</span> Inner Vault Gateway Hub
              </div>
              <div className="pl-4 text-vault-500">↓ Wired RS-485 Through Insulated Wall</div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-agri-400">●</span> Perimeter Gateway → WAN Internet
              </div>
            </div>
            <ul className="text-xs text-vault-300 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Local buffering: 5,000 readings cached locally during internet outages</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Originated node identities preserved with zero node-gateway conflation</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Key Pillars */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-vault-900/80 border border-vault-800 rounded-xl p-5 space-y-3">
          <div className="p-2.5 rounded-lg bg-agri-500/10 text-agri-400 w-fit">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Zero Data Fabrication</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Strict separation between live production telemetry, historical data, and simulation. Stale or disconnected readings are honestly flagged and never filled with fabricated placeholders.
          </p>
        </div>

        <div className="bg-vault-900/80 border border-vault-800 rounded-xl p-5 space-y-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Researched Crop Profiles</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Authoritative storage parameters for Potatoes (Processing, Seed, Table), Wheat, Rice, Maize, Onions, and Apples from FAO, USDA, and PAA post-harvest research.
          </p>
        </div>

        <div className="bg-vault-900/80 border border-vault-800 rounded-xl p-5 space-y-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Intelligent Risk Advisor</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Explains anomalies with crop physiology, pathogen risk (Fusarium, soft rot, sprout initiation), safety cautions, and verified step-by-step corrective checks.
          </p>
        </div>

        <div className="bg-vault-900/80 border border-vault-800 rounded-xl p-5 space-y-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Manual Relay Control</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            State-machine manual control with authenticated dispatch, command acknowledgement, firmware reporting, timeout safety, and audit logging.
          </p>
        </div>
      </section>
    </div>
  );
};
