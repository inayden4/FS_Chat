/**
 * Media upload service to upload local images and videos to online storage.
 */

export interface UploadResult {
  url: string;
  relativePath?: string;
  fileName?: string;
  size?: number;
  isFallback?: boolean;
}

/**
 * Normalizes any media URL to ensure it resolves and displays correctly in the browser:
 * - Replaces localhost:3000 or 127.0.0.1 with current origin
 * - Resolves relative /uploads/... to current window.location.origin
 * - Upgrades insecure http:// to https:// when running in an HTTPS origin
 * - Preserves data: and blob: URIs
 */
export function normalizeMediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';

  // Data or blob URIs are already self-contained
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const isBrowser = typeof window !== 'undefined';
  const currentOrigin = isBrowser ? window.location.origin : '';
  const isHttps = isBrowser && window.location.protocol === 'https:';

  // If path contains /uploads/
  if (trimmed.includes('/uploads/')) {
    const uploadIndex = trimmed.indexOf('/uploads/');
    const pathPart = trimmed.substring(uploadIndex);
    return isBrowser ? `${currentOrigin}${pathPart}` : pathPart;
  }

  // If starting with /
  if (trimmed.startsWith('/')) {
    return isBrowser ? `${currentOrigin}${trimmed}` : trimmed;
  }

  // If URL contains localhost or 127.0.0.1
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    if (trimmed.includes(':3000/')) {
      const pathPart = trimmed.substring(trimmed.indexOf(':3000/') + 5);
      return isBrowser ? `${currentOrigin}${pathPart}` : pathPart;
    }
  }

  // Upgrade http to https if current page is HTTPS and it points to current domain
  if (isHttps && trimmed.startsWith('http://')) {
    if (isBrowser && trimmed.includes(window.location.host)) {
      return trimmed.replace(/^http:\/\//i, 'https://');
    }
  }

  return trimmed;
}

/**
 * Safely parse multi-line and comma-separated photo URLs without breaking data URIs (which contain commas).
 */
export function parsePhotosInput(input: string | undefined | null): string[] {
  if (!input) return [];
  const lines = String(input)
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('data:')) {
      // Base64 data URLs contain commas after the header (e.g. data:image/png;base64,....)
      result.push(line);
    } else if (line.includes(',') && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('/uploads/'))) {
      const parts = line.split(',').map(p => p.trim()).filter(Boolean);
      result.push(...parts);
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Strips all EXIF metadata (GPS coordinates, camera model, date/time, device serial)
 * from an image file by redrawing it onto a clean HTML Canvas.
 * Returns a new clean File object containing purely the decoded pixel buffer.
 */
export async function stripExifFromImageFile(file: File): Promise<File> {
  // Only process images in a browser environment
  if (!file.type.startsWith('image/') || typeof window === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        // Create an offscreen HTML Canvas matching exact image dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Draw the pure decoded pixel bitmap onto canvas - drops all binary EXIF headers
        ctx.drawImage(img, 0, 0);

        // Determine output mime type
        const mimeType = file.type === 'image/png' ? 'image/png' : (file.type === 'image/webp' ? 'image/webp' : 'image/jpeg');
        const quality = 0.92;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            // Create a clean File with original name, but completely stripped of EXIF tags
            const cleanFile = new File([blob], file.name, {
              type: mimeType,
              lastModified: Date.now()
            });
            resolve(cleanFile);
          },
          mimeType,
          quality
        );
      } catch (err) {
        console.warn('Canvas EXIF stripping error, falling back:', err);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Strips EXIF metadata from a base64 Data URL using HTML Canvas
 */
export async function stripExifFromDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || typeof window === 'undefined') {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const isPng = dataUrl.startsWith('data:image/png');
        const cleanDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92);
        resolve(cleanDataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function uploadMediaFile(file: File): Promise<UploadResult> {
  // CRITICAL PRIVACY: Strip all EXIF metadata (GPS location, device, timestamps) before upload
  let processedFile = file;
  if (file.type.startsWith('image/')) {
    try {
      processedFile = await stripExifFromImageFile(file);
    } catch (e) {
      console.warn('EXIF stripping skipped on error:', e);
    }
  }

  return new Promise((resolve, reject) => {
    // Read clean, sanitized file as Base64 Data URL
    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = reader.result as string;

      try {
        // Attempt upload to backend /api/upload
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileData,
            fileName: processedFile.name,
            fileType: processedFile.type,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && (data.url || data.relativePath)) {
            const rawUrl = data.relativePath || data.url;
            const safeUrl = normalizeMediaUrl(rawUrl);

            resolve({
              url: safeUrl,
              relativePath: data.relativePath,
              fileName: data.fileName,
              size: data.size || processedFile.size,
            });
            return;
          }
        }

        // Fallback: If server returned non-ok, use data URI
        resolve({
          url: fileData,
          fileName: processedFile.name,
          size: processedFile.size,
          isFallback: true,
        });
      } catch (err) {
        console.warn('Network upload error, falling back to local data URI:', err);
        // Fallback to data URI so UX is never blocked
        resolve({
          url: fileData,
          fileName: processedFile.name,
          size: processedFile.size,
          isFallback: true,
        });
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsDataURL(processedFile);
  });
}
