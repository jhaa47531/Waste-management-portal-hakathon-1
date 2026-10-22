/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  UserProfile,
  Complaint,
  Locality,
  CleanerServiceArea,
  CleanerApplication,
  UrgencyLevel,
} from '../types/index.ts';
import { portalStore } from '../services/store.ts';
import { StatusBadge, UrgencyBadge } from './StatusBadge.tsx';
import { ComplaintTimeline } from './ComplaintTimeline.tsx';
import {
  CheckCircle2,
  XCircle,
  PhoneCall,
  UserCheck,
  AlertTriangle,
  MapPin,
  ExternalLink,
  Search,
  HardHat,
  RotateCcw,
  X,
  FileCheck,
  ClipboardList,
  Eye,
  Check,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface SupervisorViewProps {
  currentUser: UserProfile;
  complaints: Complaint[];
  localities: Locality[];
  users: UserProfile[];
  serviceAreas: CleanerServiceArea[];
  cleanerApplications: CleanerApplication[];
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  currentUser,
  complaints,
  localities,
  users,
  serviceAreas,
  cleanerApplications = [],
}) => {
  const [viewMode, setViewMode] = useState<'queue' | 'cleaners'>('queue');

  // Complaints Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [localityFilter, setLocalityFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected complaint for review/assignment/action
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Action states for complaint modal
  const [actionTab, setActionTab] = useState<'verify' | 'assign' | 'review' | 'reject' | 'details'>('details');
  const [urgencySelection, setUrgencySelection] = useState<UrgencyLevel>('normal');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);

  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const [selectedCleanerId, setSelectedCleanerId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const [returnNote, setReturnNote] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState('');

  // Cleaner Application Review State
  const [cleanerAppNotes, setCleanerAppNotes] = useState<Record<string, string>>({});
  const [appLocalitySelection, setAppLocalitySelection] = useState<Record<string, string[]>>({});
  const [appReviewMsg, setAppReviewMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Operational metrics
  const submittedCount = complaints.filter((c) => c.status === 'submitted').length;
  const verifiedCount = complaints.filter((c) => c.status === 'verified').length;
  const inProgressCount = complaints.filter((c) => c.status === 'in_progress').length;
  const awaitingVerificationCount = complaints.filter((c) => c.status === 'awaiting_verification').length;
  const completedCount = complaints.filter((c) => c.status === 'completed').length;
  const pendingCleanersCount = cleanerApplications.filter((a) => a.status === 'pending').length;

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (localityFilter !== 'all' && c.localityId !== localityFilter) return false;
    if (urgencyFilter !== 'all' && c.urgency !== urgencyFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const match =
        c.trackingCode.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.residentName.toLowerCase().includes(q) ||
        c.residentPhone.includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Approved cleaners with service areas matching the selected complaint's locality
  const eligibleCleaners = selectedComplaint
    ? users.filter((u) => {
        if (u.role !== 'cleaner' || u.accountStatus !== 'active') return false;
        // Must have an approved service area in this complaint's locality
        return serviceAreas.some(
          (sa) => sa.cleanerId === u.id && sa.localityId === selectedComplaint.localityId && sa.isApproved
        );
      })
    : [];

  const handleOpenAction = (
    complaint: Complaint,
    tab: 'verify' | 'assign' | 'review' | 'reject' | 'details'
  ) => {
    setSelectedComplaint(complaint);
    setActionTab(tab);
    setUrgencySelection(complaint.urgency);
    setVerifyNotes('');
    setPhoneConfirmed(Boolean(complaint.residentConfirmedAt));
    setRejectionReason('');
    setRejectionError(null);
    setSelectedCleanerId('');
    setAssignNotes('');
    setAssignError(null);
    setReturnNote('');
    setReturnError(null);
    setApproveNotes('');
  };

  // Complaint Workflow Actions
  const handleVerify = async () => {
    if (!selectedComplaint) return;
    const res = await portalStore.verifyComplaint(selectedComplaint.id, urgencySelection, verifyNotes);
    if (res.success) {
      setSelectedComplaint(null);
    }
  };

  const handleReject = async () => {
    if (!selectedComplaint) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      setRejectionError('Rejection reason must be at least 5 characters.');
      return;
    }
    const res = await portalStore.rejectComplaint(selectedComplaint.id, rejectionReason);
    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setRejectionError(res.error || 'Failed to reject complaint.');
    }
  };

  const handleAssign = async () => {
    if (!selectedComplaint) return;
    if (!selectedCleanerId) {
      setAssignError('Please select an authorized approved cleaner.');
      return;
    }
    const res = await portalStore.assignCleaner(selectedComplaint.id, selectedCleanerId, assignNotes);
    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setAssignError(res.error || 'Failed to assign cleaner.');
    }
  };

  const handleApproveCompletion = async () => {
    if (!selectedComplaint) return;
    const res = await portalStore.approveCompletion(selectedComplaint.id, approveNotes);
    if (res.success) {
      setSelectedComplaint(null);
    }
  };

  const handleReturnToProgress = async () => {
    if (!selectedComplaint) return;
    if (!returnNote.trim() || returnNote.trim().length < 5) {
      setReturnError('Please enter an explanatory note describing why the work must be redone.');
      return;
    }
    const res = await portalStore.returnToProgress(selectedComplaint.id, returnNote);
    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setReturnError(res.error || 'Failed to return complaint.');
    }
  };

  // Cleaner Application Review Actions
  const handleToggleLocalityForApp = (cleanerId: string, localityId: string) => {
    setAppLocalitySelection((prev) => {
      const current = prev[cleanerId] || [];
      const updated = current.includes(localityId)
        ? current.filter((id) => id !== localityId)
        : [...current, localityId];
      return { ...prev, [cleanerId]: updated };
    });
  };

  const handleReviewCleanerApp = async (app: CleanerApplication, decision: 'approved' | 'rejected') => {
    setAppReviewMsg(null);
    const selectedLocs =
      appLocalitySelection[app.cleanerId] ||
      serviceAreas.filter((sa) => sa.cleanerId === app.cleanerId).map((sa) => sa.localityId);

    if (decision === 'approved' && selectedLocs.length === 0) {
      setAppReviewMsg({
        text: 'Please authorize at least one service locality for this approved cleaner.',
        error: true,
      });
      return;
    }

    const notes = cleanerAppNotes[app.id] || '';
    const res = await portalStore.reviewCleanerApplication(app.id, decision, selectedLocs, notes);

    if (res.success) {
      setAppReviewMsg({
        text: `Cleaner application for ${app.cleanerName} successfully ${decision}.`,
      });
      setTimeout(() => setAppReviewMsg(null), 5000);
    } else {
      setAppReviewMsg({ text: res.error || 'Review failed.', error: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white rounded-2xl p-2 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'queue'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            Operational Complaints Queue ({complaints.length})
          </button>
          <button
            onClick={() => setViewMode('cleaners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'cleaners'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HardHat className="w-4 h-4 text-amber-400" />
            Cleaner Applications ({pendingCleanersCount} Pending)
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: OPERATIONAL COMPLAINTS QUEUE */}
      {viewMode === 'queue' && (
        <div className="space-y-6">
          {/* Workflow Stage Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => setStatusFilter(statusFilter === 'submitted' ? 'all' : 'submitted')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'submitted'
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-white border-slate-200 hover:border-amber-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                1. New Submissions
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900">{submittedCount}</span>
                <span className="text-xs text-slate-500">Needs Triage</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'verified' ? 'all' : 'verified')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'verified'
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300'
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                2. Verified
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900">{verifiedCount}</span>
                <span className="text-xs text-slate-500">Assign Cleaner</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'in_progress'
                  ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-300'
                  : 'bg-white border-slate-200 hover:border-purple-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                3. In Progress
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900">{inProgressCount}</span>
                <span className="text-xs text-slate-500">On-Site Work</span>
              </div>
            </div>

            <div
              onClick={() =>
                setStatusFilter(
                  statusFilter === 'awaiting_verification' ? 'all' : 'awaiting_verification'
                )
              }
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'awaiting_verification'
                  ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-300'
                  : 'bg-white border-slate-200 hover:border-orange-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                4. Completion Review
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900">{awaitingVerificationCount}</span>
                <span className="text-xs text-slate-500">Audit Photos</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
              className={`p-4 rounded-xl border cursor-pointer transition-all col-span-2 sm:col-span-1 ${
                statusFilter === 'completed'
                  ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300'
                  : 'bg-white border-slate-200 hover:border-emerald-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                5. Completed
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900">{completedCount}</span>
                <span className="text-xs text-slate-500">Signed Off</span>
              </div>
            </div>
          </div>

          {/* Operational Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracking code, resident phone, address, or name..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium"
              >
                <option value="all">All Statuses ({complaints.length})</option>
                <option value="submitted">1. Submitted ({submittedCount})</option>
                <option value="verified">2. Verified ({verifiedCount})</option>
                <option value="assigned">3. Assigned</option>
                <option value="in_progress">4. In Progress ({inProgressCount})</option>
                <option value="awaiting_verification">
                  5. Awaiting Review ({awaitingVerificationCount})
                </option>
                <option value="completed">6. Completed ({completedCount})</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={localityFilter}
                onChange={(e) => setLocalityFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium"
              >
                <option value="all">All Localities</option>
                {localities.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium"
              >
                <option value="all">All Urgency</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              {(statusFilter !== 'all' || localityFilter !== 'all' || urgencyFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setLocalityFilter('all');
                    setUrgencyFilter('all');
                    setSearchQuery('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Complaints Table / List */}
          {filteredComplaints.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Complaints Match Filters</h3>
              <p className="text-xs text-slate-500 mt-1">
                There are no complaints under this status or locality filter.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tracking & Locality</th>
                      <th className="py-3 px-4">Resident Info</th>
                      <th className="py-3 px-4">Status & Urgency</th>
                      <th className="py-3 px-4">Assigned Cleaner</th>
                      <th className="py-3 px-4">Evidence</th>
                      <th className="py-3 px-4 text-right">Workflow Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredComplaints.map((c) => {
                      const initialPhoto = c.photos.find((p) => p.photoType === 'resident_initial');
                      const completionPhoto = c.photos.find((p) => p.photoType === 'cleaner_completion');

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 block">
                              {c.trackingCode}
                            </span>
                            <span className="text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {c.localityName}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                              {c.address}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 block">{c.residentName}</span>
                            <a
                              href={`tel:${c.residentPhone}`}
                              className="text-emerald-700 hover:underline flex items-center gap-1 font-mono text-[11px] mt-0.5"
                            >
                              <PhoneCall className="w-3 h-3" /> {c.residentPhone}
                            </a>
                          </td>

                          <td className="py-3.5 px-4 space-y-1">
                            <div>
                              <StatusBadge status={c.status} size="sm" />
                            </div>
                            <div>
                              <UrgencyBadge urgency={c.urgency} />
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {c.assignedCleanerName ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                                <HardHat className="w-3 h-3 text-amber-600" />
                                {c.assignedCleanerName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {initialPhoto && (
                                <img
                                  src={initialPhoto.url}
                                  alt="Initial"
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 cursor-pointer"
                                  onClick={() => handleOpenAction(c, 'details')}
                                  title="Initial Resident Photo"
                                />
                              )}
                              {completionPhoto && (
                                <img
                                  src={completionPhoto.url}
                                  alt="Completion"
                                  className="w-8 h-8 rounded-lg object-cover border border-emerald-300 ring-1 ring-emerald-400 cursor-pointer"
                                  onClick={() => handleOpenAction(c, 'review')}
                                  title="Cleaner Completion Photo"
                                />
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            {c.status === 'submitted' && (
                              <button
                                onClick={() => handleOpenAction(c, 'verify')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Verify
                              </button>
                            )}

                            {c.status === 'verified' && (
                              <button
                                onClick={() => handleOpenAction(c, 'assign')}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1"
                              >
                                <HardHat className="w-3.5 h-3.5" /> Assign
                              </button>
                            )}

                            {c.status === 'awaiting_verification' && (
                              <button
                                onClick={() => handleOpenAction(c, 'review')}
                                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1"
                              >
                                <FileCheck className="w-3.5 h-3.5" /> Review Proof
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenAction(c, 'details')}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: CLEANER APPLICATIONS REVIEW */}
      {viewMode === 'cleaners' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cleaner Applications Awaiting Supervisor Review
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Review applicant identity, verify preferred service localities, and authorize or reject their municipal cleaner credential.
              </p>
            </div>

            {appReviewMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  appReviewMsg.error
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                {appReviewMsg.error ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{appReviewMsg.text}</span>
              </div>
            )}

            {cleanerApplications.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <HardHat className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  No cleaner applications currently in the system.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cleanerApplications.map((app) => {
                  const applicantServiceAreas = serviceAreas.filter((sa) => sa.cleanerId === app.cleanerId);
                  const selectedLocs =
                    appLocalitySelection[app.cleanerId] ||
                    applicantServiceAreas.map((sa) => sa.localityId);

                  return (
                    <div
                      key={app.id}
                      className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                        app.status === 'pending'
                          ? 'bg-white border-amber-300 shadow-xs ring-1 ring-amber-200'
                          : app.status === 'approved'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900">{app.cleanerName}</h4>
                            <p className="text-xs text-slate-500">{app.cleanerEmail}</p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              app.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : app.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>

                        {/* Preferred Localities */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Preferred Municipal Service Localities:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {applicantServiceAreas.map((sa) => {
                              const isChecked = selectedLocs.includes(sa.localityId);
                              return (
                                <button
                                  type="button"
                                  key={sa.localityId}
                                  onClick={() =>
                                    app.status === 'pending' &&
                                    handleToggleLocalityForApp(app.cleanerId, sa.localityId)
                                  }
                                  disabled={app.status !== 'pending'}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                                    isChecked
                                      ? 'bg-emerald-600 text-white border-emerald-700'
                                      : 'bg-white text-slate-700 border-slate-300'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3" />}
                                  {sa.localityName}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Review Notes */}
                        {app.status === 'pending' ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Supervisor Review Notes (Optional):
                            </label>
                            <input
                              type="text"
                              value={cleanerAppNotes[app.id] || ''}
                              onChange={(e) =>
                                setCleanerAppNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                              }
                              placeholder="e.g. Identity and residency verified."
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
                            />
                          </div>
                        ) : (
                          app.reviewNotes && (
                            <p className="text-xs text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200">
                              <span className="font-bold">Supervisor Note:</span> {app.reviewNotes}
                            </p>
                          )
                        )}
                      </div>

                      {/* Action buttons if pending */}
                      {app.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleReviewCleanerApp(app, 'approved')}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve Application
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewCleanerApp(app, 'rejected')}
                            className="py-2 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPLAINT MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-xl space-y-5 my-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-base">
                    {selectedComplaint.trackingCode}
                  </span>
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <UrgencyBadge urgency={selectedComplaint.urgency} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedComplaint.address} • {selectedComplaint.localityName}
                </p>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR IN MODAL */}
            <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
              {selectedComplaint.status === 'submitted' && (
                <button
                  onClick={() => setActionTab('verify')}
                  className={`pb-2 border-b-2 ${
                    actionTab === 'verify' ? 'border-emerald-600 text-emerald-800' : 'text-slate-500'
                  }`}
                >
                  Verify Submission
                </button>
              )}
              {selectedComplaint.status === 'verified' && (
                <button
                  onClick={() => setActionTab('assign')}
                  className={`pb-2 border-b-2 ${
                    actionTab === 'assign' ? 'border-blue-600 text-blue-800' : 'text-slate-500'
                  }`}
                >
                  Assign Cleaner
                </button>
              )}
              {selectedComplaint.status === 'awaiting_verification' && (
                <button
                  onClick={() => setActionTab('review')}
                  className={`pb-2 border-b-2 ${
                    actionTab === 'review' ? 'border-orange-600 text-orange-800' : 'text-slate-500'
                  }`}
                >
                  Audit Completion Proof
                </button>
              )}
              <button
                onClick={() => setActionTab('details')}
                className={`pb-2 border-b-2 ${
                  actionTab === 'details' ? 'border-slate-900 text-slate-900' : 'text-slate-500'
                }`}
              >
                Details & History
              </button>
            </div>

            {/* ACTION 1: VERIFY */}
            {actionTab === 'verify' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <PhoneCall className="w-4 h-4 text-blue-600" /> Resident Phone Contact Verification
                  </div>
                  <p>
                    Call resident <span className="font-semibold">{selectedComplaint.residentName}</span> at{' '}
                    <a
                      href={`tel:${selectedComplaint.residentPhone}`}
                      className="font-mono font-bold underline text-blue-700"
                    >
                      {selectedComplaint.residentPhone}
                    </a>{' '}
                    to confirm location accuracy before dispatch.
                  </p>
                  <label className="flex items-center gap-2 pt-1 font-semibold text-blue-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={phoneConfirmed}
                      onChange={(e) => setPhoneConfirmed(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    I confirm telephone contact was made with the resident.
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Set Urgency Level</label>
                    <select
                      value={urgencySelection}
                      onChange={(e) => setUrgencySelection(e.target.value as UrgencyLevel)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Supervisor Notes</label>
                    <input
                      type="text"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="e.g. Verified by phone call."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleVerify}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Verify Complaint for Cleaner Dispatch
                  </button>
                  <button
                    onClick={() => setActionTab('reject')}
                    className="py-2.5 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* ACTION: REJECT */}
            {actionTab === 'reject' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5">
                  <span className="font-bold block">Reject Complaint</span>
                  <p>
                    Provide a clear, mandatory reason why this complaint cannot be verified (e.g. unreachable resident, duplicate report, private property).
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter rejection reason (minimum 5 characters)..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
                  />
                  {rejectionError && <p className="text-rose-600 mt-1">{rejectionError}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReject}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => setActionTab('details')}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ACTION 2: ASSIGN CLEANER */}
            {actionTab === 'assign' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                  <p>
                    Complaint Locality: <span className="font-bold">{selectedComplaint.localityName}</span>.
                    Only active cleaners authorized by supervisors for this locality are eligible for assignment.
                  </p>
                </div>

                {eligibleCleaners.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> No Authorized Cleaners for{' '}
                      {selectedComplaint.localityName}
                    </div>
                    <p>
                      There are currently no active cleaners with approved service coverage in this locality.
                      Go to the <span className="font-bold">Cleaner Applications</span> tab to approve cleaner locality coverage.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Select Approved Cleaner *
                    </label>
                    <select
                      value={selectedCleanerId}
                      onChange={(e) => setSelectedCleanerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="">-- Choose an eligible cleaner --</option>
                      {eligibleCleaners.map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.fullName} ({cl.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dispatch Instructions</label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="e.g. Priority corner near bus stop."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                {assignError && <p className="text-rose-600 text-xs">{assignError}</p>}

                <button
                  onClick={handleAssign}
                  disabled={eligibleCleaners.length === 0}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-40"
                >
                  Assign Cleaner
                </button>
              </div>
            )}

            {/* ACTION 3: AUDIT COMPLETION PROOF */}
            {actionTab === 'review' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  {/* Initial Photo */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 space-y-1">
                    <span className="font-bold text-slate-800 block text-[11px]">
                      1. Resident Initial Evidence
                    </span>
                    {selectedComplaint.photos.find((p) => p.photoType === 'resident_initial') ? (
                      <img
                        src={
                          selectedComplaint.photos.find((p) => p.photoType === 'resident_initial')!.url
                        }
                        alt="Initial"
                        className="w-full h-40 object-cover rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-slate-400">
                        No initial photo
                      </div>
                    )}
                  </div>

                  {/* Cleaner After Photo */}
                  <div className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/40 p-2 space-y-1">
                    <span className="font-bold text-emerald-900 block text-[11px]">
                      2. Cleaner After-Cleaning Proof
                    </span>
                    {selectedComplaint.photos.find((p) => p.photoType === 'cleaner_completion') ? (
                      <img
                        src={
                          selectedComplaint.photos.find((p) => p.photoType === 'cleaner_completion')!.url
                        }
                        alt="Completion"
                        className="w-full h-40 object-cover rounded-lg border border-emerald-300 ring-1 ring-emerald-400"
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-slate-400">
                        No completion photo
                      </div>
                    )}
                  </div>
                </div>

                {/* Supervisor Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <span className="font-bold text-emerald-900 block">Approve & Sign Off</span>
                    <input
                      type="text"
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      placeholder="Sign-off notes..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <button
                      onClick={handleApproveCompletion}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve Resolution
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                    <span className="font-bold text-rose-900 block">Return for Rework</span>
                    <input
                      type="text"
                      value={returnNote}
                      onChange={(e) => setReturnNote(e.target.value)}
                      placeholder="Explanation for rework..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    {returnError && <p className="text-[11px] text-rose-600">{returnError}</p>}
                    <button
                      onClick={handleReturnToProgress}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Return to Cleaner
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DETAILS & TIMELINE */}
            {actionTab === 'details' && (
              <div className="space-y-4 text-xs">
                {/* Photo Gallery */}
                <div className="grid grid-cols-2 gap-3">
                  {selectedComplaint.photos.map((photo) => (
                    <div key={photo.id} className="rounded-xl overflow-hidden border border-slate-200">
                      <img src={photo.url} alt={photo.photoType} className="w-full h-36 object-cover" />
                      <div className="p-2 bg-slate-900 text-white text-[10px] flex justify-between">
                        <span>
                          {photo.photoType === 'resident_initial' ? 'Initial Photo' : 'Completion Proof'}
                        </span>
                        <span>{new Date(photo.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waste Type:</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedComplaint.wasteType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GPS Coordinates:</span>
                    <span className="font-mono text-slate-800">
                      {selectedComplaint.latitude.toFixed(6)}, {selectedComplaint.longitude.toFixed(6)}
                    </span>
                  </div>
                  {selectedComplaint.remark && (
                    <div className="pt-1 border-t border-slate-200">
                      <span className="text-slate-500 block">Resident Remark:</span>
                      <p className="text-slate-700 mt-0.5">{selectedComplaint.remark}</p>
                    </div>
                  )}
                  {selectedComplaint.rejectionReason && (
                    <div className="pt-1 border-t border-rose-200 text-rose-800">
                      <span className="font-bold block">Rejection Reason:</span>
                      <p className="mt-0.5">{selectedComplaint.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Audit Timeline */}
                <ComplaintTimeline
                  currentStatus={selectedComplaint.status}
                  history={selectedComplaint.history}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
