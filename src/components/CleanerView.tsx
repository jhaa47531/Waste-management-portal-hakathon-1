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
  Plus,
  ShieldCheck,
  X,
  FileCheck,
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

  // Proposed locality state
  const [selectedLocalityToPropose, setSelectedLocalityToPropose] = useState(localities[0]?.id || '');
  const [proposeMsg, setProposeMsg] = useState<string | null>(null);

  // Completion Evidence Form
  const [completionPhotoPreview, setCompletionPhotoPreview] = useState<string | null>(null);
  const [completionFileMeta, setCompletionFileMeta] = useState<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  } | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  const isPendingApproval = currentUser.accountStatus === 'pending';

  // Strict Cleaner Filter: Cleaner can access ONLY complaints assigned to them!
  const myAssignedTasks = complaints.filter((c) => c.assignedCleanerId === currentUser.id);

  // Service areas belonging to this cleaner
  const myServiceAreas = serviceAreas.filter((sa) => sa.cleanerId === currentUser.id);

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
      setCompletionError('Invalid photo format. Only JPG, JPEG, and PNG are allowed.');
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
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !completionFileMeta) {
      setCompletionError('A mandatory after-cleaning photo is required before submitting completion.');
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

  const handleProposeArea = async () => {
    if (!selectedLocalityToPropose) return;
    const res = await portalStore.proposeServiceArea(currentUser.id, selectedLocalityToPropose);
    if (res.success) {
      setProposeMsg('Locality requested. Staff approval is required before you qualify for assignments in this area.');
      setTimeout(() => setProposeMsg(null), 4000);
    } else {
      setProposeMsg(res.error || 'Could not propose locality.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Status Notice if Pending */}
      {isPendingApproval && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Cleaner Account Application Pending Staff Review</h4>
            <p className="mt-0.5">
              Your cleaner application has been submitted and is awaiting administrator or supervisor review.
              Once approved, you will be dispatched waste cleanup requests in your approved service localities.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'tasks'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardHat className="w-4 h-4" /> My Assigned Pickup Tasks ({myAssignedTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('areas')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'areas'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" /> Service Localities ({myServiceAreas.filter((a) => a.isApproved).length} Approved)
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: ASSIGNED TASKS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {myAssignedTasks.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <HardHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                No Tasks Currently Assigned
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Cleaners can only view and work on tasks assigned directly to them by the municipal supervisor. Check your approved localities in the "Service Localities" tab.
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
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {initialPhoto && (
                        <div className="h-44 bg-slate-950 relative overflow-hidden">
                          <img
                            src={initialPhoto.url}
                            alt="Waste to clean"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2">
                            <StatusBadge status={task.status} size="sm" />
                          </div>
                          <div className="absolute top-2 right-2">
                            <UrgencyBadge urgency={task.urgency} />
                          </div>
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {task.trackingCode}
                          </span>
                          <span className="capitalize font-semibold text-slate-600 dark:text-slate-300">
                            {task.wasteType.replace('_', ' ')}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                          {task.address}
                        </h4>
                        <p className="text-xs text-slate-500">{task.localityName}</p>

                        {task.supervisorNotes && (
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <strong>Supervisor Note:</strong> {task.supervisorNotes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0 space-y-2">
                      {/* Navigation Link to GPS Coordinates */}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600" /> Open Directions (GPS)
                      </a>

                      {/* Cleaner Task Actions */}
                      {task.status === 'assigned' && (
                        <button
                          onClick={() => handleStartWork(task.id)}
                          className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Start Work (Arrived On-Site)
                        </button>
                      )}

                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setCompletionPhotoPreview(null);
                            setCompletionFileMeta(null);
                            setCompletionNotes('');
                            setCompletionError(null);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs animate-pulse"
                        >
                          <Camera className="w-3.5 h-3.5" /> Upload Cleaned Evidence
                        </button>
                      )}

                      {task.status === 'awaiting_verification' && (
                        <div className="p-2 text-center rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Awaiting Supervisor Verification
                        </div>
                      )}

                      {task.status === 'completed' && (
                        <div className="p-2 text-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified Clean & Closed
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedTask(task)}
                        className="w-full text-center text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pt-1"
                      >
                        View Full History & Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: SERVICE LOCALITIES MANAGEMENT */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'areas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Localities List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                My Service Areas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cleaners only qualify for assignments in localities that have been verified and approved by the supervisor or administrator.
              </p>
            </div>

            <div className="space-y-2">
              {myServiceAreas.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No service areas requested yet.</p>
              ) : (
                myServiceAreas.map((area) => (
                  <div
                    key={area.id}
                    className="p-3 rounded-xl border flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {area.localityName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {area.isApproved
                          ? `Approved on ${new Date(area.approvedAt || '').toLocaleDateString()}`
                          : 'Proposed - Pending Staff Review'}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        area.isApproved
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {area.isApproved ? 'Approved' : 'Pending Review'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Request New Service Area */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Propose Additional Locality
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Self-selected localities must not automatically become approved; they require staff verification before assignment.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Municipal Locality
                </label>
                <select
                  value={selectedLocalityToPropose}
                  onChange={(e) => setSelectedLocalityToPropose(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {localities.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleProposeArea}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Submit Locality Proposal
              </button>

              {proposeMsg && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs">
                  {proposeMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TASK DETAIL & COMPLETION EVIDENCE UPLOAD MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                    {selectedTask.trackingCode}
                  </span>
                  <StatusBadge status={selectedTask.status} size="sm" />
                  <UrgencyBadge urgency={selectedTask.urgency} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedTask.address}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedTask.localityName} • GPS: {selectedTask.latitude.toFixed(6)}° N,{' '}
                  {selectedTask.longitude.toFixed(6)}° E
                </p>
              </div>

              <button
                onClick={() => setSelectedTask(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs">
              <span className="text-blue-900 dark:text-blue-200 font-semibold flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-blue-600" /> GPS Navigation Route Available
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTask.latitude},${selectedTask.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center gap-1"
              >
                Navigate to Location <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* If In Progress: Show Mandatory After-Cleaning Photo Upload Form */}
            {selectedTask.status === 'in_progress' && (
              <form
                onSubmit={handleSubmitCompletion}
                className="p-4 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 space-y-4 text-xs"
              >
                <div>
                  <h4 className="text-sm font-bold text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-orange-600" /> Submit After-Cleaning Evidence
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Municipal Regulation: An after-cleaning photo is mandatory before completion can be submitted to the supervisor.
                  </p>
                </div>

                {/* Photo Picker */}
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Upload Cleaned Site Photo (JPG/PNG, Max 3MB) *
                  </label>

                  {!completionPhotoPreview ? (
                    <label className="border-2 border-dashed border-orange-300 dark:border-orange-800 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 hover:border-orange-500">
                      <Camera className="w-8 h-8 text-orange-500 mb-2" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Select after-cleaning photo
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        JPG, PNG up to 3 MB
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-orange-300 dark:border-orange-800 bg-slate-950 max-w-sm">
                      <img
                        src={completionPhotoPreview}
                        alt="Cleaned site preview"
                        className="w-full h-44 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCompletionPhotoPreview(null);
                          setCompletionFileMeta(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full"
                        aria-label="Remove photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Cleaner Completion Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="e.g. Cleared 3 bags of waste; sanitized ground with lime powder."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>

                {completionError && (
                  <p className="text-xs text-rose-600 font-bold">{completionError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingCompletion}
                  className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" /> Submit Completion for Supervisor Approval
                </button>
              </form>
            )}

            {/* Photos & Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Photographic Records
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedTask.photos.map((photo) => (
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
                          ? 'Initial Waste Evidence'
                          : 'After-Cleaning Proof'}
                      </span>
                      <span className="text-slate-400">
                        {new Date(photo.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <ComplaintTimeline
                currentStatus={selectedTask.status}
                history={selectedTask.history}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
