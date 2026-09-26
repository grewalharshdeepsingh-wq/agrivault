import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { AlertBanner } from './components/AlertBanner';
import { OnboardingWizard } from './components/OnboardingWizard';

// Pages
import { Dashboard } from './pages/Dashboard';
import { AreaDetail } from './pages/AreaDetail';
import { DevicesPage } from './pages/DevicesPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AutomationPage } from './pages/AutomationPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { SimulationPage } from './pages/SimulationPage';
import { SettingsPage } from './pages/SettingsPage';
import { X, Layers, Cpu, BarChart3, ToggleRight, Activity, Sliders, Settings } from 'lucide-react';

export const App: React.FC = () => {
  const { showOnboarding, setShowOnboarding } = useApp();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showMobileMore, setShowMobileMore] = useState(false);

  const handleSelectArea = (areaId: string) => {
    setSelectedAreaId(areaId);
  };

  const handleBackToDashboard = () => {
    setSelectedAreaId(null);
  };

  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    setSelectedAreaId(null);
    setShowMobileMore(false);
  };

  return (
    <div className="min-h-screen bg-vault-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar currentTab={currentTab} onSelectTab={handleTabChange} />

        {/* Central Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          {/* Active Alert Banner */}
          <AlertBanner onNavigateToAlerts={() => handleTabChange('alerts')} />

          <div className="px-4 lg:px-8 py-4 max-w-7xl mx-auto">
            {/* If an area is drilled into, render AreaDetail */}
            {selectedAreaId ? (
              <AreaDetail
                areaId={selectedAreaId}
                onBack={handleBackToDashboard}
                onSelectDevice={(devId) => handleTabChange('devices')}
              />
            ) : (
              <>
                {currentTab === 'dashboard' && (
                  <Dashboard
                    onSelectArea={handleSelectArea}
                    onNavigateToDevices={() => handleTabChange('devices')}
                    onNavigateToAlerts={() => handleTabChange('alerts')}
                    onNavigateToSimulation={() => handleTabChange('simulation')}
                  />
                )}

                {currentTab === 'areas' && (
                  <Dashboard
                    onSelectArea={handleSelectArea}
                    onNavigateToDevices={() => handleTabChange('devices')}
                    onNavigateToAlerts={() => handleTabChange('alerts')}
                    onNavigateToSimulation={() => handleTabChange('simulation')}
                  />
                )}

                {currentTab === 'devices' && <DevicesPage />}

                {currentTab === 'live' && (
                  <Dashboard
                    onSelectArea={handleSelectArea}
                    onNavigateToDevices={() => handleTabChange('devices')}
                    onNavigateToAlerts={() => handleTabChange('alerts')}
                    onNavigateToSimulation={() => handleTabChange('simulation')}
                  />
                )}

                {currentTab === 'alerts' && <AlertsPage />}

                {currentTab === 'reports' && <ReportsPage />}

                {currentTab === 'automation' && <AutomationPage />}

                {currentTab === 'system' && <SystemHealthPage />}

                {currentTab === 'simulation' && <SimulationPage />}

                {currentTab === 'settings' && <SettingsPage />}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        onOpenMoreMenu={() => setShowMobileMore(true)}
      />

      {/* Mobile "More" Drawer */}
      {showMobileMore && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end">
          <div className="bg-vault-900 border-t border-vault-700 w-full rounded-t-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">More Navigation</h3>
              <button onClick={() => setShowMobileMore(false)} className="p-1 rounded text-vault-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
                { id: 'automation', label: 'Relay Automation', icon: ToggleRight },
                { id: 'system', label: 'System Health', icon: Activity },
                { id: 'simulation', label: 'Simulation Lab', icon: Sliders },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id as NavTab)}
                    className="flex items-center gap-2 p-3 rounded-lg bg-vault-950 border border-vault-800 text-slate-200 hover:bg-vault-800"
                  >
                    <Icon className="w-4 h-4 text-agri-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 10-Step Interactive Onboarding Setup Wizard */}
      <OnboardingWizard isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
};
