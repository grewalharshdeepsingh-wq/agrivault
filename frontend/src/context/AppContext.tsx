import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Facility, Alert, ESPDevice } from '../types';
import { api } from '../api/client';
import { wsManager, ConnectionMode } from '../api/websocket';

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

interface AppContextType {
  facilityId: string;
  facility: Facility | null;
  overview: any | null;
  alerts: Alert[];
  isWsConnected: boolean;
  connectionMode: ConnectionMode;
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
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('connecting');
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

  // Monitor WebSocket status & connection mode
  useEffect(() => {
    return wsManager.onStatusChange((connected, mode) => {
      setIsWsConnected(connected);
      setConnectionMode(mode);
    });
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      const data = await api.getFacilityOverview(facilityId);
      setOverview((prev: any) => (isDeepEqual(prev, data) ? prev : data));
      if (data.facility) {
        setFacility((prev: any) => (isDeepEqual(prev, data.facility) ? prev : data.facility));
      }
      try {
        const unassigned = await api.getDevices({ isDiscovered: 'true' });
        setDiscoveredDevices((prev) => (isDeepEqual(prev, unassigned) ? prev : unassigned));
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('[AppContext] Failed to load facility overview:', err);
    }
  }, [facilityId]);

  const refreshAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts({ facilityId });
      setAlerts((prev) => (isDeepEqual(prev, data) ? prev : data));
    } catch (err) {
      console.warn('[AppContext] Failed to load alerts:', err);
    }
  }, [facilityId]);

  const refreshSimulation = useCallback(async () => {
    try {
      const sim = await api.getSimulationStatus();
      setSimulationStatus((prev: any) => (isDeepEqual(prev, sim) ? prev : sim));
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
      setDiscoveredDevices((prev) => (isDeepEqual(prev, devs) ? prev : devs));
    }).catch(() => {});
  }, [refreshOverview, refreshAlerts, refreshSimulation]);

  // Polling fallback when WebSocket is not active or in Cloud HTTP Sync mode
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (!isWsConnected || connectionMode === 'http_sync') {
        refreshOverview();
        refreshAlerts();
        api.getDevices({ isDiscovered: 'true' }).then((devs) => {
          setDiscoveredDevices((prev) => (isDeepEqual(prev, devs) ? prev : devs));
        }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [isWsConnected, connectionMode, refreshOverview, refreshAlerts]);

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
      const dev = payload?.device;
      if (dev && !dev.area_id) {
        setDiscoveredDevices((prev) => {
          const exists = prev.some(d => d.id === dev.id);
          if (exists) return prev.map(d => d.id === dev.id ? dev : d);
          return [dev, ...prev];
        });
      }
      refreshOverview();
    });

    // 6. Device Updated (Assigned / Renamed / Unassigned)
    const unsubUpdate = wsManager.on('device_updated', (dev) => {
      if (dev) {
        setDiscoveredDevices((prev) => {
          if (dev.area_id) {
            // If device is assigned to a room, remove from discovered available list
            return prev.filter(d => d.id !== dev.id);
          }
          // If unassigned, ensure it appears in available list
          const exists = prev.some(d => d.id === dev.id);
          if (exists) return prev.map(d => d.id === dev.id ? dev : d);
          return [dev, ...prev];
        });
      }
      refreshOverview();
    });

    // 7. Device Deleted
    const unsubDelete = wsManager.on('device_deleted', (payload) => {
      if (payload?.deviceId) {
        setDiscoveredDevices((prev) => prev.filter(d => d.id !== payload.deviceId));
      }
      refreshOverview();
    });

    // 8. Room / Area Changes
    const unsubAreaDel = wsManager.on('area_deleted', () => {
      refreshOverview();
    });
    const unsubAreaCreate = wsManager.on('area_created', () => {
      refreshOverview();
    });

    // 9. Device Status Change (Offline / Online)
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
      unsubUpdate();
      unsubDelete();
      unsubAreaDel();
      unsubAreaCreate();
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
        connectionMode,
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
