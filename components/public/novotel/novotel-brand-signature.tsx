export function NovotelBrandSignature({
  logoUrl,
  subtitle,
}: {
  logoUrl: string | null | undefined;
  subtitle: string;
}) {
  if (logoUrl) {
    return (
      <div
        role="img"
        aria-label={`Novotel ${subtitle}`}
        className="h-28 w-[min(78vw,320px)] bg-contain bg-center bg-no-repeat sm:h-32 sm:w-[360px] md:h-40 md:w-[440px]"
        style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center text-white" aria-label={`Novotel ${subtitle}`}>
      <svg className="h-5 w-24 md:h-7 md:w-32" viewBox="0 0 128 28" fill="none" aria-hidden="true">
        <path d="M4 24C43 25 82 16 124 3C97 24 59 31 4 24Z" fill="currentColor" />
      </svg>
      <span className="mt-0.5 text-3xl font-medium leading-none tracking-[0.06em] md:text-5xl" aria-hidden="true">N</span>
      <span className="mt-2 text-3xl font-semibold leading-none tracking-[0.22em] sm:text-4xl md:mt-3 md:text-5xl" aria-hidden="true">NOVOTEL</span>
      <span className="mt-2 max-w-[300px] text-center text-[10px] font-light uppercase leading-4 tracking-[0.28em] text-white/78 sm:max-w-none sm:text-xs md:mt-3 md:text-sm md:tracking-[0.32em]" aria-hidden="true">
        {subtitle}
      </span>
    </div>
  );
}
