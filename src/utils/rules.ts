/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'resident' | 'cleaner' | 'supervisor' | 'admin';

export type AccountStatus = 'active' | 'pending' | 'suspended';

export type ComplaintStatus =
  | 'submitted'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_verification'
  | 'completed'
  | 'rejected';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';

export type WasteType =
  | 'household'
  | 'plastic'
  | 'e_waste'
  | 'hazardous'
  | 'construction'
  | 'organic'
  | 'other';

export const ALLOWED_WASTE_TYPES: WasteType[] = [
  'household',
  'plastic',
  'e_waste',
  'hazardous',
  'construction',
  'organic',
  'other',
];

export const MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

/**
 * Validates GPS coordinates.
 * Coordinates must be numeric, not NaN, latitude between -90 and 90,
 * longitude between -180 and 180, and not the (0,0) null island placeholder.
 */
export function validateGpsCoordinates(lat?: number | null, lng?: number | null): { valid: boolean; error?: string } {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { valid: false, error: 'GPS coordinates are mandatory. Please enable location access.' };
  }

  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, error: 'GPS coordinates must be valid numbers.' };
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, error: `Latitude must be between -90 and 90 degrees. Received: ${lat}` };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, error: `Longitude must be between -180 and 180 degrees. Received: ${lng}` };
  }

  // Reject synthetic 0,0 null island
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) {
    return { valid: false, error: 'Invalid GPS coordinates: Zero coordinates detected. Real geolocation required.' };
  }

  return { valid: true };
}

/**
 * Validates photo metadata (size, MIME type).
 */
export function validatePhotoUpload(fileMeta: { mimeType?: string; sizeBytes?: number }): { valid: boolean; error?: string } {
  if (!fileMeta || !fileMeta.mimeType) {
    return { valid: false, error: 'Photo is mandatory for complaint submission.' };
  }

  const normalizedMime = fileMeta.mimeType.toLowerCase();
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(normalizedMime)) {
    return { valid: false, error: 'Photo must be JPG, JPEG, or PNG format.' };
  }

  if (typeof fileMeta.sizeBytes !== 'number' || fileMeta.sizeBytes <= 0) {
    return { valid: false, error: 'Photo file size is invalid.' };
  }

  if (fileMeta.sizeBytes > MAX_PHOTO_SIZE_BYTES) {
    const sizeMb = (fileMeta.sizeBytes / (1024 * 1024)).toFixed(2);
    return { valid: false, error: `Photo exceeds the maximum allowed size of 3 MB (received ${sizeMb} MB).` };
  }

  return { valid: true };
}

/**
 * Validates complete resident complaint input before submission.
 */
