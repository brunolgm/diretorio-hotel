'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

interface FeedbackToastProps {
  success?: string;
  error?: string;
  warning?: string;
}

export function FeedbackToast({ success, error, warning }: FeedbackToastProps) {
  useEffect(() => {
    if (success) {
      toast.success(success);
    }

    if (warning) {
      toast.warning(warning);
    }

    if (error) {
      toast.error(error);
    }
  }, [success, error, warning]);

  return null;
}
