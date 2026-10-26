/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComplaintStatus, UrgencyLevel } from '../types/index.ts';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PlayCircle,
  Eye,
  UserCheck,
  Flame,
  Radio,
} from 'lucide-react';

interface StatusBadgeProps {
  status: ComplaintStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const configs: Record<
    ComplaintStatus,
    { label: string; code: string; bg: string; text: string; border: string; glow: string; icon: React.ReactNode }
  > = {
    submitted: {
      label: 'SUBMITTED',
      code: '01',
      bg: 'bg-amber-950/40',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_10px_rgba(245,158,11,0.15)]',
      icon: <Clock className="w-3 h-3 text-amber-400" />,
    },
    verified: {
      label: 'VERIFIED',
      code: '02',
      bg: 'bg-cyan-950/40',
      text: 'text-cyan-300',
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_10px_rgba(6,182,212,0.15)]',
      icon: <UserCheck className="w-3 h-3 text-cyan-400" />,
    },
    assigned: {
      label: 'ASSIGNED',
      code: '03',
      bg: 'bg-indigo-950/40',
      text: 'text-indigo-300',
      border: 'border-indigo-500/30',
      glow: 'shadow-[0_0_10px_rgba(99,102,241,0.15)]',
      icon: <PlayCircle className="w-3 h-3 text-indigo-400" />,
    },
    in_progress: {
      label: 'IN PROGRESS',
      code: '04',
      bg: 'bg-purple-950/40',
      text: 'text-purple-300',
      border: 'border-purple-500/30',
      glow: 'shadow-[0_0_10px_rgba(168,85,247,0.15)]',
      icon: <Radio className="w-3 h-3 text-purple-400 animate-pulse" />,
    },
    awaiting_verification: {
      label: 'AUDITING',
      code: '05',
      bg: 'bg-orange-950/40',
      text: 'text-orange-300',
      border: 'border-orange-500/30',
      glow: 'shadow-[0_0_10px_rgba(249,115,22,0.15)]',
      icon: <Eye className="w-3 h-3 text-orange-400" />,
    },
    completed: {
      label: 'RESOLVED',
      code: '06',
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.2)]',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    },
    rejected: {
      label: 'REJECTED',
      code: 'XX',
      bg: 'bg-rose-950/40',
      text: 'text-rose-300',
      border: 'border-rose-500/30',
      glow: 'shadow-[0_0_10px_rgba(244,63,94,0.15)]',
      icon: <XCircle className="w-3 h-3 text-rose-400" />,
    },
  };

  const config = configs[status] || configs.submitted;
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'lg'
      ? 'px-3 py-1.5 text-xs'
      : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono-display font-bold tracking-wider ${config.bg} ${config.text} ${config.border} ${config.glow} ${sizeClasses} whitespace-nowrap`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span className="shrink-0">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export const UrgencyBadge: React.FC<{ urgency: UrgencyLevel }> = ({ urgency }) => {
  const urgencyConfig: Record<
    UrgencyLevel,
    { label: string; bg: string; text: string; border: string; icon?: React.ReactNode }
  > = {
    low: {
      label: 'LOW',
      bg: 'bg-slate-900/60',
      text: 'text-slate-400',
      border: 'border-white/10',
    },
    normal: {
      label: 'NORMAL',
      bg: 'bg-blue-950/30',
      text: 'text-blue-300',
      border: 'border-blue-500/20',
    },
    high: {
      label: 'HIGH PRIORITY',
      bg: 'bg-amber-950/40',
      text: 'text-amber-300 font-semibold',
      border: 'border-amber-500/30',
      icon: <AlertTriangle className="w-3 h-3 text-amber-400" />,
    },
    critical: {
      label: 'CRITICAL',
      bg: 'bg-rose-950/50',
      text: 'text-rose-300 font-bold',
      border: 'border-rose-500/40',
      icon: <Flame className="w-3 h-3 text-rose-400 animate-pulse" />,
    },
  };
  const config = urgencyConfig[urgency] || urgencyConfig.normal;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider uppercase border ${config.bg} ${config.text} ${config.border} whitespace-nowrap`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
