import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RotateCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Thermometer,
  Droplets,
  Wind,
  WifiOff
} from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

export const RiskAdvisorPage: React.FC = () => {
  const { overview } = useApp();
  const [adviceData, setAdviceData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const fetchAdvice = async () => {
    try {
      const res = await api.getRiskAdvice(overview?.facility?.id);
      setAdviceData(res);
      if (res?.items && res.items.length > 0 && !expandedId) {
        setExpandedId(res.items[0].id);
      }
    } catch (err) {
      console.error('Error fetching risk advice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
    const interval = setInterval(fetchAdvice, 8000);
    return () => clearInterval(interval);
  }, []);

  const items = adviceData?.items || [];
  const filteredItems = filterSeverity === 'all'
    ? items
    : items.filter((i: any) => i.severity === filterSeverity);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Agricultural Risk Advisor</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Rules Engine Active
            </span>
          </div>
          <p className="text-xs text-vault-400 mt-1">
            Explainable AI & agricultural science reasoning for detected storage anomalies. Connects crop physiology with corrective action.
          </p>
        </div>

        <button
          onClick={fetchAdvice}
          className="px-3.5 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold border border-vault-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5 text-agri-400" />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Advisory Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-vault-400 block font-semibold">Total Storage Anomalies</span>
            <span className="text-2xl font-black font-mono text-white">{items.length}</span>
          </div>
          <div className="p-3 rounded-lg bg-vault-800 text-slate-300">
            <Search className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-vault-400 block font-semibold">Critical Threat Risks</span>
            <span className="text-2xl font-black font-mono text-rose-400">{adviceData?.critical_count || 0}</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-vault-900 border border-vault-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-vault-400 block font-semibold">Warning Deviations</span>
            <span className="text-2xl font-black font-mono text-amber-400">{adviceData?.warning_count || 0}</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        {['all', 'critical', 'warning'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-colors ${
              filterSeverity === sev
                ? 'bg-agri-600 text-white'
                : 'bg-vault-900 text-vault-400 hover:text-slate-200 border border-vault-800'
            }`}
          >
            {sev === 'all' ? `All Advisories (${items.length})` : `${sev} (${items.filter((i: any) => i.severity === sev).length})`}
          </button>
        ))}
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-vault-900 border border-vault-800 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">All Storage Parameters Within Safe Limits</h3>
          <p className="text-xs text-vault-400 max-w-md mx-auto">
            The rules engine evaluated all live temperature, humidity, and gas sensors against applicable crop profiles. No physiological threats detected.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item: any) => {
            const isExpanded = expandedId === item.id;
            const isCritical = item.severity === 'critical';

            return (
              <div
                key={item.id}
                className={`bg-vault-900 border rounded-2xl transition-all shadow-lg overflow-hidden ${
                  isCritical
                    ? 'border-rose-500/40 bg-gradient-to-r from-vault-900 to-rose-950/20'
                    : 'border-vault-800'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-vault-850/50"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                      isCritical
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {item.parameter === 'temperature' ? (
                        <Thermometer className="w-5 h-5" />
                      ) : item.parameter === 'humidity' ? (
                        <Droplets className="w-5 h-5" />
                      ) : item.parameter === 'connectivity' ? (
                        <WifiOff className="w-5 h-5" />
                      ) : (
                        <Wind className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white">{item.detected_condition}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-xs text-vault-400 mt-0.5">
                        Zone: <span className="text-slate-200 font-semibold">{item.area_name}</span> • Commodity: <span className="text-agri-300 font-semibold">{item.crop_name}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono text-xs hidden sm:block">
                      <span className="text-vault-400 block text-[10px] uppercase font-semibold">Deviation</span>
                      <span className="text-white font-bold">{item.deviation_description}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-vault-400" /> : <ChevronDown className="w-5 h-5 text-vault-400" />}
                  </div>
                </div>

                {/* Expanded Detailed Breakdown */}
                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-vault-800/80 space-y-5 text-xs">
                    {/* Comparison Box */}
                    <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-vault-400 text-[10px] block font-semibold uppercase">Actual Reading</span>
                        <span className="font-mono text-sm font-black text-rose-400">
                          {item.actual_value !== null ? `${item.actual_value} ${item.unit}` : 'Missing / Offline'}
                        </span>
                      </div>
                      <div>
                        <span className="text-vault-400 text-[10px] block font-semibold uppercase">Target Value</span>
                        <span className="font-mono text-sm font-semibold text-slate-200">
                          {item.target_value !== null ? `${item.target_value} ${item.unit}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-vault-400 text-[10px] block font-semibold uppercase">Safe Lower Limit</span>
                        <span className="font-mono text-sm font-semibold text-slate-300">
                          {item.limit_min !== null ? `${item.limit_min} ${item.unit}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-vault-400 text-[10px] block font-semibold uppercase">Safe Upper Limit</span>
                        <span className="font-mono text-sm font-semibold text-slate-300">
                          {item.limit_max !== null ? `${item.limit_max} ${item.unit}` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Section 1: Why it matters */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>1. Physiological Impact & Spoilage Threat:</span>
                      </h4>
                      <p className="text-slate-300 leading-relaxed bg-vault-950/70 p-3.5 rounded-xl border border-vault-800">
                        {item.why_it_matters}
                      </p>
                    </div>

                    {/* Section 2: Possible explanations */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-white text-xs">2. Possible Explanations / Root Causes:</h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                        {item.possible_explanations.map((exp: string, idx: number) => (
                          <li key={idx}><span className="text-slate-200">{exp}</span></li>
                        ))}
                      </ul>
                    </div>

                    {/* Section 3: What to check first */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-amber-400 text-xs">3. What to Check First (Immediate Triage):</h4>
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1 text-slate-200">
                        {item.what_to_check_first.map((chk: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-amber-400 font-bold">▶</span>
                            <span>{chk}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 4: Recommended Corrective Actions */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-agri-400 text-xs">4. Recommended Corrective Actions:</h4>
                      <div className="p-3 rounded-xl bg-agri-500/5 border border-agri-500/20 space-y-1 text-slate-200">
                        {item.recommended_actions.map((act: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-agri-400 font-bold">✓</span>
                            <span>{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 5: Post-Verification */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-white text-xs">5. Post-Verification Checks:</h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                        {item.post_verification.map((pv: string, idx: number) => (
                          <li key={idx}>{pv}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Section 6: Safety Precautions */}
                    {item.safety_precautions && item.safety_precautions.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-1">
                        <h4 className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Mandatory Safety Precautions:</span>
                        </h4>
                        {item.safety_precautions.map((safe: string, idx: number) => (
                          <p key={idx} className="text-xs leading-relaxed pl-5 font-medium">{safe}</p>
                        ))}
                      </div>
                    )}

                    {/* Footer Citations & Data Quality */}
                    <div className="pt-3 border-t border-vault-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-vault-400">
                      <div>
                        <span>Rule: <b>{item.rule_reference}</b></span>
                        <span className="mx-2">•</span>
                        <span>Source: <i>{item.scientific_source}</i></span>
                      </div>
                      <div className="italic text-vault-500">
                        {item.data_quality_notes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
