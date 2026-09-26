import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { RelayDevice, AutomationRule } from '../types';
import {
  ToggleRight,
  Power,
  Sliders,
  ShieldAlert,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  Activity,
  History
} from 'lucide-react';

export const AutomationPage: React.FC = () => {
  const { overview } = useApp();
  const { role } = useAuth();
  const [relays, setRelays] = useState<RelayDevice[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [actionsLog, setActionsLog] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal for new rule
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('Potato Vault High-Temp Ventilation');
  const [ruleAreaId, setRuleAreaId] = useState('area-01');
  const [ruleRelayId, setRuleRelayId] = useState('relay-01');
  const [ruleParam, setRuleParam] = useState('temperature');
  const [turnOnVal, setTurnOnVal] = useState('6.5');
  const [turnOffVal, setTurnOffVal] = useState('4.8'); // 1.7°C hysteresis!

  const canControl = role === 'Owner' || role === 'Admin' || role === 'Operator';

  const loadData = async () => {
    try {
      const [rList, rulesList] = await Promise.all([
        api.getRelays(),
        api.getAutomationRules()
      ]);
      setRelays(rList);
      setRules(rulesList);

      if (rList.length > 0) {
        const acts = await api.getRelayActions(rList[0].id);
        setActionsLog(acts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleState = async (relay: RelayDevice) => {
    if (!canControl) {
      alert(`Role ${role} cannot toggle physical relays. Operator/Admin required.`);
      return;
    }
    const targetState = relay.state === 1 ? 0 : 1;
    const confirmMsg = `SAFETY CONFIRMATION: Are you sure you want to turn ${targetState === 1 ? 'ON' : 'OFF'} "${relay.name}" (${relay.target_equipment})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.toggleRelay(relay.id, targetState, true, 'Manual override via Automation Console');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSwitchMode = async (relay: RelayDevice) => {
    if (!canControl) return;
    const newMode = relay.mode === 'automatic' ? 'manual' : 'automatic';
    try {
      await api.setRelayMode(relay.id, newMode);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: number) => {
    if (!canControl) return;
    try {
      await api.toggleAutomationRule(ruleId, currentEnabled === 0);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateRule = async () => {
    if (!ruleName || !turnOnVal || !turnOffVal) return;
    try {
      await api.saveAutomationRule({
        facilityId: 'fac-01',
        areaId: ruleAreaId,
        relayId: ruleRelayId,
        name: ruleName,
        parameter: ruleParam,
        triggerCondition: 'greater_than',
        turnOnThreshold: parseFloat(turnOnVal),
        turnOffThreshold: parseFloat(turnOffVal)
      });
      setShowRuleModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Relay Automation & Industrial Hysteresis Control
          </h1>
          <p className="text-xs text-vault-400">
            Control 5V relay actuators (ventilation fans, purge blowers, chiller bypass) with anti-chatter hysteresis.
          </p>
        </div>

        {canControl && (
          <button
            onClick={() => setShowRuleModal(true)}
            className="px-3.5 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Automation Rule</span>
          </button>
        )}
      </div>

      {/* Safety Framework Callout */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 text-xs flex items-start gap-3 shadow-md">
        <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-slate-300 space-y-1">
          <p className="font-semibold text-white">Safe Actuation Framework Active</p>
          <p className="text-vault-400 leading-relaxed">
            All automatic rules enforce <strong>deadband hysteresis</strong> (e.g., Turn ON at 6.5°C, Turn OFF only when cooled to 4.8°C).
            Anti-chatter software timers prevent rapid on/off relay cycling. Max continuous runtime cutoff is set to 3,600s with automatic cooldown cooldown locks.
          </p>
        </div>
      </div>

      {/* Relay Actuators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {relays.map((relay) => (
          <div
            key={relay.id}
            className={`bg-vault-900 rounded-xl border p-4 shadow-md flex flex-col justify-between ${
              relay.state === 1
                ? 'border-emerald-500/60 bg-gradient-to-br from-vault-900 to-emerald-950/20'
                : 'border-vault-800'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">{relay.name}</h3>
                  <span className="text-[10px] font-mono text-vault-400">{relay.gpio_pin}</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                    relay.state === 1
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-vault-950 text-vault-400'
                  }`}
                >
                  {relay.state === 1 ? 'ON (ACTIVE)' : 'OFF (STANDBY)'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs bg-vault-950/60 p-2.5 rounded-lg border border-vault-800/80 mb-3 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-vault-400">Target Load:</span>
                  <span className="text-slate-200">{relay.target_equipment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vault-400">Zone:</span>
                  <span className="text-slate-200">{relay.area_name || 'Potato Vault'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vault-400">Mode:</span>
                  <button
                    onClick={() => handleSwitchMode(relay)}
                    className="text-agri-400 hover:underline uppercase font-bold text-[10px]"
                  >
                    {relay.mode} (Click to toggle)
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-vault-400">Max Runtime:</span>
                  <span className="text-vault-300">{relay.max_continuous_runtime_sec}s</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-vault-800/80 flex items-center justify-between">
              <span className="text-[10px] text-vault-500 font-mono">
                Switched: {new Date(relay.last_switched).toLocaleTimeString()}
              </span>

              <button
                onClick={() => handleToggleState(relay)}
                disabled={!canControl}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow ${
                  relay.state === 1
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                } disabled:opacity-30 disabled:pointer-events-none`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{relay.state === 1 ? 'Turn OFF' : 'Turn ON'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Configured Automation Rules Table */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Active Hysteresis Automation Rules</h3>
            <p className="text-xs text-vault-400">Rules are continuously evaluated against live incoming MQTT telemetry.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-vault-950/80 text-vault-400 font-mono text-[11px] uppercase border-b border-vault-800">
              <tr>
                <th className="py-2.5 px-3">Rule Name</th>
                <th className="py-2.5 px-3">Zone</th>
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Turn ON At</th>
                <th className="py-2.5 px-3">Turn OFF At (Hysteresis)</th>
                <th className="py-2.5 px-3">Hysteresis Delta</th>
                <th className="py-2.5 px-3">Target Relay</th>
                <th className="py-2.5 px-3">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800/60 font-mono text-slate-200">
              {rules.map((rule) => {
                const delta = Math.abs(rule.turn_on_threshold - rule.turn_off_threshold).toFixed(1);
                return (
                  <tr key={rule.id} className="hover:bg-vault-950/40">
                    <td className="py-2.5 px-3 font-sans font-bold text-white">{rule.name}</td>
                    <td className="py-2.5 px-3 text-vault-300 font-sans">{rule.area_name || 'Area 1'}</td>
                    <td className="py-2.5 px-3 capitalize font-bold text-agri-400">{rule.parameter}</td>
                    <td className="py-2.5 px-3 text-rose-300 font-bold">≥ {rule.turn_on_threshold}</td>
                    <td className="py-2.5 px-3 text-sky-300 font-bold">≤ {rule.turn_off_threshold}</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-semibold">{delta} (Anti-Chatter)</td>
                    <td className="py-2.5 px-3 font-sans text-vault-300">{rule.relay_name || 'Ventilation Fan'}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.is_enabled)}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase transition ${
                          rule.is_enabled === 1
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-vault-800 text-vault-500'
                        }`}
                      >
                        {rule.is_enabled === 1 ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Create New Safe Automation Rule</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-vault-300 mb-1 font-semibold">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-agri-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-vault-300 mb-1 font-semibold">Environmental Parameter</label>
                  <select
                    value={ruleParam}
                    onChange={(e) => setRuleParam(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="temperature">Temperature (°C)</option>
                    <option value="co2">CO2 (ppm)</option>
                    <option value="humidity">Humidity (%)</option>
                    <option value="ammonia">Ammonia (ppm)</option>
                    <option value="ethanol">Ethanol/VOC (ppm)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-vault-300 mb-1 font-semibold">Target Relay</label>
                  <select
                    value={ruleRelayId}
                    onChange={(e) => setRuleRelayId(e.target.value)}
                    className="w-full bg-vault-950 border border-vault-700 rounded-lg px-3 py-2 text-white"
                  >
                    {relays.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.target_equipment})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-vault-950 p-3 rounded-lg border border-vault-800">
                <div>
                  <label className="block text-rose-400 mb-1 font-bold">Turn ON Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    value={turnOnVal}
                    onChange={(e) => setTurnOnVal(e.target.value)}
                    className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-vault-500 mt-1 block">Upper threshold</span>
                </div>

                <div>
                  <label className="block text-sky-400 mb-1 font-bold">Turn OFF (Hysteresis Limit)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={turnOffVal}
                    onChange={(e) => setTurnOffVal(e.target.value)}
                    className="w-full bg-vault-900 border border-vault-700 rounded-lg px-3 py-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-vault-500 mt-1 block">Prevents relay chatter</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-vault-800">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-3 py-1.5 rounded bg-vault-800 text-slate-300 text-xs hover:bg-vault-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                className="px-3 py-1.5 rounded bg-agri-600 text-white text-xs font-semibold hover:bg-agri-500 shadow-md"
              >
                Create Automation Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
