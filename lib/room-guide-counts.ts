const countCopy = {
  pt: { channels: ['canal encontrado', 'canais encontrados'], apps: ['aplicativo', 'aplicativos'] },
  en: { channels: ['channel found', 'channels found'], apps: ['application', 'applications'] },
  es: { channels: ['canal encontrado', 'canales encontrados'], apps: ['aplicación', 'aplicaciones'] },
} as const;

export function guideChannelResultSummary(
  language: keyof typeof countCopy,
  channelCount: number,
  applicationCount: number,
) {
  const copy = countCopy[language];
  const channels = `${channelCount} ${copy.channels[channelCount === 1 ? 0 : 1]}`;
  // Keep the existing summary behavior: omit applications when none match.
  return applicationCount
    ? `${channels} · ${applicationCount} ${copy.apps[applicationCount === 1 ? 0 : 1]}`
    : channels;
}
