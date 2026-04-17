'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

interface FeedbackToastProps {
  success?: string;
  error?: string;
}

export function FeedbackToast({ success, error }: FeedbackToastProps) {
  useEffect(() => {
    if (success) {
      toast.success(success);
    }

    if (error) {
      toast.error(error);
    }
  }, [success, error]);

  return null;
}