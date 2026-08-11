import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHotelAssetStoragePath,
  IMAGE_UPLOAD_POLICIES,
  validateImageUpload,
} from '../../lib/security/image-upload.ts';

function fileLike(bytes: Uint8Array, type: string, declaredSize = bytes.byteLength) {
  return {
    size: declaredSize,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function png(width = 32, height = 24) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

function jpeg(width = 40, height = 30) {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
  ]);
}

function webp(width = 50, height = 25) {
  const bytes = new Uint8Array(30);
  bytes.set([...Buffer.from('RIFF'), 22, 0, 0, 0, ...Buffer.from('WEBPVP8X'), 10, 0, 0, 0]);
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes.set([widthMinusOne & 0xff, (widthMinusOne >> 8) & 0xff, (widthMinusOne >> 16) & 0xff], 24);
  bytes.set([heightMinusOne & 0xff, (heightMinusOne >> 8) & 0xff, (heightMinusOne >> 16) & 0xff], 27);
  return bytes;
}

test('accepts valid PNG, JPEG and WebP signatures with dimensions', async () => {
  for (const [bytes, type] of [
    [png(), 'image/png'],
    [jpeg(), 'image/jpeg'],
    [webp(), 'image/webp'],
  ] as const) {
    const result = await validateImageUpload(fileLike(bytes, type), IMAGE_UPLOAD_POLICIES.logo);
    assert.equal(result.ok, true);
  }
});

test('rejects false MIME, empty, oversized and SVG/HTML payloads', async () => {
  assert.equal((await validateImageUpload(fileLike(png(), 'image/jpeg'), IMAGE_UPLOAD_POLICIES.logo)).ok, false);
  assert.equal((await validateImageUpload(fileLike(new Uint8Array(), 'image/png'), IMAGE_UPLOAD_POLICIES.logo)).ok, false);
  assert.equal(
    (await validateImageUpload(fileLike(png(), 'image/png', IMAGE_UPLOAD_POLICIES.logo.maxBytes + 1), IMAGE_UPLOAD_POLICIES.logo)).ok,
    false
  );
  const svg = new TextEncoder().encode('<svg><script>alert(1)</script></svg>');
  assert.equal((await validateImageUpload(fileLike(svg, 'image/svg+xml'), IMAGE_UPLOAD_POLICIES.logo)).ok, false);
  const html = new TextEncoder().encode('<html><body>not an image</body></html>');
  assert.equal((await validateImageUpload(fileLike(html, 'image/png'), IMAGE_UPLOAD_POLICIES.logo)).ok, false);
});

test('rejects excessive dimensions and generates server-owned paths', async () => {
  const result = await validateImageUpload(
    fileLike(png(5000, 5000), 'image/png'),
    IMAGE_UPLOAD_POLICIES.logo
  );
  assert.equal(result.ok, false);
  assert.equal(
    buildHotelAssetStoragePath({
      hotelId: '10000000-0000-4000-8000-000000000001',
      category: 'logo',
      extension: 'png',
      uniqueId: 'synthetic-id',
    }),
    '10000000-0000-4000-8000-000000000001/logo/synthetic-id.png'
  );
});
