/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Complaint, Locality, CleanerServiceArea } from '../types/index.ts';
import { MAX_PHOTO_SIZE_BYTES, isInitialComplaintPhoto } from '../utils/rules.ts';
import { portalStore } from '../services/store.ts';
import { StatusBadge, UrgencyBadge } from './StatusBadge.tsx';
import { ComplaintTimeline } from './ComplaintTimeline.tsx';
import { SignedPhoto } from './SignedPhoto.tsx';
import {
  HardHat,
  MapPin,
  ExternalLink,
  Navigation,
  PlayCircle,
  Camera,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  X,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface CleanerViewProps {
  currentUser: UserProfile;
  complaints: Complaint[];
  localities: Locality[];
  serviceAreas: CleanerServiceArea[];
}

export const CleanerView: React.FC<CleanerViewProps> = ({
  currentUser,
  complaints,
  localities,
  serviceAreas,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'areas'>('tasks');
  const [selectedTask, setSelectedTask] = useState<Complaint | null>(null);

  // Completion Evidence Form
  const [completionPhotoPreview, setCompletionPhotoPreview] = useState<string | null>(null);
  const [completionFileMeta, setCompletionFileMeta] = useState<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
    rawFile?: File;
  } | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Start Pickup Work Loading & Error States
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPendingApproval = currentUser.accountStatus === 'pending';
  const isSuspended = currentUser.accountStatus === 'suspended';

  // Strict Cleaner Filter: Cleaner can access ONLY complaints assigned to them!
  const myAssignedTasks = complaints.filter((c) => c.assignedCleanerId === currentUser.id);

  // Service areas belonging to this cleaner
  const myServiceAreas = serviceAreas.filter((sa) => sa.cleanerId === currentUser.id);
  const approvedAreas = myServiceAreas.filter((sa) => sa.isApproved);
  const pendingAreas = myServiceAreas.filter((sa) => !sa.isApproved);

  const handleStartWork = async (complaintId: string) => {
    setStartingTaskId(complaintId);
    setActionError(null);
    try {
      const res = await portalStore.startComplaintProgress(complaintId);
      if (res.success) {
        // Refresh selectedTask if open in modal so view seamlessly advances to completion form
        const updated = portalStore.getState().complaints.find((c) => c.id === complaintId);
        if (updated && selectedTask?.id === complaintId) {
          setSelectedTask(updated);
        }
      } else {
        setActionError(res.error || 'Failed to start pickup work. Please try again.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unexpected error while starting pickup work.');
    } finally {
      setStartingTaskId(null);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCompletionError(null);
    setCompletionPhotoPreview(null);
    setCompletionFileMeta(null);

    if (!file) return;

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(file.type.toLowerCase())) {
      setCompletionError('Invalid photo format. Only JPG, JPEG, and PNG are accepted.');
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setCompletionError(`Photo is too large (${mb} MB). Maximum allowed size is 3 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCompletionPhotoPreview(result);
      setCompletionFileMeta({
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl: result,
        rawFile: file,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !completionFileMeta) {
      setCompletionError('A mandatory after-cleaning photograph is required before submitting completion.');
      return;
    }

    setIsSubmittingCompletion(true);
    setCompletionError(null);

    const res = await portalStore.submitCleanerCompletion(
      selectedTask.id,
      completionFileMeta,
      completionNotes
    );

    setIsSubmittingCompletion(false);

    if (res.success) {
      setCompletionPhotoPreview(null);
      setCompletionFileMeta(null);
      setCompletionNotes('');
      setSelectedTask(null);
    } else {
      setCompletionError(res.error || 'Failed to submit completion.');
    }
  };

  const resolveLocName = (sa: CleanerServiceArea): string => {
    if (sa.localityName && sa.localityName !== 'Locality') {
      return sa.localityName;
    }
    const match = localities.find((l) => l.id === sa.localityId);
    return match ? match.name : sa.localityName || 'Locality';
  };

  // If cleaner account is pending review, show clear application status view
  if (isPendingApproval || isSuspended) {
    return (
      <div className="space-y-6">
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-sm ${
            isPendingApproval
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div
              className={`p-3.5 rounded-2xl shrink-0 ${
                isPendingApproval
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">
                  {isPendingApproval
                    ? 'Cleaner Application Under Supervisor Review'
                    : 'Cleaner Account Not Active'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isPendingApproval
                      ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                      : 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  {currentUser.accountStatus}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {isPendingApproval
                  ? 'Your cleaner profile and requested preferred service localities have been registered. Operational assignments and cleaning actions remain locked until an authorized municipal supervisor reviews and approves your application.'
                  : 'Your account is currently suspended or inactive. Please contact your municipal operations supervisor.'}
              </p>

              <div className="pt-3 border-t border-amber-200/60 dark:border-amber-800/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Requested Service Localities ({myServiceAreas.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {myServiceAreas.map((sa) => (
                    <span
                      key={sa.localityId}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      {resolveLocName(sa)}
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                        (Pending)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cleaner Dashboard Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
            Total Assigned
          </span>
          <p className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {myAssignedTasks.length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Pickup requests</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">
            Pending Start
          </span>
          <p className="text-2xl font-black font-mono tabular-nums text-blue-700 dark:text-blue-300">
            {myAssignedTasks.filter((t) => t.status === 'assigned').length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Ready to dispatch</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400">
            In Progress
          </span>
          <p className="text-2xl font-black font-mono tabular-nums text-purple-700 dark:text-purple-300">
            {myAssignedTasks.filter((t) => t.status === 'in_progress').length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Active on-site</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
            Completed
          </span>
          <p className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {myAssignedTasks.filter((t) => t.status === 'completed' || t.status === 'awaiting_verification').length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Resolved / Review</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
            Supervisor
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {currentUser.supervisorName || 'Unassigned'}
            </p>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Assigned Lead</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
            Wards Authorized
          </span>
          <p className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {approvedAreas.length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
            {approvedAreas.length > 0
              ? approvedAreas.map(resolveLocName).slice(0, 2).join(', ') + (approvedAreas.length > 2 ? '...' : '')
              : 'None'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl px-4 pt-2 shadow-2xs">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'tasks'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardHat className="w-4 h-4" />
          <span>My Assigned Pickup Tasks ({myAssignedTasks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('areas')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'areas'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Authorized Service Localities ({approvedAreas.length})</span>
        </button>
      </div>

      {/* TAB 1: ASSIGNED TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Action error banner */}
          {actionError && !selectedTask && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{actionError}</span>
              </div>
              <button
                onClick={() => setActionError(null)}
                className="p-1 rounded-lg text-rose-600 hover:text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {myAssignedTasks.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <HardHat className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No Pickup Tasks Assigned
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Cleaners can only view and execute tasks directly assigned to them by municipal supervisors in their approved service localities. Check back once a task is dispatched to you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAssignedTasks.map((task) => {
                const initialPhoto = task.photos.find((p) => isInitialComplaintPhoto(p.photoType));

                return (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {initialPhoto && (
                        <div className="h-44 bg-slate-950 relative overflow-hidden">
                          <SignedPhoto
                            src={initialPhoto.url}
                            storagePath={initialPhoto.storagePath}
                            alt="Initial waste report photo"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2.5 right-2.5">
                            <UrgencyBadge urgency={task.urgency} />
                          </div>
                          <div className="absolute top-2.5 left-2.5">
                            <StatusBadge status={task.status} size="sm" />
                          </div>
                        </div>
                      )}

                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {task.trackingCode}
                          </span>
                          {!initialPhoto && <StatusBadge status={task.status} size="sm" />}
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Location
                          </span>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-1">
                            {task.address}
                          </p>
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                            {task.localityName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">Waste Type:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                            {task.wasteType.replace('_', ' ')}
                          </span>
                        </div>

                        {task.supervisorNotes && (
                          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
                            <span className="font-bold">Supervisor Note:</span> {task.supervisorNotes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Navigate</span>
                        </a>

                        <button
                          onClick={() => setSelectedTask(task)}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Work Details
                        </button>
                      </div>

                      {task.status === 'assigned' && (
                        <button
                          onClick={() => handleStartWork(task.id)}
                          disabled={startingTaskId === task.id}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {startingTaskId === task.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Starting Work...</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4" />
                              <span>Start Pickup Work</span>
                            </>
                          )}
                        </button>
                      )}

                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Upload Completion Evidence</span>
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

      {/* TAB 2: SERVICE LOCALITIES */}
      {activeTab === 'areas' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Your Authorized Service Localities
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supervisors dispatch cleaning tasks based on your approved localities.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {myServiceAreas.map((sa) => (
              <div
                key={sa.localityId}
                className={`p-4 rounded-2xl border flex items-center justify-between shadow-2xs ${
                  sa.isApproved
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-xs">{resolveLocName(sa)}</span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    sa.isApproved
                      ? 'bg-emerald-200 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {sa.isApproved ? 'Approved' : 'Pending Review'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TASK MODAL / COMPLETION SUBMISSION */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                    {selectedTask.trackingCode}
                  </span>
                  <StatusBadge status={selectedTask.status} size="sm" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedTask.address} • {selectedTask.localityName}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setActionError(null);
                  setCompletionError(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Details Snapshot */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs shadow-2xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Waste Type:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                  {selectedTask.wasteType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">GPS Coordinates:</span>
                <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                  {selectedTask.latitude.toFixed(6)}, {selectedTask.longitude.toFixed(6)}
                </span>
              </div>
              {(selectedTask.supervisorNote || selectedTask.supervisorNotes) && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block">
                    Supervisor Instructions:
                  </span>
                  <p className="text-amber-800 dark:text-amber-200 mt-0.5 leading-relaxed">
                    {selectedTask.supervisorNote || selectedTask.supervisorNotes}
                  </p>
                </div>
              )}
            </div>

            {/* If In Progress: Completion Proof Upload Form */}
            {selectedTask.status === 'in_progress' ? (
              <form onSubmit={handleSubmitCompletion} className="space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800 dark:text-slate-200">
                    Mandatory After-Cleaning Photographic Evidence *
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Upload clear photo proof that the waste has been completely cleared. Max 3 MB (JPG/PNG).
                  </p>

                  <div>
                    {completionPhotoPreview ? (
                      <div className="relative rounded-2xl overflow-hidden border border-emerald-300 dark:border-emerald-700 shadow-sm">
                        <img
                          src={completionPhotoPreview}
                          alt="Completion proof"
                          className="w-full h-48 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCompletionPhotoPreview(null);
                            setCompletionFileMeta(null);
                          }}
                          className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 cursor-pointer shadow-md"
                          title="Remove photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/20 transition-all">
                        <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-1.5" />
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          Click to upload completion photo
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          JPG, JPEG, PNG up to 3 MB
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Completion Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="e.g. Cleared 2 bags of debris, sidewalk sanitized."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
                  />
                </div>

                {completionError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{completionError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingCompletion || !completionFileMeta}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmittingCompletion
                      ? 'Submitting Proof...'
                      : 'Submit Completion for Supervisor Approval'}
                  </span>
                </button>
              </form>
            ) : selectedTask.status === 'assigned' ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  This complaint has been dispatched to you. Once you arrive at the waste location, click below to mark work in progress.
                </p>
                {actionError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{actionError}</span>
                  </div>
                )}
                <button
                  onClick={() => handleStartWork(selectedTask.id)}
                  disabled={startingTaskId === selectedTask.id}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {startingTaskId === selectedTask.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Starting Pickup Work...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      <span>Start Pickup Work Now</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedTask.status === 'awaiting_verification'
                    ? 'Completion evidence has been submitted and is currently awaiting supervisor review and sign-off.'
                    : 'This task has been resolved and closed.'}
                </p>
                <ComplaintTimeline
                  currentStatus={selectedTask.status}
                  history={selectedTask.history}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
