/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGpsCoordinates,
  validatePhotoUpload,
  validateComplaintInput,
  generateTrackingCode,
  validateCleanerAssignment,
  canTransitionStatus,
  checkStorageUploadAuthorization,
  validateCleanerApplicationInput,
  validateCleanerCreationInput,
  validateSupervisorAssignment,
  validateCleanerAccessToComplaint,
  isAdministrator,
  isSupervisorOrAdmin,
  validateCleanerAssignmentPayload,
  formatCleanerServiceAreaRecords,
  resolveCleanerLocalityDisplay,
} from './rules.ts';

test('validateGpsCoordinates rejects null, undefined, out of bounds, and zero island', () => {
  assert.equal(validateGpsCoordinates(null, 72.8).valid, false);
  assert.equal(validateGpsCoordinates(19.0, undefined).valid, false);
  assert.equal(validateGpsCoordinates(91.0, 72.8).valid, false);
  assert.equal(validateGpsCoordinates(-95.0, 72.8).valid, false);
  assert.equal(validateGpsCoordinates(19.0, 185.0).valid, false);
  assert.equal(validateGpsCoordinates(0, 0).valid, false); // null island rejection

  const validResult = validateGpsCoordinates(19.076, 72.8777);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.error, undefined);
});

test('validatePhotoUpload enforces image format and 3MB size ceiling', () => {
  // Missing photo
  assert.equal(validatePhotoUpload({} as any).valid, false);

  // Invalid MIME
  assert.equal(validatePhotoUpload({ mimeType: 'application/pdf', sizeBytes: 1000 }).valid, false);
  assert.equal(validatePhotoUpload({ mimeType: 'image/gif', sizeBytes: 1000 }).valid, false);

  // Oversized photo (> 3MB)
  const oversizedBytes = 3 * 1024 * 1024 + 1024;
  const oversizedResult = validatePhotoUpload({ mimeType: 'image/jpeg', sizeBytes: oversizedBytes });
  assert.equal(oversizedResult.valid, false);
  assert.match(oversizedResult.error || '', /exceeds the maximum allowed size of 3 MB/);

  // Valid photo
  const validResult = validatePhotoUpload({ mimeType: 'image/jpeg', sizeBytes: 1.5 * 1024 * 1024 });
  assert.equal(validResult.valid, true);

  const validPng = validatePhotoUpload({ mimeType: 'image/png', sizeBytes: 2.8 * 1024 * 1024 });
  assert.equal(validPng.valid, true);
});

test('validateComplaintInput enforces all mandatory fields including GPS and photo', () => {
  // Empty input
  const emptyRes = validateComplaintInput({});
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.fullName);
  assert.ok(emptyRes.errors.phoneNumber);
  assert.ok(emptyRes.errors.address);
  assert.ok(emptyRes.errors.localityId);
  assert.ok(emptyRes.errors.gps);
  assert.ok(emptyRes.errors.wasteType);
  assert.ok(emptyRes.errors.photo);

  // Valid complaint
  const validRes = validateComplaintInput({
    fullName: 'Jane Resident',
    phoneNumber: '+1-555-0199',
    address: '42 Elm Street, Block C',
    localityId: 'loc-1',
    latitude: 19.076,
    longitude: 72.877,
    wasteType: 'plastic',
    photo: {
      mimeType: 'image/jpeg',
      sizeBytes: 1024 * 500,
    },
  });
  assert.equal(validRes.valid, true);
  assert.deepEqual(validRes.errors, {});
});

test('generateTrackingCode produces matching WPR-YYMMDD-XXXX format', () => {
  const code = generateTrackingCode();
  assert.match(code, /^WPR-[0-9]{6}-[A-Z0-9]{4}$/);

  const custom = generateTrackingCode(new Date('2026-10-22T00:00:00Z'), 'A7K9');
  assert.equal(custom, 'WPR-261022-A7K9');
});

test('validateCleanerAssignment checks active status and approved service area', () => {
  // Cleaner not active
  const pendingCleaner = {
    id: 'cleaner-1',
    role: 'cleaner' as const,
    accountStatus: 'pending' as const,
    approvedLocalityIds: ['loc-1'],
  };
  assert.equal(validateCleanerAssignment(pendingCleaner, 'loc-1').eligible, false);

  // Cleaner active but locality not approved
  const activeCleaner = {
    id: 'cleaner-2',
    role: 'cleaner' as const,
    accountStatus: 'active' as const,
    approvedLocalityIds: ['loc-1', 'loc-2'],
  };
  assert.equal(validateCleanerAssignment(activeCleaner, 'loc-3').eligible, false);

  // Cleaner active and locality approved
  assert.equal(validateCleanerAssignment(activeCleaner, 'loc-1').eligible, true);
});

