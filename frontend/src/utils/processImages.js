import heic2any from 'heic2any';

function isHeicFile(file) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

// Try native browser decoding (works on Safari/macOS/iOS natively).
// Falls back to heic2any (WASM) which handles Chrome on Windows.
// Processes one file at a time to avoid WASM memory exhaustion.
async function maybeConvertHeic(file) {
  if (!isHeicFile(file)) return file;

  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

  // 1. Try native createImageBitmap — zero cost on Apple platforms
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        0.85
      );
    });
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    // Native decoding not supported (e.g. Chrome on Windows) — try WASM fallback
  }

  // 2. heic2any WASM fallback
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const result = Array.isArray(blob) ? blob[0] : blob;
  return new File([result], newName, { type: 'image/jpeg' });
}

/**
 * Validates and converts (HEIC→JPEG) an array of File objects.
 * HEIC files are converted sequentially to avoid WASM memory exhaustion.
 * Returns { validFiles: File[], errors: string[] }
 */
export async function processImageFiles(files, maxFileSize) {
  const validFiles = [];
  const errors = [];

  for (const file of files) {
    const isHeic = isHeicFile(file);
    if (!isHeic && !file.type.startsWith('image/')) {
      errors.push(`${file.name} is not an image file`);
      continue;
    }
    if (file.size > maxFileSize) {
      const mb = Math.round(maxFileSize / 1024 / 1024);
      errors.push(`${file.name} is too large (max ${mb}MB)`);
      continue;
    }
    try {
      const converted = await maybeConvertHeic(file);
      validFiles.push(converted);
    } catch {
      errors.push(`${file.name} could not be converted. Please export as JPG or PNG first.`);
    }
  }

  return { validFiles, errors };
}
