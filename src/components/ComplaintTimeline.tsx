/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComplaintStatus, ComplaintStatusHistory } from '../types/index.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { CheckCircle2, Clock, AlertCircle, Radio } from 'lucide-react';

interface ComplaintTimelineProps {
  currentStatus: ComplaintStatus;
  history: ComplaintStatusHistory[];
}

const LIFECYCLE_STEPS: { status: ComplaintStatus; code: string; label: string }[] = [
  { status: 'submitted', code: '01', label: 'SUBMITTED' },
  { status: 'verified', code: '02', label: 'VERIFIED' },
  { status: 'assigned', code: '03', label: 'ASSIGNED' },
  { status: 'in_progress', code: '04', label: 'IN PROGRESS' },
  { status: 'awaiting_verification', code: '05', label: 'AUDITING' },
  { status: 'completed', code: '06', label: 'RESOLVED' },
];

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({ currentStatus, history }) => {
  const isRejected = currentStatus === 'rejected';
  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="space-y-5 text-slate-100">
      {/* Pipeline Stepper */}
      {!isRejected ? (
        <div className="bg-[#12161c] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <h4 className="font-mono-display uppercase tracking-widest text-[11px] font-bold text-slate-300">
                LIFECYCLE PIPELINE
              </h4>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              STAGE {Math.max(1, currentStepIndex + 1)} OF 6
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
                      ? 'bg-emerald-950/80 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)] text-emerald-300'
                      : isPassed
                      ? 'bg-[#151a22] border border-emerald-500/20 text-emerald-400/80'
                      : 'bg-[#0f1217] border border-white/5 text-slate-500'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-center">
                    {isCurrent ? (
                      <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    ) : isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="font-mono text-[11px] font-bold text-slate-600">
                        {step.code}
                      </span>
                    )}
                  </div>
                  <span className="font-mono-display text-[10px] tracking-wider uppercase font-bold leading-tight">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-3 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-mono-display uppercase tracking-wider text-xs font-bold text-rose-300">
              STATUS: REJECTED BY SUPERVISOR
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              This request was inspected by the municipal supervisor and marked as non-actionable or invalid. Refer to the immutable audit trail below for recorded rationale.
            </p>
          </div>
        </div>
      )}

      {/* Immutable Audit Log Timeline */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="font-mono-display text-[10px] text-slate-500 font-bold">HIST</span>
          <h4 className="font-mono-display uppercase tracking-widest text-[11px] font-bold text-slate-400">
            AUDIT TRAIL ({history.length} EVENTS)
          </h4>
        </div>

        <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-px before:bg-white/10">
          {history.map((item, idx) => (
            <div key={item.id || idx} className="relative flex items-start gap-3.5 pl-1">
              <div className="w-6 h-6 rounded-full bg-[#0b0d10] border border-emerald-500/40 flex items-center justify-center shrink-0 z-10 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>

              <div className="flex-1 bg-[#12161c] p-3.5 rounded-xl border border-white/[0.08] shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.newStatus} size="sm" />
                    <span className="text-xs text-slate-400 font-mono">
                      by <strong className="text-white font-semibold">{item.actorName}</strong> ({item.actorRole.toUpperCase()})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                {item.note && (
                  <p className="text-xs text-slate-300 bg-[#0b0d10] p-2.5 rounded-lg border border-white/5 leading-relaxed font-sans">
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
