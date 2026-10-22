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
  Sparkles,
  FileCheck,
  Layers,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white antialiased transition-colors">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onOpenAuthModal={(role = 'resident', mode = 'login') => handleOpenAuth(role, mode)}
      />

      {/* Database Connection Notice (When live Supabase is not configured) */}
      {!isLive && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-xs transition-colors">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="leading-relaxed">
              <strong>
                {configStatus.hasUrl || configStatus.hasKey
                  ? 'Supabase Database Offline (Invalid or Placeholder Credentials Detected):'
                  : 'Supabase Database Offline (Local Demonstration Mode Active):'}
              </strong>{' '}
              {configStatus.errorMessage ? <span>{configStatus.errorMessage} </span> : null}
              All features, submissions, approvals, and dispatch operations function in local in-memory storage mode.
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* PUBLIC LANDING PAGE (When unauthenticated) */}
        {!currentUser ? (
          <div className="space-y-12 pb-12">
            {/* Hero Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm relative overflow-hidden transition-colors">
              <div className="max-w-3xl space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Municipal Sanitation & Field Dispatch Platform
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  CivicPickup Waste Management Portal
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  A role-governed municipal platform connecting residents, sanitation teams, and field supervisors. Report visible street waste with mandatory GPS geolocation and photographic evidence, dispatched to certified cleaners and audited through verified before-and-after photo evidence.
                </p>

                {/* EXACT FOUR PRIMARY ROLE-ENTRY BUTTONS */}
                <div className="pt-4 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block px-0.5">
                    Select Your Role Entry Point (Navigation Only)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. Resident */}
                    <button
                      onClick={() => handleOpenAuth('resident', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors border border-emerald-200/50 dark:border-emerald-800">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                          <span>Resident</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Submit & track complaints
                        </p>
                      </div>
                    </button>

                    {/* 2. Cleaner */}
                    <button
                      onClick={() => handleOpenAuth('cleaner', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold group-hover:bg-amber-600 group-hover:text-white transition-colors border border-amber-200/50 dark:border-amber-800">
                        <HardHat className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                          <span>Cleaner</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Execute tasks & upload proof
                        </p>
                      </div>
                    </button>

                    {/* 3. Supervisor */}
                    <button
                      onClick={() => handleOpenAuth('supervisor', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-200/50 dark:border-blue-800">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                          <span>Supervisor</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Triage, assign & sign off
                        </p>
                      </div>
                    </button>

                    {/* 4. Admin */}
                    <button
                      onClick={() => handleOpenAuth('admin', 'login')}
                      className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-md transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold group-hover:bg-purple-600 group-hover:text-white transition-colors border border-purple-200/50 dark:border-purple-800">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                          <span>Admin</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Governance & provisioning
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Municipal Resolution Lifecycle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Standard Municipal Resolution Lifecycle
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  End-to-end auditability
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Resident Reporting</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Submit waste report with mandatory GPS coordinates, contact phone, and image evidence (&le;3 MB).
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Supervisor Triage</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Supervisor verifies details, contacts resident, and manually assigns an approved cleaner for that locality.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Cleaner Resolution</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Assigned cleaner navigates to location, clears the waste, and uploads mandatory after-cleaning photo evidence.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                    04
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Audit & Sign-off</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Supervisor inspects side-by-side photos and signs off resolution, recorded into an immutable audit trail.
                  </p>
                </div>
              </div>
            </div>

            {/* Core Trust & Security Pillars */}
            <div className="p-6 rounded-3xl bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Mandatory Geolocation</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Every complaint requires browser-verified GPS coordinates preventing fabricated reports.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Dual-Photo Verification</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Mandatory resident report photo and cleaner post-cleanup photo audited by field supervisors.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100/80 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Role-Based Governance</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Strict boundary isolation for residents, cleaners, supervisors, and administrative personnel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED USER SESSION */
          <div className="space-y-6">
            {/* User Session Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black uppercase text-sm border border-slate-200 dark:border-slate-700 shadow-2xs">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{currentUser.fullName}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isAdministrator
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : currentUser.role === 'supervisor'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : currentUser.role === 'cleaner'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        currentUser.accountStatus === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {currentUser.accountStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => portalStore.signOut()}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Sign Out</span>
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

      {/* MINIMAL CIVIC-TECH FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              CivicPickup — Municipal Waste Reporting & Dispatch Portal
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              End-to-end role verification, cleaner dispatch, and photo audit system.
            </p>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-3">
            <span>Hackathon Edition</span>
            <span>·</span>
            <span>WCAG Accessible</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
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
