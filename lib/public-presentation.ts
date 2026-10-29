import type { SupportedPublicLanguage } from './public-language';
export type EditorialText = { pt: string; en: string; es: string };
export const BENEFIT_ICONS = ['location', 'bed', 'pool', 'fitness'] as const;
export type PublicPresentation = {
  version: 1;
  experienceVersion?: 'v3' | 'v4';
  heroTitleMode: 'media_title' | 'hotel_name';
  heroDesktopFocal: { x: number; y: number } | null;
  benefits: { icon: typeof BENEFIT_ICONS[number]; label: EditorialText }[];
  tourism: { title: EditorialText; description: EditorialText; cards: { title: EditorialText; image_path: string | null }[] };
};
export function editorialText(text: EditorialText, language: SupportedPublicLanguage) { return text[language]?.trim() || text.pt; }
export function emptyPresentation(): PublicPresentation {
  return { version: 1, heroTitleMode: 'media_title', heroDesktopFocal: null, benefits: [], tourism: { title: {pt:'',en:'',es:''}, description: {pt:'',en:'',es:''}, cards: [] } };
}
export function ownedEditorialImage(path: string, hotelId: string) {
  return /^[0-9a-f-]{36}$/.test(hotelId) && new RegExp(`^${hotelId}/hero/editorial/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`).test(path);
}
export function parsePublicPresentation(value: unknown, hotelId: string): PublicPresentation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as PublicPresentation;
  const only = (x:unknown,keys:string[]) => !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k=>keys.includes(k));
  const text = (x: EditorialText, max: number) => only(x,['pt','en','es']) && ['pt','en','es'].every(k => typeof x[k as keyof EditorialText] === 'string' && x[k as keyof EditorialText].length <= max && !/[<>]/.test(x[k as keyof EditorialText]));
  if (!only(v,['version','experienceVersion','heroTitleMode','heroDesktopFocal','benefits','tourism']) || (v.experienceVersion !== undefined && !['v3','v4'].includes(v.experienceVersion)) || v.version !== 1 || !['media_title','hotel_name'].includes(v.heroTitleMode)
    || (v.heroDesktopFocal !== null && (!only(v.heroDesktopFocal,['x','y']) || ![v.heroDesktopFocal.x,v.heroDesktopFocal.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)))
    || !Array.isArray(v.benefits) || v.benefits.length > 8 || !v.benefits.every(b => only(b,['icon','label']) && BENEFIT_ICONS.includes(b.icon) && text(b.label,120) && b.label.pt.trim())
    || !only(v.tourism,['title','description','cards']) || !text(v.tourism.title,160) || !text(v.tourism.description,600) || !Array.isArray(v.tourism.cards) || v.tourism.cards.length > 16
    || !v.tourism.cards.every(c => only(c,['title','image_path']) && text(c.title,120) && c.title.pt.trim() && (c.image_path === null || (typeof c.image_path === 'string' && ownedEditorialImage(c.image_path,hotelId))))) return null;
  return v;
}
