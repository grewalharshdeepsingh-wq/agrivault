import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Alert } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Filter,
  Check,
  Clock,
  ShieldAlert,
  Search,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts, refreshAlerts, acknowledgeAlert, resolveAlert } = useApp();
  const { role } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [eventHistory, setEventHistory] = useState<any[]>([]);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);

  const canManage = role === 'Owner' || role === 'Admin' || role === 'Operator';

  const handleToggleExpand = async (alertId: string) => {
    if (expandedId === alertId) {
      setExpandedId(null);
      setEventHistory([]);
    } else {
      setExpandedId(alertId);
      setLoadingHistoryId(alertId);
      try {
        const events = await api.getAlertEvents(alertId);
        setEventHistory(events);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingHistoryId(null);
      }
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.message.toLowerCase().includes(search.toLowerCase()) ||
      (a.area_name || '').toLowerCase().includes(search.toLowerCase()) ||
      a.parameter.toLowerCase().includes(search.toLowerCase());

    return matchesSeverity && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Active Alerts & Operational Interpretation
          </h1>
          <p className="text-xs text-vault-400">
            Real-time threshold violation evaluation with scientifically responsible cause diagnosis and recommended actions.
          </p>
        </div>

        <button
          onClick={refreshAlerts}
          className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-vault-300 text-xs font-semibold border border-vault-700 transition"
        >
          Refresh Alerts
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-vault-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by area, parameter, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-vault-950 border border-vault-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-vault-500 focus:outline-none focus:border-agri-500"
          />
        </div>

        {/* Severity & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center text-xs">
          <span className="text-vault-400 font-mono">Severity:</span>
          {(['all', 'critical', 'warning'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                severityFilter === s
                  ? 'bg-vault-700 text-white font-semibold'
                  : 'bg-vault-950 text-vault-400 hover:text-white border border-vault-800'
              }`}
            >
              {s}
            </button>
          ))}

          <span className="text-vault-400 font-mono ml-2">Status:</span>
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                statusFilter === st
                  ? 'bg-agri-600 text-white font-semibold shadow'
                  : 'bg-vault-950 text-vault-400 hover:text-white border border-vault-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center bg-vault-900 border border-vault-800 rounded-xl text-vault-400 text-xs">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-200">No matching alerts found</p>
            <p className="text-vault-400 mt-0.5">All monitored parameters are currently within specified boundaries.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isExpanded = expandedId === alert.id;

            return (
              <div
                key={alert.id}
                className={`bg-vault-900 rounded-xl border p-4 shadow-md transition-all ${
                  isCritical
                    ? 'border-rose-500/50 hover:border-rose-500/80'
                    : 'border-vault-800 hover:border-vault-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      <ShieldAlert className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {alert.severity}
                        </span>

                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                            alert.status === 'active'
                              ? 'bg-rose-900/60 text-rose-300'
                              : alert.status === 'acknowledged'
                              ? 'bg-amber-900/60 text-amber-300'
                              : 'bg-emerald-900/60 text-emerald-300'
                          }`}
                        >
                          {alert.status}
                        </span>

                        <span className="text-xs text-vault-400 font-mono">
                          {new Date(alert.created_at).toLocaleString()}
                        </span>

                        <span className="text-xs font-semibold text-slate-200">
                          {alert.area_name || 'Storage Zone'}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mt-1">{alert.title}</h3>
                      <p className="text-xs text-slate-300 mt-0.5">{alert.message}</p>
                    </div>
                  </div>

                  {/* Actions & Value Badge */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <div className="text-right hidden sm:block font-mono text-xs mr-2">
                      <span className="text-vault-400 text-[10px] block">MEASURED / LIMIT</span>
                      <span className="font-bold text-white">
                        {alert.measured_value} / {alert.threshold_value}
                      </span>
                    </div>

                    {alert.status === 'active' && canManage && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-2.5 py-1.5 rounded bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold shadow transition"
                      >
                        Acknowledge
                      </button>
                    )}

                    {alert.status !== 'resolved' && canManage && (
                      <button
                        onClick={() => resolveAlert(alert.id, 'Manually closed from Alerts center')}
                        className="px-2.5 py-1.5 rounded bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 transition"
                      >
                        Resolve
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleExpand(alert.id)}
                      className="p-1.5 rounded bg-vault-950 hover:bg-vault-800 text-vault-400 hover:text-white transition"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Scientific Interpretation & Event History */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-vault-800/80 space-y-3">
                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-vault-950/70 p-3 rounded-lg border border-vault-800/60">
                        <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                          <HelpCircle className="w-4 h-4" />
                          <span>Potential Operational Cause</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{alert.potential_issue}</p>
                      </div>

                      <div className="bg-vault-950/70 p-3 rounded-lg border border-vault-800/60">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                          <CheckCircle className="w-4 h-4" />
                          <span>Recommended Inspection / Action</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{alert.recommended_action}</p>
                      </div>
                    </div>

                    {/* Timeline Audit Events */}
                    {eventHistory.length > 0 && (
                      <div className="bg-vault-950/50 p-3 rounded-lg border border-vault-800/40 text-xs">
                        <span className="font-semibold text-vault-400 block mb-2 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          <span>Alert Lifecycle Timeline:</span>
                        </span>
                        <div className="space-y-1.5">
                          {eventHistory.map((ev, i) => (
                            <div key={i} className="flex items-start justify-between text-[11px] text-vault-300">
                              <span className="flex items-center gap-1">
                                <span className="text-agri-400">•</span>
                                <strong className="uppercase text-vault-200">{ev.event_type}:</strong> {ev.details}
                              </span>
                              <span className="text-vault-500 font-mono">
                                {new Date(ev.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
