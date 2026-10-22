/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComplaintStatus, ComplaintStatusHistory } from '../types/index.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';

interface ComplaintTimelineProps {
  currentStatus: ComplaintStatus;
  history: ComplaintStatusHistory[];
}

const LIFECYCLE_STEPS: { status: ComplaintStatus; label: string }[] = [
  { status: 'submitted', label: '1. Submitted' },
  { status: 'verified', label: '2. Verified' },
  { status: 'assigned', label: '3. Assigned' },
  { status: 'in_progress', label: '4. In Progress' },
  { status: 'awaiting_verification', label: '5. Auditing' },
  { status: 'completed', label: '6. Resolved' },
];

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({ currentStatus, history }) => {
  const isRejected = currentStatus === 'rejected';

  // Find step index in standard flow
  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="space-y-6">
      {/* Visual Step Progress */}
      {!isRejected ? (
        <div className="bg-slate-50 dark:bg-slate-900/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-3.5">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Resolution Pipeline
            </h4>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Stage {Math.max(1, currentStepIndex + 1)} of 6
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isPassed = currentStepIndex >= idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div
                  key={step.status}
                  className={`flex flex-col items-center p-2.5 rounded-xl text-center transition-all ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400 dark:ring-emerald-500/50'
                      : isPassed
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80'
                      : 'bg-white dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-center">
                    {isPassed && !isCurrent ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isCurrent ? (
                      <Clock className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-600">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold leading-tight">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Complaint Closed (Rejected)
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
              This request was inspected by the municipal supervisor and marked as non-actionable or invalid. Refer to the audit log below for the supervisor's recorded rationale.
            </p>
          </div>
        </div>
      )}

      {/* Immutable Audit Log Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Auditable Status History ({history.length})
        </h4>

        <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {history.map((item) => (
            <div key={item.id} className="relative flex items-start gap-3.5 pl-1">
              <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-600 dark:border-emerald-500 flex items-center justify-center shrink-0 z-10 shadow-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              </div>

              <div className="flex-1 bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.newStatus} size="sm" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      by <strong className="text-slate-800 dark:text-slate-200 font-semibold">{item.actorName}</strong> ({item.actorRole})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.note && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 leading-relaxed">
                    {item.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
