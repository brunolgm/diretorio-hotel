'use client';

import { useMemo, useState } from 'react';
import { ServiceIcon } from '@/components/service-icon';
import {
  AdminField,
  AdminHelpText,
  AdminInfoBadge,
  AdminSelect,
  AdminTextInput,
} from '@/components/admin/ui';
import {
  resolveServiceIconName,
  type ServiceIconName,
  SERVICE_ICON_OPTIONS,
} from '@/lib/service-options';

interface ServiceGuidedFieldsProps {
  categoryOptions: string[];
  initialIcon?: string | null;
  initialCategory?: string | null;
}

export function ServiceGuidedFields({
  categoryOptions,
  initialIcon,
  initialCategory,
}: ServiceGuidedFieldsProps) {
  const normalizedInitialIcon = resolveServiceIconName(initialIcon);
  const normalizedInitialCategory = initialCategory?.trim() || '';
  const initialCategoryExists =
    !normalizedInitialCategory || categoryOptions.includes(normalizedInitialCategory);

  const [selectedIcon, setSelectedIcon] = useState<ServiceIconName>(normalizedInitialIcon);
  const [useCustomCategory, setUseCustomCategory] = useState(!initialCategoryExists);
  const [selectedCategory, setSelectedCategory] = useState(
    initialCategoryExists ? normalizedInitialCategory : ''
  );
  const [customCategory, setCustomCategory] = useState(
    initialCategoryExists ? '' : normalizedInitialCategory
  );

  const resolvedCategory = useMemo(() => {
    return useCustomCategory ? customCategory.trim() : selectedCategory.trim();
  }, [customCategory, selectedCategory, useCustomCategory]);

  return (
    <>
      <AdminField label="Ícone" className="md:col-span-2">
        <input type="hidden" name="icon" value={selectedIcon} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SERVICE_ICON_OPTIONS.map((option) => {
            const isSelected = selectedIcon === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedIcon(option.value)}
                className={[
                  'rounded-[22px] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-[0_14px_30px_-20px_rgba(15,23,42,0.6)]'
                    : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:-translate-y-0.5 hover:bg-white',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={[
                      'rounded-[16px] p-2.5',
                      isSelected ? 'bg-white/10 text-white' : 'bg-white text-slate-700',
                    ].join(' ')}
                  >
                    <ServiceIcon iconName={option.value} className="h-4 w-4" />
                  </div>

                  {isSelected ? <AdminInfoBadge>Selecionado</AdminInfoBadge> : null}
                </div>

                <p className="mt-4 text-sm font-semibold">{option.label}</p>
                <p
                  className={[
                    'mt-2 text-xs leading-5',
                    isSelected ? 'text-slate-200' : 'text-slate-500',
                  ].join(' ')}
                >
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <AdminHelpText>
          Escolha um ícone do catálogo interno para manter o diretório consistente e fácil de
          reconhecer.
        </AdminHelpText>
      </AdminField>

      <AdminField label="Categoria">
        <input type="hidden" name="category" value={resolvedCategory} />

        <AdminSelect
          value={useCustomCategory ? '__custom__' : selectedCategory}
          onChange={(event) => {
            const nextValue = event.target.value;

            if (nextValue === '__custom__') {
              setUseCustomCategory(true);
              return;
            }

            setUseCustomCategory(false);
            setSelectedCategory(nextValue);
          }}
        >
          <option value="">Sem categoria</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
          <option value="__custom__">Adicionar nova categoria</option>
        </AdminSelect>

        <AdminHelpText>
          Use categorias existentes sempre que possível para manter a operação mais organizada.
        </AdminHelpText>
      </AdminField>

      <AdminField label="Nova categoria">
        <AdminTextInput
          value={customCategory}
          onChange={(event) => setCustomCategory(event.target.value)}
          placeholder="Ex.: Experiências"
          disabled={!useCustomCategory}
        />
        <AdminHelpText>
          Ative esta opção apenas quando a categoria ainda não existir para o hotel.
        </AdminHelpText>
      </AdminField>
    </>
  );
}
