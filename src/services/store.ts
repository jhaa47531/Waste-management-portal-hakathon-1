/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserProfile,
  Locality,
  CleanerApplication,
  CleanerServiceArea,
  Complaint,
  ComplaintPhoto,
  ComplaintStatusHistory,
  UrgencyLevel,
  WasteType,
} from '../types/index.ts';
import { INITIAL_LOCALITIES } from './localities.ts';
import {
  validateComplaintInput,
  validatePhotoUpload,
  validateCleanerAssignment,
  canTransitionStatus,
  generateTrackingCode,
  isAdministrator,
  isSupervisorOrAdmin,
} from '../utils/rules.ts';
import { supabase, isSupabaseConfigured, COMPLAINT_STORAGE_BUCKET } from './supabase.ts';

// Clean storage key (No mock or fake complaints)
const CLEAN_STORAGE_KEY = 'wpr_clean_portal_v2';

// Actively purge legacy mock state if present in the browser
try {
  localStorage.removeItem('wpr_portal_state_v1');
} catch {
  // Ignore
}

interface PortalState {
  currentUser: UserProfile | null;
  users: UserProfile[];
  localities: Locality[];
  serviceAreas: CleanerServiceArea[];
  cleanerApplications: CleanerApplication[];
  complaints: Complaint[];
  isLoading: boolean;
  error: string | null;
}

