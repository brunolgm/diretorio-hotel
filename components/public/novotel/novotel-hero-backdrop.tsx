export function NovotelHeroBackdrop({
  imageUrl,
  imageAlt,
}: {
  imageUrl: string | null | undefined;
  imageAlt: string;
}) {
  return (
    <>
      {imageUrl ? (
        <div
          role="img"
          aria-label={imageAlt}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--hotel-hero-overlay)]" />
    </>
  );
}
