export const AI_CHAT_PILOT_SLUG = 'grandmercureriocopacabana';
export const AI_CHAT_POC_MODE: 'native' | 'widget' = 'native';

export function getAiChatPocMode(): 'native' | 'widget' {
  return AI_CHAT_POC_MODE;
}

export function isAiChatPilotHotel(hotelSlug: string) {
  return hotelSlug === AI_CHAT_PILOT_SLUG;
}

// TODO(ai-chat-production): add server-side rate limiting before enabling beyond the POC hotel.
