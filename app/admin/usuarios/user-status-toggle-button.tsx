'use client';

import { useFormStatus } from 'react-dom';
import { AdminSecondaryButton } from '@/components/admin/ui';

interface UserStatusToggleButtonProps {
  isActive: boolean;
}

export function UserStatusToggleButton({ isActive }: UserStatusToggleButtonProps) {
  const { pending } = useFormStatus();

  return (
    <AdminSecondaryButton
      type="submit"
      className={[
        'disabled:cursor-not-allowed disabled:opacity-60',
        isActive
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
      ].join(' ')}
    >
      {pending ? 'Atualizando...' : isActive ? 'Desativar' : 'Ativar'}
    </AdminSecondaryButton>
  );
}
