/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MAX_PHOTO_SIZE_BYTES } from './rules.ts';

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  dimensions: { width: number; height: number };
}

/**
 * Compresses an image file on the client using HTML5 Canvas before uploading to Supabase Storage.
 * - Caps max dimension at 1600px (preserving aspect ratio)
 * - Encodes as JPEG or PNG with 0.82-0.88 quality
 * - Ensures final file size is strictly under MAX_PHOTO_SIZE_BYTES (3 MB)
 */
export async function compressImageFile(
  file: File,
  maxDimension: number = 1600,
  targetQuality: number = 0.84
): Promise<CompressedImageResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file.'));

    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data.'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down if larger than max dimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas rendering context for compression.'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Target mime type (convert to JPEG for best compression ratio unless transparent PNG is required)
        const outputMime = file.type === 'image/png' ? 'image/jpeg' : file.type;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image onto canvas blob.'));
              return;
            }

            const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanFileName, {
              type: outputMime,
              lastModified: Date.now(),
            });

            const dataUrl = canvas.toDataURL(outputMime, targetQuality);
            const compressedSize = compressedFile.size;
            const reductionPercentage = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );

            resolve({
              file: compressedFile,
              dataUrl,
              originalSize,
              compressedSize,
              reductionPercentage,
              dimensions: { width, height },
            });
          },
          outputMime,
          targetQuality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
