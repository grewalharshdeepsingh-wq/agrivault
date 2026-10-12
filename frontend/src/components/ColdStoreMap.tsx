import React, { useState, useEffect } from 'react';
import { ESPDevice, Facility } from '../types';
import { api } from '../api/client';
import {
  Settings2,
  Cpu,
  Thermometer,
  Droplets,
  Wind,
  Check,
  X,
  Activity,
  ExternalLink
} from 'lucide-react';

interface ColdStoreMapProps {
  facility: Facility | undefined;
  devices: ESPDevice[];
  onSelectDevice?: (deviceId: string) => void;
  onRefreshFacility?: () => void;
}

export const ColdStoreMap: React.FC<ColdStoreMapProps> = ({
  facility,
  devices,
  onSelectDevice,
  onRefreshFacility
}) => {
  const [activeMetric, setActiveMetric] = useState<'temperature' | 'humidity' | 'co2' | 'mq3' | 'mq135'>('temperature');
  const [selectedNode, setSelectedNode] = useState<ESPDevice | null>(null);
  const [showDimensionModal, setShowDimensionModal] = useState(false);

  // Sanitized facility dimensions (internal scaling only — NOT displayed as dimensions in 2D map view)
  const safeLength = Math.max(10, Math.min(2000, Number(facility?.length_ft) || 162));
  const safeWidth = Math.max(10, Math.min(2000, Number(facility?.width_ft) || 94));
  const safeHeight = Math.max(5, Math.min(500, Number(facility?.height_ft) || 48));
  const currentUnit = facility?.dimensions_unit || 'ft';

  // Dimension edit state for user configuration
  const [editLength, setEditLength] = useState<number>(safeLength);
  const [editWidth, setEditWidth] = useState<number>(safeWidth);
  const [editHeight, setEditHeight] = useState<number>(safeHeight);
  const [editUnit, setEditUnit] = useState<string>(currentUnit);
  const [isSavingDim, setIsSavingDim] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize edit inputs when facility props update
  useEffect(() => {
    if (facility) {
      setEditLength(Math.max(10, Number(facility.length_ft) || 162));
      setEditWidth(Math.max(10, Number(facility.width_ft) || 94));
      setEditHeight(Math.max(5, Number(facility.height_ft) || 48));
      setEditUnit(facility.dimensions_unit || 'ft');
    }
  }, [facility]);

  const handleOpenDimensionModal = () => {
    setSaveStatus(null);
    setEditLength(safeLength);
    setEditWidth(safeWidth);
    setEditHeight(safeHeight);
    setEditUnit(currentUnit);
    setShowDimensionModal(true);
  };

  const handleApplyPreset = (len: number, wid: number, hgt: number, u: string = 'ft') => {
    setEditLength(len);
    setEditWidth(wid);
    setEditHeight(hgt);
    setEditUnit(u);
  };

  const handleSaveDimensions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLength <= 0 || editWidth <= 0 || editHeight <= 0) {
      setSaveStatus({ type: 'error', message: 'All dimensions must be greater than zero.' });
      return;
    }

    const facId = facility?.id || 'fac-01';
    setIsSavingDim(true);
    setSaveStatus(null);

    try {
      await api.updateFacility(facId, {
        length_ft: Number(editLength),
        width_ft: Number(editWidth),
        height_ft: Number(editHeight),
        dimensions_unit: editUnit
      });

      setSaveStatus({ type: 'success', message: 'Cold store dimensions updated successfully!' });
      if (onRefreshFacility) {
        onRefreshFacility();
      }

      setTimeout(() => {
        setShowDimensionModal(false);
        setSaveStatus(null);
      }, 900);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to update dimensions.' });
    } finally {
      setIsSavingDim(false);
    }
  };

  // Helper to safely extract and format sensor values for nodes
  const getNodeValue = (device: ESPDevice, metric: string): { val: number | null; text: string; color: string } => {
    const s = device.sensors?.find((x) => x.sensor_type === metric);
    if (!s || device.is_online === 0) {
      return { val: null, text: device.is_online === 0 ? 'OFF' : '--', color: '#64748b' };
    }

    const rawNum = typeof s.calibrated_reading === 'number' && !isNaN(s.calibrated_reading)
      ? s.calibrated_reading
      : (typeof s.raw_reading === 'number' && !isNaN(s.raw_reading) ? s.raw_reading : null);

    if (rawNum === null) {
      return { val: null, text: 'N/A', color: '#64748b' };
    }

    if (metric === 'temperature') {
      const col = rawNum < 2 ? '#38bdf8' : rawNum <= 4.5 ? '#10b981' : rawNum <= 6 ? '#f59e0b' : '#ef4444';
      return { val: rawNum, text: `${rawNum.toFixed(1)}°C`, color: col };
    }
    if (metric === 'humidity') {
      const col = rawNum < 80 ? '#f59e0b' : rawNum <= 95 ? '#06b6d4' : '#6366f1';
      return { val: rawNum, text: `${Math.round(rawNum)}%`, color: col };
    }
    if (metric === 'co2') {
      const col = rawNum < 800 ? '#10b981' : rawNum <= 1200 ? '#f59e0b' : '#ef4444';
      return { val: rawNum, text: `${Math.round(rawNum)} ppm`, color: col };
    }
    if (metric === 'mq3') {
      const col = rawNum < 1.0 ? '#10b981' : rawNum < 2.0 ? '#f59e0b' : '#ef4444';
      return { val: rawNum, text: `${rawNum.toFixed(2)} ppm`, color: col };
    }
    if (metric === 'mq135') {
      const col = rawNum < 30 ? '#10b981' : rawNum < 60 ? '#f59e0b' : '#ef4444';
      return { val: rawNum, text: `${rawNum.toFixed(1)} ppm`, color: col };
    }

    return { val: rawNum, text: `${rawNum.toFixed(1)}`, color: '#10b981' };
  };

  // Canvas scaling & responsive aspect ratio calculations
  const mapWidth = 920;
  const rawHeight = Math.round((safeWidth / safeLength) * mapWidth);
  const mapHeight = Math.max(340, Math.min(680, rawHeight));
  const wallPadding = 45;

  // Safe node coordinate mapping
  const getDeviceCoords = (d: ESPDevice) => {
    const rawX = typeof d.pos_x === 'number' && !isNaN(d.pos_x) ? d.pos_x : 30;
    const rawY = typeof d.pos_y === 'number' && !isNaN(d.pos_y) ? d.pos_y : 30;
    const marginX = Math.min(8, safeLength * 0.05);
    const marginY = Math.min(8, safeWidth * 0.05);
    const clampedX = Math.min(Math.max(rawX, marginX), Math.max(marginX, safeLength - marginX));
    const clampedY = Math.min(Math.max(rawY, marginY), Math.max(marginY, safeWidth - marginY));
    const px = wallPadding + (clampedX / safeLength) * mapWidth;
    const py = wallPadding + (clampedY / safeWidth) * mapHeight;
    return { px, py };
  };

  const onlineCount = devices.filter(d => d.is_online === 1).length;

  return (
    <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Map Header & Controls — dimensions are NOT shown here */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">Cold Store 2D Spatial Layout</h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {onlineCount}/{devices.length} Nodes Active
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-0.5">
            Physical sensor node telemetry inside insulated storage vault. Direct-to-wall RS-485 link & ESP-NOW mesh.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric Selector */}
          <div className="flex items-center bg-vault-950 p-1 rounded-lg border border-vault-800 text-xs">
            <button
              onClick={() => setActiveMetric('temperature')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition ${
                activeMetric === 'temperature' ? 'bg-agri-600 text-white font-bold' : 'text-vault-400 hover:text-white'
              }`}
            >
              <Thermometer className="w-3 h-3" />
              <span>Temp</span>
            </button>
            <button
              onClick={() => setActiveMetric('humidity')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition ${
                activeMetric === 'humidity' ? 'bg-agri-600 text-white font-bold' : 'text-vault-400 hover:text-white'
              }`}
            >
              <Droplets className="w-3 h-3" />
              <span>Humidity</span>
            </button>
            <button
              onClick={() => setActiveMetric('co2')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition ${
                activeMetric === 'co2' ? 'bg-agri-600 text-white font-bold' : 'text-vault-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>CO2</span>
            </button>
            <button
              onClick={() => setActiveMetric('mq3')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition ${
                activeMetric === 'mq3' ? 'bg-agri-600 text-white font-bold' : 'text-vault-400 hover:text-white'
              }`}
            >
              <Wind className="w-3 h-3" />
              <span>MQ3</span>
            </button>
            <button
              onClick={() => setActiveMetric('mq135')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition ${
                activeMetric === 'mq135' ? 'bg-agri-600 text-white font-bold' : 'text-vault-400 hover:text-white'
              }`}
            >
              <Wind className="w-3 h-3" />
              <span>MQ135</span>
            </button>
          </div>

          {/* User dimension configuration trigger */}
          <button
            onClick={handleOpenDimensionModal}
            className="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-200 border border-vault-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm hover:border-agri-500/50"
            title="Configure cold store physical dimensions"
          >
            <Settings2 className="w-3.5 h-3.5 text-agri-400" />
            <span>Set Dimensions</span>
          </button>
        </div>
      </div>

      {/* Interactive Cold Store Floor Plan SVG (dimensions are completely hidden) */}
      <div className="relative bg-vault-950/80 rounded-xl border border-vault-800/80 p-3 overflow-x-auto flex justify-center">
        <svg
          viewBox={`0 0 ${mapWidth + wallPadding * 2} ${mapHeight + wallPadding * 2}`}
          className="w-full max-w-[960px] h-auto select-none"
        >
          <defs>
            {/* Insulated Wall Hatch Pattern */}
            <pattern id="insulatedWallPattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="12" height="12" fill="#1e293b" />
              <line x1="0" y1="0" x2="0" y2="12" stroke="#334155" strokeWidth="3" />
            </pattern>

            {/* Grid Pattern */}
            <pattern id="coldStoreGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>

          {/* Exterior Zone (Outside the Cold Store) */}
          <rect
            x="0"
            y="0"
            width={mapWidth + wallPadding * 2}
            height={mapHeight + wallPadding * 2}
            fill="#090d16"
          />

          {/* Outside Perimeter Label */}
          <text x={wallPadding + 10} y="22" fill="#64748b" fontSize="11" fontWeight="bold" letterSpacing="1">
            EXTERIOR AMBIENT PERIMETER (OUTSIDE COLD VAULT)
          </text>

          {/* Outer Gateway Box (Located Outside the Vault) */}
          <g transform={`translate(${wallPadding + 40}, 10)`}>
            <rect width="180" height="30" rx="6" fill="#0f172a" stroke="#0284c7" strokeWidth="1.5" />
            <circle cx="16" cy="15" r="4" fill="#38bdf8" />
            <text x="28" y="19" fill="#e0f2fe" fontSize="10" fontWeight="bold">
              OUTER GATEWAY (WAN)
            </text>
          </g>

          {/* Insulated Wall Thickness Border (e.g. 12" PIR Panel Insulation) */}
          <rect
            x={wallPadding - 12}
            y={wallPadding - 12}
            width={mapWidth + 24}
            height={mapHeight + 24}
            fill="url(#insulatedWallPattern)"
            stroke="#475569"
            strokeWidth="3"
            rx="12"
          />

          {/* Cold Store Interior Vault Chamber */}
          <rect
            x={wallPadding}
            y={wallPadding}
            width={mapWidth}
            height={mapHeight}
            fill="#0f172a"
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeDasharray="4 2"
            rx="6"
          />

          {/* Floor Grid */}
          <rect
            x={wallPadding}
            y={wallPadding}
            width={mapWidth}
            height={mapHeight}
            fill="url(#coldStoreGrid)"
          />

          {/* RS-485 Wall Penetration Conduit Line */}
          <path
            d={`M ${wallPadding + 130} 40 L ${wallPadding + 130} ${wallPadding + 25}`}
            stroke="#f59e0b"
            strokeWidth="3.5"
            strokeDasharray="3 2"
          />
          <text
            x={wallPadding + 140}
            y={wallPadding + 15}
            fill="#fbbf24"
            fontSize="9"
            fontWeight="bold"
            fontFamily="monospace"
          >
            RS-485 WALL PENETRATION CONDUIT
          </text>

          {/* Inner Gateway Box (Inside Vault) */}
          <g transform={`translate(${wallPadding + 50}, ${wallPadding + 25})`}>
            <rect width="190" height="34" rx="6" fill="#132338" stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="16" cy="17" r="5" fill="#10b981" />
            <text x="28" y="21" fill="#ecfdf5" fontSize="10" fontWeight="bold">
              INNER GATEWAY (VAULT HUB)
            </text>
            {/* Wireless RF Waves Icon */}
            <path
              d="M 160 12 A 8 8 0 0 1 160 22 M 165 8 A 14 14 0 0 1 165 26"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.5"
            />
          </g>

          {/* Zone Dividers Inside Cold Store */}
          {/* North Zone */}
          <rect
            x={wallPadding + 20}
            y={wallPadding + 75}
            width={mapWidth * 0.45}
            height={Math.max(90, mapHeight - 105)}
            fill="#1e293b"
            fillOpacity="0.25"
            stroke="#334155"
            strokeDasharray="4 4"
            rx="8"
          />
          <text x={wallPadding + 35} y={wallPadding + 95} fill="#94a3b8" fontSize="11" fontWeight="bold">
            NORTH ZONE (Potato Racks 1-3)
          </text>

          {/* South Zone */}
          <rect
            x={wallPadding + mapWidth * 0.50}
            y={wallPadding + 75}
            width={mapWidth * 0.45}
            height={Math.max(90, mapHeight - 105)}
            fill="#1e293b"
            fillOpacity="0.25"
            stroke="#334155"
            strokeDasharray="4 4"
            rx="8"
          />
          <text x={wallPadding + mapWidth * 0.50 + 15} y={wallPadding + 95} fill="#94a3b8" fontSize="11" fontWeight="bold">
            SOUTH ZONE (Fruit CA Racks 4-6)
          </text>

          {/* Node Wireless Links to Inner Gateway */}
          {devices.map((d) => {
            const { px, py } = getDeviceCoords(d);
            const igX = wallPadding + 145;
            const igY = wallPadding + 42;

            return (
              <line
                key={`link-${d.id}`}
                x1={igX}
                y1={igY}
                x2={px}
                y2={py}
                stroke={d.is_online === 1 ? '#0284c7' : '#475569'}
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity={d.is_online === 1 ? '0.4' : '0.2'}
              />
            );
          })}

          {/* Sensor Nodes on the Map */}
          {devices.map((d) => {
            const { px, py } = getDeviceCoords(d);
            const metricData = getNodeValue(d, activeMetric);
            const isSelected = selectedNode?.id === d.id;
            const isPending = d.registration_status === 'pending';

            return (
              <g
                key={`node-${d.id}`}
                transform={`translate(${px}, ${py})`}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedNode(d);
                }}
              >
                {/* Ping animation if online */}
                {d.is_online === 1 && (
                  <circle r="16" fill={metricData.color} fillOpacity="0.15" className="animate-ping" />
                )}

                {/* Node Outer Circle */}
                <circle
                  r={isSelected ? '14' : '11'}
                  fill="#0b1329"
                  stroke={isSelected ? '#38bdf8' : isPending ? '#f59e0b' : metricData.color}
                  strokeWidth={isSelected ? '3' : '2'}
                />

                {/* Center dot */}
                <circle r="4" fill={d.is_online === 1 ? metricData.color : '#64748b'} />

                {/* Node Label Badge */}
                <g transform="translate(14, -10)">
                  <rect
                    width="85"
                    height="24"
                    rx="4"
                    fill="#020617"
                    fillOpacity="0.9"
                    stroke={isSelected ? '#38bdf8' : '#334155'}
                    strokeWidth="1"
                  />
                  <text x="6" y="11" fill="#f8fafc" fontSize="9" fontWeight="bold">
                    {d.device_code || d.id}
                  </text>
                  <text x="6" y="20" fill={metricData.color} fontSize="8" fontWeight="bold">
                    {metricData.text}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Clean Facility Identification (Zero dimension measurements displayed) */}
          <text
            x={wallPadding + mapWidth - 190}
            y={wallPadding + mapHeight - 15}
            fill="#475569"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {facility?.name || 'Cold Storage Chamber Layout'}
          </text>
        </svg>
      </div>

      {/* Selected Node Quick Inspector */}
      {selectedNode && (
        <div className="bg-vault-950 border border-vault-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-agri-500/20 text-agri-400 border border-agri-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">{selectedNode.user_name || selectedNode.id}</h4>
                <span className="font-mono text-xs text-agri-400 font-bold">({selectedNode.device_code || selectedNode.id})</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedNode.is_online === 1
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {selectedNode.is_online === 1 ? 'ONLINE' : 'OFFLINE'}
                </span>
                {selectedNode.is_simulated === 1 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                    SIMULATED
                  </span>
                )}
              </div>
              <p className="text-xs text-vault-400 mt-0.5 flex flex-wrap gap-2">
                <span>MAC: <code className="text-vault-300">{selectedNode.hardware_id || selectedNode.mac_address || '--'}</code></span>
                <span>•</span>
                <span>Location: {selectedNode.cold_store_name || 'Cold Store A'} / {selectedNode.zone_name || 'North Zone'} / {selectedNode.rack_name || 'Rack 1'} ({selectedNode.level_name || 'Level 1'})</span>
                <span>•</span>
                <span>RSSI: {typeof selectedNode.signal_rssi === 'number' ? `${selectedNode.signal_rssi} dBm` : '-65 dBm'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 text-xs flex-wrap">
              {selectedNode.sensors?.map((s) => {
                const reading = typeof s.calibrated_reading === 'number' && !isNaN(s.calibrated_reading)
                  ? s.calibrated_reading.toFixed(1)
                  : typeof s.raw_reading === 'number' && !isNaN(s.raw_reading)
                    ? s.raw_reading.toFixed(1)
                    : '--';
                return (
                  <div key={s.id} className="bg-vault-900 px-2.5 py-1 rounded border border-vault-800">
                    <span className="text-[10px] text-vault-400 block uppercase font-mono">{s.sensor_type}</span>
                    <span className="font-bold text-white font-mono">
                      {reading} {s.unit || ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {onSelectDevice && (
              <button
                onClick={() => onSelectDevice(selectedNode.id)}
                className="px-2.5 py-1.5 rounded-lg bg-agri-600/30 hover:bg-agri-600 text-agri-300 hover:text-white border border-agri-500/40 text-xs font-semibold flex items-center gap-1 transition"
                title="Open node configuration and placement modal"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Configure Node</span>
              </button>
            )}

            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded text-vault-400 hover:text-white"
              title="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* User-Controlled Dimension Configuration Modal */}
      {showDimensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-vault-800 mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-agri-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Set Cold Store Dimensions</h3>
                  <p className="text-xs text-vault-400">Configure chamber geometry for floorplan layout & positioning</p>
                </div>
              </div>
              <button
                onClick={() => setShowDimensionModal(false)}
                className="text-vault-400 hover:text-white p-1 rounded-lg hover:bg-vault-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dimension Presets */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-vault-400 mb-1.5">Quick Presets</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(80, 50, 24, editUnit)}
                  className="px-2 py-1.5 rounded-lg bg-vault-950 hover:bg-vault-800 border border-vault-800 text-[11px] text-vault-300 hover:text-white transition text-center"
                >
                  <span className="font-semibold block">Small Room</span>
                  <span className="text-[10px] text-vault-500 font-mono">80×50×24</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(162, 94, 48, editUnit)}
                  className="px-2 py-1.5 rounded-lg bg-vault-950 hover:bg-vault-800 border border-vault-800 text-[11px] text-vault-300 hover:text-white transition text-center"
                >
                  <span className="font-semibold block">Standard Vault</span>
                  <span className="text-[10px] text-vault-500 font-mono">162×94×48</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(300, 160, 60, editUnit)}
                  className="px-2 py-1.5 rounded-lg bg-vault-950 hover:bg-vault-800 border border-vault-800 text-[11px] text-vault-300 hover:text-white transition text-center"
                >
                  <span className="font-semibold block">Mega Warehouse</span>
                  <span className="text-[10px] text-vault-500 font-mono">300×160×60</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDimensions} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">
                    Length ({editUnit})
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    step="1"
                    value={editLength}
                    onChange={(e) => setEditLength(Math.max(1, Number(e.target.value)))}
                    required
                    className="w-full bg-vault-950 border border-vault-800 focus:border-agri-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">
                    Width ({editUnit})
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    step="1"
                    value={editWidth}
                    onChange={(e) => setEditWidth(Math.max(1, Number(e.target.value)))}
                    required
                    className="w-full bg-vault-950 border border-vault-800 focus:border-agri-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-vault-300 mb-1">
                    Height ({editUnit})
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    step="1"
                    value={editHeight}
                    onChange={(e) => setEditHeight(Math.max(1, Number(e.target.value)))}
                    required
                    className="w-full bg-vault-950 border border-vault-800 focus:border-agri-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-vault-300 mb-1">
                  Measurement Unit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditUnit('ft')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                      editUnit === 'ft'
                        ? 'bg-agri-600 text-white border-agri-500'
                        : 'bg-vault-950 text-vault-400 border-vault-800 hover:text-white'
                    }`}
                  >
                    Feet (ft)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditUnit('m')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                      editUnit === 'm'
                        ? 'bg-agri-600 text-white border-agri-500'
                        : 'bg-vault-950 text-vault-400 border-vault-800 hover:text-white'
                    }`}
                  >
                    Meters (m)
                  </button>
                </div>
              </div>

              {saveStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    saveStatus.type === 'success'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {saveStatus.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{saveStatus.message}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDimensionModal(false)}
                  className="px-4 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDim}
                  className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-agri-600/30"
                >
                  {isSavingDim ? 'Saving...' : 'Save Dimensions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
