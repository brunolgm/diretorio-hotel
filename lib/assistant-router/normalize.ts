export interface NormalizedAssistantMessage {
  original: string;
  normalized: string;
}

export function normalizeAssistantMessage(original: string): NormalizedAssistantMessage {
  const normalized = original
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { original, normalized };
}
