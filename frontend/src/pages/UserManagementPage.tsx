import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Key,
  CheckCircle2,
  Lock,
  Mail,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UserManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Owner' | 'Admin' | 'Operator' | 'Viewer'>('Operator');
  const [notification, setNotification] = useState<string | null>(null);

  // Default team members list
  const [teamMembers, setTeamMembers] = useState([
    {
      id: 'usr-admin',
      name: 'Harshdeep Singh',
      email: 'admin@agrivault.io',
      role: 'Owner',
      status: 'Active',
      lastLogin: 'Just now'
    },
    {
      id: 'usr-op-01',
      name: 'Rajesh Sharma',
      email: 'rajesh.ops@agrivault.io',
      role: 'Operator',
      status: 'Active',
      lastLogin: '2 hours ago'
    },
    {
      id: 'usr-auditor-01',
      name: 'Dr. Michael Chen',
      email: 'm.chen@postharvest-audit.gov',
      role: 'Viewer',
      status: 'Active',
      lastLogin: 'Yesterday'
    }
  ]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const newMember = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: 'Invited',
      lastLogin: 'Pending'
    };
    setTeamMembers([...teamMembers, newMember]);
    setNotification(`Invitation successfully issued to ${inviteEmail} with role: ${inviteRole}`);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">User Access & Role-Based Permissions</h1>
          <p className="text-xs text-vault-400 mt-1">
            Manage authenticated cold store staff, shift operators, auditors, and administrators with strict data isolation.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs shadow-md transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Team Member</span>
        </button>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Team Table */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white">Authorized Cold Store Personnel</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-vault-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Account Status</th>
                <th className="p-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800/60">
              {teamMembers.map((m) => (
                <tr key={m.id} className="hover:bg-vault-850/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-agri-500/10 text-agri-400 font-bold flex items-center justify-center text-xs">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-200 block">{m.name}</span>
                        <span className="text-[11px] text-vault-400">{m.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      m.role === 'Owner'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : m.role === 'Admin'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : m.role === 'Operator'
                        ? 'bg-agri-500/10 text-agri-400 border border-agri-500/20'
                        : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-emerald-400 font-semibold">{m.status}</span>
                  </td>
                  <td className="p-3 text-vault-400 font-mono">{m.lastLogin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white">Role-Based Access Control (RBAC) Matrix</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-vault-950 text-vault-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Permission / Capability</th>
                <th className="p-3 text-center">Owner</th>
                <th className="p-3 text-center">Admin</th>
                <th className="p-3 text-center">Operator</th>
                <th className="p-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-800/60 font-sans">
              {[
                { label: 'View Real-Time Telemetry & Charts', owner: true, admin: true, op: true, view: true },
                { label: 'Acknowledge & Resolve Active Alerts', owner: true, admin: true, op: true, view: false },
                { label: 'Manual Industrial Relay Switching (Fans/Defrost)', owner: true, admin: true, op: true, view: false },
                { label: 'Approve & Provision New ESP32 Devices', owner: true, admin: true, op: false, view: false },
                { label: 'Edit Crop Storage Thresholds & Rules', owner: true, admin: true, op: false, view: false },
                { label: 'Create & Modify Custom Crop Profiles', owner: true, admin: true, op: false, view: false },
                { label: 'Manage Team Accounts & Security Credentials', owner: true, admin: false, op: false, view: false }
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-vault-850/50">
                  <td className="p-3 font-medium text-slate-200">{row.label}</td>
                  <td className="p-3 text-center font-bold text-emerald-400">{row.owner ? '✓' : '—'}</td>
                  <td className="p-3 text-center font-bold text-emerald-400">{row.admin ? '✓' : '—'}</td>
                  <td className="p-3 text-center font-bold text-emerald-400">{row.op ? '✓' : '—'}</td>
                  <td className="p-3 text-center font-bold text-slate-400">{row.view ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-vault-900 border border-vault-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Invite Team Member</h3>

            <form onSubmit={handleInvite} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. David Miller"
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="david@agrivault.io"
                  required
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-vault-950 border border-vault-700 rounded-lg p-2 text-slate-100"
                >
                  <option value="Operator">Operator (Relay control & alert handling)</option>
                  <option value="Admin">Administrator (Threshold & device configuration)</option>
                  <option value="Viewer">Viewer (Read-only auditor)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-vault-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-500 text-white font-bold"
                >
                  Issue Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
