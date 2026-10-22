/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
} from 'lucide-react';

interface HeaderProps {
  currentUser: UserProfile | null;
  onOpenAuthModal: (role?: UserRole, mode?: 'login' | 'register') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuthModal,
}) => {
  const roleColors: Record<UserRole, { badge: string; label: string; icon: React.ReactNode }> = {
    resident: {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      label: 'Resident',
      icon: <Users className="w-3.5 h-3.5" />,
    },
    cleaner: {
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      label: 'Cleaner',
      icon: <HardHat className="w-3.5 h-3.5" />,
    },
    supervisor: {
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      label: 'Supervisor',
      icon: <UserCheck className="w-3.5 h-3.5" />,
    },
    administrator: {
      badge: 'bg-purple-100 text-purple-800 border-purple-300',
      label: 'Administrator',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
    },
    admin: {
      badge: 'bg-purple-100 text-purple-800 border-purple-300',
      label: 'Administrator',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
    },
  };

  const currentRoleMeta = currentUser ? roleColors[currentUser.role] : null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">
                  CivicPickup
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Municipal Ops
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Immediate Waste Reporting, Dispatch & Photo Audit Portal
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Authenticated User or Sign In */}
            {currentUser && currentRoleMeta ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${currentRoleMeta.badge}`}
                  >
                    {currentRoleMeta.icon}
                    {currentRoleMeta.label}
                  </span>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => portalStore.signOut()}
                  className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors cursor-pointer"
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
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </button>
                <button
                  onClick={() => onOpenAuthModal('resident', 'register')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
