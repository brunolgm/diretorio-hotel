"use client";
import { useState } from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import {
  emptyRoomGuide,
  previewGuideChannels,
  type RoomGuide,
  type GuideText,
} from "@/lib/room-guides";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        className="min-h-11 rounded-xl bg-slate-900 px-4 text-white"
        disabled={pending}
        name="publish"
        value="false"
      >
        {pending ? "Salvando…" : "Salvar rascunho"}
      </button>
      <button
        className="min-h-11 rounded-xl border px-4"
        disabled={pending}
        name="publish"
        value="true"
      >
        Publicar após revisão
      </button>
    </div>
  );
}
export function ServiceGuideEditor({
  initial,
  revision,
  serviceId,
  action,
  published = false,
}: {
  published?: boolean;
  initial: RoomGuide | null;
  revision: number;
  serviceId: string;
  action: (form: FormData) => Promise<void>;
}) {
  const [guide, setGuide] = useState(initial ?? emptyRoomGuide()),
    [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<ReturnType<
      typeof previewGuideChannels
    > | null>(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  function stepField(
    index: number,
    field: "title" | "body" | "alt",
    lang: keyof GuideText,
    value: string,
  ) {
    setGuide({
      ...guide,
      steps: guide.steps.map((s, i) =>
        i === index ? { ...s, [field]: { ...s[field], [lang]: value } } : s,
      ),
    });
  }
  const channels = guide.channels
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        (c.number + " " + c.name).toLowerCase().includes(search.toLowerCase()),
      ),
    visible = channels.slice(page * 20, page * 20 + 20);
  return (
    <details className="rounded-2xl border bg-white p-5" data-guide-editor>
      <summary className="min-h-11 cursor-pointer font-semibold">
        Guias do Quarto — tutorial e canais · revisão {revision}
      </summary>
      <p className="my-3 text-sm text-slate-600">
        Extensão deste serviço. Rascunhos não são públicos. Antes de publicar,
        habilite o serviço nativo, confirme os equipamentos/aplicabilidade,
        revise PT/EN/ES e a grade atual. Sem tradução automática de instruções
        técnicas.
      </p>
      <p className="mb-3 text-sm font-medium" data-guide-publication-status>
        {published
          ? "Rascunho em edição — a versão pública é preservada ao salvar."
          : revision === 0
            ? "Guia opcional ainda não preparado."
            : "Rascunho — nenhuma versão publicada."}
      </p>
      <form action={action} className="space-y-5">
        <input type="hidden" name="service_id" value={serviceId} />
        <input type="hidden" name="expected_revision" value={revision} />
        <input
          type="hidden"
          name="configuration"
          value={JSON.stringify(guide)}
        />
        <label className="block">
          Categoria
          <select
            className="block min-h-11 rounded border p-2"
            value={guide.category}
            onChange={(e) =>
              setGuide({
                ...guide,
                category: e.target.value as RoomGuide["category"],
              })
            }
          >
            {[
              ["tv", "TV e Canais"],
              ["shower", "Chuveiro"],
              ["air_conditioning", "Ar-condicionado"],
              ["voice_assistant", "Assistente de voz"],
              ["other", "Outro"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-3 rounded-xl border p-3">
          <legend>Aplicabilidade confirmada</legend>
          <select
            aria-label="Escopo do equipamento"
            value={guide.applicability.scope}
            onChange={(e) =>
              setGuide({
                ...guide,
                applicability: {
                  ...guide.applicability,
                  scope: e.target.value as RoomGuide["applicability"]["scope"],
                },
              })
            }
            className="min-h-11 rounded border p-2"
          >
            <option value="unconfirmed">
              Não confirmada — impede publicação
            </option>
            <option value="all">
              Todos os quartos — confirmar com o hotel
            </option>
            <option value="categories">
              Categorias de acomodação confirmadas
            </option>
          </select>
          <label className="block">
            Categorias (separadas por vírgula)
            <input
              className="block min-h-11 w-full rounded border p-2"
              defaultValue={guide.applicability.categories.join(", ")}
              onChange={(e) =>
                setGuide({
                  ...guide,
                  applicability: {
                    ...guide.applicability,
                    categories: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </label>
          {(["pt", "en", "es"] as const).map((lang) => (
            <label className="block" key={lang}>
              Aviso de disponibilidade {lang.toUpperCase()}
              <input
                className="block min-h-11 w-full rounded border p-2"
                value={guide.applicability.label[lang]}
                onChange={(e) =>
                  setGuide({
                    ...guide,
                    applicability: {
                      ...guide.applicability,
                      label: {
                        ...guide.applicability.label,
                        [lang]: e.target.value,
                      },
                    },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border p-3">
          <legend>Passos revisados</legend>
          {guide.steps.map((step, i) => (
            <div key={step.key} className="space-y-2 rounded-xl border p-3">
              <h3>Passo {i + 1}</h3>
              <div className="flex flex-wrap gap-2">
                {([-1, 1] as const).map((direction) => (
                  <button
                    type="button"
                    key={direction}
                    className="min-h-11 rounded border p-2"
                    disabled={
                      i + direction < 0 || i + direction >= guide.steps.length
                    }
                    onClick={() => {
                      const steps = [...guide.steps];
                      [steps[i], steps[i + direction]] = [
                        steps[i + direction],
                        steps[i],
                      ];
                      setGuide({ ...guide, steps });
                    }}
                  >
                    {direction === -1 ? "Subir passo" : "Descer passo"}
                  </button>
                ))}
              </div>
              {step.image_path ? (
                <Image
                  src={
                    process.env.NEXT_PUBLIC_SUPABASE_URL +
                    "/storage/v1/object/public/hotel-assets/" +
                    step.image_path
                  }
                  alt={step.alt.pt || "Foto do equipamento — rascunho"}
                  width={240}
                  height={360}
                  unoptimized
                  className="max-h-64 w-auto max-w-full object-contain"
                />
              ) : null}
              {(["pt", "en", "es"] as const).map((lang) => (
                <div key={lang}>
                  <label>
                    Título {lang.toUpperCase()}
                    <input
                      className="block min-h-11 w-full rounded border p-2"
                      value={step.title[lang]}
                      onChange={(e) =>
                        stepField(i, "title", lang, e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Instruções {lang.toUpperCase()}
                    <textarea
                      className="block min-h-24 w-full rounded border p-2"
                      value={step.body[lang]}
                      onChange={(e) =>
                        stepField(i, "body", lang, e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Texto alternativo da foto {lang.toUpperCase()}
                    <input
                      className="block min-h-11 w-full rounded border p-2"
                      value={step.alt[lang]}
                      onChange={(e) =>
                        stepField(i, "alt", lang, e.target.value)
                      }
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="min-h-11 rounded border p-2"
                onClick={() =>
                  setGuide({
                    ...guide,
                    steps: guide.steps.filter((_, n) => i !== n),
                  })
                }
              >
                Remover passo
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={guide.steps.length >= 20}
            className="min-h-11 rounded border p-2"
            onClick={() =>
              setGuide({
                ...guide,
                steps: [
                  ...guide.steps,
                  {
                    key: "step-" + crypto.randomUUID(),
                    title: { pt: "", en: "", es: "" },
                    body: { pt: "", en: "", es: "" },
                    alt: { pt: "", en: "", es: "" },
                    image_path: null,
                  },
                ],
              })
            }
          >
            Adicionar passo
          </button>
        </fieldset>
        <fieldset className="space-y-2 rounded-xl border p-3">
          <legend>Imagem pública aprovada (uma por envio)</legend>
          <p className="text-sm">
            JPEG/PNG/WebP até 2 MB, assinatura/MIME e dimensões validados no
            servidor. PDF não é aceito neste upload.
          </p>
          <select
            name="step_key"
            aria-label="Passo da imagem"
            className="min-h-11 rounded border p-2"
          >
            <option value="">Escolha um passo</option>
            {guide.steps.map((s, i) => (
              <option key={s.key} value={s.key}>
                Passo {i + 1}
              </option>
            ))}
          </select>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Imagem do equipamento"
          />
        </fieldset>
        <fieldset className="space-y-3 rounded-xl border p-3">
          <legend>Importação de canais — prévia antes de aplicar</legend>
          <label className="block">
            CSV: number;name;quality;category;kind
            <textarea
              className="block min-h-28 w-full rounded border p-2"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <button
            type="button"
            className="min-h-11 rounded border p-2"
            onClick={() => setPreview(previewGuideChannels(csv))}
          >
            Validar e pré-visualizar
          </button>
          {preview ? (
            <div role="status">
              <p>
                {preview.rows.length} registros válidos ·{" "}
                {preview.errors.length} erros
              </p>
              {preview.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
              <table className="w-full text-sm">
                <caption>Primeiros 20 registros da prévia</caption>
                <tbody>
                  {preview.rows.slice(0, 20).map((c) => (
                    <tr key={c.number}>
                      <td>{c.number}</td>
                      <td>{c.name}</td>
                      <td>{c.quality}</td>
                      <td>{c.kind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                disabled={!!preview.errors.length}
                className="min-h-11 rounded border p-2"
                onClick={() => {
                  setGuide({ ...guide, channels: preview.rows });
                  setPreview(null);
                  setPage(0);
                }}
              >
                Aplicar ao rascunho
              </button>
            </div>
          ) : null}
          <p>
            {guide.channels.length} registros no rascunho. Tipo review impede
            publicação; Netflix não pode ser canal linear.
          </p>
          <input
            aria-label="Pesquisar canais no Admin"
            className="min-h-11 rounded border p-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          {visible.map(({ c, i }) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded border p-2"
            >
              {(["number", "name", "category"] as const).map((field) => (
                <label key={field}>
                  {field === "number"
                    ? "Número"
                    : field === "name"
                      ? "Nome"
                      : "Categoria"}
                  <input
                    aria-label={
                      (field === "number"
                        ? "Número"
                        : field === "name"
                          ? "Nome"
                          : "Categoria") +
                      " do registro " +
                      (i + 1)
                    }
                    className={
                      "min-h-11 rounded border p-2 " +
                      (field === "number" ? "w-20" : "max-w-full")
                    }
                    inputMode={field === "number" ? "numeric" : undefined}
                    maxLength={
                      field === "number" ? 4 : field === "name" ? 160 : 100
                    }
                    value={c[field] ?? ""}
                    onChange={(e) =>
                      setGuide({
                        ...guide,
                        channels: guide.channels.map((x, n) =>
                          n === i
                            ? {
                                ...x,
                                [field]:
                                  field === "category"
                                    ? e.target.value || null
                                    : e.target.value,
                              }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Formato
                <select
                  aria-label={"Formato do registro " + (i + 1)}
                  className="min-h-11 rounded border p-2"
                  value={c.quality}
                  onChange={(e) =>
                    setGuide({
                      ...guide,
                      channels: guide.channels.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              quality: e.target.value as typeof x.quality,
                            }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="unspecified">Não informado</option>
                  <option value="HD">HD</option>
                  <option value="SD">SD</option>
                </select>
              </label>
              <select
                aria-label={"Tipo do registro " + c.number}
                value={c.kind}
                className="min-h-11 rounded border p-2"
                onChange={(e) =>
                  setGuide({
                    ...guide,
                    channels: guide.channels.map((x, n) =>
                      n === i
                        ? { ...x, kind: e.target.value as typeof x.kind }
                        : x,
                    ),
                  })
                }
              >
                <option value="review">Revisão pendente</option>
                <option value="linear">Canal linear confirmado</option>
                <option value="application">Aplicativo confirmado</option>
              </select>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="min-h-11 rounded border p-2"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Página anterior
            </button>
            <button
              type="button"
              className="min-h-11 rounded border p-2"
              disabled={(page + 1) * 20 >= channels.length}
              onClick={() => setPage(page + 1)}
            >
              Próxima página
            </button>
          </div>
        </fieldset>
        <label className="block">
          Manual complementar — URL HTTPS aprovada (opcional)
          <input
            type="url"
            className="block min-h-11 w-full rounded border p-2"
            value={guide.manual_url ?? ""}
            onChange={(e) =>
              setGuide({ ...guide, manual_url: e.target.value || null })
            }
          />
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="review_confirmed" />
          Conferi equipamentos, aplicabilidade, PT/EN/ES e a grade atual.
          Autorizo a publicação desta versão.
        </label>
        <Submit />
      </form>
    </details>
  );
}
