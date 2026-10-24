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
import { SignedPhoto } from './SignedPhoto.tsx';
import {
  isInitialComplaintPhoto,
  isCompletionComplaintPhoto,
  getComplaintPhotoLabel,
} from '../utils/rules.ts';
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
  Phone,
  ArrowRight,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface SupervisorViewProps {
  currentUser: UserProfile;
  complaints: Complaint[];
  localities: Locality[];
  users: UserProfile[];
  serviceAreas: CleanerServiceArea[];
  cleanerApplications?: CleanerApplication[];
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  currentUser,
  complaints,
  localities,
  users,
  serviceAreas,
  cleanerApplications = [],
}) => {
  const [viewMode, setViewMode] = useState<'queue' | 'cleaners' | 'my_cleaners'>('queue');
  const myCleaners = users.filter((u) => u.role === 'cleaner' && u.supervisorId === currentUser.id);

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
  const [isReturning, setIsReturning] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [approveError, setApproveError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

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

  // Approved cleaners with service areas matching the selected complaint's locality, with active team fallback
  const allActiveCleaners = users.filter((u) => u.role === 'cleaner' && u.accountStatus === 'active');
  const localityCleaners = selectedComplaint
    ? allActiveCleaners.filter((u) =>
        serviceAreas.some(
          (sa) => sa.cleanerId === u.id && sa.localityId === selectedComplaint.localityId && sa.isApproved
        )
      )
    : [];
  const eligibleCleaners = localityCleaners.length > 0 ? localityCleaners : allActiveCleaners;

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
    const targetId = selectedComplaint.id;
    const res = await portalStore.verifyComplaint(targetId, urgencySelection, verifyNotes);
    if (res.success) {
      // Smoothly transition to assign cleaner tab so supervisor can proceed immediately
      const refreshed = portalStore.getState().complaints.find((c) => c.id === targetId);
      if (refreshed) {
        setSelectedComplaint(refreshed);
        setActionTab('assign');
      } else {
        setSelectedComplaint(null);
      }
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
    setIsApproving(true);
    setApproveError(null);
    try {
      const res = await portalStore.approveCompletion(selectedComplaint.id, approveNotes);
      if (res.success) {
        setSelectedComplaint(null);
        setApproveNotes('');
      } else {
        setApproveError(res.error || 'Failed to approve resolution.');
      }
    } catch (err: any) {
      setApproveError(err?.message || 'Unexpected error while approving resolution.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReturnToProgress = async () => {
    if (!selectedComplaint) return;
    if (!returnNote.trim() || returnNote.trim().length < 5) {
      setReturnError('Please enter an explanatory note describing why the work must be redone (minimum 5 characters).');
      return;
    }
    setIsReturning(true);
    setReturnError(null);
    try {
      const res = await portalStore.returnToProgress(selectedComplaint.id, returnNote);
      if (res.success) {
        setSelectedComplaint(null);
        setReturnNote('');
      } else {
        setReturnError(res.error || 'Failed to return complaint to in-progress.');
      }
    } catch (err: any) {
      setReturnError(err?.message || 'Unexpected error while returning complaint.');
    } finally {
      setIsReturning(false);
    }
  };

  // Cleaner Application Review Actions
  const handleToggleLocalityForApp = (cleanerId: string, locId: string) => {
    setAppLocalitySelection((prev) => {
      const current = prev[cleanerId] || [];
      const updated = current.includes(locId)
        ? current.filter((id) => id !== locId)
        : [...current, locId];
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
    const assignedSupId = decision === 'approved' ? (app.assignedSupervisorId || currentUser?.id || null) : null;
    const res = await portalStore.reviewCleanerApplication(app.id, decision, selectedLocs, assignedSupId, notes);

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
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-2xs gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setViewMode('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'queue'
                ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-500" />
            <span>Operational Queue ({complaints.length})</span>
          </button>
          <button
            onClick={() => setViewMode('my_cleaners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'my_cleaners'
                ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4 text-blue-500" />
            <span>My Team ({myCleaners.length})</span>
          </button>
          <button
            onClick={() => setViewMode('cleaners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'cleaners'
                ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <HardHat className="w-4 h-4 text-amber-500" />
            <span>Cleaner Applications ({pendingCleanersCount} Pending)</span>
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
              className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-2xs ${
                statusFilter === 'submitted'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-300 dark:ring-amber-500/40'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                1. New Submissions
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {submittedCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Needs Triage</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'verified' ? 'all' : 'verified')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-2xs ${
                statusFilter === 'verified'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 ring-2 ring-blue-300 dark:ring-blue-500/40'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                2. Verified
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {verifiedCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Assign Cleaner</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-2xs ${
                statusFilter === 'in_progress'
                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 ring-2 ring-purple-300 dark:ring-purple-500/40'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-purple-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                3. In Progress
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {inProgressCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">On-Site Work</span>
              </div>
            </div>

            <div
              onClick={() =>
                setStatusFilter(
                  statusFilter === 'awaiting_verification' ? 'all' : 'awaiting_verification'
                )
              }
              className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-2xs ${
                statusFilter === 'awaiting_verification'
                  ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-400 dark:border-orange-700 ring-2 ring-orange-300 dark:ring-orange-500/40'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-orange-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                4. Audit Proof
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {awaitingVerificationCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Review Photos</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all col-span-2 sm:col-span-1 shadow-2xs ${
                statusFilter === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-300 dark:ring-emerald-500/40'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                5. Completed
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {completedCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Signed Off</span>
              </div>
            </div>
          </div>

          {/* Operational Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracking code, resident phone, address, or name..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium cursor-pointer"
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
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium cursor-pointer"
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
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium cursor-pointer"
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
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Complaints Table */}
          {filteredComplaints.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Complaints Match Filters</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                There are no complaints under this status or locality filter. Try adjusting your search query.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tracking & Locality</th>
                      <th className="py-3 px-4">Resident Info</th>
                      <th className="py-3 px-4">Status & Urgency</th>
                      <th className="py-3 px-4">Assigned Cleaner</th>
                      <th className="py-3 px-4">Evidence</th>
                      <th className="py-3 px-4 text-right">Workflow Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredComplaints.map((c) => {
                      const initialPhoto = c.photos.find((p) => p.photoType === 'resident_initial');
                      const completionPhoto = c.photos.find((p) => p.photoType === 'cleaner_completion');

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {c.trackingCode}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {c.localityName}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate max-w-xs">
                              {c.address}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">{c.residentName}</span>
                            <a
                              href={`tel:${c.residentPhone}`}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono text-[11px] mt-0.5"
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                                <HardHat className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                {c.assignedCleanerName}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {initialPhoto && (
                                <img
                                  src={initialPhoto.url}
                                  alt="Initial"
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleOpenAction(c, 'details')}
                                  title="Initial Resident Photo"
                                />
                              )}
                              {completionPhoto && (
                                <img
                                  src={completionPhoto.url}
                                  alt="Completion"
                                  className="w-9 h-9 rounded-lg object-cover border border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleOpenAction(c, 'review')}
                                  title="Cleaner Completion Photo"
                                />
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                            {c.status === 'submitted' && (
                              <button
                                onClick={() => handleOpenAction(c, 'verify')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Verify</span>
                              </button>
                            )}

                            {c.status === 'verified' && (
                              <button
                                onClick={() => handleOpenAction(c, 'assign')}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all"
                              >
                                <HardHat className="w-3.5 h-3.5" />
                                <span>Assign</span>
                              </button>
                            )}

                            {c.status === 'awaiting_verification' && (
                              <button
                                onClick={() => handleOpenAction(c, 'review')}
                                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Review Proof</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenAction(c, 'details')}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer transition-colors"
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

      {/* VIEW MODE: MY ASSIGNED CLEANERS */}
      {viewMode === 'my_cleaners' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                My Operational Cleaners Team ({myCleaners.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cleaners assigned directly to your supervisory operational scope by the municipal administrator.
              </p>
            </div>
          </div>

          {myCleaners.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No Cleaners Assigned to Your Team Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                Municipal administrators assign certified cleaners to supervisors upon application review or account provisioning. Contact your administrator to assign cleaners to your team.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCleaners.map((cleaner) => {
                const cleanerServiceAreas = serviceAreas.filter(
                  (sa) => sa.cleanerId === cleaner.id && sa.isApproved
                );
                const assignedTasks = complaints.filter(
                  (c) => c.assignedCleanerId === cleaner.id
                );
                const inProgressTasks = assignedTasks.filter(
                  (c) => c.status === 'in_progress'
                );
                const completedTasks = assignedTasks.filter(
                  (c) => c.status === 'completed'
                );

                return (
                  <div
                    key={cleaner.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                          {cleaner.fullName.charAt(0)}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{cleaner.fullName}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{cleaner.email}</p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          cleaner.accountStatus === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {cleaner.accountStatus}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 dark:text-slate-500">Phone: </span>
                      <span className="font-medium font-mono">{cleaner.phoneNumber}</span>
                    </div>

                    {/* Authorized Localities */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Authorized Service Localities:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {cleanerServiceAreas.length > 0 ? (
                          cleanerServiceAreas.map((sa) => (
                            <span
                              key={sa.localityId}
                              className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                            >
                              {sa.localityName}
                            </span>
                          ))
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 italic text-[11px]">
                            No service areas approved yet
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Work Assignment Counters */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                        <span className="text-sm font-black font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {assignedTasks.length}
                        </span>
                        <p className="text-[9px] uppercase font-bold text-slate-400">Assigned</p>
                      </div>
                      <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-xl">
                        <span className="text-sm font-black font-mono tabular-nums text-purple-800 dark:text-purple-300">
                          {inProgressTasks.length}
                        </span>
                        <p className="text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400">In Progress</p>
                      </div>
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl">
                        <span className="text-sm font-black font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                          {completedTasks.length}
                        </span>
                        <p className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Completed</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: CLEANER APPLICATIONS REVIEW */}
      {viewMode === 'cleaners' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cleaner Applications Awaiting Supervisor Review
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Review applicant identity, verify preferred service localities, and authorize or reject their municipal cleaner credential.
              </p>
            </div>

            {appReviewMsg && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                  appReviewMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
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
              <div className="p-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <HardHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                      className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 shadow-2xs ${
                        app.status === 'pending'
                          ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-200 dark:ring-amber-800/50'
                          : app.status === 'approved'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{app.cleanerName}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{app.cleanerEmail}</p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              app.status === 'approved'
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : app.status === 'rejected'
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>

                        {/* Preferred Localities */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
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
                                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                                    isChecked
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3" />}
                                  <span>{sa.localityName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Review Notes */}
                        {app.status === 'pending' ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                              Supervisor Review Notes (Optional):
                            </label>
                            <input
                              type="text"
                              value={cleanerAppNotes[app.id] || ''}
                              onChange={(e) =>
                                setCleanerAppNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                              }
                              placeholder="e.g. Identity and residency verified."
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
                            />
                          </div>
                        ) : (
                          app.reviewNotes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                              <span className="font-bold">Supervisor Note:</span> {app.reviewNotes}
                            </p>
                          )
                        )}
                      </div>

                      {/* Action buttons if pending */}
                      {app.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleReviewCleanerApp(app, 'approved')}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Application</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewCleanerApp(app, 'rejected')}
                            className="py-2.5 px-4 rounded-xl border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                    {selectedComplaint.trackingCode}
                  </span>
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <UrgencyBadge urgency={selectedComplaint.urgency} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedComplaint.address} • {selectedComplaint.localityName}
                </p>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR IN MODAL */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold">
              {selectedComplaint.status === 'submitted' && (
                <button
                  onClick={() => setActionTab('verify')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'verify'
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Verify Submission
                </button>
              )}
              {selectedComplaint.status === 'verified' && (
                <button
                  onClick={() => setActionTab('assign')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'assign'
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Assign Cleaner
                </button>
              )}
              {selectedComplaint.status === 'awaiting_verification' && (
                <button
                  onClick={() => setActionTab('review')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'review'
                      ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Audit Completion Proof
                </button>
              )}
              <button
                onClick={() => setActionTab('details')}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                  actionTab === 'details'
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Details & History
              </button>
            </div>

            {/* ACTION 1: VERIFY */}
            {actionTab === 'verify' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200 space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold">
                    <PhoneCall className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Resident Phone Contact Verification</span>
                  </div>
                  <p className="leading-relaxed">
                    Call resident <span className="font-semibold">{selectedComplaint.residentName}</span> at{' '}
                    <a
                      href={`tel:${selectedComplaint.residentPhone}`}
                      className="font-mono font-bold underline text-blue-700 dark:text-blue-400"
                    >
                      {selectedComplaint.residentPhone}
                    </a>{' '}
                    to confirm location accuracy before dispatch.
                  </p>
                  <label className="flex items-center gap-2 pt-1 font-semibold text-blue-900 dark:text-blue-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={phoneConfirmed}
                      onChange={(e) => setPhoneConfirmed(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>I confirm telephone contact was made with the resident.</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Set Urgency Level
                    </label>
                    <select
                      value={urgencySelection}
                      onChange={(e) => setUrgencySelection(e.target.value as UrgencyLevel)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Supervisor Notes
                    </label>
                    <input
                      type="text"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="e.g. Verified by phone call."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleVerify}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Complaint for Cleaner Dispatch</span>
                  </button>
                  <button
                    onClick={() => setActionTab('reject')}
                    className="py-3 px-4 rounded-xl border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold cursor-pointer transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* ACTION: REJECT */}
            {actionTab === 'reject' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1.5 shadow-2xs">
                  <span className="font-bold block">Reject Complaint</span>
                  <p className="leading-relaxed">
                    Provide a clear, mandatory reason why this complaint cannot be verified (e.g. unreachable resident, duplicate report, private property).
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Rejection Reason *
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter rejection reason (minimum 5 characters)..."
                    className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                  />
                  {rejectionError && <p className="text-rose-600 dark:text-rose-400 mt-1">{rejectionError}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReject}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer transition-colors"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => setActionTab('details')}
                    className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ACTION 2: ASSIGN CLEANER */}
            {actionTab === 'assign' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-2xs">
                  <p>
                    Complaint Locality: <span className="font-bold">{selectedComplaint.localityName}</span>.
                    Only active cleaners authorized by supervisors for this locality are eligible for assignment.
                  </p>
                </div>

                {eligibleCleaners.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>No Authorized Cleaners for {selectedComplaint.localityName}</span>
                    </div>
                    <p className="leading-relaxed">
                      There are currently no active cleaners with approved service coverage in this locality.
                      Go to the <span className="font-bold">Cleaner Applications</span> tab to approve cleaner locality coverage.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Select Approved Cleaner *
                    </label>
                    <select
                      value={selectedCleanerId}
                      onChange={(e) => setSelectedCleanerId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">-- Choose an eligible cleaner --</option>
                      {eligibleCleaners.map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.fullName} {cl.supervisorId === currentUser.id ? '★ (My Team)' : ''} ({cl.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Dispatch Instructions</label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="e.g. Priority corner near bus stop."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                {assignError && <p className="text-rose-600 dark:text-rose-400 text-xs">{assignError}</p>}

                <button
                  onClick={handleAssign}
                  disabled={eligibleCleaners.length === 0}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-40 transition-colors"
                >
                  Assign Cleaner
                </button>
              </div>
            )}

            {/* ACTION 3: AUDIT COMPLETION PROOF */}
            {actionTab === 'review' && (() => {
              const initialPhoto = selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType));
              const completionPhoto = selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType));

              return (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Initial Photo */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/50 p-2.5 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                          1. Resident Initial Evidence
                        </span>
                        {initialPhoto && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(initialPhoto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {initialPhoto ? (
                        <SignedPhoto
                          src={initialPhoto.url}
                          storagePath={initialPhoto.storagePath}
                          alt="Resident Initial Report Photo"
                          className="w-full h-44 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="h-44 flex flex-col items-center justify-center text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                          <Eye className="w-6 h-6 mb-1 text-slate-300 dark:text-slate-600" />
                          <span className="text-xs">No initial photo</span>
                        </div>
                      )}
                    </div>

                    {/* Cleaner After Photo */}
                    <div className="border border-emerald-200 dark:border-emerald-800 rounded-2xl overflow-hidden bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 dark:text-emerald-300 block text-[11px]">
                          2. Cleaner After-Cleaning Proof
                        </span>
                        {completionPhoto && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                            {new Date(completionPhoto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {completionPhoto ? (
                        <SignedPhoto
                          src={completionPhoto.url}
                          storagePath={completionPhoto.storagePath}
                          alt="Cleaner After-Cleaning Completion Proof"
                          className="w-full h-44 object-cover rounded-xl border border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400"
                        />
                      ) : (
                        <div className="h-44 flex flex-col items-center justify-center text-slate-400 bg-emerald-50/30 dark:bg-emerald-950/30 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800">
                          <AlertTriangle className="w-6 h-6 mb-1 text-amber-500/70" />
                          <span className="text-xs font-semibold">No completion photo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Supervisor Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5 shadow-2xs">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200 block">Approve & Sign Off</span>
                      <input
                        type="text"
                        value={approveNotes}
                        onChange={(e) => setApproveNotes(e.target.value)}
                        placeholder="Sign-off audit notes..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      {approveError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                          {approveError}
                        </p>
                      )}
                      <button
                        onClick={handleApproveCompletion}
                        disabled={isApproving}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        {isApproving ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Approving Completion...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve Resolution</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2.5 shadow-2xs">
                      <span className="font-bold text-rose-900 dark:text-rose-200 block">Return for Rework</span>
                      <input
                        type="text"
                        value={returnNote}
                        onChange={(e) => setReturnNote(e.target.value)}
                        placeholder="Explanation for rework (min 5 chars)..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                      {returnError && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{returnError}</p>}
                      <button
                        onClick={handleReturnToProgress}
                        disabled={isReturning}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        {isReturning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Returning to Cleaner...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            <span>Return to Cleaner</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* DETAILS & TIMELINE */}
            {actionTab === 'details' && (
              <div className="space-y-4 text-xs">
                {/* Photo Gallery */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedComplaint.photos.map((photo) => (
                    <div key={photo.id} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <SignedPhoto
                        src={photo.url}
                        storagePath={photo.storagePath}
                        alt={getComplaintPhotoLabel(photo.photoType)}
                        className="w-full h-40 object-cover"
                      />
                      <div className="p-2.5 bg-slate-900 text-white text-[10px] flex justify-between">
                        <span className="font-semibold capitalize">
                          {getComplaintPhotoLabel(photo.photoType)}
                        </span>
                        <span className="font-mono tabular-nums text-slate-400">
                          {new Date(photo.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2 shadow-2xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Waste Type:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {selectedComplaint.wasteType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">GPS Coordinates:</span>
                    <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {selectedComplaint.latitude.toFixed(6)}, {selectedComplaint.longitude.toFixed(6)}
                    </span>
                  </div>
                  {selectedComplaint.remark && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 block font-semibold">Resident Remark:</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{selectedComplaint.remark}</p>
                    </div>
                  )}
                  {selectedComplaint.rejectionReason && (
                    <div className="pt-2 border-t border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                      <span className="font-bold block">Rejection Reason:</span>
                      <p className="mt-0.5 leading-relaxed">{selectedComplaint.rejectionReason}</p>
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
