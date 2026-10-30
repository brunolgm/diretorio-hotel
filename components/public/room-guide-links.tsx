import { BookOpen } from "lucide-react";
import type { PublicHotelPageData } from "@/lib/public-hotel-data";
import type { DomainContext } from "@/lib/domain-context";
import { buildPublicHotelServiceHref } from "@/lib/public-routes";
export function RoomGuideLinks({
  data,
  language,
  domainContext,
  preferSubdomainRoot,
}: {
  data: PublicHotelPageData;
  language: "pt" | "en" | "es";
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
}) {
  const rows = (data.serviceGuides ?? []).filter((g) =>
    data.sections.some(
      (s) => s.id === g.serviceId && s.hotel_id === data.hotel.id && s.enabled,
    ),
  );
  if (
    !rows.length ||
    !data.layout.some((b) => b.blockKey === "services" && b.isEnabled)
  )
    return null;
  const title =
    language === "en"
      ? "Room guides"
      : language === "es"
        ? "Guías de la habitación"
        : "Guias do Quarto";
  return (
    <section className="room-guide-links" aria-label={title}>
      <h2>
        <BookOpen aria-hidden />
        {title}
      </h2>
      <nav>
        {rows.map((g) => {
          const s = data.sections.find(
            (s) =>
              s.id === g.serviceId && s.hotel_id === data.hotel.id && s.enabled,
          );
          return s ? (
            <a
              key={g.serviceId}
              href={buildPublicHotelServiceHref({
                slug: data.hotel.slug,
                serviceId: s.id,
                language,
                domainContext,
                preferSubdomainRoot,
              })}
            >
              {s.title}
            </a>
          ) : null;
        })}
      </nav>
    </section>
  );
}
