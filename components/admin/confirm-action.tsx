'use client';

import { LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ConfirmAction = (formData: FormData) => void | Promise<void>;

function ConfirmSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminConfirmAction({
  action,
  title,
  description,
  triggerLabel,
  confirmLabel,
  pendingLabel,
  hiddenFields = [],
  className,
  tone = 'danger',
}: {
  action: ConfirmAction;
  title: string;
  description: string;
  triggerLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  hiddenFields?: Array<{ name: string; value: string }>;
  className?: string;
  tone?: 'danger' | 'warning';
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              tone === 'danger'
                ? 'border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-200'
                : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus-visible:ring-amber-200',
              className
            )}
          />
        }
      >
        {triggerLabel}
      </DialogTrigger>

      <DialogContent className="rounded-[24px] p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg text-slate-950">{title}</DialogTitle>
          <DialogDescription className="leading-6 text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="-mx-6 -mb-6 mt-2 p-5">
          <DialogClose
            render={
              <button
                type="button"
                autoFocus
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
              />
            }
          >
            Cancelar
          </DialogClose>
          <form action={action}>
            {hiddenFields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            <ConfirmSubmitButton label={confirmLabel} pendingLabel={pendingLabel} />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
