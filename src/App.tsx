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
import { ParticleCanvas } from './components/ParticleCanvas.tsx';
import { ToastProvider } from './components/Toast.tsx';
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
  LogOut,
  AlertTriangle,
  Radio,
  Sparkles,
  FileText,
  Activity,
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
    <ToastProvider>
      <div className="min-h-screen bg-[#0b0d10] text-slate-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white antialiased">
        {/* Top Header */}
        <Header
          currentUser={currentUser}
          onOpenAuthModal={(role = 'resident', mode = 'login') => handleOpenAuth(role, mode)}
        />

        {/* Database Connection Notice (When live Supabase is not configured) */}
        {!isLive && (
          <div className="bg-amber-950/40 border-b border-amber-500/20 text-amber-200 px-4 py-2 text-xs font-mono">
            <div className="max-w-7xl mx-auto flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="leading-relaxed">
                <strong>
                  {configStatus.hasUrl || configStatus.hasKey
                    ? 'DATABASE STATUS: OFFLINE (PLACEHOLDER CREDENTIALS DETECTED) —'
                    : 'DATABASE STATUS: LOCAL IN-MEMORY MODE —'}
                </strong>{' '}
                {configStatus.errorMessage ? <span>{configStatus.errorMessage} </span> : null}
                All submissions, GPS verifications, cleaner dispatches, and photo audits operate seamlessly in local state.
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative">
          {/* =========================================================================
              PUBLIC LANDING PAGE (Unauthenticated with Particle Wave Backdrop)
             ========================================================================= */}
          {!currentUser ? (
            <div className="space-y-12 pb-12 relative">
              {/* Hero Card with Canvas Particle Background */}
              <div className="relative rounded-3xl border border-white/[0.08] bg-[#0e1218]/90 overflow-hidden shadow-2xl p-6 sm:p-10 lg:p-12 transition-all">
                {/* Lightweight Canvas Particle Wave Animation */}
                <ParticleCanvas className="opacity-70" />

                <div className="relative z-10 max-w-3xl space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>MUNICIPAL SANITATION & FIELD DISPATCH PLATFORM</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-mono-display font-black text-white tracking-tight leading-tight uppercase">
                    CIVICPICKUP <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                      WASTE DISPATCH
                    </span>
                  </h1>

                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans max-w-2xl">
                    A role-governed municipal platform connecting residents, sanitation teams, and field supervisors. Report visible street waste with mandatory GPS geolocation and photographic evidence, dispatched to certified cleaners and audited through verified before-and-after photo evidence.
                  </p>

                  {/* EXACT FOUR PRIMARY ROLE-ENTRY BUTTONS */}
                  <div className="pt-3 space-y-2.5">
                    <span className="font-mono-display text-[10px] font-bold uppercase tracking-widest text-slate-400 block px-0.5">
                      SELECT YOUR ROLE ENTRY POINT
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* 1. Resident */}
                      <button
                        onClick={() => handleOpenAuth('resident', 'login')}
                        className="group p-4 rounded-2xl border border-white/10 bg-[#12161c]/90 hover:border-emerald-500/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer min-h-[48px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-emerald-400 font-bold">01</span>
                          <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Users className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="font-mono-display font-bold text-sm text-white flex items-center justify-between uppercase">
                            <span>RESIDENT</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Submit & track reports
                          </p>
                        </div>
                      </button>

                      {/* 2. Cleaner */}
                      <button
                        onClick={() => handleOpenAuth('cleaner', 'login')}
                        className="group p-4 rounded-2xl border border-white/10 bg-[#12161c]/90 hover:border-amber-500/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer min-h-[48px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-amber-400 font-bold">02</span>
                          <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <HardHat className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="font-mono-display font-bold text-sm text-white flex items-center justify-between uppercase">
                            <span>CLEANER</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Execute tasks & upload proof
                          </p>
                        </div>
                      </button>

                      {/* 3. Supervisor */}
                      <button
                        onClick={() => handleOpenAuth('supervisor', 'login')}
                        className="group p-4 rounded-2xl border border-white/10 bg-[#12161c]/90 hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer min-h-[48px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-blue-400 font-bold">03</span>
                          <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <UserCheck className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="font-mono-display font-bold text-sm text-white flex items-center justify-between uppercase">
                            <span>SUPERVISOR</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Triage, assign & audit
                          </p>
                        </div>
                      </button>

                      {/* 4. Admin */}
                      <button
                        onClick={() => handleOpenAuth('admin', 'login')}
                        className="group p-4 rounded-2xl border border-white/10 bg-[#12161c]/90 hover:border-cyan-500/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer min-h-[48px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-cyan-400 font-bold">04</span>
                          <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="font-mono-display font-bold text-sm text-white flex items-center justify-between uppercase">
                            <span>ADMIN</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Governance & provisioning
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standard Municipal Resolution Lifecycle with Numbered Circles (01, 02, 03, 04) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="font-mono-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    MUNICIPAL RESOLUTION LIFECYCLE
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    END-TO-END AUDITABILITY
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#12161c] rounded-2xl p-5 border border-white/[0.08] space-y-3 shadow-xs">
                    <div className="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                      01
                    </div>
                    <h3 className="font-mono-display uppercase tracking-wider font-bold text-xs text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Resident Reporting</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      Resident submits waste report with mandatory GPS coordinates, contact phone, and image evidence (&le;3 MB).
                    </p>
                  </div>

                  <div className="bg-[#12161c] rounded-2xl p-5 border border-white/[0.08] space-y-3 shadow-xs">
                    <div className="w-8 h-8 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                      02
                    </div>
                    <h3 className="font-mono-display uppercase tracking-wider font-bold text-xs text-white flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-400" />
                      <span>Supervisor Triage</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      Supervisor verifies details, contacts resident, and manually assigns an approved cleaner for that locality.
                    </p>
                  </div>

                  <div className="bg-[#12161c] rounded-2xl p-5 border border-white/[0.08] space-y-3 shadow-xs">
                    <div className="w-8 h-8 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                      03
                    </div>
                    <h3 className="font-mono-display uppercase tracking-wider font-bold text-xs text-white flex items-center gap-2">
                      <HardHat className="w-4 h-4 text-amber-400" />
                      <span>Cleaner Resolution</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      Assigned cleaner navigates to location, clears the waste, and uploads mandatory after-cleaning photo evidence.
                    </p>
                  </div>

                  <div className="bg-[#12161c] rounded-2xl p-5 border border-white/[0.08] space-y-3 shadow-xs">
                    <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400 flex items-center justify-center font-mono font-bold text-xs">
                      04
                    </div>
                    <h3 className="font-mono-display uppercase tracking-wider font-bold text-xs text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>Audit & Sign-off</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      Supervisor inspects side-by-side photos and signs off resolution, recorded into an immutable audit trail.
                    </p>
                  </div>
                </div>
              </div>

              {/* Core Trust & Security Pillars */}
              <div className="p-6 rounded-3xl bg-[#12161c]/80 border border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-mono uppercase text-xs font-bold text-white">Mandatory Geolocation</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Every complaint requires browser-verified GPS coordinates preventing fabricated reports.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-mono uppercase text-xs font-bold text-white">Dual-Photo Verification</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Mandatory resident report photo and cleaner post-cleanup photo audited by field supervisors.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-mono uppercase text-xs font-bold text-white">Role-Based Governance</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Strict boundary isolation for residents, cleaners, supervisors, and administrative personnel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
                AUTHENTICATED USER DASHBOARD
               ========================================================================= */
            <div className="space-y-6 pb-20 md:pb-6">
              {/* User Session Bar */}
              <div className="bg-[#12161c] p-4 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0b0d10] border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-mono font-bold uppercase text-sm shadow-xs">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white font-sans">{currentUser.fullName}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isAdministrator
                            ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                            : currentUser.role === 'supervisor'
                            ? 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                            : currentUser.role === 'cleaner'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {currentUser.role}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-white/5">
                        {currentUser.accountStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => portalStore.signOut()}
                  className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-950/20 text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  <span>SIGN OUT</span>
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

        {/* Minimal Footer */}
        <footer className="border-t border-white/[0.08] bg-[#0b0d10] py-6 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="space-y-0.5">
              <p className="font-mono-display uppercase tracking-widest text-slate-200 font-bold text-xs">
                CIVICPICKUP — MUNICIPAL SANITATION DISPATCH
              </p>
              <p className="text-[11px] text-slate-400">
                End-to-end role verification, cleaner dispatch, and photo audit system.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
              <span>HACKATHON EDITION</span>
              <span>·</span>
              <span>WCAG 2.1 AA</span>
              <span>·</span>
              <span className="text-emerald-400">SECURE RLS</span>
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Navigation Bar (For Authenticated Users) */}
        {currentUser && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0d10]/95 backdrop-blur-md border-t border-white/10 px-4 py-2 flex items-center justify-around text-xs font-mono">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              {currentUser.role} DASHBOARD ACTIVE
            </span>
            <button
              onClick={() => portalStore.signOut()}
              className="py-1 px-3 rounded-lg border border-white/10 text-slate-300 hover:text-white text-[10px] uppercase font-bold"
            >
              SIGN OUT
            </button>
          </div>
        )}

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          targetRole={selectedRoleForAuth}
          initialMode={authModalMode}
          localities={localities}
        />
      </div>
    </ToastProvider>
  );
}