export function validateComplaintInput(input: {
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  localityId?: string;
  latitude?: number | null;
  longitude?: number | null;
  wasteType?: string;
  photo?: { mimeType?: string; sizeBytes?: number } | null;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.fullName = 'Full name is required (minimum 2 characters).';
  }

  if (!input.phoneNumber || input.phoneNumber.trim().length < 7) {
    errors.phoneNumber = 'A valid phone number is required for supervisor confirmation.';
  }

  if (!input.address || input.address.trim().length < 5) {
    errors.address = 'Street address is required (minimum 5 characters).';
  }

  if (!input.localityId || input.localityId.trim().length === 0) {
    errors.localityId = 'Locality selection is required.';
  }

  const gpsCheck = validateGpsCoordinates(input.latitude, input.longitude);
  if (!gpsCheck.valid && gpsCheck.error) {
    errors.gps = gpsCheck.error;
  }

  if (!input.wasteType || !ALLOWED_WASTE_TYPES.includes(input.wasteType as WasteType)) {
    errors.wasteType = `Waste type must be one of: ${ALLOWED_WASTE_TYPES.join(', ')}.`;
  }

  if (!input.photo) {
    errors.photo = 'A photographic evidence of the waste is mandatory.';
  } else {
    const photoCheck = validatePhotoUpload(input.photo);
    if (!photoCheck.valid && photoCheck.error) {
      errors.photo = photoCheck.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Generates unique human-readable tracking ID.
 * Format: WPR-YYMMDD-XXXX (e.g. WPR-261022-A7K9)
 */
export function generateTrackingCode(date: Date = new Date(), customRandom?: string): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  if (customRandom && /^[A-Z0-9]{4}$/.test(customRandom)) {
    return `WPR-${dateStr}-${customRandom}`;
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randStr = '';
  for (let i = 0; i < 4; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `WPR-${dateStr}-${randStr}`;
}

/**
 * Validates cleaner eligibility for assignment to a complaint locality.
 */
export function validateCleanerAssignment(
  cleaner: { id: string; role: UserRole; accountStatus: AccountStatus; approvedLocalityIds: string[] },
  complaintLocalityId: string
): { eligible: boolean; reason?: string } {
  if (cleaner.role !== 'cleaner') {
    return { eligible: false, reason: 'User does not possess the cleaner role.' };
  }

  if (cleaner.accountStatus !== 'active') {
    return { eligible: false, reason: `Cleaner account is ${cleaner.accountStatus}. Only active cleaners can be assigned.` };
  }

  if (!cleaner.approvedLocalityIds || !cleaner.approvedLocalityIds.includes(complaintLocalityId)) {
    return {
      eligible: false,
      reason: 'Cleaner does not have an approved service area matching this complaint locality.',
    };
  }

  return { eligible: true };
}

/**
 * Validates complaint status transitions and authorization invariants.
 */
export function canTransitionStatus(
  currentStatus: ComplaintStatus,
  targetStatus: ComplaintStatus,
  callerRole: UserRole,
  context: {
    callerId: string;
    residentId?: string;
    assignedCleanerId?: string | null;
    rejectionReason?: string;
    hasAfterPhoto?: boolean;
    returnNote?: string;
  }
): { allowed: boolean; reason?: string } {
  // Residents cannot manually alter complaint statuses
  if (callerRole === 'resident') {
    return { allowed: false, reason: 'Residents cannot update complaint statuses directly.' };
  }

  // 1. submitted -> verified (Supervisor / Admin)
  if (currentStatus === 'submitted' && targetStatus === 'verified') {
    if (callerRole !== 'supervisor' && callerRole !== 'admin') {
      return { allowed: false, reason: 'Only a supervisor or administrator can verify complaints.' };
    }
    return { allowed: true };
  }

  // 2. submitted -> rejected (Supervisor / Admin)
  if (currentStatus === 'submitted' && targetStatus === 'rejected') {
    if (callerRole !== 'supervisor' && callerRole !== 'admin') {
      return { allowed: false, reason: 'Only a supervisor or administrator can reject complaints.' };
    }
    if (!context.rejectionReason || context.rejectionReason.trim().length < 5) {
      return { allowed: false, reason: 'A clear rejection reason (at least 5 characters) is required.' };
    }
    return { allowed: true };
  }

  // 3. verified -> assigned (Supervisor / Admin)
  if (currentStatus === 'verified' && targetStatus === 'assigned') {
    if (callerRole !== 'supervisor' && callerRole !== 'admin') {
      return { allowed: false, reason: 'Only a supervisor or administrator can assign cleaners.' };
    }
    if (!context.assignedCleanerId) {
      return { allowed: false, reason: 'An approved cleaner must be selected.' };
    }
    return { allowed: true };
  }

  // 4. assigned -> in_progress (Assigned Cleaner)
  if (currentStatus === 'assigned' && targetStatus === 'in_progress') {
    if (callerRole !== 'cleaner') {
      return { allowed: false, reason: 'Only cleaners can start work on assigned complaints.' };
    }
    if (context.callerId !== context.assignedCleanerId) {
      return { allowed: false, reason: 'You can only start progress on complaints assigned to you.' };
    }
    return { allowed: true };
  }

  // 5. in_progress -> awaiting_verification (Assigned Cleaner)
  if (currentStatus === 'in_progress' && targetStatus === 'awaiting_verification') {
    if (callerRole !== 'cleaner') {
      return { allowed: false, reason: 'Only the assigned cleaner can submit completion evidence.' };
    }
    if (context.callerId !== context.assignedCleanerId) {
      return { allowed: false, reason: 'You can only submit completion evidence for your own assigned tasks.' };
    }
    if (!context.hasAfterPhoto) {
      return { allowed: false, reason: 'A mandatory after-cleaning photo is required before submitting completion.' };
    }
    return { allowed: true };
  }

  // 6. awaiting_verification -> completed (Supervisor / Admin)
  if (currentStatus === 'awaiting_verification' && targetStatus === 'completed') {
    if (callerRole !== 'supervisor' && callerRole !== 'admin') {
      return { allowed: false, reason: 'Only a supervisor or administrator can approve completion.' };
    }
    if (!context.hasAfterPhoto) {
      return { allowed: false, reason: 'Cannot approve completion without verified after-cleaning photo evidence.' };
    }
    return { allowed: true };
  }

  // 7. awaiting_verification -> in_progress (Supervisor / Admin returns inadequate evidence)
  if (currentStatus === 'awaiting_verification' && targetStatus === 'in_progress') {
    if (callerRole !== 'supervisor' && callerRole !== 'admin') {
      return { allowed: false, reason: 'Only a supervisor or administrator can return tasks to in-progress.' };
    }
    if (!context.returnNote || context.returnNote.trim().length < 5) {
      return { allowed: false, reason: 'An explanatory note is required when returning work to in progress.' };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Invalid state transition from '${currentStatus}' to '${targetStatus}' for role '${callerRole}'.`,
  };
}
