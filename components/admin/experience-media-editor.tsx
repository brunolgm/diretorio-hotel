'use client';

import { useEffect, useState } from 'react';
import { EXPERIENCE_MEDIA_SLOTS, EXPERIENCE_MEDIA_UPLOAD_MAX_BYTES, focalPosition, type ExperienceMedia } from '@/lib/public-experience-media';

const labels = { hero: 'Hero', about: 'Conheça o hotel', restaurant: 'Gastronomia', accommodation: 'Acomodações' };

function FocalPicker({ mobile, url, x, y }: { mobile: boolean; url: string | null; x: number; y: number }) {
  const [point, setPoint] = useState({ x, y });
  const prefix = mobile ? 'mobile_focal' : 'focal';
  return <fieldset className="min-w-0 space-y-3 rounded-xl border p-3">
    <legend>{mobile ? 'Enquadramento mobile' : 'Enquadramento desktop'}</legend>
    {url ? <>
      <button type="button" className="relative block w-full overflow-hidden rounded-lg" aria-label="Selecionar ponto focal na fotografia" onClick={event => {
        if (!event.detail) return; // Keyboard users have the labelled X/Y sliders.
        const box = event.currentTarget.getBoundingClientRect();
        const coordinate = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
        setPoint({ x: coordinate((event.clientX - box.left) / box.width * 100), y: coordinate((event.clientY - box.top) / box.height * 100) });
      }}>
        {/* Original aspect ratio makes click coordinates refer to the photograph. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Fotografia completa para seleção do ponto focal" className="block h-auto w-full" />
        <span aria-hidden className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/60 ring-2 ring-black" style={{ left: `${point.x}%`, top: `${point.y}%` }} />
      </button>
      <p className="text-sm">Prévia do recorte</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Prévia do enquadramento" className={`w-full rounded-lg object-cover ${mobile ? 'aspect-[3/4] max-w-52' : 'aspect-[16/7]'}`} style={{ objectPosition: focalPosition(point.x, point.y) }} />
    </> : <p className="text-sm text-[var(--admin-muted)]">Sem fotografia: o tema usa o fallback.</p>}
    {(['x', 'y'] as const).map(axis => <label key={axis} className="block text-sm">Ponto {axis.toUpperCase()}: {point[axis]}%
      <input className="block w-full" aria-label={`${mobile ? 'Mobile' : 'Desktop'} ponto ${axis.toUpperCase()}`} type="range" name={`${prefix}_${axis}`} min="0" max="100" value={point[axis]} onChange={e => setPoint({ ...point, [axis]: Number(e.target.value) })} />
    </label>)}
  </fieldset>;
}

function MediaForm({ slot, row, urls, action }: { slot: typeof EXPERIENCE_MEDIA_SLOTS[number]; row?: ExperienceMedia; urls: { desktop: string | null; mobile: string | null }; action: (form: FormData) => Promise<void> }) {
  const [desktop, setDesktop] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [uploadSizes, setUploadSizes] = useState({ desktop: 0, mobile: 0 });
  const tooLarge = uploadSizes.desktop + uploadSizes.mobile > EXPERIENCE_MEDIA_UPLOAD_MAX_BYTES;
  useEffect(() => () => { if (desktop) URL.revokeObjectURL(desktop); }, [desktop]);
  useEffect(() => () => { if (mobile) URL.revokeObjectURL(mobile); }, [mobile]);
  return <form action={action} className="min-w-0 space-y-4 rounded-2xl border border-[var(--admin-border)] p-4">
    <h3 className="text-lg font-semibold">{labels[slot]}</h3>
    <input type="hidden" name="slot" value={slot} /><input type="hidden" name="revision" value={row?.revision ?? 0} />
    <label className="block">Título<input name="title" defaultValue={row?.title} maxLength={160} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block">Texto editorial<textarea name="description" defaultValue={row?.description} maxLength={4000} rows={3} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block">Texto alternativo da fotografia<input name="alt_text" defaultValue={row?.alt_text} maxLength={300} className="mt-1 block w-full rounded border p-2" /></label>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <label className="block min-w-0">Fotografia desktop<input className="mt-1 block w-full text-sm" type="file" name="desktop_image" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; setDesktop(file ? URL.createObjectURL(file) : null); setUploadSizes(sizes => ({ ...sizes, desktop: file?.size ?? 0 })); }} /></label>
      <label className="block min-w-0">Fotografia mobile (opcional)<input className="mt-1 block w-full text-sm" type="file" name="mobile_image" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; setMobile(file ? URL.createObjectURL(file) : null); setUploadSizes(sizes => ({ ...sizes, mobile: file?.size ?? 0 })); }} /></label>
      <label><input type="checkbox" name="remove_image_path" /> Remover fotografia desktop</label>
      <label><input type="checkbox" name="remove_mobile_image_path" /> Remover fotografia mobile</label>
      <FocalPicker url={desktop ?? urls.desktop} mobile={false} x={row?.focal_x ?? 50} y={row?.focal_y ?? 50} />
      <FocalPicker url={mobile ?? urls.mobile ?? desktop ?? urls.desktop} mobile x={row?.mobile_focal_x ?? 50} y={row?.mobile_focal_y ?? 50} />
    </div>
    <p className="text-sm">JPEG, PNG ou WebP, até 2 MiB de imagens por envio; 8192 × 8192 e 40 milhões de pixels. Você pode enviar as variantes em salvamentos separados. Sem imagem mobile, a imagem desktop é reutilizada. O tratamento visual é automático pelo tema.</p>
    {tooLarge ? <p role="alert" className="text-red-700">As imagens selecionadas ultrapassam 2 MiB. Otimize os arquivos ou envie as variantes separadamente.</p> : null}
    <label className="block">Rótulo do link<input name="cta_label" defaultValue={row?.cta_label} maxLength={80} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block">Destino HTTPS (opcional)<input type="url" name="cta_url" defaultValue={row?.cta_url ?? ''} maxLength={2048} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block"><input type="checkbox" name="is_published" defaultChecked={row?.is_published} /> Publicar este bloco</label>
    <button disabled={tooLarge} className="rounded-lg bg-[var(--admin-accent)] px-4 py-3 text-[var(--admin-accent-text)] disabled:opacity-50" type="submit">Salvar {labels[slot]}</button>
  </form>;
}

export function ExperienceMediaEditor({ rows, urls, action }: { rows: ExperienceMedia[]; urls: Record<string, { desktop: string | null; mobile: string | null }>; action: (form: FormData) => Promise<void> }) {
  return <section className="space-y-4" aria-label="Mídia e conteúdo da experiência pública">
    <h2 className="text-xl font-semibold">Mídia e conteúdo da experiência pública</h2>
    <p>Composição disponível no Bugan V3. Outras marcas mantêm sua apresentação atual. Textos são fonte PT; não há tradução automática neste formulário.</p>
    {EXPERIENCE_MEDIA_SLOTS.map(slot => <MediaForm key={`${slot}-${rows.find(row => row.slot === slot)?.revision ?? 0}`} slot={slot} row={rows.find(row => row.slot === slot)} urls={urls[slot] ?? { desktop: null, mobile: null }} action={action} />)}
  </section>;
}
