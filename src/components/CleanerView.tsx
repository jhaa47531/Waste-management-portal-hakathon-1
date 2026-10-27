/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Complaint, Locality, CleanerServiceArea } from '../types/index.ts';
import { MAX_PHOTO_SIZE_BYTES, isInitialComplaintPhoto } from '../utils/rules.ts';
import { portalStore } from '../services/store.ts';
import { compressImageFile } from '../utils/imageCompressor.ts';
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
  AlertTriangle,
  RefreshCw,
  Trash2,
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
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKb: number;
    compressedKb: number;
    savedPercent: number;
  } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Start Pickup Work Loading & Error States
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPendingApproval = currentUser.accountStatus === 'pending';
  const isSuspended = currentUser.accountStatus === 'suspended';

  // Strict Cleaner Isolation: Cleaner can access ONLY complaints assigned to them
  const myAssignedTasks = complaints.filter((c) => c.assignedCleanerId === currentUser.id);

  // Service areas belonging to this cleaner
  const myServiceAreas = serviceAreas.filter((sa) => sa.cleanerId === currentUser.id);
  const approvedAreas = myServiceAreas.filter((sa) => sa.isApproved);
  const pendingAreas = myServiceAreas.filter((sa) => !sa.isApproved);

  // Task metrics
  const pendingPickupTasks = myAssignedTasks.filter((c) => c.status === 'assigned');
  const inProgressTasks = myAssignedTasks.filter((c) => c.status === 'in_progress');
  const awaitingVerificationTasks = myAssignedTasks.filter((c) => c.status === 'awaiting_verification');
  const completedTasks = myAssignedTasks.filter((c) => c.status === 'completed');

  const handleStartWork = async (complaintId: string) => {
    setStartingTaskId(complaintId);
    setActionError(null);
    try {
      const res = await portalStore.startComplaintProgress(complaintId);
      if (res.success) {
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCompletionError(null);
    setCompressionInfo(null);

    if (!file) return;

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(file.type.toLowerCase())) {
      setCompletionError('Invalid photo format. Only JPG, JPEG, and PNG are accepted.');
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES * 3) {
      setCompletionError('Photo file is too large. Please choose a lighter file.');
      return;
    }

    setIsCompressing(true);
    try {
      const compressed = await compressImageFile(file, 1600, 0.84);
      setCompletionPhotoPreview(compressed.dataUrl);
      setCompletionFileMeta({
        name: compressed.file.name,
        mimeType: compressed.file.type,
        sizeBytes: compressed.compressedSize,
        dataUrl: compressed.dataUrl,
        rawFile: compressed.file,
      });
      setCompressionInfo({
        originalKb: Math.round(compressed.originalSize / 1024),
        compressedKb: Math.round(compressed.compressedSize / 1024),
        savedPercent: compressed.reductionPercentage,
      });
    } catch (err: any) {
      setCompletionError('Could not process photo: ' + (err?.message || 'error'));
    } finally {
      setIsCompressing(false);
    }
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
      setCompressionInfo(null);
      setCompletionNotes('');
      setSelectedTask(null);
    } else {
      setCompletionError(res.error || 'Failed to submit proof. Please retry.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Status Warnings */}
      {isPendingApproval && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-mono font-bold uppercase">ACCOUNT PENDING SUPERVISOR VERIFICATION</h4>
            <p className="leading-relaxed">
              Your cleaner application is currently being reviewed by municipal supervisors. You will receive assignments once your service sectors are authorized.
            </p>
          </div>
        </div>
      )}

      {isSuspended && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-mono font-bold uppercase">ACCOUNT SUSPENDED</h4>
            <p className="leading-relaxed">
              Your cleaner privileges are currently suspended. Please contact your supervisor for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Cleaner Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
            ASSIGNED TO YOU
          </span>
          <p className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {pendingPickupTasks.length}
          </p>
        </div>

        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
            WORK IN PROGRESS
          </span>
          <p className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
            {inProgressTasks.length}
          </p>
        </div>

        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
            IN PHOTO AUDIT
          </span>
          <p className="text-2xl font-mono font-bold text-purple-600 dark:text-purple-400 mt-1">
            {awaitingVerificationTasks.length}
          </p>
        </div>

        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
            RESOLVED & AUDITED
          </span>
          <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {completedTasks.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-[#12161c] rounded-2xl p-1.5 shadow-xs gap-1.5">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-2.5 px-3 sm:px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
            activeTab === 'tasks'
              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <HardHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="truncate">FIELD TASK ROSTER ({myAssignedTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('areas')}
          className={`flex-1 py-2.5 px-3 sm:px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
            activeTab === 'areas'
              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="truncate">APPROVED LOCALITIES ({approvedAreas.length})</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: BIG-BUTTON TASK LIST
         ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {myAssignedTasks.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-[#12161c] rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
              <HardHat className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
              <h4 className="font-mono-display text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                NO ACTIVE ASSIGNMENTS
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                You have no active pickup tasks dispatched to your queue right now. You will be notified when your supervisor dispatches a complaint.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myAssignedTasks.map((task) => {
                const initialPhoto = task.photos.find((p) => isInitialComplaintPhoto(p.photoType));
                const isAssigned = task.status === 'assigned';
                const isInProgress = task.status === 'in_progress';
                const isAuditing = task.status === 'awaiting_verification';
                const isResolved = task.status === 'completed';

                return (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#12161c] rounded-3xl border border-slate-200 dark:border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-xs flex flex-col justify-between hover:border-amber-400 dark:hover:border-white/20 transition-all"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs break-all">
                              {task.trackingCode}
                            </span>
                            <StatusBadge status={task.status} size="sm" />
                          </div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white font-sans break-words line-clamp-1">
                            {task.address}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{task.localityName}</p>
                        </div>
                        <div className="shrink-0">
                          <UrgencyBadge urgency={task.urgency} />
                        </div>
                      </div>

                      {/* Photo Thumbnail & Details */}
                      <div className="grid grid-cols-3 gap-2.5 my-3">
                        {initialPhoto && (
                          <div className="col-span-1 h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/10">
                            <img
                              src={initialPhoto.url}
                              alt="Waste report"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className={`${initialPhoto ? 'col-span-2' : 'col-span-3'} p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/5 space-y-1 text-xs font-mono`}>
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>TYPE:</span>
                            <span className="text-slate-900 dark:text-white capitalize truncate">{task.wasteType.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>RESIDENT:</span>
                            <span className="text-slate-900 dark:text-white truncate">{task.residentName}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>PHONE:</span>
                            <a href={`tel:${task.residentPhone}`} className="text-cyan-700 dark:text-cyan-400 hover:underline truncate">
                              {task.residentPhone}
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Navigation Link */}
                      <a
                        href={`https://www.google.com/maps?q=${task.latitude},${task.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/5 hover:border-cyan-500/40 text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 text-xs font-mono flex items-center justify-between transition-colors min-h-[40px]"
                      >
                        <span className="flex items-center gap-1.5 font-bold">
                          <Navigation className="w-3.5 h-3.5" />
                          OPEN GPS NAVIGATION
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* BIG BUTTON ACTION */}
                    <div className="pt-2 border-t border-slate-200 dark:border-white/5 space-y-2">
                      {isAssigned && (
                        <button
                          type="button"
                          onClick={() => handleStartWork(task.id)}
                          disabled={startingTaskId === task.id}
                          className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
                        >
                          {startingTaskId === task.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>STARTING WORK...</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4" />
                              <span>START PICKUP WORK (STAGE 04)</span>
                            </>
                          )}
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTask(task);
                            setCompletionPhotoPreview(null);
                            setCompletionFileMeta(null);
                            setCompressionInfo(null);
                            setCompletionError(null);
                          }}
                          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
                        >
                          <Camera className="w-4 h-4" />
                          <span>UPLOAD PROOF & MARK RESOLVED</span>
                        </button>
                      )}

                      {isAuditing && (
                        <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-500/30 text-purple-900 dark:text-purple-300 text-center font-mono text-xs font-bold flex items-center justify-center gap-2">
                          <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span>PROOF SUBMITTED • AWAITING SUPERVISOR AUDIT</span>
                        </div>
                      )}

                      {isResolved && (
                        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-center font-mono text-xs font-bold flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>RESOLVED & AUDITED BY SUPERVISOR</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedTask(task)}
                        className="w-full py-2.5 rounded-xl text-xs font-mono text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer min-h-[40px]"
                      >
                        VIEW FULL DETAILS & TIMELINE
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
          TAB 2: APPROVED LOCALITIES
         ========================================================================= */}
      {activeTab === 'areas' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#12161c] rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-sm">
            <h3 className="font-mono-display uppercase tracking-wider text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>YOUR AUTHORIZED SERVICE LOCALITIES</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Cleaners are dispatched only to complaints within their approved municipal localities. Service areas are authorized by field supervisors or administrators.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {approvedAreas.map((sa) => (
                <div
                  key={sa.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b0d10] border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">{sa.localityName}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/20 shrink-0">
                    APPROVED
                  </span>
                </div>
              ))}
            </div>

            {pendingAreas.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-2">
                <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block">
                  PENDING AUTHORIZATION ({pendingAreas.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {pendingAreas.map((sa) => (
                    <div
                      key={sa.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b0d10] border border-amber-300 dark:border-amber-500/20 flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400"
                    >
                      <span className="truncate">{sa.localityName}</span>
                      <span className="text-amber-700 dark:text-amber-400 text-[10px] shrink-0">AWAITING APPROVAL</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TASK DETAIL & RESOLUTION MODAL (With Fully Functional Close Button)
         ========================================================================= */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1217] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl space-y-5 my-6 text-slate-900 dark:text-slate-100">
            {/* Top Bar with Functional Close Button */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm break-all">
                    {selectedTask.trackingCode}
                  </span>
                  <StatusBadge status={selectedTask.status} size="sm" />
                  <UrgencyBadge urgency={selectedTask.urgency} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans break-words">{selectedTask.address}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {selectedTask.localityName} • SUBMITTED BY {selectedTask.residentName}
                </p>
              </div>

              {/* Accessible Close Button (Top-Right) */}
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                aria-label="Close task details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resident Before Photo */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block">
                01. BEFORE: INITIAL WASTE EVIDENCE PHOTO
              </span>
              {selectedTask.photos.find((p) => isInitialComplaintPhoto(p.photoType)) ? (
                <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/10">
                  <SignedPhoto
                    storagePath={selectedTask.photos.find((p) => isInitialComplaintPhoto(p.photoType))!.storagePath}
                    src={selectedTask.photos.find((p) => isInitialComplaintPhoto(p.photoType))!.url}
                    alt="Initial report photo"
                    className="w-full h-52 object-cover"
                  />
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/10 text-center text-xs font-mono text-slate-500">
                  NO INITIAL PHOTO RECORDED
                </div>
              )}
            </div>

            {/* If In Progress, Show After Photo Upload Form */}
            {selectedTask.status === 'in_progress' && (
              <form onSubmit={handleSubmitCompletion} className="p-4 rounded-2xl bg-slate-50 dark:bg-[#12161c] border border-emerald-300 dark:border-emerald-500/30 space-y-4">
                <div className="space-y-1">
                  <h4 className="font-mono-display text-xs uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>MANDATORY AFTER-CLEANING PHOTO EVIDENCE</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">
                    Take or upload a photo showing the clean, cleared street area. Client compression optimizes file size under 3 MB.
                  </p>
                </div>

                {!completionPhotoPreview ? (
                  <label className="border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-white dark:bg-[#0b0d10] group">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
                      {isCompressing ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white uppercase text-center">
                      {isCompressing ? 'COMPRESSING ON CANVAS...' : 'CLICK TO CAPTURE OR CHOOSE PHOTO'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 mt-1">
                      JPG, JPEG, PNG (MAX 3 MB)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      disabled={isCompressing}
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-white/10 max-w-sm mx-auto">
                      <img
                        src={completionPhotoPreview}
                        alt="Completion preview"
                        className="w-full h-44 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCompletionPhotoPreview(null);
                          setCompletionFileMeta(null);
                          setCompressionInfo(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-950 text-white hover:text-rose-400 border border-white/20 transition-colors cursor-pointer"
                        title="Remove photo"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {compressionInfo && (
                        <div className="p-2 bg-slate-900/95 border-t border-white/10 flex justify-between text-[10px] font-mono text-emerald-400">
                          <span>OPTIMIZED EVIDENCE</span>
                          <span>{compressionInfo.compressedKb} KB (-{compressionInfo.savedPercent}%)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {completionError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>{completionError}</span>
                  </p>
                )}

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-600 dark:text-slate-400 mb-1 font-bold">
                    CLEANER COMPLETION NOTES (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="e.g. Waste cleared, pavement swept and disinfected..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingCompletion || !completionFileMeta || isCompressing}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
                >
                  {isSubmittingCompletion ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>UPLOADING & SUBMITTING PROOF...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>SUBMIT PROOF FOR SUPERVISOR AUDIT</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Timeline & Audit History */}
            <ComplaintTimeline
              currentStatus={selectedTask.status}
              history={selectedTask.history}
            />

            {/* Bottom Actions with Fully Functional Close Button */}
            <div className="pt-2 text-right border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-white transition-colors cursor-pointer min-h-[44px]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
