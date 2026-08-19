import Image from 'next/image';

const OFFICIAL_MANDALA = '/brand/grand-mercure/mandala1-transparent.png';

export function GrandMercureBrandSignature({ logoUrl, propertyLabel, compact = false }: {
  logoUrl?: string | null;
  propertyLabel: string;
  compact?: boolean;
}) {
  if (logoUrl) {
    return (
      <div
        role="img"
        aria-label={`Grand Mercure ${propertyLabel}`}
        className={compact ? 'h-20 w-[min(76vw,360px)] bg-contain bg-center bg-no-repeat md:h-24 md:w-[430px]' : 'h-24 w-[min(84vw,430px)] bg-contain bg-center bg-no-repeat md:h-36 md:w-[520px]'}
        style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center overflow-visible text-[#393734]" aria-label={`Grand Mercure ${propertyLabel}`}>
      <Image
        src={OFFICIAL_MANDALA}
        alt=""
        aria-hidden="true"
        width={200}
        height={200}
        className={compact ? '-mb-1 block h-auto w-[clamp(72px,19vw,100px)] object-contain' : '-mb-1 block h-auto w-[clamp(88px,23vw,144px)] object-contain'}
        sizes={compact ? '(min-width: 768px) 100px, 19vw' : '(min-width: 768px) 144px, 23vw'}
        priority
      />
      <span className="mt-0.5 text-[clamp(1.35rem,6vw,2.55rem)] font-medium leading-none tracking-[0.24em] md:tracking-[0.3em]">GRAND MERCURE</span>
      <span className={`${compact ? 'mt-2' : 'mt-3'} text-[8px] font-medium tracking-[0.35em] sm:text-[10px] md:text-xs md:tracking-[0.42em]`}>{propertyLabel}</span>
    </div>
  );
}
