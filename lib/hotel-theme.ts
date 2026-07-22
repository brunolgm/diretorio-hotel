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

export const HOTEL_BRAND_PRESETS = [
  {
    value: 'libguest-signature',
    label: 'LibGuest Signature',
    status: 'foundation-only',
    legacyFallback: 'midnight-slate',
  },
  {
    value: 'novotel',
    label: 'Novotel',
    status: 'experience-implemented',
    legacyFallback: 'deep-ocean',
  },
  {
    value: 'grand-mercure',
    label: 'Grand Mercure',
    status: 'foundation-only',
    legacyFallback: 'graphite-gold',
  },
  {
    value: 'mercure',
    label: 'Mercure',
    status: 'foundation-only',
    legacyFallback: 'ivory-noir',
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  status: 'foundation-only' | 'experience-implemented';
  legacyFallback: HotelThemePreset;
}>;

export type HotelBrandPreset = (typeof HOTEL_BRAND_PRESETS)[number]['value'];
export type HotelVisualPreset = HotelThemePreset | HotelBrandPreset;
export type HotelIconStyle = 'soft' | 'outlined' | 'solid';

export interface HotelThemeTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryContrast: string;
  secondary: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  danger: string;
  success: string;
  cardRadius: string;
  cardShadow: string;
  heroOverlay: string;
  navigation: string;
  iconStyle: HotelIconStyle;
  fontFamily: string;
  heroBackground: string;
  heroText: string;
  heroMuted: string;
  heroRadius: string;
  heroShadow: string;
  headerBackground: string;
  headerBorder: string;
  headerText: string;
  iconBackground: string;
  iconBorder: string;
  iconColor: string;
  buttonRadius: string;
  bannerBackground: string;
  bannerRadius: string;
  helpBackground: string;
  activeBackground: string;
  signatureBackground: string;
  signatureText: string;
}

export const HOTEL_THEME_ACCENT_SUGGESTIONS: Record<HotelThemePreset, string[]> = {
  'midnight-slate': ['#1D4ED8', '#2563EB', '#0F766E', '#7C3AED', '#EA580C'],
  'ivory-noir': ['#C08A54', '#B45309', '#92400E', '#BE8A60', '#7C2D12'],
  'deep-ocean': ['#0EA5E9', '#0284C7', '#0891B2', '#2563EB', '#14B8A6'],
  'graphite-gold': ['#D4A017', '#CA8A04', '#F59E0B', '#B45309', '#A16207'],
  'forest-ember': ['#D97706', '#B45309', '#15803D', '#2F855A', '#C2410C'],
};

type ThemeCssVariables = CSSProperties & {
  '--hotel-background': string;
  '--hotel-surface': string;
  '--hotel-surface-muted': string;
  '--hotel-primary': string;
  '--hotel-primary-foreground': string;
  '--hotel-secondary': string;
  '--hotel-text': string;
  '--hotel-text-muted': string;
  '--hotel-border': string;
  '--hotel-accent': string;
  '--hotel-accent-foreground': string;
  '--hotel-accent-soft': string;
  '--hotel-accent-soft-strong': string;
  '--hotel-accent-border': string;
  '--hotel-danger': string;
  '--hotel-success': string;
  '--hotel-card-radius': string;
  '--hotel-card-shadow': string;
  '--hotel-font-family': string;
  '--hotel-hero-background': string;
  '--hotel-hero-overlay': string;
  '--hotel-hero-text': string;
  '--hotel-hero-muted': string;
  '--hotel-hero-radius': string;
  '--hotel-hero-shadow': string;
  '--hotel-header-bg': string;
  '--hotel-header-border': string;
  '--hotel-header-text': string;
  '--hotel-icon-bg': string;
  '--hotel-icon-border': string;
  '--hotel-icon-color': string;
  '--hotel-button-radius': string;
  '--hotel-banner-bg': string;
  '--hotel-banner-radius': string;
  '--hotel-help-bg': string;
  '--hotel-navigation': string;
  '--hotel-active-bg': string;
  '--hotel-signature-bg': string;
  '--hotel-signature-text': string;
  '--hotel-badge-bg': string;
  '--hotel-badge-border': string;
  '--hotel-badge-text': string;
  '--hotel-footer-bg': string;
  '--hotel-footer-border': string;
  '--hotel-footer-text': string;
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
  kind: 'legacy' | 'brand';
  heroClassName: string;
  heroOverlayClassName: string;
  tokens: HotelThemeTokens;
  badgeBackground: string;
  badgeBorder: string;
  badgeText: string;
  footerBackground: string;
  footerBorder: string;
  footerText: string;
  heroSecondaryBg: string;
  heroSecondaryBorder: string;
  heroSecondaryText: string;
  heroSecondaryHoverBg: string;
  heroDisabledBg: string;
  heroDisabledText: string;
  sectionLabelText: string;
};

