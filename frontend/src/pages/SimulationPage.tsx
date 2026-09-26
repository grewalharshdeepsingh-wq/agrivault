import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sliders,
  Play,
  Pause,
  AlertTriangle,
  Flame,
  Droplets,
  Wind,
  Apple,
  Skull,
  Wine,
  WifiOff,
  HardDriveDownload,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

export const SimulationPage: React.FC = () => {
  const { simulationStatus, setSimulationScenario } = useApp();
  const [activeScenario, setActiveScenario] = useState(simulationStatus?.activeScenario || 'normal');

  const scenarios = [
    {
      id: 'normal',
      title: 'Nominal Cold Storage Operations',
      desc: 'Balanced ambient temperatures (1.8°C - 5.2°C), stable humidity (88% - 92%), CO2 < 1,200 ppm, nominal trace gases.',
      icon: Sparkles,
      color: 'text-emerald-400',
      badge: 'Baseline'
    },
    {
      id: 'temp_spike',
      title: 'Refrigeration Failure / Door Open Thermal Spike',
      desc: 'Simulates rapid thermal runaway in Area 1 (Potato Storage) climbing up to 8.8°C to trigger critical temperature alarm & cooling ventilation relay.',
      icon: Flame,
      color: 'text-rose-400',
      badge: 'Temp Alarm'
    },
    {
      id: 'humidity_spike',
      title: 'Condensation / High-Humidity Saturation',
      desc: 'Relative humidity in Area 2 surges to 98% simulating evaporator coil defrost water pooling and condensation risk.',
      icon: Droplets,
      color: 'text-sky-400',
      badge: 'Condensation'
    },
    {
      id: 'co2_spike',
      title: 'Heavy Produce Respiration CO2 Buildup',
      desc: 'Potato respiration accelerates, generating CO2 up to 1,950 ppm to test fresh-air purge damper activation rules.',
      icon: Wind,
      color: 'text-amber-400',
      badge: 'Air Stagnation'
    },
    {
      id: 'gas_anomaly_ethylene',
      title: 'Ethylene Volatile Surge (Early Ripening)',
      desc: 'Ethylene surges to 0.18 ppm in Area 3 (Controlled Atmosphere Fruit Vault) simulating premature apple ripening / sprouting induction.',
      icon: Apple,
      color: 'text-purple-400',
      badge: 'Ripening / Sprout'
    },
    {
      id: 'gas_anomaly_ammonia',
      title: 'Ammonia Refrigerant Circuit Pin-Hole Leak',
      desc: 'MQ-135 detects surging NH3 ammonia vapors (6.8 ppm) coupled with rising temperatures, simulating an evaporator coil pin-hole leak.',
      icon: Skull,
      color: 'text-rose-400',
      badge: 'Refrigerant Breach'
    },
    {
      id: 'gas_anomaly_ethanol',
      title: 'Anaerobic Fermentation / Deep-Stack Rot VOC',
      desc: 'MQ-3 analog sensor detects rising ethanol volatiles (>3.2 ppm) indicating anaerobic core respiration and potential bacterial soft rot.',
      icon: Wine,
      color: 'text-pink-400',
      badge: 'Fermentation'
    },
    {
      id: 'multi_anomaly',
      title: 'Compound Spoilage Risk (Multi-Sensor Compound)',
      desc: 'Simultaneously drives Temperature, Humidity, and CO2 outside preferred limits to activate the Multi-Sensor Storage Health Engine.',
      icon: ShieldAlert,
      color: 'text-rose-500',
      badge: 'Multi-Sensor Rule'
    },
    {
      id: 'sensor_offline',
      title: 'ESP32 Node Power Failure / Disconnect',
      desc: 'Halts heartbeats from ESP32-A7F21. Watchdog will detect silence for >60s and generate a Device Offline Alert.',
      icon: WifiOff,
      color: 'text-amber-400',
      badge: 'Watchdog Test'
    },
    {
      id: 'gateway_offline',
      title: 'WAN / Internet Connection Loss & Recovery',
      desc: 'Simulates internet packet interruption. Once the WAN link recovers, direct telemetry streaming resumes immediately.',
      icon: HardDriveDownload,
      color: 'text-indigo-400',
      badge: 'WAN Link Test'
    }
  ];

  const handleSelectScenario = async (scId: string) => {
    setActiveScenario(scId);
    await setSimulationScenario(scId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Sliders className="w-4 h-4" />
          <span>Interactive Hardware Testbed</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Simulation Laboratory & Anomaly Scenarios
        </h1>
        <p className="text-xs text-vault-400">
          Inject real-world cold-chain failure scenarios to test alert thresholds, rule-based interpretation, relay automation, and offline resilience.
        </p>
      </div>

      {/* Prominent Label Notice */}
      <div className="bg-indigo-950/40 border border-indigo-500/50 rounded-xl p-4 text-xs flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-white">Simulation Engine Active</p>
            <p className="text-indigo-200">
              Virtual IoT fleet is publishing telemetry every 3.5s via embedded MQTT broker. All synthetic readings are tagged with <code className="bg-indigo-900/60 px-1 py-0.5 rounded text-indigo-300 font-mono">is_simulation: true</code>.
            </p>
          </div>
        </div>

        <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-900 text-indigo-200 border border-indigo-700">
          SCENARIO: {activeScenario.toUpperCase()}
        </span>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isSelected = activeScenario === sc.id;

          return (
            <div
              key={sc.id}
              onClick={() => handleSelectScenario(sc.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-vault-850 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
                  : 'bg-vault-900 border-vault-800 hover:border-vault-700 hover:bg-vault-850/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg bg-vault-950 border border-vault-800/80 ${sc.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{sc.title}</h3>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      isSelected
                        ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/40'
                        : 'bg-vault-950 text-vault-400 border-vault-800'
                    }`}
                  >
                    {sc.badge}
                  </span>
                </div>

                <p className="text-xs text-vault-300 leading-relaxed pl-11">{sc.desc}</p>
              </div>

              <div className="pt-3 mt-3 border-t border-vault-800/80 flex items-center justify-between text-xs pl-11">
                <span className="text-[11px] font-mono text-vault-400">
                  {isSelected ? '✓ Currently Emulating' : 'Click to Activate'}
                </span>
                <button
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-vault-800 text-vault-300 hover:text-white hover:bg-vault-700'
                  }`}
                >
                  {isSelected ? 'Active' : 'Trigger'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
