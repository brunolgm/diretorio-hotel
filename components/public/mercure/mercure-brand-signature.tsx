'use client';

import Image from 'next/image';
import { useState } from 'react';

const MERCURE_SUBTITLE = 'RIO BOUTIQUE COPACABANA';
const OFFICIAL_MONOGRAM = '/brand/mercure/mercure-monogram-official.svg';
const OFFICIAL_WORDMARK = '/brand/mercure/mercure-wordmark-official.svg';

function UnitSubtitle() {
  return (
    <span className="text-[8px] font-medium tracking-[.28em] text-[var(--mercure-plum)] min-[360px]:text-[9px] md:text-[15px] md:tracking-[.34em]">
      {MERCURE_SUBTITLE}
    </span>
  );
}

function TypographicFallback() {
  return (
    <>
      <span
        aria-hidden="true"
        className="font-serif text-[clamp(4.8rem,21vw,7rem)] leading-[.68] font-normal tracking-[-0.18em] italic md:text-[9rem]"
      >
        M
      </span>
      <span className="mt-4 text-[clamp(1.7rem,8vw,2.4rem)] leading-none font-medium tracking-[.24em] md:mt-6 md:text-[3.4rem] md:tracking-[.28em]">
        MERCURE
      </span>
      <span className="mt-2 md:mt-3">
        <UnitSubtitle />
      </span>
    </>
  );
}

export function MercureBrandSignature({ logoUrl }: { logoUrl?: string | null }) {
  const [configuredLogoFailed, setConfiguredLogoFailed] = useState(false);
  const [officialLogoFailed, setOfficialLogoFailed] = useState(false);

  if (logoUrl && !configuredLogoFailed) {
    return (
      <div
        role="img"
        aria-label={`Mercure ${MERCURE_SUBTITLE}`}
        className="flex -translate-x-2 -translate-y-1 flex-col items-center overflow-visible md:translate-x-0 md:translate-y-0"
      >
        <div className="relative h-[91px] w-[min(65vw,279px)] overflow-visible md:h-[140px] md:w-[426px]">
          <Image
            src={logoUrl}
            alt=""
            fill
            unoptimized
            className="object-contain"
            sizes="(min-width: 768px) 426px, 65vw"
            priority
            onError={() => setConfiguredLogoFailed(true)}
          />
        </div>
        <UnitSubtitle />
      </div>
    );
  }

  if (!officialLogoFailed) {
    return (
      <div
        role="img"
        aria-label={`Mercure Hotels ${MERCURE_SUBTITLE}`}
        className="relative flex -translate-x-2 -translate-y-1 flex-col items-center overflow-visible text-[var(--mercure-plum)] md:translate-x-0 md:translate-y-0"
      >
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden="true">
          <Image
            src={OFFICIAL_MONOGRAM}
            alt=""
            width={1}
            height={1}
            priority
            onError={() => setOfficialLogoFailed(true)}
          />
          <Image
            src={OFFICIAL_WORDMARK}
            alt=""
            width={1}
            height={1}
            priority
            onError={() => setOfficialLogoFailed(true)}
          />
        </div>
        <span
          className="mercure-official-monogram block h-[99px] w-[99px] shrink-0 md:h-[151px] md:w-[151px]"
          aria-hidden="true"
        />
        <span
          className="mercure-official-wordmark -mt-12 block aspect-[7/4] w-[180px] shrink-0 md:-mt-[4.5rem] md:w-[283px]"
          aria-hidden="true"
        />
        <span className="-mt-[1.875rem] md:-mt-[2.375rem]">
          <UnitSubtitle />
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Mercure ${MERCURE_SUBTITLE}`}
      className="flex -translate-x-2 -translate-y-1 flex-col items-center text-[var(--mercure-plum)] md:translate-x-0 md:translate-y-0"
    >
      <TypographicFallback />
    </div>
  );
}
