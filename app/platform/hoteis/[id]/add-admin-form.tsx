'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addPlatformHotelAdminAction, type AddHotelAdminState } from './admin-actions';

const INITIAL_STATE: AddHotelAdminState = {};
const inputClass = 'mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-slate-950';

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? 'Adicionando...' : 'Adicionar administrador'}</button>;
}

export function AddHotelAdminForm({ hotelId }: { hotelId: string }) {
  const [state, action] = useActionState(addPlatformHotelAdminAction, INITIAL_STATE);
  return (
    <details className="mt-5 rounded-2xl border border-slate-200 p-5">
      <summary className="cursor-pointer font-semibold text-slate-950">Adicionar administrador</summary>
      <p className="mt-3 text-sm text-slate-600">Adicione um novo administrador ativo a este hotel. Os administradores atuais serão preservados. E-mails que já possuem conta precisam de revisão antes de qualquer vínculo.</p>
      <form action={action} className="mt-5">
        <input type="hidden" name="hotel_id" value={hotelId} />
        <div className="grid gap-4 md:grid-cols-2">
          <label htmlFor="platform-admin-name" className="text-sm font-medium">Nome completo<input id="platform-admin-name" name="full_name" autoComplete="name" maxLength={120} required className={inputClass} /></label>
          <label htmlFor="platform-admin-email" className="text-sm font-medium">E-mail<input id="platform-admin-email" name="email" type="email" autoComplete="email" maxLength={254} required className={inputClass} /></label>
          <label htmlFor="platform-admin-password" className="text-sm font-medium">Senha inicial<input id="platform-admin-password" name="password" type="password" autoComplete="new-password" minLength={6} required className={inputClass} /><span className="mt-1 block text-xs text-slate-500">Mínimo de 6 caracteres. Digite a senha somente neste formulário.</span></label>
          <div className="text-sm text-slate-600"><p>Papel: <strong>Administrador</strong></p><p className="mt-2">Ativo no painel administrativo: <strong>Sim</strong></p></div>
        </div>
        <div aria-live="polite" className="mt-4 text-sm">
          {state.error ? <p role="alert" className="text-red-700">{state.error}</p> : null}
          {state.reconciliationId ? <p className="mt-2 text-slate-600">Referência para reconciliação: {state.reconciliationId}</p> : null}
          {state.success ? <p className="text-emerald-700">{state.success}</p> : null}
        </div>
        <Submit />
      </form>
    </details>
  );
}
