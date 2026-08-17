'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { HOTEL_THEME_PRESETS } from '@/lib/hotel-theme';
import { BASELINE_MODULE_KEYS, MODULE_CATALOG, MODULE_GROUP_LABELS } from '@/lib/modules/catalog';
import { PLATFORM_HOTEL_BRANDS, getPlatformHotelBrandLabel } from '@/lib/platform-governance';
import { generateHotelSlug, generateHotelSubdomain, ONBOARDING_LIMITS } from '@/lib/platform-onboarding';
import { createPlatformHotelOnboardingAction } from './actions';
import { INITIAL_ONBOARDING_STATE } from './state';

const steps = ['Identidade', 'Endereço', 'Módulos', 'Administrador', 'Revisão'] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">{pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}{pending ? 'Criando...' : 'Criar hotel em preparação'}</button>;
}

export function PlatformHotelOnboardingForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createPlatformHotelOnboardingAction, INITIAL_ONBOARDING_STATE);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [slug, setSlug] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [subdomainEdited, setSubdomainEdited] = useState(false);
  const [brandCode, setBrandCode] = useState('');
  const [themePreset, setThemePreset] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  function updateName(value: string) {
    setName(value);
    const generatedSlug = generateHotelSlug(value);
    if (!slugEdited) setSlug(generatedSlug);
    if (!subdomainEdited) setSubdomain(generateHotelSubdomain(generatedSlug));
  }

  function continueToNextStep() {
    const controls = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      `[data-onboarding-step="${step}"] input, [data-onboarding-step="${step}"] select`
    );
    for (const control of controls || []) {
      if (!control.reportValidity()) return;
    }
    setStep((value) => Math.min(steps.length - 1, value + 1));
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <ol className="grid gap-2 sm:grid-cols-5" aria-label="Etapas do onboarding">
        {steps.map((label, index) => <li key={label} className={index === step ? 'rounded-2xl bg-slate-950 px-3 py-3 text-xs font-semibold text-white' : index < step ? 'rounded-2xl bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-700' : 'rounded-2xl bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-500'}><span className="mr-2">{index < step ? <Check className="inline h-3.5 w-3.5" /> : index + 1}</span>{label}</li>)}
      </ol>

      {state.error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{state.error}</div> : null}

      <section data-onboarding-step="0" hidden={step !== 0} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-xl font-semibold text-slate-950">Identidade</h2><p className="mt-2 text-sm text-slate-600">Dados mínimos e identidade visual inicial.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Nome do hotel<input name="name" value={name} onChange={(event) => updateName(event.target.value)} required maxLength={ONBOARDING_LIMITS.name} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:ring-2 focus:ring-slate-200" /></label>
          <label className="text-sm font-medium text-slate-700">Cidade<input name="city" value={city} onChange={(event) => setCity(event.target.value)} required maxLength={ONBOARDING_LIMITS.city} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:ring-2 focus:ring-slate-200" /></label>
          <label className="text-sm font-medium text-slate-700">Bandeira<select name="brand_code" value={brandCode} onChange={(event) => setBrandCode(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4"><option value="">Sem bandeira</option>{PLATFORM_HOTEL_BRANDS.map((brand) => <option key={brand.value} value={brand.value}>{brand.label}</option>)}</select></label>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Tema<select name="theme_preset" value={themePreset} onChange={(event) => setThemePreset(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4"><option value="">Padrão da bandeira</option>{HOTEL_THEME_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select></label>
        </div>
      </section>

      <section data-onboarding-step="1" hidden={step !== 1} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-xl font-semibold text-slate-950">Endereço público</h2><p className="mt-2 text-sm text-slate-600">A identidade é reservada agora, mas permanece indisponível enquanto o hotel estiver em preparação.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Slug<input name="slug" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(generateHotelSlug(event.target.value)); }} required maxLength={ONBOARDING_LIMITS.slug} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 font-mono text-sm" /><span className="mt-2 block text-xs text-slate-500">libguest.digital/hotel/{slug || 'slug-do-hotel'}</span></label>
          <label className="text-sm font-medium text-slate-700">Subdomínio<input name="subdomain" value={subdomain} onChange={(event) => { setSubdomainEdited(true); setSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, ONBOARDING_LIMITS.subdomain)); }} required maxLength={ONBOARDING_LIMITS.subdomain} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 font-mono text-sm" /><span className="mt-2 block text-xs text-slate-500">https://{subdomain || 'subdominio'}.libguest.digital</span></label>
        </div>
      </section>

      <section data-onboarding-step="2" hidden={step !== 2} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-xl font-semibold text-slate-950">Módulos</h2><p className="mt-2 text-sm text-slate-600">O baseline operacional é aplicado automaticamente. Funcionalidades futuras são somente informativas.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">{MODULE_CATALOG.map((module) => { const baseline = BASELINE_MODULE_KEYS.includes(module.key as (typeof BASELINE_MODULE_KEYS)[number]); return <article key={module.key} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">{module.name}</p><p className="mt-1 text-xs text-slate-500">{MODULE_GROUP_LABELS[module.group]}</p></div><span className={baseline ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700'}>{baseline ? 'Incluído' : 'Em breve'}</span></div></article>; })}</div>
      </section>

      <section data-onboarding-step="3" hidden={step !== 3} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-xl font-semibold text-slate-950">Administrador inicial</h2><p className="mt-2 text-sm text-slate-600">O administrador receberá um convite seguro para definir o próprio acesso. Nenhuma senha é solicitada.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Nome completo<input name="admin_full_name" value={adminFullName} onChange={(event) => setAdminFullName(event.target.value)} required maxLength={ONBOARDING_LIMITS.fullName} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4" /></label><label className="text-sm font-medium text-slate-700">E-mail<input name="admin_email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required type="email" maxLength={ONBOARDING_LIMITS.email} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4" /></label></div>
      </section>

      <section data-onboarding-step="4" hidden={step !== 4} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-xl font-semibold text-slate-950">Revisão</h2><dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Hotel</dt><dd className="mt-1 font-semibold text-slate-900">{name || '—'}</dd></div><div><dt className="text-slate-500">Cidade</dt><dd className="mt-1 font-semibold text-slate-900">{city || '—'}</dd></div><div><dt className="text-slate-500">Bandeira</dt><dd className="mt-1 font-semibold text-slate-900">{getPlatformHotelBrandLabel(brandCode)}</dd></div><div><dt className="text-slate-500">Lifecycle inicial</dt><dd className="mt-1 font-semibold text-amber-700">Em preparação</dd></div><div><dt className="text-slate-500">Slug</dt><dd className="mt-1 break-all font-mono text-slate-900">{slug || '—'}</dd></div><div><dt className="text-slate-500">Subdomínio</dt><dd className="mt-1 break-all font-mono text-slate-900">{subdomain || '—'}</dd></div><div><dt className="text-slate-500">Módulos</dt><dd className="mt-1 font-semibold text-slate-900">11 habilitados</dd></div><div><dt className="text-slate-500">Administrador</dt><dd className="mt-1 font-semibold text-slate-900">{adminFullName || '—'} · {adminEmail || '—'}</dd></div></dl>
        <label className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><input type="checkbox" name="confirmed" value="true" required className="mt-1 h-4 w-4" />Confirmo que este hotel será criado em preparação e não ficará público até ser ativado.</label>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 disabled:invisible"><ArrowLeft className="h-4 w-4" />Voltar</button>
        {step < steps.length - 1 ? <button type="button" onClick={continueToNextStep} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white">Continuar<ArrowRight className="h-4 w-4" /></button> : <SubmitButton />}
      </div>
    </form>
  );
}