type ThemeTokenInput = Pick<
  HotelThemeTokens,
  'primary' | 'heroBackground' | 'heroOverlay' | 'heroMuted'
> &
  Partial<Omit<HotelThemeTokens, 'primary' | 'primaryContrast' | 'heroBackground' | 'heroOverlay' | 'heroMuted'>>;

const DEFAULT_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const DEFAULT_HOTEL_THEME_PRESET: HotelThemePreset = 'midnight-slate';
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{6})$/;

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

  return (
    0.2126 * toLinearChannel(rgb.r) +
    0.7152 * toLinearChannel(rgb.g) +
    0.0722 * toLinearChannel(rgb.b)
  );
}

function getAccessibleForeground(color: string) {
  return getRelativeLuminance(color) > 0.45 ? '#0F172A' : '#FFFFFF';
}

function createThemeTokens(input: ThemeTokenInput): HotelThemeTokens {
  return {
    background: input.background ?? 'linear-gradient(180deg,#f8fafc 0%,#eef2f7 45%,#f8fafc 100%)',
    surface: input.surface ?? '#FFFFFF',
    surfaceMuted: input.surfaceMuted ?? 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)',
    primary: input.primary,
    primaryContrast: getAccessibleForeground(input.primary),
    secondary: input.secondary ?? '#F8FAFC',
    text: input.text ?? '#020617',
    textMuted: input.textMuted ?? '#475569',
    border: input.border ?? 'rgba(226,232,240,0.80)',
    accent: input.accent ?? input.primary,
    danger: input.danger ?? '#DC2626',
    success: input.success ?? '#059669',
    cardRadius: input.cardRadius ?? '30px',
    cardShadow: input.cardShadow ?? '0 18px 45px -32px rgba(15,23,42,0.28)',
    heroOverlay: input.heroOverlay,
    navigation: input.navigation ?? input.primary,
    iconStyle: input.iconStyle ?? 'soft',
    fontFamily: input.fontFamily ?? DEFAULT_FONT_FAMILY,
    heroBackground: input.heroBackground,
    heroText: input.heroText ?? '#FFFFFF',
    heroMuted: input.heroMuted,
    heroRadius: input.heroRadius ?? '40px',
    heroShadow: input.heroShadow ?? '0 30px 90px -48px rgba(15,23,42,0.85)',
    headerBackground: input.headerBackground ?? 'rgba(255,255,255,0.08)',
    headerBorder: input.headerBorder ?? 'rgba(255,255,255,0.12)',
    headerText: input.headerText ?? '#FFFFFF',
    iconBackground: input.iconBackground ?? toRgba(input.accent ?? input.primary, 0.1),
    iconBorder: input.iconBorder ?? toRgba(input.accent ?? input.primary, 0.22),
    iconColor: input.iconColor ?? '#334155',
    buttonRadius: input.buttonRadius ?? '16px',
    bannerBackground: input.bannerBackground ?? '#FFFFFF',
    bannerRadius: input.bannerRadius ?? '34px',
    helpBackground: input.helpBackground ?? '#FFFFFF',
    activeBackground: input.activeBackground ?? toRgba(input.accent ?? input.primary, 0.15),
    signatureBackground: input.signatureBackground ?? 'rgba(255,255,255,0.88)',
    signatureText: input.signatureText ?? '#334155',
  };
}

