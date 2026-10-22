/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { portalStore } from '../services/store.ts';
import { Locality, UserRole } from '../types/index.ts';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  AlertCircle,
  HardHat,
  Users,
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  MapPin,
  ArrowRight,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole?: UserRole;
  initialMode?: 'login' | 'register';
  localities?: Locality[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  targetRole = 'resident',
  initialMode = 'login',
  localities = [],
}) => {
  const [activeRole, setActiveRole] = useState<UserRole>(targetRole);
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedLocalityIds, setSelectedLocalityIds] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveRole(targetRole);
      // Supervisor and Administrator have no public registration
      if (targetRole === 'supervisor' || targetRole === 'admin' || targetRole === 'administrator') {
        setMode('login');
      } else {
        setMode(initialMode);
      }
      setError(null);
      setNotice(null);
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
      setSelectedLocalityIds([]);
    }
  }, [isOpen, targetRole, initialMode]);

  // When role changes inside modal
  const handleRoleChange = (newRole: UserRole) => {
    setActiveRole(newRole);
    setError(null);
    setNotice(null);
    if (newRole === 'supervisor' || newRole === 'admin' || newRole === 'administrator') {
      setMode('login');
    }
  };

  const handleToggleLocality = (locId: string) => {
    setError(null);
    setSelectedLocalityIds((prev) => {
      if (prev.includes(locId)) {
        return prev.filter((id) => id !== locId);
      } else {
        if (prev.length >= 5) {
          setError('You can select a maximum of 5 preferred localities.');
          return prev;
        }
        return [...prev, locId];
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await portalStore.loginWithEmail(email, password);
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Authentication failed. Please check your credentials.');
    }
  };

  const handleResidentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Phone number must be at least 7 characters for pickup dispatch verification.');
      return;
    }

    setLoading(true);
    const res = await portalStore.registerResident({
      email,
      fullName,
      phoneNumber: phone,
      password,
    });
    setLoading(false);

    if (res.success) {
      if (res.pendingConfirmation) {
        setNotice(
          res.message ||
            'Registration successful! Please check your email inbox to verify your account before logging in.'
        );
        setMode('login');
      } else {
        onClose();
      }
    } else {
      setError(res.error || 'Registration failed.');
    }
  };

  const handleCleanerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Phone number must be at least 7 characters.');
      return;
    }
    const activeLocCount = localities.filter((l) => l.active).length;
    const minRequired = Math.min(1, activeLocCount);
    if (selectedLocalityIds.length < minRequired) {
      setError(`Please select at least ${minRequired} preferred service locality.`);
      return;
    }
    if (selectedLocalityIds.length > 5) {
      setError('Please select no more than 5 preferred service localities.');
      return;
    }

    setLoading(true);
    const res = await portalStore.registerCleaner({
      email,
      fullName,
      phoneNumber: phone,
      password,
      preferredLocalityIds: selectedLocalityIds,
    });
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Cleaner registration failed.');
    }
  };

  if (!isOpen) return null;

  const isPrivilegedRole = activeRole === 'supervisor' || activeRole === 'admin' || activeRole === 'administrator';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5 my-8 text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                {activeRole === 'cleaner' ? (
                  <HardHat className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : activeRole === 'supervisor' ? (
                  <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : activeRole === 'admin' || activeRole === 'administrator' ? (
                  <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                )}
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {activeRole === 'resident'
                    ? mode === 'login' ? 'Resident Sign In' : 'Resident Self-Registration'
                    : activeRole === 'cleaner'
                    ? mode === 'login' ? 'Cleaner Sign In' : 'Cleaner Application Registration'
                    : activeRole === 'supervisor'
                    ? 'Supervisor Sign In'
                    : 'Administrator Sign In'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeRole === 'resident'
                    ? 'Report visible waste and track municipal pickups in real time.'
                    : activeRole === 'cleaner'
                    ? 'Access assigned service tasks and submit photographic completion evidence.'
                    : activeRole === 'supervisor'
                    ? 'Verify resident submissions, review cleaner evidence, and assign staff.'
                    : 'Authorized administrative governance and supervisor provisioning.'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Navigation Choices */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block px-0.5">
            Role Entry Point
          </label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleRoleChange('resident')}
              className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRole === 'resident'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Resident</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('cleaner')}
              className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRole === 'cleaner'
                  ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 font-bold shadow-xs border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Cleaner</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('supervisor')}
              className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRole === 'supervisor'
                  ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 font-bold shadow-xs border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Supervisor</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRole === 'admin' || activeRole === 'administrator'
                  ? 'bg-white dark:bg-slate-900 text-purple-800 dark:text-purple-300 font-bold shadow-xs border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Success Notice Feedback */}
        {notice && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Mode Toggle for Resident & Cleaner */}
        {!isPrivilegedRole && (
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {activeRole === 'cleaner' ? 'Apply as Cleaner' : 'Register as Resident'}
            </button>
          </div>
        )}

        {/* Supervisor Provisioning Notice */}
        {activeRole === 'supervisor' && (
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-300 text-xs flex items-start gap-2.5 shadow-2xs leading-relaxed">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p>
              Supervisor accounts are securely provisioned and activated by the Municipal Administrator. If you do not have credentials yet, please contact your municipal department administrator.
            </p>
          </div>
        )}

        {/* Administrator Notice */}
        {(activeRole === 'admin' || activeRole === 'administrator') && (
          <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 text-purple-900 dark:text-purple-300 text-xs flex items-start gap-2.5 shadow-2xs leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <p>
              Designated Municipal Administrator login (<code className="font-mono font-semibold text-purple-800 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-900/60 px-1 py-0.5 rounded">jhaa47531@gmail.com</code>). Enter your password to access supervisor provisioning and governance.
            </p>
          </div>
        )}

        {/* Forms */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    activeRole === 'admin' || activeRole === 'administrator'
                      ? 'jhaa47531@gmail.com'
                      : 'name@example.com'
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>
                {loading ? 'Authenticating...' : `Sign In as ${
                  activeRole === 'resident'
                    ? 'Resident'
                    : activeRole === 'cleaner'
                    ? 'Cleaner'
                    : activeRole === 'supervisor'
                    ? 'Supervisor'
                    : 'Administrator'
                }`}
              </span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : activeRole === 'cleaner' ? (
          /* Cleaner Registration Form */
          <form onSubmit={handleCleanerRegister} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Sanitation"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Contact Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1-555-0188"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cleaner@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Preferred Localities */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Select Preferred Service Localities (1 to 5) *
                </label>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    selectedLocalityIds.length >= 1 && selectedLocalityIds.length <= 5
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  Selected: {selectedLocalityIds.length} / 5
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose the municipal wards you can service. Final service authorization is confirmed by the supervisor.
              </p>

              <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700/80 rounded-xl p-2 space-y-1 bg-slate-50/70 dark:bg-slate-800/50">
                {localities
                  .filter((l) => l.active)
                  .map((loc) => {
                    const isSelected = selectedLocalityIds.includes(loc.id);
                    return (
                      <button
                        type="button"
                        key={loc.id}
                        onClick={() => handleToggleLocality(loc.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold border border-emerald-300 dark:border-emerald-700'
                            : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {loc.name}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed shadow-2xs">
              Cleaner applications require supervisor review before tasks can be assigned. Your account will remain in <span className="font-semibold">pending</span> status until authorized.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Submitting Application...' : 'Submit Cleaner Application'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : (
          /* Resident Registration Form */
          <form onSubmit={handleResidentRegister} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Contact Phone Number (Mandatory for pickup verification) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 555-0123"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Municipal Security Policy: Public resident registrations are strictly granted the <code className="font-mono text-emerald-800 dark:text-emerald-300 font-semibold">resident</code> role.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Registering Account...' : 'Register Resident Account'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
