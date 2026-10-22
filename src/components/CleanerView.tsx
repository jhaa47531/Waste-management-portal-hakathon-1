/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Complaint, Locality, CleanerServiceArea } from '../types/index.ts';
import { MAX_PHOTO_SIZE_BYTES } from '../utils/rules.ts';
import { portalStore } from '../services/store.ts';
import { StatusBadge, UrgencyBadge } from './StatusBadge.tsx';
import { ComplaintTimeline } from './ComplaintTimeline.tsx';
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

  const isPendingApproval = currentUser.accountStatus === 'pending';
  const isSuspended = currentUser.accountStatus === 'suspended';

  // Strict Cleaner Filter: Cleaner can access ONLY complaints assigned to them!
  const myAssignedTasks = complaints.filter((c) => c.assignedCleanerId === currentUser.id);

  // Service areas belonging to this cleaner
  const myServiceAreas = serviceAreas.filter((sa) => sa.cleanerId === currentUser.id);
  const approvedAreas = myServiceAreas.filter((sa) => sa.isApproved);
  const pendingAreas = myServiceAreas.filter((sa) => !sa.isApproved);

  const handleStartWork = async (complaintId: string) => {
    const res = await portalStore.startComplaintProgress(complaintId);
    if (res.success && selectedTask) {
      const updated = portalStore.getState().complaints.find((c) => c.id === complaintId);
      if (updated) setSelectedTask(updated);
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

  // If cleaner account is pending review, show clear application status view
  if (isPendingApproval || isSuspended) {
    return (
      <div className="space-y-6">
        <div
          className={`p-6 rounded-2xl border ${
            isPendingApproval
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-2xl ${
                isPendingApproval ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">
                  {isPendingApproval
                    ? 'Cleaner Application Under Supervisor Review'
                    : 'Cleaner Account Not Active'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isPendingApproval
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-rose-200 text-rose-900'
                  }`}
                >
                  {currentUser.accountStatus}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {isPendingApproval
                  ? 'Your cleaner profile and requested preferred service localities have been registered. Operational assignments and cleaning actions remain locked until an authorized municipal supervisor reviews and approves your application.'
                  : 'Your account is currently suspended or inactive. Please contact your municipal operations supervisor.'}
              </p>

              <div className="pt-3 border-t border-amber-200/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Requested Service Localities ({myServiceAreas.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {myServiceAreas.map((sa) => (
                    <span
                      key={sa.localityId}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-amber-200 text-slate-800 flex items-center gap-1.5"
                    >
                      <MapPin className="w-3 h-3 text-amber-600" />
                      {sa.localityName}
                      <span className="text-[10px] font-bold text-amber-700 uppercase">(Pending)</span>
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
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Assigned</span>
          <p className="text-2xl font-black text-slate-900">{myAssignedTasks.length}</p>
          <span className="text-[11px] text-slate-500">Pickup requests</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600">Pending Start</span>
          <p className="text-2xl font-black text-blue-800">
            {myAssignedTasks.filter((t) => t.status === 'assigned').length}
          </p>
          <span className="text-[11px] text-slate-500">Ready to dispatch</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600">In Progress</span>
          <p className="text-2xl font-black text-purple-800">
            {myAssignedTasks.filter((t) => t.status === 'in_progress').length}
          </p>
          <span className="text-[11px] text-slate-500">Active on-site</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Completed</span>
          <p className="text-2xl font-black text-emerald-800">
            {myAssignedTasks.filter((t) => t.status === 'completed' || t.status === 'awaiting_verification').length}
          </p>
          <span className="text-[11px] text-slate-500">Resolved / Review</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Assigned Supervisor</span>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs font-bold text-slate-900 truncate">
              {currentUser.supervisorName || 'Not Assigned'}
            </p>
          </div>
          <span className="text-[11px] text-slate-500">Field Supervisor</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Authorized Localities</span>
          <p className="text-2xl font-black text-emerald-700">{approvedAreas.length}</p>
          <span className="text-[11px] text-slate-500 truncate block">
            {approvedAreas.length > 0
              ? approvedAreas.map((a) => a.localityName).slice(0, 2).join(', ') + (approvedAreas.length > 2 ? '...' : '')
              : 'None'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2 shadow-xs">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'tasks'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HardHat className="w-4 h-4 text-emerald-600" />
          My Assigned Pickup Tasks ({myAssignedTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('areas')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'areas'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4 text-slate-400" />
          Authorized Service Localities ({approvedAreas.length})
        </button>
      </div>

      {/* TAB 1: ASSIGNED TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {myAssignedTasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <HardHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Pickup Tasks Assigned</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Cleaners can only view and execute tasks directly assigned to them by municipal supervisors in their approved service localities. Check back once a task is dispatched to you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAssignedTasks.map((task) => {
                const initialPhoto = task.photos.find((p) => p.photoType === 'resident_initial');
                const completionPhoto = task.photos.find((p) => p.photoType === 'cleaner_completion');

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {initialPhoto && (
                        <div className="h-44 bg-slate-950 relative overflow-hidden">
                          <img
                            src={initialPhoto.url}
                            alt="Initial waste"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <UrgencyBadge urgency={task.urgency} />
                          </div>
                        </div>
                      )}

                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {task.trackingCode}
                          </span>
                          <StatusBadge status={task.status} size="sm" />
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Location
                          </span>
                          <p className="text-xs font-semibold text-slate-800">{task.address}</p>
                          <span className="text-xs text-emerald-800 font-medium flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {task.localityName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500">Waste Type:</span>
                          <span className="font-semibold text-slate-800 capitalize">
                            {task.wasteType.replace('_', ' ')}
                          </span>
                        </div>

                        {task.supervisorNotes && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
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
                          className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-600" /> Navigate GPS
                        </a>

                        <button
                          onClick={() => setSelectedTask(task)}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Work Details
                        </button>
                      </div>

                      {task.status === 'assigned' && (
                        <button
                          onClick={() => handleStartWork(task.id)}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <PlayCircle className="w-4 h-4" /> Start Pickup Work
                        </button>
                      )}

                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Camera className="w-4 h-4" /> Upload Completion Evidence
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Your Authorized Service Localities</h3>
            <p className="text-xs text-slate-500 mt-1">
              Supervisors dispatch cleaning tasks based on your approved localities.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {myServiceAreas.map((sa) => (
              <div
                key={sa.localityId}
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  sa.isApproved
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs">{sa.localityName}</span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    sa.isApproved
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-slate-200 text-slate-600'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 shadow-xl space-y-5 my-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-base">
                    {selectedTask.trackingCode}
                  </span>
                  <StatusBadge status={selectedTask.status} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedTask.address} • {selectedTask.localityName}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Waste Type:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {selectedTask.wasteType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GPS Coordinates:</span>
                <span className="font-mono text-slate-800">
                  {selectedTask.latitude.toFixed(6)}, {selectedTask.longitude.toFixed(6)}
                </span>
              </div>
              {selectedTask.supervisorNotes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="font-bold text-amber-900 block">Supervisor Instructions:</span>
                  <p className="text-amber-800 mt-0.5">{selectedTask.supervisorNotes}</p>
                </div>
              )}
            </div>

            {/* If In Progress: Completion Proof Upload Form */}
            {selectedTask.status === 'in_progress' ? (
              <form onSubmit={handleSubmitCompletion} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">
                    Mandatory After-Cleaning Photographic Evidence *
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Upload clear photo proof that the waste has been completely cleared. Max 3 MB (JPG/PNG).
                  </p>

                  <div className="mt-2">
                    {completionPhotoPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-emerald-300">
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
                          className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-white hover:bg-slate-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
                        <Camera className="w-8 h-8 text-slate-400 mb-1" />
                        <span className="font-bold text-slate-700">Click to upload completion photo</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, JPEG, PNG up to 3 MB</span>
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
                  <label className="block font-bold text-slate-800 mb-1">
                    Completion Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="e.g. Cleared 2 bags of debris, sidewalk sanitized."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
                  />
                </div>

                {completionError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{completionError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingCompletion || !completionFileMeta}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmittingCompletion
                    ? 'Submitting Proof...'
                    : 'Submit Completion for Supervisor Approval'}
                </button>
              </form>
            ) : selectedTask.status === 'assigned' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  This complaint has been assigned to you. Once you arrive at the location, click Start Pickup Work to begin.
                </p>
                <button
                  onClick={() => handleStartWork(selectedTask.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" /> Start Pickup Work Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
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
