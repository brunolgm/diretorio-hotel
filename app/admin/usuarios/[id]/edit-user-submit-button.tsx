'use client';

import { useFormStatus } from 'react-dom';
import { AdminPrimaryButton } from '@/components/admin/ui';

export function EditUserSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <AdminPrimaryButton
      type="submit"
      className="disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Salvando alterações...' : 'Salvar alterações'}
    </AdminPrimaryButton>
  );
}