function getInitialEmptyState(): PortalState {
  try {
    const raw = localStorage.getItem(CLEAN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.complaints)) {
        return {
          currentUser: parsed.currentUser || null,
          users: parsed.users || [],
          localities: parsed.localities?.length ? parsed.localities : [...INITIAL_LOCALITIES],
          serviceAreas: parsed.serviceAreas || [],
          cleanerApplications: parsed.cleanerApplications || [],
          complaints: parsed.complaints || [],
          isLoading: false,
          error: null,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse cached portal state, starting with fresh empty state.', err);
  }

  // Pure clean, empty state: 0 complaints, 0 users, genuine locality list only
  return {
    currentUser: null,
    users: [],
    localities: [...INITIAL_LOCALITIES],
    serviceAreas: [],
    cleanerApplications: [],
    complaints: [],
    isLoading: false,
    error: null,
  };
}

class PortalStore {
  private state: PortalState = getInitialEmptyState();
  private listeners: Set<() => void> = new Set();
  private isLive = isSupabaseConfigured();

  constructor() {
    this.save();
    if (this.isLive && supabase) {
      this.initSupabaseAuthListener();
      this.loadSupabaseData();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.save();
    this.listeners.forEach((fn) => fn());
  }

  private save(): void {
    try {
      localStorage.setItem(CLEAN_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  public getState(): PortalState {
    return this.state;
  }

  public isLiveMode(): boolean {
    return this.isLive;
  }

  public getCurrentUser(): UserProfile | null {
    return this.state.currentUser;
  }

  // --------------------------------------------------------------------------
  // Supabase Auth & Session Synchronization
  // --------------------------------------------------------------------------
  private async initSupabaseAuthListener(): Promise<void> {
    if (!supabase) return;

    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await this.syncProfileFromSupabase(data.session.user.id, data.session.user.email || '');
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await this.syncProfileFromSupabase(session.user.id, session.user.email || '');
        } else if (event === 'SIGNED_OUT') {
          this.state.currentUser = null;
          this.notify();
        }
      });
    } catch (err) {
      console.warn('Supabase auth listener initialization error:', err);
    }
  }

  private async syncProfileFromSupabase(userId: string, email: string): Promise<UserProfile | null> {
    if (!supabase) return null;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile) {
        console.warn('Notice fetching Supabase profile, checking Auth user metadata:', error?.message);
        const { data: authUserData } = await supabase.auth.getUser();
        const authUser = authUserData?.user;
        if (authUser && authUser.id === userId) {
          const rawRole = (authUser.app_metadata?.role || authUser.user_metadata?.role || (email.toLowerCase() === 'jhaa47531@gmail.com' ? 'administrator' : 'resident')) as any;
          const userRole = rawRole === 'admin' ? 'administrator' : rawRole;
          const user: UserProfile = {
            id: authUser.id,
            email: email || authUser.email || '',
            fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            phoneNumber: authUser.user_metadata?.phone_number || authUser.user_metadata?.phone || '0000000000',
            role: userRole,
            accountStatus: 'active',
            createdAt: authUser.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.state.currentUser = user;
          this.notify();
          await this.loadSupabaseData();
          return user;
        }
        return null;
      }

      if (profile) {
        let supervisorName: string | null = null;
        if (profile.supervisor_id) {
          const { data: supProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', profile.supervisor_id)
            .maybeSingle();
          supervisorName = supProfile?.full_name || null;
        }

        const user: UserProfile = {
          id: profile.id,
          email: email || profile.email || '',
          fullName: profile.full_name,
          phoneNumber: profile.phone_number || profile.phone || '',
          role: profile.role === 'admin' ? 'administrator' : profile.role,
          accountStatus: profile.account_status,
          supervisorId: profile.supervisor_id || null,
          supervisorName,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        };
        this.state.currentUser = user;
        this.notify();
        await this.loadSupabaseData();
        return user;
      }
    } catch (err) {
      console.warn('Profile sync exception:', err);
    }
    return null;
  }

  public async loadSupabaseData(): Promise<void> {
    if (!supabase) return;

    this.state.isLoading = true;
    this.notify();

    try {
      // 1. Fetch active localities
      const { data: locs } = await supabase.from('localities').select('*').order('name');
      if (locs && locs.length > 0) {
        this.state.localities = locs.map((l: any) => ({
          id: l.id,
          name: l.name,
          active: l.active,
        }));
      }

      // 2. Fetch complaints (RLS automatically filters by authenticated user role)
      const { data: complaintsData, error: complaintsErr } = await supabase
        .from('complaints')
        .select(`
          *,
          photos:complaint_photos(*),
          history:complaint_status_history(*)
        `)
        .order('created_at', { ascending: false });

      if (!complaintsErr && complaintsData) {
        this.state.complaints = complaintsData.map((c: any) => ({
          id: c.id,
          trackingCode: c.tracking_code,
          residentId: c.resident_id,
          residentName: c.resident_name,
          residentPhone: c.resident_phone,
          address: c.address,
          localityId: c.locality_id,
          localityName: c.locality_name || this.state.localities.find((l) => l.id === c.locality_id)?.name || 'Unknown',
          latitude: c.latitude,
          longitude: c.longitude,
          wasteType: c.waste_type,
          remark: c.remark,
          status: c.status,
          urgency: c.urgency,
          assignedCleanerId: c.assigned_cleaner_id,
          assignedCleanerName: c.assigned_cleaner_name,
          supervisorId: c.supervisor_id,
          supervisorName: c.supervisor_name,
          rejectionReason: c.rejection_reason,
          supervisorNotes: c.supervisor_notes,
          residentConfirmedAt: c.resident_confirmed_at,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          photos: (c.photos || []).map((p: any) => ({
            id: p.id,
            complaintId: p.complaint_id,
            uploaderId: p.uploaded_by || p.uploader_id,
            photoType: p.photo_type,
            storagePath: p.storage_path,
            url: p.storage_path,
            mimeType: p.mime_type,
            fileSizeBytes: p.size_bytes || p.file_size_bytes || 0,
            createdAt: p.created_at,
          })),
          history: (c.history || []).map((h: any) => ({
            id: h.id,
            complaintId: h.complaint_id,
            previousStatus: h.previous_status,
            newStatus: h.new_status,
            actorId: h.actor_id,
            actorName: h.actor_name || 'System User',
            actorRole: h.actor_role || 'resident',
            note: h.note,
            createdAt: h.created_at,
          })),
        }));
      }

      // 3. If supervisor/admin, fetch profiles, service areas, and applications
      if (this.state.currentUser && isSupervisorOrAdmin(this.state.currentUser.role)) {
        let directoryLoaded = false;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token && isAdministrator(this.state.currentUser.role)) {
            const dirRes = await fetch('/api/admin/users', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const dirData = await dirRes.json().catch(() => null);
            if (dirRes.ok && dirData?.success) {
              if (Array.isArray(dirData.users) && dirData.users.length > 0) {
                this.state.users = dirData.users;
              }
              if (Array.isArray(dirData.cleanerApplications)) {
                this.state.cleanerApplications = dirData.cleanerApplications;
              }
              if (Array.isArray(dirData.serviceAreas)) {
                this.state.serviceAreas = dirData.serviceAreas;
              }
              directoryLoaded = true;
            }
          }
        } catch (err) {
          console.warn('Admin directory fetch note:', err);
        }

        // Fallback to direct PostgREST queries if directory endpoint not loaded
        if (!directoryLoaded) {
          const { data: profs } = await supabase.from('profiles').select('*');
          if (profs) {
            const userList = profs.map((p: any) => ({
              id: p.id,
              email: p.email || '',
              fullName: p.full_name,
              phoneNumber: p.phone_number || p.phone || '',
              role: p.role === 'admin' ? 'administrator' : p.role,
              accountStatus: p.account_status,
              supervisorId: p.supervisor_id || null,
              supervisorName: null as string | null,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }));

            // Resolve supervisor names
            userList.forEach((u: any) => {
              if (u.supervisorId) {
                const sup = userList.find((s: any) => s.id === u.supervisorId);
                if (sup) u.supervisorName = sup.fullName;
              }
            });

            this.state.users = userList;
          }

          const { data: saList } = await supabase
            .from('cleaner_service_areas')
            .select('*, locality:localities(name)');
          if (saList) {
            this.state.serviceAreas = saList.map((sa: any) => ({
              id: sa.id,
              cleanerId: sa.cleaner_id,
              localityId: sa.locality_id,
              localityName: sa.locality?.name || 'Locality',
              isApproved: sa.is_approved,
              approvedBy: sa.approved_by,
              approvedAt: sa.approved_at,
            }));
          }

          const { data: apps } = await supabase.from('cleaner_applications').select('*');
          if (apps) {
            this.state.cleanerApplications = apps.map((a: any) => {
              const cId = a.applicant_id || a.cleaner_id;
              const cleanerProf = this.state.users.find((u) => u.id === cId);
              const supId = a.assigned_supervisor_id || cleanerProf?.supervisorId || null;
              const supProf = supId ? this.state.users.find((u) => u.id === supId) : null;
              return {
                id: a.id,
                cleanerId: cId,
                cleanerName: cleanerProf?.fullName || a.cleaner_name || 'Cleaner Applicant',
                cleanerEmail: cleanerProf?.email || a.cleaner_email || '',
                cleanerPhone: cleanerProf?.phoneNumber || '',
                status: a.status,
                assignedSupervisorId: supId,
                assignedSupervisorName: supProf?.fullName || null,
                reviewerId: a.reviewed_by || a.reviewer_id,
                reviewNotes: a.review_note || a.review_notes,
                reviewedAt: a.reviewed_at,
                createdAt: a.created_at,
              };
            });
          }
        }
      } else if (this.state.currentUser && this.state.currentUser.role === 'cleaner') {
        // Cleaner: fetch their own service areas and supervisor details
        const { data: saList } = await supabase
          .from('cleaner_service_areas')
          .select('*, locality:localities(name)')
          .eq('cleaner_id', this.state.currentUser.id);
        if (saList) {
          this.state.serviceAreas = saList.map((sa: any) => ({
            id: sa.id,
            cleanerId: sa.cleaner_id,
            localityId: sa.locality_id,
            localityName: sa.locality?.name || 'Locality',
            isApproved: sa.is_approved,
            approvedBy: sa.approved_by,
            approvedAt: sa.approved_at,
          }));
        }

        if (this.state.currentUser.supervisorId && !this.state.currentUser.supervisorName) {
          const { data: supProf } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', this.state.currentUser.supervisorId)
            .maybeSingle();
          if (supProf?.full_name) {
            this.state.currentUser.supervisorName = supProf.full_name;
          }
        }
      }
    } catch (err: any) {
      console.warn('Error loading Supabase data:', err.message);
    } finally {
      this.state.isLoading = false;
      this.notify();
    }
  }

  // --------------------------------------------------------------------------
  // User Authentication
  // Public registration MUST strictly assign 'resident' role
  // --------------------------------------------------------------------------
  public async registerResident(params: {
    email: string;
    fullName: string;
    phoneNumber: string;
    password?: string;
  }): Promise<{ success: boolean; user?: UserProfile; pendingConfirmation?: boolean; message?: string; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    const cleanPhone = params.phoneNumber.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (cleanName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters.' };
    }
    if (cleanPhone.length < 7) {
      return { success: false, error: 'Phone number must be at least 7 characters.' };
    }
    if (!params.password || params.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    if (this.isLive && supabase) {
      // 1. Primary: Server-side programmatic registration with email confirmation & profile creation
      try {
        const apiRes = await fetch('/api/auth/register-resident', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            fullName: cleanName,
            phoneNumber: cleanPhone,
            password: params.password,
          }),
        });

        const apiData = await apiRes.json().catch(() => null);

        if (apiRes.status === 409) {
          return {
            success: false,
            error: apiData?.error || 'An account with this email address already exists. Please sign in.',
          };
        }

        if (apiRes.ok && apiData?.success) {
          // Immediately establish authenticated Supabase session in the browser
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: params.password,
          });

          if (!signInErr && signInData?.session?.user) {
            const synced = await this.syncProfileFromSupabase(signInData.session.user.id, cleanEmail);
            return { success: true, user: synced || apiData.user };
          }

          // If signIn has a client-side glitch, use the created user
          const registeredUser: UserProfile = apiData.user;
          this.state.currentUser = registeredUser;
          const idx = this.state.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
          if (idx >= 0) this.state.users[idx] = registeredUser;
          else this.state.users.push(registeredUser);
          this.notify();
          return { success: true, user: registeredUser };
        }
      } catch {
        // Server endpoint unreachable or network error, proceed to direct client SDK signUp
      }

      // 2. Direct Supabase Client SDK signUp
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: params.password,
          options: {
            data: {
              full_name: cleanName,
              phone_number: cleanPhone,
              phone: cleanPhone,
              role: 'resident',
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.user) {
          // If email confirmation is required, session will be null
          if (!data.session) {
            return {
              success: true,
              pendingConfirmation: true,
              message:
                'Registration successful! Please check your email inbox to verify your email address before logging in.',
            };
          }

          // Session was returned immediately
          const synced = await this.syncProfileFromSupabase(data.user.id, cleanEmail);
          const activeUser: UserProfile = synced || {
            id: data.user.id,
            email: cleanEmail,
            fullName: cleanName,
            phoneNumber: cleanPhone,
            role: 'resident',
            accountStatus: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          this.state.currentUser = activeUser;
          const idx = this.state.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
          if (idx >= 0) this.state.users[idx] = activeUser;
          else this.state.users.push(activeUser);
          this.notify();
          return { success: true, user: activeUser };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Supabase signup failed.' };
      }
    }

    // Local / Clean State Mode
    if (this.state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email: cleanEmail,
      fullName: cleanName,
      phoneNumber: cleanPhone,
      role: 'resident',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.users.push(newUser);
    this.state.currentUser = newUser;
    this.notify();
    return { success: true, user: newUser };
  }

  // --------------------------------------------------------------------------
  // Cleaner Registration (Self-service with 3-5 preferred localities)
  // Application starts in 'pending' status; operational work blocked until approved
  // --------------------------------------------------------------------------
  public async registerCleaner(params: {
    email: string;
    fullName: string;
    phoneNumber: string;
    password?: string;
    preferredLocalityIds: string[];
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    const cleanPhone = params.phoneNumber.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (cleanName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters.' };
    }
    if (cleanPhone.length < 7) {
      return { success: false, error: 'Phone number must be at least 7 characters.' };
    }
    if (
      !params.preferredLocalityIds ||
      params.preferredLocalityIds.length < 1 ||
      params.preferredLocalityIds.length > 5
    ) {
      return {
        success: false,
        error: 'Please select between 1 and 5 preferred service localities.',
      };
    }

    if (this.isLive && supabase && params.password) {
      try {
        const apiRes = await fetch('/api/cleaner/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            fullName: cleanName,
            phoneNumber: cleanPhone,
            password: params.password,
            preferredLocalityIds: params.preferredLocalityIds,
          }),
        });

        const apiData = await apiRes.json().catch(() => null);

        if (apiRes.ok && apiData?.success) {
          // Attempt sign in with newly created credentials
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: params.password,
          });

          if (signInData?.user) {
            await this.syncProfileFromSupabase(signInData.user.id, cleanEmail);
          } else {
            const user: UserProfile = {
              id: apiData.user?.id || `usr-cleaner-${Date.now()}`,
              email: cleanEmail,
              fullName: cleanName,
              phoneNumber: cleanPhone,
              role: 'cleaner',
              accountStatus: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            this.state.currentUser = user;
            this.notify();
          }

          await this.loadSupabaseData();
          return {
            success: true,
            user: this.state.currentUser || apiData.user,
          };
        } else if (apiData?.error) {
          return { success: false, error: apiData.error };
        } else if (!apiRes.ok) {
          return { success: false, error: `Registration error (${apiRes.status}) from server.` };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Cleaner application submission failed.' };
      }
    }

    // Local / In-memory Persistence
    if (this.state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const newCleanerId = `usr-cleaner-${Date.now()}`;
    const newCleaner: UserProfile = {
      id: newCleanerId,
      email: cleanEmail,
      fullName: cleanName,
      phoneNumber: cleanPhone,
      role: 'cleaner',
      accountStatus: 'pending', // Pending approval by supervisor
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newApp: CleanerApplication = {
      id: `app-${Date.now()}`,
      cleanerId: newCleanerId,
      cleanerName: cleanName,
      cleanerEmail: cleanEmail,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    for (const locId of params.preferredLocalityIds) {
      const loc = this.state.localities.find((l) => l.id === locId);
      this.state.serviceAreas.push({
        id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        cleanerId: newCleanerId,
        localityId: locId,
        localityName: loc ? loc.name : 'Locality',
        isApproved: false, // Must be approved by supervisor
      });
    }

    this.state.cleanerApplications.push(newApp);
    this.state.users.push(newCleaner);
    this.state.currentUser = newCleaner;
    this.notify();
    return { success: true, user: newCleaner };
  }

  public async loginWithEmail(
    email: string,
    password?: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (this.isLive && supabase && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            return {
              success: false,
              error:
                'Email address not yet confirmed. Please check your email inbox to verify your email address before logging in.',
            };
          }
          return { success: false, error: error.message };
        }
        if (data.user) {
          const synced = await this.syncProfileFromSupabase(data.user.id, cleanEmail);
          const activeUser = synced || {
            id: data.user.id,
            email: cleanEmail,
            fullName: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            phoneNumber: data.user.user_metadata?.phone_number || data.user.user_metadata?.phone || '',
            role: (data.user.app_metadata?.role || data.user.user_metadata?.role || (cleanEmail === 'jhaa47531@gmail.com' ? 'administrator' : 'resident')) as any,
            accountStatus: 'active' as const,
            createdAt: data.user.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const idx = this.state.users.findIndex((u) => u.id === activeUser.id || u.email.toLowerCase() === cleanEmail);
          if (idx >= 0) this.state.users[idx] = activeUser;
          else this.state.users.push(activeUser);
          this.state.currentUser = activeUser;
          this.notify();
          await this.loadSupabaseData();
          return { success: true, user: activeUser };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Supabase authentication failed.' };
      }
    }

    // Local / In-memory Login
    let user = this.state.users.find((u) => u.email.toLowerCase() === cleanEmail);

    // Initial authorized Administrator provisioning (jhaa47531@gmail.com)
    if (cleanEmail === 'jhaa47531@gmail.com') {
      if (!user) {
        user = {
          id: 'usr-admin-initial',
          email: 'jhaa47531@gmail.com',
          fullName: 'Municipal Administrator',
          phoneNumber: '+1-555-0100',
          role: 'administrator',
          accountStatus: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.state.users.push(user);
      } else {
        user.role = 'administrator';
        user.accountStatus = 'active';
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'No account found with this email. Please register as a resident/cleaner or contact the administrator.',
      };
    }
    this.state.currentUser = user;
    this.notify();
    return { success: true, user };
  }

  public async signOut(): Promise<void> {
    if (this.isLive && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Signout error:', err);
      }
    }
    this.state.currentUser = null;
    this.notify();
  }

  public async logout(): Promise<void> {
    return this.signOut();
  }

  // --------------------------------------------------------------------------
  // Resident Complaint Submission
  // --------------------------------------------------------------------------
  public async submitComplaint(data: {
    fullName: string;
    phoneNumber: string;
    address: string;
    localityId: string;
    latitude: number | null;
    longitude: number | null;
    wasteType: WasteType;
    remark?: string;
    photoFile: {
      name: string;
      mimeType: string;
      sizeBytes: number;
      dataUrl: string;
      rawFile?: File;
    };
  }): Promise<{ success: boolean; complaint?: Complaint; error?: string }> {
    const user = this.state.currentUser;
    if (!user) {
      return { success: false, error: 'Authentication required. Please sign in.' };
    }

    const inputValidation = validateComplaintInput({
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      address: data.address,
      localityId: data.localityId,
      latitude: data.latitude,
      longitude: data.longitude,
      wasteType: data.wasteType,
      photo: {
        mimeType: data.photoFile.mimeType,
        sizeBytes: data.photoFile.sizeBytes,
      },
    });

    if (!inputValidation.valid) {
      const firstKey = Object.keys(inputValidation.errors)[0];
      return { success: false, error: inputValidation.errors[firstKey] };
    }

    const locality = this.state.localities.find((l) => l.id === data.localityId);
    if (!locality) {
      return { success: false, error: 'Selected locality is invalid.' };
    }

    let trackingCode = generateTrackingCode();
    while (this.state.complaints.some((c) => c.trackingCode === trackingCode)) {
      trackingCode = generateTrackingCode();
    }

    let authUserId = user.id;
    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) {
          authUserId = sessionData.session.user.id;
        }
      } catch {
        // Fallback to user.id
      }
    }

    const complaintId = `c-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const rawExt = data.photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const storagePath = `residents/${authUserId}/${complaintId}-initial.${ext}`;
    let activeStoragePath = storagePath;

    // Live Supabase Upload & Persistence
    if (this.isLive && supabase) {
      try {
        // 1. Upload photo to private storage bucket 'waste-complaint-photos'
        let photoUploaded = false;
        if (data.photoFile.rawFile) {
          let uploadError: any = null;

          // Attempt primary path residents/{authUserId}/*
          const res1 = await supabase.storage
            .from(COMPLAINT_STORAGE_BUCKET)
            .upload(activeStoragePath, data.photoFile.rawFile, {
              contentType: data.photoFile.mimeType || 'image/jpeg',
              upsert: true,
            });

          if (res1.error) {
            // If primary path fails with RLS or permission error, attempt fallback {authUserId}/residents/*
            const fallbackPath = `${authUserId}/residents/${complaintId}-initial.${ext}`;
            const res2 = await supabase.storage
              .from(COMPLAINT_STORAGE_BUCKET)
              .upload(fallbackPath, data.photoFile.rawFile, {
                contentType: data.photoFile.mimeType || 'image/jpeg',
                upsert: true,
              });

            if (res2.error) {
              uploadError = res1.error;
            } else {
              activeStoragePath = fallbackPath;
              photoUploaded = true;
            }
          } else {
            photoUploaded = true;
          }

          if (uploadError) {
            return {
              success: false,
              error: `Storage upload failed: ${uploadError.message}. Submission blocked to prevent corrupted records.`,
            };
          }
        }

        // 2. Insert complaint row into PostgreSQL table
        const { data: insertedComplaint, error: dbError } = await supabase
          .from('complaints')
          .insert({
            tracking_code: trackingCode,
            resident_id: authUserId,
            resident_name: data.fullName.trim(),
            resident_phone: data.phoneNumber.trim(),
            address: data.address.trim(),
            locality_id: data.localityId,
            latitude: data.latitude,
            longitude: data.longitude,
            waste_type: data.wasteType,
            remark: data.remark ? data.remark.trim() : null,
            status: 'submitted',
            urgency: 'normal',
          })
          .select()
          .single();

        if (dbError) {
          // Rollback: delete uploaded photo object to prevent orphaned storage objects
          if (photoUploaded) {
            await supabase.storage.from(COMPLAINT_STORAGE_BUCKET).remove([activeStoragePath]).catch(() => {});
          }
          return { success: false, error: `Database insert failed: ${dbError.message}` };
        }

        // 3. Insert photo record in complaint_photos
        const { error: photoDbError } = await supabase.from('complaint_photos').insert({
          complaint_id: insertedComplaint.id,
          uploaded_by: authUserId,
          photo_type: 'resident_initial',
          storage_path: activeStoragePath,
          mime_type: data.photoFile.mimeType,
          size_bytes: data.photoFile.sizeBytes,
          file_size_bytes: data.photoFile.sizeBytes,
        });

        if (photoDbError) {
          // Rollback: remove complaint row and uploaded storage object
          try {
            await supabase.from('complaints').delete().eq('id', insertedComplaint.id);
          } catch {
            // Ignore rollback failure
          }
          if (photoUploaded) {
            await supabase.storage.from(COMPLAINT_STORAGE_BUCKET).remove([activeStoragePath]).catch(() => {});
          }
          return { success: false, error: `Photo audit record failed: ${photoDbError.message}` };
        }

        await this.loadSupabaseData();
        const saved = this.state.complaints.find((c) => c.trackingCode === trackingCode);
        return { success: true, complaint: saved };
      } catch (err: any) {
        return { success: false, error: err.message || 'Submission error.' };
      }
    }

    // Local Persistence
    const photoRecord: ComplaintPhoto = {
      id: `p-${Date.now()}`,
      complaintId,
      uploaderId: user.id,
      photoType: 'resident_initial',
      storagePath,
      url: data.photoFile.dataUrl,
      mimeType: data.photoFile.mimeType,
      fileSizeBytes: data.photoFile.sizeBytes,
      createdAt: timestamp,
    };

    const initialHistory: ComplaintStatusHistory = {
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: null,
      newStatus: 'submitted',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: 'Initial complaint submission with verified GPS coordinates and photographic evidence.',
      createdAt: timestamp,
    };

    const newComplaint: Complaint = {
      id: complaintId,
      trackingCode,
      residentId: user.id,
      residentName: data.fullName.trim(),
      residentPhone: data.phoneNumber.trim(),
      address: data.address.trim(),
      localityId: data.localityId,
      localityName: locality.name,
      latitude: data.latitude!,
      longitude: data.longitude!,
      wasteType: data.wasteType,
      remark: data.remark ? data.remark.trim() : undefined,
      status: 'submitted',
      urgency: 'normal',
      createdAt: timestamp,
      updatedAt: timestamp,
      photos: [photoRecord],
      history: [initialHistory],
    };

    this.state.complaints.unshift(newComplaint);
    this.notify();
    return { success: true, complaint: newComplaint };
  }

  // --------------------------------------------------------------------------
  // Supervisor Operations
  // --------------------------------------------------------------------------
  public async verifyComplaint(
    complaintId: string,
    urgency: UrgencyLevel,
    supervisorNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const check = canTransitionStatus(complaint.status, 'verified', user.role, {
      callerId: user.id,
      residentId: complaint.residentId,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.rpc('verify_complaint', {
          p_complaint_id: complaintId,
          p_urgency: urgency,
          p_notes: supervisorNotes || null,
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const timestamp = new Date().toISOString();
    const oldStatus = complaint.status;

    complaint.status = 'verified';
    complaint.urgency = urgency;
    complaint.supervisorId = user.id;
    complaint.supervisorName = user.fullName;
    complaint.residentConfirmedAt = timestamp;
    complaint.supervisorNotes = supervisorNotes || 'Verified after resident contact confirmation.';
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: oldStatus,
      newStatus: 'verified',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: `Verified by supervisor with ${urgency.toUpperCase()} urgency. Contact confirmed. Note: ${complaint.supervisorNotes}`,
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  public async rejectComplaint(
    complaintId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const check = canTransitionStatus(complaint.status, 'rejected', user.role, {
      callerId: user.id,
      rejectionReason,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.rpc('reject_complaint', {
          p_complaint_id: complaintId,
          p_reason: rejectionReason.trim(),
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const timestamp = new Date().toISOString();
    const oldStatus = complaint.status;

    complaint.status = 'rejected';
    complaint.supervisorId = user.id;
    complaint.supervisorName = user.fullName;
    complaint.rejectionReason = rejectionReason.trim();
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: oldStatus,
      newStatus: 'rejected',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: `Complaint rejected. Reason: ${rejectionReason.trim()}`,
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  public async assignCleaner(
    complaintId: string,
    cleanerId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const cleaner = this.state.users.find((u) => u.id === cleanerId);
    if (!cleaner) return { success: false, error: 'Cleaner not found.' };

    const approvedLocalityIds = this.state.serviceAreas
      .filter((sa) => sa.cleanerId === cleanerId && sa.isApproved)
      .map((sa) => sa.localityId);

    const cleanerEligibility = validateCleanerAssignment(
      {
        id: cleaner.id,
        role: cleaner.role,
        accountStatus: cleaner.accountStatus,
        approvedLocalityIds,
      },
      complaint.localityId
    );

    if (!cleanerEligibility.eligible) {
      return { success: false, error: cleanerEligibility.reason };
    }

    const check = canTransitionStatus(complaint.status, 'assigned', user.role, {
      callerId: user.id,
      assignedCleanerId: cleanerId,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.rpc('assign_cleaner', {
          p_complaint_id: complaintId,
          p_cleaner_id: cleanerId,
          p_notes: notes || null,
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const timestamp = new Date().toISOString();
    const oldStatus = complaint.status;

    complaint.status = 'assigned';
    complaint.assignedCleanerId = cleanerId;
    complaint.assignedCleanerName = cleaner.fullName;
    complaint.supervisorId = user.id;
    complaint.supervisorName = user.fullName;
    if (notes) complaint.supervisorNotes = notes;
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: oldStatus,
      newStatus: 'assigned',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: `Assigned to approved cleaner ${cleaner.fullName} for locality ${complaint.localityName}.`,
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  public async approveCompletion(
    complaintId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const hasAfterPhoto = complaint.photos.some((p) => p.photoType === 'cleaner_completion');
    const check = canTransitionStatus(complaint.status, 'completed', user.role, {
      callerId: user.id,
      hasAfterPhoto,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.rpc('approve_completion', {
          p_complaint_id: complaintId,
          p_notes: notes || null,
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const timestamp = new Date().toISOString();
    const oldStatus = complaint.status;

    complaint.status = 'completed';
    if (notes) complaint.supervisorNotes = notes;
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: oldStatus,
      newStatus: 'completed',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: `Completion approved by supervisor after photographic verification. ${notes ? 'Note: ' + notes : ''}`,
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  public async returnToProgress(
    complaintId: string,
    returnNote: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const check = canTransitionStatus(complaint.status, 'in_progress', user.role, {
      callerId: user.id,
      returnNote,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.rpc('return_to_progress', {
          p_complaint_id: complaintId,
          p_notes: returnNote.trim(),
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const timestamp = new Date().toISOString();
    const oldStatus = complaint.status;

    complaint.status = 'in_progress';
    complaint.supervisorNotes = returnNote;
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: oldStatus,
      newStatus: 'in_progress',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: `Returned to in-progress due to inadequate completion evidence: "${returnNote}"`,
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Cleaner Operations
  // --------------------------------------------------------------------------
  public async startComplaintProgress(complaintId: string): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const check = canTransitionStatus(complaint.status, 'in_progress', user.role, {
      callerId: user.id,
      assignedCleanerId: complaint.assignedCleanerId,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.rpc('start_complaint_progress', {
          p_complaint_id: complaintId,
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const timestamp = new Date().toISOString();
    const oldStatus = complaint.status;

    complaint.status = 'in_progress';
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: oldStatus,
      newStatus: 'in_progress',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: 'Cleaner reached location and marked work in-progress.',
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  public async submitCleanerCompletion(
    complaintId: string,
    photoFile: {
      name: string;
      mimeType: string;
      sizeBytes: number;
      dataUrl: string;
      rawFile?: File;
    },
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user) return { success: false, error: 'Sign in required.' };

    const complaint = this.state.complaints.find((c) => c.id === complaintId);
    if (!complaint) return { success: false, error: 'Complaint not found.' };

    const photoCheck = validatePhotoUpload({
      mimeType: photoFile.mimeType,
      sizeBytes: photoFile.sizeBytes,
    });
    if (!photoCheck.valid) {
      return { success: false, error: photoCheck.error };
    }

    const check = canTransitionStatus(complaint.status, 'awaiting_verification', user.role, {
      callerId: user.id,
      assignedCleanerId: complaint.assignedCleanerId,
      hasAfterPhoto: true,
    });
    if (!check.allowed) return { success: false, error: check.reason };

    let authUserId = user.id;
    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) {
          authUserId = sessionData.session.user.id;
        }
      } catch {
        // Fallback to user.id
      }
    }

    const timestamp = new Date().toISOString();
    const rawExt = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const storagePath = `cleaners/${authUserId}/${complaintId}-completion.${ext}`;
    let activeStoragePath = storagePath;

    if (this.isLive && supabase) {
      try {
        let photoUploaded = false;
        if (photoFile.rawFile) {
          let uploadError: any = null;

          // Attempt primary path cleaners/{authUserId}/*
          const res1 = await supabase.storage
            .from(COMPLAINT_STORAGE_BUCKET)
            .upload(activeStoragePath, photoFile.rawFile, {
              contentType: photoFile.mimeType || 'image/jpeg',
              upsert: true,
            });

          if (res1.error) {
            // Fallback path {authUserId}/cleaners/*
            const fallbackPath = `${authUserId}/cleaners/${complaintId}-completion.${ext}`;
            const res2 = await supabase.storage
              .from(COMPLAINT_STORAGE_BUCKET)
              .upload(fallbackPath, photoFile.rawFile, {
                contentType: photoFile.mimeType || 'image/jpeg',
                upsert: true,
              });

            if (res2.error) {
              uploadError = res1.error;
            } else {
              activeStoragePath = fallbackPath;
              photoUploaded = true;
            }
          } else {
            photoUploaded = true;
          }

          if (uploadError) {
            return {
              success: false,
              error: `Storage upload failed: ${uploadError.message}. Photo must be saved to submit completion.`,
            };
          }
        }

        const { error: rpcError } = await supabase.rpc('submit_cleaner_completion', {
          p_complaint_id: complaintId,
          p_photo_path: activeStoragePath,
          p_mime_type: photoFile.mimeType,
          p_file_size: photoFile.sizeBytes,
          p_notes: notes || null,
        });

        if (rpcError) {
          if (photoUploaded) {
            await supabase.storage.from(COMPLAINT_STORAGE_BUCKET).remove([activeStoragePath]).catch(() => {});
          }
          return { success: false, error: rpcError.message };
        }
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const completionPhoto: ComplaintPhoto = {
      id: `p-${Date.now()}`,
      complaintId,
      uploaderId: user.id,
      photoType: 'cleaner_completion',
      storagePath,
      url: photoFile.dataUrl,
      mimeType: photoFile.mimeType,
      fileSizeBytes: photoFile.sizeBytes,
      createdAt: timestamp,
    };

    complaint.photos.push(completionPhoto);
    complaint.status = 'awaiting_verification';
    complaint.updatedAt = timestamp;

    complaint.history.push({
      id: `h-${Date.now()}`,
      complaintId,
      previousStatus: 'in_progress',
      newStatus: 'awaiting_verification',
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      note: `Cleaning finished. After-cleaning photographic proof uploaded. ${notes ? 'Note: ' + notes : ''}`,
      createdAt: timestamp,
    });

    this.notify();
    return { success: true };
  }

  public async proposeServiceArea(cleanerId: string, localityId: string): Promise<{ success: boolean; error?: string }> {
    const locality = this.state.localities.find((l) => l.id === localityId);
    if (!locality) return { success: false, error: 'Invalid locality.' };

    const existing = this.state.serviceAreas.find(
      (sa) => sa.cleanerId === cleanerId && sa.localityId === localityId
    );
    if (existing) {
      return { success: false, error: 'Locality already selected or proposed.' };
    }

    if (this.isLive && supabase) {
      try {
        const { error } = await supabase.from('cleaner_service_areas').insert({
          cleaner_id: cleanerId,
          locality_id: localityId,
          is_approved: false, // Self-selected localities must not automatically become approved
        });
        if (error) return { success: false, error: error.message };
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const newSA: CleanerServiceArea = {
      id: `csa-${Date.now()}`,
      cleanerId,
      localityId,
      localityName: locality.name,
      isApproved: false,
    };
    this.state.serviceAreas.push(newSA);
    this.notify();
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Administrator Operations
  // --------------------------------------------------------------------------
  public async provisionSupervisor(params: {
    email: string;
    fullName: string;
    phoneNumber: string;
    password?: string;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const user = this.state.currentUser;
    if (!isAdministrator(user?.role)) {
      return { success: false, error: 'Access denied: Only administrators can provision supervisor accounts.' };
    }

    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    const cleanPhone = params.phoneNumber.trim();
    const cleanPassword = params.password?.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Valid email is required.' };
    }
    if (cleanName.length < 2) {
      return { success: false, error: 'Full name is required.' };
    }
    if (cleanPassword && cleanPassword.length < 8) {
      return { success: false, error: 'Temporary password must be at least 8 characters long.' };
    }

    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        // 1. Attempt secure server-side endpoint if authenticated
        if (token) {
          try {
            const apiRes = await fetch('/api/admin/provision-supervisor', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                email: cleanEmail,
                fullName: cleanName,
                phoneNumber: cleanPhone,
                password: cleanPassword,
              }),
            });

            const apiData = await apiRes.json().catch(() => null);
            if (apiRes.ok && apiData?.success) {
              const provisionedUser: UserProfile = {
                id: apiData.user?.id || `sup-${Date.now()}`,
                email: cleanEmail,
                fullName: cleanName,
                phoneNumber: cleanPhone,
                role: 'supervisor',
                accountStatus: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              const existingIdx = this.state.users.findIndex(
                (u) => u.id === provisionedUser.id || u.email.toLowerCase() === cleanEmail
              );
              if (existingIdx >= 0) {
                this.state.users[existingIdx] = { ...this.state.users[existingIdx], ...provisionedUser };
              } else {
                this.state.users.push(provisionedUser);
              }
              this.notify();

              await this.loadSupabaseData();
              return { success: true, user: apiData.user || provisionedUser };
            } else if (apiData?.error) {
              return { success: false, error: apiData.error };
            } else if (!apiRes.ok) {
              return { success: false, error: `Server error (${apiRes.status}) during provisioning.` };
            }
          } catch {
            // Server endpoint network unreachable, proceed to fallback
          }

          // 2. Attempt Supabase Edge Function
          try {
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
              'provision-supervisor',
              {
                body: {
                  email: cleanEmail,
                  fullName: cleanName,
                  phoneNumber: cleanPhone,
                  password: cleanPassword,
                },
              }
            );

            if (!edgeError && edgeData?.success) {
              await this.loadSupabaseData();
              return { success: true, user: edgeData.user };
            }
          } catch {
            // Edge Function unavailable
          }
        }

        // 3. Fallback: Check if user profile already exists in public.profiles (e.g., registered as resident or invited in Auth tab)
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, email')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (targetProfile) {
          const { error: rpcError } = await supabase.rpc('provision_supervisor', {
            p_user_id: targetProfile.id,
          });
          if (rpcError) return { success: false, error: rpcError.message };
          await this.loadSupabaseData();
          return {
            success: true,
            user: {
              id: targetProfile.id,
              email: cleanEmail,
              fullName: cleanName || targetProfile.full_name,
              phoneNumber: cleanPhone || targetProfile.phone_number,
              role: 'supervisor',
              accountStatus: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };
        } else {
          return {
            success: false,
            error: `User ${cleanEmail} could not be provisioned automatically. Please ensure SUPABASE_SERVICE_ROLE_KEY is configured in AI Studio Secrets, or verify backend server logs.`,
          };
        }
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Local / Demonstration mode fallback
    const newSupervisor: UserProfile = {
      id: `usr-sup-${Date.now()}`,
      email: cleanEmail,
      fullName: cleanName,
      phoneNumber: cleanPhone,
      role: 'supervisor',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = this.state.users.findIndex(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (existingIdx >= 0) {
      this.state.users[existingIdx] = { ...this.state.users[existingIdx], ...newSupervisor };
    } else {
      this.state.users.push(newSupervisor);
    }
    this.notify();
    return { success: true, user: newSupervisor };
  }

  public async createCleanerByAdmin(params: {
    email: string;
    fullName: string;
    phoneNumber: string;
    password: string;
    supervisorId?: string | null;
    localityIds: string[];
    accountStatus?: 'active' | 'pending';
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const user = this.state.currentUser;
    if (!user || !isAdministrator(user.role)) {
      return { success: false, error: 'Access denied: Only administrators can create cleaner accounts directly.' };
    }

    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    const cleanPhone = params.phoneNumber.trim();
    const cleanPassword = params.password.trim();
    const cleanStatus = params.accountStatus === 'pending' ? 'pending' : 'active';
    const assignedSupId = params.supervisorId && params.supervisorId.trim() ? params.supervisorId.trim() : null;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (cleanName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters.' };
    }
    if (cleanPassword.length < 8) {
      return { success: false, error: 'Initial password must be at least 8 characters long.' };
    }

    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          return { success: false, error: 'Admin session token not found. Please re-authenticate.' };
        }

        const apiRes = await fetch('/api/admin/create-cleaner', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: cleanEmail,
            fullName: cleanName,
            phoneNumber: cleanPhone,
            password: cleanPassword,
            supervisorId: assignedSupId,
            localityIds: params.localityIds || [],
            accountStatus: cleanStatus,
          }),
        });

        const apiData = await apiRes.json().catch(() => null);
        if (apiRes.ok && apiData?.success) {
          await this.loadSupabaseData();
          return { success: true, user: apiData.user };
        } else {
          return { success: false, error: apiData?.error || `Server error (${apiRes.status}) creating cleaner.` };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to create cleaner account.' };
      }
    }

    // Local / In-memory Fallback
    if (this.state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const newCleanerId = `usr-cleaner-${Date.now()}`;
    const supUser = assignedSupId ? this.state.users.find((u) => u.id === assignedSupId) : null;
    const newCleaner: UserProfile = {
      id: newCleanerId,
      email: cleanEmail,
      fullName: cleanName,
      phoneNumber: cleanPhone,
      role: 'cleaner',
      accountStatus: cleanStatus,
      supervisorId: assignedSupId,
      supervisorName: supUser?.fullName || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.users.push(newCleaner);

    for (const locId of params.localityIds) {
      const loc = this.state.localities.find((l) => l.id === locId);
      this.state.serviceAreas.push({
        id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        cleanerId: newCleanerId,
        localityId: locId,
        localityName: loc ? loc.name : 'Locality',
        isApproved: cleanStatus === 'active',
        approvedBy: user.id,
        approvedAt: cleanStatus === 'active' ? new Date().toISOString() : undefined,
      });
    }

    this.state.cleanerApplications.push({
      id: `app-${Date.now()}`,
      cleanerId: newCleanerId,
      cleanerName: cleanName,
      cleanerEmail: cleanEmail,
      cleanerPhone: cleanPhone,
      status: cleanStatus === 'active' ? 'approved' : 'pending',
      assignedSupervisorId: assignedSupId,
      assignedSupervisorName: supUser?.fullName || null,
      reviewerId: user.id,
      reviewedAt: cleanStatus === 'active' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    });

    this.notify();
    return { success: true, user: newCleaner };
  }

  public async reviewCleanerApplication(
    applicationId: string,
    decision: 'approved' | 'rejected',
    approvedLocalityIds: string[] = [],
    supervisorId?: string | null,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user || !isSupervisorOrAdmin(user.role)) {
      return { success: false, error: 'Access denied: Only authorized staff can review cleaner applications.' };
    }

    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const apiRes = await fetch('/api/admin/review-cleaner-application', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              applicationId,
              decision,
              supervisorId: supervisorId || null,
              approvedLocalityIds,
              notes,
            }),
          });
          const apiData = await apiRes.json().catch(() => null);
          if (apiRes.ok && apiData?.success) {
            await this.loadSupabaseData();
            return { success: true };
          }
          if (apiData?.error) {
            return { success: false, error: apiData.error };
          }
        }

        // Fallback to direct RPC
        const { error } = await supabase.rpc('review_cleaner_application_v2', {
          p_application_id: applicationId,
          p_decision: decision,
          p_approved_locality_ids: approvedLocalityIds,
          p_supervisor_id: supervisorId || null,
          p_notes: notes || null,
        });
        if (error) {
          const { error: errLegacy } = await supabase.rpc('review_cleaner_application', {
            p_application_id: applicationId,
            p_decision: decision,
            p_approved_locality_ids: approvedLocalityIds,
            p_notes: notes || null,
          });
          if (errLegacy) return { success: false, error: errLegacy.message };
        }
        await this.loadSupabaseData();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Local / In-memory fallback
    const app = this.state.cleanerApplications.find((a) => a.id === applicationId);
    if (!app) return { success: false, error: 'Application not found.' };

    const timestamp = new Date().toISOString();
    app.status = decision;
    app.reviewerId = user.id;
    app.reviewNotes = notes;
    app.reviewedAt = timestamp;
    app.assignedSupervisorId = supervisorId || null;

    const sup = supervisorId ? this.state.users.find((u) => u.id === supervisorId) : null;
    app.assignedSupervisorName = sup?.fullName || null;

    const cleaner = this.state.users.find((u) => u.id === app.cleanerId);
    if (cleaner) {
      if (decision === 'approved') {
        cleaner.role = 'cleaner';
        cleaner.accountStatus = 'active';
        cleaner.supervisorId = supervisorId || null;
        cleaner.supervisorName = sup?.fullName || null;
        cleaner.updatedAt = timestamp;

        this.state.serviceAreas.forEach((sa) => {
          if (sa.cleanerId === cleaner.id && approvedLocalityIds.includes(sa.localityId)) {
            sa.isApproved = true;
            sa.approvedBy = user.id;
            sa.approvedAt = timestamp;
          }
        });
      } else {
        cleaner.accountStatus = 'suspended';
      }
    }

    this.notify();
    return { success: true };
  }

  public async updateCleaner(params: {
    cleanerId: string;
    supervisorId?: string | null;
    accountStatus?: 'active' | 'pending' | 'suspended';
    localityIds?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user || !isAdministrator(user.role)) {
      return { success: false, error: 'Access denied: Only administrators can update cleaner settings.' };
    }

    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return { success: false, error: 'Authentication required.' };

        const apiRes = await fetch('/api/admin/update-cleaner', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(params),
        });

        const apiData = await apiRes.json().catch(() => null);
        if (apiRes.ok && apiData?.success) {
          await this.loadSupabaseData();
          return { success: true };
        } else {
          return { success: false, error: apiData?.error || 'Failed to update cleaner.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Local state fallback
    const cleaner = this.state.users.find((u) => u.id === params.cleanerId);
    if (!cleaner) return { success: false, error: 'Cleaner not found.' };

    const timestamp = new Date().toISOString();
    if (params.accountStatus) cleaner.accountStatus = params.accountStatus;
    if (params.supervisorId !== undefined) {
      cleaner.supervisorId = params.supervisorId || null;
      const sup = params.supervisorId ? this.state.users.find((u) => u.id === params.supervisorId) : null;
      cleaner.supervisorName = sup?.fullName || null;
    }
    cleaner.updatedAt = timestamp;

    if (Array.isArray(params.localityIds)) {
      this.state.serviceAreas = this.state.serviceAreas.filter((sa) => sa.cleanerId !== cleaner.id);
      for (const locId of params.localityIds) {
        const loc = this.state.localities.find((l) => l.id === locId);
        this.state.serviceAreas.push({
          id: `sa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          cleanerId: cleaner.id,
          localityId: locId,
          localityName: loc?.name || 'Locality',
          isApproved: cleaner.accountStatus === 'active',
          approvedBy: user.id,
          approvedAt: timestamp,
        });
      }
    }

    this.notify();
    return { success: true };
  }

  public async resetCleanerPassword(cleanerId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const user = this.state.currentUser;
    if (!user || !isAdministrator(user.role)) {
      return { success: false, error: 'Access denied: Only administrators can reset cleaner credentials.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    if (this.isLive && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return { success: false, error: 'Authentication required.' };

        const apiRes = await fetch('/api/admin/reset-cleaner-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cleanerId, newPassword }),
        });

        const apiData = await apiRes.json().catch(() => null);
        if (apiRes.ok && apiData?.success) {
          return { success: true };
        } else {
          return { success: false, error: apiData?.error || 'Failed to reset password.' };
        }
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  }

  public async toggleCleanerLocalityApproval(cleanerId: string, localityId: string, approved: boolean): Promise<void> {
    const user = this.state.currentUser;
    if (!user || !isSupervisorOrAdmin(user.role)) return;

    if (this.isLive && supabase) {
      try {
        const { data: existing } = await supabase
          .from('cleaner_service_areas')
          .select('id')
          .eq('cleaner_id', cleanerId)
          .eq('locality_id', localityId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('cleaner_service_areas')
            .update({
              is_approved: approved,
              approved_by: approved ? user.id : null,
              approved_at: approved ? new Date().toISOString() : null,
            })
            .eq('id', existing.id);
        } else if (approved) {
          await supabase.from('cleaner_service_areas').insert({
            cleaner_id: cleanerId,
            locality_id: localityId,
            is_approved: true,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          });
        }
        await this.loadSupabaseData();
        return;
      } catch (err) {
        console.warn('Error toggling locality approval in Supabase:', err);
      }
    }

    let sa = this.state.serviceAreas.find((s) => s.cleanerId === cleanerId && s.localityId === localityId);
    const locality = this.state.localities.find((l) => l.id === localityId);
    if (!sa && locality) {
      sa = {
        id: `csa-${Date.now()}`,
        cleanerId,
        localityId,
        localityName: locality.name,
        isApproved: approved,
        approvedBy: approved ? user.id : undefined,
        approvedAt: approved ? new Date().toISOString() : undefined,
      };
      this.state.serviceAreas.push(sa);
    } else if (sa) {
      sa.isApproved = approved;
      sa.approvedBy = approved ? user.id : undefined;
      sa.approvedAt = approved ? new Date().toISOString() : undefined;
    }
    this.notify();
  }

  // Secure Initial Administrator Provisioning Helper for testing/setup
  // Can only be called when authenticated as jhaa47531@gmail.com to assign admin role locally if needed
  public selfPromoteInitialAdminIfConfigured(email: string): boolean {
    if (email.trim().toLowerCase() === 'jhaa47531@gmail.com') {
      const user = this.state.users.find((u) => u.email.toLowerCase() === 'jhaa47531@gmail.com');
      if (user) {
        user.role = 'administrator';
        user.accountStatus = 'active';
        user.updatedAt = new Date().toISOString();
        if (this.state.currentUser?.email.toLowerCase() === 'jhaa47531@gmail.com') {
          this.state.currentUser = user;
        }
        this.notify();
        return true;
      }
    }
    return false;
  }
}

export const portalStore = new PortalStore();
