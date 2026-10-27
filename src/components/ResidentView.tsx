/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Complaint, Locality, WasteType } from '../types/index.ts';
import { ALLOWED_WASTE_TYPES, MAX_PHOTO_SIZE_BYTES } from '../utils/rules.ts';
import { portalStore } from '../services/store.ts';
import { compressImageFile } from '../utils/imageCompressor.ts';
import { StatusBadge, UrgencyBadge } from './StatusBadge.tsx';
import { ComplaintTimeline } from './ComplaintTimeline.tsx';
import { SignedPhoto } from './SignedPhoto.tsx';
import {
  MapPin,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ChevronRight,
  X,
  FileText,
  Inbox,
  ArrowRight,
  ArrowLeft,
  Trash2,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface ResidentViewProps {
  currentUser: UserProfile;
  localities: Locality[];
  complaints: Complaint[];
}

export const ResidentView: React.FC<ResidentViewProps> = ({
  currentUser,
  localities,
  complaints,
}) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

  // Wizard Step State: 1 = Photo, 2 = Location, 3 = Details & Review
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber);
  const [address, setAddress] = useState('');
  const [localityId, setLocalityId] = useState(localities[0]?.id || '');
  const [wasteType, setWasteType] = useState<WasteType>('household');
  const [remark, setRemark] = useState('');

  // GPS State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Photo State with Client Compression
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileMeta, setPhotoFileMeta] = useState<{
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
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createdComplaint, setCreatedComplaint] = useState<Complaint | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // History & Tracking Search
  const [searchTracking, setSearchTracking] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Filter complaints: Resident views ONLY their own complaints
  const allMyComplaints = complaints.filter((c) => c.residentId === currentUser.id);

  const residentComplaints = allMyComplaints.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchTracking.trim() !== '') {
      const q = searchTracking.toLowerCase().trim();
      const match =
        c.trackingCode.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.localityName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalSubmitted = allMyComplaints.length;
  const inProgressCount = allMyComplaints.filter(
    (c) => c.status === 'in_progress' || c.status === 'assigned' || c.status === 'awaiting_verification'
  ).length;
  const completedCount = allMyComplaints.filter((c) => c.status === 'completed').length;

  // --------------------------------------------------------------------------
  // Mandatory Geolocation Capture
  // --------------------------------------------------------------------------
  const captureGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your current browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsLoading(false);
        setGpsError(null);
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next.gps;
          return next;
        });
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Failed to retrieve GPS location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            'Location permission denied. Mandatory GPS coordinates are required by municipal policy to prevent false dispatches. Please grant location access in browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'GPS location is temporarily unavailable. Please verify device GPS.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Geolocation request timed out. Please retry.';
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // --------------------------------------------------------------------------
  // Photo Selection with Client Compression
  // --------------------------------------------------------------------------
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    setCompressionInfo(null);

    if (!file) return;

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(file.type.toLowerCase())) {
      setPhotoError('Invalid format. Only JPG, JPEG, and PNG images are allowed.');
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES * 3) {
      setPhotoError('Image is extremely large (> 9MB). Please choose a lighter file.');
      return;
    }

    setIsCompressing(true);
    try {
      const compressed = await compressImageFile(file, 1600, 0.84);
      setPhotoPreview(compressed.dataUrl);
      setPhotoFileMeta({
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
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.photo;
        return next;
      });
    } catch (err: any) {
      setPhotoError('Could not process image file: ' + (err?.message || 'unknown error'));
    } finally {
      setIsCompressing(false);
    }
  };

  // Step Navigations
  const goToStep2 = () => {
    if (!photoFileMeta) {
      setPhotoError('Photographic evidence is mandatory before proceeding.');
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    const errors: Record<string, string> = {};
    if (!address.trim() || address.trim().length < 5) {
      errors.address = 'Detailed street address or landmark is required (min 5 characters).';
    }
    if (!localityId) {
      errors.localityId = 'Select a locality.';
    }
    if (latitude === null || longitude === null) {
      errors.gps = 'Mandatory GPS coordinates are required. Click "Detect Current GPS".';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setStep(3);
  };

  // --------------------------------------------------------------------------
  // Form Submission
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name is required.';
    }
    if (!phoneNumber.trim() || phoneNumber.trim().length < 7) {
      errors.phoneNumber = 'Valid phone number is required for verification calls.';
    }
    if (!address.trim() || address.trim().length < 5) {
      errors.address = 'Address is required.';
    }
    if (!localityId) {
      errors.localityId = 'Locality is required.';
    }
    if (latitude === null || longitude === null) {
      errors.gps = 'GPS coordinates are mandatory.';
    }
    if (!photoFileMeta) {
      errors.photo = 'Mandatory photographic evidence is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const res = await portalStore.submitComplaint({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        localityId,
        address: address.trim(),
        latitude,
        longitude,
        wasteType,
        remark: remark.trim() || undefined,
        photoFile: photoFileMeta!,
      });

      setIsSubmitting(false);

      if (res.success && res.complaint) {
        setCreatedComplaint(res.complaint);
        // Reset form
        setAddress('');
        setRemark('');
        setPhotoPreview(null);
        setPhotoFileMeta(null);
        setCompressionInfo(null);
        setLatitude(null);
        setLongitude(null);
        setGpsAccuracy(null);
        setStep(1);
      } else {
        setFormErrors({ submit: res.error || 'Failed to submit report. Please retry.' });
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormErrors({ submit: err?.message || 'Submission error occurred.' });
    }
  };

  const copyTrackingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              REPORTS SUBMITTED
            </span>
            <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {totalSubmitted}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              ACTIVE DISPATCH
            </span>
            <p className="text-2xl font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
              {inProgressCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#12161c] rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              AUDITED & RESOLVED
            </span>
            <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {completedCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-[#12161c] rounded-2xl p-1.5 shadow-xs gap-1.5">
        <button
          onClick={() => setActiveTab('submit')}
          className={`flex-1 py-2.5 px-3 sm:px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
            activeTab === 'submit'
              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">REPORT WASTE PICKUP</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-3 sm:px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
            activeTab === 'history'
              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">MY REPORTS & TRACKING ({allMyComplaints.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: 3-STEP COMPLAINT WIZARD
         ========================================================================= */}
      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-[#12161c] rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 sm:p-8 shadow-xs space-y-6">
            {/* Header & Step Markers */}
            <div className="border-b border-slate-200 dark:border-white/[0.08] pb-5 space-y-4">
              <div>
                <span className="font-mono-display text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">
                  MUNICIPAL REPORTING DISPATCH
                </span>
                <h2 className="text-lg sm:text-xl font-mono-display font-bold uppercase tracking-wider text-slate-900 dark:text-white mt-1">
                  IMMEDIATE WASTE PICKUP REQUEST
                </h2>
              </div>

              {/* 3 Numbered Steps */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer min-h-[50px] ${
                    step === 1
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 shadow-xs'
                      : photoFileMeta
                      ? 'border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#0f1217] text-slate-700 dark:text-slate-300'
                      : 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-[#0b0d10] text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono-display text-[10px] font-bold">01</span>
                    {photoFileMeta && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs font-bold uppercase block truncate">PHOTO EVIDENCE</span>
                </button>

                <button
                  type="button"
                  onClick={() => photoFileMeta && setStep(2)}
                  disabled={!photoFileMeta}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all min-h-[50px] ${
                    !photoFileMeta ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    step === 2
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 shadow-xs'
                      : latitude
                      ? 'border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#0f1217] text-slate-700 dark:text-slate-300'
                      : 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-[#0b0d10] text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono-display text-[10px] font-bold">02</span>
                    {latitude && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs font-bold uppercase block truncate">GPS & ADDRESS</span>
                </button>

                <button
                  type="button"
                  onClick={() => photoFileMeta && latitude && setStep(3)}
                  disabled={!photoFileMeta || !latitude}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all min-h-[50px] ${
                    !photoFileMeta || !latitude ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    step === 3
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 shadow-xs'
                      : 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-[#0b0d10] text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono-display text-[10px] font-bold">03</span>
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs font-bold uppercase block truncate">CONFIRM & SUBMIT</span>
                </button>
              </div>
            </div>

            {formErrors.submit && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{formErrors.submit}</span>
              </div>
            )}

            {/* STEP 1: PHOTO EVIDENCE & CLIENT COMPRESSION */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <h3 className="font-mono-display text-xs uppercase tracking-wider text-slate-900 dark:text-white font-bold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>STEP 01: CAPTURE PHOTO EVIDENCE</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Capture or upload a clear photo of the waste pile. Client-side canvas compression ensures instant, lightweight upload under 3 MB.
                  </p>
                </div>

                {!photoPreview ? (
                  <label className="border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-500/50 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50 hover:bg-slate-100 dark:bg-[#0b0d10] dark:hover:bg-[#0f1419] group min-h-[220px]">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                      {isCompressing ? (
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-wider uppercase text-center">
                      {isCompressing ? 'COMPRESSING ON CLIENT CANVAS...' : 'CLICK TO UPLOAD OR TAKE PHOTO'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 mt-1 text-center">
                      JPG, JPEG, PNG (MAX 3 MB) • AUTOMATIC CLIENT OPTIMIZATION
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
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-300 dark:border-white/10 bg-black group max-w-md mx-auto shadow-md">
                      <img
                        src={photoPreview}
                        alt="Report evidence preview"
                        className="w-full h-56 object-cover"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoPreview(null);
                            setPhotoFileMeta(null);
                            setCompressionInfo(null);
                          }}
                          className="p-2 rounded-xl bg-black/70 hover:bg-rose-950 text-white hover:text-rose-400 border border-white/20 transition-all cursor-pointer shadow-md"
                          title="Remove & retake photo"
                          aria-label="Remove photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {compressionInfo && (
                        <div className="p-2.5 bg-slate-900/95 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-300 truncate max-w-[160px]">
                            {photoFileMeta?.name}
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {compressionInfo.compressedKb} KB ({compressionInfo.savedPercent}% compressed)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Evidence photo ready. Proceed to Step 02 for mandatory GPS capture.</span>
                    </div>
                  </div>
                )}

                {photoError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>{photoError}</span>
                  </p>
                )}

                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={goToStep2}
                    disabled={!photoFileMeta || isCompressing}
                    className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-2 min-h-[44px]"
                  >
                    <span>NEXT: GPS & LOCATION</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: GPS GEOLOCATION & ADDRESS */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <h3 className="font-mono-display text-xs uppercase tracking-wider text-slate-900 dark:text-white font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>STEP 02: MANDATORY GPS & LOCATION</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Municipal standard requires authentic browser GPS coordinates to prevent false dispatches.
                  </p>
                </div>

                {/* GPS Capture Button & Box */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0b0d10] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-mono text-xs text-slate-900 dark:text-white font-bold flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>BROWSER GEOLOCATION SENSOR</span>
                        <span className="text-rose-500">*</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        One-click hardware coordinate verification.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={captureGpsLocation}
                      disabled={gpsLoading}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer min-h-[44px]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                      <span>{gpsLoading ? 'DETECTING...' : latitude ? 'UPDATE GPS' : 'DETECT CURRENT GPS'}</span>
                    </button>
                  </div>

                  {latitude !== null && longitude !== null && (
                    <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          LAT: <strong>{latitude.toFixed(6)}°</strong> • LNG: <strong>{longitude.toFixed(6)}°</strong>{' '}
                          {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold shrink-0"
                      >
                        VIEW MAP <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {gpsError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">GPS Capture Required</p>
                        <p className="mt-0.5">{gpsError}</p>
                      </div>
                    </div>
                  )}

                  {formErrors.gps && !gpsError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-mono">{formErrors.gps}</p>
                  )}
                </div>

                {/* Locality & Detailed Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      LOCALITY / SECTOR <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={localityId}
                      onChange={(e) => setLocalityId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-600 focus:outline-hidden transition-colors cursor-pointer min-h-[44px]"
                    >
                      {localities.map((loc) => (
                        <option key={loc.id} value={loc.id} className="bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white">
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.localityId && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-1">{formErrors.localityId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      STREET ADDRESS / LANDMARK <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Near Community Center, Block 4"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 text-xs font-mono focus:border-emerald-600 focus:outline-hidden transition-colors min-h-[44px]"
                    />
                    {formErrors.address && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-1">{formErrors.address}</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>BACK TO PHOTO</span>
                  </button>

                  <button
                    type="button"
                    onClick={goToStep3}
                    className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-2 min-h-[44px]"
                  >
                    <span>NEXT: CONFIRM & SUBMIT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS, REVIEW & SUBMIT */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <h3 className="font-mono-display text-xs uppercase tracking-wider text-slate-900 dark:text-white font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>STEP 03: WASTE CATEGORY & DETAILS</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Review and confirm resident contact information before submitting to the municipal queue.
                  </p>
                </div>

                {/* Waste Type Selector Grid */}
                <div>
                  <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 font-bold">
                    WASTE CATEGORY <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALLOWED_WASTE_TYPES.map((t) => {
                      const isSelected = wasteType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setWasteType(t)}
                          className={`p-2.5 rounded-xl border text-left font-mono text-xs capitalize transition-all cursor-pointer min-h-[44px] flex items-center justify-between ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold shadow-xs'
                              : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0b0d10] text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10'
                          }`}
                        >
                          <span className="truncate">{t.replace('_', ' ')}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contact Verification Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      RESIDENT NAME <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-600 focus:outline-hidden transition-colors min-h-[44px]"
                    />
                    {formErrors.fullName && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-1">{formErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      PHONE (SUPERVISOR CONFIRMATION) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-600 focus:outline-hidden transition-colors min-h-[44px]"
                    />
                    {formErrors.phoneNumber && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-1">{formErrors.phoneNumber}</p>
                    )}
                  </div>
                </div>

                {/* Optional Remark */}
                <div>
                  <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-bold">
                    ADDITIONAL LANDMARK REMARKS (OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Specific landmarks or access directions for field cleaners..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 text-xs font-mono focus:border-emerald-600 focus:outline-hidden transition-colors"
                  />
                </div>

                {/* Summary Box */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/10 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>LOCATION:</span>
                    <span className="text-slate-900 dark:text-white font-bold truncate max-w-[220px]">{address}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>GPS SENSOR:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {latitude?.toFixed(4)}° N, {longitude?.toFixed(4)}° E
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>EVIDENCE SIZE:</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {photoFileMeta ? `${Math.round(photoFileMeta.sizeBytes / 1024)} KB` : 'None'}
                    </span>
                  </div>
                </div>

                {/* Step Navigation & Submit */}
                <div className="pt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>BACK TO GPS</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-3 px-6 sm:px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-2 min-h-[44px]"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>SUBMITTING DISPATCH...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>SUBMIT WASTE REPORT</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sidebar / Protocol Standards */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#12161c] rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 text-xs space-y-4 shadow-xs">
              <h3 className="font-mono-display uppercase tracking-widest text-slate-900 dark:text-white text-xs font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>DISPATCH PROTOCOL</span>
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                Each submission enters the supervisor triage queue. Supervisors perform voice verification via phone before dispatching certified locality cleaners.
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400 font-bold block">
                  01. VOICE VERIFICATION
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Supervisor reviews report photo & calls your phone number to confirm landmark details.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                  02. DUAL EVIDENCE AUDIT
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Resolution requires cleaner to submit post-cleanup photo from the same coordinates before audit sign-off.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b0d10] border border-slate-200 dark:border-white/5 space-y-1">
                <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">
                  03. REALTIME TRACKING
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Track live stage changes in your dashboard using your unique tracking code.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RESIDENT'S OWN COMPLAINTS & TRACKING
         ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-[#12161c] p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTracking}
                onChange={(e) => setSearchTracking(e.target.value)}
                placeholder="Search by Tracking ID (WPR-...), Address, or Locality..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#0b0d10] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 text-xs font-mono focus:border-emerald-600 focus:outline-hidden transition-colors min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] text-slate-800 dark:text-slate-300 text-xs font-mono cursor-pointer focus:border-emerald-600 focus:outline-hidden transition-colors min-h-[44px]"
              >
                <option value="all">ALL STATUSES</option>
                <option value="submitted">SUBMITTED</option>
                <option value="verified">VERIFIED</option>
                <option value="assigned">ASSIGNED</option>
                <option value="in_progress">IN PROGRESS</option>
                <option value="awaiting_verification">AUDITING</option>
                <option value="completed">RESOLVED</option>
                <option value="rejected">REJECTED</option>
              </select>
            </div>
          </div>

          {/* Empty State */}
          {residentComplaints.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-[#12161c] rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-mono-display text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                NO REPORTS FOUND
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                {allMyComplaints.length === 0
                  ? "You haven't submitted any waste pickup requests yet. Click the 'Report Waste Pickup' tab above to file your first request."
                  : 'No complaints match your current search or filter query. Try resetting your filter.'}
              </p>
              {allMyComplaints.length === 0 && (
                <button
                  onClick={() => setActiveTab('submit')}
                  className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm min-h-[44px]"
                >
                  START FIRST REPORT
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {residentComplaints.map((complaint) => {
                const initialPhoto = complaint.photos.find((p) => p.photoType === 'resident_initial' || p.photoType === 'resident_report');
                return (
                  <div
                    key={complaint.id}
                    onClick={() => setSelectedComplaint(complaint)}
                    className="bg-white dark:bg-[#12161c] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-xs hover:border-emerald-500 dark:hover:border-white/20 transition-all cursor-pointer flex flex-col group"
                  >
                    {initialPhoto ? (
                      <div className="h-44 bg-slate-100 dark:bg-black relative overflow-hidden">
                        <img
                          src={initialPhoto.url}
                          alt="Report photo"
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300 opacity-95 dark:opacity-90"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <StatusBadge status={complaint.status} size="sm" />
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <UrgencyBadge urgency={complaint.urgency} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 bg-slate-100 dark:bg-[#0b0d10] flex items-center justify-center p-3">
                        <MapPin className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                      </div>
                    )}

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-1">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 break-all">
                            {complaint.trackingCode}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px] tabular-nums">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 font-sans break-words">
                          {complaint.address}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{complaint.localityName}</p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
                        <span className="capitalize truncate">
                          {complaint.wasteType.replace('_', ' ')}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                          <span>TIMELINE</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUCCESS MODAL ON SUBMISSION */}
      {createdComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1217] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-5 sm:p-7 shadow-2xl space-y-5 text-center my-6 text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="font-mono-display text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">
                COMPLAINT LOGGED INTO AUDIT TRAIL
              </span>
              <h3 className="text-lg sm:text-xl font-mono-display font-bold text-slate-900 dark:text-white uppercase tracking-wider mt-1">
                REPORT SUBMITTED SUCCESSFULLY
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Your photographic and GPS evidence has been permanently recorded into the municipal registry.
              </p>
            </div>

            {/* Tracking ID Badge */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#12161c] border border-slate-200 dark:border-white/10 flex items-center justify-between shadow-xs gap-2">
              <div className="text-left min-w-0">
                <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  TRACKING IDENTIFIER
                </span>
                <p className="text-base sm:text-lg font-mono font-bold text-emerald-700 dark:text-emerald-400 break-all">
                  {createdComplaint.trackingCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyTrackingCode(createdComplaint.trackingCode)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0b0d10] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5 transition-all shrink-0 min-h-[44px]"
              >
                {copiedTracking ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>COPY ID</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs font-mono text-left bg-slate-50 dark:bg-[#0b0d10] p-3.5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-1 text-slate-700 dark:text-slate-300">
              <p>
                <strong className="text-slate-500 dark:text-slate-400">LOCATION:</strong> {createdComplaint.address} ({createdComplaint.localityName})
              </p>
              <p>
                <strong className="text-slate-500 dark:text-slate-400">GPS:</strong> {createdComplaint.latitude.toFixed(6)}° N, {createdComplaint.longitude.toFixed(6)}° E
              </p>
              <p className="text-emerald-700 dark:text-emerald-400/90 pt-1">
                <strong>NEXT STEP:</strong> Supervisor will review photo & call {createdComplaint.residentPhone} to confirm before assigning cleaner.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedComplaint(createdComplaint);
                  setCreatedComplaint(null);
                  setActiveTab('history');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer transition-all min-h-[44px]"
              >
                VIEW LIVE TIMELINE
              </button>
              <button
                type="button"
                onClick={() => setCreatedComplaint(null)}
                className="py-3 px-4 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 font-mono text-xs hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors min-h-[44px]"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLAINT DETAIL & TIMELINE MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1217] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl space-y-6 my-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm break-all">
                    {selectedComplaint.trackingCode}
                  </span>
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <UrgencyBadge urgency={selectedComplaint.urgency} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans break-words">
                  {selectedComplaint.address}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {selectedComplaint.localityName} • SUBMITTED{' '}
                  <span className="tabular-nums">
                    {new Date(selectedComplaint.createdAt).toLocaleString()}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPS & Evidence Photos Side-by-Side if resolved */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-slate-50 dark:bg-[#12161c] p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.08]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                    GPS COORDINATES
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                    {selectedComplaint.latitude.toFixed(6)}° N, {selectedComplaint.longitude.toFixed(6)}° E
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                    MAP NAVIGATION
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${selectedComplaint.latitude},${selectedComplaint.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold mt-0.5"
                  >
                    OPEN IN GOOGLE MAPS <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Photo Evidence Section */}
              <div className="space-y-2">
                <span className="font-mono-display text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                  PHOTOGRAPHIC EVIDENCE (AUDIT PAIR)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Before Photo */}
                  <div className="bg-slate-50 dark:bg-[#0b0d10] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="p-2 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                        01. BEFORE (INITIAL REPORT)
                      </span>
                    </div>
                    {selectedComplaint.photos.find((p) => p.photoType === 'resident_initial' || p.photoType === 'resident_report') ? (
                      <SignedPhoto
                        storagePath={selectedComplaint.photos.find((p) => p.photoType === 'resident_initial' || p.photoType === 'resident_report')!.storagePath}
                        src={selectedComplaint.photos.find((p) => p.photoType === 'resident_initial' || p.photoType === 'resident_report')!.url}
                        alt="Initial waste report photo"
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-mono">
                        NO INITIAL PHOTO
                      </div>
                    )}
                  </div>

                  {/* After Photo (if cleaner completed) */}
                  <div className="bg-slate-50 dark:bg-[#0b0d10] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="p-2 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                        02. AFTER (CLEANER EVIDENCE)
                      </span>
                    </div>
                    {selectedComplaint.photos.find((p) => p.photoType === 'cleaner_completion') ? (
                      <SignedPhoto
                        storagePath={selectedComplaint.photos.find((p) => p.photoType === 'cleaner_completion')!.storagePath}
                        src={selectedComplaint.photos.find((p) => p.photoType === 'cleaner_completion')!.url}
                        alt="Cleaner completion proof photo"
                        className="w-full h-44 object-cover"
                      />
                    ) : (
                      <div className="h-44 flex flex-col items-center justify-center text-xs text-slate-500 font-mono p-4 text-center">
                        <Clock className="w-5 h-5 text-slate-400 dark:text-slate-600 mb-1" />
                        <span>AWAITING CLEANER EXECUTION</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Interactive Lifecycle Timeline */}
              <div className="pt-2">
                <ComplaintTimeline
                  currentStatus={selectedComplaint.status}
                  history={selectedComplaint.history}
                />
              </div>
            </div>

            <div className="pt-2 text-right border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
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