test('canTransitionStatus strictly enforces state machine, role authorization, and evidence requirements', () => {
  // Resident trying to verify or approve
  const resAttempt = canTransitionStatus('submitted', 'verified', 'resident', {
    callerId: 'res-1',
    residentId: 'res-1',
  });
  assert.equal(resAttempt.allowed, false);

  // Supervisor verifying submitted complaint
  const supVerify = canTransitionStatus('submitted', 'verified', 'supervisor', {
    callerId: 'sup-1',
  });
  assert.equal(supVerify.allowed, true);

  // Supervisor rejecting without reason
  const supRejectNoReason = canTransitionStatus('submitted', 'rejected', 'supervisor', {
    callerId: 'sup-1',
    rejectionReason: '',
  });
  assert.equal(supRejectNoReason.allowed, false);

  // Supervisor rejecting with clear reason
  const supRejectWithReason = canTransitionStatus('submitted', 'rejected', 'supervisor', {
    callerId: 'sup-1',
    rejectionReason: 'Duplicate complaint already dispatched under ticket WPR-261021-B4Z1.',
  });
  assert.equal(supRejectWithReason.allowed, true);

  // Cleaner trying to start someone else's assigned complaint
  const cleanerWrongUser = canTransitionStatus('assigned', 'in_progress', 'cleaner', {
    callerId: 'cleaner-bob',
    assignedCleanerId: 'cleaner-alice',
  });
  assert.equal(cleanerWrongUser.allowed, false);

  // Assigned cleaner starting work
  const cleanerStart = canTransitionStatus('assigned', 'in_progress', 'cleaner', {
    callerId: 'cleaner-alice',
    assignedCleanerId: 'cleaner-alice',
  });
  assert.equal(cleanerStart.allowed, true);

  // Cleaner submitting completion without after-cleaning photo
  const cleanerNoPhoto = canTransitionStatus('in_progress', 'awaiting_verification', 'cleaner', {
    callerId: 'cleaner-alice',
    assignedCleanerId: 'cleaner-alice',
    hasAfterPhoto: false,
  });
  assert.equal(cleanerNoPhoto.allowed, false);

  // Cleaner submitting completion with after-cleaning photo
  const cleanerWithPhoto = canTransitionStatus('in_progress', 'awaiting_verification', 'cleaner', {
    callerId: 'cleaner-alice',
    assignedCleanerId: 'cleaner-alice',
    hasAfterPhoto: true,
  });
  assert.equal(cleanerWithPhoto.allowed, true);

  // Supervisor approving completion when after photo is verified
  const supApprove = canTransitionStatus('awaiting_verification', 'completed', 'supervisor', {
    callerId: 'sup-1',
    hasAfterPhoto: true,
  });
  assert.equal(supApprove.allowed, true);

  // Supervisor returning inadequate work without explanatory note
  const supReturnNoNote = canTransitionStatus('awaiting_verification', 'in_progress', 'supervisor', {
    callerId: 'sup-1',
    returnNote: '',
  });
  assert.equal(supReturnNoNote.allowed, false);

  // Administrator verifying submitted complaint
  const adminVerify = canTransitionStatus('submitted', 'verified', 'administrator', {
    callerId: 'admin-1',
  });
  assert.equal(adminVerify.allowed, true);

  // Administrator approving completion
  const adminApprove = canTransitionStatus('awaiting_verification', 'completed', 'administrator', {
    callerId: 'admin-1',
    hasAfterPhoto: true,
  });
  assert.equal(adminApprove.allowed, true);
});

