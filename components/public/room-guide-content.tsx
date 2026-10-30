"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { guideText, type RoomGuide } from "@/lib/room-guides";
export function RoomGuideContent({
  guide,
  language,
  helpHref,
}: {
  guide: RoomGuide;
  language: "pt" | "en" | "es";
  helpHref: string;
}) {
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
        c.kind === "linear" &&
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
    <section className="room-guide" data-room-guide>
      {guide.applicability.scope === "categories" ? (
        <p className="room-guide-scope">
          {copy.scope}: {guideText(guide.applicability.label, language)} ·{" "}
          {guide.applicability.categories.join(", ")}
        </p>
      ) : null}
      <h2>{copy.how}</h2>
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
        <article className="room-guide-step">
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
      {guide.channels.some((c) => c.kind === "linear") ? (
        <section data-guide-channels>
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
          <ul className="room-guide-channels">
            {channels.map((c) => (
              <li key={c.number}>
                <strong>{c.number}</strong>
                <span>{c.name}</span>
                {c.quality !== "unspecified" ? <span>{c.quality}</span> : null}
                {c.category ? <small>{c.category}</small> : null}
              </li>
            ))}
          </ul>
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
      <footer>
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
