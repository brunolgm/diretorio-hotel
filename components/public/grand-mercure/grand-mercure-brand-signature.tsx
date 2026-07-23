import Image from 'next/image';
import brandMandala from '@/docs/references/grand-mercure-brand-mandala.png';

const INSTITUTIONAL_NAME = 'RIO DE JANEIRO COPACABANA';

export function GrandMercureBrandSignature({ logoUrl, compact = false }: { logoUrl?: string | null; compact?: boolean }) {
  if (logoUrl) {
    return (
      <div
        role="img"
        aria-label={`Grand Mercure ${INSTITUTIONAL_NAME}`}
        className={compact ? 'h-20 w-[min(76vw,360px)] bg-contain bg-center bg-no-repeat md:h-24 md:w-[430px]' : 'h-24 w-[min(84vw,430px)] bg-contain bg-center bg-no-repeat md:h-36 md:w-[520px]'}
        style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center text-[#393734]" aria-label={`Grand Mercure ${INSTITUTIONAL_NAME}`}>
      <Image
        src={brandMandala}
        alt=""
        aria-hidden="true"
        className={compact ? '-mt-7 -mb-7 h-[92px] w-[138px] object-contain md:h-[100px] md:w-[150px]' : '-mt-8 -mb-8 h-[108px] w-[162px] object-contain md:h-[124px] md:w-[186px]'}
        priority
      />
      <span className="mt-0.5 text-[clamp(1.35rem,6vw,2.55rem)] font-medium leading-none tracking-[0.24em] md:tracking-[0.3em]">GRAND MERCURE</span>
      <span className={`${compact ? 'mt-2' : 'mt-3'} text-[8px] font-medium tracking-[0.35em] sm:text-[10px] md:text-xs md:tracking-[0.42em]`}>{INSTITUTIONAL_NAME}</span>
    </div>
  );
}
