import type { CSSProperties } from 'react';

export const HOTEL_THEME_PRESETS = [
  {
    value: 'midnight-slate',
    label: 'Midnight Slate',
    description: 'Paleta escura e sofisticada, alinhada ao visual principal do LibGuest.',
  },
  {
    value: 'ivory-noir',
    label: 'Ivory Noir',
    description: 'Base carvão com nuances quentes e acabamento elegante.',
  },
  {
    value: 'deep-ocean',
    label: 'Deep Ocean',
    description: 'Tons oceânicos profundos com atmosfera premium e contemporânea.',
  },
  {
    value: 'graphite-gold',
    label: 'Graphite Gold',
    description: 'Grafite refinado com acentos quentes inspirados em hospitalidade de luxo.',
  },
  {
    value: 'forest-ember',
    label: 'Forest Ember',
    description: 'Verdes escuros com calor sutil e sensação acolhedora.',
  },
] as const;

export type HotelThemePreset = (typeof HOTEL_THEME_PRESETS)[number]['value'];

export const HOTEL_THEME_ACCENT_SUGGESTIONS: Record<HotelThemePreset, string[]> = {
  'midnight-slate': ['#1D4ED8', '#2563EB', '#0F766E', '#7C3AED', '#EA580C'],
  'ivory-noir': ['#C08A54', '#B45309', '#92400E', '#BE8A60', '#7C2D12'],
  'deep-ocean': ['#0EA5E9', '#0284C7', '#0891B2', '#2563EB', '#14B8A6'],
  'graphite-gold': ['#D4A017', '#CA8A04', '#F59E0B', '#B45309', '#A16207'],
  'forest-ember': ['#D97706', '#B45309', '#15803D', '#2F855A', '#C2410C'],
};

type ThemeCssVariables = CSSProperties & {
  '--hotel-accent': string;
  '--hotel-accent-foreground': string;
  '--hotel-accent-soft': string;
  '--hotel-accent-soft-strong': string;
  '--hotel-accent-border': string;
  '--hotel-badge-bg': string;
  '--hotel-badge-border': string;
  '--hotel-badge-text': string;
  '--hotel-footer-bg': string;
  '--hotel-footer-border': string;
  '--hotel-footer-text': string;
  '--hotel-hero-muted': string;
  '--hotel-hero-secondary-bg': string;
  '--hotel-hero-secondary-border': string;
  '--hotel-hero-secondary-text': string;
  '--hotel-hero-secondary-hover-bg': string;
  '--hotel-hero-disabled-bg': string;
  '--hotel-hero-disabled-text': string;
  '--hotel-section-label': string;
};

type HotelThemeConfig = {
  label: string;
  heroClassName: string;
  heroOverlayClassName: string;
  accentColor: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeText: string;
  footerBackground: string;
  footerBorder: string;
  footerText: string;
  heroMutedText: string;
  heroSecondaryBg: string;
  heroSecondaryBorder: string;
  heroSecondaryText: string;
  heroSecondaryHoverBg: string;
  heroDisabledBg: string;
  heroDisabledText: string;
  sectionLabelText: string;
};

const DEFAULT_HOTEL_THEME_PRESET: HotelThemePreset = 'midnight-slate';
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{6})$/;

