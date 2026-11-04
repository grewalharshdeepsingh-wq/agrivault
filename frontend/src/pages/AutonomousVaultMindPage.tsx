import React, { useState, useEffect, useMemo } from 'react';
import {
  BrainCircuit,
  Wind,
  Flame,
  AlertTriangle,
  Cpu,
  Zap,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Send,
  RotateCcw,
  Compass,
  ArrowRight,
  Target,
  Sparkles,
  Info,
  Layers,
  Thermometer,
  Droplets,
  Gauge
} from 'lucide-react';
import { api } from '../api/client';

export const AutonomousVaultMindPage: React.FC = () => {
  // Autonomous Mind Configuration State
  const [isAutonomousActive, setIsAutonomousActive] = useState<boolean>(true);
  const [windEnabled, setWindEnabled] = useState<boolean>(true);
  const [windSpeed, setWindSpeed] = useState<number>(1.2);
  const [windDirectionDegrees, setWindDirectionDegrees] = useState<number>(0); // 0 = N to S (+y)

  // Raw Spoilage Feedback Form
  const [spoilageX, setSpoilageX] = useState<number>(4.0);
  const [spoilageY, setSpoilageY] = useState<number>(3.0);
  const [spoilageZ, setSpoilageZ] = useState<number>(1.5);
  const [spoilageType, setSpoilageType] = useState<string>('bacterial_soft_rot');
  const [severity, setSeverity] = useState<number>(0.85);
  const [commodity, setCommodity] = useState<string>('Potato');
  const [notes, setNotes] = useState<string>('Found wet rotting tuber bags in center lower pallet.');

  // Live Engine State & GPU Results
  const [mindState, setMindState] = useState<any>(null);
  const [gpuResult, setGpuResult] = useState<any>(null);
  const [isGpuComputing, setIsGpuComputing] = useState<boolean>(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string | null>(null);

  // Vault Dimensions
  const roomLength = 15.0; // meters (X axis)
  const roomWidth = 10.0;  // meters (Y axis)

  // Fetch initial state
  const fetchMindState = async () => {
    try {
      const res = await api.getAutonomousMindState();
      if (res.success && res.state) {
        setMindState(res.state);
        setIsAutonomousActive(res.state.isAutonomousActive);
        setWindEnabled(res.state.windConfig?.enabled ?? true);
        setWindSpeed(res.state.windConfig?.speed ?? 1.2);
        setWindDirectionDegrees(res.state.windConfig?.directionDegrees ?? 0);
        if (res.state.lastGpuResult) {
          setGpuResult(res.state.lastGpuResult);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch autonomous mind state:', e);
    }
  };

  useEffect(() => {
    fetchMindState();
  }, []);

  // Submit Spoilage Feedback
  const handleSubmitFeedback = async () => {
    setIsGpuComputing(true);
    setFeedbackSuccessMsg(null);
    try {
      const res = await api.submitSpoilageFeedback({
        x: spoilageX,
        y: spoilageY,
        z: spoilageZ,
        spoilageType,
        severity,
        commodity,
        notes,
        reportedBy: 'Facility Quality Inspector'
      });

      if (res.success) {
        setMindState(res.adjustmentState);
        setGpuResult(res.gpuResult);
        setFeedbackSuccessMsg(
          `⚡ Spoilage feedback ingested! The system's mind adapted setpoints: Cooling ${res.adjustmentState.coolingSetpointDelta}, RH ${res.adjustmentState.humiditySetpointDelta}`
        );
      }
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsGpuComputing(false);
    }
  };

  // Run GPU simulation directly
  const handleTriggerGpuSimulation = async () => {
    setIsGpuComputing(true);
    try {
      const res = await api.runGpuSimulation({
        length: roomLength,
        width: roomWidth,
        height: 5.0,
        spoilageX,
        spoilageY,
        spoilageZ,
        spoilageType,
        severity,
        windEnabled,
        windSpeed,
        windDirectionDeg: windDirectionDegrees,
        steps: 250
      });

      if (res.success && res.simulation) {
        setGpuResult(res.simulation);
        // Also update local mind state adjustments
        if (mindState) {
          setMindState({
            ...mindState,
            coolingSetpointDelta: res.simulation.autonomousAdjustments?.coolingSetpointDelta,
            humiditySetpointDelta: res.simulation.autonomousAdjustments?.humiditySetpointDelta,
            co2TighteningMargin: res.simulation.autonomousAdjustments?.co2TighteningMargin,
            emergencyPurgeCycleSec: res.simulation.autonomousAdjustments?.emergencyPurgeCycleSec,
            fanModulationRule: res.simulation.autonomousAdjustments?.fanModulationRule,
            rationale: res.simulation.autonomousAdjustments?.rationale,
            downwindRacksAtRisk: res.simulation.rackRiskMatrix || []
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to run GPU simulation:', err);
    } finally {
      setIsGpuComputing(false);
    }
  };

  // Toggle Wind or Autonomous Mode
  const handleConfigChange = async (updates: {
    isAutonomousActive?: boolean;
    windEnabled?: boolean;
    windSpeed?: number;
    windDirectionDegrees?: number;
  }) => {
    try {
      const res = await api.configureAutonomousMind(updates);
      if (res.success && res.state) {
        setMindState(res.state);
        if (res.state.lastGpuResult) setGpuResult(res.state.lastGpuResult);
      }
    } catch (e) {
      console.warn('Config change error:', e);
    }
  };

  // Floorplan click handler to select spoilage location
  const handleFloorplanClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaledX = Math.round((clickX / rect.width) * roomLength * 10) / 10;
    const scaledY = Math.round((clickY / rect.height) * roomWidth * 10) / 10;

    setSpoilageX(Math.max(0.5, Math.min(roomLength - 0.5, scaledX)));
    setSpoilageY(Math.max(0.5, Math.min(roomWidth - 0.5, scaledY)));
  };

  // Racks data
  const racks = gpuResult?.rackRiskMatrix || mindState?.downwindRacksAtRisk || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-vault-900 via-vault-900 to-vault-950 p-6 rounded-2xl border border-vault-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Autonomous Vault Mind
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  Self-Adapting
                </span>
              </h1>
              <p className="text-sm text-vault-400">
                Learns from raw spoilage location feedback, adjusts environmental values, and simulates advective wind flow on local GPU.
              </p>
            </div>
          </div>
        </div>

        {/* Local Device GPU Status Chip */}
        <div className="flex items-center gap-3 bg-vault-950/80 px-4 py-3 rounded-xl border border-emerald-500/30 shadow-inner">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              <span>NVIDIA GeForce RTX 4050 GPU</span>
            </div>
            <div className="text-xs text-slate-300 font-mono">
              CUDA 12.4 • 6GB VRAM • Local PyTorch Engine
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {feedbackSuccessMsg && (
        <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 rounded-xl text-emerald-200 text-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedbackSuccessMsg}</span>
        </div>
      )}

      {/* Control Strip: Autonomous Mind Switch & Wind Flow Toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toggle 1: Autonomous Adaptation Mode */}
        <div className="bg-vault-900/90 p-4 rounded-xl border border-vault-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isAutonomousActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-vault-800 text-vault-400'}`}>
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-vault-400 uppercase tracking-wider">Autonomous Mind</p>
              <p className="text-sm font-bold text-white">{isAutonomousActive ? 'Self-Adjusting' : 'Manual Override'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !isAutonomousActive;
              setIsAutonomousActive(next);
              handleConfigChange({ isAutonomousActive: next });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isAutonomousActive
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-vault-800 text-slate-300 hover:bg-vault-700'
            }`}
          >
            {isAutonomousActive ? 'ENABLED' : 'PAUSED'}
          </button>
        </div>

        {/* Toggle 2: Wind Flow Option */}
        <div className="bg-vault-900/90 p-4 rounded-xl border border-vault-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${windEnabled ? 'bg-sky-500/20 text-sky-400' : 'bg-vault-800 text-vault-400'}`}>
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-vault-400 uppercase tracking-wider">Wind Flow (Optional)</p>
              <p className="text-sm font-bold text-white">{windEnabled ? 'Convective Airflow' : 'Static Diffusion'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !windEnabled;
              setWindEnabled(next);
              handleConfigChange({ windEnabled: next });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              windEnabled
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'bg-vault-800 text-slate-300 hover:bg-vault-700'
            }`}
          >
            {windEnabled ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        {/* Wind Speed Control */}
        <div className="bg-vault-900/90 p-4 rounded-xl border border-vault-800">
          <div className="flex items-center justify-between text-xs text-vault-400 mb-1">
            <span className="font-semibold uppercase">Fan Airflow Velocity</span>
            <span className="font-mono text-sky-400 font-bold">{windSpeed.toFixed(1)} m/s</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={windSpeed}
            disabled={!windEnabled}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setWindSpeed(val);
              handleConfigChange({ windSpeed: val });
            }}
            className="w-full h-1.5 bg-vault-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-40"
          />
          <div className="flex justify-between text-[10px] text-vault-400 mt-1">
            <span>0.2 m/s (Gentle)</span>
            <span>1.5 m/s (Nominal)</span>
            <span>3.0 m/s (Blast)</span>
          </div>
        </div>

        {/* Wind Direction Control */}
        <div className="bg-vault-900/90 p-4 rounded-xl border border-vault-800">
          <div className="flex items-center justify-between text-xs text-vault-400 mb-1">
            <span className="font-semibold uppercase flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              Direction
            </span>
            <span className="font-mono text-sky-400 font-bold">
              {windDirectionDegrees === 0 ? 'N → S (+Y)' : `${windDirectionDegrees}°`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {[
              { label: 'N → S', deg: 0 },
              { label: 'W → E', deg: 90 },
              { label: 'S → N', deg: 180 }
            ].map((d) => (
              <button
                key={d.deg}
                disabled={!windEnabled}
                onClick={() => {
                  setWindDirectionDegrees(d.deg);
                  handleConfigChange({ windDirectionDegrees: d.deg });
                }}
                className={`py-1 rounded text-[11px] font-semibold border transition-all ${
                  windDirectionDegrees === d.deg
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-vault-800/60 text-vault-400 border-vault-700/60 hover:bg-vault-800'
                } disabled:opacity-40`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Floorplan on Left, Spoilage Ingestion & Mind Adjustments on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive 2D/3D Vault Simulation Floorplan */}
        <div className="lg:col-span-7 bg-vault-900 p-5 rounded-2xl border border-vault-800 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                Vault Floorplan & Micro-Climate Plume (15m × 10m)
              </h2>
              <p className="text-xs text-vault-400">
                Click anywhere to reposition Spoilage Origin. Observe downwind advection towards downstream pallet stacks.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Origin
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Downwind Hazard
              </span>
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                Airflow
              </span>
            </div>
          </div>

          {/* Interactive SVG Floorplan Canvas */}
          <div className="relative bg-vault-950 rounded-xl border border-vault-800 overflow-hidden aspect-[15/10] select-none shadow-inner">
            <svg
              viewBox="0 0 150 100"
              className="w-full h-full cursor-crosshair"
              onClick={handleFloorplanClick}
            >
              {/* Grid Lines */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                </pattern>
                {/* Spoilage Dispersion Gradient */}
                <radialGradient id="spoilageGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </radialGradient>
                {/* Wind Downwind Jet Gradient */}
                <linearGradient id="windJet" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <rect width="150" height="100" fill="#030712" />
              <rect width="150" height="100" fill="url(#grid)" />

              {/* North Wall Cooling Evaporators */}
              <rect x="25" y="1" width="100" height="4" fill="#0284c7" rx="1" />
              <text x="75" y="4" textAnchor="middle" fill="#bae6fd" fontSize="2.8" fontWeight="bold">
                ❄️ PRIMARY EVAPORATOR COOLING BLOWERS (NORTH WALL)
              </text>

              {/* Wind Vector Streamlines (if enabled) */}
              {windEnabled && (
                <g opacity="0.6">
                  {[20, 40, 60, 80, 100, 120].map((wx) => (
                    <g key={wx}>
                      <line x1={wx} y1="8" x2={wx} y2="88" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />
                      <polygon points={`${wx},90 ${wx - 2},85 ${wx + 2},85`} fill="#38bdf8" opacity="0.7" />
                    </g>
                  ))}
                  <text x="135" y="50" textAnchor="middle" fill="#38bdf8" fontSize="3.2" fontWeight="bold">
                    AIRFLOW ➔
                  </text>
                </g>
              )}

              {/* Racks Layout */}
              {[
                { id: 'Rack-N1', x: 20, y: 18, w: 25, h: 14, name: 'North Rack 1' },
                { id: 'Rack-N2', x: 20, y: 38, w: 25, h: 14, name: 'North Rack 2' },
                { id: 'Rack-S3', x: 20, y: 65, w: 25, h: 14, name: 'South Rack 3' },
                { id: 'Rack-S4', x: 55, y: 65, w: 25, h: 14, name: 'South Rack 4' },
                { id: 'Door-Bay', x: 105, y: 60, w: 35, h: 25, name: 'Entry Bay / Door' }
              ].map((rack) => {
                const isOriginRack = rack.name.includes('North Rack 2');
                const isDownwindRack = rack.name.includes('South Rack 3') || rack.name.includes('South Rack 4');
                const strokeColor = isOriginRack
                  ? '#ef4444'
                  : isDownwindRack && windEnabled
                  ? '#f59e0b'
                  : '#374151';
                const fillColor = isOriginRack
                  ? 'rgba(239, 68, 68, 0.15)'
                  : isDownwindRack && windEnabled
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(31, 41, 55, 0.5)';

                return (
                  <g key={rack.id}>
                    <rect
                      x={rack.x}
                      y={rack.y}
                      width={rack.w}
                      height={rack.h}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isOriginRack || (isDownwindRack && windEnabled) ? '1.2' : '0.6'}
                      rx="1.5"
                    />
                    <text
                      x={rack.x + rack.w / 2}
                      y={rack.y + rack.h / 2}
                      textAnchor="middle"
                      fill="#e5e7eb"
                      fontSize="2.8"
                      fontWeight="600"
                    >
                      {rack.name}
                    </text>
                  </g>
                );
              })}

              {/* Plume Dispersion Overlay: Advected downstream if wind is ON, or isotropic circle if OFF */}
              {windEnabled ? (
                // Advected Elliptical Plume stretching in +Y
                <ellipse
                  cx={spoilageX * 10}
                  cy={spoilageY * 10 + 15}
                  rx={12 * severity}
                  ry={25 * severity * (windSpeed / 1.0)}
                  fill="url(#windJet)"
                  opacity="0.8"
                />
              ) : (
                // Pure Isotropic Diffusion Circle
                <circle
                  cx={spoilageX * 10}
                  cy={spoilageY * 10}
                  r={16 * severity}
                  fill="url(#spoilageGlow)"
                  opacity="0.75"
                />
              )}

              {/* Raw Spoilage Point-Source Marker (Click to place) */}
              <g transform={`translate(${spoilageX * 10}, ${spoilageY * 10})`}>
                <circle r="6" fill="#ef4444" opacity="0.3" className="animate-ping" />
                <circle r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="0.8" />
                <text x="0" y="-5.5" textAnchor="middle" fill="#fca5a5" fontSize="2.8" fontWeight="bold">
                  ⚠️ SPOILAGE ORIGIN ({spoilageX}m, {spoilageY}m)
                </text>
              </g>

              {/* South Wall & Door */}
              <rect x="105" y="96" width="35" height="3" fill="#64748b" />
              <text x="122.5" y="98.5" textAnchor="middle" fill="#cbd5e1" fontSize="2.2">
                LOADING BAY DOORS
              </text>
            </svg>
          </div>

          {/* Racks Evaluation Table */}
          <div className="mt-4 pt-4 border-t border-vault-800">
            <h3 className="text-xs font-bold text-vault-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Downstream Pallet Rack Threat Matrix</span>
              <span className="text-emerald-400 font-mono text-[11px]">
                {gpuResult?.gpuHardware ? `GPU Solver: ${gpuResult.gpuHardware.deviceName}` : 'Calculating...'}
              </span>
            </h3>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {racks.map((rack: any) => {
                const isCrit = rack.status === 'critical_hazard';
                const isAtRisk = rack.status === 'downwind_at_risk';
                return (
                  <div
                    key={rack.rackId}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                      isCrit
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                        : isAtRisk
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : 'bg-vault-950/50 border-vault-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCrit ? 'bg-rose-500' : isAtRisk ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span className="font-semibold">{rack.name}</span>
                      {rack.isDownwind && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Downwind
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span>Risk: <strong>{rack.riskScore}%</strong></span>
                      <span className="text-[11px] text-vault-400 hidden sm:inline">{rack.recommendedAction}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Spoilage Ingestion & Mind Value Adjustments */}
        <div className="lg:col-span-5 space-y-6">
          {/* Box 1: Autonomous Value Adjustments ("The Mind in Action") */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-vault-900 to-vault-900 p-5 rounded-2xl border border-emerald-500/30 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-base font-bold text-white">System's Autonomous Values</h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                {mindState?.mindStatus || 'ACTIVE'}
              </span>
            </div>

            <p className="text-xs text-vault-300 mb-4">
              {mindState?.rationale ||
                'The system mind automatically recalculates optimal cold vault parameters in response to the reported spoilage.'}
            </p>

            {/* Parameter Adjustment Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-vault-950/80 p-3 rounded-xl border border-vault-800">
                <div className="flex items-center gap-1.5 text-xs text-vault-400 mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                  <span>Target Cooling Delta</span>
                </div>
                <div className="text-xl font-bold font-mono text-sky-300">
                  {mindState?.coolingSetpointDelta || '-1.02°C'}
                </div>
                <span className="text-[10px] text-vault-400">Lowers heat to curb rot</span>
              </div>

              <div className="bg-vault-950/80 p-3 rounded-xl border border-vault-800">
                <div className="flex items-center gap-1.5 text-xs text-vault-400 mb-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Target Humidity Delta</span>
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  {mindState?.humiditySetpointDelta || '-4.7%'}
                </div>
                <span className="text-[10px] text-vault-400">Dries wet bacterial film</span>
              </div>

              <div className="bg-vault-950/80 p-3 rounded-xl border border-vault-800">
                <div className="flex items-center gap-1.5 text-xs text-vault-400 mb-1">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>CO2 Tolerance Margin</span>
                </div>
                <div className="text-xl font-bold font-mono text-amber-300">
                  {mindState?.co2TighteningMargin || '-255 ppm'}
                </div>
                <span className="text-[10px] text-vault-400">Tightens alarm boundary</span>
              </div>

              <div className="bg-vault-950/80 p-3 rounded-xl border border-vault-800">
                <div className="flex items-center gap-1.5 text-xs text-vault-400 mb-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Emergency Exhaust Purge</span>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-300">
                  {Math.round((mindState?.emergencyPurgeCycleSec || 1530) / 60)} min
                </div>
                <span className="text-[10px] text-vault-400">Auto-actuates purge relay</span>
              </div>
            </div>

            {/* Fan Modulation Rule */}
            <div className="p-3 bg-vault-950/70 rounded-xl border border-vault-800/80 text-xs text-slate-300 flex items-start gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300">Automated Blower Directive: </strong>
                {mindState?.fanModulationRule ||
                  'Increase primary evaporator fan speed by +35% to homogenize downwind hotspot.'}
              </div>
            </div>
          </div>

          {/* Box 2: Raw Spoilage Feedback Submission Form */}
          <div className="bg-vault-900 p-5 rounded-2xl border border-vault-800 shadow-xl">
            <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Submit Raw Spoilage Feedback
            </h2>
            <p className="text-xs text-vault-400 mb-4">
              Ground-truth report from manual inspection or smart probe detection.
            </p>

            <div className="space-y-3.5">
              {/* Coordinates */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-vault-400 uppercase">X Position (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={roomLength}
                    value={spoilageX}
                    onChange={(e) => setSpoilageX(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-vault-400 uppercase">Y Position (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={roomWidth}
                    value={spoilageY}
                    onChange={(e) => setSpoilageY(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-vault-400 uppercase">Z Height (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5.0"
                    value={spoilageZ}
                    onChange={(e) => setSpoilageZ(parseFloat(e.target.value) || 1.5)}
                    className="w-full mt-1 bg-vault-950 border border-vault-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Spoilage Type */}
              <div>
                <label className="text-[11px] font-semibold text-vault-400 uppercase">Pathology / Spoilage Type</label>
                <select
                  value={spoilageType}
                  onChange={(e) => setSpoilageType(e.target.value)}
                  className="w-full mt-1 bg-vault-950 border border-vault-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="bacterial_soft_rot">🦠 Bacterial Soft Rot (Erwinia/Pectobacterium) - High Moisture</option>
                  <option value="fungal_decay">🍄 Fungal Gray Mold / Dry Rot (Botrytis/Fusarium)</option>
                  <option value="anaerobic_fermentation">⚠️ Anaerobic Core Fermentation & Blackheart Suffocation</option>
                  <option value="sprouting">🌱 Sprout Emergence & Dormancy Break (Ethylene)</option>
                  <option value="chilling_injury">❄️ Chilling Injury & Cold-Induced Sweetening (CIS)</option>
                </select>
              </div>

              {/* Severity Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-vault-400 mb-1">
                  <span className="font-semibold uppercase">Severity Level</span>
                  <span className="font-mono text-rose-400 font-bold">{Math.round(severity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={severity}
                  onChange={(e) => setSeverity(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-vault-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-vault-400 uppercase">Inspector Field Observation</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 bg-vault-950 border border-vault-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Mold smell detected in lowest crate..."
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={isGpuComputing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
                >
                  {isGpuComputing ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Computing on RTX 4050...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Teach Mind & Adjust Values
                    </>
                  )}
                </button>

                <button
                  onClick={handleTriggerGpuSimulation}
                  disabled={isGpuComputing}
                  className="py-2.5 px-3 rounded-xl bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 flex items-center gap-1.5 transition-all"
                  title="Re-run 3D GPU solver"
                >
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  Run GPU
                </button>
              </div>
            </div>
          </div>

          {/* Box 3: GPU Hardware Telemetry Card */}
          {gpuResult?.gpuHardware && (
            <div className="bg-vault-950 p-4 rounded-xl border border-vault-800/80 text-xs space-y-2">
              <div className="flex items-center justify-between text-vault-400 font-semibold uppercase text-[10px] tracking-wider">
                <span>GPU Acceleration Telemetry</span>
                <span className="text-emerald-400">ACTIVE CUDA SOLVER</span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-slate-300">
                <div className="bg-vault-900/60 p-2 rounded">
                  <span className="text-[10px] text-vault-400 block">Compute Time</span>
                  <span className="font-bold text-white">{gpuResult.gpuHardware.computeTimeMs} ms</span>
                </div>
                <div className="bg-vault-900/60 p-2 rounded">
                  <span className="text-[10px] text-vault-400 block">Voxels / Sec</span>
                  <span className="font-bold text-emerald-400">
                    {(gpuResult.gpuHardware.speedTps / 1000000).toFixed(2)}M
                  </span>
                </div>
                <div className="bg-vault-900/60 p-2 rounded">
                  <span className="text-[10px] text-vault-400 block">Timesteps</span>
                  <span className="font-bold text-sky-400">{gpuResult.gpuHardware.timestepsExecuted}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
