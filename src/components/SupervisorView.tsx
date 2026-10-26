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
import { ConfirmModal } from './ConfirmModal.tsx';
import {
  isInitialComplaintPhoto,
  isCompletionComplaintPhoto,
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
  Send,
  Layers,
  Inbox,
  AlertCircle,
  Users,
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
  // Tab Navigation: 01 Verify Queue, 02 Dispatch & Assign, 03 Resolution Audit, 04 All Complaints, 05 Applications, 06 My Team
  const [activeTab, setActiveTab] = useState<
    'verify_queue' | 'assign_queue' | 'audit_queue' | 'all' | 'applications' | 'team'
  >('verify_queue');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [localityFilter, setLocalityFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');

  // Selected complaint modal state
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [modalTab, setModalTab] = useState<'details' | 'verify' | 'assign' | 'audit' | 'reject'>('details');

  // Verification Form State
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  const [verifyUrgency, setVerifyUrgency] = useState<UrgencyLevel>('normal');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Assignment Form State
  const [selectedCleanerId, setSelectedCleanerId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Rejection Form State
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Audit Resolution Form State
  const [approveNotes, setApproveNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Cleaner Application Review State
  const [cleanerAppNotes, setCleanerAppNotes] = useState<Record<string, string>>({});
  const [appLocalitySelection, setAppLocalitySelection] = useState<Record<string, string[]>>({});
  const [appReviewMsg, setAppReviewMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Destructive Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Metrics
  const submittedComplaints = complaints.filter((c) => c.status === 'submitted');
  const verifiedComplaints = complaints.filter((c) => c.status === 'verified');
  const auditingComplaints = complaints.filter((c) => c.status === 'awaiting_verification');
  const pendingApps = cleanerApplications.filter((a) => a.status === 'pending');
  const myCleaners = users.filter((u) => u.role === 'cleaner' && u.supervisorId === currentUser.id);

  // Active cleaners for assignment
  const allActiveCleaners = users.filter((u) => u.role === 'cleaner' && u.accountStatus === 'active');
  const localityCleaners = selectedComplaint
    ? allActiveCleaners.filter((u) =>
        serviceAreas.some(
          (sa) => sa.cleanerId === u.id && sa.localityId === selectedComplaint.localityId && sa.isApproved
        )
      )
    : [];
  const eligibleCleaners = localityCleaners.length > 0 ? localityCleaners : allActiveCleaners;

  // Filter complaints for "All Complaints"
  const filteredAllComplaints = complaints.filter((c) => {
    if (localityFilter !== 'all' && c.localityId !== localityFilter) return false;
    if (urgencyFilter !== 'all' && c.urgency !== urgencyFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const match =
        c.trackingCode.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.residentName.toLowerCase().includes(q) ||
        c.residentPhone.includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Open complaint modal with specific action
  const openAction = (
    c: Complaint,
    action: 'details' | 'verify' | 'assign' | 'audit' | 'reject'
  ) => {
    setSelectedComplaint(c);
    setModalTab(action);
    setVerifyUrgency(c.urgency);
    setPhoneConfirmed(Boolean(c.residentConfirmedAt));
    setVerifyNotes('');
    setVerifyError(null);
    setSelectedCleanerId('');
    setAssignNotes('');
    setAssignError(null);
    setRejectionReason('');
    setRejectionError(null);
    setApproveNotes('');
    setApproveError(null);
    setReturnNote('');
    setReturnError(null);
  };

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!phoneConfirmed) {
      setVerifyError('Voice verification with resident via phone is mandatory by municipal policy.');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    const res = await portalStore.verifyComplaint(selectedComplaint.id, verifyUrgency, verifyNotes);
    setIsVerifying(false);

    if (res.success) {
      const updated = portalStore.getState().complaints.find((c) => c.id === selectedComplaint.id);
      if (updated) {
        setSelectedComplaint(updated);
        setModalTab('assign');
      } else {
        setSelectedComplaint(null);
      }
    } else {
      setVerifyError(res.error || 'Verification failed.');
    }
  };

  const handleAssignCleaner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!selectedCleanerId) {
      setAssignError('Please select an approved cleaner for dispatch.');
      return;
    }

    setIsAssigning(true);
    setAssignError(null);

    const res = await portalStore.assignCleaner(
      selectedComplaint.id,
      selectedCleanerId,
      assignNotes
    );
    setIsAssigning(false);

    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setAssignError(res.error || 'Failed to dispatch cleaner.');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      setRejectionError('A valid rejection rationale (minimum 5 characters) is required for audit logs.');
      return;
    }

    setIsRejecting(true);
    setRejectionError(null);

    const res = await portalStore.rejectComplaint(selectedComplaint.id, rejectionReason.trim());
    setIsRejecting(false);

    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setRejectionError(res.error || 'Failed to reject complaint.');
    }
  };

  const handleApproveCompletion = async () => {
    if (!selectedComplaint) return;

    setIsApproving(true);
    setApproveError(null);

    const res = await portalStore.approveCompletion(selectedComplaint.id, approveNotes);
    setIsApproving(false);

    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setApproveError(res.error || 'Failed to approve completion.');
    }
  };

  const handleReturnToInProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!returnNote.trim() || returnNote.trim().length < 5) {
      setReturnError('Rework guidance note (minimum 5 characters) is required.');
      return;
    }

    setIsReturning(true);
    setReturnError(null);

    const res = await portalStore.returnToProgress(selectedComplaint.id, returnNote.trim());
    setIsReturning(false);

    if (res.success) {
      setSelectedComplaint(null);
    } else {
      setReturnError(res.error || 'Failed to request rework.');
    }
  };

  const handleApproveApplication = async (app: CleanerApplication) => {
    const assignedLocalities =
      appLocalitySelection[app.id] && appLocalitySelection[app.id].length > 0
        ? appLocalitySelection[app.id]
        : (app.preferredLocalityIds || []).slice(0, 3);

    const note = cleanerAppNotes[app.id] || 'Approved by field supervisor.';

    const res = await portalStore.reviewCleanerApplication(
      app.id,
      'approved',
      assignedLocalities,
      currentUser.id,
      note
    );

    if (res.success) {
      setAppReviewMsg({ text: `Application for ${app.cleanerName} approved and service areas assigned.` });
    } else {
      setAppReviewMsg({ text: res.error || 'Failed to approve application.', error: true });
    }
  };

  const handleRejectApplication = (app: CleanerApplication) => {
    setConfirmModal({
      isOpen: true,
      title: 'REJECT CLEANER APPLICATION',
      message: `Are you sure you want to reject the onboarding application for ${app.cleanerName}?`,
      onConfirm: async () => {
        const note = cleanerAppNotes[app.id] || 'Application declined by field supervisor.';
        const res = await portalStore.reviewCleanerApplication(app.id, 'rejected', [], currentUser.id, note);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        if (res.success) {
          setAppReviewMsg({ text: `Application for ${app.cleanerName} rejected.` });
        } else {
          setAppReviewMsg({ text: res.error || 'Failed to reject application.', error: true });
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Supervisor Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('verify_queue')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'verify_queue'
              ? 'border-amber-500/50 bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
              : 'border-white/[0.08] bg-[#12161c] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-400">
              01. VERIFY QUEUE
            </span>
            <PhoneCall className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-amber-400 mt-1">
            {submittedComplaints.length}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('assign_queue')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'assign_queue'
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'border-white/[0.08] bg-[#12161c] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-400">
              02. DISPATCH READY
            </span>
            <Send className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-cyan-400 mt-1">
            {verifiedComplaints.length}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('audit_queue')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'audit_queue'
              ? 'border-purple-500/50 bg-purple-950/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
              : 'border-white/[0.08] bg-[#12161c] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-400">
              03. PHOTO AUDIT
            </span>
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-purple-400 mt-1">
            {auditingComplaints.length}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'applications'
              ? 'border-emerald-500/50 bg-emerald-950/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'border-white/[0.08] bg-[#12161c] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-400">
              04. APPLICANTS
            </span>
            <HardHat className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">
            {pendingApps.length}
          </p>
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap border-b border-white/[0.08] bg-[#12161c] rounded-2xl p-1.5 shadow-xs gap-1">
        <button
          onClick={() => setActiveTab('verify_queue')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'verify_queue'
              ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>VERIFY QUEUE</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">
            {submittedComplaints.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assign_queue')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'assign_queue'
              ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>DISPATCH & ASSIGN</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">
            {verifiedComplaints.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit_queue')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'audit_queue'
              ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>PHOTO AUDIT</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">
            {auditingComplaints.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'all'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>ALL COMPLAINTS ({complaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'applications'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>CLEANER ONBOARDING ({pendingApps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'team'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>MY TEAM ({myCleaners.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: VERIFICATION QUEUE (Quick Voice Triage)
         ========================================================================= */}
      {activeTab === 'verify_queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-amber-400" />
                <span>01. VOICE VERIFICATION QUEUE</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect resident photos and confirm street details via phone call before authorizing dispatch.
              </p>
            </div>
          </div>

          {submittedComplaints.length === 0 ? (
            <div className="p-12 text-center bg-[#12161c] rounded-3xl border border-white/[0.08] shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-mono text-sm font-bold text-white">QUEUE CLEAR</h4>
              <p className="text-xs text-slate-400">All submitted reports have been verified.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {submittedComplaints.map((c) => {
                const initialPhoto = c.photos.find((p) => isInitialComplaintPhoto(p.photoType));
                return (
                  <div
                    key={c.id}
                    className="bg-[#12161c] rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col justify-between shadow-xs hover:border-amber-500/30 transition-all"
                  >
                    <div>
                      {initialPhoto && (
                        <div className="h-40 bg-black relative">
                          <img
                            src={initialPhoto.url}
                            alt="Report"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2.5 left-2.5">
                            <StatusBadge status={c.status} size="sm" />
                          </div>
                          <div className="absolute top-2.5 right-2.5">
                            <UrgencyBadge urgency={c.urgency} />
                          </div>
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-bold">{c.trackingCode}</span>
                          <span className="text-slate-500 text-[10px]">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-white line-clamp-1">{c.address}</h4>
                        <p className="text-xs text-slate-400 font-mono">{c.localityName}</p>

                        <div className="p-2.5 rounded-xl bg-[#0b0d10] border border-white/5 text-xs font-mono space-y-1">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>RESIDENT:</span>
                            <span className="text-white font-bold">{c.residentName}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400">
                            <span>PHONE:</span>
                            <a
                              href={`tel:${c.residentPhone}`}
                              className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                            >
                              <Phone className="w-3 h-3" />
                              {c.residentPhone}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t border-white/5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openAction(c, 'verify')}
                        className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>VERIFY & DISPATCH</span>
                      </button>

                      <button
                        onClick={() => openAction(c, 'reject')}
                        className="py-2.5 px-3 rounded-xl border border-rose-500/30 hover:bg-rose-950/40 text-rose-300 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>REJECT</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: DISPATCH & ASSIGN QUEUE (Verified complaints needing a cleaner)
         ========================================================================= */}
      {activeTab === 'assign_queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <span>02. DISPATCH & ASSIGN CLEANER</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verified complaints waiting for manual cleaner assignment in their locality.
              </p>
            </div>
          </div>

          {verifiedComplaints.length === 0 ? (
            <div className="p-12 text-center bg-[#12161c] rounded-3xl border border-white/[0.08] shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-mono text-sm font-bold text-white">ALL VERIFIED COMPLAINTS DISPATCHED</h4>
              <p className="text-xs text-slate-400">No complaints currently waiting for cleaner assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {verifiedComplaints.map((c) => {
                const initialPhoto = c.photos.find((p) => isInitialComplaintPhoto(p.photoType));
                return (
                  <div
                    key={c.id}
                    className="bg-[#12161c] rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col justify-between shadow-xs hover:border-cyan-500/30 transition-all"
                  >
                    <div>
                      {initialPhoto && (
                        <div className="h-40 bg-black relative">
                          <img
                            src={initialPhoto.url}
                            alt="Report"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2.5 left-2.5">
                            <StatusBadge status={c.status} size="sm" />
                          </div>
                          <div className="absolute top-2.5 right-2.5">
                            <UrgencyBadge urgency={c.urgency} />
                          </div>
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-emerald-400 font-bold">{c.trackingCode}</span>
                          <span className="text-slate-500 text-[10px]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-white line-clamp-1">{c.address}</h4>
                        <p className="text-xs text-slate-400 font-mono">{c.localityName}</p>
                      </div>
                    </div>

                    <div className="p-3 border-t border-white/5">
                      <button
                        onClick={() => openAction(c, 'assign')}
                        className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                      >
                        <HardHat className="w-3.5 h-3.5" />
                        <span>PICK CLEANER & DISPATCH</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: PHOTO AUDIT QUEUE (Awaiting verification)
         ========================================================================= */}
      {activeTab === 'audit_queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-400" />
                <span>03. SIDE-BY-SIDE PHOTO AUDIT</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect before & after photographic evidence to approve final resolution or request rework.
              </p>
            </div>
          </div>

          {auditingComplaints.length === 0 ? (
            <div className="p-12 text-center bg-[#12161c] rounded-3xl border border-white/[0.08] shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-mono text-sm font-bold text-white">ALL CLEANER WORK AUDITED</h4>
              <p className="text-xs text-slate-400">No complaints currently awaiting supervisor resolution audit.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {auditingComplaints.map((c) => {
                const beforePhoto = c.photos.find((p) => isInitialComplaintPhoto(p.photoType));
                const afterPhoto = c.photos.find((p) => isCompletionComplaintPhoto(p.photoType));

                return (
                  <div
                    key={c.id}
                    className="bg-[#12161c] rounded-2xl border border-white/[0.08] p-4 space-y-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-emerald-400 font-mono font-bold text-xs">{c.trackingCode}</span>
                          <StatusBadge status={c.status} size="sm" />
                        </div>
                        <h4 className="text-sm font-bold text-white">{c.address}</h4>
                        <p className="text-xs text-slate-400 font-mono">{c.localityName}</p>
                      </div>

                      <button
                        onClick={() => openAction(c, 'audit')}
                        className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[44px]"
                      >
                        AUDIT NOW
                      </button>
                    </div>

                    {/* Dual photo preview */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#0b0d10] rounded-xl overflow-hidden border border-white/5">
                        <span className="font-mono text-[9px] text-amber-400 p-1.5 block">01. BEFORE</span>
                        {beforePhoto ? (
                          <img src={beforePhoto.url} alt="Before" className="w-full h-32 object-cover" />
                        ) : (
                          <div className="h-32 flex items-center justify-center text-xs text-slate-600">NO PHOTO</div>
                        )}
                      </div>

                      <div className="bg-[#0b0d10] rounded-xl overflow-hidden border border-white/5">
                        <span className="font-mono text-[9px] text-emerald-400 p-1.5 block">02. AFTER</span>
                        {afterPhoto ? (
                          <img src={afterPhoto.url} alt="After" className="w-full h-32 object-cover" />
                        ) : (
                          <div className="h-32 flex items-center justify-center text-xs text-slate-600">NO PHOTO</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: ALL COMPLAINTS (Registry & Audit Explorer)
         ========================================================================= */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="bg-[#12161c] p-3.5 rounded-2xl border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Tracking ID, Address, Resident or Phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={localityFilter}
                onChange={(e) => setLocalityFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-slate-300 text-xs font-mono cursor-pointer focus:border-emerald-500/60 focus:outline-hidden min-h-[44px]"
              >
                <option value="all">ALL LOCALITIES</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-slate-300 text-xs font-mono cursor-pointer focus:border-emerald-500/60 focus:outline-hidden min-h-[44px]"
              >
                <option value="all">ALL URGENCIES</option>
                <option value="low">LOW</option>
                <option value="normal">NORMAL</option>
                <option value="high">HIGH</option>
                <option value="critical">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="bg-[#12161c] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0b0d10] text-slate-400 font-mono-display uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">TRACKING</th>
                    <th className="py-3 px-4">ADDRESS / SECTOR</th>
                    <th className="py-3 px-4">RESIDENT</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4">URGENCY</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredAllComplaints.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-emerald-400 font-bold">{c.trackingCode}</td>
                      <td className="py-3 px-4">
                        <span className="text-white block font-sans font-medium">{c.address}</span>
                        <span className="text-slate-500 text-[10px]">{c.localityName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 block">{c.residentName}</span>
                        <span className="text-slate-500 text-[10px]">{c.residentPhone}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <UrgencyBadge urgency={c.urgency} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openAction(c, 'details')}
                          className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
                        >
                          INSPECT
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: CLEANER ONBOARDING APPLICATIONS
         ========================================================================= */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <HardHat className="w-4 h-4 text-emerald-400" />
                <span>CLEANER ONBOARDING REVIEW</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review submitted cleaner applications and authorize service localities.
              </p>
            </div>
          </div>

          {appReviewMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                appReviewMsg.error
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span>{appReviewMsg.text}</span>
              <button onClick={() => setAppReviewMsg(null)} className="p-1 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {pendingApps.length === 0 ? (
            <div className="p-12 text-center bg-[#12161c] rounded-3xl border border-white/[0.08] shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-mono text-sm font-bold text-white">NO PENDING APPLICATIONS</h4>
              <p className="text-xs text-slate-400">All cleaner applicants have been reviewed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="bg-[#12161c] rounded-2xl border border-white/[0.08] p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-bold text-white font-sans">{app.cleanerName}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {app.cleanerEmail} • {app.cleanerPhone || 'No phone'}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">
                        APPLIED: {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-amber-950/60 border border-amber-500/40 text-amber-300">
                      PENDING REVIEW
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block">
                      PREFERRED LOCALITIES ({(app.preferredLocalityIds || []).length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(app.preferredLocalityIds || []).map((locId) => {
                        const loc = localities.find((l) => l.id === locId);
                        return (
                          <span
                            key={locId}
                            className="px-2 py-1 rounded-lg bg-[#0b0d10] border border-white/10 text-[11px] font-mono text-slate-300"
                          >
                            {loc?.name || locId}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex gap-2">
                    <button
                      onClick={() => handleApproveApplication(app)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>APPROVE APPLICANT</span>
                    </button>
                    <button
                      onClick={() => handleRejectApplication(app)}
                      className="py-2.5 px-3 rounded-xl border border-rose-500/30 hover:bg-rose-950/40 text-rose-300 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>DECLINE</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 6: MY CLEANER TEAM
         ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>MY CLEANER TEAM ({myCleaners.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cleaners assigned under your municipal supervision roster.
              </p>
            </div>
          </div>

          {myCleaners.length === 0 ? (
            <div className="p-12 text-center bg-[#12161c] rounded-3xl border border-white/[0.08] shadow-xs space-y-2">
              <HardHat className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="font-mono text-sm font-bold text-white">NO TEAM MEMBERS ASSIGNED YET</h4>
              <p className="text-xs text-slate-400">Approve cleaner applicants or ask your administrator to assign cleaners to your team.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCleaners.map((cleaner) => {
                const cleanerAreas = serviceAreas.filter((sa) => sa.cleanerId === cleaner.id && sa.isApproved);
                const activeTasks = complaints.filter(
                  (c) => c.assignedCleanerId === cleaner.id && (c.status === 'assigned' || c.status === 'in_progress')
                );

                return (
                  <div
                    key={cleaner.id}
                    className="bg-[#12161c] rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold font-mono">
                          {cleaner.fullName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white font-sans">{cleaner.fullName}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{cleaner.email}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                        {cleaner.accountStatus}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0b0d10] border border-white/5 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>PHONE:</span>
                        <span className="text-white">{cleaner.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>ACTIVE TASKS:</span>
                        <span className="text-amber-400 font-bold">{activeTasks.length}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>AREAS:</span>
                        <span className="text-cyan-400 font-bold">{cleanerAreas.length} LOCALITIES</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          COMPLAINT ACTION MODAL (Verify, Assign, Audit, Reject, Details)
         ========================================================================= */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0f1217] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-100">
            {/* Top Bar */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-400 font-mono font-bold text-sm">
                    {selectedComplaint.trackingCode}
                  </span>
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <UrgencyBadge urgency={selectedComplaint.urgency} />
                </div>
                <h3 className="text-base font-bold text-white font-sans">{selectedComplaint.address}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedComplaint.localityName} • SUBMITTED BY {selectedComplaint.residentName}
                </p>
              </div>

              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer shrink-0 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex rounded-xl bg-[#12161c] p-1 border border-white/5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setModalTab('details')}
                className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                  modalTab === 'details' ? 'bg-white/10 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                DETAILS & PHOTOS
              </button>
              {selectedComplaint.status === 'submitted' && (
                <button
                  type="button"
                  onClick={() => setModalTab('verify')}
                  className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                    modalTab === 'verify' ? 'bg-amber-950/60 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  VERIFY CALL
                </button>
              )}
              {(selectedComplaint.status === 'submitted' || selectedComplaint.status === 'verified') && (
                <button
                  type="button"
                  onClick={() => setModalTab('assign')}
                  className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                    modalTab === 'assign' ? 'bg-cyan-950/60 text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ASSIGN CLEANER
                </button>
              )}
              {selectedComplaint.status === 'awaiting_verification' && (
                <button
                  type="button"
                  onClick={() => setModalTab('audit')}
                  className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                    modalTab === 'audit' ? 'bg-purple-950/60 text-purple-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PHOTO AUDIT
                </button>
              )}
              {selectedComplaint.status === 'submitted' && (
                <button
                  type="button"
                  onClick={() => setModalTab('reject')}
                  className={`flex-1 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                    modalTab === 'reject' ? 'bg-rose-950/60 text-rose-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  REJECT
                </button>
              )}
            </div>

            {/* DETAILS TAB */}
            {modalTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-[#12161c] p-3.5 rounded-2xl border border-white/[0.08]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">GPS COORDINATES</span>
                    <p className="text-emerald-400 font-bold mt-0.5">
                      {selectedComplaint.latitude.toFixed(6)}° N, {selectedComplaint.longitude.toFixed(6)}° E
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">RESIDENT CONTACT</span>
                    <a
                      href={`tel:${selectedComplaint.residentPhone}`}
                      className="text-cyan-400 font-bold flex items-center gap-1 mt-0.5 hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedComplaint.residentPhone}
                    </a>
                  </div>
                </div>

                {/* Evidence Photos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#0b0d10] rounded-xl border border-white/10 overflow-hidden">
                    <span className="font-mono text-[10px] text-amber-400 p-2 block font-bold">
                      01. INITIAL REPORT PHOTO
                    </span>
                    {selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType)) ? (
                      <SignedPhoto
                        storagePath={selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType))!.storagePath}
                        src={selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType))!.url}
                        alt="Initial photo"
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-xs text-slate-600 font-mono">
                        NO PHOTO
                      </div>
                    )}
                  </div>

                  <div className="bg-[#0b0d10] rounded-xl border border-white/10 overflow-hidden">
                    <span className="font-mono text-[10px] text-emerald-400 p-2 block font-bold">
                      02. CLEANER COMPLETION PHOTO
                    </span>
                    {selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType)) ? (
                      <SignedPhoto
                        storagePath={selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType))!.storagePath}
                        src={selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType))!.url}
                        alt="Completion photo"
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-600 font-mono p-4 text-center">
                        <Clock className="w-5 h-5 text-slate-600 mb-1" />
                        <span>AWAITING CLEANER RESOLUTION</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <ComplaintTimeline
                  currentStatus={selectedComplaint.status}
                  history={selectedComplaint.history}
                />
              </div>
            )}

            {/* VERIFY TAB */}
            {modalTab === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <PhoneCall className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Voice verification is mandatory before cleaner dispatch. Call{' '}
                    <strong className="text-white">{selectedComplaint.residentPhone}</strong> to confirm the exact waste location and access instructions.
                  </p>
                </div>

                {verifyError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <label className="p-3.5 rounded-xl border border-white/10 bg-[#12161c] flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={phoneConfirmed}
                    onChange={(e) => setPhoneConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[#0b0d10] border-white/20 cursor-pointer"
                  />
                  <div className="text-xs font-mono">
                    <span className="font-bold text-white block">PHONE CALL VERIFIED WITH RESIDENT</span>
                    <span className="text-slate-400 text-[11px]">Confirmed identity, address landmark, and current waste volume.</span>
                  </div>
                </label>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    SET DISPATCH URGENCY
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['low', 'normal', 'high', 'critical'] as UrgencyLevel[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setVerifyUrgency(u)}
                        className={`p-2 rounded-xl border font-mono text-xs uppercase font-bold transition-all cursor-pointer ${
                          verifyUrgency === u
                            ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-xs'
                            : 'border-white/5 bg-[#0b0d10] text-slate-400'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    SUPERVISOR VERIFICATION NOTE (OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    placeholder="Resident confirmed waste pile is adjacent to rear gate..."
                    className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all cursor-pointer min-h-[44px]"
                >
                  {isVerifying ? 'VERIFYING...' : 'VERIFY & PROCEED TO CLEANER ASSIGNMENT'}
                </button>
              </form>
            )}

            {/* ASSIGN TAB */}
            {modalTab === 'assign' && (
              <form onSubmit={handleAssignCleaner} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-xs flex items-start gap-2.5">
                  <HardHat className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Select an approved cleaner for{' '}
                    <strong className="text-white">{selectedComplaint.localityName}</strong>. The complaint will immediately appear on the cleaner's task dashboard.
                  </p>
                </div>

                {assignError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{assignError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    SELECT APPROVED CLEANER ({eligibleCleaners.length} AVAILABLE)
                  </label>
                  <select
                    value={selectedCleanerId}
                    onChange={(e) => setSelectedCleanerId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-cyan-500/60 focus:outline-hidden min-h-[44px] cursor-pointer"
                  >
                    <option value="">-- CHOOSE CLEANER --</option>
                    {eligibleCleaners.map((cleaner) => {
                      const activeCount = complaints.filter(
                        (c) =>
                          c.assignedCleanerId === cleaner.id &&
                          (c.status === 'assigned' || c.status === 'in_progress')
                      ).length;
                      return (
                        <option key={cleaner.id} value={cleaner.id} className="bg-[#0b0d10]">
                          {cleaner.fullName} ({activeCount} active tasks)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    DISPATCH INSTRUCTIONS (OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Instructions for cleaner (e.g. bring heavy gloves, gate code 1234)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-cyan-500/60 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAssigning || !selectedCleanerId}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer min-h-[44px]"
                >
                  {isAssigning ? 'DISPATCHING...' : 'DISPATCH CLEANER TO LOCATION'}
                </button>
              </form>
            )}

            {/* AUDIT RESOLUTION TAB */}
            {modalTab === 'audit' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-purple-300 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Compare resident initial photo with cleaner completion photo. Approving resolution permanently closes this complaint into the municipal audit archive.
                  </p>
                </div>

                {approveError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{approveError}</span>
                  </div>
                )}

                {/* Side-by-side evidence preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#0b0d10] rounded-xl border border-white/10 overflow-hidden">
                    <span className="font-mono text-[10px] text-amber-400 p-2 block font-bold">
                      01. BEFORE (RESIDENT REPORT)
                    </span>
                    {selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType)) ? (
                      <SignedPhoto
                        storagePath={selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType))!.storagePath}
                        src={selectedComplaint.photos.find((p) => isInitialComplaintPhoto(p.photoType))!.url}
                        alt="Initial photo"
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-xs text-slate-600 font-mono">
                        NO INITIAL PHOTO
                      </div>
                    )}
                  </div>

                  <div className="bg-[#0b0d10] rounded-xl border border-white/10 overflow-hidden">
                    <span className="font-mono text-[10px] text-emerald-400 p-2 block font-bold">
                      02. AFTER (CLEANER EVIDENCE)
                    </span>
                    {selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType)) ? (
                      <SignedPhoto
                        storagePath={selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType))!.storagePath}
                        src={selectedComplaint.photos.find((p) => isCompletionComplaintPhoto(p.photoType))!.url}
                        alt="Completion photo"
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-xs text-slate-600 font-mono">
                        NO COMPLETION PHOTO
                      </div>
                    )}
                  </div>
                </div>

                {/* Approve Form */}
                <div className="p-4 rounded-2xl bg-[#12161c] border border-emerald-500/30 space-y-3">
                  <h4 className="font-mono text-xs font-bold text-emerald-400 uppercase">
                    APPROVE COMPLETION & CLOSE COMPLAINT
                  </h4>
                  <input
                    type="text"
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    placeholder="Audit note: Site inspected and verified clean..."
                    className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleApproveCompletion}
                    disabled={isApproving}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px]"
                  >
                    {isApproving ? 'SIGNING OFF...' : 'APPROVE RESOLUTION (SIGN OFF)'}
                  </button>
                </div>

                {/* Return for Rework Form */}
                <form onSubmit={handleReturnToInProgress} className="p-4 rounded-2xl bg-[#12161c] border border-amber-500/30 space-y-3">
                  <h4 className="font-mono text-xs font-bold text-amber-400 uppercase">
                    REQUEST REWORK (RETURN TO CLEANER)
                  </h4>
                  {returnError && (
                    <p className="text-xs text-rose-400 font-mono">{returnError}</p>
                  )}
                  <input
                    type="text"
                    required
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Specific rework reason (e.g. residual debris left on sidewalk)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={isReturning}
                    className="w-full py-2.5 rounded-xl border border-amber-500/50 hover:bg-amber-950/40 text-amber-300 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px]"
                  >
                    {isReturning ? 'SENDING BACK...' : 'RETURN TO IN PROGRESS FOR REWORK'}
                  </button>
                </form>
              </div>
            )}

            {/* REJECT TAB */}
            {modalTab === 'reject' && (
              <form onSubmit={handleReject} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Rejecting closes the complaint as non-actionable or invalid. The recorded rationale is permanently saved to the immutable audit timeline.
                  </p>
                </div>

                {rejectionError && (
                  <p className="text-xs text-rose-400 font-mono">{rejectionError}</p>
                )}

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    MANDATORY REJECTION RATIONALE
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejection (e.g. private property with restricted access, duplicate report, non-municipal waste)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-rose-500/60 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRejecting}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all cursor-pointer min-h-[44px]"
                >
                  {isRejecting ? 'RECORDING REJECTION...' : 'CONFIRM COMPLAINT REJECTION'}
                </button>
              </form>
            )}

            <div className="pt-2 text-right border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono font-bold uppercase tracking-wider text-white transition-colors cursor-pointer min-h-[44px]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