const HOTEL_THEME_CONFIGS: Record<HotelThemePreset, HotelThemeConfig> = {
  'midnight-slate': {
    label: 'Midnight Slate',
    heroClassName:
      'bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)]',
    heroOverlayClassName:
      'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.14),transparent_30%)]',
    accentColor: '#1D4ED8',
    badgeBackground: 'rgba(255,255,255,0.10)',
    badgeBorder: 'rgba(255,255,255,0.14)',
    badgeText: '#E2E8F0',
    footerBackground: 'rgba(255,255,255,0.88)',
    footerBorder: 'rgba(148,163,184,0.26)',
    footerText: '#334155',
    heroMutedText: '#CBD5E1',
    heroSecondaryBg: 'rgba(255,255,255,0.06)',
    heroSecondaryBorder: 'rgba(255,255,255,0.12)',
    heroSecondaryText: '#F1F5F9',
    heroSecondaryHoverBg: 'rgba(255,255,255,0.10)',
    heroDisabledBg: 'rgba(255,255,255,0.05)',
    heroDisabledText: 'rgba(255,255,255,0.48)',
    sectionLabelText: '#64748B',
  },
  'ivory-noir': {
    label: 'Ivory Noir',
    heroClassName:
      'bg-[linear-gradient(145deg,#171310_0%,#2f2722_52%,#4c4037_100%)]',
    heroOverlayClassName:
      'bg-[radial-gradient(circle_at_top_right,rgba(255,244,230,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,214,170,0.12),transparent_32%)]',
    accentColor: '#C08A54',
    badgeBackground: 'rgba(255,244,230,0.10)',
    badgeBorder: 'rgba(255,244,230,0.18)',
    badgeText: '#F8E7D4',
    footerBackground: 'rgba(255,250,245,0.92)',
    footerBorder: 'rgba(192,138,84,0.22)',
    footerText: '#4A3426',
    heroMutedText: '#E7D4C4',
    heroSecondaryBg: 'rgba(255,244,230,0.07)',
    heroSecondaryBorder: 'rgba(255,244,230,0.16)',
    heroSecondaryText: '#F8E7D4',
    heroSecondaryHoverBg: 'rgba(255,244,230,0.13)',
    heroDisabledBg: 'rgba(255,244,230,0.06)',
    heroDisabledText: 'rgba(248,231,212,0.48)',
    sectionLabelText: '#78716C',
  },
  'deep-ocean': {
    label: 'Deep Ocean',
    heroClassName:
      'bg-[linear-gradient(145deg,#031521_0%,#0b2e43_52%,#174e68_100%)]',
    heroOverlayClassName:
      'bg-[radial-gradient(circle_at_top_right,rgba(186,230,253,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%)]',
    accentColor: '#0EA5E9',
    badgeBackground: 'rgba(125,211,252,0.12)',
    badgeBorder: 'rgba(125,211,252,0.22)',
    badgeText: '#E0F2FE',
    footerBackground: 'rgba(240,249,255,0.92)',
    footerBorder: 'rgba(14,165,233,0.22)',
    footerText: '#0F3A4F',
    heroMutedText: '#BAE6FD',
    heroSecondaryBg: 'rgba(125,211,252,0.08)',
    heroSecondaryBorder: 'rgba(125,211,252,0.18)',
    heroSecondaryText: '#E0F2FE',
    heroSecondaryHoverBg: 'rgba(125,211,252,0.14)',
    heroDisabledBg: 'rgba(125,211,252,0.06)',
    heroDisabledText: 'rgba(224,242,254,0.48)',
    sectionLabelText: '#64748B',
  },
  'graphite-gold': {
    label: 'Graphite Gold',
    heroClassName:
      'bg-[linear-gradient(145deg,#121212_0%,#24211c_52%,#423726_100%)]',
    heroOverlayClassName:
      'bg-[radial-gradient(circle_at_top_right,rgba(253,230,138,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_30%)]',
    accentColor: '#D4A017',
    badgeBackground: 'rgba(253,230,138,0.10)',
    badgeBorder: 'rgba(253,230,138,0.20)',
    badgeText: '#FEF3C7',
    footerBackground: 'rgba(255,251,235,0.92)',
    footerBorder: 'rgba(212,160,23,0.24)',
    footerText: '#5B4513',
    heroMutedText: '#FDE68A',
    heroSecondaryBg: 'rgba(253,230,138,0.07)',
    heroSecondaryBorder: 'rgba(253,230,138,0.16)',
    heroSecondaryText: '#FEF3C7',
    heroSecondaryHoverBg: 'rgba(253,230,138,0.13)',
    heroDisabledBg: 'rgba(253,230,138,0.06)',
    heroDisabledText: 'rgba(254,243,199,0.48)',
    sectionLabelText: '#78716C',
  },
  'forest-ember': {
    label: 'Forest Ember',
    heroClassName:
      'bg-[linear-gradient(145deg,#0d1714_0%,#1f3328_52%,#4c3426_100%)]',
    heroOverlayClassName:
      'bg-[radial-gradient(circle_at_top_right,rgba(187,247,208,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.12),transparent_30%)]',
    accentColor: '#D97706',
    badgeBackground: 'rgba(187,247,208,0.10)',
    badgeBorder: 'rgba(187,247,208,0.18)',
    badgeText: '#DCFCE7',
    footerBackground: 'rgba(247,254,231,0.92)',
    footerBorder: 'rgba(217,119,6,0.22)',
    footerText: '#3F3A20',
    heroMutedText: '#D9F99D',
    heroSecondaryBg: 'rgba(187,247,208,0.07)',
    heroSecondaryBorder: 'rgba(187,247,208,0.16)',
    heroSecondaryText: '#ECFCCB',
    heroSecondaryHoverBg: 'rgba(187,247,208,0.13)',
    heroDisabledBg: 'rgba(187,247,208,0.06)',
    heroDisabledText: 'rgba(220,252,231,0.48)',
    sectionLabelText: '#57534E',
  },
};

