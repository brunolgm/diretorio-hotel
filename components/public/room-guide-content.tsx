"use client";
import { useId, useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { guideText, type RoomGuide } from "@/lib/room-guides";
export function RoomGuideContent({
  guide,
  language,
  helpHref,
  draftPreview = false,
}: {
  guide: RoomGuide;
  language: "pt" | "en" | "es";
  helpHref: string;
  draftPreview?: boolean;
}) {
  const guideId = useId();
  const [active, setActive] = useState(0),
    [search, setSearch] = useState(""),
    [quality, setQuality] = useState("all"),
    heading = useRef<HTMLHeadingElement>(null);
  const copy =
    language === "en"
      ? {
          how: "How to use",
          step: "Step",
          of: "of",
          previous: "Previous",
          next: "Next",
          channels: "TV channels",
          find: "Search by name, number or category",
          all: "All formats",
          unspecified: "Format not specified",
          empty: "No matching channels.",
          help: "Need help?",
          contact: "Contact the hotel",
          manual: "Complete manual",
          apps: "Applications",
          scope: "Available in",
        }
      : language === "es"
        ? {
            how: "Cómo usar",
            step: "Paso",
            of: "de",
            previous: "Anterior",
            next: "Siguiente",
            channels: "Canales de TV",
            find: "Buscar por nombre, número o categoría",
            all: "Todos los formatos",
            unspecified: "Formato no especificado",
            empty: "No hay canales coincidentes.",
            help: "¿Necesitas ayuda?",
            contact: "Contactar al hotel",
            manual: "Manual completo",
            apps: "Aplicaciones",
            scope: "Disponible en",
          }
        : {
            how: "Como usar",
            step: "Passo",
            of: "de",
            previous: "Anterior",
            next: "Próximo",
            channels: "Lista de canais",
            find: "Buscar por nome, número ou categoria",
            all: "Todos os formatos",
            unspecified: "Formato não informado",
            empty: "Nenhum canal corresponde à busca.",
            help: "Precisa de ajuda?",
            contact: "Falar com o hotel",
            manual: "Manual completo",
            apps: "Aplicativos",
            scope: "Disponível em",
          };
  const step = guide.steps[active],
    normalize = (s: string) =>
      s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
    channels = guide.channels.filter(
      (c) =>
        (c.kind === "linear" || (draftPreview && c.kind === "review")) &&
        (quality === "all" || c.quality === quality) &&
        normalize([c.number, c.name, c.category ?? ""].join(" ")).includes(
          normalize(search),
        ),
    ),
    apps = guide.channels.filter((c) => c.kind === "application");
  function move(n: number) {
    setActive(n);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <section
      className="room-guide"
      data-room-guide
      data-guide-draft-preview={draftPreview ? "true" : undefined}
    >
      {draftPreview ? (
        <p className="room-guide-draft-notice" role="status">
          {language === "en"
            ? "Private draft preview — not published. Equipment, availability, translations and channels await operational review."
            : language === "es"
              ? "Vista previa privada del borrador — no publicado. Equipos, disponibilidad, traducciones y canales pendientes de revisión operativa."
              : "Prévia privada de rascunho — não publicado. Equipamentos, disponibilidade, traduções e canais aguardam revisão operacional."}
        </p>
      ) : null}
      <nav
        className="room-guide-sections"
        aria-label={
          language === "en"
            ? "Guide sections"
            : language === "es"
              ? "Secciones de la guía"
              : "Seções do guia"
        }
      >
        <a href={"#" + guideId + "-how"}>{copy.how}</a>
        {guide.channels.some(
          (c) => c.kind === "linear" || (draftPreview && c.kind === "review"),
        ) ? (
          <a href={"#" + guideId + "-channels"}>{copy.channels}</a>
        ) : null}
        <a href={"#" + guideId + "-help"}>{copy.help}</a>
        {guide.manual_url ? (
          <a href={guide.manual_url} target="_blank" rel="noopener noreferrer">
            {copy.manual}
          </a>
        ) : null}
      </nav>
      {guide.applicability.scope === "categories" ? (
        <p className="room-guide-scope">
          {copy.scope}: {guideText(guide.applicability.label, language)} ·{" "}
          {guide.applicability.categories.join(", ")}
        </p>
      ) : null}
      <h2 id={guideId + "-how"}>{copy.how}</h2>
      <ol className="room-guide-step-nav">
        {guide.steps.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => move(i)}
              aria-current={active === i ? "step" : undefined}
            >
              {i + 1}. {guideText(s.title, language)}
            </button>
          </li>
        ))}
      </ol>
      {step ? (
        <article
          className="room-guide-step"
          data-has-image={step.image_path ? "true" : undefined}
        >
          <p role="status" aria-live="polite">
            {copy.step} {active + 1} {copy.of} {guide.steps.length}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            {guideText(step.title, language)}
          </h3>
          {step.image_path ? (
            <Image
              src={
                process.env.NEXT_PUBLIC_SUPABASE_URL +
                "/storage/v1/object/public/hotel-assets/" +
                step.image_path
              }
              alt={guideText(step.alt, language)}
              width={360}
              height={480}
              unoptimized
            />
          ) : null}
          <p className="whitespace-pre-line">
            {guideText(step.body, language)}
          </p>
          <nav aria-label={copy.how}>
            <button
              type="button"
              disabled={active === 0}
              onClick={() => move(active - 1)}
            >
              <ChevronLeft aria-hidden />
              {copy.previous}
            </button>
            <button
              type="button"
              disabled={active === guide.steps.length - 1}
              onClick={() => move(active + 1)}
            >
              {copy.next}
              <ChevronRight aria-hidden />
            </button>
          </nav>
        </article>
      ) : null}
      {guide.channels.some(
        (c) => c.kind === "linear" || (draftPreview && c.kind === "review"),
      ) ? (
        <section data-guide-channels id={guideId + "-channels"}>
          <h2>{copy.channels}</h2>
          <div className="room-guide-search">
            <label>
              <Search aria-hidden />
              <span>{copy.find}</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              <span>{copy.all}</span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                <option value="all">{copy.all}</option>
                <option value="HD">HD</option>
                <option value="SD">SD</option>
                <option value="unspecified">{copy.unspecified}</option>
              </select>
            </label>
          </div>
          <div
            className="room-guide-channel-scroll"
            tabIndex={0}
            role="region"
            aria-label={copy.channels}
          >
            <table className="room-guide-channels">
              <caption className="sr-only">{copy.channels}</caption>
              <thead>
                <tr>
                  <th scope="col">Nº</th>
                  <th scope="col">
                    {language === "en"
                      ? "Channel"
                      : language === "es"
                        ? "Canal"
                        : "Canal"}
                  </th>
                  <th scope="col">
                    {language === "en"
                      ? "Format"
                      : language === "es"
                        ? "Formato"
                        : "Formato"}
                  </th>
                  {guide.channels.some((c) => c.category) ? (
                    <th scope="col">
                      {language === "en"
                        ? "Category"
                        : language === "es"
                          ? "Categoría"
                          : "Categoria"}
                    </th>
                  ) : null}
                  {draftPreview ? (
                    <th scope="col">
                      {language === "en"
                        ? "Review"
                        : language === "es"
                          ? "Revisión"
                          : "Revisão"}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.number} data-guide-channel>
                    <th scope="row">{c.number}</th>
                    <td>{c.name}</td>
                    <td>{c.quality === "unspecified" ? "—" : c.quality}</td>
                    {guide.channels.some((c) => c.category) ? (
                      <td>{c.category ?? "—"}</td>
                    ) : null}
                    {draftPreview ? (
                      <td>
                        <span className="room-guide-review-tag">
                          {language === "en"
                            ? "Pending"
                            : language === "es"
                              ? "Pendiente"
                              : "Pendente"}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!channels.length ? <p role="status">{copy.empty}</p> : null}
        </section>
      ) : null}
      {apps.length ? (
        <section>
          <h2>{copy.apps}</h2>
          <ul>
            {apps.map((c) => (
              <li key={c.number}>{c.name}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <footer id={guideId + "-help"}>
        <h2>{copy.help}</h2>
        <a href={helpHref}>{copy.contact}</a>
        {guide.manual_url ? (
          <a href={guide.manual_url} target="_blank" rel="noopener noreferrer">
            <BookOpen aria-hidden />
            {copy.manual}
          </a>
        ) : null}
      </footer>
    </section>
  );
}
