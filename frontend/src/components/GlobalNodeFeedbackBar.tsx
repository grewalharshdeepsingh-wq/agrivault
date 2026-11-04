import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Wind,
  ShieldAlert,
  Send,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
  Sliders,
  RotateCcw,
  Target,
  Layers,
  Thermometer,
  Droplets,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

interface GlobalNodeFeedbackBarProps {
  onNavigateToAutonomousMind?: () => void;
  defaultNodeId?: string;
}

export const GlobalNodeFeedbackBar: React.FC<GlobalNodeFeedbackBarProps> = ({
  onNavigateToAutonomousMind,
  defaultNodeId
}) => {
  const { discoveredDevices, areas, overview } = useApp();

  // State
  const [selectedNodeId, setSelectedNodeId] = useState<string>(defaultNodeId || 'ALL_NODES');
  const [spoilageType, setSpoilageType] = useState<string>('bacterial_soft_rot');
  const [severity, setSeverity] = useState<number>(0.85);
  const [windEnabled, setWindEnabled] = useState<boolean>(true);
  const [windSpeed, setWindSpeed] = useState<number>(1.2);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [adaptationResult, setAdaptationResult] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [customX, setCustomX] = useState<number>(4.0);
  const [customY, setCustomY] = useState<number>(3.0);
  const [customZ, setCustomZ] = useState<number>(1.5);
  const [notes, setNotes] = useState<string>('');

  // Fetch initial adaptation state
  useEffect(() => {
    api.getAutonomousMindState()
      .then((res) => {
        if (res.success && res.state) {
          setAdaptationResult(res.state);
          setWindEnabled(res.state.windConfig?.enabled ?? true);
          setWindSpeed(res.state.windConfig?.speed ?? 1.2);
        }
      })
      .catch(() => {});
  }, []);

  // When a specific node is chosen, auto-populate its coordinates
  useEffect(() => {
    if (selectedNodeId !== 'ALL_NODES') {
      const dev = discoveredDevices.find((d) => d.id === selectedNodeId);
      if (dev) {
        if (dev.pos_x !== undefined) setCustomX(dev.pos_x);
        if (dev.pos_y !== undefined) setCustomY(dev.pos_y);
        if (dev.pos_z !== undefined) setCustomZ(dev.pos_z);
      }
    } else {
      setCustomX(4.0);
      setCustomY(3.0);
      setCustomZ(1.5);
    }
  }, [selectedNodeId, discoveredDevices]);

  // Submit Feedback
  const handleSubmitFeedback = async () => {
    setIsSubmitting(true);
    try {
      const targetDev = discoveredDevices.find((d) => d.id === selectedNodeId);
      const res = await api.submitSpoilageFeedback({
        facilityId: overview?.facility?.id || 'fac-01',
        areaId: targetDev?.area_id || undefined,
        x: customX,
        y: customY,
        z: customZ,
        spoilageType,
        severity,
        commodity: 'Potato',
        notes: notes || `Feedback submitted for ${selectedNodeId === 'ALL_NODES' ? 'all nodes' : selectedNodeId}`,
        reportedBy: 'Facility Quality Inspector'
      });

      if (res.success) {
        setAdaptationResult(res.adjustmentState);
      }
    } catch (err: any) {
      console.error('Failed to submit spoilage feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pathologies = [
    { id: 'bacterial_soft_rot', label: 'Bacterial Soft Rot', icon: '🦠', color: 'text-rose-400' },
    { id: 'fungal_decay', label: 'Fungal Mold / Rot', icon: '🍄', color: 'text-amber-400' },
    { id: 'anaerobic_fermentation', label: 'Anaerobic Breakdown', icon: '⚠️', color: 'text-orange-400' },
    { id: 'sprouting', label: 'Sprouting / Ripening', icon: '🌱', color: 'text-emerald-400' },
    { id: 'chilling_injury', label: 'Chilling Injury', icon: '❄️', color: 'text-cyan-400' }
  ];

  const severityLevels = [
    { label: 'Low 25%', value: 0.25 },
    { label: 'Moderate 50%', value: 0.50 },
    { label: 'Severe 75%', value: 0.75 },
    { label: 'Critical 90%', value: 0.90 }
  ];

  return (
    <div className="bg-gradient-to-r from-vault-900 via-vault-950 to-vault-900 border-2 border-emerald-500/40 rounded-2xl p-4 lg:p-5 shadow-2xl relative overflow-hidden transition-all">
      {/* Background Glow */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/40 text-emerald-400 shrink-0">
            <BrainCircuit className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm lg:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                Ground-Truth Spoilage & Microclimate Feedback Bar
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-bold tracking-wider">
                  ALL NODES
                </span>
              </h2>
            </div>
            <p className="text-xs text-vault-300">
              Provide real-time ground-truth conditions to train the vault's mind. Values and relay rules auto-adjust across all nodes immediately.
            </p>
          </div>
        </div>

        {/* Local GPU Status & 3D Mind Studio Link */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-vault-900/90 border border-vault-700/80 text-[11px] font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>NVIDIA RTX 4050 GPU (CUDA)</span>
          </div>
          {onNavigateToAutonomousMind && (
            <button
              onClick={onNavigateToAutonomousMind}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 transition"
            >
              <span>3D Mind Studio</span>
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 relative z-10">
        {/* Node Target Selector */}
        <div className="md:col-span-3">
          <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider block mb-1">
            Target Sensor Nodes
          </label>
          <div className="relative">
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full bg-vault-900/90 border border-vault-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL_NODES">🌐 ALL NODES (Facility-Wide Broadcast)</option>
              {discoveredDevices.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  📍 {dev.user_name || dev.id} ({dev.rack_name || dev.zone_name || 'Active Node'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pathology / Decay Type */}
        <div className="md:col-span-4">
          <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider block mb-1">
            Reported Spoilage Condition
          </label>
          <select
            value={spoilageType}
            onChange={(e) => setSpoilageType(e.target.value)}
            className="w-full bg-vault-900/90 border border-vault-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
          >
            {pathologies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Quick Buttons */}
        <div className="md:col-span-3">
          <label className="text-[10px] font-bold text-vault-400 uppercase tracking-wider block mb-1">
            Severity: <span className="text-rose-400 font-mono font-bold">{Math.round(severity * 100)}%</span>
          </label>
          <div className="grid grid-cols-4 gap-1">
            {severityLevels.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => setSeverity(lvl.value)}
                className={`py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                  severity === lvl.value
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-vault-900/80 text-vault-400 border-vault-700 hover:bg-vault-850'
                }`}
              >
                {lvl.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Big Submit Button */}
        <div className="md:col-span-2 flex items-end">
          <button
            onClick={handleSubmitFeedback}
            disabled={isSubmitting}
            className="w-full h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-slate-950" />
                <span>Adapt Nodes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional Wind Flow & Coordinates Bar */}
      <div className="mt-3 pt-3 border-t border-vault-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Wind Flow Control */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-vault-400 font-semibold uppercase flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-sky-400" />
              Wind Flow (Optional):
            </span>
            <button
              onClick={() => setWindEnabled(!windEnabled)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                windEnabled
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-vault-800 text-vault-400 border-vault-700'
              }`}
            >
              {windEnabled ? 'ON (1.2 m/s)' : 'OFF'}
            </button>
          </div>

          {/* Current Adaptations Display */}
          {adaptationResult && (
            <div className="flex items-center gap-2 font-mono text-[11px] bg-vault-950/80 px-2.5 py-1 rounded-lg border border-vault-800">
              <span className="text-vault-400">Mind Delta:</span>
              <span className="text-sky-300 font-bold flex items-center gap-0.5">
                <Thermometer className="w-3 h-3 text-sky-400" />
                {adaptationResult.coolingSetpointDelta || '-1.08°C'}
              </span>
              <span className="text-vault-600">•</span>
              <span className="text-cyan-300 font-bold flex items-center gap-0.5">
                <Droplets className="w-3 h-3 text-cyan-400" />
                {adaptationResult.humiditySetpointDelta || '-4.95%'}
              </span>
              <span className="text-vault-600">•</span>
              <span className="text-amber-300 font-bold">
                CO2 {adaptationResult.co2TighteningMargin || '-270 ppm'}
              </span>
            </div>
          )}
        </div>

        {/* Expand Advanced Coordinates Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-vault-400 hover:text-slate-200 text-[11px] flex items-center gap-1 transition"
        >
          <span>{isExpanded ? 'Hide Coordinates' : 'Edit 3D Coordinates & Notes'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable 3D Coordinates Drawer */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-vault-800 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs animate-in fade-in duration-150">
          <div>
            <label className="text-[10px] text-vault-400 uppercase font-semibold">X Position (m)</label>
            <input
              type="number"
              step="0.5"
              value={customX}
              onChange={(e) => setCustomX(parseFloat(e.target.value) || 0)}
              className="w-full mt-0.5 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-vault-400 uppercase font-semibold">Y Position (m)</label>
            <input
              type="number"
              step="0.5"
              value={customY}
              onChange={(e) => setCustomY(parseFloat(e.target.value) || 0)}
              className="w-full mt-0.5 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-vault-400 uppercase font-semibold">Z Height (m)</label>
            <input
              type="number"
              step="0.5"
              value={customZ}
              onChange={(e) => setCustomZ(parseFloat(e.target.value) || 1.5)}
              className="w-full mt-0.5 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-vault-400 uppercase font-semibold">Field Observation Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mold odor at bottom pallet..."
              className="w-full mt-0.5 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1 text-xs text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