test('checkStorageUploadAuthorization strictly validates uploader folder ownership against auth.uid', () => {
  const residentUid = '11111111-2222-3333-4444-555555555555';
  const attackerUid = '99999999-8888-7777-6666-555555555555';

  // 1. Resident uploading to their own residents/{auth.uid}/* path
  const validResidentUpload = checkStorageUploadAuthorization(
    `residents/${residentUid}/c-100-initial.jpg`,
    residentUid,
    'resident'
  );
  assert.equal(validResidentUpload.allowed, true);

  // 2. Attacker attempting to upload to another resident's folder
  const crossResidentUpload = checkStorageUploadAuthorization(
    `residents/${residentUid}/malicious-initial.jpg`,
    attackerUid,
    'resident'
  );
  assert.equal(crossResidentUpload.allowed, false);
  assert.equal(crossResidentUpload.reason, 'Folder owner does not match authenticated user ID.');

  // 3. Cleaner uploading to their own cleaners/{auth.uid}/* path
  const validCleanerUpload = checkStorageUploadAuthorization(
    `cleaners/${residentUid}/c-100-completion.jpg`,
    residentUid,
    'cleaner'
  );
  assert.equal(validCleanerUpload.allowed, true);

  // 4. Resident attempting to upload to another user's cleaner folder
  const crossCleanerUpload = checkStorageUploadAuthorization(
    `cleaners/${residentUid}/fake-completion.jpg`,
    attackerUid,
    'resident'
  );
  assert.equal(crossCleanerUpload.allowed, false);

  // 5. Supervisor or Administrator can upload to any path
  const supervisorUpload = checkStorageUploadAuthorization(
    `residents/${residentUid}/audit-proof.jpg`,
    'sup-uuid',
    'supervisor'
  );
  assert.equal(supervisorUpload.allowed, true);

  const adminUpload = checkStorageUploadAuthorization(
    `residents/${residentUid}/admin-audit.jpg`,
    'admin-uuid',
    'admin'
  );
  assert.equal(adminUpload.allowed, true);
});

test('Cleaner self-registration input validation (Path A) enforces all required fields and locality bounds', () => {
  // Empty input
  const emptyRes = validateCleanerApplicationInput({});
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.email);
  assert.ok(emptyRes.errors.fullName);
  assert.ok(emptyRes.errors.phoneNumber);
  assert.ok(emptyRes.errors.password);
  assert.ok(emptyRes.errors.preferredLocalityIds);

  // Short password (< 8 chars)
  const shortPwRes = validateCleanerApplicationInput({
    email: 'cleaner@example.com',
    fullName: 'Cleaner Joe',
    phoneNumber: '+1-555-0123',
    password: 'short',
    preferredLocalityIds: ['loc-1'],
  });
  assert.equal(shortPwRes.valid, false);
  assert.match(shortPwRes.errors.password, /at least 8 characters/);

  // Valid self-registration input
  const validRes = validateCleanerApplicationInput({
    email: 'cleaner.joe@example.com',
    fullName: 'Cleaner Joe',
    phoneNumber: '+1-555-0123',
    password: 'SecurePassword123!',
    preferredLocalityIds: ['loc-1', 'loc-2'],
  });
  assert.equal(validRes.valid, true);
  assert.deepEqual(validRes.errors, {});
});

test('Administrator-created Cleaner account validation (Path B) verifies all administrative parameters', () => {
  // Missing required parameters
  const invalidAdminRes = validateCleanerCreationInput({
    fullName: 'A',
    phoneNumber: '123',
    email: 'invalid-email',
    password: '123',
    localityIds: [],
  });
  assert.equal(invalidAdminRes.valid, false);
  assert.ok(invalidAdminRes.errors.fullName);
  assert.ok(invalidAdminRes.errors.phoneNumber);
  assert.ok(invalidAdminRes.errors.email);
  assert.ok(invalidAdminRes.errors.password);
  assert.ok(invalidAdminRes.errors.localityIds);

  // Valid direct creation
  const validAdminRes = validateCleanerCreationInput({
    fullName: 'Carlos Mendoza',
    phoneNumber: '+1-555-0198',
    email: 'carlos.m@civicwaste.org',
    password: 'InitialPassword89#',
    supervisorId: 'sup-1',
    localityIds: ['loc-1'],
    accountStatus: 'active',
  });
  assert.equal(validAdminRes.valid, true);
});

test('Supervisor assignment rejects invalid, non-supervisor, or inactive supervisors', () => {
  // Missing supervisor
  assert.equal(validateSupervisorAssignment(null).valid, false);
  assert.equal(validateSupervisorAssignment(undefined).valid, false);

  // Assigned user is not a supervisor (e.g. resident or cleaner)
  const residentUser = { id: 'usr-1', role: 'resident', accountStatus: 'active' };
  const roleCheck = validateSupervisorAssignment(residentUser);
  assert.equal(roleCheck.valid, false);
  assert.match(roleCheck.error || '', /is not a supervisor/);

  const cleanerUser = { id: 'usr-2', role: 'cleaner', accountStatus: 'active' };
  assert.equal(validateSupervisorAssignment(cleanerUser).valid, false);

  // Supervisor account is suspended or pending
  const inactiveSup = { id: 'sup-2', role: 'supervisor', accountStatus: 'suspended' };
  const inactiveCheck = validateSupervisorAssignment(inactiveSup);
  assert.equal(inactiveCheck.valid, false);
  assert.match(inactiveCheck.error || '', /inactive or suspended/);

  // Valid active supervisor
  const activeSup = { id: 'sup-1', role: 'supervisor', accountStatus: 'active' };
  const validSupCheck = validateSupervisorAssignment(activeSup);
  assert.equal(validSupCheck.valid, true);
});

