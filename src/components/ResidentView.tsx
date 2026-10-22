/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, Complaint, Locality, WasteType } from '../types/index.ts';
import { ALLOWED_WASTE_TYPES, MAX_PHOTO_SIZE_BYTES } from '../utils/rules.ts';
import { portalStore } from '../services/store.ts';
import { StatusBadge, UrgencyBadge } from './StatusBadge.tsx';
import { ComplaintTimeline } from './ComplaintTimeline.tsx';
import {
  MapPin,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ChevronRight,
  X,
  Phone,
  FileText,
  Inbox,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
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

  // Form State
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

  // Photo State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileMeta, setPhotoFileMeta] = useState<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
    rawFile?: File;
  } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createdComplaint, setCreatedComplaint] = useState<Complaint | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Complaints List & Detail State
  const [searchTracking, setSearchTracking] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Filter complaints: Resident can view ONLY their own complaints
  const allMyComplaints = complaints.filter((c) => c.residentId === currentUser.id);

  const residentComplaints = allMyComplaints.filter(
    (c) =>
      (statusFilter === 'all' || c.status === statusFilter) &&
      (searchTracking.trim() === '' ||
        c.trackingCode.toLowerCase().includes(searchTracking.trim().toLowerCase()) ||
        c.address.toLowerCase().includes(searchTracking.trim().toLowerCase()) ||
        c.localityName.toLowerCase().includes(searchTracking.trim().toLowerCase()))
  );

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
            'Location permission was denied. Mandatory GPS coordinates are required by municipal policy to prevent false dispatches. Please allow location access in your browser settings and click Retry.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable. Please check your device GPS.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Geolocation request timed out. Please try again.';
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // --------------------------------------------------------------------------
  // Photo Handling & Validation (Max 3MB, JPG/PNG)
  // --------------------------------------------------------------------------
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    setPhotoPreview(null);
    setPhotoFileMeta(null);

    if (!file) return;

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimes.includes(file.type.toLowerCase())) {
      setPhotoError('Invalid image format. Only JPG, JPEG, and PNG images are allowed.');
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setPhotoError(`File is too large (${mb} MB). Maximum allowed size is 3 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoFileMeta({
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl: result,
        rawFile: file,
      });
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.photo;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  // --------------------------------------------------------------------------
  // Form Submission
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name is required (minimum 2 characters).';
    }
    if (!phoneNumber.trim() || phoneNumber.trim().length < 7) {
      errors.phoneNumber = 'Phone number is required for supervisor confirmation.';
    }
    if (!address.trim() || address.trim().length < 5) {
      errors.address = 'Street address or landmark is required (minimum 5 characters).';
    }
    if (!localityId) {
      errors.localityId = 'Please select a locality.';
    }
    if (latitude === null || longitude === null) {
      errors.gps = 'Mandatory GPS coordinates are missing. Click "Detect Current GPS" before submitting.';
    }
    if (!photoFileMeta) {
      errors.photo = 'A photographic evidence of the waste is mandatory.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const res = await portalStore.submitComplaint({
        fullName,
        phoneNumber,
        address,
        localityId,
        latitude,
        longitude,
        wasteType,
        remark,
        photoFile: photoFileMeta!,
      });

      setIsSubmitting(false);

      if (res.success && res.complaint) {
        setCreatedComplaint(res.complaint);
        setAddress('');
        setRemark('');
        setPhotoPreview(null);
        setPhotoFileMeta(null);
        setLatitude(null);
        setLongitude(null);
        setGpsAccuracy(null);
      } else {
        setFormErrors({ submit: res.error || 'Failed to submit complaint. Please retry.' });
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormErrors({ submit: err.message || 'Submission error occurred.' });
    }
  };

  const copyTrackingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Reports Filed
            </span>
            <p className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalSubmitted}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Active / In Progress
            </span>
            <p className="text-2xl font-black font-mono tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
              {inProgressCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Resolved & Audited
            </span>
            <p className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {completedCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl px-4 pt-2 shadow-2xs">
        <button
          onClick={() => setActiveTab('submit')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'submit'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Report Waste Pickup</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>My Complaints & Tracking ({allMyComplaints.length})</span>
        </button>
      </div>

      {/* TAB 1: SUBMIT COMPLAINT FORM */}
      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Submit Immediate Waste Pickup Request
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Report visible municipal waste with verified GPS and photographic evidence for prompt inspection.
              </p>
            </div>

            {formErrors.submit && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{formErrors.submit}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Resident Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
                  />
                  {formErrors.fullName && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{formErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Phone Number (for Supervisor Confirmation) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +1-555-0100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
                  />
                  {formErrors.phoneNumber && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{formErrors.phoneNumber}</p>
                  )}
                </div>
              </div>

              {/* Address & Locality Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Locality / Ward <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={localityId}
                    onChange={(e) => setLocalityId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors cursor-pointer"
                  >
                    {localities.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.localityId && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{formErrors.localityId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Waste Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={wasteType}
                    onChange={(e) => setWasteType(e.target.value as WasteType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors capitalize cursor-pointer"
                  >
                    {ALLOWED_WASTE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Detailed Street Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Street Address & Landmark <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street name, landmark, building number or nearby public spot"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
                />
                {formErrors.address && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{formErrors.address}</p>
                )}
              </div>

              {/* Mandatory GPS Geolocation Capture */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Mandatory GPS Geolocation</span>
                      <span className="text-rose-500">*</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Coordinates are captured directly from browser geolocation. Coordinates are never fabricated or guessed.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={captureGpsLocation}
                    disabled={gpsLoading}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                    <span>{gpsLoading ? 'Detecting GPS...' : latitude ? 'Update GPS' : 'Detect Current GPS'}</span>
                  </button>
                </div>

                {latitude !== null && longitude !== null ? (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-mono tabular-nums">
                        Verified coordinates: <strong>{latitude.toFixed(6)}° N</strong>,{' '}
                        <strong>{longitude.toFixed(6)}° E</strong>{' '}
                        {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                      </span>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 dark:text-emerald-300 font-semibold hover:underline flex items-center gap-1 shrink-0"
                    >
                      View on Map <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : null}

                {gpsError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">GPS Capture Denied or Unavailable</p>
                      <p>{gpsError}</p>
                      <button
                        type="button"
                        onClick={captureGpsLocation}
                        className="text-xs font-bold text-rose-900 dark:text-rose-100 underline hover:no-underline pt-1 block cursor-pointer"
                      >
                        Retry GPS Detection
                      </button>
                    </div>
                  </div>
                )}

                {formErrors.gps && !gpsError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{formErrors.gps}</p>
                )}
              </div>

              {/* Photographic Evidence Upload (Max 3MB, JPG/PNG) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Photographic Evidence (One photo, JPG/JPEG/PNG, Max 3 MB){' '}
                  <span className="text-rose-500">*</span>
                </label>

                {!photoPreview ? (
                  <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5 shadow-2xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Click to browse or take photo from device
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      JPG, JPEG, PNG format up to 3 MB
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group bg-slate-900 max-w-md shadow-sm">
                    <img
                      src={photoPreview}
                      alt="Complaint preview"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          setPhotoFileMeta(null);
                        }}
                        className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 cursor-pointer shadow-md"
                        title="Remove photo"
                        aria-label="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2.5 bg-slate-900/95 text-white text-[11px] flex justify-between items-center">
                      <span className="truncate max-w-[200px]">{photoFileMeta?.name}</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {photoFileMeta
                          ? `${(photoFileMeta.sizeBytes / 1024).toFixed(0)} KB`
                          : ''}
                      </span>
                    </div>
                  </div>
                )}

                {photoError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{photoError}</p>}
                {formErrors.photo && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{formErrors.photo}</p>
                )}
              </div>

              {/* Optional Remark */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Additional Remarks or Landmark Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Additional context or directions for the cleaner"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Request & Uploading Photo...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Submit Waste Pickup Request</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar / Policy Info */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 text-xs space-y-4 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Municipal Pickup Policy</span>
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                This portal is for reporting visible municipal waste requiring immediate pickup. Once submitted, your request is reviewed by the area Supervisor who will call your phone number to confirm before dispatching an approved cleaner.
              </p>

              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-300 space-y-1 shadow-2xs">
                <p className="font-bold">Dual Evidence Standard</p>
                <p className="text-[11px] leading-relaxed">
                  Submissions require genuine GPS coordinates and an initial evidence photo. Cleaners must also submit an after-cleaning photo before completion is approved.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-300 space-y-1 shadow-2xs">
                <p className="font-bold">Automated Tracking ID</p>
                <p className="text-[11px] leading-relaxed">
                  Every submission generates an auditable tracking code (e.g., <code className="font-mono font-semibold">WPR-260322-XXXX</code>) that updates live throughout verification, assignment, and completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESIDENT'S OWN COMPLAINTS & TRACKING */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTracking}
                onChange={(e) => setSearchTracking(e.target.value)}
                placeholder="Search by Tracking ID (e.g. WPR-...), Address, or Locality..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden transition-colors"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_verification">Awaiting Verification</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Genuine Clean Empty State */}
          {residentComplaints.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No complaints found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                {allMyComplaints.length === 0
                  ? "You haven't submitted any waste pickup requests yet. Use the 'Report Waste Pickup' tab above to file your first request."
                  : 'No complaints match your current search or filter criteria. Try clearing the filter.'}
              </p>
              {allMyComplaints.length === 0 && (
                <button
                  onClick={() => setActiveTab('submit')}
                  className="mt-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Report Waste Pickup
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {residentComplaints.map((complaint) => {
                const initialPhoto = complaint.photos.find((p) => p.photoType === 'resident_initial');
                return (
                  <div
                    key={complaint.id}
                    onClick={() => setSelectedComplaint(complaint)}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col group"
                  >
                    {initialPhoto ? (
                      <div className="h-44 bg-slate-950 relative overflow-hidden">
                        <img
                          src={initialPhoto.url}
                          alt="Complaint photo"
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <StatusBadge status={complaint.status} size="sm" />
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <UrgencyBadge urgency={complaint.urgency} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-3">
                        <MapPin className="w-6 h-6 text-slate-400" />
                      </div>
                    )}

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {complaint.trackingCode}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] tabular-nums">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                          {complaint.address}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{complaint.localityName}</p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize font-medium">Type: {complaint.wasteType.replace('_', ' ')}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Timeline</span>
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

      {/* SUCCESS MODAL ON CREATION */}
      {createdComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5 text-center my-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-2xs">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Complaint Submitted Successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your complaint and photo metadata have been recorded. Use this unique tracking ID to monitor progress.
              </p>
            </div>

            {/* Tracking Code Highlight */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-2xs">
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tracking ID
                </span>
                <p className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                  {createdComplaint.trackingCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyTrackingCode(createdComplaint.trackingCode)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shadow-2xs"
              >
                {copiedTracking ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 text-left bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 leading-relaxed">
              <p>
                <strong>Location:</strong> {createdComplaint.address} ({createdComplaint.localityName})
              </p>
              <p className="font-mono tabular-nums">
                <strong>GPS:</strong> {createdComplaint.latitude.toFixed(6)}° N,{' '}
                {createdComplaint.longitude.toFixed(6)}° E
              </p>
              <p>
                <strong>Next Step:</strong> The municipal supervisor will review coordinates & photo, then contact {createdComplaint.residentPhone} to confirm before dispatching a certified cleaner.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedComplaint(createdComplaint);
                  setCreatedComplaint(null);
                  setActiveTab('history');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
              >
                View Full Status Timeline
              </button>
              <button
                type="button"
                onClick={() => setCreatedComplaint(null)}
                className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLAINT DETAIL & TIMELINE MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-6 my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    {selectedComplaint.trackingCode}
                  </span>
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <UrgencyBadge urgency={selectedComplaint.urgency} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedComplaint.address}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedComplaint.localityName} • Submitted on{' '}
                  <span className="font-mono tabular-nums">
                    {new Date(selectedComplaint.createdAt).toLocaleString()}
                  </span>
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

            {/* GPS & Contact Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                  Mandatory GPS Coordinates
                </span>
                <p className="font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-1">
                  {selectedComplaint.latitude.toFixed(6)}° N, {selectedComplaint.longitude.toFixed(6)}° E
                </p>
                <a
                  href={`https://www.google.com/maps?q=${selectedComplaint.latitude},${selectedComplaint.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-1.5 font-semibold"
                >
                  Open in Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                  Waste Type & Contact
                </span>
                <p className="text-slate-800 dark:text-slate-200 capitalize mt-1 font-semibold">
                  {selectedComplaint.wasteType.replace('_', ' ')}
                </p>
                <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-mono tabular-nums">
                  <Phone className="w-3.5 h-3.5" /> {selectedComplaint.residentPhone}
                </p>
              </div>
            </div>

            {/* Photos Preview */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Photographic Evidence ({selectedComplaint.photos.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedComplaint.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-sm"
                  >
                    <div className="h-48">
                      <img
                        src={photo.url}
                        alt={photo.photoType}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3 bg-slate-900 text-white text-[11px] flex justify-between items-center">
                      <span className="font-semibold capitalize">
                        {photo.photoType === 'resident_initial'
                          ? 'Initial Resident Photo'
                          : 'After-Cleaning Proof'}
                      </span>
                      <span className="text-slate-400 font-mono tabular-nums">
                        {new Date(photo.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Timeline */}
            <ComplaintTimeline
              currentStatus={selectedComplaint.status}
              history={selectedComplaint.history}
            />

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