export function isHotelThemePreset(value: string | null | undefined): value is HotelThemePreset {
  return HOTEL_THEME_PRESETS.some((preset) => preset.value === value);
}

export function sanitizeHotelThemePreset(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return isHotelThemePreset(normalized) ? normalized : null;
}

export function sanitizeHotelThemePrimaryColor(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

function hexToRgb(color: string) {
  const normalized = sanitizeHotelThemePrimaryColor(color);

  if (!normalized) {
    return null;
  }

  const hex = normalized.slice(1);

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function toRgba(color: string, alpha: number) {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return `rgba(15,23,42,${alpha})`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function toLinearChannel(value: number) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(color: string) {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return 0;
  }

  const r = toLinearChannel(rgb.r);
  const g = toLinearChannel(rgb.g);
  const b = toLinearChannel(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getAccessibleAccentForeground(color: string) {
  return getRelativeLuminance(color) > 0.45 ? '#0F172A' : '#FFFFFF';
}

export function resolveHotelTheme(
  presetValue: string | null | undefined,
  primaryColorValue: string | null | undefined
) {
  const preset = sanitizeHotelThemePreset(presetValue) ?? DEFAULT_HOTEL_THEME_PRESET;
  const config = HOTEL_THEME_CONFIGS[preset];
  const primaryColor = sanitizeHotelThemePrimaryColor(primaryColorValue);
  const effectiveAccent = primaryColor ?? config.accentColor;

  const cssVars: ThemeCssVariables = {
    '--hotel-accent': effectiveAccent,
    '--hotel-accent-foreground': getAccessibleAccentForeground(effectiveAccent),
    '--hotel-accent-soft': toRgba(effectiveAccent, 0.1),
    '--hotel-accent-soft-strong': toRgba(effectiveAccent, 0.15),
    '--hotel-accent-border': toRgba(effectiveAccent, 0.22),
    '--hotel-badge-bg': config.badgeBackground,
    '--hotel-badge-border': config.badgeBorder,
    '--hotel-badge-text': config.badgeText,
    '--hotel-footer-bg': config.footerBackground,
    '--hotel-footer-border': config.footerBorder,
    '--hotel-footer-text': config.footerText,
    '--hotel-hero-muted': config.heroMutedText,
    '--hotel-hero-secondary-bg': config.heroSecondaryBg,
    '--hotel-hero-secondary-border': config.heroSecondaryBorder,
    '--hotel-hero-secondary-text': config.heroSecondaryText,
    '--hotel-hero-secondary-hover-bg': config.heroSecondaryHoverBg,
    '--hotel-hero-disabled-bg': config.heroDisabledBg,
    '--hotel-hero-disabled-text': config.heroDisabledText,
    '--hotel-section-label': config.sectionLabelText,
  };

  return {
    preset,
    label: config.label,
    accentColor: effectiveAccent,
    usesPrimaryOverride: Boolean(primaryColor),
    heroClassName: config.heroClassName,
    heroOverlayClassName: config.heroOverlayClassName,
    cssVars,
  };
}

export { DEFAULT_HOTEL_THEME_PRESET };