test('Cleaner access to own assignments strictly prevents cross-cleaner unauthorized data access', () => {
  const complaintAlice = { assignedCleanerId: 'cleaner-alice' };
  const complaintUnassigned = { assignedCleanerId: null };

  // Cleaner Alice accessing Alice's assignment
  assert.equal(validateCleanerAccessToComplaint('cleaner-alice', complaintAlice).allowed, true);

  // Cleaner Bob attempting to access Alice's assignment (Cross-Cleaner access denial)
  const crossAccess = validateCleanerAccessToComplaint('cleaner-bob', complaintAlice);
  assert.equal(crossAccess.allowed, false);
  assert.match(crossAccess.reason || '', /Cross-cleaner access denied/);

  // Accessing unassigned complaint
  const unassignedAccess = validateCleanerAccessToComplaint('cleaner-alice', complaintUnassigned);
  assert.equal(unassignedAccess.allowed, false);
  assert.match(unassignedAccess.reason || '', /unassigned/);
});

test('Pending cleaner accounts are restricted from operational complaint assignment', () => {
  const pendingCleaner = {
    id: 'cleaner-pending',
    role: 'cleaner' as const,
    accountStatus: 'pending' as const,
    approvedLocalityIds: ['loc-1'],
  };

  // Assignment check must fail for pending cleaner even if locality matches
  const check = validateCleanerAssignment(pendingCleaner, 'loc-1');
  assert.equal(check.eligible, false);
  assert.match(check.reason || '', /active/);
});

test('Role security boundaries enforce that non-administrators cannot perform privileged admin actions', () => {
  assert.equal(isAdministrator('resident'), false);
  assert.equal(isAdministrator('cleaner'), false);
  assert.equal(isAdministrator('supervisor'), false);
  assert.equal(isAdministrator('administrator'), true);
  assert.equal(isAdministrator('admin'), true);

  assert.equal(isSupervisorOrAdmin('resident'), false);
  assert.equal(isSupervisorOrAdmin('cleaner'), false);
  assert.equal(isSupervisorOrAdmin('supervisor'), true);
  assert.equal(isSupervisorOrAdmin('administrator'), true);
  assert.equal(isSupervisorOrAdmin('admin'), true);
});

test('validateCleanerAssignmentPayload enforces valid cleanerId, optional supervisorId, valid localityIds and accountStatus', () => {
  // Missing cleanerId
  const missingIdRes = validateCleanerAssignmentPayload({});
  assert.equal(missingIdRes.valid, false);
  assert.ok(missingIdRes.errors.cleanerId);

  // Invalid supervisorId type
  const badSupRes = validateCleanerAssignmentPayload({
    cleanerId: 'c-1',
    supervisorId: 12345 as any,
  });
  assert.equal(badSupRes.valid, false);
  assert.ok(badSupRes.errors.supervisorId);

  // Invalid localityIds (not array or containing empty items)
  const badLocRes = validateCleanerAssignmentPayload({
    cleanerId: 'c-1',
    localityIds: 'loc-1' as any,
  });
  assert.equal(badLocRes.valid, false);
  assert.ok(badLocRes.errors.localityIds);

  const emptyLocItemRes = validateCleanerAssignmentPayload({
    cleanerId: 'c-1',
    localityIds: ['loc-1', '  ', 'loc-2'],
  });
  assert.equal(emptyLocItemRes.valid, false);
  assert.ok(emptyLocItemRes.errors.localityIds);

  // Invalid account status
  const badStatusRes = validateCleanerAssignmentPayload({
    cleanerId: 'c-1',
    accountStatus: 'banned',
  });
  assert.equal(badStatusRes.valid, false);
  assert.ok(badStatusRes.errors.accountStatus);

  // Valid assignment payload
  const validRes = validateCleanerAssignmentPayload({
    cleanerId: 'c-100',
    supervisorId: 'sup-50',
    localityIds: ['loc-1', 'loc-2'],
    accountStatus: 'active',
  });
  assert.equal(validRes.valid, true);
  assert.deepEqual(validRes.errors, {});
});

