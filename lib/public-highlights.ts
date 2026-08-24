export type PublicHighlightsState = 'hidden' | 'empty' | 'content';

export function getPublicHighlightsState(
  isEnabled: boolean,
  bannerCount: number
): PublicHighlightsState {
  if (!isEnabled) return 'hidden';
  return bannerCount > 0 ? 'content' : 'empty';
}
