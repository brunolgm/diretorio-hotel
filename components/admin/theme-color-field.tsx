'use client';

import { useEffect, useMemo, useState } from 'react';
import { Palette } from 'lucide-react';
import {
  DEFAULT_HOTEL_THEME_PRESET,
  HOTEL_THEME_ACCENT_SUGGESTIONS,
  sanitizeHotelThemePreset,
  type HotelThemePreset,
} from '@/lib/hotel-theme';

const NEUTRAL_SWATCH = '#CBD5E1';
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{6})$/;

function getValidHexColor(value: string) {
  const normalized = value.trim().toUpperCase();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

export function ThemeColorField({
  name,
  defaultValue,
  preset,
}: {
  name: string;
  defaultValue?: string | null;
  preset?: string | null;
}) {
  const [value, setValue] = useState(defaultValue || '');
  const [activePreset, setActivePreset] = useState<HotelThemePreset>(
    sanitizeHotelThemePreset(preset) ?? DEFAULT_HOTEL_THEME_PRESET
  );
  const validColor = useMemo(() => getValidHexColor(value), [value]);
  const swatchColor = validColor ?? NEUTRAL_SWATCH;
  const suggestedSwatches = HOTEL_THEME_ACCENT_SUGGESTIONS[activePreset];

  useEffect(() => {
    const presetSelect = document.querySelector<HTMLSelectElement>('select[name="theme_preset"]');

    if (!presetSelect) {
      return;
    }

    const updatePreset = () => {
      setActivePreset(
        sanitizeHotelThemePreset(presetSelect.value) ?? DEFAULT_HOTEL_THEME_PRESET
      );
    };

    updatePreset();
    presetSelect.addEventListener('change', updatePreset);

    return () => {
      presetSelect.removeEventListener('change', updatePreset);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Palette className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name={name}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm uppercase outline-none transition focus:border-slate-300 focus:bg-white"
            placeholder="#0F766E"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <input
            type="color"
            aria-label="Selecionar cor primária"
            value={validColor ?? NEUTRAL_SWATCH}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-5 w-5 rounded-full border border-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
              style={{ backgroundColor: swatchColor }}
            />
            <span>{validColor ? 'Prévia ativa' : 'Prévia neutra'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {suggestedSwatches.map((suggestion) => {
          const isActive = validColor === suggestion;

          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => setValue(suggestion)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 ${
                isActive
                  ? 'scale-105 border-slate-900 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.45)]'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300'
              }`}
              style={{ backgroundColor: suggestion }}
              aria-label={`Usar cor sugerida ${suggestion}`}
              title={suggestion}
            >
              <span className="sr-only">{suggestion}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
