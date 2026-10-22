/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Locality, Complaint } from '../types/index.ts';
import { portalStore } from '../services/store.ts';
import {
  ShieldAlert,
  UserCheck,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  Building,
  History,
  Users,
  HardHat,
  Shield,
} from 'lucide-react';

interface AdminViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  localities: Locality[];
  complaints: Complaint[];
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  users,
  localities,
  complaints,
}) => {
  const [activeTab, setActiveTab] = useState<'supervisors' | 'users' | 'localities' | 'audit'>('supervisors');

  // Supervisor Provisioning Form State
  const [supFullName, setSupFullName] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [provisionMsg, setProvisionMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  const supervisors = users.filter((u) => u.role === 'supervisor');

  // System audit log: all complaint history entries flattened and sorted by date descending
  const allAuditHistory = complaints
    .flatMap((c) =>
      c.history.map((h) => ({
        ...h,
        trackingCode: c.trackingCode,
        address: c.address,
        localityName: c.localityName,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleProvisionSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionMsg(null);

    if (supFullName.trim().length < 2) {
      setProvisionMsg({ text: 'Full name must be at least 2 characters.', error: true });
      return;
    }
    if (supPhone.trim().length < 7) {
      setProvisionMsg({ text: 'Phone number must be at least 7 characters.', error: true });
      return;
    }

    setIsProvisioning(true);
    const res = await portalStore.provisionSupervisor({
      email: supEmail,
      fullName: supFullName,
      phoneNumber: supPhone,
    });
    setIsProvisioning(false);

    if (res.success) {
      const supervisorName = res.user?.fullName || supFullName;
      const supervisorEmail = res.user?.email || supEmail;
      setProvisionMsg({
        text: `Supervisor account for ${supervisorName} (${supervisorEmail}) successfully provisioned and activated.`,
      });
      setSupFullName('');
      setSupEmail('');
      setSupPhone('');
      setTimeout(() => setProvisionMsg(null), 8000);
    } else {
      setProvisionMsg({ text: res.error || 'Supervisor provisioning failed.', error: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Title Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-purple-700">
              Municipal Governance Console
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Administrator Administration & Security
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Designated Administrator: <span className="font-semibold text-slate-700">{currentUser.email}</span>. Provision supervisor credentials, review registered accounts, and inspect the immutable audit log.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xl font-black text-slate-900">{supervisors.length}</span>
            <p className="text-[10px] uppercase font-bold text-slate-400">Supervisors</p>
          </div>
          <div className="text-center px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xl font-black text-slate-900">{users.length}</span>
            <p className="text-[10px] uppercase font-bold text-slate-400">Accounts</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2 shadow-xs gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('supervisors')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'supervisors'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Supervisor Provisioning ({supervisors.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          User Registry ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('localities')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'localities'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Municipal Localities ({localities.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          System Audit Trail ({allAuditHistory.length})
        </button>
      </div>

      {/* TAB 1: SUPERVISOR PROVISIONING */}
      {activeTab === 'supervisors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provisioning Form */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" /> Provision New Supervisor
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Grant elevated municipal supervisor permissions to authorized operational staff.
              </p>
            </div>

            {provisionMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  provisionMsg.error
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                {provisionMsg.error ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <span>{provisionMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleProvisionSupervisor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Supervisor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={supFullName}
                  onChange={(e) => setSupFullName(e.target.value)}
                  placeholder="e.g. Inspector Davis"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="supervisor@civicwaste.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+1-555-0199"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] leading-relaxed">
                Supervisors can verify complaints, place telephone contact to residents, assign authorized cleaners, and sign off completion evidence.
              </div>

              <button
                type="submit"
                disabled={isProvisioning}
                className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProvisioning ? 'Provisioning...' : 'Provision Supervisor Account'}
              </button>
            </form>
          </div>

          {/* Authorized Supervisors List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-600" /> Authorized Municipal Supervisors ({supervisors.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Active municipal supervisors authorized to triage complaints and manage field dispatches.
              </p>
            </div>

            {supervisors.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  No supervisors provisioned yet. Use the provisioning form on the left to authorize your first supervisor.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {supervisors.map((s) => (
                  <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{s.fullName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                          {s.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{s.email} • {s.phoneNumber}</p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {s.accountStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER REGISTRY */}
      {activeTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Registered Accounts & Roles Registry</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Municipal user profiles and their verified system roles. Public signups are strictly granted the resident role.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{u.fullName}</span>
                      <span className="text-slate-400 text-[11px]">{u.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.role === 'admin' || u.role === 'administrator'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : u.role === 'supervisor'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : u.role === 'cleaner'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.accountStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {u.accountStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.phoneNumber}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOCALITIES */}
      {activeTab === 'localities' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Municipal Service Localities (Wards)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active municipal wards where waste complaint reporting and cleaner dispatch are permitted.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {localities.map((loc) => (
              <div
                key={loc.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-xs text-slate-900">{loc.name}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {loc.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Immutable Municipal Audit Trail</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audited status transitions, responsible actors, timestamps, and notes.
            </p>
          </div>

          {allAuditHistory.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No transition events recorded in audit log yet.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Tracking Code</th>
                      <th className="py-3 px-4">Transition</th>
                      <th className="py-3 px-4">Responsible Actor</th>
                      <th className="py-3 px-4">Audit Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allAuditHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {h.trackingCode}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">
                            {h.previousStatus ? `${h.previousStatus} → ` : 'Created: '}
                            <span className="text-emerald-700">{h.newStatus}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{h.actorName}</span>
                          <span className="text-slate-400 text-[10px] block capitalize">({h.actorRole})</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs">{h.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
