'use client';

import { Globe, Info, Link2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildHotelSubdomainPreviewUrl,
  getHotelSubdomainFeedback,
  normalizeHotelSubdomainInput,
  HOTEL_SUBDOMAIN_RESERVED_NAMES,
} from '@/lib/hotel-subdomain';

const FEEDBACK_STYLES = {
  neutral: {
    wrapper: 'border-slate-200 bg-slate-50/70',
    input: 'border-slate-200 bg-white focus:border-slate-300',
    panel: 'border-slate-200 bg-white',
    badge: 'bg-slate-100 text-slate-600',
    icon: Info,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50/50',
    input: 'border-emerald-200 bg-white focus:border-emerald-300',
    panel: 'border-emerald-200 bg-white',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: ShieldCheck,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50/60',
    input: 'border-amber-200 bg-white focus:border-amber-300',
    panel: 'border-amber-200 bg-white',
    badge: 'bg-amber-100 text-amber-700',
    icon: TriangleAlert,
  },
  danger: {
    wrapper: 'border-red-200 bg-red-50/60',
    input: 'border-red-200 bg-white focus:border-red-300',
    panel: 'border-red-200 bg-white',
    badge: 'bg-red-100 text-red-700',
    icon: TriangleAlert,
  },
} as const;

export function HotelSubdomainField({
  name,
  defaultValue,
  slugFallback,
}: {
  name: string;
  defaultValue?: string | null;
  slugFallback: string;
}) {
  const [value, setValue] = useState(defaultValue || '');
  const feedback = useMemo(() => getHotelSubdomainFeedback(value), [value]);
  const styles = FEEDBACK_STYLES[feedback.tone];
  const FeedbackIcon = styles.icon;
  const fallbackPreview = useMemo(() => buildHotelSubdomainPreviewUrl(slugFallback), [slugFallback]);
  const normalizedValue = normalizeHotelSubdomainInput(value);

  return (
    <div className={`rounded-[24px] border p-4 transition ${styles.wrapper}`}>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={`h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none transition ${styles.input}`}
          placeholder="ex.: novotelrv"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className={`mt-3 rounded-2xl border px-4 py-3 ${styles.panel}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${styles.badge}`}
          >
            <FeedbackIcon className="h-3.5 w-3.5" />
            {feedback.title}
          </span>

          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            domínio operacional atual
          </span>
        </div>

        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
          URL pública esperada
        </p>
        <p className="mt-2 break-words text-sm font-semibold text-slate-900">
          {feedback.previewUrl
            ? `https://${feedback.previewUrl}`
            : 'https://{subdominio}.guestdesk.digital'}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-600">{feedback.description}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              O que este campo controla
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Esse será o endereço público principal do hotel dentro do domínio operacional atual.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              Fallback por slug
            </p>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">
              A rota por slug continuará funcionando como fallback seguro.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-500">
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            Use letras minúsculas, números e hífen, sem espaços, acentos ou caracteres
            especiais.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            Mantenha o nome curto, simples e fácil de comunicar em QR Code, recepção ou
            materiais do hotel.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            Evite nomes reservados como{' '}
            {HOTEL_SUBDOMAIN_RESERVED_NAMES.map((item) => `\`${item}\``).join(', ')}.
          </span>
        </div>
        {!normalizedValue ? (
          <div className="flex items-start gap-2">
            <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              Sem subdomínio definido, o hotel continua acessível pelo slug e o comportamento
              atual permanece seguro.
            </span>
          </div>
        ) : null}
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            Referência de fallback atual:{' '}
            <span className="font-medium text-slate-700">{fallbackPreview}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
