'use client';

import { useFormStatus } from 'react-dom';
import { Plus } from 'lucide-react';
import { AdminPrimaryButton } from '@/components/admin/ui';

export function CreateUserSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <AdminPrimaryButton
      type="submit"
      className="disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Plus className="mr-2 h-4 w-4" />
      {pending ? 'Criando usuário...' : 'Criar usuário'}
    </AdminPrimaryButton>
  );
}
