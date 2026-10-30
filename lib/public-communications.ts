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
    communicationEligible(row, hotelId, now),
  );
  return {
    alerts: rows.filter((row) => row.category === "alerta"),
    updates: rows.filter(
      (row) => row.category !== "alerta" && row.category !== "promocao",
    ),
    promotions: rows.filter((row) => row.category === "promocao"),
    banners: banners
      .filter((row) => communicationEligible(row, hotelId, now))
      .slice(0, 3),
  };
}
export function communicationCopy(lang: "pt" | "en" | "es") {
  return lang === "en"
    ? {
        offers: "Highlights and offers",
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
          offers: "Destacados y ofertas",
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
          offers: "Destaques e ofertas",
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
export function publicCommunicationUrl(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
