import React, { useState, useEffect } from 'react';
import {
  ToggleRight,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Layers,
  Power
} from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export const RelayControlPage: React.FC = () => {
  const { overview } = useApp();
  const [relays, setRelays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionHistory, setActionHistory] = useState<any[]>([]);
  const [selectedRelayForHistory, setSelectedRelayForHistory] = useState<string | null>(null);
  const [commandingId, setCommandingId] = useState<string | null>(null);
  const [commandStatusMsg, setCommandStatusMsg] = useState<string | null>(null);

  const fetchRelays = async () => {
    try {
      const res = await api.getRelays();
      setRelays(res);
    } catch (err) {
      console.error('Error fetching relays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelays();
    const interval = setInterval(fetchRelays, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = async (relay: any, action: 'ON' | 'OFF') => {
    const actionDesc = action === 'ON' ? 'ENERGIZE' : 'DE-ENERGIZE';
    const reasonPrompt = prompt(
      `SAFETY CONFIRMATION: You are about to ${actionDesc} industrial load: "${relay.name} (${relay.target_equipment})".\n\nEnter operational justification:`
    );

    if (reasonPrompt === null) return; // cancelled

    setCommandingId(relay.id);
    setCommandStatusMsg(`Transmitting command "${action}" to microcontroller...`);

    try {
      const res = await api.sendRelayCommand(
        relay.id,
        action,
        true,
        reasonPrompt.trim() || 'Manual operator toggle via Agrivault Relay Command Center'
      );
      setCommandStatusMsg(res.message || `Command "${action}" dispatched. Waiting for device ACK.`);
      await fetchRelays();
    } catch (err: any) {
      alert(`Command execution rejected: ${err?.message || 'Server error'}`);
      setCommandStatusMsg(null);
    } finally {
      setCommandingId(null);
    }
  };

  const inspectHistory = async (relayId: string) => {
    setSelectedRelayForHistory(relayId);
    try {
      const hist = await api.getRelayActions(relayId);
      setActionHistory(hist);
    } catch (err) {
      console.error('Error fetching actions:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Manual Relay Actuator Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Manual Mode Only
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-1">
            Authenticated physical switching for cold store ventilation fans, refrigeration defrost solenoids, and CO2 exhaust louvers.
          </p>
        </div>

        <button
          onClick={fetchRelays}
          className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5 text-agri-400" />
          <span>Refresh Hardware States</span>
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-amber-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Zero-Fabrication Relay State Machine Active</span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          Buttons do not assume load states. Status transitions through: <b>COMMAND_REQUESTED</b> → <b>COMMAND_ACKNOWLEDGED</b> → <b>STATE_REPORTED</b>. If the ESP32 node fails to acknowledge within 10 seconds, the command is automatically flagged as "Command not confirmed".
        </p>
      </div>

      {commandStatusMsg && (
        <div className="p-3 rounded-lg bg-agri-500/10 border border-agri-500/30 text-agri-400 text-xs font-semibold flex items-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin" />
          <span>{commandStatusMsg}</span>
        </div>
      )}

      {/* Relay Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relays.map((r: any) => {
          const isOn = r.state === 1;
          const status = r.command_status || 'IDLE';
          const isPending = status === 'COMMAND_REQUESTED';
          const isTimedOut = status === 'COMMAND_TIMED_OUT';

          return (
            <div
              key={r.id}
              className={`bg-vault-900 border rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between transition-colors ${
                isOn
                  ? 'border-emerald-500/40 bg-gradient-to-br from-vault-900 to-emerald-950/20'
                  : 'border-vault-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{r.name}</h3>
                    <p className="text-xs text-vault-400 font-mono">
                      GPIO Pin: <span className="text-slate-200">{r.gpio_pin}</span> • Load: <span className="text-agri-400">{r.target_equipment}</span>
                    </p>
                    <p className="text-[11px] text-vault-500 font-mono mt-0.5">
                      Host Node: {r.device_name || r.device_id}
                    </p>
                  </div>

                  <span className={`px-2.5 py-1 rounded text-xs font-black font-mono tracking-wider ${
                    isOn
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-vault-800 text-slate-400 border border-vault-700'
                  }`}>
                    {isOn ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* State Machine Status Indicator */}
                <div className="p-3 rounded-xl bg-vault-950 border border-vault-800 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-vault-400">Command Pipeline:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isPending
                        ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                        : isTimedOut
                        ? 'bg-rose-500/20 text-rose-400'
                        : status === 'STATE_REPORTED'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-vault-800 text-slate-400'
                    }`}>
                      {status}
                    </span>
                  </div>

                  {r.command_result && (
                    <p className="text-[11px] text-slate-300 italic pt-1 border-t border-vault-850">
                      {r.command_result}
                    </p>
                  )}

                  <div className="flex justify-between text-[11px] text-vault-500 pt-1">
                    <span>Physical Feedback:</span>
                    <span className="text-slate-300 font-bold">
                      {r.physical_feedback_confirmed === 1 ? 'GPIO Verified' : 'Unconfirmed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCommand(r, 'ON')}
                    disabled={commandingId === r.id || isOn}
                    className={`py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      isOn
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Energize ON</span>
                  </button>

                  <button
                    onClick={() => handleCommand(r, 'OFF')}
                    disabled={commandingId === r.id || !isOn}
                    className={`py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      !isOn
                        ? 'bg-vault-800 text-slate-500 border border-vault-700 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>De-energize OFF</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-vault-500 pt-1">
                  <span>Last Switched: {r.last_switched ? new Date(r.last_switched).toLocaleTimeString() : 'N/A'}</span>
                  <button
                    onClick={() => inspectHistory(r.id)}
                    className="text-agri-400 hover:underline flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Audit Log</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit History Drawer / Modal */}
      {selectedRelayForHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Relay Action Audit Log</h3>
              <button
                onClick={() => setSelectedRelayForHistory(null)}
                className="text-vault-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-vault-400">
              Immutable chronological record of authenticated manual switching actions.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {actionHistory.length === 0 ? (
                <p className="text-xs text-vault-500 text-center py-6">No historical actions recorded yet.</p>
              ) : (
                actionHistory.map((act: any) => (
                  <div key={act.id} className="p-3 rounded-lg bg-vault-950 border border-vault-800 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">
                        Transition: {act.previous_state === 1 ? 'ON' : 'OFF'} → {act.new_state === 1 ? 'ON' : 'OFF'}
                      </span>
                      <span className="text-[10px] text-vault-400 font-mono">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Triggered by: {act.triggered_by} ({act.actor_id || 'Operator'})</p>
                    <p className="text-[11px] text-slate-300 italic">Reason: {act.reason}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRelayForHistory(null)}
                className="px-4 py-1.5 rounded-lg bg-vault-800 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
