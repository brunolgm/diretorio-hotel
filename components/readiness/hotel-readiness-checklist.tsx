import Link from 'next/link';
import { CheckCircle2, CircleAlert, CircleX } from 'lucide-react';
import {
  HOTEL_READINESS_CATEGORIES,
  HOTEL_READINESS_CATEGORY_LABELS,
  type HotelReadiness,
} from '@/lib/hotel-readiness';

export function HotelReadinessChecklist({
  readiness,
  variant,
}: {
  readiness: HotelReadiness;
  variant: 'admin' | 'platform';
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {HOTEL_READINESS_CATEGORIES.map((category) => {
        const checks = readiness.checks.filter((check) => check.category === category);
        if (!checks.length) return null;
        return (
          <section key={category}>
            <h3 className={variant === 'admin' ? 'text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]' : 'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500'}>
              {HOTEL_READINESS_CATEGORY_LABELS[category]}
            </h3>
            <div className="mt-2 space-y-2">
              {checks.map((check) => {
                const Icon = check.passed ? CheckCircle2 : check.severity === 'blocking' ? CircleX : CircleAlert;
                const content = (
                  <div className="flex items-start gap-3">
                    <Icon className={check.passed ? 'mt-0.5 h-4 w-4 shrink-0 text-emerald-600' : check.severity === 'blocking' ? 'mt-0.5 h-4 w-4 shrink-0 text-red-600' : 'mt-0.5 h-4 w-4 shrink-0 text-amber-600'} aria-hidden="true" />
                    <div>
                      <p className={variant === 'admin' ? 'text-sm font-semibold text-[var(--admin-text)]' : 'text-sm font-semibold text-slate-900'}>{check.label}</p>
                      {!check.passed ? <p className={variant === 'admin' ? 'mt-1 text-xs leading-5 text-[var(--admin-muted)]' : 'mt-1 text-xs leading-5 text-slate-600'}>{check.description}</p> : null}
                    </div>
                  </div>
                );
                const className = variant === 'admin'
                  ? 'block rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3'
                  : 'block rounded-xl border border-slate-200 bg-white p-3';
                return variant === 'admin' && check.href && !check.passed
                  ? <Link key={check.key} href={check.href} className={`${className} transition hover:shadow-sm`}>{content}</Link>
                  : <div key={check.key} className={className}>{content}</div>;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
