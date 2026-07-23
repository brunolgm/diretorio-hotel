'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { ServiceIcon } from '@/components/service-icon';

export type NovotelServiceExplorerItem = {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  icon: string | null;
  cta: string | null;
  href: string | null;
  isExternal: boolean;
};

function normalizeSearchText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function NovotelServiceExplorer({
  items,
  labels,
}: {
  items: NovotelServiceExplorerItem[];
  labels: {
    searchPlaceholder: string;
    allCategories: string;
    uncategorized: string;
    resultLabel: string;
    actionAvailable: string;
    open: string;
    noResultsTitle: string;
    noResultsDescription: string;
  };
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category?.trim() || labels.uncategorized))).sort(),
    [items, labels.uncategorized]
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return items.filter((item) => {
      const itemCategory = item.category?.trim() || labels.uncategorized;
      const matchesCategory = category === 'all' || itemCategory === category;
      const matchesQuery = !normalizedQuery || normalizeSearchText(
        `${item.title} ${item.category || ''} ${item.content || ''}`
      ).includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, items, labels.uncategorized, query]);

  return (
    <div>
      <div className="hotel-service-filters rounded-[24px] bg-white p-4 shadow-[0_18px_42px_-32px_rgba(0,43,92,0.24)] ring-1 ring-[color:var(--hotel-border)] md:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
          <label className="relative block">
            <span className="sr-only">{labels.searchPlaceholder}</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="h-12 w-full rounded-[16px] border border-slate-200 bg-slate-50 pr-4 pl-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0072CE] focus:bg-white focus:ring-2 focus:ring-[#0072CE]/15"
            />
          </label>
          <label className="relative block">
            <span className="sr-only">{labels.allCategories}</span>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-12 w-full appearance-none rounded-[16px] border border-slate-200 bg-slate-50 pr-10 pl-12 text-base text-slate-900 outline-none transition focus:border-[#0072CE] focus:bg-white focus:ring-2 focus:ring-[#0072CE]/15"
            >
              <option value="all">{labels.allCategories}</option>
              {categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm font-medium text-[color:var(--hotel-text-muted)]" aria-live="polite">
          {visibleItems.length} {labels.resultLabel}
        </p>
      </div>

      {visibleItems.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className={`hotel-service-editorial-card relative flex h-full flex-col overflow-hidden rounded-[24px] bg-white p-5 shadow-[var(--hotel-card-shadow)] ring-1 ${item.href ? 'ring-[color:var(--hotel-accent-border)]' : 'ring-[color:var(--hotel-border)]'}`}
            >
              {item.href ? <div className="absolute inset-y-0 left-0 w-1 bg-[var(--hotel-accent)]" aria-hidden="true" /> : null}
              <div className="flex items-start gap-4">
                <div className="hotel-theme-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border">
                  <ServiceIcon iconName={item.icon} className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="hotel-service-card-title break-words text-lg font-semibold leading-6 text-[color:var(--hotel-primary)]">{item.title}</h2>
                  {item.category ? <p className="hotel-service-card-category mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--hotel-accent)]">{item.category}</p> : null}
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line break-words text-[15px] leading-6 text-[color:var(--hotel-text-muted)]">{item.content}</p>
              {item.href ? (
                <div className="mt-auto flex justify-end pt-5">
                  <span className="sr-only">{labels.actionAvailable}</span>
                  <a href={item.href} target={item.isExternal ? '_blank' : undefined} rel={item.isExternal ? 'noreferrer' : undefined} className="hotel-service-card-cta inline-flex min-h-11 items-center rounded-[14px] bg-[var(--hotel-accent)] px-4 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2">
                    {item.cta || labels.open}
                    {item.isExternal ? <ArrowUpRight className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
                  </a>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="hotel-public-empty-state mt-5 rounded-[24px] border border-dashed border-[color:var(--hotel-border)] bg-white p-8 text-center">
          <Search className="mx-auto h-8 w-8 text-[color:var(--hotel-accent)]" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-[color:var(--hotel-primary)]">{labels.noResultsTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{labels.noResultsDescription}</p>
        </div>
      )}
    </div>
  );
}
