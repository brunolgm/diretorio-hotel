'use client';

import { useMemo, useState } from 'react';
import { ServiceIcon } from '@/components/service-icon';
import { AdminField, AdminHelpText, AdminSelect, AdminTextInput } from '@/components/admin/ui';
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
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
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
  const sortedCategoryOptions = useMemo(
    () => [...categoryOptions].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [categoryOptions]
  );
  const selectedIconMeta = SERVICE_ICON_OPTIONS.find((option) => option.value === selectedIcon);

  return (
    <>
      <AdminField label="Ícone">
        <input type="hidden" name="icon" value={selectedIcon} />

        <div className="flex min-h-12 flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[0_8px_18px_-18px_rgba(15,23,42,0.35)]">
              <ServiceIcon iconName={selectedIcon} className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {selectedIconMeta?.label}
              </p>
              <p className="text-xs text-slate-500">Ícone atual do serviço</p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 sm:w-auto"
            onClick={() => setIsIconPickerOpen(true)}
          >
            Selecionar ícone
          </button>
        </div>

        <AdminHelpText>
          Escolha um ícone do catálogo interno para manter o diretório consistente e fácil de
          reconhecer.
        </AdminHelpText>
      </AdminField>

      {isIconPickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-icon-picker-title"
          onClick={() => setIsIconPickerOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] bg-white p-5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Seletor de ícones
                </p>
                <h3
                  id="service-icon-picker-title"
                  className="mt-2 text-xl font-semibold tracking-tight text-slate-950"
                >
                  Escolha um ícone para o serviço
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Selecione uma opção compacta e consistente para o diretório do hotel.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsIconPickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
                aria-label="Fechar seletor de ícones"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {SERVICE_ICON_OPTIONS.map((option) => {
                const isSelected = selectedIcon === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedIcon(option.value);
                      setIsIconPickerOpen(false);
                    }}
                    className={[
                      'group relative flex h-[84px] min-h-[84px] flex-col items-center justify-center rounded-[18px] border px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-slate-300 bg-white text-slate-900 ring-2 ring-slate-200/80 shadow-[0_8px_16px_-18px_rgba(15,23,42,0.18)]'
                        : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute right-1.5 top-1.5 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[8px] font-medium tracking-[0.01em] transition',
                        isSelected
                          ? 'border-slate-200 bg-slate-100 text-slate-700 opacity-100'
                          : 'border-transparent bg-transparent text-transparent opacity-0',
                      ].join(' ')}
                      aria-hidden={!isSelected}
                    >
                      ✓
                    </span>

                    <div
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-[14px] transition',
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] group-hover:bg-slate-100',
                      ].join(' ')}
                    >
                      <ServiceIcon iconName={option.value} className="h-4.5 w-4.5" />
                    </div>

                    <p className="mt-1.5 line-clamp-2 min-h-[1.5rem] text-center text-[10px] font-semibold leading-3">
                      {option.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

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
          {sortedCategoryOptions.map((category) => (
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

      {useCustomCategory ? (
        <AdminField label="Nova categoria">
          <AdminTextInput
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            placeholder="Ex.: Experiências"
            autoFocus
          />
          <AdminHelpText>
            Use um nome curto e claro para manter a organização dos serviços.
          </AdminHelpText>
        </AdminField>
      ) : null}
    </>
  );
}
