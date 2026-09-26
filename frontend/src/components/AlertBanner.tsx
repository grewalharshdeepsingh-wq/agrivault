import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface AlertBannerProps {
  onNavigateToAlerts?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ onNavigateToAlerts }) => {
  const { alerts, acknowledgeAlert } = useApp();
  const { role } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeAlerts = alerts.filter(a => a.status === 'active' || a.status === 'acknowledged');
  if (activeAlerts.length === 0) return null;

  const topAlert = activeAlerts[0];
  const isCritical = topAlert.severity === 'critical';
  const isExpanded = expandedId === topAlert.id;

  const canAcknowledge = role !== 'Viewer';

  return (
    <div
      className={`mx-4 lg:mx-6 my-3 rounded-xl border p-4 transition-all shadow-lg ${
        isCritical
          ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-950/30'
          : 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/30'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Icon & Alert Heading */}
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <ShieldAlert className="w-5 h-5 animate-pulse" />
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
                {topAlert.severity} ALERT
              </span>
              <span className="text-xs text-vault-400 font-mono">
                {new Date(topAlert.created_at).toLocaleTimeString()}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                {topAlert.area_name || 'Storage Zone'}
              </span>
            </div>

            <h4 className="text-sm font-bold text-white mt-1">
              {topAlert.title}
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              {topAlert.message}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => setExpandedId(isExpanded ? null : topAlert.id)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-vault-800/80 hover:bg-vault-700 text-slate-200 border border-vault-700 transition"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Causes & Action'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {topAlert.status === 'active' && canAcknowledge && (
            <button
              onClick={() => acknowledgeAlert(topAlert.id)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-agri-600 hover:bg-agri-500 text-white shadow-md shadow-agri-600/30 transition"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Acknowledge</span>
            </button>
          )}

          {activeAlerts.length > 1 && onNavigateToAlerts && (
            <button
              onClick={onNavigateToAlerts}
              className="text-xs text-vault-400 hover:text-white px-2 py-1.5 font-medium flex items-center gap-1 transition"
            >
              <span>+{activeAlerts.length - 1} More</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Scientific Meaning & Recommended Actions */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-vault-800/80 grid md:grid-cols-2 gap-3 text-xs">
          <div className="bg-vault-950/60 rounded-lg p-3 border border-vault-800/60">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Potential Operational Meaning</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {topAlert.potential_issue}
            </p>
          </div>

          <div className="bg-vault-950/60 rounded-lg p-3 border border-vault-800/60">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Recommended Action</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {topAlert.recommended_action}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
