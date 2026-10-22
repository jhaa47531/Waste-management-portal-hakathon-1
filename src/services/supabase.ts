/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const COMPLAINT_STORAGE_BUCKET = 'waste-complaint-photos';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasKey: boolean;
  isValidUrl: boolean;
  urlDisplay: string;
  errorMessage?: string;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const hasUrl = Boolean(rawUrl && rawUrl.length > 0);
  const hasKey = Boolean(rawKey && rawKey.length > 0);

  let isValidUrl = false;
  let errorMessage: string | undefined;

  const isPlaceholderUrl = rawUrl.includes('your-project') || rawUrl.includes('<') || rawUrl.includes('example.com');
  const isPlaceholderKey = rawKey.startsWith('your-anon-') || rawKey.includes('placeholder') || rawKey.length < 35;

  if (hasUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        if (isPlaceholderUrl) {
          errorMessage = 'VITE_SUPABASE_URL contains placeholder "your-project.supabase.co". A real Supabase project URL is required.';
        } else {
          isValidUrl = true;
        }
      } else {
        errorMessage = `VITE_SUPABASE_URL must start with http:// or https:// (received protocol "${parsed.protocol}")`;
      }
    } catch {
      errorMessage = 'VITE_SUPABASE_URL is not a valid URL. It should look like "https://<project-ref>.supabase.co"';
    }
  } else {
    errorMessage = 'VITE_SUPABASE_URL is missing in environment.';
  }

  if (!hasKey && !errorMessage) {
    errorMessage = 'VITE_SUPABASE_ANON_KEY is missing in environment.';
  } else if (hasKey && isPlaceholderKey && !errorMessage) {
    errorMessage = 'VITE_SUPABASE_ANON_KEY is set to a placeholder. A genuine Supabase anon/public JWT key is required.';
  }

  const isConfigured = hasUrl && hasKey && isValidUrl && !isPlaceholderUrl && !isPlaceholderKey;

  return {
    isConfigured,
    hasUrl: hasUrl && !isPlaceholderUrl,
    hasKey: hasKey && !isPlaceholderKey,
    isValidUrl,
    urlDisplay: isValidUrl && !isPlaceholderUrl ? rawUrl : (hasUrl ? `${rawUrl.slice(0, 30)} (placeholder)` : 'Not configured'),
    errorMessage: isConfigured ? undefined : errorMessage,
  };
}

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfigStatus().isConfigured;
};

function initSupabase(): SupabaseClient | null {
  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    return null;
  }
  try {
    return createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = initSupabase();
