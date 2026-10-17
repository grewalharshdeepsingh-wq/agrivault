import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { AlertBanner } from './components/AlertBanner';
import { OnboardingWizard } from './components/OnboardingWizard';

// 18 Complete Application Pages
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { StorageZonesPage } from './pages/StorageZonesPage';
import { AreaDetail } from './pages/AreaDetail';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { GatewayManagementPage } from './pages/GatewayManagementPage';
import { DeviceProvisioningPage } from './pages/DeviceProvisioningPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { CropProfilesPage } from './pages/CropProfilesPage';
import { ThresholdConfigPage } from './pages/ThresholdConfigPage';
import { RiskAdvisorPage } from './pages/RiskAdvisorPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { RelayControlPage } from './pages/RelayControlPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SensorDiagnosticsPage } from './pages/SensorDiagnosticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { SimulationPage } from './pages/SimulationPage';

import {
  X,
  Layers,
  Cpu,
  BarChart3,
  ToggleRight,
  Activity,
  Sliders,
  Settings,
  BookOpen,
  ShieldAlert,
  Server,
  QrCode,
  Users,
  HelpCircle,
  Radio,
  Home
} from 'lucide-react';

export const App: React.FC = () => {
  const { showOnboarding, setShowOnboarding } = useApp();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showMobileMore, setShowMobileMore] = useState(false);

  const handleSelectArea = (areaId: string) => {
    setSelectedAreaId(areaId);
    setSelectedDeviceId(null);
  };

  const handleSelectDevice = (devId: string) => {
    setSelectedDeviceId(devId);
    setSelectedAreaId(null);
  };

  const handleBackToDashboard = () => {
    setSelectedAreaId(null);
    setSelectedDeviceId(null);
  };

  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    setSelectedAreaId(null);
    setSelectedDeviceId(null);
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

          <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto">
            {/* If an individual device is drilled into */}
            {selectedDeviceId ? (
              <DeviceDetailPage
                deviceId={selectedDeviceId}
                onBack={() => setSelectedDeviceId(null)}
              />
            ) : selectedAreaId ? (
              /* If a storage zone is drilled into */
              <AreaDetail
                areaId={selectedAreaId}
                onBack={handleBackToDashboard}
                onSelectDevice={handleSelectDevice}
              />
            ) : (
              /* 18 Core Application Pages */
              <>
                {currentTab === 'landing' && (
                  <LandingPage
                    onEnterApp={() => handleTabChange('dashboard')}
                    onNavigateToProvisioning={() => handleTabChange('provisioning')}
                  />
                )}

                {currentTab === 'dashboard' && (
                  <Dashboard
                    onSelectArea={handleSelectArea}
                    onNavigateToDevices={() => handleTabChange('devices')}
                    onNavigateToAlerts={() => handleTabChange('alerts')}
                    onNavigateToSimulation={() => handleTabChange('simulation')}
                  />
                )}

                {currentTab === 'areas' && (
                  <StorageZonesPage
                    onSelectZone={handleSelectArea}
                    onNavigateToCropProfiles={() => handleTabChange('crop_profiles')}
                  />
                )}

                {currentTab === 'devices' && (
                  <DevicesPage onSelectDevice={handleSelectDevice} />
                )}

                {currentTab === 'gateways' && <GatewayManagementPage />}

                {currentTab === 'provisioning' && <DeviceProvisioningPage />}

                {currentTab === 'live' && <LiveMonitoringPage />}

                {currentTab === 'crop_profiles' && <CropProfilesPage />}

                {currentTab === 'thresholds' && <ThresholdConfigPage />}

                {currentTab === 'risk_advisor' && <RiskAdvisorPage />}

                {currentTab === 'alerts' && <AlertsPage />}

                {currentTab === 'analytics' && <AnalyticsPage />}

                {currentTab === 'reports' && <ReportsPage />}

                {currentTab === 'relays' && <RelayControlPage />}

                {currentTab === 'users' && <UserManagementPage />}

                {currentTab === 'diagnostics' && <SensorDiagnosticsPage />}

                {currentTab === 'settings' && <SettingsPage />}

                {currentTab === 'help' && <HelpPage />}

                {currentTab === 'simulation' && <SimulationPage />}
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

      {/* Mobile "More" Drawer with All Pages */}
      {showMobileMore && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end">
          <div className="bg-vault-900 border-t border-vault-700 w-full rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">All Platform Navigation</h3>
              <button onClick={() => setShowMobileMore(false)} className="p-1 rounded text-vault-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Home },
                { id: 'areas', label: 'Storage Zones', icon: Layers },
                { id: 'devices', label: 'Sensor Nodes', icon: Cpu },
                { id: 'gateways', label: 'Central Gateways', icon: Server },
                { id: 'provisioning', label: 'Device Provisioning', icon: QrCode },
                { id: 'live', label: 'Live Sensory Grid', icon: Radio },
                { id: 'crop_profiles', label: 'Crop Profiles', icon: BookOpen },
                { id: 'thresholds', label: 'Threshold Rules', icon: Sliders },
                { id: 'risk_advisor', label: 'Risk Advisor', icon: ShieldAlert },
                { id: 'alerts', label: 'Alerts & History', icon: BarChart3 },
                { id: 'relays', label: 'Manual Relays', icon: ToggleRight },
                { id: 'analytics', label: 'Analytics & Trends', icon: Activity },
                { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
                { id: 'diagnostics', label: 'Sensor Diagnostics', icon: Activity },
                { id: 'users', label: 'User Roles & RBAC', icon: Users },
                { id: 'settings', label: 'System Settings', icon: Settings },
                { id: 'help', label: 'Help & Wiring Guide', icon: HelpCircle },
                { id: 'simulation', label: 'Simulation Lab', icon: Sliders }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id as NavTab)}
                    className="flex items-center gap-2 p-3 rounded-lg bg-vault-950 border border-vault-800 text-slate-200 hover:bg-vault-800"
                  >
                    <Icon className="w-4 h-4 text-agri-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Onboarding Setup Wizard */}
      <OnboardingWizard isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
};
