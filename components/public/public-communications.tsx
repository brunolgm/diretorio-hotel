import Image from "next/image";
import { AlertTriangle, Info, Wrench, Tag, ArrowUpRight } from "lucide-react";
import {
  communicationCopy,
  publicCommunications,
  publicCommunicationUrl,
} from "@/lib/public-communications";
import type { PublicHotelPageData } from "@/lib/public-hotel-data";
import type { SupportedPublicLanguage } from "@/lib/public-language";
export function PublicCommunications({
  data,
  language,
  announcementsHref,
  mode,
}: {
  data: PublicHotelPageData;
  language: SupportedPublicLanguage;
  announcementsHref: string;
  mode: "attention" | "offers" | "updates";
}) {
  const enabled = (key: string) =>
      data.layout.some((b) => b.blockKey === key && b.isEnabled),
    model = publicCommunications(
      data.hotel.id,
      enabled("announcements") ? data.announcements : [],
      enabled("banners") ? data.banners : [],
    ),
    copy = communicationCopy(language);
  const detail = (id: string) => announcementsHref + "#announcement-" + id;
  if (mode === "attention")
    return model.alerts.length ? (
      <aside
        className="v4-attention"
        aria-label={copy.important}
        data-v4-alerts
      >
        {model.alerts.map((row) => {
          const maintenance = row.category === "manutencao",
            Icon = maintenance ? Wrench : AlertTriangle;
          return (
            <details key={row.id} data-important-notice data-notice-category={row.category}>
              <summary>
                <Icon aria-hidden />
                <span className="v4-important-category">
                  {maintenance ? copy.maintenance : copy.alert}
                </span>
                <strong>{row.title}</strong>
                <span className="v4-important-read">{copy.read}</span>
              </summary>
              <div className="v4-important-detail">
                {row.body ? <p>{row.body}</p> : null}
                {row.starts_at || row.ends_at ? (
                  <p className="v4-communication-period">
                    {[row.starts_at, row.ends_at]
                      .filter(Boolean)
                      .map((value) =>
                        new Intl.DateTimeFormat(language, {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(new Date(value!)),
                      )
                      .join(" — ")}
                  </p>
                ) : null}
                <a href={detail(row.id)}>
                  {copy.all}
                  <ArrowUpRight aria-hidden />
                </a>
              </div>
            </details>
          );
        })}
      </aside>
    ) : null;
  if (mode === "offers")
    return model.banners.length ? (
      <section
        className="v4-communications"
        aria-label={copy.offers}
        data-v4-offers
      >
        <h2>{copy.offers}</h2>
        <div className="v4-offer-cards">
          {model.banners.map((row) => {
            const image = publicCommunicationUrl(row.image_url),
              cta = publicCommunicationUrl(row.cta_url, "link");
            return (
              <article key={row.id}>
                {image ? (
                  <Image
                    src={image}
                    alt={row.title}
                    width={640}
                    height={320}
                    unoptimized
                    className="v4-offer-image"
                  />
                ) : null}
                <div>
                  <p className="v4-communication-category">
                    <Tag aria-hidden />
                    {copy.promotion}
                  </p>
                  <h3>{row.title}</h3>
                  {row.subtitle ? <p>{row.subtitle}</p> : null}
                  {row.starts_at || row.ends_at ? (
                    <p className="v4-communication-period">
                      {[row.starts_at, row.ends_at]
                        .filter(Boolean)
                        .map((date) =>
                          new Intl.DateTimeFormat(language, {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          }).format(new Date(date!)),
                        )
                        .join(" — ")}
                    </p>
                  ) : null}
                  {cta ? (
                    <a
                      href={cta}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-analytics-event="website_click"
                      data-analytics-label={row.title}
                    >
                      {row.cta_label || copy.more}
                      <ArrowUpRight aria-hidden />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ) : null;
  return model.updates.length ? (
    <section
      className="v4-communications"
      aria-label={copy.updates}
      data-v4-updates
    >
      <h2>{copy.updates}</h2>
      <div className="v4-update-list">
        {model.updates.map((row) => {
          const Icon = row.category === "manutencao" ? Wrench : Info;
          return (
            <article key={row.id}>
              <Icon aria-hidden />
              <div>
                <p className="v4-communication-category">
                  {row.category === "manutencao"
                    ? copy.maintenance
                    : copy.information}
                </p>
                <h3>{row.title}</h3>
                {row.body ? (
                  <p className="v4-communication-summary">{row.body}</p>
                ) : null}
                {row.starts_at || row.ends_at ? (
                  <time dateTime={row.starts_at ?? row.ends_at!}>
                    {new Intl.DateTimeFormat(language, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(row.starts_at ?? row.ends_at!))}
                    {row.starts_at && row.ends_at
                      ? " — " +
                        new Intl.DateTimeFormat(language, {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(new Date(row.ends_at))
                      : ""}
                  </time>
                ) : null}
                <a href={detail(row.id)}>{copy.read}</a>
              </div>
            </article>
          );
        })}
      </div>
      <a href={announcementsHref}>
        {copy.all}
        <ArrowUpRight aria-hidden />
      </a>
    </section>
  ) : null;
}
