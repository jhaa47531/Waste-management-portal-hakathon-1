/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title: string; description?: string; durationMs?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type = 'info',
      title,
      description,
      durationMs = 4000,
    }: {
      type?: ToastType;
      title: string;
      description?: string;
      durationMs?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastMessage = { id, type, title, description };

      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (durationMs > 0) {
        setTimeout(() => {
          removeToast(id);
        }, durationMs);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, description?: string) => toast({ type: 'success', title, description }),
    [toast]
  );

  const error = useCallback(
    (title: string, description?: string) => toast({ type: 'error', title, description }),
    [toast]
  );

  const warning = useCallback(
    (title: string, description?: string) => toast({ type: 'warning', title, description }),
    [toast]
  );

  const info = useCallback(
    (title: string, description?: string) => toast({ type: 'info', title, description }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast Render Container */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const typeConfig = {
            success: {
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
              border: 'border-emerald-300 dark:border-emerald-500/30',
              bg: 'bg-white dark:bg-[#0f1715]/95',
              glow: 'shadow-md dark:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
            },
            error: {
              icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
              border: 'border-rose-300 dark:border-rose-500/30',
              bg: 'bg-white dark:bg-[#181014]/95',
              glow: 'shadow-md dark:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
            },
            warning: {
              icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
              border: 'border-amber-300 dark:border-amber-500/30',
              bg: 'bg-white dark:bg-[#18150f]/95',
              glow: 'shadow-md dark:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
            },
            info: {
              icon: <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />,
              border: 'border-cyan-300 dark:border-cyan-500/30',
              bg: 'bg-white dark:bg-[#0f1619]/95',
              glow: 'shadow-md dark:shadow-[0_0_20px_rgba(6,182,212,0.15)]',
            },
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border ${typeConfig.border} ${typeConfig.bg} ${typeConfig.glow} backdrop-blur-md text-slate-900 dark:text-slate-100 flex items-start gap-3 transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              <div className="mt-0.5">{typeConfig.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono-display uppercase tracking-wider font-bold text-slate-900 dark:text-slate-100">
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed break-words">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return context;
}
