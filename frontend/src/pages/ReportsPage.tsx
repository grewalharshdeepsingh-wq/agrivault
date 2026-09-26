import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  Printer,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  FileText
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { overview } = useApp();
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [period, setPeriod] = useState<string>('24h');
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const areas = overview?.areas || [];

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await api.generateReport('fac-01', selectedAreaId || undefined, period);
      setReportData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedAreaId, period]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Automated Historical Reports & Storage Audit
          </h1>
          <p className="text-xs text-vault-400">
            Generate verifiable storage conditions, statistical excursion summaries, and compliance audit exports.
          </p>
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-2">
          <a
            href={api.getReportExportUrl(selectedAreaId || undefined, period, 'csv')}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-vault-700 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-vault-900 border border-vault-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-vault-400 font-mono">Area:</span>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="bg-vault-950 border border-vault-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-agri-500 font-medium"
          >
            <option value="">All Storage Areas</option>
            {areas.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.commodity})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-vault-950 p-1 rounded-lg border border-vault-800 self-start sm:self-center">
          {[
            { id: '1h', label: 'Last 1h' },
            { id: '6h', label: 'Last 6h' },
            { id: '24h', label: 'Last 24h' },
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition ${
                period === p.id ? 'bg-agri-600 text-white shadow' : 'text-vault-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generated Report Content */}
      {isLoading ? (
        <div className="text-center py-12 text-vault-400 text-xs font-mono">
          Compiling Statistical Storage Excursion Analytics...
        </div>
      ) : !reportData || reportData.areasReport?.length === 0 ? (
        <div className="p-8 text-center bg-vault-900 border border-vault-800 rounded-xl text-vault-400 text-xs">
          No historical records found for this period.
        </div>
      ) : (
        <div className="space-y-6">
          {reportData.areasReport.map((rep: any) => (
            <div
              key={rep.areaId}
              className="bg-vault-900 border border-vault-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-4 print:bg-white print:text-black print:border-gray-300"
            >
              {/* Area Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-vault-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white print:text-black">{rep.areaName}</h2>
                  <p className="text-xs text-vault-400 print:text-gray-600">
                    Stored Commodity: <strong className="text-slate-200 print:text-black">{rep.commodity}</strong> | Reporting Range: {rep.period}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold uppercase bg-vault-950 border border-vault-800 text-agri-400">
                    HEALTH: {rep.healthStatus.toUpperCase()} ({Math.round(rep.healthScore)}%)
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded font-mono bg-vault-800 text-slate-300">
                    {rep.excursionCount} Excursion{rep.excursionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Statistical Parameters Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-vault-950/80 text-vault-400 font-mono text-[11px] uppercase border-b border-vault-800">
                    <tr>
                      <th className="py-2.5 px-3">Environmental Parameter</th>
                      <th className="py-2.5 px-3">Average</th>
                      <th className="py-2.5 px-3">Minimum</th>
                      <th className="py-2.5 px-3">Maximum</th>
                      <th className="py-2.5 px-3">Current</th>
                      <th className="py-2.5 px-3">Data Samples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vault-800/60 font-mono text-slate-200">
                    {Object.entries(rep.parameters || {}).map(([param, stats]: [string, any]) => (
                      <tr key={param} className="hover:bg-vault-950/40">
                        <td className="py-2.5 px-3 font-sans font-semibold capitalize text-white">
                          {param}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-agri-300">
                          {stats.avg} {stats.unit}
                        </td>
                        <td className="py-2.5 px-3 text-sky-300">
                          {stats.min} {stats.unit}
                        </td>
                        <td className="py-2.5 px-3 text-rose-300">
                          {stats.max} {stats.unit}
                        </td>
                        <td className="py-2.5 px-3 text-white">
                          {stats.current} {stats.unit}
                        </td>
                        <td className="py-2.5 px-3 text-vault-400">
                          {stats.sampleCount} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Automated Synthesis & Concerns */}
              <div className="grid md:grid-cols-2 gap-3 pt-2">
                <div className="bg-vault-950/70 p-3.5 rounded-xl border border-vault-800 text-xs">
                  <h4 className="font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Identified Environmental Concerns:</span>
                  </h4>
                  <ul className="space-y-1 text-slate-300 leading-relaxed text-[11px]">
                    {rep.possibleConcerns?.map((c: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-vault-950/70 p-3.5 rounded-xl border border-vault-800 text-xs">
                  <h4 className="font-semibold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Recommended Engineering & QA Actions:</span>
                  </h4>
                  <ul className="space-y-1 text-slate-300 leading-relaxed text-[11px]">
                    {rep.recommendedActions?.map((a: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
