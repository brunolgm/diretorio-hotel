import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Children, isValidElement, ReactNode } from 'react';
import { ArrowRight, ChevronRight, Search } from 'lucide-react';

type TranslationAvailabilityStatus = 'complete' | 'partial' | 'missing';

function getTranslationAvailabilityLabel(status: TranslationAvailabilityStatus) {
  if (status === 'complete') {
    return 'EN e ES disponíveis';
  }

  if (status === 'partial') {
    return 'Fallback parcial em PT';
  }

  return 'Fallback em PT';
}

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
    <section className="admin-theme-surface relative overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.28)] sm:p-7 [&_.bg-white\/10]:bg-[var(--admin-surface-muted)] [&_.border-white\/10]:border-[var(--admin-border)] [&_.text-slate-300]:text-[var(--admin-muted)] [&_.text-white]:text-[var(--admin-text-strong)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--admin-accent)]" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full bg-[var(--admin-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-accent)] ring-1 ring-inset ring-[var(--admin-border)]">
            {eyebrow}
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--admin-text-strong)] sm:text-3xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
              {description}
            </p>
          ) : null}
        </div>

        {rightSlot ? <div className="lg:w-[360px] [&>div>div]:rounded-xl [&>div>div]:border [&>div>div]:border-[var(--admin-border)] [&>div>div]:bg-[var(--admin-surface-muted)] [&>div>div]:p-4">{rightSlot}</div> : null}
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
        'admin-theme-surface rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_10px_30px_-26px_rgba(15,23,42,0.28)] sm:p-6',
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
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--admin-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--admin-text-strong)] sm:text-2xl">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
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
    <div className="admin-theme-surface rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_10px_28px_-26px_rgba(15,23,42,0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--admin-muted)]">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--admin-text-strong)]">{value}</p>
        </div>

        <div className="rounded-xl bg-[var(--admin-accent-soft)] p-2.5 text-[var(--admin-accent)] ring-1 ring-inset ring-[var(--admin-border)]">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--admin-muted)]">{description}</p>
    </div>
  );
}

export function AdminInfoBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--admin-accent)] ring-1 ring-inset ring-[var(--admin-border)]">
      {children}
    </div>
  );
}

export function AdminLanguageBadge({
  label,
  available,
  source = false,
}: {
  label: string;
  available: boolean;
  source?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        source && available
          ? 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200'
          : available
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200'
      )}
    >
      {source ? `${label} fonte` : label}
    </span>
  );
}

export function AdminTranslationStatusPill({
  status,
}: {
  status: TranslationAvailabilityStatus;
}) {
  if (status === 'complete') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        {getTranslationAvailabilityLabel(status)}
      </span>
    );
  }

  if (status === 'partial') {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        {getTranslationAvailabilityLabel(status)}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      {getTranslationAvailabilityLabel(status)}
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
        'mt-6 flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4 md:flex-row md:items-center',
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
        id={props.id || (typeof props.name === 'string' ? props.name : undefined)}
        className={cn(
          'h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-11 pr-4 text-sm text-[var(--admin-text)] outline-none transition focus:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-soft)]',
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
      id={props.id || (typeof props.name === 'string' ? props.name : undefined)}
      className={cn(
        'h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm text-[var(--admin-text)] outline-none transition focus:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-soft)]',
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
    <div className="inline-flex items-center rounded-full bg-[var(--admin-surface)] px-4 py-2 text-xs font-medium text-[var(--admin-muted)] ring-1 ring-[var(--admin-border)]">
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
    <div className="rounded-2xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-8 text-center">
      <p className="text-base font-semibold text-[var(--admin-text-strong)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
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
  description?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition hover:border-[var(--admin-focus)] hover:shadow-[0_8px_24px_-22px_rgba(15,23,42,0.3)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--admin-text-strong)]">{title}</h3>
            {status}
          </div>

          {description ? <div className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">{description}</div> : null}

          {meta ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--admin-muted)]">
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
        'inline-flex h-11 items-center justify-center rounded-xl bg-[var(--admin-accent)] px-5 text-sm font-medium text-[var(--admin-accent-text)] shadow-sm transition hover:bg-[var(--admin-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
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
        'inline-flex h-11 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-text)] transition hover:bg-[var(--admin-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
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
        'inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
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
        'inline-flex items-center justify-center rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        variant === 'secondary'
          ? 'h-11 border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] focus-visible:ring-[var(--admin-focus)]'
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

function findAdminControlId(children: ReactNode): string | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ id?: string; name?: string; children?: ReactNode }>(child)) continue;

    if (child.props.id || child.props.name) return child.props.id || child.props.name;

    const nestedId = findAdminControlId(child.props.children);
    if (nestedId) return nestedId;
  }

  return undefined;
}

export function AdminField({
  label,
  children,
  className,
  htmlFor,
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  error?: string | null;
}) {
  const controlId = htmlFor || findAdminControlId(children);

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-[var(--admin-text)]">{label}</label>
      {children}
      {error ? (
        <p id={controlId ? `${controlId}-error` : undefined} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AdminInlineError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
      {message}
    </div>
  );
}

export function AdminBreadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Navegação estrutural" className="mb-4 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2 text-sm text-[var(--admin-muted)]">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {item.href ? (
              <Link href={item.href} className="rounded-md hover:text-[var(--admin-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-[var(--admin-text)]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminHelpText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn('text-xs leading-5 text-[var(--admin-muted)]', className)}>{children}</p>;
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
    <div
      className={cn(
        'rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4',
        className
      )}
    >
      <p className="text-[13px] font-semibold text-[var(--admin-text-strong)]">{title}</p>
      {description ? (
        <p className="mt-1.5 text-xs leading-5 text-[var(--admin-muted)]">{description}</p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
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
    <ul className={cn('space-y-1.5 text-xs leading-5 text-[var(--admin-muted)]', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--admin-accent)]" />
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
      id={props.id || (typeof props.name === 'string' ? props.name : undefined)}
      aria-invalid={props['aria-invalid']}
      className={cn(
        'h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 text-sm text-[var(--admin-text)] outline-none transition focus:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-soft)]',
        props.className
      )}
    />
  );
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      id={props.id || (typeof props.name === 'string' ? props.name : undefined)}
      className={cn(
        'min-h-32 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-3 text-sm text-[var(--admin-text)] outline-none transition focus:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-soft)]',
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
        'flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-4 py-3 text-sm font-medium text-[var(--admin-text)]',
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
