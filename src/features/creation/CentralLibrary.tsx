import {captureAccountContext,assertAccountContext} from '../account/sessionScope';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { centralRequest, type CentralCharacter } from "./centralLibrary";
import { makeCharacter, type Character } from "./spiritModel";
import {
  inspectFile,
  listAssets,
  saveAsset,
  type ImportedAsset,
} from "./uploadAssets";
import AssetPreview from "./AssetPreview";
import type { Locale } from "../../locales";
import "./central-library.css";
export default function CentralLibrary({
  locale,
  worldId,
  index,
  onClose,
  onPlace,
}: {
  locale: Locale;
  worldId: string;
  index: number;
  onClose: () => void;
  onPlace: (c: Character) => void;
}) {
  const es = locale === "es",
    [items, setItems] = useState<CentralCharacter[]>([]),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [chosen, setChosen] = useState<CentralCharacter | null>(null),
    [asset, setAsset] = useState<ImportedAsset | null>(null),
    [ready, setReady] = useState(false),
    [scale, setScale] = useState(1);
  const accountScope = useRef(captureAccountContext()).current;
  const box = useRef<HTMLDivElement>(null),
    alive = useRef(true),
    ticket = useRef(0),
    lock = useRef(false),
    close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    alive.current = true;
    const old = document.activeElement as HTMLElement;
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          box.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input",
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === box.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      alive.current = false;
      ticket.current++;
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    centralRequest(
      "/api/public/characters?" +
        new URLSearchParams({ search, page: String(page) }),
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.items);
          setPages(data.totalPages);
          setTotal(data.total);
          setPage(data.page);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, page]);
  async function select(row: CentralCharacter) {
    if (lock.current) return;
    const serial = ++ticket.current;
    setBusy(true);
    setError("");
    setAsset(null);
    setChosen(null);
    setReady(false);
    try {
      const response = await fetch(row.fileUrl, { cache: "no-store" });
      if (!response.ok)
        throw Error(
          es
            ? "El personaje cambió o ya no está disponible. Actualiza la biblioteca."
            : "Character changed or is unavailable. Refresh the library.",
        );
      const file = new File([await response.blob()], `central.${row.format}`);
      const info = await inspectFile(file);
      if (serial !== ticket.current || !alive.current) return;
      const existing = (await listAssets(accountScope)).find(
        (a) => a.centralId === row.id && a.centralVersion === row.version,
      );
      setAsset(
        existing || {
          id: crypto.randomUUID(),
          file,
          filename: `central.${row.format}`,
          name: row.name,
          description: row.description,
          tags: row.tags,
          source: row.source,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          ...info,
          centralId: row.id,
          centralVersion: row.version,
        },
      );
      setChosen(row);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return createPortal(
    <div className="central-backdrop">
      <div
        className="central-picker"
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="central-title"
        tabIndex={-1}
      >
        <button
          className="creation-close"
          aria-label={es ? "Cerrar" : "Close central library"}
          onClick={onClose}
        >
          ×
        </button>
        <p className="creation-kicker">BEYOND / SHARED ORIGINALS</p>
        <h1 id="central-title">
          {es ? "Biblioteca central" : "Central Library"}
        </h1>
        <p>
          {es
            ? "Originales publicados por el administrador. Tu biblioteca personal permanece separada."
            : "Originals published by the administrator. Your personal library remains separate."}
        </p>
        <label>
          {es ? "Buscar personajes" : "Search central characters"}
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {loading && (
          <p role="status">{es ? "Cargando…" : "Loading library…"}</p>
        )}
        {error && <p role="alert">{error}</p>}
        {!loading && (
          <div className="central-grid">
            {items.map((row) => (
              <button
                key={row.id}
                className="central-card"
                aria-pressed={chosen?.id === row.id}
                disabled={busy}
                onClick={() => void select(row)}
              >
                {row.previewUrl ? (
                  <img src={row.previewUrl} alt="" />
                ) : (
                  <span className="central-model-icon" aria-hidden="true">
                    ◇
                  </span>
                )}
                <strong>{row.name}</strong>
                <small>
                  {row.type} · {row.format.toUpperCase()} · v{row.version}
                </small>
              </button>
            ))}
          </div>
        )}
        {!loading && !items.length && (
          <p>
            {es
              ? "No hay personajes centrales disponibles. Tus personajes personales siguen disponibles."
              : "No active central characters yet. Your personal characters remain available."}
          </p>
        )}
        <div className="central-pages">
          <button
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => p - 1)}
          >
            {es ? "Anterior" : "Previous"}
          </button>
          <span>
            {page} / {pages} · {es ? "Total" : "Total"} {total}
          </span>
          <button
            disabled={page >= pages || busy}
            onClick={() => setPage((p) => p + 1)}
          >
            {es ? "Siguiente" : "Next"}
          </button>
        </div>
        {busy && (
          <p role="status">
            {es ? "Validando / guardando…" : "Validating / saving…"}
          </p>
        )}
        {asset && chosen && (
          <section className="central-selection">
            <h2>{chosen.name}</h2>
            <AssetPreview asset={asset} es={es} onReady={setReady} />
            <p>{chosen.description}</p>
            <label>
              {es ? "Escala" : "Placement scale"}
              <input
                type="number"
                step="0.1"
                min="0.4"
                max="2"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </label>
            <p>
              {es
                ? "Se guardará una copia local verificada con ID y versión central. Conserva su aspecto aunque el original se desactive."
                : "A verified local copy retains the central ID and version. Existing placements remain usable if the source is deactivated. New placements use the current published version."}
            </p>
            <button
              className="creation-primary"
              disabled={!ready || busy || scale < 0.4 || scale > 2}
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                try {
                  const latest = await centralRequest(
                    "/api/public/characters/" + chosen.id,
                  );
                  if (latest.item.version !== chosen.version)
                    throw Error(
                      es
                        ? "El personaje cambió. Vuelve a seleccionarlo."
                        : "Character changed. Select the updated character.",
                    );
                  await saveAsset(asset,accountScope);assertAccountContext(accountScope);
                  if (!alive.current) return;
                  const c = {
                    ...makeCharacter(worldId, chosen.type, index),
                    name: chosen.name,
                    description: chosen.description,
                    tags: chosen.tags,
                    sourceUrl: chosen.source,
                    uploadedAssetId: asset.id,
                    uploadedKind: asset.kind,
                    centralCharacterId: chosen.id,
                    centralVersion: chosen.version,
                  };
                  c.appearance.scale = scale;
                  onPlace(c);
                } catch (e) {
                  if (alive.current) setError((e as Error).message);
                } finally {
                  lock.current = false;
                  if (alive.current) setBusy(false);
                }
              }}
            >
              {es ? "Añadir al mundo" : "Add to world"}
            </button>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
