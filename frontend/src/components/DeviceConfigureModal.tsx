import React, { useState, useEffect } from 'react';
import { ESPDevice, Area } from '../types';
import { api } from '../api/client';
import {
  X,
  Check,
  Cpu,
  Layers,
  MapPin,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface DeviceConfigureModalProps {
  device: ESPDevice | null;
  areas: Area[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const DeviceConfigureModal: React.FC<DeviceConfigureModalProps> = ({
  device,
  areas,
  isOpen,
  onClose,
  onSaved
}) => {
  const [deviceCode, setDeviceCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [coldStoreName, setColdStoreName] = useState('Cold Store A');
  const [zoneName, setZoneName] = useState('North Zone');
  const [areaId, setAreaId] = useState('');
  const [rackName, setRackName] = useState('Rack 1');
  const [levelName, setLevelName] = useState('Level 2');
  const [posX, setPosX] = useState(30);
  const [posY, setPosY] = useState(30);
  const [posZ, setPosZ] = useState(4);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (device) {
      setDeviceCode(device.device_code || device.id);
      setDisplayName(device.user_name || `ESP Node ${device.id}`);
      setColdStoreName(device.cold_store_name || 'Cold Store A');
      setZoneName(device.zone_name || 'North Zone');
      setAreaId(device.area_id || (areas.length > 0 ? areas[0].id : ''));
      setRackName(device.rack_name || 'Rack 1');
      setLevelName(device.level_name || 'Level 2');
      setPosX(device.pos_x ?? 30);
      setPosY(device.pos_y ?? 30);
      setPosZ(device.pos_z ?? 4);
    }
  }, [device, areas]);

  if (!isOpen || !device) return null;

  const isPending = device.registration_status === 'pending' || (device.is_discovered === 1 && !device.area_id);

  const handleApproveOrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isPending) {
        await api.approveDevice(device.id, {
          deviceCode,
          userName: displayName,
          coldStoreName,
          zoneName,
          areaId: areaId || null,
          rackName,
          levelName,
          posX,
          posY,
          posZ,
          description
        });
      } else {
        await api.updateDevice(device.id, {
          deviceCode,
          userName: displayName,
          coldStoreName,
          zoneName,
          areaId: areaId || null,
          rackName,
          levelName,
          posX,
          posY,
          posZ,
          description,
          isDiscovered: areaId ? 0 : 1
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm(`Reject registration for ${device.id}? This device will not be allowed to stream into active zones.`)) return;
    setIsSubmitting(true);
    try {
      await api.rejectDevice(device.id);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm(`Revoke and deactivate ${device.user_name} (${device.id})?`)) return;
    setIsSubmitting(true);
    try {
      await api.revokeDevice(device.id);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Revoke failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-vault-900 border border-vault-750 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-vault-800 flex items-center justify-between bg-vault-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isPending ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-agri-500/20 border-agri-500/40 text-agri-300'}`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isPending ? 'Configure & Approve New ESP32 Node' : 'Edit ESP Node Configuration'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${isPending ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {isPending ? 'Pending Registration' : 'Active Hardware'}
                </span>
              </div>
              <p className="text-xs text-vault-400 mt-0.5 flex items-center gap-2">
                <span>Hardware MAC: <code className="text-agri-400 font-mono">{device.hardware_id || device.mac_address || '24:0A:C4:XX:XX'}</code></span>
                <span>•</span>
                <span>Protocol: <code className="text-cyan-400 font-mono">{device.connection_protocol || 'ESP-NOW'}</code></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-vault-400 hover:text-white p-1.5 rounded-lg hover:bg-vault-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleApproveOrSave} className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device ID (Stable) */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Permanent Device ID
              </label>
              <input
                type="text"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value)}
                placeholder="e.g. AGR-ESP-012"
                required
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-agri-500 transition"
              />
              <span className="text-[10px] text-vault-400">Stable identifier linked to historical database records.</span>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. North Rack 4 - Level 3"
                required
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-agri-500 transition"
              />
              <span className="text-[10px] text-vault-400">Human-readable operational name for staff.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-vault-800/80">
            {/* Cold Store / Vault */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Facility / Cold Store
              </label>
              <input
                type="text"
                value={coldStoreName}
                onChange={(e) => setColdStoreName(e.target.value)}
                placeholder="Cold Store A"
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-agri-500 transition"
              />
            </div>

            {/* Zone */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Zone
              </label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="e.g. North Zone"
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-agri-500 transition"
              />
            </div>

            {/* Assigned Room / Area */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Monitored Area / Room
              </label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-agri-500 transition"
              >
                <option value="">-- Unassigned (Standby Fleet) --</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.commodity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Rack */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Rack
              </label>
              <input
                type="text"
                value={rackName}
                onChange={(e) => setRackName(e.target.value)}
                placeholder="e.g. Rack 4"
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-agri-500 transition"
              />
            </div>

            {/* Height / Level */}
            <div>
              <label className="block text-xs font-semibold text-vault-300 mb-1">
                Height / Stacking Level
              </label>
              <input
                type="text"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                placeholder="e.g. Level 3 (Top)"
                className="w-full bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-agri-500 transition"
              />
            </div>
          </div>

          {/* Coordinates in Facility */}
          <div className="bg-vault-950/70 border border-vault-800 rounded-xl p-3">
            <span className="text-xs font-semibold text-vault-300 flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-agri-400" />
              Physical Floor Position Inside Cold Store (Feet)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-vault-400 block mb-0.5">X Coordinate (Length ft)</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={posX}
                  onChange={(e) => setPosX(Number(e.target.value))}
                  className="w-full bg-vault-900 border border-vault-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-vault-400 block mb-0.5">Y Coordinate (Width ft)</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={posY}
                  onChange={(e) => setPosY(Number(e.target.value))}
                  className="w-full bg-vault-900 border border-vault-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-vault-400 block mb-0.5">Z Height (Vertical ft)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={posZ}
                  onChange={(e) => setPosZ(Number(e.target.value))}
                  className="w-full bg-vault-900 border border-vault-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Note on Location Changes */}
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200">
            <strong>Hardware Integrity Assurance:</strong> Moving this node to another zone, rack, or level will update its current assignment immediately, while all historical sensor logs stay permanently linked to hardware MAC <code className="font-mono text-white">{device.hardware_id || device.mac_address}</code>.
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-vault-800 flex items-center justify-between">
            <div>
              {isPending ? (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
                >
                  Reject Device
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-rose-950 text-vault-400 hover:text-rose-300 text-xs font-medium transition"
                >
                  Revoke Device
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-agri-600/30 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isPending ? 'Approve & Activate Node' : 'Save Configuration'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