test('formatCleanerServiceAreaRecords formats exact database columns and sets approval fields consistently', () => {
  const ts = '2026-10-22T10:00:00.000Z';
  const records = formatCleanerServiceAreaRecords({
    cleanerId: 'c-101',
    localityIds: ['loc-north', 'loc-south', 'loc-north'], // duplicates must be deduplicated
    isApproved: true,
    approvedBy: 'admin-uuid-1',
    timestamp: ts,
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    cleaner_id: 'c-101',
    locality_id: 'loc-north',
    is_approved: true,
    approved_by: 'admin-uuid-1',
    approved_at: ts,
    created_at: ts,
  });
  assert.deepEqual(records[1], {
    cleaner_id: 'c-101',
    locality_id: 'loc-south',
    is_approved: true,
    approved_by: 'admin-uuid-1',
    approved_at: ts,
    created_at: ts,
  });

  // Pending self-selection without approval
  const pendingRecords = formatCleanerServiceAreaRecords({
    cleanerId: 'c-102',
    localityIds: ['loc-east'],
    isApproved: false,
    timestamp: ts,
  });
  assert.equal(pendingRecords.length, 1);
  assert.equal(pendingRecords[0].is_approved, false);
  assert.equal(pendingRecords[0].approved_by, null);
  assert.equal(pendingRecords[0].approved_at, null);
});

test('resolveCleanerLocalityDisplay falls back gracefully to master localities list when name is unpopulated', () => {
  const masterLocalities = [
    { id: 'loc-1', name: 'North Ward - Sector 1' },
    { id: 'loc-2', name: 'South Ward - Sector 4' },
    { id: 'loc-3', name: 'Central Market Square' },
  ];

  // Already populated name
  const resolvedDirect = resolveCleanerLocalityDisplay(
    { localityId: 'loc-1', localityName: 'North Ward - Sector 1' },
    masterLocalities
  );
  assert.equal(resolvedDirect, 'North Ward - Sector 1');

  // Generic placeholder 'Locality' -> must resolve via master list
  const resolvedPlaceholder = resolveCleanerLocalityDisplay(
    { localityId: 'loc-2', localityName: 'Locality' },
    masterLocalities
  );
  assert.equal(resolvedPlaceholder, 'South Ward - Sector 4');

  // Missing or null localityName -> must resolve via master list
  const resolvedMissing = resolveCleanerLocalityDisplay(
    { localityId: 'loc-3', localityName: null },
    masterLocalities
  );
  assert.equal(resolvedMissing, 'Central Market Square');

  // Unknown locality ID -> falls back safely to 'Locality'
  const resolvedUnknown = resolveCleanerLocalityDisplay(
    { localityId: 'loc-unknown', localityName: null },
    masterLocalities
  );
  assert.equal(resolvedUnknown, 'Locality');
});

test('Cleaner dashboard data loading correctly maps assigned supervisor and service localities', () => {
  // Simulates loading cleaner state with resolved supervisor and service areas
  const testCleanerProfile = {
    id: 'c-200',
    fullName: 'Ravi Kumar',
    email: 'ravi.k@civicpickup.org',
    role: 'cleaner',
    supervisorId: 'sup-900',
    supervisorName: 'Priya Sharma (Zonal Lead)',
  };

  const rawDbServiceAreas = [
    { cleanerId: 'c-200', localityId: 'loc-1', localityName: null, isApproved: true },
    { cleanerId: 'c-200', localityId: 'loc-2', localityName: '', isApproved: true },
    { cleanerId: 'c-200', localityId: 'loc-3', localityName: 'Locality', isApproved: false },
  ];

  const localities = [
    { id: 'loc-1', name: 'North Ward - Sector 1' },
    { id: 'loc-2', name: 'South Ward - Sector 4' },
    { id: 'loc-3', name: 'Central Market Square' },
  ];

  const mappedAreas = rawDbServiceAreas.map((sa) => ({
    ...sa,
    localityName: resolveCleanerLocalityDisplay(sa, localities),
  }));

  assert.equal(testCleanerProfile.supervisorName, 'Priya Sharma (Zonal Lead)');
  assert.equal(mappedAreas[0].localityName, 'North Ward - Sector 1');
  assert.equal(mappedAreas[1].localityName, 'South Ward - Sector 4');
  assert.equal(mappedAreas[2].localityName, 'Central Market Square');
  assert.equal(mappedAreas.filter((a) => a.isApproved).length, 2);
});




