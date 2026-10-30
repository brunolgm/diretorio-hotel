'use client';

import {useCallback,useState} from 'react';
import {Menu} from '@base-ui/react/menu';
import { Check, ChevronDown, Languages } from 'lucide-react';
import {publicLanguageHref} from '@/lib/public-language-href';
import { getPublicCopy } from '@/lib/public-copy';
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
  basePath,
  compact = false,
}: {
  slug: string;
  currentLanguage: SupportedPublicLanguage;
  basePath?: string;
  compact?: boolean;
}) {
  const [open,setOpen]=useState(false);
  const [portalContainer,setPortalContainer]=useState<HTMLElement|null>(null);
  // Stay inside the theme scope, outside clipping headers. No copied theme tokens.
  const attachScope=useCallback((node:HTMLDivElement|null)=>{
    setPortalContainer(node?.closest<HTMLElement>('[data-hotel-theme]')??null);
  },[]);
  const activeLanguage =
    LANGUAGE_OPTIONS.find((item) => item.code === currentLanguage) || LANGUAGE_OPTIONS[0];
  const resolvedBasePath = basePath || `/hotel/${slug}`;
  const copy = getPublicCopy(currentLanguage);

  return (
    <div ref={attachScope} className="relative">
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger aria-label={copy.languageMenuLabel} className="hotel-theme-language-trigger min-h-11 flex cursor-pointer list-none items-center gap-2 rounded-full border border-[color:var(--hotel-header-border)] bg-[var(--hotel-header-bg)] px-3.5 py-2.5 text-sm font-medium text-[color:var(--hotel-header-text)] shadow-[0_12px_32px_rgba(15,23,42,0.28)] backdrop-blur-xl transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white/35 focus:ring-offset-2 focus:ring-offset-slate-950">
        <Languages className="h-4 w-4 text-slate-200" />
        {!compact ? <span className="text-base leading-none" aria-hidden="true">
          {activeLanguage.flag}
        </span> : null}
        <span className={compact ? 'hidden' : 'hidden sm:inline'}>{activeLanguage.label}</span>
        <span className={compact ? undefined : 'sm:hidden'}>{activeLanguage.shortLabel}</span>
        <ChevronDown className={`h-4 w-4 text-slate-300 transition ${open?'rotate-180':''}`} />
      </Menu.Trigger>

      <Menu.Portal container={portalContainer} className="contents">
      <Menu.Positioner side="bottom" align="end" sideOffset={12} collisionPadding={8} positionMethod="fixed" className="z-[100]">
      <Menu.Popup className="hotel-theme-language-menu w-[220px] max-w-[min(calc(100vw-16px),var(--available-width))] max-h-[var(--available-height)] overflow-x-hidden overflow-y-auto rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.08)_100%)] p-2 shadow-[0_24px_60px_rgba(2,6,23,0.4)] backdrop-blur-2xl">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/80">
          {copy.languageMenuLabel}
        </div>

        <div className="space-y-1">
          {LANGUAGE_OPTIONS.map((item) => {
            const isActive = item.code === currentLanguage;

            return (
              <Menu.LinkItem
                closeOnClick
                label={item.label}
                key={item.code}
                href={publicLanguageHref(resolvedBasePath,item.code)}
                aria-current={isActive ? 'page' : undefined}
                data-analytics-event="language_selected"
                data-analytics-language={item.code}
                data-analytics-label={item.label}
                className={`flex min-h-11 items-center justify-between rounded-[18px] px-3 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-white/35 focus:ring-offset-2 focus:ring-offset-slate-950 ${
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
              </Menu.LinkItem>
            );
          })}
        </div>
      </Menu.Popup>
      </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    </div>
  );
}
