/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Locality, CleanerApplication, CleanerServiceArea, Complaint } from '../types/index.ts';
import { portalStore } from '../services/store.ts';
import { StatusBadge } from './StatusBadge.tsx';
import {
  ShieldAlert,
  UserCheck,
  UserPlus,
  CheckCircle2,
  XCircle,
  HardHat,
  MapPin,
  Clock,
  Check,
  Building,
  History,
  AlertCircle,
} from 'lucide-react';

interface AdminViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  localities: Locality[];
  cleanerApplications: CleanerApplication[];
  serviceAreas: CleanerServiceArea[];
  complaints: Complaint[];
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  users,
  localities,
  cleanerApplications,
  serviceAreas,
  complaints,
}) => {
  const [activeTab, setActiveTab] = useState<'supervisors' | 'cleaners' | 'audit'>('supervisors');

  // Supervisor Provisioning Form
  const [supFullName, setSupFullName] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [provisionMsg, setProvisionMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Cleaner Application Review State
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedAppLocalityMap, setSelectedAppLocalityMap] = useState<Record<string, string[]>>({});

  const supervisors = users.filter((u) => u.role === 'supervisor');
  const cleaners = users.filter((u) => u.role === 'cleaner');

  // System audit log: all history entries flat sorted by date descending
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

    const res = await portalStore.provisionSupervisor({
      email: supEmail,
      fullName: supFullName,
      phoneNumber: supPhone,
    });

    if (res.success && res.user) {
      setProvisionMsg({
        text: `Supervisor account for ${res.user.fullName} (${res.user.email}) successfully provisioned with active privileged status.`,
      });
      setSupFullName('');
      setSupEmail('');
      setSupPhone('');
      setTimeout(() => setProvisionMsg(null), 5000);
    } else {
      setProvisionMsg({ text: res.error || 'Provisioning failed.', error: true });
    }
  };

  const handleReviewCleaner = async (appId: string, decision: 'approved' | 'rejected') => {
    const app = cleanerApplications.find((a) => a.id === appId);
    const approvedLocs = (app && selectedAppLocalityMap[app.cleanerId]) || [];

    const res = await portalStore.reviewCleanerApplication(appId, decision, approvedLocs, reviewNotes);
    if (res.success) {
      setReviewNotes('');
    }
  };

  const handleToggleLocalityForApp = (cleanerId: string, localityId: string) => {
    setSelectedAppLocalityMap((prev) => {
      const current = prev[cleanerId] || [];
      const updated = current.includes(localityId)
        ? current.filter((id) => id !== localityId)
        : [...current, localityId];
      return { ...prev, [cleanerId]: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md flex items-center justify-between">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/30">
            Administrator Console
          </span>
          <h2 className="text-xl font-bold mt-2">
            Privileged Account Management & Security Governance
          </h2>
          <p className="text-xs text-purple-200 mt-1 max-w-xl">
            Provision operational supervisor credentials, review cleaner access applications, authorize municipal service localities, and audit system transitions.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-4 text-center">
          <div className="p-3 rounded-xl bg-purple-800/40 border border-purple-700/50">
            <span className="text-2xl font-black">{supervisors.length}</span>
            <p className="text-[10px] text-purple-200 uppercase font-bold">Supervisors</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-800/40 border border-purple-700/50">
            <span className="text-2xl font-black">{cleaners.length}</span>
            <p className="text-[10px] text-purple-200 uppercase font-bold">Cleaners</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('supervisors')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'supervisors'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Provision Supervisors ({supervisors.length})
        </button>
        <button
          onClick={() => setActiveTab('cleaners')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'cleaners'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardHat className="w-4 h-4" /> Cleaner Approvals & Localities
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" /> System Audit Trail ({allAuditHistory.length})
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: PROVISION SUPERVISOR ACCOUNTS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'supervisors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provisioning Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" /> Provision Supervisor Account
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Authorized staff accounts must be provisioned by the Administrator. Public signup can never yield supervisor privileges.
              </p>
            </div>

            {provisionMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  provisionMsg.error
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {provisionMsg.error ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>{provisionMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleProvisionSupervisor} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={supFullName}
                  onChange={(e) => setSupFullName(e.target.value)}
                  placeholder="e.g. Inspector Marcus Vance"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Email *
                </label>
                <input
                  type="email"
                  required
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="e.g. marcus.supervisor@civicwaste.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="e.g. +1-555-0188"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Provision Supervisor
              </button>
            </form>
          </div>

          {/* Existing Supervisors List */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorized Municipal Supervisors
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                These users hold active privileges to inspect complaints, verify resident phone contact, dispatch cleaners, and sign off completion evidence.
              </p>
            </div>

            {supervisors.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No supervisors provisioned yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use the provisioning form on the left to authorize supervisor accounts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {supervisors.map((sup) => (
                  <div
                    key={sup.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">
                        {sup.fullName}
                      </p>
                      <p className="text-slate-500">{sup.email} • {sup.phoneNumber}</p>
                      <p className="text-[10px] text-slate-400">
                        Provisioned: {new Date(sup.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                      Active Supervisor
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: CLEANER APPLICATIONS & SERVICE LOCALITY APPROVALS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'cleaners' && (
        <div className="space-y-6">
          {/* Pending Cleaner Applications */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Pending Cleaner Applications
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Applicants remain pending until approved. You can approve their account and simultaneously grant verified service area localities.
              </p>
            </div>

            {cleanerApplications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No pending cleaner applications.</p>
            ) : (
              <div className="space-y-4">
                {cleanerApplications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {app.cleanerName} ({app.cleanerEmail})
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          Application submitted: {new Date(app.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 capitalize">
                        {app.status}
                      </span>
                    </div>

                    {app.status === 'pending' && (
                      <div className="space-y-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/60">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          Select Service Localities to Authorize Upon Approval:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {localities.map((loc) => {
                            const isChecked = (
                              selectedAppLocalityMap[app.cleanerId] || []
                            ).includes(loc.id);

                            return (
                              <label
                                key={loc.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                                  isChecked
                                    ? 'bg-purple-100 dark:bg-purple-950 border-purple-400 font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleLocalityForApp(app.cleanerId, loc.id)}
                                  className="w-3.5 h-3.5 text-purple-600 rounded"
                                />
                                <span className="truncate">{loc.name}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => handleReviewCleaner(app.id, 'rejected')}
                            className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 font-bold text-xs hover:bg-rose-50"
                          >
                            Reject Application
                          </button>
                          <button
                            onClick={() => handleReviewCleaner(app.id, 'approved')}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve Cleaner & Authorize Areas
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Cleaners & Locality Coverage Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Active Cleaners & Approved Locality Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toggle approval checkboxes to immediately authorize or revoke a cleaner's eligibility for municipal dispatch in specific wards.
              </p>
            </div>

            {cleaners.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <HardHat className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No approved cleaners currently registered.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When cleaners register and submit applications, approve them above to configure locality coverage.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cleaners.map((cleaner) => (
                  <div
                    key={cleaner.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {cleaner.fullName}
                        </p>
                        <p className="text-slate-500 text-[11px]">{cleaner.email} • {cleaner.phoneNumber}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Active
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        Approved Municipal Coverage:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {localities.map((loc) => {
                          const sa = serviceAreas.find(
                            (s) => s.cleanerId === cleaner.id && s.localityId === loc.id
                          );
                          const isApproved = Boolean(sa?.isApproved);

                          return (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() =>
                                portalStore.toggleCleanerLocalityApproval(
                                  cleaner.id,
                                  loc.id,
                                  !isApproved
                                )
                              }
                              className={`p-2 rounded-lg border text-left flex items-center justify-between text-[11px] font-semibold transition-all ${
                                isApproved
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400'
                              }`}
                            >
                              <span className="truncate">{loc.name}</span>
                              {isApproved && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: SYSTEM AUDIT TRAIL */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" /> Immutable System Status Audit Trail
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Every status transition across all complaints is strictly logged with actor identity, timestamp, and audit notes. In PostgreSQL, this is enforced by a database trigger preventing forged or modified history.
            </p>
          </div>

          {allAuditHistory.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                No status transitions recorded yet.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Audit history entries will appear here automatically as complaints move through submission, verification, assignment, cleaning, and review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Tracking Code</th>
                    <th className="py-2.5 px-3">Transition</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allAuditHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-blue-600 dark:text-blue-400">
                        {entry.trackingCode}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {entry.previousStatus && (
                            <>
                              <StatusBadge status={entry.previousStatus} size="sm" />
                              <span className="text-slate-400 font-bold">→</span>
                            </>
                          )}
                          <StatusBadge status={entry.newStatus} size="sm" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                        {entry.actorName}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap capitalize text-slate-500">
                        {entry.actorRole}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {entry.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
