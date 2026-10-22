/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComplaintStatus, UrgencyLevel } from '../types/index.ts';
import { CheckCircle2, Clock, AlertTriangle, XCircle, PlayCircle, Eye, UserCheck } from 'lucide-react';

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
      bg: 'bg-amber-500/10',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-300/40 dark:border-amber-700/40',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    verified: {
      label: 'Verified',
      bg: 'bg-sky-500/10',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-300/40 dark:border-sky-700/40',
      icon: <UserCheck className="w-3.5 h-3.5" />,
    },
    assigned: {
      label: 'Assigned',
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-300/40 dark:border-indigo-700/40',
      icon: <PlayCircle className="w-3.5 h-3.5" />,
    },
    in_progress: {
      label: 'In Progress',
      bg: 'bg-purple-500/10',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-300/40 dark:border-purple-700/40',
      icon: <PlayCircle className="w-3.5 h-3.5 animate-pulse" />,
    },
    awaiting_verification: {
      label: 'Awaiting Verification',
      bg: 'bg-orange-500/10',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-300/40 dark:border-orange-700/40',
      icon: <Eye className="w-3.5 h-3.5" />,
    },
    completed: {
      label: 'Completed',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-300/40 dark:border-emerald-700/40',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-rose-500/10',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-300/40 dark:border-rose-700/40',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };

  const config = configs[status] || configs.submitted;
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export const UrgencyBadge: React.FC<{ urgency: UrgencyLevel }> = ({ urgency }) => {
  const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; border: string }> = {
    low: { label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', border: 'border-slate-300' },
    normal: { label: 'Normal', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', border: 'border-blue-300' },
    high: { label: 'High Urgency', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', border: 'border-amber-400' },
    critical: { label: 'Critical Urgency', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 font-bold', border: 'border-red-400' },
  };
  const config = urgencyConfig[urgency] || urgencyConfig.normal;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${config.color} ${config.border}`}>
      {urgency === 'critical' || urgency === 'high' ? <AlertTriangle className="w-3 h-3" /> : null}
      {config.label}
    </span>
  );
};
