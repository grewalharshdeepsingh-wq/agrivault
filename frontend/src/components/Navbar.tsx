import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Radio,
  Sliders,
  Sparkles,
  User as UserIcon,
  Wifi,
  WifiOff,
  ChevronDown
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { overview, isWsConnected, isOnline, simulationStatus, setSimulationScenario, setShowOnboarding } = useApp();
  const { user, role, switchRole } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showSimMenu, setShowSimMenu] = useState(false);

  const overallStatus = overview?.overallStatus || 'Normal';
  const activeAlertsCount = overview?.activeAlertsCount || 0;

  const statusBg =
    overallStatus === 'Critical'
      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
      : overallStatus === 'Warning'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      : overallStatus === 'Attention'
      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

  const scenarios = [
    { id: 'normal', label: '🟢 Normal Conditions' },
    { id: 'temp_spike', label: '🔥 Temperature Runaway' },
    { id: 'humidity_spike', label: '💧 Humidity Saturation' },
    { id: 'co2_spike', label: '💨 High CO2 Respiration' },
    { id: 'gas_anomaly_ethylene', label: '🍎 Ethylene Volatile Surge' },
    { id: 'gas_anomaly_ammonia', label: '☣️ Ammonia Refrigerant Leak' },
    { id: 'gas_anomaly_ethanol', label: '🍷 Fermentation / Rot VOC' },
    { id: 'multi_anomaly', label: '⚠️ Multi-Sensor Spoilage Risk' },
    { id: 'sensor_offline', label: '📡 ESP Sensor Offline' },
    { id: 'gateway_offline', label: '🔌 Gateway Offline (Buffering)' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-vault-900/90 backdrop-blur-md border-b border-vault-800 px-4 lg:px-6 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & Facility Identity */}
        <div className="flex items-center gap-3">
          <img
            src="/icons/logo.png"
            alt="AGRIvault Logo"
            className="h-10 w-10 rounded-lg object-contain bg-vault-950/80 p-0.5 border border-agri-500/40 shadow-lg shadow-agri-500/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base lg:text-lg">AGRIvault</span>
              <span className="text-[10px] tracking-widest font-mono uppercase bg-agri-950 text-agri-400 px-1.5 py-0.5 rounded border border-agri-800">
                PRO-24/7
              </span>
            </div>
            <p className="text-xs text-vault-400 hidden sm:block">Storage Intelligence Platform</p>
          </div>
        </div>

        {/* Center: System Status & Live Connection Indicator */}
        <div className="flex items-center gap-3">
          {/* Facility Status Chip */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBg}`}>
            {overallStatus === 'Normal' ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>STATUS: {overallStatus.toUpperCase()}</span>
          </div>

          {/* Connection Pulse */}
          {!isOnline ? (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline — Local Monitoring Active</span>
            </div>
          ) : isWsConnected ? (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-vault-800/80 border border-vault-700 text-vault-300 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-agri-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-agri-500"></span>
              </span>
              <span className="font-mono text-[11px]">TELEMETRY LIVE</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <Radio className="w-3.5 h-3.5 animate-spin" />
              <span>Reconnecting...</span>
            </div>
          )}

          {/* Simulation Mode Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 text-xs font-medium transition"
              title="Test simulation scenarios without hardware"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Scenario:</span>
              <span className="font-mono capitalize text-white">
                {simulationStatus?.activeScenario?.replace('_', ' ') || 'Normal'}
              </span>
              <ChevronDown className="w-3 h-3 text-indigo-400" />
            </button>

            {showSimMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-vault-900 border border-vault-700 rounded-lg shadow-2xl py-2 z-50">
                <div className="px-3 py-1 border-b border-vault-800 text-[11px] font-semibold text-vault-400 uppercase tracking-wider">
                  Select Simulation Scenario
                </div>
                {scenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSimulationScenario(sc.id);
                      setShowSimMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-vault-800 ${
                      simulationStatus?.activeScenario === sc.id
                        ? 'bg-indigo-950 text-indigo-300 font-semibold'
                        : 'text-slate-200'
                    }`}
                  >
                    <span>{sc.label}</span>
                    {simulationStatus?.activeScenario === sc.id && (
                      <span className="text-[10px] bg-indigo-500/30 px-1 rounded text-indigo-300">ACTIVE</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Setup Wizard, Role Switcher, Profile */}
        <div className="flex items-center gap-2">
          {/* Onboarding Wizard Launcher */}
          <button
            onClick={() => setShowOnboarding(true)}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs rounded border border-vault-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-agri-400" />
            <span>Setup Wizard</span>
          </button>

          {/* User Role Badge with Quick Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-2.5 py-1 rounded bg-vault-800/80 hover:bg-vault-700 border border-vault-700 transition text-left"
            >
              <div className="w-6 h-6 rounded-full bg-agri-900/60 border border-agri-500/40 flex items-center justify-center text-agri-300 text-xs font-bold">
                {user?.name ? user.name[0] : 'U'}
              </div>
              <div className="hidden xl:block">
                <p className="text-xs font-medium text-slate-200 truncate max-w-[120px]">{user?.name?.split(' ')[0]}</p>
                <p className="text-[10px] font-mono text-agri-400 uppercase">{role}</p>
              </div>
              <ChevronDown className="w-3 h-3 text-vault-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-vault-900 border border-vault-700 rounded-lg shadow-2xl py-2 z-50">
                <div className="px-3 py-1 border-b border-vault-800 text-[11px] font-semibold text-vault-400 uppercase">
                  Switch Active Role
                </div>
                {(['Owner', 'Admin', 'Operator', 'Viewer'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      switchRole(r);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-vault-800 ${
                      role === r ? 'bg-agri-950 text-agri-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span>{r}</span>
                    {role === r && <span className="text-[10px] text-agri-400">CURRENT</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
