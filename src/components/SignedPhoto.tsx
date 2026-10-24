/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { portalStore } from '../services/store.ts';
import { Camera, RefreshCw, ZoomIn, X, AlertTriangle } from 'lucide-react';

interface SignedPhotoProps {
  src?: string;
  storagePath?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  allowZoom?: boolean;
}

export const SignedPhoto: React.FC<SignedPhotoProps> = ({
  src,
  storagePath,
  alt,
  className = 'w-full h-44 object-cover rounded-xl',
  fallbackText = 'Photo unavailable',
  allowZoom = true,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    // Check if initial src is already a valid absolute URL with signed parameters or data URI
    const isDirectUsableUrl =
      src &&
      (src.startsWith('data:') ||
        src.startsWith('blob:') ||
        (src.startsWith('http') && (src.includes('token=') || src.includes('sign/'))));

    if (isDirectUsableUrl) {
      setResolvedUrl(src);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    // Determine path to sign
    const targetPath = storagePath || (src && !src.startsWith('http') && !src.startsWith('data:') ? src : '');

    if (!targetPath) {
      if (src && src.startsWith('http')) {
        setResolvedUrl(src);
        setIsLoading(false);
        setHasError(false);
        return;
      }
      setHasError(true);
      setErrorMessage(fallbackText);
      setIsLoading(false);
      return;
    }

    // Resolve signed URL via portalStore (which uses Supabase Storage + signed URL cache + server fallback)
    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);

    portalStore
      .getPhotoSignedUrl(targetPath)
      .then((signed) => {
        if (!isCancelled) {
          if (signed) {
            setResolvedUrl(signed);
            setHasError(false);
          } else {
            setHasError(true);
            setErrorMessage('Unable to generate signed access URL for private storage object.');
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setHasError(true);
          setErrorMessage(err?.message || 'Access denied or photo not found in bucket.');
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [src, storagePath, fallbackText]);

  const handleRetry = () => {
    const targetPath = storagePath || src || '';
    if (!targetPath) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);

    // Invalidate any stale cache entry
    portalStore.clearSignedUrlCache(targetPath);

    portalStore
      .getPhotoSignedUrl(targetPath)
      .then((signed) => {
        if (signed) {
          setResolvedUrl(signed);
          setHasError(false);
        } else {
          setHasError(true);
          setErrorMessage('Unable to generate signed URL.');
        }
      })
      .catch((err) => {
        setHasError(true);
        setErrorMessage(err?.message || 'Failed to load photo.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleImageError = () => {
    // If the image failed to load with the current URL, try refreshing the signed URL once
    if (storagePath || (src && !src.startsWith('data:'))) {
      const targetPath = storagePath || src || '';
      portalStore.clearSignedUrlCache(targetPath);
      portalStore
        .getPhotoSignedUrl(targetPath)
        .then((newUrl) => {
          if (newUrl && newUrl !== resolvedUrl) {
            setResolvedUrl(newUrl);
            setHasError(false);
          } else {
            setHasError(true);
            setErrorMessage('Image failed to render. Storage object may be inaccessible.');
          }
        })
        .catch(() => {
          setHasError(true);
          setErrorMessage('Failed to reload photo.');
        });
    } else {
      setHasError(true);
      setErrorMessage('Image failed to load.');
    }
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/80 animate-pulse text-slate-400 ${className}`}>
        <RefreshCw className="w-5 h-5 animate-spin mb-1.5 text-slate-400" />
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Loading secure photo...</span>
      </div>
    );
  }

  if (hasError || !resolvedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-3 text-center bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 ${className}`}>
        <AlertTriangle className="w-5 h-5 mb-1 text-amber-500 dark:text-amber-400" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-2">
          {errorMessage || fallbackText}
        </span>
        {(storagePath || src) && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="relative group overflow-hidden rounded-xl">
        <img
          src={resolvedUrl}
          alt={alt}
          className={className}
          onError={handleImageError}
          loading="lazy"
        />
        {allowZoom && (
          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900 shadow-md cursor-pointer"
            title="Inspect full image"
            aria-label="Inspect full image"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Full-screen Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-900 shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-slate-900/90 text-white hover:bg-slate-800 cursor-pointer shadow-lg transition-colors"
              aria-label="Close zoom preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={resolvedUrl}
              alt={alt}
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-xl"
            />
            <div className="p-3 text-center text-xs font-semibold text-slate-300">
              {alt}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
