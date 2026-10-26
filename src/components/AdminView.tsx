/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  UserProfile,
  Locality,
  Complaint,
  CleanerApplication,
  CleanerServiceArea,
} from '../types/index.ts';
import { portalStore } from '../services/store.ts';
import { ConfirmModal } from './ConfirmModal.tsx';
import { StatusBadge, UrgencyBadge } from './StatusBadge.tsx';
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
  Eye,
  EyeOff,
  Search,
  X,
  KeyRound,
  Edit2,
  CheckSquare,
  Sparkles,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  Check,
  Send,
  Trash2,
} from 'lucide-react';

interface AdminViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  localities: Locality[];
  complaints: Complaint[];
  cleanerApplications?: CleanerApplication[];
  serviceAreas?: CleanerServiceArea[];
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  users,
  localities,
  complaints,
  cleanerApplications = [],
  serviceAreas = [],
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'applications' | 'cleaners' | 'supervisors' | 'users' | 'localities' | 'audit'
  >('overview');

  // Supervisor Provisioning Form State
  const [supFullName, setSupFullName] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supPassword, setSupPassword] = useState('');
  const [showSupPassword, setShowSupPassword] = useState(false);
  const [provisionMsg, setProvisionMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // PATH B: Admin "Add Cleaner" Form State
  const [isAddCleanerOpen, setIsAddCleanerOpen] = useState(false);
  const [cleanerFullName, setCleanerFullName] = useState('');
  const [cleanerEmail, setCleanerEmail] = useState('');
  const [cleanerPhone, setCleanerPhone] = useState('');
  const [cleanerPassword, setCleanerPassword] = useState('');
  const [showCleanerPassword, setShowCleanerPassword] = useState(false);
  const [cleanerSupervisorId, setCleanerSupervisorId] = useState('');
  const [cleanerSelectedLocalityIds, setCleanerSelectedLocalityIds] = useState<string[]>([]);
  const [cleanerAccountStatus, setCleanerAccountStatus] = useState<'active' | 'pending'>('active');
  const [addCleanerMsg, setAddCleanerMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isCreatingCleaner, setIsCreatingCleaner] = useState(false);

  // Cleaner Search & Filter
  const [cleanerSearch, setCleanerSearch] = useState('');
  const [cleanerStatusFilter, setCleanerStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');

  // Cleaner Application Review Modal State
  const [selectedApp, setSelectedApp] = useState<CleanerApplication | null>(null);
  const [appSupervisorId, setAppSupervisorId] = useState('');
  const [appApprovedLocalityIds, setAppApprovedLocalityIds] = useState<string[]>([]);
  const [appNotes, setAppNotes] = useState('');
  const [appReviewMsg, setAppReviewMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isReviewingApp, setIsReviewingApp] = useState(false);

  // Unified Cleaner Assignment Modal State (Supervisor + Localities)
  const [assignModalCleaner, setAssignModalCleaner] = useState<UserProfile | null>(null);
  const [assignModalSupervisorId, setAssignModalSupervisorId] = useState('');
  const [assignModalLocalityIds, setAssignModalLocalityIds] = useState<string[]>([]);
  const [isSavingUnifiedAssignment, setIsSavingUnifiedAssignment] = useState(false);
  const [assignModalMsg, setAssignModalMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Reset Password Modal State
  const [resetPwUser, setResetPwUser] = useState<UserProfile | null>(null);
  const [newUserPw, setNewUserPw] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [isResettingPw, setIsResettingPw] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Destructive Confirm Modal
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

  // Derived user lists
  const supervisors = users.filter((u) => u.role === 'supervisor' && u.accountStatus === 'active');
  const allSupervisors = users.filter((u) => u.role === 'supervisor');
  const cleaners = users.filter((u) => u.role === 'cleaner');
  const residents = users.filter((u) => u.role === 'resident');

  // Filtered cleaners
  const filteredCleaners = cleaners.filter((c) => {
    if (cleanerStatusFilter !== 'all' && c.accountStatus !== cleanerStatusFilter) return false;
    if (cleanerSearch.trim() !== '') {
      const q = cleanerSearch.toLowerCase().trim();
      const match =
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Overview metrics
  const totalComplaints = complaints.length;
  const resolvedComplaints = complaints.filter((c) => c.status === 'completed').length;
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;
  const activeDispatches = complaints.filter(
    (c) => c.status === 'in_progress' || c.status === 'assigned'
  ).length;
  const pendingTriage = complaints.filter((c) => c.status === 'submitted').length;

  // Waste category counts for SVG chart
  const wasteCategoryCounts: Record<string, number> = {};
  complaints.forEach((c) => {
    wasteCategoryCounts[c.wasteType] = (wasteCategoryCounts[c.wasteType] || 0) + 1;
  });

  // Status breakdown
  const statusCounts = {
    submitted: complaints.filter((c) => c.status === 'submitted').length,
    verified: complaints.filter((c) => c.status === 'verified').length,
    assigned: complaints.filter((c) => c.status === 'assigned').length,
    in_progress: complaints.filter((c) => c.status === 'in_progress').length,
    awaiting_verification: complaints.filter((c) => c.status === 'awaiting_verification').length,
    completed: complaints.filter((c) => c.status === 'completed').length,
    rejected: complaints.filter((c) => c.status === 'rejected').length,
  };

  // Flattened audit logs from all complaints
  const allAuditLogs = complaints
    .flatMap((c) =>
      c.history.map((h) => ({
        ...h,
        trackingCode: c.trackingCode,
        complaintAddress: c.address,
        localityName: c.localityName,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // --------------------------------------------------------------------------
  // Provision Supervisor Handler
  // --------------------------------------------------------------------------
  const handleProvisionSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionMsg(null);
    setIsProvisioning(true);

    const res = await portalStore.provisionSupervisor({
      email: supEmail,
      fullName: supFullName,
      phoneNumber: supPhone,
      password: supPassword,
    });

    setIsProvisioning(false);

    if (res.success) {
      setProvisionMsg({ text: `Supervisor ${supFullName} provisioned successfully!` });
      setSupFullName('');
      setSupEmail('');
      setSupPhone('');
      setSupPassword('');
    } else {
      setProvisionMsg({ text: res.error || 'Failed to provision supervisor.', error: true });
    }
  };

  // --------------------------------------------------------------------------
  // Create Cleaner (Path B) Handler
  // --------------------------------------------------------------------------
  const handleCreateCleaner = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCleanerMsg(null);
    setIsCreatingCleaner(true);

    const res = await portalStore.createCleanerByAdmin({
      email: cleanerEmail,
      fullName: cleanerFullName,
      phoneNumber: cleanerPhone,
      password: cleanerPassword,
      supervisorId: cleanerSupervisorId || undefined,
      localityIds: cleanerSelectedLocalityIds,
      accountStatus: cleanerAccountStatus,
    });

    setIsCreatingCleaner(false);

    if (res.success) {
      setAddCleanerMsg({ text: `Cleaner ${cleanerFullName} created and configured!` });
      setCleanerFullName('');
      setCleanerEmail('');
      setCleanerPhone('');
      setCleanerPassword('');
      setCleanerSupervisorId('');
      setCleanerSelectedLocalityIds([]);
      setTimeout(() => setIsAddCleanerOpen(false), 1200);
    } else {
      setAddCleanerMsg({ text: res.error || 'Failed to create cleaner.', error: true });
    }
  };

  // --------------------------------------------------------------------------
  // Open Unified Cleaner Assignment Modal
  // --------------------------------------------------------------------------
  const openUnifiedAssignment = (cleaner: UserProfile) => {
    setAssignModalCleaner(cleaner);
    setAssignModalSupervisorId(cleaner.supervisorId || '');
    const currentLocIds = serviceAreas
      .filter((sa) => sa.cleanerId === cleaner.id && sa.isApproved)
      .map((sa) => sa.localityId);
    setAssignModalLocalityIds(currentLocIds);
    setAssignModalMsg(null);
  };

  const handleSaveUnifiedAssignment = async () => {
    if (!assignModalCleaner) return;
    setIsSavingUnifiedAssignment(true);
    setAssignModalMsg(null);

    const res = await portalStore.updateCleaner({
      cleanerId: assignModalCleaner.id,
      supervisorId: assignModalSupervisorId || null,
      localityIds: assignModalLocalityIds,
      accountStatus: assignModalCleaner.accountStatus,
    });

    setIsSavingUnifiedAssignment(false);

    if (res.success) {
      setAssignModalMsg({ text: 'Assignments updated successfully!' });
      setTimeout(() => setAssignModalCleaner(null), 1000);
    } else {
      setAssignModalMsg({ text: res.error || 'Failed to update assignments.', error: true });
    }
  };

  // --------------------------------------------------------------------------
  // Reset Password Handler
  // --------------------------------------------------------------------------
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwUser || newUserPw.length < 6) return;

    setIsResettingPw(true);
    setResetPwMsg(null);

    const res = await portalStore.resetCleanerPassword(resetPwUser.id, newUserPw);
    setIsResettingPw(false);

    if (res.success) {
      setResetPwMsg({ text: `Password updated for ${resetPwUser.fullName}` });
      setTimeout(() => setResetPwUser(null), 1000);
    } else {
      setResetPwMsg({ text: res.error || 'Failed to reset password.', error: true });
    }
  };

  // --------------------------------------------------------------------------
  // Review Application Handler
  // --------------------------------------------------------------------------
  const handleApproveApp = async (app: CleanerApplication) => {
    setIsReviewingApp(true);
    setAppReviewMsg(null);

    const assignedLocalities =
      appApprovedLocalityIds.length > 0 ? appApprovedLocalityIds : (app.preferredLocalityIds || []).slice(0, 3);

    const res = await portalStore.reviewCleanerApplication(
      app.id,
      'approved',
      assignedLocalities,
      appSupervisorId || null,
      appNotes || 'Approved by municipal administrator.'
    );

    setIsReviewingApp(false);

    if (res.success) {
      setAppReviewMsg({ text: `Application for ${app.cleanerName} approved.` });
      setSelectedApp(null);
    } else {
      setAppReviewMsg({ text: res.error || 'Failed to approve application.', error: true });
    }
  };

  const handleRejectApp = (app: CleanerApplication) => {
    setConfirmModal({
      isOpen: true,
      title: 'REJECT CLEANER APPLICATION',
      message: `Decline onboarding application for ${app.cleanerName}?`,
      onConfirm: async () => {
        const res = await portalStore.reviewCleanerApplication(
          app.id,
          'rejected',
          [],
          null,
          appNotes || 'Declined by administrator.'
        );
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setSelectedApp(null);
        if (res.success) {
          setAppReviewMsg({ text: `Application for ${app.cleanerName} rejected.` });
        } else {
          setAppReviewMsg({ text: res.error || 'Failed to reject application.', error: true });
        }
      },
    });
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap border-b border-white/[0.08] bg-[#12161c] rounded-2xl p-1.5 shadow-xs gap-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'overview'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          <span>GOVERNANCE OVERVIEW</span>
        </button>

        <button
          onClick={() => setActiveTab('cleaners')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'cleaners'
              ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <HardHat className="w-3.5 h-3.5 text-amber-400" />
          <span>CLEANERS ({cleaners.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'applications'
              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
          <span>APPLICATIONS ({cleanerApplications.filter((a) => a.status === 'pending').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('supervisors')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'supervisors'
              ? 'bg-blue-950/70 text-blue-300 border border-blue-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>SUPERVISORS ({supervisors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'users'
              ? 'bg-purple-950/70 text-purple-300 border border-purple-500/40 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-purple-400" />
          <span>USER REGISTRY ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('localities')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'localities'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-slate-300" />
          <span>LOCALITIES ({localities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-2 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
            activeTab === 'audit'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5 text-slate-300" />
          <span>AUDIT LOG ({allAuditLogs.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: GOVERNANCE OVERVIEW (Visual Charts & Metrics)
         ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#12161c] p-4 rounded-2xl border border-white/[0.08] shadow-xs">
              <span className="font-mono-display text-[10px] text-slate-400 uppercase tracking-wider block">
                TOTAL REPORTS
              </span>
              <p className="text-3xl font-mono font-bold text-white mt-1">{totalComplaints}</p>
              <span className="text-[10px] text-emerald-400 font-mono mt-1 block">Live Audit Registry</span>
            </div>

            <div className="bg-[#12161c] p-4 rounded-2xl border border-white/[0.08] shadow-xs">
              <span className="font-mono-display text-[10px] text-slate-400 uppercase tracking-wider block">
                RESOLUTION RATE
              </span>
              <p className="text-3xl font-mono font-bold text-emerald-400 mt-1">{resolutionRate}%</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">Audited & Closed</span>
            </div>

            <div className="bg-[#12161c] p-4 rounded-2xl border border-white/[0.08] shadow-xs">
              <span className="font-mono-display text-[10px] text-slate-400 uppercase tracking-wider block">
                ACTIVE FIELD WORK
              </span>
              <p className="text-3xl font-mono font-bold text-cyan-400 mt-1">{activeDispatches}</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">Assigned or In-Progress</span>
            </div>

            <div className="bg-[#12161c] p-4 rounded-2xl border border-white/[0.08] shadow-xs">
              <span className="font-mono-display text-[10px] text-slate-400 uppercase tracking-wider block">
                TRIAGE PENDING
              </span>
              <p className="text-3xl font-mono font-bold text-amber-400 mt-1">{pendingTriage}</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">Requires Phone Verify</span>
            </div>
          </div>

          {/* SVG Visual Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown Bar Chart */}
            <div className="bg-[#12161c] rounded-3xl border border-white/[0.08] p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-mono-display uppercase tracking-wider text-xs font-bold text-white">
                    RESOLUTION PIPELINE DISTRIBUTION
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{totalComplaints} TOTAL</span>
              </div>

              <div className="space-y-3 pt-1">
                {Object.entries(statusCounts).map(([statusKey, count]) => {
                  const percent = totalComplaints > 0 ? Math.round((count / totalComplaints) * 100) : 0;
                  const colorMap: Record<string, string> = {
                    submitted: 'bg-amber-400',
                    verified: 'bg-cyan-400',
                    assigned: 'bg-indigo-400',
                    in_progress: 'bg-purple-400',
                    awaiting_verification: 'bg-orange-400',
                    completed: 'bg-emerald-400',
                    rejected: 'bg-rose-400',
                  };
                  const barColor = colorMap[statusKey] || 'bg-slate-400';

                  return (
                    <div key={statusKey} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="uppercase text-slate-300">{statusKey.replace('_', ' ')}</span>
                        <span className="text-slate-400">
                          {count} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#0b0d10] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Waste Categories Breakdown */}
            <div className="bg-[#12161c] rounded-3xl border border-white/[0.08] p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-mono-display uppercase tracking-wider text-xs font-bold text-white">
                    WASTE CATEGORY BREAKDOWN
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400">MUNICIPAL SECTORS</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {Object.entries(wasteCategoryCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="p-3.5 rounded-2xl bg-[#0b0d10] border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-xs uppercase text-white font-bold block">
                        {type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {Math.round((count / (totalComplaints || 1)) * 100)}% of volume
                      </span>
                    </div>
                    <span className="text-lg font-mono font-bold text-emerald-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CLEANER MANAGEMENT (Roster + Path B Creation + Service Areas)
         ========================================================================= */}
      {activeTab === 'cleaners' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <HardHat className="w-4 h-4 text-amber-400" />
                <span>FIELD CLEANER DIRECTORY</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage operational cleaners, assign supervisors, and authorize service sectors.
              </p>
            </div>

            <button
              onClick={() => setIsAddCleanerOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all cursor-pointer min-h-[44px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>ADD CLEANER (PATH B)</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#12161c] p-3.5 rounded-2xl border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={cleanerSearch}
                onChange={(e) => setCleanerSearch(e.target.value)}
                placeholder="Search cleaners by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white placeholder:text-slate-600 text-xs font-mono focus:border-amber-500/60 focus:outline-hidden min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={cleanerStatusFilter}
                onChange={(e) => setCleanerStatusFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-slate-300 text-xs font-mono cursor-pointer focus:border-amber-500/60 focus:outline-hidden min-h-[44px]"
              >
                <option value="all">ALL ACCOUNT STATUSES</option>
                <option value="active">ACTIVE</option>
                <option value="pending">PENDING</option>
                <option value="suspended">SUSPENDED</option>
              </select>
            </div>
          </div>

          {/* Cleaners Table */}
          <div className="bg-[#12161c] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0b0d10] text-slate-400 font-mono-display uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">CLEANER</th>
                    <th className="py-3 px-4">ASSIGNED SUPERVISOR</th>
                    <th className="py-3 px-4">AUTHORIZED LOCALITIES</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredCleaners.map((cleaner) => {
                    const sup = users.find((u) => u.id === cleaner.supervisorId);
                    const cleanerAreas = serviceAreas.filter((sa) => sa.cleanerId === cleaner.id && sa.isApproved);

                    return (
                      <tr key={cleaner.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-white block font-sans font-bold">{cleaner.fullName}</span>
                          <span className="text-slate-500 text-[10px]">{cleaner.email} • {cleaner.phoneNumber}</span>
                        </td>
                        <td className="py-3 px-4">
                          {sup ? (
                            <span className="text-blue-400 font-medium">{sup.fullName}</span>
                          ) : (
                            <span className="text-slate-500">UNASSIGNED</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-emerald-400 font-bold">{cleanerAreas.length} Localities</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                              cleaner.accountStatus === 'active'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                                : cleaner.accountStatus === 'pending'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {cleaner.accountStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => openUnifiedAssignment(cleaner)}
                            className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs transition-colors cursor-pointer"
                          >
                            ASSIGN
                          </button>
                          <button
                            onClick={() => {
                              setResetPwUser(cleaner);
                              setNewUserPw('');
                              setResetPwMsg(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs transition-colors cursor-pointer"
                            title="Reset password"
                          >
                            <KeyRound className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: APPLICATIONS (Cleaner Applications)
         ========================================================================= */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="font-mono-display text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>CLEANER APPLICATIONS (PATH A)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review self-registered cleaner candidate submissions.
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

          {cleanerApplications.length === 0 ? (
            <div className="p-12 text-center bg-[#12161c] rounded-3xl border border-white/[0.08] shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-mono text-sm font-bold text-white">NO APPLICATIONS RECORDED</h4>
              <p className="text-xs text-slate-400">Applications submitted from the registration modal will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cleanerApplications.map((app) => (
                <div
                  key={app.id}
                  className="bg-[#12161c] rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs"
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
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                        app.status === 'approved'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                          : app.status === 'rejected'
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">
                      PREFERRED LOCALITIES ({(app.preferredLocalityIds || []).length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(app.preferredLocalityIds || []).map((id) => (
                        <span
                          key={id}
                          className="px-2 py-0.5 rounded-lg bg-[#0b0d10] border border-white/5 text-[11px] font-mono text-slate-300"
                        >
                          {localities.find((l) => l.id === id)?.name || id}
                        </span>
                      ))}
                    </div>
                  </div>

                  {app.status === 'pending' && (
                    <div className="pt-2 border-t border-white/5 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setAppSupervisorId(supervisors[0]?.id || '');
                          setAppApprovedLocalityIds((app.preferredLocalityIds || []).slice(0, 3));
                          setAppNotes('');
                        }}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[44px]"
                      >
                        REVIEW & APPROVE
                      </button>
                      <button
                        onClick={() => handleRejectApp(app)}
                        className="py-2 px-3 rounded-xl border border-rose-500/30 hover:bg-rose-950 text-rose-300 font-mono text-xs uppercase cursor-pointer min-h-[44px]"
                      >
                        DECLINE
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: SUPERVISOR PROVISIONING & ROSTER
         ========================================================================= */}
      {activeTab === 'supervisors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provisioning Form */}
          <div className="bg-[#12161c] rounded-3xl border border-white/[0.08] p-6 space-y-5 shadow-sm">
            <div>
              <h3 className="font-mono-display uppercase tracking-wider text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <span>PROVISION SUPERVISOR</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Supervisors conduct voice verification with residents and dispatch field cleaners. Public sign up is disabled.
              </p>
            </div>

            {provisionMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-mono ${
                  provisionMsg.error
                    ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {provisionMsg.text}
              </div>
            )}

            <form onSubmit={handleProvisionSupervisor} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  value={supFullName}
                  onChange={(e) => setSupFullName(e.target.value)}
                  placeholder="Supervisor Name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-blue-500/60 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  OFFICIAL EMAIL
                </label>
                <input
                  type="email"
                  required
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="supervisor@civicpickup.gov"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-blue-500/60 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  PHONE NUMBER
                </label>
                <input
                  type="tel"
                  required
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+1-555-0100"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-blue-500/60 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  SECURE PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showSupPassword ? 'text' : 'password'}
                    required
                    value={supPassword}
                    onChange={(e) => setSupPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-blue-500/60 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupPassword(!showSupPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showSupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProvisioning}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all cursor-pointer min-h-[44px]"
              >
                {isProvisioning ? 'PROVISIONING...' : 'PROVISION SUPERVISOR'}
              </button>
            </form>
          </div>

          {/* Supervisors Roster */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-mono-display uppercase tracking-wider text-sm font-bold text-white">
              ACTIVE SUPERVISORS ({supervisors.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allSupervisors.map((s) => {
                const managedCleaners = cleaners.filter((c) => c.supervisorId === s.id);
                return (
                  <div
                    key={s.id}
                    className="bg-[#12161c] rounded-2xl border border-white/[0.08] p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white font-sans">{s.fullName}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-blue-950/60 text-blue-300 border border-blue-500/30">
                        {s.accountStatus}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0b0d10] border border-white/5 space-y-1 text-xs font-mono text-slate-400">
                      <div>EMAIL: <span className="text-white">{s.email}</span></div>
                      <div>PHONE: <span className="text-white">{s.phoneNumber}</span></div>
                      <div>ASSIGNED CLEANERS: <span className="text-cyan-400 font-bold">{managedCleaners.length}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: USER REGISTRY (All 4 Roles)
         ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-[#12161c] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0b0d10] text-slate-400 font-mono-display uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">NAME & EMAIL</th>
                    <th className="py-3 px-4">ROLE</th>
                    <th className="py-3 px-4">PHONE</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4">JOINED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-white block font-sans font-bold">{u.fullName}</span>
                        <span className="text-slate-500 text-[10px]">{u.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 border border-white/10 text-slate-300">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{u.phoneNumber}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.accountStatus === 'active'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[10px]">
                        {new Date(u.createdAt).toLocaleDateString()}
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
          TAB 6: LOCALITIES (Municipal Wards)
         ========================================================================= */}
      {activeTab === 'localities' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {localities.map((loc) => {
              const count = complaints.filter((c) => c.localityId === loc.id).length;
              return (
                <div
                  key={loc.id}
                  className="bg-[#12161c] rounded-2xl border border-white/[0.08] p-4 flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="font-bold text-sm text-white font-sans">{loc.name}</h4>
                      <span className="font-mono text-[10px] text-slate-400">
                        {count} TOTAL COMPLAINTS
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: AUDIT LOG (Immutable History)
         ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-[#12161c] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0b0d10] text-slate-400 font-mono-display uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">TIMESTAMP</th>
                    <th className="py-3 px-4">TRACKING ID</th>
                    <th className="py-3 px-4">SECTOR</th>
                    <th className="py-3 px-4">STATUS TRANSITION</th>
                    <th className="py-3 px-4">ACTOR</th>
                    <th className="py-3 px-4">NOTES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {allAuditLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-slate-500 text-[10px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold whitespace-nowrap">
                        {log.trackingCode}
                      </td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{log.localityName}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={log.newStatus} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                        {log.actorName} ({log.actorRole.toUpperCase()})
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                        {log.note || '—'}
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
          MODAL: ADD CLEANER (PATH B)
         ========================================================================= */}
      {isAddCleanerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0f1217] border border-white/10 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-100">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="font-mono text-[10px] text-amber-400 uppercase font-bold">
                  ADMINISTRATIVE PROVISIONING
                </span>
                <h3 className="text-lg font-mono font-bold uppercase text-white mt-0.5">
                  CREATE CLEANER ACCOUNT (PATH B)
                </h3>
              </div>
              <button
                onClick={() => setIsAddCleanerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addCleanerMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-mono ${
                  addCleanerMsg.error
                    ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {addCleanerMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateCleaner} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  value={cleanerFullName}
                  onChange={(e) => setCleanerFullName(e.target.value)}
                  placeholder="Cleaner Name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    required
                    value={cleanerEmail}
                    onChange={(e) => setCleanerEmail(e.target.value)}
                    placeholder="cleaner@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                    PHONE
                  </label>
                  <input
                    type="tel"
                    required
                    value={cleanerPhone}
                    onChange={(e) => setCleanerPhone(e.target.value)}
                    placeholder="+1-555-0100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  INITIAL PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showCleanerPassword ? 'text' : 'password'}
                    required
                    value={cleanerPassword}
                    onChange={(e) => setCleanerPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCleanerPassword(!showCleanerPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showCleanerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  ASSIGN SUPERVISOR
                </label>
                <select
                  value={cleanerSupervisorId}
                  onChange={(e) => setCleanerSupervisorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- UNASSIGNED --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  SELECT SERVICE LOCALITIES
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-[#0b0d10] border border-white/10">
                  {localities.map((loc) => {
                    const checked = cleanerSelectedLocalityIds.includes(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          setCleanerSelectedLocalityIds((prev) =>
                            checked ? prev.filter((id) => id !== loc.id) : [...prev, loc.id]
                          );
                        }}
                        className={`p-2 rounded-lg text-left text-xs font-mono flex items-center justify-between border cursor-pointer ${
                          checked
                            ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                            : 'border-white/5 bg-[#12161c] text-slate-400'
                        }`}
                      >
                        <span className="truncate">{loc.name}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingCleaner}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all cursor-pointer min-h-[44px]"
              >
                {isCreatingCleaner ? 'CREATING...' : 'CREATE & ACTIVATE CLEANER'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: UNIFIED CLEANER ASSIGNMENT (Supervisor + Localities)
         ========================================================================= */}
      {assignModalCleaner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0f1217] border border-white/10 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-100">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="font-mono text-[10px] text-cyan-400 uppercase font-bold">
                  CLEANER CONFIGURATION
                </span>
                <h3 className="text-lg font-mono font-bold uppercase text-white mt-0.5">
                  {assignModalCleaner.fullName}
                </h3>
              </div>
              <button
                onClick={() => setAssignModalCleaner(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignModalMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                {assignModalMsg.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  ASSIGN SUPERVISOR
                </label>
                <select
                  value={assignModalSupervisorId}
                  onChange={(e) => setAssignModalSupervisorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono cursor-pointer"
                >
                  <option value="">-- UNASSIGNED --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  ASSIGNED SERVICE LOCALITIES ({assignModalLocalityIds.length} SELECTED)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-[#0b0d10] border border-white/10">
                  {localities.map((loc) => {
                    const checked = assignModalLocalityIds.includes(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          setAssignModalLocalityIds((prev) =>
                            checked ? prev.filter((id) => id !== loc.id) : [...prev, loc.id]
                          );
                        }}
                        className={`p-2 rounded-lg text-left text-xs font-mono flex items-center justify-between border cursor-pointer ${
                          checked
                            ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
                            : 'border-white/5 bg-[#12161c] text-slate-400'
                        }`}
                      >
                        <span className="truncate">{loc.name}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveUnifiedAssignment}
                disabled={isSavingUnifiedAssignment}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer min-h-[44px]"
              >
                {isSavingUnifiedAssignment ? 'SAVING...' : 'SAVE ASSIGNMENTS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESET PASSWORD
         ========================================================================= */}
      {resetPwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0f1217] border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-100">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="font-mono text-[10px] text-amber-400 uppercase font-bold">
                  SECURITY CREDENTIAL OVERRIDE
                </span>
                <h3 className="text-base font-mono font-bold uppercase text-white mt-0.5">
                  RESET PASSWORD FOR {resetPwUser.fullName}
                </h3>
              </div>
              <button
                onClick={() => setResetPwUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetPwMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                {resetPwMsg.text}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                  NEW PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    required
                    value={newUserPw}
                    onChange={(e) => setNewUserPw(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0b0d10] text-white text-xs font-mono focus:border-amber-500/60 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPw(!showResetPw)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isResettingPw || newUserPw.length < 6}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all cursor-pointer min-h-[44px]"
              >
                {isResettingPw ? 'UPDATING...' : 'UPDATE PASSWORD'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
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
