/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComplaintStatus, ComplaintStatusHistory } from '../types/index.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ComplaintTimelineProps {
  currentStatus: ComplaintStatus;
  history: ComplaintStatusHistory[];
}

const LIFECYCLE_STEPS: { status: ComplaintStatus; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'verified', label: 'Verified' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'awaiting_verification', label: 'Awaiting Verification' },
  { status: 'completed', label: 'Completed' },
];

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({ currentStatus, history }) => {
  const isRejected = currentStatus === 'rejected';

  // Find step index in standard flow
  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="space-y-6">
      {/* Visual Step Progress (Horizontal on Desktop, stacked on mobile) */}
      {!isRejected ? (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Complaint Lifecycle Progress
          </h4>
          <div className="relative">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div
                    key={step.status}
                    className={`flex flex-col items-center p-2 rounded-lg text-center transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="mb-1">
                      {isPassed && !isCurrent ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold leading-tight">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              Complaint Terminated (Rejected)
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              This request was inspected by the supervisor and rejected with an audit note recorded in the history below.
            </p>
          </div>
        </div>
      )}

      {/* Immutable Audit Log Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Auditable Status History
        </h4>
        <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {history.map((item) => (
            <div key={item.id} className="relative flex items-start gap-4 pl-1">
              <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 flex items-center justify-center shrink-0 z-10 shadow-xs">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              </div>

              <div className="flex-1 bg-white dark:bg-slate-800/90 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.newStatus} size="sm" />
                    <span className="text-xs text-slate-500">
                      by <strong className="text-slate-800 dark:text-slate-200">{item.actorName}</strong> (
                      {item.actorRole})
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.note && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800">
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