function createThemeConfig({
  label,
  kind,
  heroClassName,
  heroOverlayClassName,
  tokens,
  badgeBackground,
  badgeBorder,
  badgeText,
  footerBackground,
  footerBorder,
  footerText,
  heroSecondaryBg,
  heroSecondaryBorder,
  heroSecondaryText,
  heroSecondaryHoverBg,
  heroDisabledBg,
  heroDisabledText,
  sectionLabelText,
}: Omit<HotelThemeConfig, 'tokens'> & { tokens: ThemeTokenInput }): HotelThemeConfig {
  return {
    label,
    kind,
    heroClassName,
    heroOverlayClassName,
    tokens: createThemeTokens({
      ...tokens,
      helpBackground: tokens.helpBackground ?? footerBackground,
      signatureBackground: tokens.signatureBackground ?? footerBackground,
      signatureText: tokens.signatureText ?? footerText,
    }),
    badgeBackground,
    badgeBorder,
    badgeText,
    footerBackground,
    footerBorder,
    footerText,
    heroSecondaryBg,
    heroSecondaryBorder,
    heroSecondaryText,
    heroSecondaryHoverBg,
    heroDisabledBg,
    heroDisabledText,
    sectionLabelText,
  };
}

const HOTEL_THEME_CONFIGS: Record<HotelVisualPreset, HotelThemeConfig> = {
  'midnight-slate': createThemeConfig({
    label: 'Midnight Slate',
    kind: 'legacy',
    heroClassName: 'bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.14),transparent_30%)]',
    tokens: {
      primary: '#1D4ED8',
      heroBackground: 'linear-gradient(145deg,#020617 0%,#0f172a 52%,#1e293b 100%)',
      heroOverlay: 'radial-gradient(circle at top right,rgba(255,255,255,0.16),transparent 28%),radial-gradient(circle at bottom left,rgba(148,163,184,0.14),transparent 30%)',
      heroMuted: '#CBD5E1',
    },
    badgeBackground: 'rgba(255,255,255,0.10)', badgeBorder: 'rgba(255,255,255,0.14)', badgeText: '#E2E8F0',
    footerBackground: 'rgba(255,255,255,0.88)', footerBorder: 'rgba(148,163,184,0.26)', footerText: '#334155',
    heroSecondaryBg: 'rgba(255,255,255,0.06)', heroSecondaryBorder: 'rgba(255,255,255,0.12)', heroSecondaryText: '#F1F5F9', heroSecondaryHoverBg: 'rgba(255,255,255,0.10)', heroDisabledBg: 'rgba(255,255,255,0.05)', heroDisabledText: 'rgba(255,255,255,0.48)', sectionLabelText: '#64748B',
  }),
  'ivory-noir': createThemeConfig({
    label: 'Ivory Noir', kind: 'legacy',
    heroClassName: 'bg-[linear-gradient(145deg,#171310_0%,#2f2722_52%,#4c4037_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(255,244,230,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,214,170,0.12),transparent_32%)]',
    tokens: { primary: '#C08A54', heroBackground: 'linear-gradient(145deg,#171310 0%,#2f2722 52%,#4c4037 100%)', heroOverlay: 'radial-gradient(circle at top right,rgba(255,244,230,0.14),transparent 30%),radial-gradient(circle at bottom left,rgba(255,214,170,0.12),transparent 32%)', heroMuted: '#E7D4C4' },
    badgeBackground: 'rgba(255,244,230,0.10)', badgeBorder: 'rgba(255,244,230,0.18)', badgeText: '#F8E7D4', footerBackground: 'rgba(255,250,245,0.92)', footerBorder: 'rgba(192,138,84,0.22)', footerText: '#4A3426', heroSecondaryBg: 'rgba(255,244,230,0.07)', heroSecondaryBorder: 'rgba(255,244,230,0.16)', heroSecondaryText: '#F8E7D4', heroSecondaryHoverBg: 'rgba(255,244,230,0.13)', heroDisabledBg: 'rgba(255,244,230,0.06)', heroDisabledText: 'rgba(248,231,212,0.48)', sectionLabelText: '#78716C',
  }),
  'deep-ocean': createThemeConfig({
    label: 'Deep Ocean', kind: 'legacy',
    heroClassName: 'bg-[linear-gradient(145deg,#031521_0%,#0b2e43_52%,#174e68_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(186,230,253,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%)]',
    tokens: { primary: '#0EA5E9', heroBackground: 'linear-gradient(145deg,#031521 0%,#0b2e43 52%,#174e68 100%)', heroOverlay: 'radial-gradient(circle at top right,rgba(186,230,253,0.16),transparent 28%),radial-gradient(circle at bottom left,rgba(56,189,248,0.12),transparent 30%)', heroMuted: '#BAE6FD' },
    badgeBackground: 'rgba(125,211,252,0.12)', badgeBorder: 'rgba(125,211,252,0.22)', badgeText: '#E0F2FE', footerBackground: 'rgba(240,249,255,0.92)', footerBorder: 'rgba(14,165,233,0.22)', footerText: '#0F3A4F', heroSecondaryBg: 'rgba(125,211,252,0.08)', heroSecondaryBorder: 'rgba(125,211,252,0.18)', heroSecondaryText: '#E0F2FE', heroSecondaryHoverBg: 'rgba(125,211,252,0.14)', heroDisabledBg: 'rgba(125,211,252,0.06)', heroDisabledText: 'rgba(224,242,254,0.48)', sectionLabelText: '#64748B',
  }),
  'graphite-gold': createThemeConfig({
    label: 'Graphite Gold', kind: 'legacy',
    heroClassName: 'bg-[linear-gradient(145deg,#121212_0%,#24211c_52%,#423726_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(253,230,138,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_30%)]',
    tokens: { primary: '#D4A017', heroBackground: 'linear-gradient(145deg,#121212 0%,#24211c 52%,#423726 100%)', heroOverlay: 'radial-gradient(circle at top right,rgba(253,230,138,0.14),transparent 28%),radial-gradient(circle at bottom left,rgba(245,158,11,0.12),transparent 30%)', heroMuted: '#FDE68A' },
    badgeBackground: 'rgba(253,230,138,0.10)', badgeBorder: 'rgba(253,230,138,0.20)', badgeText: '#FEF3C7', footerBackground: 'rgba(255,251,235,0.92)', footerBorder: 'rgba(212,160,23,0.24)', footerText: '#5B4513', heroSecondaryBg: 'rgba(253,230,138,0.07)', heroSecondaryBorder: 'rgba(253,230,138,0.16)', heroSecondaryText: '#FEF3C7', heroSecondaryHoverBg: 'rgba(253,230,138,0.13)', heroDisabledBg: 'rgba(253,230,138,0.06)', heroDisabledText: 'rgba(254,243,199,0.48)', sectionLabelText: '#78716C',
  }),
  'forest-ember': createThemeConfig({
    label: 'Forest Ember', kind: 'legacy',
    heroClassName: 'bg-[linear-gradient(145deg,#0d1714_0%,#1f3328_52%,#4c3426_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(187,247,208,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.12),transparent_30%)]',
    tokens: { primary: '#D97706', heroBackground: 'linear-gradient(145deg,#0d1714 0%,#1f3328 52%,#4c3426 100%)', heroOverlay: 'radial-gradient(circle at top right,rgba(187,247,208,0.14),transparent 28%),radial-gradient(circle at bottom left,rgba(251,146,60,0.12),transparent 30%)', heroMuted: '#D9F99D' },
    badgeBackground: 'rgba(187,247,208,0.10)', badgeBorder: 'rgba(187,247,208,0.18)', badgeText: '#DCFCE7', footerBackground: 'rgba(247,254,231,0.92)', footerBorder: 'rgba(217,119,6,0.22)', footerText: '#3F3A20', heroSecondaryBg: 'rgba(187,247,208,0.07)', heroSecondaryBorder: 'rgba(187,247,208,0.16)', heroSecondaryText: '#ECFCCB', heroSecondaryHoverBg: 'rgba(187,247,208,0.13)', heroDisabledBg: 'rgba(187,247,208,0.06)', heroDisabledText: 'rgba(220,252,231,0.48)', sectionLabelText: '#57534E',
  }),
  'libguest-signature': createThemeConfig({
    label: 'LibGuest Signature',
    kind: 'brand',
    heroClassName: 'bg-[linear-gradient(145deg,#04111D_0%,#082333_55%,#0C3A43_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.20),transparent_30%),linear-gradient(180deg,rgba(2,10,18,0.02),rgba(2,10,18,0.30))]',
    tokens: {
      background: 'linear-gradient(180deg,#04111D 0%,#071A26 48%,#04131E 100%)',
      surface: '#0B2230',
      surfaceMuted: 'linear-gradient(180deg,#102B3A 0%,#0A1D29 100%)',
      primary: '#0A2A3A',
      accent: '#25C7B7',
      secondary: '#123846',
      text: '#F2FBFC',
      textMuted: '#A8C3C9',
      border: 'rgba(94,234,212,0.20)',
      danger: '#FB7185',
      success: '#34D399',
      cardRadius: '26px',
      cardShadow: '0 22px 55px -32px rgba(0,0,0,0.72)',
      heroBackground: 'linear-gradient(145deg,#04111D 0%,#082333 55%,#0C3A43 100%)',
      heroOverlay: 'radial-gradient(circle at top right,rgba(45,212,191,0.20),transparent 30%),linear-gradient(180deg,rgba(2,10,18,0.02),rgba(2,10,18,0.30))',
      heroMuted: '#B7D5D9',
      navigation: '#E6FFFB',
      iconStyle: 'outlined',
      iconColor: '#5EEAD4',
      buttonRadius: '14px',
      bannerBackground: '#0B2230',
      bannerRadius: '26px',
      helpBackground: '#0D2734',
      signatureBackground: '#061923',
      signatureText: '#7DE4D8',
      fontFamily: DEFAULT_FONT_FAMILY,
    },
    badgeBackground: 'rgba(45,212,191,0.10)',
    badgeBorder: 'rgba(94,234,212,0.24)',
    badgeText: '#CCFBF1',
    footerBackground: '#0D2734',
    footerBorder: 'rgba(94,234,212,0.20)',
    footerText: '#B7D5D9',
    heroSecondaryBg: 'rgba(45,212,191,0.08)',
    heroSecondaryBorder: 'rgba(94,234,212,0.20)',
    heroSecondaryText: '#E6FFFB',
    heroSecondaryHoverBg: 'rgba(45,212,191,0.14)',
    heroDisabledBg: 'rgba(45,212,191,0.05)',
    heroDisabledText: 'rgba(204,251,241,0.46)',
    sectionLabelText: '#7DD3C7',
  }),
  novotel: createThemeConfig({
    label: 'Novotel', kind: 'brand',
    heroClassName: 'bg-[linear-gradient(145deg,#002B5C_0%,#004A8F_55%,#0877BE_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_30%),linear-gradient(180deg,rgba(0,32,71,0.06),rgba(0,32,71,0.28))]',
    tokens: {
      background: 'linear-gradient(180deg,#F6FAFD 0%,#EDF5FA 48%,#F8FBFD 100%)',
      surface: '#FFFFFF',
      surfaceMuted: '#FFFFFF',
      primary: '#003B7A',
      accent: '#0072CE',
      secondary: '#E6F1F8',
      text: '#102A43',
      textMuted: '#526A7E',
      border: 'rgba(0,59,122,0.14)',
      cardRadius: '22px',
      cardShadow: '0 18px 42px -30px rgba(0,59,122,0.32)',
      heroBackground: 'linear-gradient(145deg,#002B5C 0%,#004A8F 55%,#0877BE 100%)',
      heroOverlay: 'linear-gradient(90deg,rgba(0,35,82,0.46) 0%,rgba(0,59,122,0.14) 52%,rgba(0,82,154,0.04) 100%),linear-gradient(180deg,rgba(0,32,71,0.05) 0%,rgba(0,32,71,0.08) 48%,rgba(0,32,71,0.58) 100%)',
      heroMuted: '#E2F2FC',
      heroRadius: '30px',
      navigation: '#003B7A',
      iconStyle: 'outlined',
      iconColor: '#0068B5',
      buttonRadius: '14px',
      bannerBackground: '#FFFFFF',
      bannerRadius: '24px',
      helpBackground: '#E9F4FA',
      signatureBackground: 'rgba(255,255,255,0.78)',
      signatureText: '#526A7E',
      fontFamily: DEFAULT_FONT_FAMILY,
    },
    badgeBackground: 'rgba(255,255,255,0.12)', badgeBorder: 'rgba(255,255,255,0.20)', badgeText: '#FFFFFF', footerBackground: 'rgba(255,255,255,0.94)', footerBorder: 'rgba(0,59,122,0.16)', footerText: '#26445F', heroSecondaryBg: 'rgba(255,255,255,0.10)', heroSecondaryBorder: 'rgba(255,255,255,0.20)', heroSecondaryText: '#FFFFFF', heroSecondaryHoverBg: 'rgba(255,255,255,0.16)', heroDisabledBg: 'rgba(255,255,255,0.07)', heroDisabledText: 'rgba(255,255,255,0.50)', sectionLabelText: '#52667A',
  }),
  'grand-mercure': createThemeConfig({
    label: 'Grand Mercure', kind: 'brand',
    heroClassName: 'bg-[linear-gradient(145deg,#211F1C_0%,#34302B_55%,#5A4C3C_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(229,205,161,0.20),transparent_32%),linear-gradient(180deg,rgba(18,16,13,0.04),rgba(18,16,13,0.28))]',
    tokens: { background: 'linear-gradient(180deg,#F7F3EA 0%,#F2ECE0 48%,#FAF8F3 100%)', surface: '#FFFCF7', surfaceMuted: 'linear-gradient(180deg,#FFFCF7 0%,#F5EFE5 100%)', primary: '#2B2926', accent: '#B08D57', secondary: '#EDE3D2', text: '#2B2926', textMuted: '#70675B', border: 'rgba(124,101,70,0.22)', cardRadius: '24px', heroBackground: 'linear-gradient(145deg,#211F1C 0%,#34302B 55%,#5A4C3C 100%)', heroOverlay: 'radial-gradient(circle at top right,rgba(229,205,161,0.20),transparent 32%),linear-gradient(180deg,rgba(18,16,13,0.04),rgba(18,16,13,0.28))', heroMuted: '#E8DCC7', navigation: '#2B2926', iconStyle: 'outlined', iconColor: '#8B6B3E', buttonRadius: '12px', bannerRadius: '24px' },
    badgeBackground: 'rgba(255,248,235,0.10)', badgeBorder: 'rgba(229,205,161,0.24)', badgeText: '#F3E6CF', footerBackground: 'rgba(255,252,247,0.94)', footerBorder: 'rgba(176,141,87,0.24)', footerText: '#4B4339', heroSecondaryBg: 'rgba(255,248,235,0.08)', heroSecondaryBorder: 'rgba(229,205,161,0.20)', heroSecondaryText: '#F7EDDD', heroSecondaryHoverBg: 'rgba(255,248,235,0.14)', heroDisabledBg: 'rgba(255,248,235,0.06)', heroDisabledText: 'rgba(247,237,221,0.48)', sectionLabelText: '#746858',
  }),
  mercure: createThemeConfig({
    label: 'Mercure', kind: 'brand',
    heroClassName: 'bg-[linear-gradient(145deg,#1B2025_0%,#30383E_55%,#544A45_100%)]',
    heroOverlayClassName: 'bg-[radial-gradient(circle_at_top_right,rgba(224,194,177,0.16),transparent_30%),linear-gradient(180deg,rgba(20,24,28,0.04),rgba(20,24,28,0.26))]',
    tokens: { background: 'linear-gradient(180deg,#F5F4F2 0%,#EEECEA 48%,#F8F7F5 100%)', surface: '#FFFFFF', surfaceMuted: 'linear-gradient(180deg,#FFFFFF 0%,#F2F0ED 100%)', primary: '#262D32', accent: '#9A5A4A', secondary: '#E8E3DE', text: '#252A2E', textMuted: '#66615D', border: 'rgba(86,76,70,0.20)', heroBackground: 'linear-gradient(145deg,#1B2025 0%,#30383E 55%,#544A45 100%)', heroOverlay: 'radial-gradient(circle at top right,rgba(224,194,177,0.16),transparent 30%),linear-gradient(180deg,rgba(20,24,28,0.04),rgba(20,24,28,0.26))', heroMuted: '#DED8D3', navigation: '#262D32', iconStyle: 'outlined', iconColor: '#815044' },
    badgeBackground: 'rgba(255,255,255,0.10)', badgeBorder: 'rgba(224,194,177,0.20)', badgeText: '#F3ECE8', footerBackground: 'rgba(255,255,255,0.94)', footerBorder: 'rgba(154,90,74,0.22)', footerText: '#4C4642', heroSecondaryBg: 'rgba(255,255,255,0.08)', heroSecondaryBorder: 'rgba(224,194,177,0.18)', heroSecondaryText: '#F5EFEB', heroSecondaryHoverBg: 'rgba(255,255,255,0.14)', heroDisabledBg: 'rgba(255,255,255,0.06)', heroDisabledText: 'rgba(245,239,235,0.48)', sectionLabelText: '#6F6863',
  }),
};

