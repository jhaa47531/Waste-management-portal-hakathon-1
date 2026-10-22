/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Complaint, Locality, CleanerServiceArea, UrgencyLevel, ComplaintStatus } from '../types/index.ts';
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
  Filter,
  Eye,
  ArrowRight,
  HardHat,
  RotateCcw,
  Sparkles,
  X,
  FileCheck,
} from 'lucide-react';

interface SupervisorViewProps {
  currentUser: UserProfile;
  complaints: Complaint[];
  localities: Locality[];
  users: UserProfile[];
  serviceAreas: CleanerServiceArea[];
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  currentUser,
  complaints,
  localities,
  users,
  serviceAreas,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [localityFilter, setLocalityFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected complaint for review/assignment/action
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Action states
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

  // Operational metrics
  const submittedCount = complaints.filter((c) => c.status === 'submitted').length;
  const verifiedCount = complaints.filter((c) => c.status === 'verified').length;
  const inProgressCount = complaints.filter((c) => c.status === 'in_progress').length;
  const awaitingVerificationCount = complaints.filter((c) => c.status === 'awaiting_verification').length;
  const completedCount = complaints.filter((c) => c.status === 'completed').length;

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

  const handleOpenAction = (complaint: Complaint, tab: 'verify' | 'assign' | 'review' | 'reject' | 'details') => {
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

  // Actions
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
      setAssignError('Please select an approved cleaner.');
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

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStatusFilter('submitted')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'submitted'
              ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            1. New Submissions
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {submittedCount}
            </span>
            <span className="text-xs text-slate-500">Needs Contact</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('verified')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'verified'
              ? 'bg-sky-500/15 border-sky-500 ring-2 ring-sky-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            2. Verified
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {verifiedCount}
            </span>
            <span className="text-xs text-slate-500">Ready to Assign</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('in_progress')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'in_progress'
              ? 'bg-purple-500/15 border-purple-500 ring-2 ring-purple-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-400'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            3. In Progress
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {inProgressCount}
            </span>
            <span className="text-xs text-slate-500">On-Site</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('awaiting_verification')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'awaiting_verification'
              ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-400'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            4. Completion Review
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {awaitingVerificationCount}
            </span>
            <span className="text-xs text-slate-500">Audit Photos</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('completed')}
          className={`p-4 rounded-xl border cursor-pointer transition-all col-span-2 sm:col-span-1 ${
            statusFilter === 'completed'
              ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            5. Completed
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {completedCount}
            </span>
            <span className="text-xs text-slate-500">Verified Closed</span>
          </div>
        </div>
      </div>

      {/* Operational Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracking ID, resident phone, address, or name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="all">All Statuses ({complaints.length})</option>
            <option value="submitted">1. Submitted ({submittedCount})</option>
            <option value="verified">2. Verified ({verifiedCount})</option>
            <option value="assigned">3. Assigned</option>
            <option value="in_progress">4. In Progress ({inProgressCount})</option>
            <option value="awaiting_verification">5. Awaiting Review ({awaitingVerificationCount})</option>
            <option value="completed">6. Completed ({completedCount})</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Locality Filter */}
          <select
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="all">All Localities</option>
            {localities.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          >
            <option value="all">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {statusFilter !== 'all' || localityFilter !== 'all' || urgencyFilter !== 'all' || searchQuery ? (
            <button
              onClick={() => {
                setStatusFilter('all');
                setLocalityFilter('all');
                setUrgencyFilter('all');
                setSearchQuery('');
              }}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Complaint Queue Table / Cards */}
      {filteredComplaints.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            No Complaints in Operational Queue
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            No complaints match the selected filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((complaint) => {
            const initialPhoto = complaint.photos.find((p) => p.photoType === 'resident_initial');
            const completionPhoto = complaint.photos.find((p) => p.photoType === 'cleaner_completion');

            return (
              <div
                key={complaint.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-start gap-4">
                  {initialPhoto ? (
                    <img
                      src={initialPhoto.url}
                      alt="Complaint"
                      className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-slate-400" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {complaint.trackingCode}
                      </span>
                      <StatusBadge status={complaint.status} size="sm" />
                      <UrgencyBadge urgency={complaint.urgency} />
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {complaint.address}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {complaint.localityName}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{complaint.wasteType.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>Resident: {complaint.residentName}</span>
                      <span>•</span>
                      <a
                        href={`tel:${complaint.residentPhone}`}
                        className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <PhoneCall className="w-3 h-3" /> {complaint.residentPhone}
                      </a>
                    </div>

                    {complaint.residentConfirmedAt ? (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium pt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resident phone confirmation recorded
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium pt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Call resident to verify before dispatch
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Operational Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                  {/* Action 1: Verify / Reject (When Submitted) */}
                  {complaint.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => handleOpenAction(complaint, 'verify')}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Verify & Call
                      </button>
                      <button
                        onClick={() => handleOpenAction(complaint, 'reject')}
                        className="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {/* Action 2: Assign Cleaner (When Verified) */}
                  {complaint.status === 'verified' && (
                    <button
                      onClick={() => handleOpenAction(complaint, 'assign')}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <HardHat className="w-3.5 h-3.5" /> Dispatch Cleaner
                    </button>
                  )}

                  {/* Action 3: Review Completion (When Awaiting Verification) */}
                  {complaint.status === 'awaiting_verification' && (
                    <button
                      onClick={() => handleOpenAction(complaint, 'review')}
                      className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs animate-pulse"
                    >
                      <Eye className="w-3.5 h-3.5" /> Review Before/After Evidence
                    </button>
                  )}

                  {/* Inspection / Details button for all states */}
                  <button
                    onClick={() => handleOpenAction(complaint, 'details')}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    Details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SUPERVISOR ACTION MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                    {selectedComplaint.trackingCode}
                  </span>
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <UrgencyBadge urgency={selectedComplaint.urgency} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedComplaint.address}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedComplaint.localityName} • GPS: {selectedComplaint.latitude.toFixed(6)}° N,{' '}
                  {selectedComplaint.longitude.toFixed(6)}° E
                </p>
              </div>

              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resident Verification Banner */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-blue-600" /> Resident Confirmation: {selectedComplaint.residentName}
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  Phone: <strong>{selectedComplaint.residentPhone}</strong> (Required to verify before dispatch)
                </p>
              </div>

              <a
                href={`tel:${selectedComplaint.residentPhone}`}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call Resident
              </a>
            </div>

            {/* Action Tabs inside Modal */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold gap-3">
              <button
                onClick={() => setActionTab('details')}
                className={`pb-2 border-b-2 transition-colors ${
                  actionTab === 'details'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Overview & Photos
              </button>

              {selectedComplaint.status === 'submitted' && (
                <>
                  <button
                    onClick={() => setActionTab('verify')}
                    className={`pb-2 border-b-2 transition-colors ${
                      actionTab === 'verify'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Verify Complaint
                  </button>
                  <button
                    onClick={() => setActionTab('reject')}
                    className={`pb-2 border-b-2 transition-colors ${
                      actionTab === 'reject'
                        ? 'border-rose-600 text-rose-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Reject Complaint
                  </button>
                </>
              )}

              {(selectedComplaint.status === 'verified' || selectedComplaint.status === 'assigned') && (
                <button
                  onClick={() => setActionTab('assign')}
                  className={`pb-2 border-b-2 transition-colors ${
                    actionTab === 'assign'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Assign Approved Cleaner
                </button>
              )}

              {selectedComplaint.status === 'awaiting_verification' && (
                <button
                  onClick={() => setActionTab('review')}
                  className={`pb-2 border-b-2 transition-colors ${
                    actionTab === 'review'
                      ? 'border-orange-600 text-orange-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Review Completion Evidence
                </button>
              )}
            </div>

            {/* ACTION 1: VERIFY FORM */}
            {actionTab === 'verify' && (
              <div className="space-y-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Verify Complaint & Set Urgency
                </h4>
                <p className="text-slate-500">
                  Consider the address, GPS coordinates, photo, waste category, and resident phone confirmation together.
                </p>

                <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={phoneConfirmed}
                    onChange={(e) => setPhoneConfirmed(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    I have contacted resident ({selectedComplaint.residentPhone}) and confirmed the location & waste details.
                  </span>
                </label>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority / Urgency Level
                  </label>
                  <select
                    value={urgencySelection}
                    onChange={(e) => setUrgencySelection(e.target.value as UrgencyLevel)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="low">Low (Minor dry debris)</option>
                    <option value="normal">Normal (Standard residential)</option>
                    <option value="high">High (Blocking access / public area)</option>
                    <option value="critical">Critical (Hazardous / high disease risk)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supervisor Verification Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    placeholder="e.g. Confirmed piled near storm drain; marked high urgency due to school opening hours."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerify}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirm Verification
                  </button>
                </div>
              </div>
            )}

            {/* ACTION 2: REJECT FORM */}
            {actionTab === 'reject' && (
              <div className="space-y-4 text-xs bg-rose-50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-200 dark:border-rose-900">
                <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">
                  Reject Waste Pickup Request
                </h4>
                <p className="text-rose-700 dark:text-rose-300">
                  A supervisor must record a clear justification for rejection (e.g. duplicate complaint, private property non-municipal area, or unable to reach resident).
                </p>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Rejection Reason (Mandatory, at least 5 characters) *
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Duplicate complaint: This exact spot is already being cleaned under ticket WPR-261021-X9M2."
                    className="w-full px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                {rejectionError && (
                  <p className="text-xs text-rose-600 font-bold">{rejectionError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <XCircle className="w-4 h-4" /> Confirm Rejection
                  </button>
                </div>
              </div>
            )}

            {/* ACTION 3: ASSIGN CLEANER FORM */}
            {actionTab === 'assign' && (
              <div className="space-y-4 text-xs bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900">
                <div>
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">
                    Assign Verified Complaint to Approved Cleaner
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Municipal Policy: Cleaners can only be assigned to complaints within their{' '}
                    <strong>approved service areas</strong>. Locality: <u>{selectedComplaint.localityName}</u>
                  </p>
                </div>

                {eligibleCleaners.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> No Cleaner Approved for this Locality
                    </p>
                    <p className="text-[11px] mt-1">
                      None of the active cleaners currently have an approved service area in{' '}
                      <strong>{selectedComplaint.localityName}</strong>. Please approve cleaner service areas in the Administrator dashboard or have a cleaner propose this locality first.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Select Approved Cleaner *
                    </label>
                    <div className="space-y-2">
                      {eligibleCleaners.map((cleaner) => {
                        const activeCount = complaints.filter(
                          (c) =>
                            c.assignedCleanerId === cleaner.id &&
                            ['assigned', 'in_progress'].includes(c.status)
                        ).length;

                        return (
                          <label
                            key={cleaner.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedCleanerId === cleaner.id
                                ? 'bg-indigo-100/60 dark:bg-indigo-900/40 border-indigo-500 ring-2 ring-indigo-400'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="cleaner"
                                value={cleaner.id}
                                checked={selectedCleanerId === cleaner.id}
                                onChange={() => setSelectedCleanerId(cleaner.id)}
                                className="w-4 h-4 text-indigo-600"
                              />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {cleaner.fullName}
                                </p>
                                <p className="text-[11px] text-slate-500">{cleaner.email} • {cleaner.phoneNumber}</p>
                              </div>
                            </div>

                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                              Active load: {activeCount} task(s)
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Instructions for Cleaner (Optional)
                  </label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="e.g. Bring protective heavy gloves and extra municipal bags."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>

                {assignError && <p className="text-xs text-rose-600 font-bold">{assignError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={eligibleCleaners.length === 0}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <HardHat className="w-4 h-4" /> Dispatch Assignment
                  </button>
                </div>
              </div>
            )}

            {/* ACTION 4: REVIEW COMPLETION EVIDENCE (BEFORE & AFTER PHOTOS) */}
            {actionTab === 'review' && (
              <div className="space-y-4 text-xs bg-orange-50/50 dark:bg-orange-950/20 p-4 rounded-xl border border-orange-200 dark:border-orange-900">
                <div>
                  <h4 className="font-bold text-orange-900 dark:text-orange-200 text-sm">
                    Audit Cleaner Photographic Evidence
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Compare the initial resident waste complaint with the cleaner's after-cleaning upload. Verify thorough site clearance before closing the request.
                  </p>
                </div>

                {/* Side-by-side photographic comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      1. Initial Resident Complaint Photo
                    </span>
                    <div className="h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
                      <img
                        src={
                          selectedComplaint.photos.find((p) => p.photoType === 'resident_initial')?.url
                        }
                        alt="Initial Waste"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* After */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> 2. After-Cleaning Evidence
                    </span>
                    <div className="h-56 rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-800 bg-slate-950">
                      <img
                        src={
                          selectedComplaint.photos.find((p) => p.photoType === 'cleaner_completion')?.url
                        }
                        alt="Cleaned Site"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Approval or Re-work notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 space-y-2">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                      Approve Work & Mark Completed
                    </span>
                    <input
                      type="text"
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      placeholder="Supervisor sign-off notes (optional)..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
                    />
                    <button
                      onClick={handleApproveCompletion}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Close Complaint
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900 space-y-2">
                    <span className="font-bold text-rose-800 dark:text-rose-300 block">
                      Inadequate Evidence: Return to In Progress
                    </span>
                    <input
                      type="text"
                      value={returnNote}
                      onChange={(e) => setReturnNote(e.target.value)}
                      placeholder="Explanation required (e.g. Curb stain uncleaned)..."
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-xs"
                    />
                    {returnError && <p className="text-xs text-rose-600">{returnError}</p>}
                    <button
                      onClick={handleReturnToProgress}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <RotateCcw className="w-4 h-4" /> Return to Cleaner (In Progress)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DETAILS & TIMELINE */}
            {actionTab === 'details' && (
              <div className="space-y-6">
                {/* Photos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedComplaint.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950"
                    >
                      <div className="h-44">
                        <img
                          src={photo.url}
                          alt={photo.photoType}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 bg-slate-900 text-white text-[11px] flex justify-between">
                        <span className="font-semibold capitalize">
                          {photo.photoType === 'resident_initial'
                            ? 'Resident Initial Evidence'
                            : 'Cleaner After-Cleaning'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(photo.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
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
