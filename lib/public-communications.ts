import type {
  PublicHotelAnnouncement,
  PublicHotelPromotionalBanner,
} from "./public-hotel-data.ts";
export function communicationEligible(
  row: {
    hotel_id: string;
    is_active: boolean | null;
    starts_at: string | null;
    ends_at: string | null;
  },
  hotelId: string,
  now = Date.now(),
) {
  const start = row.starts_at ? Date.parse(row.starts_at) : null,
    end = row.ends_at ? Date.parse(row.ends_at) : null;
  return (
    row.hotel_id === hotelId &&
    row.is_active === true &&
    (start === null || (Number.isFinite(start) && start <= now)) &&
    (end === null || (Number.isFinite(end) && end >= now))
  );
}
export function publicCommunications(
  hotelId: string,
  announcements: PublicHotelAnnouncement[],
  banners: PublicHotelPromotionalBanner[],
  now = Date.now(),
) {
  const rows = announcements.filter((row) =>
    communicationEligible(row, hotelId, now) && Boolean(row.title?.trim() || row.body?.trim()),
  );
  return {
    // Critical alerts precede maintenance; keep the canonical order within each category.
    alerts: [
      ...rows.filter((row) => row.category === "alerta"),
      ...rows.filter((row) => row.category === "manutencao"),
    ],
    updates: rows.filter((row) => row.category === "informativo"),
    promotions: rows.filter((row) => row.category === "promocao"),
    banners: banners
      .filter((row) => communicationEligible(row, hotelId, now))
      .slice(0, 3),
  };
}
export function communicationCopy(lang: "pt" | "en" | "es") {
  return lang === "en"
    ? {
        important: "Important notices", importantLabel:"Important notice", details:"View details", dismiss:"Dismiss notice",
        otherNotices: (n:number) => n+" more notice"+(n===1?"":"s"), until:"Until", scrollOffers:"Swipe to see more promotions",
        offers: "Promotions and news",
        updates: "Hotel updates",
        all: "All hotel announcements",
        read: "Read announcement",
        alert: "Alert",
        maintenance: "Maintenance",
        information: "Information",
        promotion: "Promotion",
        more: "Learn more",
      }
    : lang === "es"
      ? {
          important: "Avisos importantes", importantLabel:"Aviso importante", details:"Ver detalles", dismiss:"Cerrar aviso",
          otherNotices: (n:number) => n+" aviso"+(n===1?"":"s")+" más", until:"Hasta", scrollOffers:"Deslice para ver más novedades",
          offers: "Promociones y novedades",
          updates: "Novedades del hotel",
          all: "Todos los avisos del hotel",
          read: "Leer aviso",
          alert: "Alerta",
          maintenance: "Mantenimiento",
          information: "Información",
          promotion: "Promoción",
          more: "Más información",
        }
      : {
          important: "Avisos importantes", importantLabel:"Aviso importante", details:"Ver detalhes", dismiss:"Dispensar aviso",
          otherNotices: (n:number) => "Mais "+n+" aviso"+(n===1?"":"s"), until:"Até", scrollOffers:"Deslize para ver mais novidades",
          offers: "Promoções e novidades",
          updates: "Atualizações do hotel",
          all: "Todos os comunicados do hotel",
          read: "Ler comunicado",
          alert: "Alerta",
          maintenance: "Manutenção",
          information: "Informativo",
          promotion: "Promoção",
          more: "Saiba mais",
        };
}
export function publicCommunicationUrl(
  value: string | null,
  purpose: "media" | "link" = "media",
) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return (u.protocol === "https:" ||
      (purpose === "link" && u.protocol === "http:")) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}

/** Home summaries never replace or mutate the complete canonical message. */
export function communicationExcerpt(title:string,body:string|null|undefined,limit=160){const text=body?.replace(/\s+/g," ").trim();if(!text||text===title.trim())return null;const chars=Array.from(text);return chars.length>limit?chars.slice(0,limit-1).join("")+"…":text;}
