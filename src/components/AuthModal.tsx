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
    const minRequired = Math.min(3, activeLocCount);
    if (selectedLocalityIds.length < minRequired) {
      setError(`Please select at least ${minRequired} preferred service localities.`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                {activeRole === 'cleaner' ? (
                  <HardHat className="w-4 h-4 text-amber-600" />
                ) : activeRole === 'supervisor' ? (
                  <UserCheck className="w-4 h-4 text-blue-600" />
                ) : activeRole === 'admin' || activeRole === 'administrator' ? (
                  <ShieldAlert className="w-4 h-4 text-purple-600" />
                ) : (
                  <Users className="w-4 h-4 text-emerald-700" />
                )}
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {activeRole === 'resident'
                  ? mode === 'login' ? 'Resident Sign In' : 'Resident Self-Registration'
                  : activeRole === 'cleaner'
                  ? mode === 'login' ? 'Cleaner Sign In' : 'Cleaner Application Registration'
                  : activeRole === 'supervisor'
                  ? 'Supervisor Sign In'
                  : 'Administrator Sign In'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {activeRole === 'resident'
                ? 'Report visible waste and track municipal pickups in real time.'
                : activeRole === 'cleaner'
                ? 'Access assigned service tasks and submit photographic completion evidence.'
                : activeRole === 'supervisor'
                ? 'Verify resident submissions, review cleaner evidence, and assign staff.'
                : 'Authorized administrative governance and supervisor provisioning.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Navigation Choices (Navigation Only - Not Grants) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Role Entry Point
          </label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleRoleChange('resident')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeRole === 'resident'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Resident</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('cleaner')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeRole === 'cleaner'
                  ? 'bg-white text-amber-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Cleaner</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('supervisor')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeRole === 'supervisor'
                  ? 'bg-white text-blue-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Supervisor</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeRole === 'admin' || activeRole === 'administrator'
                  ? 'bg-white text-purple-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Success Notice Feedback */}
        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode Toggle for Resident & Cleaner */}
        {!isPrivilegedRole && (
          <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
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
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {activeRole === 'cleaner' ? 'Apply as Cleaner' : 'Register as Resident'}
            </button>
          </div>
        )}

        {/* Supervisor Provisioning Notice */}
        {activeRole === 'supervisor' && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Supervisor accounts are securely provisioned and activated by the Municipal Administrator. If you do not have credentials yet, please contact your municipal department administrator.
            </p>
          </div>
        )}

        {/* Administrator Notice */}
        {(activeRole === 'admin' || activeRole === 'administrator') && (
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <p>
              Designated Municipal Administrator login (<code className="font-mono font-semibold">jhaa47531@gmail.com</code>). Enter your password to access supervisor provisioning and governance.
            </p>
          </div>
        )}

        {/* Forms */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
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
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : `Sign In as ${
                activeRole === 'resident'
                  ? 'Resident'
                  : activeRole === 'cleaner'
                  ? 'Cleaner'
                  : activeRole === 'supervisor'
                  ? 'Supervisor'
                  : 'Administrator'
              }`}
            </button>
          </form>
        ) : activeRole === 'cleaner' ? (
          /* Cleaner Registration Form */
          <form onSubmit={handleCleanerRegister} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Sanitation"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Contact Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1-555-0188"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cleaner@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Preferred Localities (Select 3-5) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-700">
                  Select Preferred Service Localities (3 to 5) *
                </label>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    selectedLocalityIds.length >= 3 && selectedLocalityIds.length <= 5
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Selected: {selectedLocalityIds.length} / 5
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Choose the municipal wards you can service. Final service authorization is confirmed by the supervisor.
              </p>

              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                {localities
                  .filter((l) => l.active)
                  .map((loc) => {
                    const isSelected = selectedLocalityIds.includes(loc.id);
                    return (
                      <button
                        type="button"
                        key={loc.id}
                        onClick={() => handleToggleLocality(loc.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-300'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {loc.name}
                        </span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              Cleaner applications require supervisor review before tasks can be assigned. Your account will remain in <span className="font-semibold">pending</span> status until authorized.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting Application...' : 'Submit Cleaner Application'}
            </button>
          </form>
        ) : (
          /* Resident Registration Form */
          <form onSubmit={handleResidentRegister} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Contact Phone Number (Mandatory for pickup verification) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 555-0123"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Municipal Security Policy: Public resident registrations are strictly granted the <code className="font-mono text-emerald-800">resident</code> role.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Registering Account...' : 'Register Resident Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
