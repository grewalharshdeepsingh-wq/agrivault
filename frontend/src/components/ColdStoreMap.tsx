import React, { useState } from 'react';
import { ESPDevice, Facility } from '../types';
import { api } from '../api/client';
import {
  Maximize2,
  Minimize2,
  Sliders,
  Settings2,
  Cpu,
  Cable,
  Globe,
  Radio,
  Thermometer,
  Droplets,
  Wind,
  Info,
  Check,
  X
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
  const [activeMetric, setActiveMetric] = useState<'temperature' | 'humidity' | 'mq3' | 'mq135' | 'status'>('temperature');
  const [selectedNode, setSelectedNode] = useState<ESPDevice | null>(null);
  const [showDimensionModal, setShowDimensionModal] = useState(false);

  // Facility dimensions (default: 162 ft x 94 ft x 48 ft)
  const lengthFt = facility?.length_ft || 162;
  const widthFt = facility?.width_ft || 94;
  const heightFt = facility?.height_ft || 48;
  const unit = facility?.dimensions_unit || 'ft';

  // Dimension edit state
  const [editLength, setEditLength] = useState(lengthFt);
  const [editWidth, setEditWidth] = useState(widthFt);
  const [editHeight, setEditHeight] = useState(heightFt);
  const [isSavingDim, setIsSavingDim] = useState(false);

  const handleSaveDimensions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility) return;
    setIsSavingDim(true);
    try {
      await api.updateFacility(facility.id, {
        length_ft: editLength,
        width_ft: editWidth,
        height_ft: editHeight
      });
      setShowDimensionModal(false);
      if (onRefreshFacility) onRefreshFacility();
    } catch (err: any) {
      alert(`Failed to save dimensions: ${err.message}`);
    } finally {
      setIsSavingDim(false);
    }
  };

  // Helper to extract sensor value for a device
  const getNodeValue = (device: ESPDevice, metric: string): { val: number | null; text: string; color: string } => {
    const s = device.sensors?.find((x) => x.sensor_type === metric);
    if (!s || device.is_online === 0) {
      return { val: null, text: device.is_online === 0 ? 'OFF' : '--', color: '#64748b' };
    }
    const v = s.calibrated_reading;
    if (metric === 'temperature') {
      const col = v < 2 ? '#38bdf8' : v <= 4.5 ? '#10b981' : v <= 6 ? '#f59e0b' : '#ef4444';
      return { val: v, text: `${v.toFixed(1)}°C`, color: col };
    }
    if (metric === 'humidity') {
      const col = v < 80 ? '#f59e0b' : v <= 95 ? '#06b6d4' : '#6366f1';
      return { val: v, text: `${Math.round(v)}%`, color: col };
    }
    if (metric === 'mq3') {
      const col = v < 1.0 ? '#10b981' : v < 2.0 ? '#f59e0b' : '#ef4444';
      return { val: v, text: `${v.toFixed(2)} ppm`, color: col };
    }
    if (metric === 'mq135') {
      const col = v < 30 ? '#10b981' : v < 60 ? '#f59e0b' : '#ef4444';
      return { val: v, text: `${v.toFixed(1)} ppm`, color: col };
    }
    return { val: v, text: `${v}`, color: '#10b981' };
  };

  // Canvas scaling: 1000px length representation
  const mapWidth = 920;
  const mapHeight = Math.round((widthFt / lengthFt) * mapWidth);
  const wallPadding = 45;

  return (
    <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Map Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">Cold Store 2D Spatial Layout</h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-vault-800 text-vault-300 border border-vault-700">
              {lengthFt} × {widthFt} × {heightFt} {unit}
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-0.5">
            Physical sensor node placement inside insulated storage vault. Direct-to-wall RS-485 link & ESP-NOW mesh.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setShowDimensionModal(true)}
            className="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-200 border border-vault-700 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Dimensions</span>
          </button>
        </div>
      </div>

      {/* Interactive Cold Store Floor Plan SVG */}
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
            height={mapHeight - 95}
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
            height={mapHeight - 95}
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
            const px = wallPadding + (Math.min(Math.max(d.pos_x ?? 30, 5), lengthFt - 5) / lengthFt) * mapWidth;
            const py = wallPadding + (Math.min(Math.max(d.pos_y ?? 30, 5), widthFt - 5) / widthFt) * mapHeight;
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
            const px = wallPadding + (Math.min(Math.max(d.pos_x ?? 30, 5), lengthFt - 5) / lengthFt) * mapWidth;
            const py = wallPadding + (Math.min(Math.max(d.pos_y ?? 30, 5), widthFt - 5) / widthFt) * mapHeight;
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
                  if (onSelectDevice) onSelectDevice(d.id);
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

          {/* Map Dimensions Watermark */}
          <text
            x={wallPadding + mapWidth - 160}
            y={wallPadding + mapHeight - 15}
            fill="#475569"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            Vault: {lengthFt}L × {widthFt}W × {heightFt}H ({unit})
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
                <span>MAC: <code className="text-vault-300">{selectedNode.hardware_id || selectedNode.mac_address}</code></span>
                <span>•</span>
                <span>Location: {selectedNode.cold_store_name || 'Cold Store A'} / {selectedNode.zone_name || 'North Zone'} / {selectedNode.rack_name || 'Rack 1'} ({selectedNode.level_name || 'Level 1'})</span>
                <span>•</span>
                <span>RSSI: {selectedNode.signal_rssi} dBm</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2 text-xs">
              {selectedNode.sensors?.map((s) => (
                <div key={s.id} className="bg-vault-900 px-2 py-1 rounded border border-vault-800">
                  <span className="text-[10px] text-vault-400 block uppercase">{s.sensor_type}</span>
                  <span className="font-bold text-white font-mono">
                    {s.calibrated_reading.toFixed(1)} {s.unit}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded text-vault-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Dimensions Modal */}
      {showDimensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-vault-900 border border-vault-750 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-vault-800 mb-4">
              <h3 className="text-base font-bold text-white">Configure Cold Store Dimensions</h3>
              <button onClick={() => setShowDimensionModal(false)} className="text-vault-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDimensions} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-vault-300 mb-1">
                  Length ({unit})
                </label>
                <input
                  type="number"
                  min="20"
                  max="1000"
                  value={editLength}
                  onChange={(e) => setEditLength(Number(e.target.value))}
                  required
                  className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-vault-300 mb-1">
                  Width ({unit})
                </label>
                <input
                  type="number"
                  min="20"
                  max="1000"
                  value={editWidth}
                  onChange={(e) => setEditWidth(Number(e.target.value))}
                  required
                  className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-vault-300 mb-1">
                  Height ({unit})
                </label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={editHeight}
                  onChange={(e) => setEditHeight(Number(e.target.value))}
                  required
                  className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDimensionModal(false)}
                  className="px-4 py-2 rounded-lg bg-vault-800 text-vault-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDim}
                  className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  Save Dimensions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