export function isHotelThemePreset(value: string | null | undefined): value is HotelThemePreset {
  return HOTEL_THEME_PRESETS.some((preset) => preset.value === value);
}

export function isHotelBrandPreset(value: string | null | undefined): value is HotelBrandPreset {
  return HOTEL_BRAND_PRESETS.some((preset) => preset.value === value);
}

export function sanitizeHotelThemePreset(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return isHotelThemePreset(normalized) ? normalized : null;
}

function resolveVisualPreset(value: string | null | undefined): HotelVisualPreset {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return isHotelThemePreset(normalized) || isHotelBrandPreset(normalized)
    ? normalized
    : DEFAULT_HOTEL_THEME_PRESET;
}

export function resolveHotelTheme(
  presetValue: string | null | undefined,
  primaryColorValue: string | null | undefined
) {
  const preset = resolveVisualPreset(presetValue);
  const config = HOTEL_THEME_CONFIGS[preset];
  const primaryColor = sanitizeHotelThemePrimaryColor(primaryColorValue);
  const effectiveAccent = primaryColor ?? config.tokens.accent;
  const tokens: HotelThemeTokens = {
    ...config.tokens,
    accent: effectiveAccent,
    activeBackground: toRgba(effectiveAccent, 0.15),
    iconBackground: toRgba(effectiveAccent, 0.1),
    iconBorder: toRgba(effectiveAccent, 0.22),
  };

  const cssVars: ThemeCssVariables = {
    '--hotel-background': tokens.background,
    '--hotel-surface': tokens.surface,
    '--hotel-surface-muted': tokens.surfaceMuted,
    '--hotel-primary': tokens.primary,
    '--hotel-primary-foreground': tokens.primaryContrast,
    '--hotel-secondary': tokens.secondary,
    '--hotel-text': tokens.text,
    '--hotel-text-muted': tokens.textMuted,
    '--hotel-border': tokens.border,
    '--hotel-accent': effectiveAccent,
    '--hotel-accent-foreground': getAccessibleForeground(effectiveAccent),
    '--hotel-accent-soft': toRgba(effectiveAccent, 0.1),
    '--hotel-accent-soft-strong': toRgba(effectiveAccent, 0.15),
    '--hotel-accent-border': toRgba(effectiveAccent, 0.22),
    '--hotel-danger': tokens.danger,
    '--hotel-success': tokens.success,
    '--hotel-card-radius': tokens.cardRadius,
    '--hotel-card-shadow': tokens.cardShadow,
    '--hotel-font-family': tokens.fontFamily,
    '--hotel-hero-background': tokens.heroBackground,
    '--hotel-hero-overlay': tokens.heroOverlay,
    '--hotel-hero-text': tokens.heroText,
    '--hotel-hero-muted': tokens.heroMuted,
    '--hotel-hero-radius': tokens.heroRadius,
    '--hotel-hero-shadow': tokens.heroShadow,
    '--hotel-header-bg': tokens.headerBackground,
    '--hotel-header-border': tokens.headerBorder,
    '--hotel-header-text': tokens.headerText,
    '--hotel-icon-bg': tokens.iconBackground,
    '--hotel-icon-border': tokens.iconBorder,
    '--hotel-icon-color': tokens.iconColor,
    '--hotel-button-radius': tokens.buttonRadius,
    '--hotel-banner-bg': tokens.bannerBackground,
    '--hotel-banner-radius': tokens.bannerRadius,
    '--hotel-help-bg': tokens.helpBackground,
    '--hotel-navigation': tokens.navigation,
    '--hotel-active-bg': tokens.activeBackground,
    '--hotel-signature-bg': tokens.signatureBackground,
    '--hotel-signature-text': tokens.signatureText,
    '--hotel-badge-bg': config.badgeBackground,
    '--hotel-badge-border': config.badgeBorder,
    '--hotel-badge-text': config.badgeText,
    '--hotel-footer-bg': config.footerBackground,
    '--hotel-footer-border': config.footerBorder,
    '--hotel-footer-text': config.footerText,
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
    kind: config.kind,
    label: config.label,
    accentColor: effectiveAccent,
    usesPrimaryOverride: Boolean(primaryColor),
    heroClassName: config.heroClassName,
    heroOverlayClassName: config.heroOverlayClassName,
    iconStyle: tokens.iconStyle,
    tokens,
    cssVars,
  };
}

export { DEFAULT_HOTEL_THEME_PRESET };
