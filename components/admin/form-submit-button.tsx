'use client';

import { LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

const VARIANT_STYLES = {
  primary:
    'h-12 bg-slate-900 px-5 text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.75)] hover:bg-slate-800 focus-visible:ring-slate-300',
  secondary:
    'h-11 border border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300',
  danger:
    'h-11 border border-red-200 bg-red-50 px-4 text-red-700 hover:bg-red-100 focus-visible:ring-red-200',
} as const;

export function AdminSubmitButton({
  label,
  pendingLabel,
  variant = 'primary',
  className,
}: {
  label: string;
  pendingLabel: string;
  variant?: keyof typeof VARIANT_STYLES;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
        VARIANT_STYLES[variant],
        className
      )}
    >
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}
