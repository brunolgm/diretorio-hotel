import type { CSSProperties } from 'react';
import { HOTEL_BRAND_CODES, type HotelBrandCode } from './hotel-theme.ts';

export const ADMIN_THEME_CODES = [
  'libguest-default',
  'grand-mercure',
  'mercure',
  'novotel',
] as const;

export type AdminThemeCode = (typeof ADMIN_THEME_CODES)[number];
export type AdminLogoTreatment = 'product' | 'premium-frame' | 'soft-frame' | 'crisp-frame';

export interface AdminThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textStrong: string;
  muted: string;
  border: string;
  sidebar: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarBorder: string;
  accent: string;
  accentHover: string;
  accentText: string;
  accentSoft: string;
  focus: string;
  focusSoft: string;
  activeBackground: string;
  activeText: string;
}

export interface AdminSemanticColors {
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface AdminTheme {
  code: AdminThemeCode;
  label: string;
  brandCode: HotelBrandCode | null;
  themePreset: string | null;
  logoTreatment: AdminLogoTreatment;
  colors: AdminThemeColors;
  semantic: AdminSemanticColors;
}

const ADMIN_SEMANTIC_COLORS: AdminSemanticColors = Object.freeze({
  success: '#15803d',
  warning: '#b45309',
  danger: '#dc2626',
  info: '#2563eb',
});

const BASE_THEMES: Record<AdminThemeCode, Omit<AdminTheme, 'themePreset'>> = {
  'libguest-default': {
    code: 'libguest-default',
    label: 'LibGuest Default',
    brandCode: null,
    logoTreatment: 'product',
    colors: {
      background: '#f4f6f8',
      surface: '#ffffff',
      surfaceMuted: '#f8fafc',
      text: '#0f172a',
      textStrong: '#07182f',
      muted: '#64748b',
      border: '#e2e8f0',
      sidebar: '#07182f',
      sidebarText: '#f8fafc',
      sidebarMuted: '#94a3b8',
      sidebarBorder: 'rgba(255,255,255,0.10)',
      accent: '#0b4d7c',
      accentHover: '#0b2b50',
      accentText: '#ffffff',
      accentSoft: '#eff6ff',
      focus: '#0284c7',
      focusSoft: 'rgba(14,165,233,0.18)',
      activeBackground: '#ffffff',
      activeText: '#07182f',
    },
    semantic: ADMIN_SEMANTIC_COLORS,
  },
  'grand-mercure': {
    code: 'grand-mercure',
    label: 'Grand Mercure',
    brandCode: 'grand-mercure',
    logoTreatment: 'premium-frame',
    colors: {
      background: '#f1ede4',
      surface: '#fffefa',
      surfaceMuted: '#f7f1e6',
      text: '#292722',
      textStrong: '#1b2027',
      muted: '#6f6a60',
      border: '#e5ded1',
      sidebar: '#151b22',
      sidebarText: '#fffdf8',
      sidebarMuted: '#c7c0b2',
      sidebarBorder: 'rgba(229,210,177,0.18)',
      accent: '#76521a',
      accentHover: '#5f4113',
      accentText: '#ffffff',
      accentSoft: '#f4e9d4',
      focus: '#9a6b1d',
      focusSoft: 'rgba(154,107,29,0.20)',
      activeBackground: '#f2e5cb',
      activeText: '#513812',
    },
    semantic: ADMIN_SEMANTIC_COLORS,
  },
  mercure: {
    code: 'mercure',
    label: 'Mercure',
    brandCode: 'mercure',
    logoTreatment: 'soft-frame',
    colors: {
      background: '#f5f6f7',
      surface: '#ffffff',
      surfaceMuted: '#f8f7f8',
      text: '#211c21',
      textStrong: '#261825',
      muted: '#716570',
      border: '#e7dfe5',
      sidebar: '#211821',
      sidebarText: '#fffafd',
      sidebarMuted: '#cbbbc5',
      sidebarBorder: 'rgba(226,207,220,0.16)',
      accent: '#70445f',
      accentHover: '#59354b',
      accentText: '#ffffff',
      accentSoft: '#f3e9ef',
      focus: '#8d5c79',
      focusSoft: 'rgba(141,92,121,0.20)',
      activeBackground: '#f1e4ec',
      activeText: '#59354b',
    },
    semantic: ADMIN_SEMANTIC_COLORS,
  },
  novotel: {
    code: 'novotel',
    label: 'Novotel',
    brandCode: 'novotel',
    logoTreatment: 'crisp-frame',
    colors: {
      background: '#f3f7fb',
      surface: '#ffffff',
      surfaceMuted: '#f4f8fc',
      text: '#10243a',
      textStrong: '#062b55',
      muted: '#5d7186',
      border: '#dce6ef',
      sidebar: '#062b55',
      sidebarText: '#f7fbff',
      sidebarMuted: '#abc3db',
      sidebarBorder: 'rgba(183,213,239,0.16)',
      accent: '#075cb5',
      accentHover: '#064a91',
      accentText: '#ffffff',
      accentSoft: '#eaf3ff',
      focus: '#0b72d9',
      focusSoft: 'rgba(11,114,217,0.18)',
      activeBackground: '#edf5ff',
      activeText: '#073d76',
    },
    semantic: ADMIN_SEMANTIC_COLORS,
  },
};

function normalizeBrandCode(value: string | null | undefined): HotelBrandCode | null {
  if (typeof value !== 'string') return null;
  return HOTEL_BRAND_CODES.find((brandCode) => brandCode === value) ?? null;
}

function normalizeThemePreset(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function refineSurfaceMuted(
  themeCode: AdminThemeCode,
  themePreset: string | null,
  fallback: string
) {
  if (!themePreset) return fallback;

  if (themeCode === 'grand-mercure' && ['ivory-noir', 'graphite-gold'].includes(themePreset)) {
    return '#f6efe2';
  }

  if (themeCode === 'mercure' && ['ivory-noir', 'forest-ember'].includes(themePreset)) {
    return '#f7f6f7';
  }

  if (themeCode === 'novotel' && themePreset === 'deep-ocean') {
    return '#eef6fd';
  }

  return fallback;
}

export function resolveAdminTheme(
  brandCode: string | null | undefined,
  themePreset?: string | null
): AdminTheme {
  const canonicalBrandCode = normalizeBrandCode(brandCode);
  const code: AdminThemeCode = canonicalBrandCode ?? 'libguest-default';
  const baseTheme = BASE_THEMES[code];
  const normalizedPreset = normalizeThemePreset(themePreset);

  return {
    ...baseTheme,
    themePreset: normalizedPreset,
    colors: {
      ...baseTheme.colors,
      surfaceMuted: refineSurfaceMuted(code, normalizedPreset, baseTheme.colors.surfaceMuted),
    },
    semantic: { ...baseTheme.semantic },
  };
}

export type AdminThemeStyle = CSSProperties & Record<`--admin-${string}`, string>;

export function getAdminThemeStyle(theme: AdminTheme): AdminThemeStyle {
  return {
    '--admin-bg': theme.colors.background,
    '--admin-surface': theme.colors.surface,
    '--admin-surface-muted': theme.colors.surfaceMuted,
    '--admin-text': theme.colors.text,
    '--admin-text-strong': theme.colors.textStrong,
    '--admin-muted': theme.colors.muted,
    '--admin-border': theme.colors.border,
    '--admin-sidebar': theme.colors.sidebar,
    '--admin-sidebar-text': theme.colors.sidebarText,
    '--admin-sidebar-muted': theme.colors.sidebarMuted,
    '--admin-sidebar-border': theme.colors.sidebarBorder,
    '--admin-accent': theme.colors.accent,
    '--admin-accent-hover': theme.colors.accentHover,
    '--admin-accent-text': theme.colors.accentText,
    '--admin-accent-soft': theme.colors.accentSoft,
    '--admin-focus': theme.colors.focus,
    '--admin-focus-soft': theme.colors.focusSoft,
    '--admin-active-bg': theme.colors.activeBackground,
    '--admin-active-text': theme.colors.activeText,
    '--admin-success': theme.semantic.success,
    '--admin-warning': theme.semantic.warning,
    '--admin-danger': theme.semantic.danger,
    '--admin-info': theme.semantic.info,
  };
}
