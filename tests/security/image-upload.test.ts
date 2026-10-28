import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHotelAssetStoragePath,
  IMAGE_UPLOAD_POLICIES,
  validateImageUpload,
  isOwnedTourismImagePath,
  extractOwnedHotelAssetPath,
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

test('tourism paths enforce hotel/item ownership without changing existing asset namespaces', () => {
  const hotelId = '52100000-0000-4000-8000-000000000001';
  const resourceId = '52130000-0000-4000-8000-000000000001';
  const uniqueId = '52140000-0000-4000-8000-000000000001';
  const path = buildHotelAssetStoragePath({ hotelId, resourceId, uniqueId, category: 'tourism', extension: 'png' });
  assert.equal(path, `${hotelId}/tourism/${resourceId}/${uniqueId}.png`);
  for (const extension of ['jpg', 'jpeg', 'png', 'webp']) assert.ok(isOwnedTourismImagePath(path.replace('.png', `.${extension}`), hotelId, resourceId));
  for (const bad of [path + '\n', path + '/extra', path.replace('.png', '.svg'), `https://example.com/${path}`, path.replace(resourceId, uniqueId), path.replace(hotelId, uniqueId), '../image.png']) assert.equal(isOwnedTourismImagePath(bad, hotelId, resourceId), false);
  assert.throws(() => buildHotelAssetStoragePath({ hotelId, uniqueId, category: 'tourism', extension: 'png' }));
  for (const category of ['logo', 'hero', 'promotional-banners'] as const) {
    const oldPath = buildHotelAssetStoragePath({ hotelId, category, uniqueId: 'synthetic-id', extension: 'png' });
    assert.equal(oldPath, `${hotelId}/${category}/synthetic-id.png`);
    assert.equal(extractOwnedHotelAssetPath({ hotelId, category, publicUrl: `https://example.com/storage/v1/object/public/hotel-assets/${oldPath}` }), oldPath);
  }
});

test('tourism image policy accepts real supported formats and rejects limits/spoofing', async () => {
  const policy = IMAGE_UPLOAD_POLICIES.tourism;
  assert.deepEqual(policy, { maxBytes: 2097152, maxWidth: 6000, maxHeight: 4000, maxPixels: 24000000 });
  assert.deepEqual(policy, IMAGE_UPLOAD_POLICIES.banner);
  for (const [bytes, mime] of [[png(6000, 4000), 'image/png'], [jpeg(), 'image/jpeg'], [webp(), 'image/webp']] as const) assert.equal((await validateImageUpload(fileLike(bytes, mime), policy)).ok, true);
  for (const file of [fileLike(png(6001, 1), 'image/png'), fileLike(png(1, 4001), 'image/png'), fileLike(png(), 'image/jpeg'), fileLike(png(), 'image/png', policy.maxBytes + 1), fileLike(new TextEncoder().encode('<svg/>'), 'image/svg+xml')]) assert.equal((await validateImageUpload(file, policy)).ok, false);
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

test('tourism pixel ceiling is enforced independently of side limits', async () => {
  const policy = { ...IMAGE_UPLOAD_POLICIES.tourism, maxWidth: 10000, maxHeight: 10000 };
  assert.deepEqual(await validateImageUpload(fileLike(png(5000,5000), 'image/png'), policy), { ok: false, reason: 'dimensions' });
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
