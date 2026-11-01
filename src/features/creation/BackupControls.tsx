import {captureAccountContext,assertAccountContext} from '../account/sessionScope';
import { useAuthorAccess, requireAuthor } from "./authorAccess";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../locales";
import type { CreatedWorld } from "./worldStore";
import type { ImportedAsset } from "./uploadAssets";
import {
  characterWorld,
  downloadPackage,
  exportPackage,
  importCharacterPackage,
  inspectPackage,
  restorePackage,
  type PackagePlan,
} from "./worldBackup";
import AssetPreview from "./AssetPreview";
import "./backup.css";
export function backupError(code: string, es: boolean) {
  const messages: Record<string, [string, string]> = {
    admin_author_required: [
      "Sign in as an administrator to import external backups.",
      "Inicia sesión como administrador para importar copias externas.",
    ],
    package_version: [
      "This package version is not supported. Export with the current BEYOND version.",
      "Versión no compatible. Exporta con la versión actual de BEYOND.",
    ],
    package_large: [
      "Package must be nonempty and no larger than 80 MiB.",
      "El paquete debe tener contenido y no superar 80 MiB.",
    ],
    private_asset: [
      "Contains private server AI images. Portable export is unavailable; no incomplete backup was created.",
      "Contiene imágenes privadas del servidor. No se creó una copia incompleta.",
    ],
    missing_asset: [
      "An original file is missing or its integrity check failed. Keep the original data and export again.",
      "Falta un archivo original o falló su integridad. Conserva los datos y exporta de nuevo.",
    ],
    external_reference: [
      "This character links to other characters. Export the whole world to preserve those references.",
      "Este personaje referencia otros personajes. Exporta el mundo completo.",
    ],
    existing_storage: [
      "Existing world data cannot be read. Nothing was overwritten.",
      "No se pueden leer los mundos existentes. No se sobrescribió nada.",
    ],
    storage_space: [
      "Not enough estimated storage. Free space or use another browser.",
      "Espacio estimado insuficiente. Libera espacio o usa otro navegador.",
    ],
    partial_restore: [
      "Restore failed; some NEW unreferenced files may remain in the library. Existing worlds were not overwritten.",
      "Falló la restauración; pueden quedar archivos NUEVOS sin referencias. No se sobrescribieron mundos.",
    ],
    package_invalid: [
      "Invalid or damaged BEYOND package. Use the original exported ZIP (uncompressed entries); do not edit or recompress it.",
      "Paquete BEYOND inválido o dañado. Usa el ZIP original (archivos sin compresión); no lo edites ni recomprimas.",
    ],
  };
  return (messages[code] || [
    "Could not validate or save this backup. Existing data was preserved. Check storage and try again.",
    "No se pudo validar o guardar. Los datos existentes se conservaron. Revisa el almacenamiento.",
  ])[es ? 1 : 0];
}
export function ExportBackup({
  world,
  es,
  kind = "world",
}: {
  world: CreatedWorld;
  es: boolean;
  kind?: "world" | "character";
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  return (
    <span className="backup-export">
      <button
        disabled={busy}
        onClick={async () => {
          const accountScope=captureAccountContext();
          setBusy(true);
          setMessage("");
          try {
            const b = await exportPackage(world, kind,accountScope);assertAccountContext(accountScope);
            downloadPackage(b, kind);
            setError(false);
            setMessage(
              es
                ? "Descarga preparada. Guarda el archivo ZIP en un lugar seguro."
                : "Download prepared. Save the ZIP somewhere safe.",
            );
          } catch (e) {
            setError(true);
            setMessage(backupError((e as Error).message, es));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? es
            ? "Preparando…"
            : "Preparing…"
          : kind === "world"
            ? es
              ? "Exportar copia del mundo"
              : "Export World Backup"
            : es
              ? "Exportar personaje"
              : "Export Character"}
      </button>
      {message && <small role={error ? "alert" : "status"}>{message}</small>}
    </span>
  );
}
export function ExportAsset({
  asset,
  es,
}: {
  asset: ImportedAsset;
  es: boolean;
}) {
  try {
    return (
      <ExportBackup
        world={characterWorld(
          asset,
          asset.template?.graph?.characters[0]
            ? {
                ...asset.template.graph.characters[0],
                name: asset.name,
                description: asset.description,
                tags: asset.tags,
                sourceUrl: asset.source,
              }
            : undefined,
          asset.template,
        )}
        es={es}
        kind="character"
      />
    );
  } catch {
    return null;
  }
}
export default function BackupImport({
  locale,
  kind,
  onWorld,
  onAsset,
}: {
  locale: Locale;
  kind: "world" | "character";
  onWorld?: (w: CreatedWorld) => void;
  onAsset?: (a: ImportedAsset) => void;
}) {
  const canAuthor = useAuthorAccess();
  const es = locale === "es",
    [open, setOpen] = useState(false),
    [plan, setPlan] = useState<PackagePlan | null>(null),
    [filename, setFilename] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false);
  const dialog = useRef<HTMLDivElement>(null),
    lock = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    if (!open || !canAuthor) return;
    const old = document.activeElement as HTMLElement;
    const parents = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ).filter((el) => el !== dialog.current && !el.contains(dialog.current));
    const inertBefore = parents.map((el) => el.inert);
    parents.forEach((el) => {
      el.inert = true;
    });
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") e.stopImmediatePropagation();
      if (e.key === "Escape" && !lock.current) {
        setOpen(false);
        generation.current++;
      }
      if (e.key === "Tab") {
        const list = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select",
          ) || [],
        );
        const first = list[0],
          last = list[list.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      parents.forEach((el, i) => {
        el.inert = inertBefore[i];
      });
      old?.focus();
    };
  }, [open, canAuthor]);
  const label =
    kind === "world"
      ? es
        ? "Restaurar mundo"
        : "Restore World"
      : es
        ? "Importar personaje"
        : "Import Character";
  if (!canAuthor)
    return (
      <p className="backup-policy">
        {es
          ? "Importar archivos requiere acceso de administrador. Tus mundos guardados siguen disponibles."
          : "Importing external backups requires administrator access. Existing saved worlds remain available."}
      </p>
    );
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setError("");
          setNotice("");
          setPlan(null);
        }}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div className="backup-backdrop">
            <div
              className="backup-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="backup-title"
              ref={dialog}
              tabIndex={-1}
            >
              <h2 id="backup-title">{label}</h2>
              <button
                className="creation-close"
                disabled={busy}
                aria-label={es ? "Cerrar" : "Close"}
                onClick={() => {
                  generation.current++;
                  setOpen(false);
                }}
              >
                ×
              </button>
              <p>
                {es
                  ? "Copia nueva: nunca sobrescribe datos existentes. Incluye contenido personal y URL de origen. Conserva el ZIP original."
                  : "New copy: never overwrites existing data. Includes personal content and source URLs. Keep the original ZIP."}
              </p>
              <label>
                {es ? "Paquete de copia ZIP" : "Backup ZIP package"}
                <input
                  type="file"
                  accept=".zip"
                  disabled={busy}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    const token = ++generation.current;
                    setPlan(null);
                    setReady(false);
                    setError("");
                    setNotice("");
                    setFilename(f.name);
                    setBusy(true);
                    try {
                      const p = await inspectPackage(f);
                      if (p.manifest.kind !== kind)
                        throw Error("package_invalid");
                      if (token !== generation.current) return;
                      setPlan(p);
                      setName(p.world.name);
                      setReady(!p.assets.length);
                    } catch (err) {
                      setError(backupError((err as Error).message, es));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              {busy && (
                <p role="status">
                  {es ? "Validando / guardando…" : "Validating / saving…"}
                </p>
              )}
              {error && <p role="alert">{error}</p>}
              {notice && <p role="status">{notice}</p>}
              {plan && (
                <>
                  <p>
                    {filename} · {Math.ceil(plan.bytes / 1024)} KiB
                  </p>
                  <p>
                    {es ? "Mundos" : "Worlds"}: {kind === "world" ? 1 : 0} ·{" "}
                    {es ? "Personajes" : "Characters"}:{" "}
                    {plan.world.graph?.characters.length || 0} ·{" "}
                    {es ? "Archivos" : "Assets"}: {plan.assets.length}
                  </p>
                  <ul>
                    {plan.assets.map((a) => (
                      <li key={a.id}>
                        {a.name} · {a.format.toUpperCase()} · {a.file.size}{" "}
                        bytes
                      </li>
                    ))}
                  </ul>
                  <p>
                    {es
                      ? "Los ID existentes pueden coincidir: se asignarán ID nuevos. Las referencias internas se actualizarán; portales a otros mundos no incluidos conservarán su destino original. El mismo ZIP se reutiliza si ya se importó."
                      : "Existing IDs may collide: new IDs will be assigned. Internal references will be remapped; portals to other worlds not included retain their original destination. Reimporting the same ZIP reuses its previous import."}
                  </p>
                  {plan.assets[0] && (
                    <AssetPreview
                      key={plan.fingerprint}
                      asset={plan.assets[0]}
                      es={es}
                      onReady={setReady}
                    />
                  )}
                  <label>
                    {es ? "Nombre restaurado" : "Restored name"}
                    <input
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <p>
                    {es
                      ? "Modo: copia nueva, archivos nuevos. No se modifica el original."
                      : "Mode: new copy, new asset IDs. Originals remain untouched."}
                  </p>
                  <button
                    className="creation-primary"
                    disabled={busy || !ready || !name.trim()}
                    onClick={async () => {
                      if (lock.current) return;
                      const accountScope=captureAccountContext();lock.current = true;
                      setBusy(true);
                      setError("");
                      try {
                        await requireAuthor();assertAccountContext(accountScope);
                        if (kind === "world") {
                          const w = await restorePackage(plan, name,accountScope);
                          setNotice(es ? "Mundo guardado." : "World saved.");
                          setOpen(false);
                          onWorld?.(w);
                        } else {
                          const a = await importCharacterPackage(plan, name,accountScope);
                          setNotice(
                            es
                              ? "Personaje guardado en la biblioteca."
                              : "Character saved to library.",
                          );
                          onAsset?.(a);
                          setPlan(null);
                        }
                      } catch (err) {
                        setError(backupError((err as Error).message, es));
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    {es ? "Confirmar importación" : "Confirm Import"}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
