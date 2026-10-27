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
    { label: string; code: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    submitted: {
      label: 'SUBMITTED',
      code: '01',
      bg: 'bg-amber-100 dark:bg-amber-950/50',
      text: 'text-amber-900 dark:text-amber-300',
      border: 'border-amber-300 dark:border-amber-500/40',
      icon: <Clock className="w-3 h-3 text-amber-700 dark:text-amber-400" />,
    },
    verified: {
      label: 'VERIFIED',
      code: '02',
      bg: 'bg-cyan-100 dark:bg-cyan-950/50',
      text: 'text-cyan-900 dark:text-cyan-300',
      border: 'border-cyan-300 dark:border-cyan-500/40',
      icon: <UserCheck className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />,
    },
    assigned: {
      label: 'ASSIGNED',
      code: '03',
      bg: 'bg-indigo-100 dark:bg-indigo-950/50',
      text: 'text-indigo-900 dark:text-indigo-300',
      border: 'border-indigo-300 dark:border-indigo-500/40',
      icon: <PlayCircle className="w-3 h-3 text-indigo-700 dark:text-indigo-400" />,
    },
    in_progress: {
      label: 'IN PROGRESS',
      code: '04',
      bg: 'bg-purple-100 dark:bg-purple-950/50',
      text: 'text-purple-900 dark:text-purple-300',
      border: 'border-purple-300 dark:border-purple-500/40',
      icon: <Radio className="w-3 h-3 text-purple-700 dark:text-purple-400 animate-pulse" />,
    },
    awaiting_verification: {
      label: 'AUDITING',
      code: '05',
      bg: 'bg-orange-100 dark:bg-orange-950/50',
      text: 'text-orange-900 dark:text-orange-300',
      border: 'border-orange-300 dark:border-orange-500/40',
      icon: <Eye className="w-3 h-3 text-orange-700 dark:text-orange-400" />,
    },
    completed: {
      label: 'RESOLVED',
      code: '06',
      bg: 'bg-emerald-100 dark:bg-emerald-950/50',
      text: 'text-emerald-900 dark:text-emerald-300',
      border: 'border-emerald-300 dark:border-emerald-500/40',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />,
    },
    rejected: {
      label: 'REJECTED',
      code: 'XX',
      bg: 'bg-rose-100 dark:bg-rose-950/50',
      text: 'text-rose-900 dark:text-rose-300',
      border: 'border-rose-300 dark:border-rose-500/40',
      icon: <XCircle className="w-3 h-3 text-rose-700 dark:text-rose-400" />,
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
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono-display font-bold tracking-wider ${config.bg} ${config.text} ${config.border} ${sizeClasses} whitespace-nowrap shadow-xs`}
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
      bg: 'bg-slate-100 dark:bg-slate-900/60',
      text: 'text-slate-700 dark:text-slate-400',
      border: 'border-slate-300 dark:border-white/10',
    },
    normal: {
      label: 'NORMAL',
      bg: 'bg-blue-100 dark:bg-blue-950/40',
      text: 'text-blue-900 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-500/30',
    },
    high: {
      label: 'HIGH PRIORITY',
      bg: 'bg-amber-100 dark:bg-amber-950/50',
      text: 'text-amber-900 dark:text-amber-300 font-semibold',
      border: 'border-amber-300 dark:border-amber-500/40',
      icon: <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400" />,
    },
    critical: {
      label: 'CRITICAL',
      bg: 'bg-rose-100 dark:bg-rose-950/60',
      text: 'text-rose-900 dark:text-rose-300 font-bold',
      border: 'border-rose-300 dark:border-rose-500/50',
      icon: <Flame className="w-3 h-3 text-rose-700 dark:text-rose-400 animate-pulse" />,
    },
  };
  const config = urgencyConfig[urgency] || urgencyConfig.normal;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wider uppercase border ${config.bg} ${config.text} ${config.border} whitespace-nowrap shadow-xs`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
