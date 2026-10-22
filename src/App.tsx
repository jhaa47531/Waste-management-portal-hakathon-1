/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { portalStore } from './services/store.ts';
import { isSupabaseConfigured, getSupabaseConfigStatus } from './services/supabase.ts';
import { Header } from './components/Header.tsx';
import { ResidentView } from './components/ResidentView.tsx';
import { SupervisorView } from './components/SupervisorView.tsx';
import { CleanerView } from './components/CleanerView.tsx';
import { AdminView } from './components/AdminView.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { UserRole } from './types/index.ts';
import {
  Users,
  HardHat,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  Camera,
  Navigation,
  LogOut,
  Building2,
  AlertTriangle,
} from 'lucide-react';

export default function App() {
  const [storeState, setStoreState] = useState(() => portalStore.getState());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedRoleForAuth, setSelectedRoleForAuth] = useState<UserRole>('resident');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const unsubscribe = portalStore.subscribe(() => {
      setStoreState({ ...portalStore.getState() });
    });
    return unsubscribe;
  }, []);

  const { currentUser, complaints, localities, serviceAreas, cleanerApplications, users } =
    storeState;
  const configStatus = getSupabaseConfigStatus();
  const isLive = isSupabaseConfigured();

  const handleOpenAuth = (role: UserRole = 'resident', mode: 'login' | 'register' = 'login') => {
    setSelectedRoleForAuth(role);
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const isAdministrator =
    currentUser?.role === 'administrator' || currentUser?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white antialiased">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onOpenAuthModal={(role = 'resident', mode = 'login') => handleOpenAuth(role, mode)}
      />

      {/* Database Connection Notice (When live Supabase is not configured) */}
      {!isLive && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>
                {configStatus.hasUrl || configStatus.hasKey
                  ? 'Supabase Database Offline (Invalid or Placeholder Credentials Detected):'
                  : 'Supabase Database Offline (Credentials Not Configured):'}
              </strong>{' '}
              {configStatus.errorMessage ? <span>{configStatus.errorMessage} </span> : null}
              The application is running in local demonstration mode. Real PostgreSQL tables and storage require setting genuine{' '}
              <code className="font-mono font-semibold bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono font-semibold bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in{' '}
              <code className="font-mono font-semibold bg-amber-100 px-1 rounded">.env.local</code>.
            </span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* PUBLIC LANDING PAGE (When unauthenticated) */}
        {!currentUser ? (
          <div className="space-y-10 pb-12">
            {/* Hero Section */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
              <div className="max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Municipal Sanitation & Field Dispatch System
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                  Waste Pickup Request Portal
                </h1>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  A role-governed municipal platform connecting residents, sanitation teams, and field supervisors. Report visible street waste with mandatory GPS geolocation and photographic evidence, dispatched to certified cleaners and audited through verified before-and-after photo evidence.
                </p>

                {/* EXACT FOUR PRIMARY ROLE-ENTRY BUTTONS */}
                <div className="pt-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Select Your Role Entry Point (Navigation Only)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. Resident */}
                    <button
                      onClick={() => handleOpenAuth('resident', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-2 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                          <span>Resident</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Submit & track complaints
                        </p>
                      </div>
                    </button>

                    {/* 2. Cleaner */}
                    <button
                      onClick={() => handleOpenAuth('cleaner', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-2 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <HardHat className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                          <span>Cleaner</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Execute tasks & upload proof
                        </p>
                      </div>
                    </button>

                    {/* 3. Supervisor */}
                    <button
                      onClick={() => handleOpenAuth('supervisor', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-2 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                          <span>Supervisor</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Triage, assign & sign off
                        </p>
                      </div>
                    </button>

                    {/* 4. Admin */}
                    <button
                      onClick={() => handleOpenAuth('admin', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 bg-white hover:border-purple-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-2 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                          <span>Admin</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Governance & provisioning
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Genuine Workflow Explanation */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Standard Municipal Resolution Lifecycle
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" /> Resident Reporting
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Submit waste report with mandatory GPS coordinates, contact phone, and image evidence (&le;3 MB).
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" /> Supervisor Triage
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Supervisor verifies details, contacts resident, and manually assigns an approved cleaner for that locality.
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <HardHat className="w-4 h-4 text-amber-600" /> Cleaner Resolution
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Assigned cleaner navigates to location, clears the waste, and uploads mandatory after-cleaning photo evidence.
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" /> Audit & Sign-off
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Supervisor inspects side-by-side photos and signs off resolution, recorded into an immutable audit trail.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED USER SESSION */
          <div className="space-y-6">
            {/* User Session Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold uppercase text-sm border border-slate-200">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">{currentUser.fullName}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isAdministrator
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : currentUser.role === 'supervisor'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : currentUser.role === 'cleaner'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        currentUser.accountStatus === 'active'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {currentUser.accountStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{currentUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => portalStore.signOut()}
                className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" /> Sign Out
              </button>
            </div>

            {/* Role-Based Dashboard View */}
            {currentUser.role === 'resident' && (
              <ResidentView
                currentUser={currentUser}
                localities={localities}
                complaints={complaints}
              />
            )}

            {currentUser.role === 'cleaner' && (
              <CleanerView
                currentUser={currentUser}
                complaints={complaints}
                localities={localities}
                serviceAreas={serviceAreas}
              />
            )}

            {currentUser.role === 'supervisor' && (
              <SupervisorView
                currentUser={currentUser}
                complaints={complaints}
                localities={localities}
                users={users}
                serviceAreas={serviceAreas}
                cleanerApplications={cleanerApplications}
              />
            )}

            {isAdministrator && (
              <AdminView
                currentUser={currentUser}
                users={users}
                localities={localities}
                complaints={complaints}
                cleanerApplications={cleanerApplications}
                serviceAreas={serviceAreas}
              />
            )}
          </div>
        )}
      </main>

      {/* MINIMAL PRODUCT FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-800">
              Waste Pickup Request Portal — Municipal Sanitation Operations
            </p>
            <p className="text-[11px] text-slate-500">
              Role-governed verification, cleaner dispatch, and photo audit workflow.
            </p>
          </div>

        </div>
      </footer>

      {/* Modals */}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        targetRole={selectedRoleForAuth}
        initialMode={authModalMode}
        localities={localities}
      />
    </div>
  );
}
