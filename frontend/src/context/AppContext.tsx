import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Facility, Alert, ESPDevice } from '../types';
import { api } from '../api/client';
import { wsManager } from '../api/websocket';

interface AppContextType {
  facilityId: string;
  facility: Facility | null;
  overview: any | null;
  alerts: Alert[];
  isWsConnected: boolean;
  isOnline: boolean;
  discoveredDevices: ESPDevice[];
  simulationStatus: any | null;
  showOnboarding: boolean;
  setShowOnboarding: (val: boolean) => void;
  refreshOverview: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  setSimulationScenario: (scenario: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string, notes?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [facilityId, setFacilityId] = useState('fac-01');
  const [facility, setFacility] = useState<Facility | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [discoveredDevices, setDiscoveredDevices] = useState<ESPDevice[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<any | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Monitor browser network state
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor WebSocket status
  useEffect(() => {
    return wsManager.onStatusChange((connected) => {
      setIsWsConnected(connected);
    });
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      const data = await api.getFacilityOverview(facilityId);
      setOverview(data);
      if (data.facility) setFacility(data.facility);
    } catch (err) {
      console.warn('[AppContext] Failed to load facility overview:', err);
    }
  }, [facilityId]);

  const refreshAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts({ facilityId });
      setAlerts(data);
    } catch (err) {
      console.warn('[AppContext] Failed to load alerts:', err);
    }
  }, [facilityId]);

  const refreshSimulation = useCallback(async () => {
    try {
      const sim = await api.getSimulationStatus();
      setSimulationStatus(sim);
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshOverview();
    refreshAlerts();
    refreshSimulation();

    // Check if new discovered devices exist
    api.getDevices({ isDiscovered: 'true' }).then((devs) => {
      setDiscoveredDevices(devs);
    }).catch(() => {});
  }, [refreshOverview, refreshAlerts, refreshSimulation]);

  // Polling fallback when WebSocket is not active (crucial for Vercel serverless environment)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (!isWsConnected) {
        refreshOverview();
        refreshAlerts();
        api.getDevices({ isDiscovered: 'true' }).then((devs) => {
          setDiscoveredDevices(devs);
        }).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [isWsConnected, refreshOverview, refreshAlerts]);

  // Wire Real-Time WebSocket Events
  useEffect(() => {
    // 1. Live Telemetry stream: update metrics smoothly
    const unsubTelemetry = wsManager.on('telemetry_update', (data) => {
      setOverview((prev: any) => {
        if (!prev || !prev.areas) return prev;
        const updatedAreas = prev.areas.map((a: any) => {
          if (a.id === data.areaId) {
            const updatedMetrics = { ...a.metrics };
            for (const s of data.sensors) {
              updatedMetrics[s.parameter] = {
                value: s.value,
                raw: s.raw,
                unit: s.unit,
                rateOfChange: s.rateOfChange,
                rateOfChangePeriod: '30 min',
                health: 'healthy',
                confidence: 96
              };
            }
            return {
              ...a,
              metrics: updatedMetrics,
              health_status: data.areaHealth ? data.areaHealth.healthStatus : a.health_status,
              health_score: data.areaHealth ? data.areaHealth.healthScore : a.health_score,
              health_reasons: data.areaHealth ? data.areaHealth.healthReasons : a.health_reasons
            };
          }
          return a;
        });
        return { ...prev, areas: updatedAreas };
      });
    });

    // 2. New Alert Trigger
    const unsubAlert = wsManager.on('new_alert', (newAlert: Alert) => {
      setAlerts((prev) => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
      refreshOverview();
    });

    // 3. Alert Resolved
    const unsubResolved = wsManager.on('alert_resolved', (payload) => {
      setAlerts((prev) =>
        prev.map(a => a.id === payload.alertId ? { ...a, status: 'resolved', resolved_at: payload.resolvedAt } : a)
      );
      refreshOverview();
    });

    // 4. Alert Acknowledged
    const unsubAck = wsManager.on('alert_acknowledged', (payload) => {
      setAlerts((prev) =>
        prev.map(a => a.id === payload.alertId ? { ...a, status: 'acknowledged', acknowledged_by: payload.acknowledgedBy } : a)
      );
    });

    // 5. Hardware Device Discovered
    const unsubDisc = wsManager.on('device_discovered', (payload) => {
      setDiscoveredDevices((prev) => [payload.device, ...prev]);
      refreshOverview();
    });

    // 6. Device Status Change (Offline / Online)
    const unsubOffline = wsManager.on('device_offline', () => {
      refreshOverview();
    });
    const unsubOnline = wsManager.on('device_online', () => {
      refreshOverview();
    });

    return () => {
      unsubTelemetry();
      unsubAlert();
      unsubResolved();
      unsubAck();
      unsubDisc();
      unsubOffline();
      unsubOnline();
    };
  }, [refreshOverview]);

  const setSimulationScenario = async (scenario: string) => {
    await api.setSimulationScenario(scenario);
    refreshSimulation();
    refreshOverview();
  };

  const acknowledgeAlert = async (alertId: string) => {
    await api.acknowledgeAlert(alertId, 'Elena (Operator)');
    refreshAlerts();
  };

  const resolveAlert = async (alertId: string, notes?: string) => {
    await api.resolveAlert(alertId, 'Elena (Operator)', notes);
    refreshAlerts();
  };

  return (
    <AppContext.Provider
      value={{
        facilityId,
        facility,
        overview,
        alerts,
        isWsConnected,
        isOnline,
        discoveredDevices,
        simulationStatus,
        showOnboarding,
        setShowOnboarding,
        refreshOverview,
        refreshAlerts,
        setSimulationScenario,
        acknowledgeAlert,
        resolveAlert
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
};
