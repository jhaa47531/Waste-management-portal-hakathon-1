/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { isSupabaseConfigured } from '../services/supabase.ts';
import { X, Database, ShieldCheck, Check, Copy, ExternalLink, Terminal } from 'lucide-react';

interface SupabaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseGuideModal: React.FC<SupabaseGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'migrations' | 'env'>('status');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(label);
    setTimeout(() => setCopiedFile(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Supabase Backend & Security Architecture
              </h3>
              <p className="text-xs text-slate-500">
                PostgreSQL Schema, RLS, Storage, Triggers & Setup Guide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Connection Status
          </button>
          <button
            onClick={() => setActiveTab('migrations')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'migrations'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            SQL Migrations (1 to 5)
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'env'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Environment & Secrets (.env)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'status' && (
            <div className="space-y-5">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  isConfigured
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-sm">
                    {isConfigured
                      ? 'Live Supabase Credentials Connected'
                      : 'Dual-Engine Architecture: Interactive Sandbox Mode Active'}
                  </p>
                  <p>
                    {isConfigured
                      ? 'App queries your live Supabase PostgreSQL database, RLS policies, and private storage bucket.'
                      : 'No live VITE_SUPABASE_URL was provided in .env.local, so the application runs on its deterministic, zero-latency in-memory store while executing the exact same RLS constraints, GPS validations, and photo limits. All 5 SQL migration files are generated in /supabase/migrations/ ready to deploy!'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" /> 7 Database Tables
                  </h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                    <li><code className="text-blue-600">profiles</code> (Role, Auth user link)</li>
                    <li><code className="text-blue-600">localities</code> (Controlled dropdown)</li>
                    <li><code className="text-blue-600">cleaner_applications</code> (Approval flow)</li>
                    <li><code className="text-blue-600">cleaner_service_areas</code> (Area approval)</li>
                    <li><code className="text-blue-600">complaints</code> (WPR tracking, GPS)</li>
                    <li><code className="text-blue-600">complaint_photos</code> (Private storage)</li>
                    <li><code className="text-blue-600">complaint_status_history</code> (Audit log)</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Strict Security Invariants
                  </h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                    <li>Public signup always assigns <code>resident</code></li>
                    <li>Cleaners see only assigned complaints</li>
                    <li>Mandatory GPS & &lt;= 3MB photo verification</li>
                    <li>Cleaners cannot assign or approve work</li>
                    <li>Immutable audit history trigger</li>
                    <li>Cleaners only dispatched to approved areas</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'migrations' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Execute these migration files in sequential order in your Supabase SQL Editor:
              </p>

              <div className="space-y-3">
                {[
                  {
                    file: '01_initial_schema.sql',
                    title: '1. Initial Schema & Constraints',
                    desc: 'Enums, tables, foreign keys, GPS and photo size CHECK constraints, indexes.',
                  },
                  {
                    file: '02_storage_setup.sql',
                    title: '2. Private Storage & Bucket Policies',
                    desc: 'Creates private waste-complaint-photos bucket and folder-level upload/read policies.',
                  },
                  {
                    file: '03_functions_and_triggers.sql',
                    title: '3. Functions, Triggers & Atomic RPCs',
                    desc: 'WPR code generator, auth signup hook, immutable audit trigger, and transition RPCs.',
                  },
                  {
                    file: '04_rls_policies.sql',
                    title: '4. Row Level Security (RLS)',
                    desc: 'Granular access controls on every table for resident, cleaner, supervisor, and admin.',
                  },
                  {
                    file: '05_seed_data.sql',
                    title: '5. Initial Seed Localities',
                    desc: 'Pre-populates municipal wards and sectors.',
                  },
                ].map((item) => (
                  <div
                    key={item.file}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        /supabase/migrations/{item.file}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>

                    <button
                      onClick={() => handleCopy(`/supabase/migrations/${item.file}`, item.file)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 shrink-0"
                    >
                      {copiedFile === item.file ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied Path
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Path
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                To link your live Supabase project, create a <code>.env.local</code> file in the project root:
              </p>
              <div className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs relative">
                <pre>{`VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}</pre>
                <button
                  onClick={() =>
                    handleCopy(
                      `VITE_SUPABASE_URL="https://your-project-id.supabase.co"\nVITE_SUPABASE_ANON_KEY="your-anon-key"`,
                      'env'
                    )
                  }
                  className="absolute top-3 right-3 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1"
                >
                  {copiedFile === 'env' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
              <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 flex items-start gap-2">
                <Terminal className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Security Note:</strong> Always use the Supabase <em>publishable/anon</em> key in the frontend. Never expose the <em>service_role</em> key.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
