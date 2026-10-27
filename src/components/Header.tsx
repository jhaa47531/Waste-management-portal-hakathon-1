/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types/index.ts';
import { portalStore } from '../services/store.ts';
import { useTheme } from '../services/theme.ts';
import {
  Trash2,
  Users,
  ShieldAlert,
  UserCheck,
  HardHat,
  LogOut,
  LogIn,
  UserPlus,
  Info,
  Sun,
  Moon,
  X,
  Menu,
} from 'lucide-react';

interface HeaderProps {
  currentUser: UserProfile | null;
  onOpenAuthModal: (role?: UserRole, mode?: 'login' | 'register') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuthModal,
}) => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, isDark, toggleTheme } = useTheme();

  const roleConfigs: Record<
    UserRole,
    { label: string; tag: string; icon: React.ReactNode; border: string }
  > = {
    resident: {
      label: 'RESIDENT',
      tag: '01',
      icon: <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
      border: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40',
    },
    cleaner: {
      label: 'CLEANER',
      tag: '02',
      icon: <HardHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
      border: 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40',
    },
    supervisor: {
      label: 'SUPERVISOR',
      tag: '03',
      icon: <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
      border: 'border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40',
    },
    administrator: {
      label: 'ADMIN',
      tag: '04',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />,
      border: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-300 bg-cyan-50/80 dark:bg-cyan-950/40',
    },
    admin: {
      label: 'ADMIN',
      tag: '04',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />,
      border: 'border-cyan-500/40 text-cyan-700 dark:text-cyan-300 bg-cyan-50/80 dark:bg-cyan-950/40',
    },
  };

  const currentRoleMeta = currentUser ? roleConfigs[currentUser.role] : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0b0d10]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Minimal Typewriter Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 dark:bg-[#12171f] border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs group transition-transform hover:scale-105">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-mono-display font-bold tracking-wider sm:tracking-widest uppercase text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    CivicPickup
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-display text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    v2.4
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden md:block truncate">
                  MUNICIPAL SANITATION DISPATCH
                </span>
              </div>
            </div>

            {/* Right Controls: Theme Toggle + Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Working Sun/Moon Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-10 h-10 rounded-full border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-[#12161c] dark:hover:bg-white/10 text-slate-700 dark:text-amber-300 flex items-center justify-center transition-all cursor-pointer shrink-0 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>

              {/* Minimal Protocol Info Trigger */}
              <button
                type="button"
                onClick={() => setIsAboutOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-300 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-emerald-500/40 bg-slate-50 dark:bg-white/[0.03] transition-all cursor-pointer min-h-[40px]"
              >
                <Info className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Protocol</span>
              </button>

              {/* Desktop Auth Controls */}
              <div className="hidden sm:flex items-center gap-2">
                {currentUser && currentRoleMeta ? (
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full border ${currentRoleMeta.border} shadow-xs`}>
                      <span className="font-mono-display text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-bold">
                        {currentRoleMeta.tag}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono-display text-[11px] font-bold">
                        {currentRoleMeta.icon}
                        {currentRoleMeta.label}
                      </span>
                      <span className="hidden lg:inline text-xs font-mono text-slate-700 dark:text-slate-300 border-l border-slate-300 dark:border-white/10 pl-2 max-w-[120px] truncate">
                        {currentUser.fullName}
                      </span>
                    </div>

                    <button
                      onClick={() => portalStore.signOut()}
                      className="w-10 h-10 rounded-full border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#12161c] hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                      title="Sign Out"
                      aria-label="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenAuthModal('resident', 'login')}
                      className="px-3.5 py-2 rounded-full border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 bg-transparent text-xs font-mono font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                    >
                      <LogIn className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>SIGN IN</span>
                    </button>
                    <button
                      onClick={() => onOpenAuthModal('resident', 'register')}
                      className="px-4 py-2 rounded-full border border-emerald-600/40 dark:border-emerald-500/40 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/50 text-xs font-mono font-bold text-white dark:text-emerald-300 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-white dark:text-emerald-400" />
                      <span>REGISTER</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Menu Hamburger Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="sm:hidden w-10 h-10 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#12161c] flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-hidden"
                aria-label="Open mobile menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1217] px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-150 shadow-lg">
            {currentUser && currentRoleMeta ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border ${currentRoleMeta.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    {currentRoleMeta.icon}
                    <div className="flex flex-col">
                      <span className="font-mono-display text-xs font-bold text-slate-900 dark:text-white">
                        {currentUser.fullName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {currentRoleMeta.label} • {currentUser.email}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono-display text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-bold">
                    {currentRoleMeta.tag}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsAboutOpen(true);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2"
                  >
                    <Info className="w-4 h-4 text-slate-500" />
                    <span>Protocol Guide</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      portalStore.signOut();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 text-xs font-mono font-bold flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAuthModal('resident', 'login');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-mono font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-slate-500" />
                  <span>SIGN IN</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAuthModal('resident', 'register');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white dark:bg-emerald-600 text-xs font-mono font-bold flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>REGISTER NEW RESIDENT</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAboutOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-white/5 text-xs font-mono text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>View Resolution Architecture</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Protocol Architecture Dialog */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f1217] border border-slate-200 dark:border-white/10 p-5 sm:p-6 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <h3 className="font-mono-display uppercase tracking-wider text-xs font-bold text-slate-900 dark:text-white">
                  MUNICIPAL RESOLUTION ARCHITECTURE
                </h3>
              </div>
              <button
                onClick={() => setIsAboutOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              CivicPickup is a strict 4-role municipal sanitation system ensuring zero fraudulent reports through automated browser GPS verification, dual photographic evidence, and auditable supervisor triage.
            </p>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141820] border border-slate-200 dark:border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-emerald-600 dark:text-emerald-400 font-bold shrink-0">01</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-900 dark:text-white font-bold">Resident Report</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Mandatory GPS coords + photo (&le;3MB) generates unique tracking ID.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141820] border border-slate-200 dark:border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-cyan-600 dark:text-cyan-400 font-bold shrink-0">02</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-900 dark:text-white font-bold">Supervisor Verification</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Supervisor validates authenticity via telephone contact before cleaner dispatch.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141820] border border-slate-200 dark:border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-amber-600 dark:text-amber-400 font-bold shrink-0">03</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-900 dark:text-white font-bold">Cleaner Execution</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Assigned cleaner clears area and captures mandatory after-cleaning photo.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141820] border border-slate-200 dark:border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-purple-600 dark:text-purple-400 font-bold shrink-0">04</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-900 dark:text-white font-bold">Photo Audit & Sign-off</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Supervisor audits side-by-side evidence to permanently close the issue.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 text-right border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-mono font-bold text-slate-800 dark:text-white transition-colors cursor-pointer min-h-[40px]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
