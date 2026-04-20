import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { ArrowRight, Search } from 'lucide-react';

export function AdminPageHero({
  eyebrow,
  title,
  description,
  rightSlot,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-8 text-white shadow-sm md:p-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
            {eyebrow}
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>

          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {rightSlot ? <div className="lg:w-[360px]">{rightSlot}</div> : null}
      </div>
    </section>
  );
}

export function AdminSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70',
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminSectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <p className="text-sm text-slate-500">{eyebrow}</p> : null}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>

      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function AdminStatCard({
  icon,
  title,
  value,
  description,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export function AdminInfoBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
      {children}
    </div>
  );
}

export function AdminLanguageBadge({
  label,
  available,
}: {
  label: string;
  available: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        available
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200'
      )}
    >
      {label}
    </span>
  );
}

export function AdminTranslationStatusPill({
  status,
}: {
  status: 'complete' | 'partial' | 'missing';
}) {
  if (status === 'complete') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        Tradução completa
      </span>
    );
  }

  if (status === 'partial') {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        Tradução parcial
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Apenas português
    </span>
  );
}

export function AdminFilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={cn(
        'mt-6 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center',
        className
      )}
    >
      {children}
    </form>
  );
}

export function AdminSearchInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        className={cn(
          'h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-200',
          className
        )}
      />
    </div>
  );
}

export function AdminSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-200',
        className
      )}
    >
      {children}
    </select>
  );
}

export function AdminListSummary({
  total,
  label,
}: {
  total: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
      {total} {label}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export function AdminListItem({
  title,
  description,
  meta,
  status,
  actions,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
            {status}
          </div>

          {description ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          ) : null}

          {meta ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function AdminActionGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>;
}

export function AdminPrimaryButton({
  children,
  className,
  type = 'button',
}: {
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminSecondaryButton({
  children,
  className,
  type = 'button',
}: {
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminDangerButton({
  children,
  className,
  type = 'button',
}: {
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-2xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminLinkButton({
  href,
  children,
  className,
  variant = 'secondary',
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: 'secondary' | 'danger';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        variant === 'secondary'
          ? 'h-11 border border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300'
          : 'h-11 border border-red-200 bg-white px-4 text-red-600 hover:bg-red-50 focus-visible:ring-red-200',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function AdminFormGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('mt-8 grid gap-5 md:grid-cols-2', className)}>{children}</div>;
}

export function AdminField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

export function AdminHelpText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn('text-xs leading-5 text-slate-500', className)}>{children}</p>;
}

export function AdminGuideCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[24px] border border-slate-200 bg-slate-50/80 p-5', className)}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function AdminHelpList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  return (
    <ul className={cn('space-y-2 text-sm leading-6 text-slate-600', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminTextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-slate-200',
        props.className
      )}
    />
  );
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-slate-200',
        props.className
      )}
    />
  );
}

export function AdminCheckboxRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700',
        className
      )}
    >
      {children}
    </label>
  );
}

export function AdminStatusPill({
  active,
  activeText = 'Ativo',
  inactiveText = 'Inativo',
}: {
  active: boolean;
  activeText?: string;
  inactiveText?: string;
}) {
  return active ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
      {activeText}
    </span>
  ) : (
    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
      {inactiveText}
    </span>
  );
}

export function AdminQuickArrow() {
  return <ArrowRight className="h-3.5 w-3.5" />;
}
