'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface FeedbackToastProps {
  success?: string;
  error?: string;
  warning?: string;
}

export function FeedbackToast({ success, error, warning }: FeedbackToastProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hasFeedback = Boolean(success || error || warning);

    if (!hasFeedback) {
      return;
    }

    if (success) {
      toast.success(success);
    }

    if (warning) {
      toast.warning(warning);
    }

    if (error) {
      toast.error(error);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('success');
    nextParams.delete('error');
    nextParams.delete('warning');

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [success, error, warning, pathname, router, searchParams]);

  return null;
}
