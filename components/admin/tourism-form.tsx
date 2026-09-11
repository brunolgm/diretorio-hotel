'use client';

import { useActionState, useState } from 'react';
import { TOURISM_CATEGORIES, TOURISM_TYPES } from '@/lib/tourism/catalog';
import { TOURISM_TEXT_LIMITS } from '@/lib/tourism/validation';
import { TOURISM_FIELD_LABELS, type TourismFormState } from '@/lib/tourism/admin';
import type { Database } from '@/types/database';
import { AdminCheckboxRow, AdminField, AdminInlineError, AdminSelect, AdminTextarea, AdminTextInput } from '@/components/admin/ui';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';

type Item = Database['public']['Tables']['hotel_tourism_items']['Row'];
type FormAction = (state: TourismFormState, form: FormData) => Promise<TourismFormState>;

export function TourismForm({ item, action }: { item?: Item; action: FormAction }) {
  const [state, formAction] = useActionState(action, {});
  const [values, setValues] = useState<Record<string, string | boolean>>(() => ({
    ...Object.fromEntries(Object.keys(TOURISM_FIELD_LABELS).map((key) => [key, item?.[key as keyof typeof TOURISM_FIELD_LABELS] || ''])),
    type: item?.type || '', category_key: item?.category_key || '',
    featured: item?.featured || false, recommended_by_hotel: item?.recommended_by_hotel || false,
    is_published: item?.is_published || false,
  }));
  const prefix = item ? `tourism-${item.id}` : 'tourism-new';
  function setField(key: string, value: string | boolean) {
    setValues((previous) => ({ ...previous, [key]: value, ...(key === 'type' ? { category_key: '' } : {}) }));
  }
  return <form action={formAction} className="space-y-5">
    <AdminInlineError message={state.error} />
    {state.error && item ? <a href={`/admin/turismo/${item.id}`} className="inline-block underline">Recarregar os dados</a> : null}
    {item ? <input type="hidden" name="expected_updated_at" value={item.updated_at} /> : null}
    <div className="grid gap-5 md:grid-cols-2">
      <AdminField label="Tipo" htmlFor={`${prefix}-type`}><AdminSelect id={`${prefix}-type`} name="type" required value={String(values.type)} onChange={(event) => setField('type', event.target.value)}>
        <option value="">Selecione o tipo</option>{TOURISM_TYPES.map((type) => <option key={type.key} value={type.key}>{type.labels.pt}</option>)}
      </AdminSelect></AdminField>
      <AdminField label="Categoria" htmlFor={`${prefix}-category`}><AdminSelect id={`${prefix}-category`} name="category_key" required value={String(values.category_key)} onChange={(event) => setField('category_key', event.target.value)}>
        <option value="">Selecione a categoria</option>{TOURISM_CATEGORIES.filter((category) => category.type === values.type).map((category) => <option key={category.key} value={category.key}>{category.labels.pt}</option>)}
      </AdminSelect></AdminField>
    </div>
    {Object.entries(TOURISM_FIELD_LABELS).map(([key, label]) => {
      const field = key as keyof typeof TOURISM_FIELD_LABELS;
      const id = `${prefix}-${key}`;
      const props = { id, name: key, value: String(values[key]), maxLength: TOURISM_TEXT_LIMITS[field], required: ['name', 'short_description'].includes(key), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(key, event.target.value) };
      return <AdminField key={key} label={label} htmlFor={id}>
        {['short_description', 'full_description', 'opening_hours'].includes(key) ? <AdminTextarea {...props} rows={key === 'full_description' ? 5 : 3} /> : <AdminTextInput {...props} type={key.endsWith('_url') ? 'url' : ['phone', 'whatsapp_number'].includes(key) ? 'tel' : 'text'} />}
      </AdminField>;
    })}
    <p className="text-sm text-[var(--admin-muted)]">Telefone e WhatsApp: informe +, código do país e número, sem espaços. Não adicionamos DDI ou DDD automaticamente.</p>
    <div className="grid gap-3 md:grid-cols-3">
      {([['is_published', 'Publicado'], ['featured', 'Destaque'], ['recommended_by_hotel', 'Recomendado pelo hotel']] as const).map(([key, label]) => <AdminCheckboxRow key={key}>
        <input name={key} type="checkbox" checked={Boolean(values[key])} onChange={(event) => setField(key, event.target.checked)} />{label}
      </AdminCheckboxRow>)}
    </div>
    <AdminSubmitButton label={item ? 'Salvar alterações' : 'Criar item'} pendingLabel="Salvando..." />
  </form>;
}
