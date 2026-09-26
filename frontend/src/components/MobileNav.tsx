import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Radio,
  AlertTriangle,
  Cpu,
  Menu
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { useApp } from '../context/AppContext';

interface MobileNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMoreMenu: () => void;
}

interface MobileNavItem {
  id: NavTab;
  label: string;
  icon: any;
  count?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onSelectTab, onOpenMoreMenu }) => {
  const { overview } = useApp();
  const alertCount = overview?.activeAlertsCount || 0;

  const items: MobileNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'areas', label: 'Areas', icon: Layers },
    { id: 'live', label: 'Live', icon: Radio },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, count: alertCount },
    { id: 'devices', label: 'Devices', icon: Cpu },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-vault-900/95 backdrop-blur-md border-t border-vault-800 pb-safe">
      <div className="grid grid-cols-6 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as NavTab)}
              className={`flex flex-col items-center justify-center relative transition ${
                isActive ? 'text-agri-400 font-semibold' : 'text-vault-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>

              {item.count !== undefined && item.count > 0 && (
                <span className="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center font-bold">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* More Menu toggle */}
        <button
          onClick={onOpenMoreMenu}
          className="flex flex-col items-center justify-center text-vault-400 hover:text-slate-200"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </div>
    </div>
  );
};
