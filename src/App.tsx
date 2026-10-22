/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { portalStore } from './services/store.ts';
import { isSupabaseConfigured } from './services/supabase.ts';
import { Header } from './components/Header.tsx';
import { ResidentView } from './components/ResidentView.tsx';
import { SupervisorView } from './components/SupervisorView.tsx';
import { CleanerView } from './components/CleanerView.tsx';
import { AdminView } from './components/AdminView.tsx';
import { SupabaseGuideModal } from './components/SupabaseGuideModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import {
  Users,
  HardHat,
  UserCheck,
  ShieldAlert,
  Database,
  MapPin,
  CheckCircle2,
  Camera,
  Navigation,
  LogOut,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [storeState, setStoreState] = useState(() => portalStore.getState());
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const unsubscribe = portalStore.subscribe(() => {
      setStoreState({ ...portalStore.getState() });
    });
    return unsubscribe;
  }, []);

  const { currentUser, complaints, localities, serviceAreas, cleanerApplications, users } =
    storeState;
  const isLive = isSupabaseConfigured();

  const openLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthModalMode('register');
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onOpenSupabaseGuide={() => setIsSupabaseModalOpen(true)}
        onOpenAuthModal={openLogin}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 space-y-8">
        {/* If Not Authenticated: Clean Guest Landing Page */}
        {!currentUser ? (
          <div className="space-y-8 pb-12">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-emerald-900/40 relative overflow-hidden">
              <div className="max-w-2xl relative z-10 space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Civic Operations & Waste Dispatch Portal
                </span>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  Municipal Waste Pickup Request Portal
                </h1>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Report visible street waste for immediate municipal dispatch. Verified complaints are assigned to certified cleaners with mandatory GPS coordinates, photographic evidence, and supervisor sign-off.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={openLogin}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    Sign In to Portal <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={openRegister}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer"
                  >
                    Register Resident Account
                  </button>
                </div>
              </div>
            </div>

            {/* End-to-End Workflow Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" /> Resident Reporting
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Submit waste complaint with mandatory GPS geolocation, contact number, and photo evidence (&le;3 MB).
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" /> Supervisor Triage
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Verify complaint details, place telephone call to resident, and assign to an approved cleaner in that locality.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <HardHat className="w-4 h-4 text-amber-600" /> Cleaner Execution
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Open GPS navigation route, clear the site, and upload mandatory after-cleaning photo evidence.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold">
                  4
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-purple-600" /> Sign-off & Audit
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Supervisor reviews side-by-side photos and signs off resolution into an immutable audit trail.
                </p>
              </div>
            </div>

            {/* Portal Operational Status Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ready for Manual Testing
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    The portal has been initialized in a clean state with 0 dummy records. Register a new resident or log in with your credentials to test.
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {complaints.length}
                    </span>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Complaints</p>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {localities.length}
                    </span>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Localities</p>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      Active
                    </span>
                    <p className="text-[10px] uppercase font-bold text-slate-400">System</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated User View */
          <div className="space-y-6">
            {/* Active User Session Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {currentUser.fullName}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        currentUser.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300'
                          : currentUser.role === 'supervisor'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                          : currentUser.role === 'cleaner'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{currentUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => portalStore.logout()}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>

            {/* Dynamic Role-Based View */}
            {currentUser.role === 'resident' && (
              <ResidentView
                currentUser={currentUser}
                localities={localities}
                complaints={complaints}
              />
            )}

            {currentUser.role === 'supervisor' && (
              <SupervisorView
                currentUser={currentUser}
                complaints={complaints}
                localities={localities}
                users={users}
                serviceAreas={serviceAreas}
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

            {currentUser.role === 'admin' && (
              <AdminView
                currentUser={currentUser}
                users={users}
                localities={localities}
                cleanerApplications={cleanerApplications}
                serviceAreas={serviceAreas}
                complaints={complaints}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Civic Waste Pickup Request Portal — Municipal Operations
            </p>
            <p className="text-[11px] text-slate-400">
              Complies with strict PostgreSQL Row Level Security (RLS), Supabase Private Storage (<code className="font-mono">waste-complaint-photos</code>), and Immutable Audit Trail Triggers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-slate-100 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              {isLive ? 'Supabase Live Connected' : 'Supabase SQL Migrations Guide'}
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SupabaseGuideModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
