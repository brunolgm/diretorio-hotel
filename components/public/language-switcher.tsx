import { Check, ChevronDown, Languages } from 'lucide-react';
import { type SupportedPublicLanguage } from '@/lib/public-language';

const LANGUAGE_OPTIONS: Array<{
  code: SupportedPublicLanguage;
  label: string;
  shortLabel: string;
  flag: string;
}> = [
  { code: 'pt', label: 'Português', shortLabel: 'PT', flag: '🇧🇷' },
  { code: 'en', label: 'English', shortLabel: 'EN', flag: '🇺🇸' },
  { code: 'es', label: 'Español', shortLabel: 'ES', flag: '🇪🇸' },
];

export function LanguageSwitcher({
  slug,
  currentLanguage,
}: {
  slug: string;
  currentLanguage: SupportedPublicLanguage;
}) {
  const activeLanguage =
    LANGUAGE_OPTIONS.find((item) => item.code === currentLanguage) || LANGUAGE_OPTIONS[0];

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3.5 py-2.5 text-sm font-medium text-white shadow-[0_12px_32px_rgba(15,23,42,0.28)] backdrop-blur-xl transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white/35 focus:ring-offset-2 focus:ring-offset-slate-950">
        <Languages className="h-4 w-4 text-slate-200" />
        <span className="text-base leading-none" aria-hidden="true">
          {activeLanguage.flag}
        </span>
        <span className="hidden sm:inline">{activeLanguage.label}</span>
        <span className="sm:hidden">{activeLanguage.shortLabel}</span>
        <ChevronDown className="h-4 w-4 text-slate-300 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-20 mt-3 w-[220px] overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.08)_100%)] p-2 shadow-[0_24px_60px_rgba(2,6,23,0.4)] backdrop-blur-2xl">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/80">
          Language
        </div>

        <div className="space-y-1">
          {LANGUAGE_OPTIONS.map((item) => {
            const isActive = item.code === currentLanguage;

            return (
              <a
                key={item.code}
                href={`/hotel/${slug}?lang=${item.code}`}
                aria-current={isActive ? 'page' : undefined}
                data-analytics-event="language_selected"
                data-analytics-language={item.code}
                data-analytics-label={item.label}
                className={`flex items-center justify-between rounded-[18px] px-3 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-white/35 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.16)]'
                    : 'text-slate-100 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-base leading-none" aria-hidden="true">
                    {item.flag}
                  </span>
                  <span>{item.label}</span>
                </span>

                {isActive ? <Check className="h-4 w-4" /> : null}
              </a>
            );
          })}
        </div>
      </div>
    </details>
  );
}
