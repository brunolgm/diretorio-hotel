'use client';

import Image from 'next/image';
import { useState } from 'react';

const MERCURE_SUBTITLE = 'RIO BOUTIQUE COPACABANA';
const OFFICIAL_MONOGRAM = '/brand/mercure/mercure-monogram-official.svg';
const OFFICIAL_WORDMARK = '/brand/mercure/mercure-wordmark-official.svg';

function UnitSubtitle({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? 'text-[7px] font-medium tracking-[.24em] text-[var(--mercure-plum)] min-[360px]:text-[8px] md:text-[10px] md:tracking-[.3em] min-[1280px]:text-[10.75px]'
          : 'text-[8px] font-medium tracking-[.28em] text-[var(--mercure-plum)] min-[360px]:text-[9px] md:text-[15px] md:tracking-[.34em]'
      }
    >
      {MERCURE_SUBTITLE}
    </span>
  );
}

function TypographicFallback({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={
          compact
            ? 'font-serif text-[3.8rem] leading-[.68] font-normal tracking-[-0.18em] italic md:text-[5rem] min-[1280px]:text-[5.35rem]'
            : 'font-serif text-[clamp(4.8rem,21vw,7rem)] leading-[.68] font-normal tracking-[-0.18em] italic md:text-[9rem]'
        }
      >
        M
      </span>
      <span
        className={
          compact
            ? 'mt-3 text-[1.45rem] leading-none font-medium tracking-[.22em] md:mt-4 md:text-[2rem] min-[1280px]:text-[2.14rem]'
            : 'mt-4 text-[clamp(1.7rem,8vw,2.4rem)] leading-none font-medium tracking-[.24em] md:mt-6 md:text-[3.4rem] md:tracking-[.28em]'
        }
      >
        MERCURE
      </span>
      <span className={compact ? 'mt-1.5 md:mt-2' : 'mt-2 md:mt-3'}>
        <UnitSubtitle compact={compact} />
      </span>
    </>
  );
}

export function MercureBrandSignature({
  logoUrl,
  compact = false,
}: {
  logoUrl?: string | null;
  compact?: boolean;
}) {
  const [configuredLogoFailed, setConfiguredLogoFailed] = useState(false);
  const [officialLogoFailed, setOfficialLogoFailed] = useState(false);

  if (logoUrl && !configuredLogoFailed) {
    return (
      <div
        role="img"
        aria-label={`Mercure ${MERCURE_SUBTITLE}`}
        className={
          compact
            ? 'flex flex-col items-center overflow-visible'
            : 'flex -translate-x-2 -translate-y-1 flex-col items-center overflow-visible md:translate-x-0 md:translate-y-0'
        }
      >
        <div
          className={
            compact
              ? 'relative h-[58px] w-[min(46vw,180px)] overflow-visible md:h-[76px] md:w-[230px] min-[1280px]:h-[81px] min-[1280px]:w-[246px]'
              : 'relative h-[91px] w-[min(65vw,279px)] overflow-visible md:h-[140px] md:w-[426px]'
          }
        >
          <Image
            src={logoUrl}
            alt=""
            fill
            unoptimized
            className="object-contain"
            sizes={
              compact
                ? '(min-width: 1280px) 246px, (min-width: 768px) 230px, 46vw'
                : '(min-width: 768px) 426px, 65vw'
            }
            priority
            onError={() => setConfiguredLogoFailed(true)}
          />
        </div>
        <UnitSubtitle compact={compact} />
      </div>
    );
  }

  if (!officialLogoFailed) {
    return (
      <div
        role="img"
        aria-label={`Mercure Hotels ${MERCURE_SUBTITLE}`}
        className={
          compact
            ? 'relative flex flex-col items-center overflow-visible text-[var(--mercure-plum)]'
            : 'relative flex -translate-x-2 -translate-y-1 flex-col items-center overflow-visible text-[var(--mercure-plum)] md:translate-x-0 md:translate-y-0'
        }
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
          className={`mercure-official-monogram block shrink-0 ${
            compact
              ? 'h-[64px] w-[64px] md:h-[82px] md:w-[82px] min-[1280px]:h-[88px] min-[1280px]:w-[88px]'
              : 'h-[99px] w-[99px] md:h-[151px] md:w-[151px]'
          }`}
          aria-hidden="true"
        />
        <span
          className={`mercure-official-wordmark block aspect-[7/4] shrink-0 ${
            compact
              ? '-mt-[1.9rem] w-[116px] md:-mt-[2.45rem] md:w-[150px] min-[1280px]:-mt-[2.62rem] min-[1280px]:w-[161px]'
              : '-mt-12 w-[180px] md:-mt-[4.5rem] md:w-[283px]'
          }`}
          aria-hidden="true"
        />
        <span
          className={compact ? '-mt-[1.2rem] md:-mt-[1.55rem] min-[1280px]:-mt-[1.66rem]' : '-mt-[1.875rem] md:-mt-[2.375rem]'}
        >
          <UnitSubtitle compact={compact} />
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Mercure ${MERCURE_SUBTITLE}`}
      className={
        compact
          ? 'flex flex-col items-center text-[var(--mercure-plum)]'
          : 'flex -translate-x-2 -translate-y-1 flex-col items-center text-[var(--mercure-plum)] md:translate-x-0 md:translate-y-0'
      }
    >
      <TypographicFallback compact={compact} />
    </div>
  );
}
