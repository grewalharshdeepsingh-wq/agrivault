import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Key, Lock, Mail, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, setStoredToken } from '../api/client';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { user, login } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('admin@agrivault.io');
  const [password, setPassword] = useState('agrivault2026!');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Owner' | 'Admin' | 'Operator' | 'Viewer'>('Operator');
  const [orgName, setOrgName] = useState('Central Agricultural Cold Chain Ltd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isRegisterMode) {
        const res = await api.register({
          name: name || 'Operator',
          email,
          password,
          organizationName: orgName
        });
        setStoredToken(res.token);
        setSuccessMsg(`Account registered successfully as ${role}!`);
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        await login(email, password);
        setSuccessMsg('Authentication verified. Welcome to AgriVault!');
        setTimeout(() => {
          onSuccess();
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail: string, presetPass: string, presetRole: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setLoading(true);
    setError(null);
    try {
      await login(presetEmail, presetPass);
      setSuccessMsg(`Switched session to ${presetRole}!`);
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Active Session Card if logged in */}
      {user && (
        <div className="bg-vault-900 border border-agri-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-sm">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{user.name}</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-agri-600/20 text-agri-400 border border-agri-500/30">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-vault-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onSuccess}
            className="px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-semibold text-xs transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Main Authentication Form */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-agri-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Access Control & Security</span>
            </div>
            <h2 className="text-2xl font-black text-white">
              {isRegisterMode ? 'Register New User' : 'Operator Login'}
            </h2>
            <p className="text-xs text-slate-400">
              {isRegisterMode
                ? 'Create an authorized operator account with assigned permissions.'
                : 'Sign in to access environmental telemetry, crop profiles, and relay controls.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-agri-500/10 border border-agri-500/30 text-agri-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      required
                      className="w-full bg-vault-950 border border-vault-750 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-vault-500 focus:outline-none focus:border-agri-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Organization / Facility</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Apex Cold Stores"
                      required
                      className="w-full bg-vault-950 border border-vault-750 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-vault-500 focus:outline-none focus:border-agri-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-vault-950 border border-vault-750 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-agri-500"
                  >
                    <option value="Owner">Owner (Full administrative control)</option>
                    <option value="Admin">Administrator (Manage devices & thresholds)</option>
                    <option value="Operator">Operator (Relay control & alert resolution)</option>
                    <option value="Viewer">Viewer (Read-only observation)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@agrivault.io"
                  required
                  className="w-full bg-vault-950 border border-vault-750 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-vault-500 focus:outline-none focus:border-agri-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-vault-950 border border-vault-750 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-vault-500 focus:outline-none focus:border-agri-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-agri-600 hover:bg-agri-500 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-colors"
            >
              {loading ? 'Authenticating...' : isRegisterMode ? 'Complete Registration' : 'Sign In'}
            </button>
          </form>

          <div className="pt-2 border-t border-vault-800 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-agri-400 hover:underline"
            >
              {isRegisterMode ? 'Already have an account? Sign in instead' : "Don't have an account? Register new user"}
            </button>
          </div>
        </div>

        {/* Quick Role Switcher for Pair Testing */}
        <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div>
            <h3 className="text-base font-bold text-white">Preconfigured Test Roles</h3>
            <p className="text-xs text-vault-400 mt-1">
              Click any profile below to immediately authenticate and verify role-based permissions in the cold store dashboard.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                role: 'Owner',
                title: 'Facility Chief Engineer',
                email: 'admin@agrivault.io',
                pass: 'agrivault2026!',
                badge: 'Full Root Access',
                color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              },
              {
                role: 'Admin',
                title: 'Cold Store Quality Manager',
                email: 'admin@agrivault.io',
                pass: 'agrivault2026!',
                badge: 'Threshold & Device Config',
                color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              },
              {
                role: 'Operator',
                title: 'Warehouse Shift Supervisor',
                email: 'admin@agrivault.io',
                pass: 'agrivault2026!',
                badge: 'Manual Relay & Acknowledge',
                color: 'text-agri-400 bg-agri-500/10 border-agri-500/20'
              },
              {
                role: 'Viewer',
                title: 'USDA / Food Safety Auditor',
                email: 'admin@agrivault.io',
                pass: 'agrivault2026!',
                badge: 'Read-Only Analytics',
                color: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
              }
            ].map((p, idx) => (
              <div
                key={idx}
                onClick={() => handleQuickLogin(p.email, p.pass, p.role)}
                className="p-3.5 rounded-xl bg-vault-950 border border-vault-800 hover:border-agri-500/40 cursor-pointer transition-all hover:bg-vault-850 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200">{p.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${p.color}`}>
                      {p.role}
                    </span>
                  </div>
                  <p className="text-xs text-vault-400 mt-0.5">{p.email}</p>
                </div>
                <span className="text-xs text-agri-400 font-semibold">Login →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
