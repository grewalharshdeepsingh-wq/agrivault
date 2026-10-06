import { stateMesh } from './stateMesh';

const API_BASE = '/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('agrivault_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('agrivault_token', token);
}

export function removeStoredToken(): void {
  localStorage.removeItem('agrivault_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const meshHeader = stateMesh.encodeSyncHeader();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(meshHeader ? { 'x-agrivault-mesh': meshHeader } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  register: (data: { name: string; email: string; password: string; organizationName?: string }) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getMe: () => request<{ user: any; organization: any }>('/auth/me'),

  // Facilities & Overview
  getFacilities: () => request<any[]>('/facilities'),
  getFacilityOverview: (id: string) => request<any>(`/facilities/${id}/overview`),
  createFacility: (data: { name: string; location: string; description?: string }) =>
    request<any>('/facilities', { method: 'POST', body: JSON.stringify(data) }),
  createArea: (facilityId: string, data: { name: string; commodity: string }) =>
    request<any>(`/facilities/${facilityId}/areas`, { method: 'POST', body: JSON.stringify(data) }),
  createAreaDirect: async (data: { name: string; commodity: string; facilityId?: string; deviceIds?: string[] }) => {
    const res = await request<any>('/areas', { method: 'POST', body: JSON.stringify(data) });
    if (res && res.id) {
      stateMesh.recordRoomCreated(res, data.deviceIds || []);
    }
    return res;
  },

  // Areas
  getAreas: (facilityId?: string) =>
    request<any[]>(facilityId ? `/areas?facilityId=${facilityId}` : '/areas'),
  getArea: (id: string) => request<any>(`/areas/${id}`),
  updateArea: async (id: string, data: { name?: string; commodity?: string }) => {
    stateMesh.recordRoomUpdated(id, data);
    return request<any>(`/areas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteArea: async (id: string) => {
    stateMesh.recordRoomDeleted(id);
    return request<any>(`/areas/${id}`, { method: 'DELETE' });
  },

  // Analytics & Statistics
  getAnalyticsSummary: (period = '24h', areaId?: string) => {
    const qs = new URLSearchParams({ period });
    if (areaId) qs.append('areaId', areaId);
    return request<any>(`/analytics/summary?${qs.toString()}`);
  },

  // Devices
  getDevices: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/devices${qs}`);
  },
  getDevice: (id: string) => request<any>(`/devices/${id}`),
  updateDevice: async (id: string, data: any) => {
    if (data.areaId) {
      stateMesh.recordDeviceAssigned(id, data.areaId);
    } else if (data.areaId === null) {
      stateMesh.recordDeviceUnassigned(id);
    }
    return request<any>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  unassignDevice: async (id: string) => {
    stateMesh.recordDeviceUnassigned(id);
    return request<any>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify({ areaId: null, isDiscovered: 1 }) });
  },
  deleteDevice: async (id: string) => {
    stateMesh.recordDeviceDeleted(id);
    return request<any>(`/devices/${id}`, { method: 'DELETE' });
  },
  simulateDiscovery: (hardwareType?: 'ESP32' | 'ESP8266') =>
    request<any>('/devices/discover/simulate', {
      method: 'POST',
      body: JSON.stringify({ hardwareType })
    }),
  approveDevice: (id: string, data: any) =>
    request<any>(`/devices/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  rejectDevice: (id: string) =>
    request<any>(`/devices/${id}/reject`, { method: 'POST' }),
  revokeDevice: (id: string) =>
    request<any>(`/devices/${id}/revoke`, { method: 'POST' }),

  // Gateways & Hardware Topology
  getGateways: () => request<any[]>('/gateways'),
  getGatewayTopology: () => request<any>('/gateways/topology'),
  flushGatewayBuffer: () => request<any>('/gateways/buffer-flush', { method: 'POST' }),
  controlGateway: (params: any) =>
    request<any>('/gateways/control', { method: 'POST', body: JSON.stringify(params) }),
  updateFacility: (id: string, data: any) =>
    request<any>(`/facilities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Sensors
  getSensor: (id: string) => request<any>(`/sensors/${id}`),
  getSensorHistory: (id: string, period = '24h') =>
    request<any>(`/sensors/${id}/history?period=${period}`),
  calibrateSensor: (id: string, data: { offset?: number; referenceReading?: number }) =>
    request<any>(`/sensors/${id}/calibrate`, { method: 'POST', body: JSON.stringify(data) }),

  // Thresholds
  getThresholds: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/thresholds${qs}`);
  },
  saveThreshold: (data: any) =>
    request<any>('/thresholds', { method: 'POST', body: JSON.stringify(data) }),
  deleteThreshold: (id: string) =>
    request<any>(`/thresholds/${id}`, { method: 'DELETE' }),

  // Alerts
  getAlerts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/alerts${qs}`);
  },
  acknowledgeAlert: (id: string, actorName = 'Operator') =>
    request<any>(`/alerts/${id}/acknowledge`, { method: 'POST', body: JSON.stringify({ actorName }) }),
  resolveAlert: (id: string, actorName = 'Operator', notes = '') =>
    request<any>(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ actorName, notes }) }),
  getAlertEvents: (id: string) => request<any[]>(`/alerts/${id}/events`),

  // Relays & Automation
  getRelays: (areaId?: string) => {
    const qs = areaId ? `?areaId=${areaId}` : '';
    return request<any[]>(`/relays${qs}`);
  },
  toggleRelay: (id: string, targetState: 0 | 1, confirmed: boolean, reason?: string, actorName?: string, bypassCooldown?: boolean) =>
    request<any>(`/relays/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ targetState, confirmed, reason, actorName, bypassCooldown })
    }),
  setRelayMode: (id: string, mode: 'manual' | 'automatic') =>
    request<any>(`/relays/${id}/mode`, { method: 'PUT', body: JSON.stringify({ mode }) }),
  getRelayActions: (id: string) => request<any[]>(`/relays/${id}/actions`),

  // Automation Rules
  getAutomationRules: () => request<any[]>('/relays/rules/all'),
  saveAutomationRule: (data: any) =>
    request<any>('/relays/rules', { method: 'POST', body: JSON.stringify(data) }),
  toggleAutomationRule: (id: string, isEnabled: boolean) =>
    request<any>(`/relays/rules/${id}/toggle`, { method: 'PUT', body: JSON.stringify({ isEnabled }) }),
  deleteAutomationRule: (id: string) =>
    request<any>(`/relays/rules/${id}`, { method: 'DELETE' }),

  // Reports
  generateReport: (facilityId = 'fac-01', areaId?: string, period = '24h') => {
    let url = `/reports/generate?facilityId=${facilityId}&period=${period}`;
    if (areaId) url += `&areaId=${areaId}`;
    return request<any>(url);
  },
  getReportExportUrl: (areaId?: string, period = '24h', format = 'csv') => {
    let url = `/api/reports/export?period=${period}&format=${format}`;
    if (areaId) url += `&areaId=${areaId}`;
    return url;
  },

  // System & Diagnostics
  getSystemHealth: () => request<any>('/system/health'),

  // Simulation Controller
  getSimulationStatus: () => request<any>('/simulation/status'),
  setSimulationScenario: (scenario: string) =>
    request<any>('/simulation/scenario', { method: 'POST', body: JSON.stringify({ scenario }) }),
  toggleSimulation: (enabled: boolean) =>
    request<any>('/simulation/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }),
  toggleNetworkFailure: (failureType: string, isFailed: boolean) =>
    request<any>('/simulation/network-failure', { method: 'POST', body: JSON.stringify({ failureType, isFailed }) }),
  toggleSimulatedNode: (deviceId: string, offline: boolean) =>
    request<any>('/simulation/node/toggle', { method: 'POST', body: JSON.stringify({ deviceId, offline }) })
};
