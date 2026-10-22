/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  currentUser: UserProfile | null;
  onOpenAuthModal: (role?: UserRole, mode?: 'login' | 'register') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuthModal,
}) => {
  const { theme, toggleTheme } = useTheme();

  const roleColors: Record<UserRole, { badge: string; label: string; icon: React.ReactNode }> = {
    resident: {
      badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      label: 'Resident',
      icon: <Users className="w-3.5 h-3.5" />,
    },
    cleaner: {
      badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      label: 'Cleaner',
      icon: <HardHat className="w-3.5 h-3.5" />,
    },
    supervisor: {
      badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      label: 'Supervisor',
      icon: <UserCheck className="w-3.5 h-3.5" />,
    },
    administrator: {
      badge: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      label: 'Admin',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
    },
    admin: {
      badge: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      label: 'Admin',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
    },
  };

  const currentRoleMeta = currentUser ? roleColors[currentUser.role] : null;

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-white/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">
                  CivicPickup
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Municipal Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Immediate Waste Reporting, Dispatch & Verification System
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Authenticated User or Sign In */}
            {currentUser && currentRoleMeta ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70 shadow-2xs">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${currentRoleMeta.badge}`}
                  >
                    {currentRoleMeta.icon}
                    {currentRoleMeta.label}
                  </span>
                  <div className="hidden sm:block text-left max-w-[140px] truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none truncate">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => portalStore.signOut()}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer shadow-2xs"
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
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => onOpenAuthModal('resident', 'register')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
