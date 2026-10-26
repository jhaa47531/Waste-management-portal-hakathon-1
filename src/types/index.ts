/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserRole,
  AccountStatus,
  ComplaintStatus,
  UrgencyLevel,
  WasteType,
  isAdministrator,
  isSupervisorOrAdmin,
} from '../utils/rules.ts';

export type { UserRole, AccountStatus, ComplaintStatus, UrgencyLevel, WasteType };
export { isAdministrator, isSupervisorOrAdmin };

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  accountStatus: AccountStatus;
  supervisorId?: string | null;
  supervisorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Locality {
  id: string;
  name: string;
  active: boolean;
  isActive?: boolean;
}

export interface CleanerApplication {
  id: string;
  cleanerId: string;
  cleanerName: string;
  cleanerEmail: string;
  cleanerPhone?: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedSupervisorId?: string | null;
  assignedSupervisorName?: string | null;
  reviewerId?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  preferredLocalityIds?: string[];
  createdAt: string;
}

export interface CleanerServiceArea {
  id: string;
  cleanerId: string;
  localityId: string;
  localityName: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ComplaintPhoto {
  id: string;
  complaintId: string;
  uploaderId: string;
  photoType: 'resident_initial' | 'cleaner_completion' | 'resident_report' | 'cleaner_after';
  storagePath: string;
  url: string; // Public or signed URL for display
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface ComplaintStatusHistory {
  id: string;
  complaintId: string;
  previousStatus: ComplaintStatus | null;
  newStatus: ComplaintStatus;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  note?: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  trackingCode: string;
  residentId: string;
  residentName: string;
  residentPhone: string;
  address: string;
  localityId: string;
  localityName: string;
  latitude: number;
  longitude: number;
  wasteType: WasteType;
  remark?: string;
  status: ComplaintStatus;
  urgency: UrgencyLevel;
  assignedCleanerId?: string | null;
  assignedCleanerName?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  rejectionReason?: string | null;
  supervisorNote?: string | null;
  supervisorNotes?: string | null;
  residentConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  photos: ComplaintPhoto[];
  history: ComplaintStatusHistory[];
}
