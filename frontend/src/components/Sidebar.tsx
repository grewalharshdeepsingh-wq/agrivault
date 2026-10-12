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
  Radio,
  BookOpen,
  ShieldAlert,
  Server,
  QrCode,
  Users,
  HelpCircle,
  ShieldCheck,
  Home
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type NavTab =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'facilities'
  | 'areas'
  | 'devices'
  | 'gateways'
  | 'provisioning'
  | 'live'
  | 'crop_profiles'
  | 'thresholds'
  | 'risk_advisor'
  | 'alerts'
  | 'analytics'
  | 'reports'
  | 'relays'
  | 'users'
  | 'diagnostics'
  | 'settings'
  | 'help'
  | 'simulation';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

interface NavGroup {
  title: string;
  items: {
    id: NavTab;
    label: string;
    icon: any;
    count?: number;
    countColor?: string;
    badge?: string;
    badgeColor?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { overview, discoveredDevices } = useApp();
  const activeAlertsCount = overview?.activeAlertsCount || 0;
  const discoveredCount = discoveredDevices.filter(d => d.is_discovered === 1 || d.registration_status === 'pending').length;

  const navGroups: NavGroup[] = [
    {
      title: 'Facility Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'facilities', label: 'Facilities', icon: Building2 },
        { id: 'areas', label: 'Storage Zones', icon: Layers, count: overview?.activeAreasCount },
        { id: 'landing', label: 'Platform Portal', icon: Home },
        { id: 'auth', label: 'Access & Roles', icon: ShieldCheck }
      ]
    },
    {
      title: 'Devices & Gateway Mesh',
      items: [
        { id: 'devices', label: 'Sensor Nodes', icon: Cpu },
        { id: 'gateways', label: 'Central Gateways', icon: Server },
        { id: 'provisioning', label: 'Device Provisioning', icon: QrCode, badge: discoveredCount > 0 ? `${discoveredCount} new` : undefined, badgeColor: 'bg-agri-500' }
      ]
    },
    {
      title: 'Sensory Intelligence',
      items: [
        { id: 'live', label: 'Live Monitoring', icon: Radio },
        { id: 'crop_profiles', label: 'Crop Profiles', icon: BookOpen },
        { id: 'thresholds', label: 'Threshold Rules', icon: Sliders },
        { id: 'risk_advisor', label: 'Risk Advisor', icon: ShieldAlert },
        { id: 'alerts', label: 'Active Alerts', icon: AlertTriangle, count: activeAlertsCount, countColor: activeAlertsCount > 0 ? 'bg-rose-600 text-white' : undefined }
      ]
    },
    {
      title: 'Control & Analytics',
      items: [
        { id: 'relays', label: 'Relay Control', icon: ToggleRight },
        { id: 'analytics', label: 'Analytics & Trends', icon: Activity },
        { id: 'reports', label: 'Compliance Reports', icon: BarChart3 }
      ]
    },
    {
      title: 'System & Support',
      items: [
        { id: 'diagnostics', label: 'Sensor Diagnostics', icon: Activity },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'settings', label: 'System Settings', icon: Settings },
        { id: 'help', label: 'Help & Troubleshooting', icon: HelpCircle },
        { id: 'simulation', label: 'Simulation Lab', icon: Sliders }
      ]
    }
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
          {overview?.facility?.name || 'Cold Store A (Bulk Operations)'}
        </p>
        <p className="text-xs text-vault-400 truncate">
          {overview?.facility?.location || 'Section 4, Industrial Food Park'}
        </p>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-vault-500 uppercase tracking-wider block mb-1">
              {group.title}
            </span>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-agri-600/15 text-agri-300 border border-agri-500/30 shadow-sm font-bold'
                      : 'text-vault-300 hover:bg-vault-800 hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-agri-400' : 'text-vault-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase text-white ${item.badgeColor || 'bg-agri-500'}`}>
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${item.countColor || 'bg-vault-800 text-slate-300'}`}>
                        {item.count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
