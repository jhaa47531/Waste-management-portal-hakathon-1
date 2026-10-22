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
    'applications' | 'cleaners' | 'supervisors' | 'users' | 'localities' | 'audit'
  >('applications');

  // --------------------------------------------------------------------------
  // Supervisor Provisioning Form State
  // --------------------------------------------------------------------------
  const [supFullName, setSupFullName] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supPassword, setSupPassword] = useState('');
  const [showSupPassword, setShowSupPassword] = useState(false);
  const [provisionMsg, setProvisionMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // --------------------------------------------------------------------------
  // PATH B: Admin "Add Cleaner" Form State
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Cleaner Search & Filtering
  // --------------------------------------------------------------------------
  const [cleanerSearch, setCleanerSearch] = useState('');
  const [cleanerStatusFilter, setCleanerStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');

  // --------------------------------------------------------------------------
  // Cleaner Application Review Modal State
  // --------------------------------------------------------------------------
  const [selectedApp, setSelectedApp] = useState<CleanerApplication | null>(null);
  const [appSupervisorId, setAppSupervisorId] = useState('');
  const [appApprovedLocalityIds, setAppApprovedLocalityIds] = useState<string[]>([]);
  const [appNotes, setAppNotes] = useState('');
  const [appReviewMsg, setAppReviewMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isReviewingApp, setIsReviewingApp] = useState(false);

  // --------------------------------------------------------------------------
  // Reassign Supervisor Modal State
  // --------------------------------------------------------------------------
  const [reassignCleaner, setReassignCleaner] = useState<UserProfile | null>(null);
  const [newSupervisorId, setNewSupervisorId] = useState('');
  const [isUpdatingSupervisor, setIsUpdatingSupervisor] = useState(false);
  const [reassignMsg, setReassignMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // --------------------------------------------------------------------------
  // Edit Service Areas Modal State
  // --------------------------------------------------------------------------
  const [editAreasCleaner, setEditAreasCleaner] = useState<UserProfile | null>(null);
  const [editLocalityIds, setEditLocalityIds] = useState<string[]>([]);
  const [isUpdatingAreas, setIsUpdatingAreas] = useState(false);
  const [editAreasMsg, setEditAreasMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // --------------------------------------------------------------------------
  // Unified Cleaner Assignment Modal State (Supervisor + Localities)
  // --------------------------------------------------------------------------
  const [assignModalCleaner, setAssignModalCleaner] = useState<UserProfile | null>(null);
  const [assignModalSupervisorId, setAssignModalSupervisorId] = useState('');
  const [assignModalLocalityIds, setAssignModalLocalityIds] = useState<string[]>([]);
  const [isSavingUnifiedAssignment, setIsSavingUnifiedAssignment] = useState(false);
  const [assignModalMsg, setAssignModalMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // --------------------------------------------------------------------------
  // Reset Password Modal State
  // --------------------------------------------------------------------------
  const [resetPwCleaner, setResetPwCleaner] = useState<UserProfile | null>(null);
  const [newCleanerPw, setNewCleanerPw] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [isResettingPw, setIsResettingPw] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Derived user lists
  const supervisors = users.filter((u) => u.role === 'supervisor' && u.accountStatus === 'active');
  const allSupervisors = users.filter((u) => u.role === 'supervisor');
  const cleaners = users.filter((u) => u.role === 'cleaner');

  // Filtered cleaners
  const filteredCleaners = cleaners.filter((c) => {
    if (cleanerStatusFilter !== 'all' && c.accountStatus !== cleanerStatusFilter) return false;
    if (cleanerSearch.trim() !== '') {
      const q = cleanerSearch.toLowerCase();
      const match =
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q);
      if (!match) return false;
    }
    return true;
  });

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

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  // Provision Supervisor Handler
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
    if (!supPassword || supPassword.length < 8) {
      setProvisionMsg({ text: 'Temporary password must be at least 8 characters long.', error: true });
      return;
    }

    setIsProvisioning(true);
    const res = await portalStore.provisionSupervisor({
      email: supEmail,
      fullName: supFullName,
      phoneNumber: supPhone,
      password: supPassword,
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
      setSupPassword('');
      setShowSupPassword(false);
      setTimeout(() => setProvisionMsg(null), 8000);
    } else {
      setProvisionMsg({ text: res.error || 'Supervisor provisioning failed.', error: true });
    }
  };

  // PATH B: Create Cleaner Account Handler
  const handleCreateCleaner = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCleanerMsg(null);

    if (cleanerFullName.trim().length < 2) {
      setAddCleanerMsg({ text: 'Full name must be at least 2 characters.', error: true });
      return;
    }
    if (cleanerPhone.trim().length < 7) {
      setAddCleanerMsg({ text: 'Phone number must be at least 7 characters.', error: true });
      return;
    }
    if (cleanerPassword.length < 8) {
      setAddCleanerMsg({ text: 'Initial password must be at least 8 characters long.', error: true });
      return;
    }
    if (cleanerSelectedLocalityIds.length === 0) {
      setAddCleanerMsg({ text: 'Please select at least 1 authorized service locality.', error: true });
      return;
    }

    setIsCreatingCleaner(true);
    const res = await portalStore.createCleanerByAdmin({
      email: cleanerEmail,
      fullName: cleanerFullName,
      phoneNumber: cleanerPhone,
      password: cleanerPassword,
      supervisorId: cleanerSupervisorId || null,
      localityIds: cleanerSelectedLocalityIds,
      accountStatus: cleanerAccountStatus,
    });
    setIsCreatingCleaner(false);

    if (res.success) {
      setAddCleanerMsg({
        text: `Cleaner account for ${cleanerFullName} (${cleanerEmail}) successfully created with credentials!`,
      });
      setCleanerFullName('');
      setCleanerEmail('');
      setCleanerPhone('');
      setCleanerPassword('');
      setCleanerSupervisorId('');
      setCleanerSelectedLocalityIds([]);
      setShowCleanerPassword(false);
      setTimeout(() => {
        setAddCleanerMsg(null);
        setIsAddCleanerOpen(false);
      }, 3000);
    } else {
      setAddCleanerMsg({ text: res.error || 'Failed to create cleaner account.', error: true });
    }
  };

  // Open Application Review Modal
  const handleOpenReviewApp = (app: CleanerApplication) => {
    setSelectedApp(app);
    setAppSupervisorId(app.assignedSupervisorId || '');
    const reqLocs = serviceAreas
      .filter((sa) => sa.cleanerId === app.cleanerId)
      .map((sa) => sa.localityId);
    setAppApprovedLocalityIds(reqLocs.length > 0 ? reqLocs : localities.slice(0, 2).map((l) => l.id));
    setAppNotes(app.reviewNotes || '');
    setAppReviewMsg(null);
  };

  // Submit Application Review (Approve / Reject)
  const handleSubmitAppReview = async (decision: 'approved' | 'rejected') => {
    if (!selectedApp) return;
    setAppReviewMsg(null);

    if (decision === 'approved' && appApprovedLocalityIds.length === 0) {
      setAppReviewMsg({
        text: 'Please select at least 1 authorized service locality for approval.',
        error: true,
      });
      return;
    }

    setIsReviewingApp(true);
    const res = await portalStore.reviewCleanerApplication(
      selectedApp.id,
      decision,
      decision === 'approved' ? appApprovedLocalityIds : [],
      decision === 'approved' ? appSupervisorId || null : null,
      appNotes
    );
    setIsReviewingApp(false);

    if (res.success) {
      setAppReviewMsg({
        text: `Cleaner application successfully ${decision}.`,
      });
      setTimeout(() => {
        setSelectedApp(null);
        setAppReviewMsg(null);
      }, 2000);
    } else {
      setAppReviewMsg({ text: res.error || 'Failed to process application review.', error: true });
    }
  };

  // Toggle Locality in Add Cleaner form
  const toggleAddCleanerLocality = (locId: string) => {
    setCleanerSelectedLocalityIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  // Toggle Locality in Review form
  const toggleReviewLocality = (locId: string) => {
    setAppApprovedLocalityIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  // Reassign Supervisor Handler
  const handleSaveReassign = async () => {
    if (!reassignCleaner) return;
    setIsUpdatingSupervisor(true);
    setReassignMsg(null);

    const res = await portalStore.updateCleaner({
      cleanerId: reassignCleaner.id,
      supervisorId: newSupervisorId || null,
    });
    setIsUpdatingSupervisor(false);

    if (res.success) {
      setReassignMsg({ text: 'Supervisor assigned successfully!' });
      setTimeout(() => {
        setReassignCleaner(null);
        setReassignMsg(null);
      }, 1500);
    } else {
      setReassignMsg({ text: res.error || 'Failed to assign supervisor.', error: true });
    }
  };

  // Toggle Cleaner Account Status (Active <-> Suspended)
  const handleToggleCleanerStatus = async (cleaner: UserProfile) => {
    const nextStatus = cleaner.accountStatus === 'active' ? 'suspended' : 'active';
    await portalStore.updateCleaner({
      cleanerId: cleaner.id,
      accountStatus: nextStatus,
    });
  };

  // Edit Service Areas Handler
  const handleOpenEditAreas = (cleaner: UserProfile) => {
    setEditAreasCleaner(cleaner);
    const existingIds = serviceAreas
      .filter((sa) => sa.cleanerId === cleaner.id && sa.isApproved)
      .map((sa) => sa.localityId);
    setEditLocalityIds(existingIds);
    setEditAreasMsg(null);
  };

  const handleSaveServiceAreas = async () => {
    if (!editAreasCleaner) return;
    setIsUpdatingAreas(true);
    setEditAreasMsg(null);

    const res = await portalStore.updateCleaner({
      cleanerId: editAreasCleaner.id,
      localityIds: editLocalityIds,
    });
    setIsUpdatingAreas(false);

    if (res.success) {
      setEditAreasMsg({ text: 'Authorized service areas updated successfully!' });
      setTimeout(() => {
        setEditAreasCleaner(null);
        setEditAreasMsg(null);
      }, 1500);
    } else {
      setEditAreasMsg({ text: res.error || 'Failed to update service areas.', error: true });
    }
  };

  // Unified Cleaner Assignment Handler (Supervisor + Localities simultaneously)
  const handleOpenAssignModal = (cleaner: UserProfile) => {
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
    });
    setIsSavingUnifiedAssignment(false);

    if (res.success) {
      setAssignModalMsg({ text: 'Supervisor and service localities saved successfully!' });
      setTimeout(() => {
        setAssignModalCleaner(null);
        setAssignModalMsg(null);
      }, 1500);
    } else {
      setAssignModalMsg({ text: res.error || 'Failed to update cleaner assignment.', error: true });
    }
  };

  // Reset Cleaner Password Handler
  const handleSaveResetPassword = async () => {
    if (!resetPwCleaner) return;
    if (newCleanerPw.length < 8) {
      setResetPwMsg({ text: 'Password must be at least 8 characters long.', error: true });
      return;
    }

    setIsResettingPw(true);
    setResetPwMsg(null);

    const res = await portalStore.resetCleanerPassword(resetPwCleaner.id, newCleanerPw);
    setIsResettingPw(false);

    if (res.success) {
      setResetPwMsg({ text: 'Temporary password set successfully!' });
      setTimeout(() => {
        setResetPwCleaner(null);
        setNewCleanerPw('');
        setResetPwMsg(null);
      }, 2000);
    } else {
      setResetPwMsg({ text: res.error || 'Failed to reset password.', error: true });
    }
  };

  const pendingAppsCount = cleanerApplications.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Admin Title Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-colors">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-purple-700 dark:text-purple-300">
              Municipal Governance Console
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Administrator Administration & Governance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Designated Administrator: <span className="font-semibold text-slate-700 dark:text-slate-200">{currentUser.email}</span>. Manage cleaner accounts, review applications, assign supervisors, and inspect audit records.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
          <div className="text-center px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{pendingAppsCount}</span>
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 mt-0.5">Pending Apps</p>
          </div>
          <div className="text-center px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{cleaners.length}</span>
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 mt-0.5">Cleaners</p>
          </div>
          <div className="text-center px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{supervisors.length}</span>
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 mt-0.5">Supervisors</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl px-4 pt-2 shadow-xs gap-1 overflow-x-auto transition-colors">
        <button
          onClick={() => setActiveTab('applications')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'applications'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 dark:border-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          Cleaner Applications
          {pendingAppsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              {pendingAppsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cleaners')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'cleaners'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 dark:border-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Cleaner Management ({cleaners.length})
        </button>

        <button
          onClick={() => setActiveTab('supervisors')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'supervisors'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 dark:border-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Supervisor Provisioning ({supervisors.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 dark:border-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          User Registry ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('localities')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'localities'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 dark:border-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Municipal Localities ({localities.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 dark:border-purple-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          System Audit Trail ({allAuditHistory.length})
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: CLEANER APPLICATIONS (Path A Review & Approval)               */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Self-Registered Cleaner Applications (Path A)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review incoming cleaner submissions. Approving an application activates the cleaner account and binds them to an authorized Supervisor and service areas.
              </p>
            </div>
          </div>

          {cleanerApplications.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Cleaner Applications Submitted</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                Prospective cleaners who submit the self-registration form on the public portal will appear here for administrative verification and supervisor assignment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cleanerApplications.map((app) => {
                const reqServiceAreas = serviceAreas.filter((sa) => sa.cleanerId === app.cleanerId);
                const isPending = app.status === 'pending';

                return (
                  <div
                    key={app.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            app.status === 'approved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : app.status === 'rejected'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {app.status}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <HardHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          {app.cleanerName}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">{app.cleanerEmail}</p>
                        {app.cleanerPhone && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{app.cleanerPhone}</p>
                        )}
                      </div>

                      {app.assignedSupervisorName && (
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs">
                          <span className="font-bold block text-[10px] uppercase text-blue-700 dark:text-blue-400">
                            Assigned Supervisor:
                          </span>
                          <span className="font-semibold">{app.assignedSupervisorName}</span>
                        </div>
                      )}

                      {app.reviewNotes && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs">
                          <span className="font-bold block text-[10px] uppercase text-slate-500 dark:text-slate-400">
                            Review Notes:
                          </span>
                          <span className="italic">{app.reviewNotes}</span>
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 block mb-1">
                          Requested Localities ({reqServiceAreas.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {reqServiceAreas.map((sa) => (
                            <span
                              key={sa.localityId}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                sa.isApproved
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {sa.localityName} {sa.isApproved ? '✓' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      {isPending ? (
                        <button
                          onClick={() => handleOpenReviewApp(app)}
                          className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          Review & Assign Supervisor
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenReviewApp(app)}
                          className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Update Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: CLEANER MANAGEMENT (Path B Creation, Reassignment & Status)   */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'cleaners' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cleaner Accounts & Work Assignments
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active municipal cleaners, their assigned Supervisor, authorized coverage zones, and operational task volume.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <button
                onClick={() => setIsAddCleanerOpen(true)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Cleaner Account (Direct)
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={cleanerSearch}
                onChange={(e) => setCleanerSearch(e.target.value)}
                placeholder="Search cleaners by name, email, or phone..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status:</span>
              <select
                value={cleanerStatusFilter}
                onChange={(e) => setCleanerStatusFilter(e.target.value as any)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Accounts ({cleaners.length})</option>
                <option value="active">Active ({cleaners.filter((c) => c.accountStatus === 'active').length})</option>
                <option value="pending">Pending ({cleaners.filter((c) => c.accountStatus === 'pending').length})</option>
                <option value="suspended">Suspended ({cleaners.filter((c) => c.accountStatus === 'suspended').length})</option>
              </select>
            </div>
          </div>

          {filteredCleaners.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <HardHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Cleaner Accounts Match Filters</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Click &quot;Add Cleaner Account&quot; to provision a new cleaner directly, or clear your search criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCleaners.map((cleaner) => {
                const assignedSup = supervisors.find((s) => s.id === cleaner.supervisorId);
                const approvedLocs = serviceAreas.filter((sa) => sa.cleanerId === cleaner.id && sa.isApproved);
                const assignedTasks = complaints.filter((c) => c.assignedCleanerId === cleaner.id);
                const completedTasks = assignedTasks.filter((c) => c.status === 'completed');
                const inProgressTasks = assignedTasks.filter((c) => c.status === 'in_progress');

                return (
                  <div
                    key={cleaner.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-bold text-xs">
                              {cleaner.fullName.charAt(0)}
                            </span>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{cleaner.fullName}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{cleaner.email}</p>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            cleaner.accountStatus === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : cleaner.accountStatus === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {cleaner.accountStatus}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-slate-400">Phone: </span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{cleaner.phoneNumber}</span>
                      </div>

                      {/* Assigned Supervisor */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Assigned Supervisor:
                          </span>
                          <button
                            onClick={() => {
                              setReassignCleaner(cleaner);
                              setNewSupervisorId(cleaner.supervisorId || '');
                              setReassignMsg(null);
                            }}
                            className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 font-bold underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                        {assignedSup || cleaner.supervisorName ? (
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{assignedSup?.fullName || cleaner.supervisorName}</span>
                          </div>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 italic text-[11px] flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            No Supervisor Assigned
                          </span>
                        )}
                      </div>

                      {/* Authorized Service Areas */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Authorized Localities ({approvedLocs.length}):
                          </span>
                          <button
                            onClick={() => handleOpenEditAreas(cleaner)}
                            className="text-[10px] text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 font-bold underline cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {approvedLocs.length > 0 ? (
                            approvedLocs.map((sa) => (
                              <span
                                key={sa.localityId}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                              >
                                {sa.localityName}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">None authorized</span>
                          )}
                        </div>
                      </div>

                      {/* Work Assignment Stats */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">{assignedTasks.length}</span>
                          <p className="text-[9px] uppercase font-bold text-slate-400">Total</p>
                        </div>
                        <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg">
                          <span className="text-xs font-bold text-purple-800 dark:text-purple-300 tabular-nums">{inProgressTasks.length}</span>
                          <p className="text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400">Active</p>
                        </div>
                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">{completedTasks.length}</span>
                          <p className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Done</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <button
                        onClick={() => handleOpenAssignModal(cleaner)}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Assign Supervisor & Coverage Localities
                      </button>

                      <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleCleanerStatus(cleaner)}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                          cleaner.accountStatus === 'active'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        }`}
                      >
                        {cleaner.accountStatus === 'active' ? 'Suspend Account' : 'Activate Account'}
                      </button>

                      <button
                        onClick={() => {
                          setResetPwCleaner(cleaner);
                          setNewCleanerPw('');
                          setResetPwMsg(null);
                        }}
                        className="py-1.5 px-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Set new initial temporary password"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        Reset PW
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: SUPERVISOR PROVISIONING (Existing Feature Preserved)          */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'supervisors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Provision New Supervisor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Grant elevated municipal supervisor permissions to authorized operational staff.
              </p>
            </div>

            {provisionMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  provisionMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {provisionMsg.error ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span>{provisionMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleProvisionSupervisor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={supFullName}
                  onChange={(e) => setSupFullName(e.target.value)}
                  placeholder="e.g. Inspector Davis"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="supervisor@civicwaste.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+1-555-0199"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Temporary Initial Password *
                  </label>
                  <span className="text-[10px] text-slate-400">Min 8 chars</span>
                </div>
                <div className="relative">
                  <input
                    type={showSupPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={supPassword}
                    onChange={(e) => setSupPassword(e.target.value)}
                    placeholder="Enter secure initial password"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono text-xs"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupPassword(!showSupPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0.5"
                  >
                    {showSupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProvisioning}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-40 transition-colors"
              >
                {isProvisioning ? 'Provisioning...' : 'Provision Supervisor'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Active Municipal Supervisors ({supervisors.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allSupervisors.map((s) => {
                const supervisedCleaners = cleaners.filter((c) => c.supervisorId === s.id);
                return (
                  <div key={s.id} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{s.fullName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Supervisor
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{s.email}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{s.phoneNumber}</p>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Assigned Cleaners:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{supervisedCleaners.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: USER REGISTRY (Existing Feature Preserved)                     */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Complete Municipal Accounts Registry</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {users.map((u) => {
                  const sup = allSupervisors.find((s) => s.id === u.supervisorId);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{u.fullName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-bold text-slate-800 dark:text-slate-200">{u.role}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            u.accountStatus === 'active'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {sup?.fullName || u.supervisorName || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500 tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 5: MUNICIPAL LOCALITIES (Existing Feature Preserved)               */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'localities' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Controlled Municipal Localities</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official operational boundaries for resident complaints and cleaner service authorizations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {localities.map((loc) => {
              const activeCount = complaints.filter((c) => c.localityId === loc.id).length;
              return (
                <div key={loc.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 space-y-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {loc.name}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Requests: <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{activeCount}</span></p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 6: AUDIT TRAIL (Existing Feature Preserved)                       */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Immutable Municipal Audit Trail</h3>
          <div className="space-y-3">
            {allAuditHistory.slice(0, 30).map((h) => (
              <div key={h.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex justify-between items-center">
                <div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mr-2">{h.trackingCode}</span>
                  <span className="text-slate-600 dark:text-slate-300">{h.note || 'Status updated'}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: PATH B — ADMIN ADD CLEANER                                  */}
      {/* --------------------------------------------------------------------- */}
      {isAddCleanerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Add Cleaner Account Directly (Path B)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Provision a verified cleaner account without requiring self-registration.
                </p>
              </div>
              <button
                onClick={() => setIsAddCleanerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addCleanerMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  addCleanerMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {addCleanerMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{addCleanerMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateCleaner} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={cleanerFullName}
                  onChange={(e) => setCleanerFullName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email / Login ID *</label>
                  <input
                    type="email"
                    required
                    value={cleanerEmail}
                    onChange={(e) => setCleanerEmail(e.target.value)}
                    placeholder="cleaner@civicwaste.org"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={cleanerPhone}
                    onChange={(e) => setCleanerPhone(e.target.value)}
                    placeholder="+1-555-0144"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Initial Password *</label>
                  <span className="text-[10px] text-slate-400">Min 8 characters</span>
                </div>
                <div className="relative">
                  <input
                    type={showCleanerPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={cleanerPassword}
                    onChange={(e) => setCleanerPassword(e.target.value)}
                    placeholder="Enter initial password for cleaner"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono text-xs"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCleanerPassword(!showCleanerPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 cursor-pointer"
                  >
                    {showCleanerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Supervisor
                  </label>
                  <select
                    value={cleanerSupervisorId}
                    onChange={(e) => setCleanerSupervisorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="">-- Optional / Assign Later --</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Initial Status *</label>
                  <select
                    value={cleanerAccountStatus}
                    onChange={(e) => setCleanerAccountStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="active">Active (Permitted for dispatch)</option>
                    <option value="pending">Pending (Review required)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorized Service Localities * ({cleanerSelectedLocalityIds.length} selected)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  {localities.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={cleanerSelectedLocalityIds.includes(loc.id)}
                        onChange={() => toggleAddCleanerLocality(loc.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="truncate">{loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCleanerOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCleaner}
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {isCreatingCleaner ? 'Creating Account...' : 'Create Cleaner Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: APPLICATION REVIEW & SUPERVISOR ASSIGNMENT                   */}
      {/* --------------------------------------------------------------------- */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Review Cleaner Application
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Applicant: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedApp.cleanerName}</span> ({selectedApp.cleanerEmail})
                </p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {appReviewMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  appReviewMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {appReviewMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{appReviewMsg.text}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Operational Supervisor
                </label>
                <select
                  value={appSupervisorId}
                  onChange={(e) => setAppSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="">-- Select Active Supervisor --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Cleaners report to and receive authorized task dispatches from their assigned supervisor.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorize Service Localities ({appApprovedLocalityIds.length} approved)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  {localities.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={appApprovedLocalityIds.includes(loc.id)}
                        onChange={() => toggleReviewLocality(loc.id)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="truncate">{loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Review Notes</label>
                <textarea
                  rows={2}
                  value={appNotes}
                  onChange={(e) => setAppNotes(e.target.value)}
                  placeholder="e.g. Identity and zone coverage confirmed."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isReviewingApp}
                  onClick={() => handleSubmitAppReview('rejected')}
                  className="py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-bold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  Reject Application
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isReviewingApp}
                    onClick={() => handleSubmitAppReview('approved')}
                    className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    {isReviewingApp ? 'Processing...' : 'Approve & Activate Cleaner'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3: REASSIGN SUPERVISOR                                         */}
      {/* --------------------------------------------------------------------- */}
      {reassignCleaner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assign or Change Supervisor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cleaner: <span className="font-semibold text-slate-800 dark:text-slate-200">{reassignCleaner.fullName}</span>
                </p>
              </div>
              <button
                onClick={() => setReassignCleaner(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reassignMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  reassignMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {reassignMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{reassignMsg.text}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Active Supervisor
                </label>
                <select
                  value={newSupervisorId}
                  onChange={(e) => setNewSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="">-- No Supervisor / Unassign --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignCleaner(null)}
                  className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingSupervisor}
                  onClick={handleSaveReassign}
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {isUpdatingSupervisor ? 'Saving...' : 'Save Supervisor Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3.5: UNIFIED CLEANER ASSIGNMENT (SUPERVISOR & LOCALITIES)       */}
      {/* --------------------------------------------------------------------- */}
      {assignModalCleaner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Assign Supervisor & Service Localities
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cleaner: <span className="font-semibold text-slate-800 dark:text-slate-200">{assignModalCleaner.fullName}</span> ({assignModalCleaner.email})
                </p>
              </div>
              <button
                onClick={() => setAssignModalCleaner(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignModalMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  assignModalMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {assignModalMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{assignModalMsg.text}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Designated Operations Supervisor
                </label>
                <select
                  value={assignModalSupervisorId}
                  onChange={(e) => setAssignModalSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="">-- No Supervisor / Unassigned --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  This supervisor oversees task dispatch, field verification, and operational sign-off for this cleaner.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    2. Authorized Service Coverage Localities ({assignModalLocalityIds.length} selected)
                  </label>
                  <span className="text-[10px] text-slate-400">At least 1 required</span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  {localities.map((loc) => (
                    <label key={loc.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400">
                      <input
                        type="checkbox"
                        checked={assignModalLocalityIds.includes(loc.id)}
                        onChange={() => {
                          setAssignModalLocalityIds((prev) =>
                            prev.includes(loc.id)
                              ? prev.filter((id) => id !== loc.id)
                              : [...prev, loc.id]
                          );
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="truncate">{loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalCleaner(null)}
                  className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingUnifiedAssignment || assignModalLocalityIds.length === 0}
                  onClick={handleSaveUnifiedAssignment}
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {isSavingUnifiedAssignment ? 'Saving...' : 'Save Cleaner Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 4: EDIT SERVICE AREAS                                          */}
      {/* --------------------------------------------------------------------- */}
      {editAreasCleaner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Update Service Localities
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cleaner: <span className="font-semibold text-slate-800 dark:text-slate-200">{editAreasCleaner.fullName}</span>
                </p>
              </div>
              <button
                onClick={() => setEditAreasCleaner(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editAreasMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  editAreasMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {editAreasMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{editAreasMsg.text}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Authorized Localities ({editLocalityIds.length} selected)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                {localities.map((loc) => (
                  <label key={loc.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={editLocalityIds.includes(loc.id)}
                      onChange={() => {
                        setEditLocalityIds((prev) =>
                          prev.includes(loc.id)
                            ? prev.filter((id) => id !== loc.id)
                            : [...prev, loc.id]
                        );
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="truncate">{loc.name}</span>
                  </label>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditAreasCleaner(null)}
                  className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingAreas}
                  onClick={handleSaveServiceAreas}
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {isUpdatingAreas ? 'Saving...' : 'Save Coverage Zones'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 5: RESET CLEANER PASSWORD                                      */}
      {/* --------------------------------------------------------------------- */}
      {resetPwCleaner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Set Temporary Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Reset password for cleaner: <span className="font-semibold text-slate-800 dark:text-slate-200">{resetPwCleaner.fullName}</span> ({resetPwCleaner.email})
                </p>
              </div>
              <button
                onClick={() => setResetPwCleaner(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetPwMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  resetPwMsg.error
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {resetPwMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{resetPwMsg.text}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Initial / Temporary Password *
                </label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    minLength={8}
                    value={newCleanerPw}
                    onChange={(e) => setNewCleanerPw(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono text-xs"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPw(!showResetPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 cursor-pointer"
                  >
                    {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Directly sets the cleaner credential via Supabase Auth admin API. Passwords are never stored in plaintext.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPwCleaner(null)}
                  className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPw}
                  onClick={handleSaveResetPassword}
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {isResettingPw ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
