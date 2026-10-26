/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types/index.ts';
import { portalStore } from '../services/store.ts';
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
  Radio,
  X,
  ShieldCheck,
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

  const roleConfigs: Record<
    UserRole,
    { label: string; tag: string; icon: React.ReactNode; glow: string; border: string }
  > = {
    resident: {
      label: 'RESIDENT',
      tag: '01',
      icon: <Users className="w-3.5 h-3.5 text-emerald-400" />,
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.2)]',
      border: 'border-emerald-500/30 text-emerald-400',
    },
    cleaner: {
      label: 'FIELD CLEANER',
      tag: '02',
      icon: <HardHat className="w-3.5 h-3.5 text-amber-400" />,
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.2)]',
      border: 'border-amber-500/30 text-amber-400',
    },
    supervisor: {
      label: 'SUPERVISOR',
      tag: '03',
      icon: <UserCheck className="w-3.5 h-3.5 text-blue-400" />,
      glow: 'shadow-[0_0_12px_rgba(59,130,246,0.2)]',
      border: 'border-blue-500/30 text-blue-400',
    },
    administrator: {
      label: 'ADMINISTRATOR',
      tag: '04',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />,
      glow: 'shadow-[0_0_12px_rgba(6,182,212,0.2)]',
      border: 'border-cyan-500/30 text-cyan-400',
    },
    admin: {
      label: 'ADMINISTRATOR',
      tag: '04',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />,
      glow: 'shadow-[0_0_12px_rgba(6,182,212,0.2)]',
      border: 'border-cyan-500/30 text-cyan-400',
    },
  };

  const currentRoleMeta = currentUser ? roleConfigs[currentUser.role] : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0b0d10]/90 backdrop-blur-md border-b border-white/[0.08] text-slate-100 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Minimal Typewriter Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#12171f] border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] group transition-transform hover:scale-105">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-mono-display font-bold tracking-widest uppercase text-sm text-white">
                    CivicPickup
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-display text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    v2.4
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono hidden md:block">
                  MUNICIPAL SANITATION DISPATCH
                </span>
              </div>
            </div>

            {/* Navigation links & Outline Pill Buttons */}
            <div className="flex items-center gap-2.5">
              {/* Minimal About Trigger */}
              <button
                type="button"
                onClick={() => setIsAboutOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-xs font-mono text-slate-300 hover:text-white hover:border-emerald-500/40 hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Protocol</span>
              </button>

              {/* Authenticated User Status or Auth Options */}
              {currentUser && currentRoleMeta ? (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentRoleMeta.border} bg-[#12161c] ${currentRoleMeta.glow}`}>
                    <span className="font-mono-display text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 font-bold">
                      {currentRoleMeta.tag}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-display text-[11px] font-bold">
                      {currentRoleMeta.icon}
                      {currentRoleMeta.label}
                    </span>
                    <span className="hidden lg:inline text-xs font-mono text-slate-300 border-l border-white/10 pl-2">
                      {currentUser.fullName}
                    </span>
                  </div>

                  <button
                    onClick={() => portalStore.signOut()}
                    className="p-2 rounded-full border border-white/10 bg-[#12161c] hover:border-rose-500/40 hover:text-rose-400 hover:shadow-[0_0_12px_rgba(244,63,94,0.15)] text-slate-400 transition-all cursor-pointer"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenAuthModal('resident', 'login')}
                    className="px-3.5 py-1.5 rounded-full border border-white/10 hover:border-white/20 bg-transparent text-xs font-mono font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-slate-400" />
                    <span>SIGN IN</span>
                  </button>
                  <button
                    onClick={() => onOpenAuthModal('resident', 'register')}
                    className="px-4 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs font-mono font-bold text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>REGISTER</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Minimal Protocol Info Dialog */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-[#0f1217] border border-white/10 p-6 text-slate-100 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="font-mono-display uppercase tracking-widest text-xs font-bold text-white">
                  MUNICIPAL RESOLUTION ARCHITECTURE
                </h3>
              </div>
              <button
                onClick={() => setIsAboutOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              CivicPickup is a strict 4-role municipal sanitation system ensuring zero fraudulent reports through automated browser GPS verification, dual photographic evidence, and auditable supervisor triage.
            </p>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-[#141820] border border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-emerald-400 font-bold">01</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-white font-bold">Resident Report</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Mandatory GPS coords + photo (&le;3MB) generates unique tracking ID.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141820] border border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-cyan-400 font-bold">02</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-white font-bold">Supervisor Verification</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supervisor validates authenticity via telephone contact before cleaner dispatch.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141820] border border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-amber-400 font-bold">03</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-white font-bold">Cleaner Execution</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assigned cleaner clears area and captures mandatory after-cleaning photo.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141820] border border-white/5 flex items-start gap-3">
                <span className="font-mono-display text-xs text-purple-400 font-bold">04</span>
                <div>
                  <h4 className="text-xs font-mono uppercase text-white font-bold">Photo Audit & Sign-off</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supervisor audits side-by-side evidence to permanently close the issue.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
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
