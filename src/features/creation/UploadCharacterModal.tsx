import {captureAccountContext,assertAccountContext} from '../account/sessionScope';
import { requireAuthor } from "./authorAccess";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../locales";
import { loadWorlds } from "./worldStore";
import {
  characterNames,
  characterTypes,
  makeCharacter,
  safeURL,
  type Character,
  type Content,
} from "./spiritModel";
import {
  inspectFile,
  listAssets,
  saveAsset,
  removeAsset,
  type ImportedAsset,
} from "./uploadAssets";
import { characterWorld } from "./worldBackup";
import BackupImport, { ExportAsset } from "./BackupControls";
import AssetPreview from "./AssetPreview";
import "./upload-character.css";
export default function UploadCharacterModal({
  locale,
  worldId,
  worldName,
  index,
  currentCharacters,
  onClose,
  onPlace,
}: {
  locale: Locale;
  worldId: string;
  worldName: string;
  index: number;
  currentCharacters: Character[];
  onClose: () => void;
  onPlace: (character: Character, contents?: Content[]) => void;
}) {
  const [initialPosition] = useState(
    () => makeCharacter(worldId, "custom", index).position,
  );
  const es = locale === "es",
    [items, setItems] = useState<ImportedAsset[]>([]),
    [asset, setAsset] = useState<ImportedAsset | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [tags, setTags] = useState(""),
    [source, setSource] = useState(""),
    [type, setType] = useState<Character["type"]>("custom"),
    [scale, setScale] = useState(1),
    [x, setX] = useState(Math.round(initialPosition.x * 10) / 10),
    [y, setY] = useState(Math.round(initialPosition.y * 10) / 10),
    [target, setTarget] = useState(worldId),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose),
    input = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    ticket = useRef(0);
  close.current = onClose;
  const message = (code: string) =>
    ({
      admin_author_required: es
        ? "Inicia sesión como administrador para importar personajes."
        : "Sign in as an administrator to import characters.",
      unsupported_file: es
        ? "Formato no compatible. Usa PNG, WebP, JPEG, GLB o glTF integrado."
        : "Unsupported format. Use PNG, WebP, JPEG, GLB or embedded glTF.",
      external_resources: es
        ? "El glTF contiene archivos externos. Exporta GLB o integra todas las dependencias."
        : "glTF contains external resources. Export GLB or embed all dependencies.",
      unsupported_compression: es
        ? "Exporta un GLB sin Draco, Meshopt, KTX o DDS."
        : "Export an uncompressed GLB without Draco, Meshopt, KTX or DDS.",
      model_too_complex: es
        ? "Modelo demasiado complejo: máximo 150.000 vértices, 100.000 triángulos, 250 nodos y 12 texturas."
        : "Model too complex: maximum 150,000 vertices, 100,000 triangles, 250 nodes and 12 textures.",
      file_too_large: es
        ? "Archivo vacío o demasiado grande: imágenes 8 MB, modelos 16 MB."
        : "Empty file or file too large: images 8 MB, models 16 MB.",
      invalid_image: es
        ? "La imagen está dañada o no coincide con el formato."
        : "Image is damaged or does not match its format.",
    })[code] ||
    (es
      ? "No se pudo procesar o guardar el archivo."
      : "Could not process or save this file.");
  const accountScope = useRef(captureAccountContext()).current;
  async function refresh() {
    try {
      const list = (await listAssets(accountScope)).filter((a) => !a.centralId && a.purpose!=="starter-world");
      if (alive.current) setItems(list);
    } catch {
      if (alive.current) setError(message("storage_unavailable"));
    }
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      ticket.current++;
    };
  }, []);
  useLayoutEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (!dialog.current?.contains(e.target as Node)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const list = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,select",
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
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
  function select(a: ImportedAsset) {
    if (a.template?.graph?.characters[0]) {
      setType(a.template.graph.characters[0].type);
      setScale(a.template.graph.characters[0].appearance.scale);
    }
    ticket.current++;
    setAsset(a);
    setName(a.name);
    setDescription(a.description);
    setSource(a.source);
    setTags(a.tags);
    setReady(false);
    setError("");
    setNotice("");
  }
  async function receive(file?: File) {
    if (!file || busy) return;
    const current = ++ticket.current;
    setBusy(true);
    setAsset(null);
    setReady(false);
    setError("");
    setNotice("");
    try {
      await requireAuthor();
      const info = await inspectFile(file);
      if (!alive.current || current !== ticket.current) return;
      const now = new Date().toISOString(),
        a: ImportedAsset = {
          id: crypto.randomUUID(),
          ...info,
          file,
          filename: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(-100),
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
          description: "",
          tags: "",
          source: "",
          createdAt: now,
          updatedAt: now,
        };
      select(a);
    } catch (e) {
      if (alive.current) setError(message((e as Error).message));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function persist(place: boolean) {
    if (!asset || !ready || busy) return;
    if (!name.trim()) {
      setError(es ? "Escribe un nombre." : "Enter a character name.");
      return;
    }
    if (source && !safeURL(source)) {
      setError(
        es
          ? "Usa una fuente http o https válida."
          : "Use a valid http or https source.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = {
        ...asset,
        name: name.trim(),
        description,
        tags,
        source,
        updatedAt: new Date().toISOString(),
      };
      const base =
        saved.template?.graph?.characters[0] ||
        makeCharacter(worldId, type, index);
      saved.template = characterWorld(
        saved,
        {
          ...base,
          type,
          name: saved.name,
          description,
          tags,
          sourceUrl: source,
          uploadedAssetId: saved.id,
          uploadedKind: saved.kind,
          appearance: { ...base.appearance, scale },
        },
        saved.template,
      );
      await requireAuthor();
      await saveAsset(saved,accountScope);assertAccountContext(accountScope);
      setAsset(saved);
      await refresh();
      setNotice(
        es
          ? "Archivo guardado en este navegador."
          : "File saved in this browser.",
      );
      if (place) {
        const c: Character = {
          ...makeCharacter(worldId, type, index),
          name: name.trim(),
          description,
          creatorId: "local-browser",
          visibility: "local",
          uploadedAssetId: saved.id,
          uploadedKind: saved.kind,
          tags,
          sourceUrl: source,
          position: { x, y, z: 0 },
        };
        c.appearance.scale = scale;
        const template = saved.template?.graph;
        const original = template?.characters[0];
        let contents: Content[] = [];
        if (original) {
          c.type = type;
          const preserved = {
            ...original,
            ...c,
            appearance: { ...original.appearance, scale },
            position: c.position,
          };
          contents = (template?.contents || []).map((d) => ({
            ...d,
            id: crypto.randomUUID(),
            worldId,
            characterId: c.id,
            ...(d.referenceId ? { referenceId: c.id } : {}),
          }));
          preserved.contentIds = contents.map((d) => d.id);
          onPlace(preserved, contents);
        } else onPlace(c, contents);
      }
    } catch (e) {
      setError(message((e as Error).message));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function deletion(a: ImportedAsset) {
    const worlds = loadWorlds();
    if (worlds.error) {
      setError(
        es
          ? "No se pueden comprobar las referencias. No se eliminó el archivo."
          : "Could not verify references. File was not deleted.",
      );
      return;
    }
    const references = worlds.worlds.filter((w) =>
      w.graph?.characters.some((c) => c.uploadedAssetId === a.id),
    );
    if (
      references.length ||
      currentCharacters.some((c) => c.uploadedAssetId === a.id)
    ) {
      setError(
        es
          ? "Este archivo está en uso. Quita las instancias de todos los mundos y guarda antes de eliminarlo."
          : "This file is in use. Remove instances from all worlds and save before deleting it.",
      );
      return;
    }
    try {
      await removeAsset(a.id,accountScope);
      if (asset?.id === a.id) setAsset(null);
      await refresh();
    } catch {
      setError(message("storage_failed"));
    }
  }
  return createPortal(
    <div className="creation-shade">
      <div
        className="creation-modal upload-character-modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        tabIndex={-1}
      >
        <button
          className="creation-close"
          aria-label={es ? "Cerrar" : "Close"}
          onClick={onClose}
        >
          ×
        </button>
        <p className="creation-kicker">BEYOND / IMPORT</p>
        <h1 id="upload-title">
          {es ? "Trae tu personaje" : "Bring your character"}
        </h1>
        <p>
          {es
            ? "Creado fuera. Explorando aquí. Solo en este navegador, sin API de pago."
            : "Created elsewhere. Explored here. This browser only, with no paid API."}
        </p>
        <input
          ref={input}
          type="file"
          accept=".png,.webp,.jpg,.jpeg,.glb,.gltf"
          aria-label={es ? "Archivo de personaje" : "Character file"}
          onChange={(e) => void receive(e.target.files?.[0])}
        />
        <div
          className="upload-drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void receive(e.dataTransfer.files[0]);
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {es ? "Seleccionar o soltar archivo" : "Choose or drop a file"}
          </button>
          <p>PNG · WebP · JPEG ≤ 8 MB / GLB · glTF ≤ 16 MB</p>
          <small>
            {es
              ? "glTF solo con recursos integrados. GLB recomendado."
              : "Embedded-resource glTF only. GLB recommended."}
          </small>
        </div>
        {busy && (
          <p role="status">
            {es ? "Validando / guardando…" : "Validating / saving…"}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {asset && (
          <>
            <AssetPreview asset={asset} es={es} onReady={setReady} />
            <p>
              {asset.kind === "model"
                ? es
                  ? "Modelo 3D · Arrastra para girar, rueda o pellizca para zoom."
                  : "3D model · Drag to rotate, wheel or pinch to zoom."
                : es
                  ? "Imagen 2.5D · Transparencia original conservada."
                  : "2.5D image · Original transparency retained."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void persist(target === worldId);
              }}
            >
              <label>
                {es ? "Nombre del personaje" : "Character name"}
                <input
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {es ? "Descripción" : "Description"}
                <textarea
                  aria-label={es ? "Descripción" : "Description"}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label>
                {es ? "Tipo de personaje" : "Character type"}
                <select
                  aria-label={es ? "Tipo de personaje" : "Character type"}
                  value={type}
                  onChange={(e) => setType(e.target.value as Character["type"])}
                >
                  {characterTypes.map((t, i) => (
                    <option key={t} value={t}>
                      {characterNames[locale][i]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="upload-placement">
                {(
                  [
                    [es ? "Escala" : "Scale", scale, setScale, 0.4, 2],
                    ["X", x, setX, -16, 16],
                    ["Y", y, setY, -10, 10],
                  ] as const
                ).map(([label, value, set, min, max]) => (
                  <label key={label}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step=".1"
                      value={value}
                      onChange={(e) => {
                        if (Number.isFinite(e.target.valueAsNumber))
                          set(
                            Math.max(
                              min,
                              Math.min(max, e.target.valueAsNumber),
                            ),
                          );
                      }}
                    />
                  </label>
                ))}
              </div>
              <label>
                {es ? "Etiquetas" : "Tags"}
                <input
                  maxLength={300}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>
              <label>
                {es ? "URL de origen (opcional)" : "Source URL (optional)"}
                <input
                  maxLength={2048}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
              <label>
                {es ? "Destino" : "Destination"}
                <select
                  aria-label={es ? "Destino" : "Destination"}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value={worldId}>{worldName}</option>
                  <option value="library">
                    {es ? "Solo biblioteca" : "Library only"}
                  </option>
                </select>
              </label>
              <div className="creation-actions">
                <button
                  type="button"
                  disabled={!ready || busy}
                  onClick={() => void persist(false)}
                >
                  {es ? "Guardar en biblioteca" : "Save to library"}
                </button>
                <button
                  className="creation-primary"
                  type="submit"
                  disabled={!ready || busy}
                >
                  {target === worldId
                    ? es
                      ? "Guardar y colocar"
                      : "Save and place"
                    : es
                      ? "Guardar archivo"
                      : "Save asset"}
                </button>
              </div>
            </form>
          </>
        )}
        <BackupImport
          locale={locale}
          kind="character"
          onAsset={() => void refresh()}
        />
        <h2>{es ? "Biblioteca de personajes" : "Character library"}</h2>
        <p>
          {es
            ? "Quitar un personaje del mundo no borra su archivo original."
            : "Removing a character from a world does not delete its original file."}
        </p>
        <div className="upload-library">
          {items.map((a) => (
            <article key={a.id}>
              <ExportAsset asset={a} es={es} />
              <button onClick={() => select(a)}>
                {a.name} · {a.format.toUpperCase()}
              </button>
              <button
                onClick={async () => {
                  try {
                    await saveAsset({
                      ...a,
                      id: crypto.randomUUID(),
                      name: a.name.slice(0, 94) + (es ? " copia" : " copy"),
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },accountScope);
                    assertAccountContext(accountScope);await refresh();
                  } catch {
                    setError(message("storage_failed"));
                  }
                }}
              >
                {es ? "Duplicar archivo" : "Duplicate asset"}
              </button>
              <button onClick={() => void deletion(a)}>
                {es ? "Eliminar archivo original" : "Delete original asset"}
              </button>
            </article>
          ))}
          {!items.length && (
            <p>
              {es ? "Aún no hay archivos guardados." : "No saved assets yet."}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
