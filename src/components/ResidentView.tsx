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
  const residentComplaints = complaints.filter(
    (c) =>
      c.residentId === currentUser.id &&
      (statusFilter === 'all' || c.status === statusFilter) &&
      (searchTracking.trim() === '' ||
        c.trackingCode.toLowerCase().includes(searchTracking.trim().toLowerCase()) ||
        c.address.toLowerCase().includes(searchTracking.trim().toLowerCase()))
  );

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
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('submit')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'submit'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" /> Report Waste Pickup
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" /> My Complaints & Tracking ({residentComplaints.length})
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: SUBMIT COMPLAINT FORM */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Submit Immediate Waste Pickup Request
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Report visible municipal waste with verified GPS and photographic evidence for prompt inspection.
              </p>
            </div>

            {formErrors.submit && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErrors.submit}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Resident Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  {formErrors.fullName && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number (for Supervisor Confirmation) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +1-555-0100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  {formErrors.phoneNumber && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.phoneNumber}</p>
                  )}
                </div>
              </div>

              {/* Address & Locality Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Locality / Ward <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={localityId}
                    onChange={(e) => setLocalityId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {localities.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.localityId && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.localityId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Waste Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={wasteType}
                    onChange={(e) => setWasteType(e.target.value as WasteType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden capitalize"
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Street Address & Landmark <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street name, landmark, building number or nearby public spot"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                {formErrors.address && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.address}</p>
                )}
              </div>

              {/* Mandatory GPS Geolocation Capture */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" /> Mandatory GPS Geolocation
                      <span className="text-rose-500">*</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Coordinates are captured directly from browser geolocation. Coordinates are never fabricated or guessed.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={captureGpsLocation}
                    disabled={gpsLoading}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                    {gpsLoading ? 'Detecting GPS...' : latitude ? 'Update GPS' : 'Detect Current GPS'}
                  </button>
                </div>

                {latitude !== null && longitude !== null ? (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Verified coordinates: <strong>{latitude.toFixed(6)}° N</strong>,{' '}
                        <strong>{longitude.toFixed(6)}° E</strong>{' '}
                        {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                      </span>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 shrink-0"
                    >
                      View on Map <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : null}

                {gpsError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
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
                  <p className="text-xs text-rose-600 font-medium">{formErrors.gps}</p>
                )}
              </div>

              {/* Photographic Evidence Upload (Max 3MB, JPG/PNG) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Photographic Evidence (One photo, JPG/JPEG/PNG, Max 3 MB){' '}
                  <span className="text-rose-500">*</span>
                </label>

                {!photoPreview ? (
                  <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-2">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Click to browse or take photo from device
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
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
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group bg-slate-900 max-w-md">
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
                        className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 cursor-pointer"
                        title="Remove photo"
                        aria-label="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2 bg-slate-900/90 text-white text-[11px] flex justify-between items-center">
                      <span className="truncate max-w-[200px]">{photoFileMeta?.name}</span>
                      <span>
                        {photoFileMeta
                          ? `${(photoFileMeta.sizeBytes / 1024).toFixed(0)} KB`
                          : ''}
                      </span>
                    </div>
                  </div>
                )}

                {photoError && <p className="text-xs text-rose-600 mt-1 font-medium">{photoError}</p>}
                {formErrors.photo && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.photo}</p>
                )}
              </div>

              {/* Optional Remark */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Remarks or Landmark Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Additional context or directions for the cleaner"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Request & Uploading Photo...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" /> Submit Waste Pickup Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar / Instructions */}
          <div className="space-y-5">
            <div className="bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-xs space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" /> Municipal Pickup Policy
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                This portal is for reporting visible municipal waste requiring immediate pickup. Once submitted, your request is reviewed by the area Supervisor who will call your phone number to confirm before dispatching an approved cleaner.
              </p>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-semibold">Mandatory Photo & GPS</p>
                <p className="text-[11px]">
                  Submissions require both genuine GPS coordinates and an initial evidence photo. Cleaners must also submit an after-cleaning photo before completion is approved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: RESIDENT'S OWN COMPLAINTS & TRACKING */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTracking}
                onChange={(e) => setSearchTracking(e.target.value)}
                placeholder="Search by Tracking ID (e.g. WPR-...) or Address..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
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
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                No complaints yet.
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                You haven't submitted any waste pickup requests yet. Use the "Report Waste Pickup" tab above to file your first request.
              </p>
              <button
                onClick={() => setActiveTab('submit')}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Report Waste Pickup
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {residentComplaints.map((complaint) => {
                const initialPhoto = complaint.photos.find((p) => p.photoType === 'resident_initial');
                return (
                  <div
                    key={complaint.id}
                    onClick={() => setSelectedComplaint(complaint)}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                  >
                    {initialPhoto ? (
                      <div className="h-40 bg-slate-950 relative overflow-hidden">
                        <img
                          src={initialPhoto.url}
                          alt="Complaint photo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2">
                          <StatusBadge status={complaint.status} size="sm" />
                        </div>
                        <div className="absolute top-2 right-2">
                          <UrgencyBadge urgency={complaint.urgency} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-3">
                        <MapPin className="w-6 h-6 text-slate-400" />
                      </div>
                    )}

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {complaint.trackingCode}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                          {complaint.address}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">{complaint.localityName}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span className="capitalize font-medium">Type: {complaint.wasteType}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          View Timeline <ChevronRight className="w-3.5 h-3.5" />
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

      {/* ---------------------------------------------------------------------- */}
      {/* SUCCESS MODAL ON CREATION */}
      {/* ---------------------------------------------------------------------- */}
      {createdComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Complaint Submitted Successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your complaint and photo metadata have been recorded. Use this unique tracking ID to monitor progress.
              </p>
            </div>

            {/* Tracking Code Highlight */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tracking ID
                </span>
                <p className="text-lg font-mono font-extrabold text-blue-600 dark:text-blue-400">
                  {createdComplaint.trackingCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyTrackingCode(createdComplaint.trackingCode)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-semibold flex items-center gap-1 hover:bg-slate-50 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {copiedTracking ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy ID
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-slate-500 text-left bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
              <p>
                <strong>Location:</strong> {createdComplaint.address} ({createdComplaint.localityName})
              </p>
              <p>
                <strong>GPS:</strong> {createdComplaint.latitude.toFixed(6)}° N,{' '}
                {createdComplaint.longitude.toFixed(6)}° E
              </p>
              <p>
                <strong>Next Step:</strong> The municipal supervisor will review coordinates & photo, then contact {createdComplaint.residentPhone} to confirm before assigning a cleaner.
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                View Full Status Timeline
              </button>
              <button
                type="button"
                onClick={() => setCreatedComplaint(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* COMPLAINT DETAIL & TIMELINE MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
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
                  {selectedComplaint.localityName} • Submitted on{' '}
                  {new Date(selectedComplaint.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPS & Contact Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Mandatory GPS Coordinates
                </span>
                <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedComplaint.latitude.toFixed(6)}° N, {selectedComplaint.longitude.toFixed(6)}° E
                </p>
                <a
                  href={`https://www.google.com/maps?q=${selectedComplaint.latitude},${selectedComplaint.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 mt-1 font-semibold"
                >
                  Open in Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Waste Type & Contact
                </span>
                <p className="text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                  {selectedComplaint.wasteType.replace('_', ' ')}
                </p>
                <p className="text-slate-500 mt-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {selectedComplaint.residentPhone}
                </p>
              </div>
            </div>

            {/* Photos Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Photographic Evidence
              </h4>
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
                    <div className="p-2.5 bg-slate-900 text-white text-[11px] flex justify-between items-center">
                      <span className="font-semibold capitalize">
                        {photo.photoType === 'resident_initial'
                          ? 'Initial Complaint Photo'
                          : 'After-Cleaning Evidence'}
                      </span>
                      <span className="text-slate-400">
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
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
