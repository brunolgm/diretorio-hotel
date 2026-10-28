import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function validateBootstrapManifest(manifest) {
  if (manifest.version !== 1 || !/^[a-z0-9]{20}$/.test(manifest.projectRef) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(manifest.hotelId)
      || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(manifest.namespace) || !Array.isArray(manifest.entries) || manifest.entries.length > 100) throw new Error('invalid_manifest');
  const keys = new Set();
  for (const entry of [...manifest.entries, ...(manifest.media || []).map(m => ({ ...m, domain: 'media' }))]) {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry.key) || keys.has(entry.key)
        || !['service','department','policy','tourism','media','flights'].includes(entry.domain)) throw new Error('invalid_entry');
    keys.add(entry.key);
    if (entry.file && (!/^[a-z0-9-]+\.(png|webp|jpg)$/.test(entry.file) || /golden|mockup/i.test(entry.file))) throw new Error('invalid_asset');
  }
  return manifest;
}
export function ownedLocalAsset(root, filename) {
  if (!/^[a-z0-9-]+\.(png|webp|jpg)$/.test(filename) || /golden|mockup/i.test(filename)) throw new Error('invalid_asset');
  const base = realpathSync(root), asset = realpathSync(resolve(base, filename));
  if (!asset.startsWith(base + sep)) throw new Error('asset_outside_root');
  return asset;
}
export function contentAssetPath(hotelId, slot, bytes, extension) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(hotelId) || !['hero','about','restaurant','accommodation','logo'].includes(slot) || !['jpg','png','webp'].includes(extension)) throw new Error('invalid_asset_path');
  const hex = createHash('sha256').update(bytes).digest('hex').slice(0,32).split('');
  hex[12] = '4'; hex[16] = '8'; const s = hex.join('');
  const uuid = `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
  return slot === 'logo' ? `${hotelId}/logo/${uuid}.${extension}` : `${hotelId}/hero/${slot}/${uuid}.${extension}`;
}
export async function ensureCatalogAirport(client, airport) {
  const allowed = ['iata_code','icao_code','name','city','country_code','timezone','latitude','longitude','is_active'];
  if (Object.keys(airport).some(k => !allowed.includes(k)) || !/^[A-Z]{3}$/.test(airport.iata_code) || !/^[A-Z0-9]{4}$/.test(airport.icao_code)
      || !/^[A-Z]{2}$/.test(airport.country_code) || !Number.isFinite(airport.latitude) || !Number.isFinite(airport.longitude)
      || airport.latitude < -90 || airport.latitude > 90 || airport.longitude < -180 || airport.longitude > 180 || !airport.name || !airport.city) throw new Error('invalid_airport');
  new Intl.DateTimeFormat('en', { timeZone: airport.timezone });
  const read = async () => {
    const r = await client.from('airports').select('*').eq('iata_code', airport.iata_code).maybeSingle();
    if (r.error) throw new Error('catalog_read_failed');
    return r.data;
  };
  let row = await read();
  if (!row) {
    // Existing canonical catalog grants explicitly reserve registration for server service_role.
    // Never update an airport or overwrite a concurrent registration.
    await client.from('airports').insert(airport);
    row = await read();
  }
  if (!row || allowed.some(k => (k === 'latitude' || k === 'longitude') ? Number(row[k]) !== airport[k] : row[k] !== airport[k])) throw new Error('catalog_conflict_requires_review');
  return row.id;
}