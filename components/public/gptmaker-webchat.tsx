'use client';

import { useLayoutEffect } from 'react';
import Script from 'next/script';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const GPTMAKER_WEBCHAT_SCRIPT = 'https://app.gptmaker.ai/widget/3F83AECD2037037309F0CE90CE228FB1/float.js';
const GRAND_MERCURE_RIO_COPACABANA = 'Grand Mercure Rio de Janeiro Copacabana';

type GptMakerUserMetadata = Readonly<{
  hotel: typeof GRAND_MERCURE_RIO_COPACABANA;
  language: SupportedPublicLanguage;
  source: 'LibGuest';
}>;

type GptMakerWidgetConfiguration = {
  getUserMetadata?: () => GptMakerUserMetadata | Promise<GptMakerUserMetadata>;
  getAdditionalContext?: () => string | Promise<string>;
};

declare global {
  interface Window {
    GPTMakerWidget?: GptMakerWidgetConfiguration;
  }
}

export function GptMakerWebChat({
  language,
  additionalContext,
}: {
  language: SupportedPublicLanguage;
  additionalContext: string;
}) {
  useLayoutEffect(() => {
    const configuration: GptMakerWidgetConfiguration = {
      getUserMetadata: () => ({
        hotel: GRAND_MERCURE_RIO_COPACABANA,
        language,
        source: 'LibGuest',
      }),
      getAdditionalContext: () => additionalContext,
    };

    window.GPTMakerWidget = configuration;

    return () => {
      if (window.GPTMakerWidget === configuration) delete window.GPTMakerWidget;
    };
  }, [additionalContext, language]);

  return <Script
    id="gptmaker-grand-mercure-rio-copacabana"
    src={GPTMAKER_WEBCHAT_SCRIPT}
    strategy="afterInteractive"
    onError={() => undefined}
  />;
}
