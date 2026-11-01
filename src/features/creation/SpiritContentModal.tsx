import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../locales";
import { safeURL, type Character, type Content } from "./spiritModel";
export default function SpiritContentModal({
  locale,
  character,
  characters,
  initial,
  onClose,
  onSave,
}: {
  locale: Locale;
  character: Character;
  characters: Character[];
  initial?: Content;
  onClose: () => void;
  onSave: (content: Content) => void;
}) {
  const es = locale === "es",
    [type, setType] = useState<Content["type"]>(
      initial?.type || (character.type === "collector" ? "url" : "note"),
    ),
    [title, setTitle] = useState(initial?.title || ""),
    [body, setBody] = useState(initial?.body || ""),
    [url, setURL] = useState(initial?.url || ""),
    [source, setSource] = useState(initial?.sourceUrl || ""),
    [reference, setReference] = useState(initial?.referenceId || ""),
    [error, setError] = useState(""),
    ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    ref.current?.querySelector("input")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,textarea,select",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      requestAnimationFrame(() => old?.isConnected && old.focus());
    };
  }, []);
  const names = es
    ? [
        "Sitio web",
        "Nota",
        "Historia",
        "Idea",
        "URL de imagen",
        "Referencia a espíritu",
      ]
    : ["Website", "Note", "Story", "Idea", "Image URL", "Spirit reference"];
  return createPortal(
    <div className="creation-shade">
      <div
        className="creation-modal spirit-content-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-title"
      >
        <button
          className="creation-close"
          onClick={onClose}
          aria-label={es ? "Cerrar" : "Close"}
        >
          ×
        </button>
        <p className="creation-kicker">{character.name}</p>
        <h1 id="content-title">
          {es ? "Un nuevo propósito" : "Give this spirit a purpose"}
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setError(es ? "Escribe un título." : "Enter a title.");
              return;
            }
            if (
              (["url", "image"].includes(type) && !safeURL(url)) ||
              (url && !safeURL(url)) ||
              (source && !safeURL(source))
            ) {
              setError(
                es
                  ? "Usa una URL válida http o https sin credenciales."
                  : "Use a valid http or https URL without credentials.",
              );
              return;
            }
            if (
              type === "reference" &&
              (!reference || !characters.some((c) => c.id === reference))
            ) {
              setError(
                es
                  ? "Elige un espíritu existente."
                  : "Choose an existing spirit.",
              );
              return;
            }
            const now = new Date().toISOString();
            onSave({
              id: initial?.id || crypto.randomUUID(),
              worldId: character.worldId,
              characterId: character.id,
              type,
              title: title.trim(),
              body,
              url: ["url", "image"].includes(type) ? url : "",
              sourceUrl: source,
              referenceId: type === "reference" ? reference : undefined,
              createdAt: initial?.createdAt || now,
              updatedAt: now,
            });
          }}
          noValidate
        >
          <label htmlFor="spirit-content-title">
            {es ? "Título" : "Title"}
          </label>
          <input
            id="spirit-content-title"
            value={title}
            maxLength={150}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label>
            {es ? "Tipo de contenido" : "Content type"}
            <select
              aria-label={es ? "Tipo de contenido" : "Content type"}
              value={type}
              onChange={(e) => setType(e.target.value as Content["type"])}
            >
              {(
                ["url", "note", "story", "idea", "image", "reference"] as const
              ).map((t, i) => (
                <option key={t} value={t}>
                  {names[i]}
                </option>
              ))}
            </select>
          </label>
          {["url", "image"].includes(type) && (
            <>
              <label htmlFor="spirit-content-url">URL</label>
              <input
                id="spirit-content-url"
                value={url}
                maxLength={2048}
                onChange={(e) => setURL(e.target.value)}
                placeholder="https://"
              />
            </>
          )}
          {type === "reference" && (
            <label>
              {es ? "Espíritu de referencia" : "Referenced spirit"}
              <select
                aria-label={es ? "Espíritu de referencia" : "Referenced spirit"}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              >
                <option value="">{es ? "Elegir…" : "Choose…"}</option>
                {characters
                  .filter((c) => c.id !== character.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label htmlFor="spirit-content-body">
            {es ? "Texto / descripción" : "Text / description"}
          </label>
          <textarea
            id="spirit-content-body"
            value={body}
            maxLength={12000}
            onChange={(e) => setBody(e.target.value)}
          />
          <label htmlFor="spirit-content-source">
            {es ? "URL de la fuente (opcional)" : "Source URL (optional)"}
          </label>
          <input
            id="spirit-content-source"
            value={source}
            maxLength={2048}
            onChange={(e) => setSource(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <div className="creation-actions">
            <button type="button" onClick={onClose}>
              {es ? "Cancelar" : "Cancel"}
            </button>
            <button type="submit" className="creation-primary">
              {es ? "Guardar contenido" : "Save content"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
