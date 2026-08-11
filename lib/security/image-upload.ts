import { randomUUID } from 'node:crypto';

export type SafeImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type SafeImageExtension = 'jpg' | 'png' | 'webp';
export type HotelAssetCategory = 'logo' | 'hero' | 'promotional-banners';

export interface UploadFileLike {
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ImageUploadPolicy {
  maxBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
}

export interface ValidatedImageUpload {
  bytes: Uint8Array;
  mimeType: SafeImageMimeType;
  extension: SafeImageExtension;
  width: number;
  height: number;
}

export type ImageUploadValidation =
  | { ok: true; value: ValidatedImageUpload }
  | { ok: false; reason: 'empty' | 'too_large' | 'unsupported' | 'malformed' | 'dimensions' };

export const IMAGE_UPLOAD_POLICIES = {
  logo: { maxBytes: 5 * 1024 * 1024, maxWidth: 4096, maxHeight: 4096, maxPixels: 16_000_000 },
  hero: { maxBytes: 10 * 1024 * 1024, maxWidth: 8192, maxHeight: 8192, maxPixels: 40_000_000 },
  banner: { maxBytes: 2 * 1024 * 1024, maxWidth: 6000, maxHeight: 4000, maxPixels: 24_000_000 },
} as const satisfies Record<string, ImageUploadPolicy>;

function readUint16BigEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] +
    (bytes[offset + 1] << 8) +
    (bytes[offset + 2] << 16) +
    bytes[offset + 3] * 0x1000000
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function inspectPng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (ascii(bytes, 12, 4) !== 'IHDR' || readUint32BigEndian(bytes, 8) !== 13) return null;
  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  if (![1, 2, 4, 8, 16].includes(bitDepth) || ![0, 2, 3, 4, 6].includes(colorType)) return null;
  return { mimeType: 'image/png' as const, extension: 'png' as const, width, height };
}

function inspectJpeg(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 8) return null;
      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      return { mimeType: 'image/jpeg' as const, extension: 'jpg' as const, width, height };
    }
    offset += segmentLength;
  }

  return null;
}

function inspectWebp(bytes: Uint8Array) {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP' ||
    readUint32LittleEndian(bytes, 4) + 8 > bytes.length
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4);
    const chunkSize = readUint32LittleEndian(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > bytes.length) return null;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        mimeType: 'image/webp' as const,
        extension: 'webp' as const,
        width: readUint24LittleEndian(bytes, dataOffset + 4) + 1,
        height: readUint24LittleEndian(bytes, dataOffset + 7) + 1,
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const bits = readUint32LittleEndian(bytes, dataOffset + 1);
      return {
        mimeType: 'image/webp' as const,
        extension: 'webp' as const,
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    if (
      chunkType === 'VP8 ' &&
      chunkSize >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        mimeType: 'image/webp' as const,
        extension: 'webp' as const,
        width: readUint16LittleEndian(bytes, dataOffset + 6) & 0x3fff,
        height: readUint16LittleEndian(bytes, dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

export async function validateImageUpload(
  file: UploadFileLike,
  policy: ImageUploadPolicy
): Promise<ImageUploadValidation> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return { ok: false, reason: 'empty' };
  if (file.size > policy.maxBytes) return { ok: false, reason: 'too_large' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength > policy.maxBytes) {
    return { ok: false, reason: 'malformed' };
  }

  const inspected = inspectPng(bytes) || inspectJpeg(bytes) || inspectWebp(bytes);
  if (!inspected) return { ok: false, reason: 'unsupported' };
  if (file.type && file.type !== inspected.mimeType) return { ok: false, reason: 'malformed' };

  const { width, height } = inspected;
  if (
    width <= 0 ||
    height <= 0 ||
    width > policy.maxWidth ||
    height > policy.maxHeight ||
    width * height > policy.maxPixels
  ) {
    return { ok: false, reason: 'dimensions' };
  }

  return { ok: true, value: { bytes, ...inspected } };
}

export function buildHotelAssetStoragePath({
  hotelId,
  category,
  extension,
  resourceId,
  uniqueId = randomUUID(),
}: {
  hotelId: string;
  category: HotelAssetCategory;
  extension: SafeImageExtension;
  resourceId?: string;
  uniqueId?: string;
}) {
  const resourceSegment = resourceId ? `${resourceId}/` : '';
  return `${hotelId}/${category}/${resourceSegment}${uniqueId}.${extension}`;
}

export function extractOwnedHotelAssetPath({
  publicUrl,
  hotelId,
  category,
}: {
  publicUrl: string | null | undefined;
  hotelId: string;
  category: HotelAssetCategory;
}) {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const marker = '/storage/v1/object/public/hotel-assets/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    const modernPrefix = `${hotelId}/${category}/`;
    const isLegacyLogo = category === 'logo' && path.startsWith(`${hotelId}/logo.`);
    const isLegacyHero = category === 'hero' && path.startsWith(`${hotelId}/hero.`);
    return path.startsWith(modernPrefix) || isLegacyLogo || isLegacyHero ? path : null;
  } catch {
    return null;
  }
}
