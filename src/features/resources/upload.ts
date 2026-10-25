import type { MessageKey } from '../../lib/i18n';

// File rules (spec section 9 and decision 15): 25MB, PDF, images, Word / Excel / PowerPoint.
// The bucket enforces the same limits; checking here gives a clear message before uploading.

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 2500;

const TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const ALLOWED_TYPES = new Set(Object.values(TYPES_BY_EXTENSION));

/** For the file picker's accept attribute. */
export const ACCEPT = [
  ...Object.keys(TYPES_BY_EXTENSION).map((ext) => `.${ext}`),
  ...ALLOWED_TYPES,
].join(',');

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** The file's MIME type; some browsers leave it empty (often for HEIC), so fall back to the extension. */
export function mimeTypeOf(file: File): string {
  return file.type || TYPES_BY_EXTENSION[extensionOf(file.name)] || '';
}

export function validateFile(file: File): MessageKey | null {
  if (!ALLOWED_TYPES.has(mimeTypeOf(file))) return 'resources.fileType';
  if (file.size > MAX_FILE_BYTES) return 'resources.fileTooBig';
  return null;
}

/**
 * Storage keys accept only a safe ASCII subset, so the object name keeps the extension and replaces
 * other characters; the original (often Hebrew) name is kept in files.original_name.
 */
export function storageName(name: string): string {
  const ext = extensionOf(name);
  const base = (ext ? name.slice(0, -(ext.length + 1)) : name)
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}${ext ? `.${ext}` : ''}`;
}

/** 1.2 MB, 340 KB */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Photos larger than 2500px on the long side are scaled down in the browser before upload (spec
 * section 9). HEIC cannot be decoded by most browsers, so it is uploaded as is.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  const type = mimeTypeOf(file);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = MAX_IMAGE_PIXELS / Math.max(bitmap.width, bitmap.height);
  if (scale >= 1) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  return blob && blob.size < file.size ? blob : file;
}
