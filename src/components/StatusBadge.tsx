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
} from 'lucide-react';

interface StatusBadgeProps {
  status: ComplaintStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const configs: Record<
    ComplaintStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    submitted: {
      label: 'Submitted',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800/60',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    verified: {
      label: 'Verified',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      text: 'text-sky-800 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-800/60',
      icon: <UserCheck className="w-3.5 h-3.5" />,
    },
    assigned: {
      label: 'Assigned',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-800 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800/60',
      icon: <PlayCircle className="w-3.5 h-3.5" />,
    },
    in_progress: {
      label: 'In Progress',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-800 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800/60',
      icon: <PlayCircle className="w-3.5 h-3.5 animate-spin" />,
    },
    awaiting_verification: {
      label: 'Awaiting Audit',
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-800 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800/60',
      icon: <Eye className="w-3.5 h-3.5" />,
    },
    completed: {
      label: 'Resolved',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-800 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800/60',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };

  const config = configs[status] || configs.submitted;
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] font-semibold'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border ${config.bg} ${config.text} ${config.border} ${sizeClasses} shadow-xs whitespace-nowrap`}
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
      label: 'Low Priority',
      bg: 'bg-slate-100 dark:bg-slate-800/80',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
    },
    normal: {
      label: 'Normal',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800/60',
    },
    high: {
      label: 'High Urgency',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-300 font-semibold',
      border: 'border-amber-300 dark:border-amber-800',
      icon: <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />,
    },
    critical: {
      label: 'Critical Priority',
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      text: 'text-rose-800 dark:text-rose-200 font-bold',
      border: 'border-rose-300 dark:border-rose-800',
      icon: <Flame className="w-3 h-3 text-rose-600 dark:text-rose-400" />,
    },
  };
  const config = urgencyConfig[urgency] || urgencyConfig.normal;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${config.bg} ${config.text} ${config.border} shadow-xs whitespace-nowrap`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
