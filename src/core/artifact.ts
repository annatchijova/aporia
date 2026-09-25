export const MAX_IMAGE_BYTES = 1_500_000;
export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export function isSupportedImageMime(value: unknown): value is SupportedImageMime {
  return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp';
}

export function decodeImageBase64(value: unknown, mimeType: unknown): { data: string; byteLength: number; mimeType: SupportedImageMime } {
  if (!isSupportedImageMime(mimeType) || typeof value !== 'string' || value.length === 0 || value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4) {
    throw new Error('unsupported or oversized image');
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new Error('invalid image encoding');
  let bytes: string;
  try { bytes = atob(value); } catch { throw new Error('invalid image encoding'); }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new Error('image exceeds 1500000 bytes');
  const matches = mimeType === 'image/png'
    ? bytes.startsWith('\x89PNG\r\n\x1a\n')
    : mimeType === 'image/jpeg'
      ? bytes.startsWith('\xff\xd8\xff')
      : bytes.length >= 12 && bytes.startsWith('RIFF', 0) && bytes.startsWith('WEBP', 8);
  if (!matches) throw new Error('image content does not match its declared type');
  return { data: value, byteLength: bytes.length, mimeType };
}
