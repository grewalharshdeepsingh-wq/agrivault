import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Cpu,
  AlertTriangle,
  BarChart3,
  ToggleRight,
  Activity,
  Sliders,
  Settings,
  Building2,
  Radio
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type NavTab =
  | 'dashboard'
  | 'areas'
  | 'devices'
  | 'live'
  | 'alerts'
  | 'analytics'
  | 'reports'
  | 'automation'
  | 'system'
  | 'simulation'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: any;
  count?: number;
  countColor?: string;
  badge?: string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { overview, discoveredDevices } = useApp();
  const activeAlertsCount = overview?.activeAlertsCount || 0;
  const discoveredCount = discoveredDevices.filter(d => d.is_discovered === 1).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'areas', label: 'Rooms & Sections', icon: Layers, count: overview?.activeAreasCount },
    { id: 'analytics', label: 'Analytics & Stats', icon: Activity },
    { id: 'devices', label: 'Devices & ESPs', icon: Cpu, badge: discoveredCount > 0 ? `${discoveredCount} new` : undefined, badgeColor: 'bg-indigo-500' },
    { id: 'live', label: 'Live Monitoring', icon: Radio },
    { id: 'alerts', label: 'Active Alerts', icon: AlertTriangle, count: activeAlertsCount, countColor: activeAlertsCount > 0 ? 'bg-rose-600 text-white' : undefined },
    { id: 'reports', label: 'Historical Reports', icon: BarChart3 },
    { id: 'automation', label: 'Relay Automation', icon: ToggleRight },
    { id: 'system', label: 'System Health', icon: Activity },
    { id: 'simulation', label: 'Simulation Lab', icon: Sliders },
    { id: 'settings', label: 'Thresholds & Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-vault-900 border-r border-vault-800 shrink-0 select-none">
      {/* Facility Header Badge */}
      <div className="p-4 border-b border-vault-800/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-vault-400 uppercase tracking-wider mb-1">
          <Building2 className="w-3.5 h-3.5 text-agri-500" />
          <span>Active Facility</span>
        </div>
        <p className="text-sm font-semibold text-slate-100 truncate">
          {overview?.facility?.name || 'ABC Cold Storage'}
        </p>
        <p className="text-xs text-vault-400 truncate">
          {overview?.facility?.location || 'Central Vault Hub'}
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as NavTab)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-agri-600/15 text-agri-300 border border-agri-500/30 shadow-sm'
                  : 'text-vault-300 hover:bg-vault-800 hover:text-slate-100 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-agri-400' : 'text-vault-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded text-white ${item.badgeColor || 'bg-vault-700'}`}>
                  {item.badge}
                </span>
              )}

              {item.count !== undefined && item.count > 0 && !item.badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${item.countColor || 'bg-vault-800 text-vault-300'}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Gateway Telemetry Footer */}
      <div className="p-3 m-3 rounded-lg bg-vault-950/80 border border-vault-800 text-xs">
        <div className="flex items-center justify-between text-vault-400 mb-1">
          <span className="font-mono text-[11px]">GATEWAY 01</span>
          <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ONLINE
          </span>
        </div>
        <p className="text-[11px] text-vault-400 font-mono truncate">192.168.1.100</p>
        <p className="text-[10px] text-vault-500 mt-0.5">RPi 4 | Mesh Wi-Fi Active</p>
      </div>
    </aside>
  );
};
