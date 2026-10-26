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
  Info,
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
          setError('Maximum 5 preferred localities permitted by municipal policy.');
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
      setError(res.error || 'Authentication failed. Please verify credentials.');
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
            'Registration successful! Please check your email to confirm your account before logging in.'
        );
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
    setNotice(null);

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Phone number must be at least 7 characters.');
      return;
    }
    if (selectedLocalityIds.length < 3 || selectedLocalityIds.length > 5) {
      setError('Municipal policy requires selecting between 3 and 5 preferred service localities.');
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
      setNotice(
        'Cleaner onboarding application submitted! Your account is pending supervisor or administrator verification and service-area assignment.'
      );
      setMode('login');
    } else {
      setError(res.error || 'Failed to submit application.');
    }
  };

  if (!isOpen) return null;

  const roleMeta: Record<
    UserRole,
    { label: string; code: string; icon: React.ReactNode; desc: string; glow: string }
  > = {
    resident: {
      label: 'Resident',
      code: '01',
      icon: <Users className="w-4 h-4 text-emerald-400" />,
      desc: 'Submit complaints & track resolution',
      glow: 'border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    },
    cleaner: {
      label: 'Cleaner',
      code: '02',
      icon: <HardHat className="w-4 h-4 text-amber-400" />,
      desc: 'Execute assigned pickups & submit proof',
      glow: 'border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    },
    supervisor: {
      label: 'Supervisor',
      code: '03',
      icon: <UserCheck className="w-4 h-4 text-blue-400" />,
      desc: 'Triage, verify calls & assign cleaners',
      glow: 'border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    },
    administrator: {
      label: 'Admin',
      code: '04',
      icon: <ShieldAlert className="w-4 h-4 text-cyan-400" />,
      desc: 'Governance, provisioning & audit logs',
      glow: 'border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    },
    admin: {
      label: 'Admin',
      code: '04',
      icon: <ShieldAlert className="w-4 h-4 text-cyan-400" />,
      desc: 'Governance, provisioning & audit logs',
      glow: 'border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    },
  };

  const isStaffRole =
    activeRole === 'supervisor' || activeRole === 'administrator' || activeRole === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-[#0f1217] border border-white/10 p-6 sm:p-7 text-slate-100 shadow-2xl space-y-6 my-8">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono-display text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                ROLE GATEWAY
              </span>
              <span className="font-mono-display text-xs text-slate-400 uppercase tracking-widest">
                AUTHENTICATION
              </span>
            </div>
            <h2 className="text-xl font-mono-display font-bold text-white uppercase tracking-wider">
              {mode === 'login' ? 'PORTAL SIGN IN' : 'ACCOUNT REGISTRATION'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Role Selector Chips */}
        <div className="space-y-2">
          <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400">
            SELECT WORKSPACE ROLE
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['resident', 'cleaner', 'supervisor', 'admin'] as UserRole[]).map((r) => {
              const meta = roleMeta[r];
              const isSelected = activeRole === r || (r === 'admin' && activeRole === 'administrator');
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? `${meta.glow} bg-[#161b24]`
                      : 'border-white/5 bg-[#12161c] text-slate-400 hover:border-white/10 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-slate-500">{meta.code}</span>
                    {meta.icon}
                  </div>
                  <span className="font-mono-display text-xs font-bold mt-2 uppercase tracking-wide">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Toggle for Resident & Cleaner */}
        {!isStaffRole && (
          <div className="flex rounded-xl bg-[#12161c] p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white/10 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white/10 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              REGISTER
            </button>
          </div>
        )}

        {/* Notice & Error Messages */}
        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{notice}</p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Supervisor & Admin Notice */}
        {isStaffRole && (
          <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Administrative & Supervisor accounts are provisioned directly by municipal authority governance. Public registration is disabled.
            </p>
          </div>
        )}

        {/* Forms */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@civicpickup.gov"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'AUTHENTICATING...' : 'ENTER WORKSPACE'}
            </button>
          </form>
        ) : activeRole === 'resident' ? (
          /* Resident Registration Form */
          <form onSubmit={handleResidentRegister} className="space-y-4">
            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                FULL NAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Resident Full Name"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                CONTACT PHONE (FOR SUPERVISOR VERIFICATION CALL)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0100"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-emerald-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'REGISTERING...' : 'CREATE RESIDENT ACCOUNT'}
            </button>
          </form>
        ) : (
          /* Cleaner Onboarding Application Form */
          <form onSubmit={handleCleanerRegister} className="space-y-4">
            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                FULL NAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Cleaner Full Name"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-amber-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  PHONE NUMBER
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1-555-0100"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-amber-500/60 focus:outline-hidden transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  EMAIL
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cleaner@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-amber-500/60 focus:outline-hidden transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-mono-display text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#12161c] text-white placeholder:text-slate-600 text-xs font-mono focus:border-amber-500/60 focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            {/* Select 3-5 Service Localities */}
            <div className="p-3.5 rounded-2xl bg-[#12161c] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-mono-display text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                  PREFERRED LOCALITIES (SELECT 3 TO 5)
                </label>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300">
                  {selectedLocalityIds.length} / 5 SELECTED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {localities.map((loc) => {
                  const checked = selectedLocalityIds.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleToggleLocality(loc.id)}
                      className={`p-2 rounded-xl text-left text-xs font-mono flex items-center justify-between border transition-all cursor-pointer ${
                        checked
                          ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                          : 'border-white/5 bg-[#0f1217] text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <span className="truncate">{loc.name}</span>
                      {checked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-mono-display font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'SUBMITTING APPLICATION...' : 'SUBMIT CLEANER APPLICATION'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
