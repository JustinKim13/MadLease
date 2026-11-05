/**
 * Resizes an image File to fit within maxDimension × maxDimension (longest side),
 * preserving aspect ratio. Returns the original file untouched if:
 *   - the image is already within bounds
 *   - the file type isn't canvas-serializable (HEIC, AVIF, etc.)
 *   - anything goes wrong (fail-safe)
 *
 * Output type matches input type so the S3 presigned URL content-type stays valid.
 */
export function resizeImage(file, maxDimension = 1080) {
  const canvasTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!canvasTypes.includes(file.type.toLowerCase())) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;

      if (w <= maxDimension && h <= maxDimension) {
        resolve(file);
        return;
      }

      const scale = maxDimension / Math.max(w, h);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = outputType === 'image/jpeg' ? 0.85 : undefined;

      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
