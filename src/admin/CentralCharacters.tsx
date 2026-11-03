import CharacterIdentityEditor from './CharacterIdentityEditor';
import PermanentDelete from "./PermanentDelete";
import { t } from "./i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Overlay } from "../components/Overlay";
import {
  filePayload,
  type CentralCharacter,
} from "../features/creation/centralLibrary";
import {
  inspectFile,
  type ImportedAsset,
} from "../features/creation/uploadAssets";
import AssetPreview from "../features/creation/AssetPreview";
import {
  characterTypes,
  characterNames,
} from "../features/creation/spiritModel";
import type { AdminRequest } from "./AdminInventory";
const blank = () => ({
  name: "",
  description: "",
  type: "custom",
  tags: "",
  source: "",
  active: true,
});
export default function CentralCharacters({
  request,
}: {
  request: AdminRequest;
}) {
  const [items, setItems] = useState<CentralCharacter[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [total, setTotal] = useState(0),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<CentralCharacter | null | undefined>(
      undefined,
    ),
    [form, setForm] = useState(blank),
    [asset, setAsset] = useState<ImportedAsset | null>(null),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<File | null>(null),
    [previewURL, setPreviewURL] = useState(""),
    [ready, setReady] = useState(false),
    [phase, setPhase] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false),
    ticket = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(
      "library/characters?" +
        new URLSearchParams({ page: String(page), search, status: filter }),
      "GET",
      undefined,
      controller.signal,
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
  }, [page, search, filter, refresh, request]);
  useEffect(() => {
    if (!preview) {
      setPreviewURL("");
      return;
    }
    const url = URL.createObjectURL(preview);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  useEffect(
    () => () => {
      ticket.current++;
    },
    [],
  );
  async function receive(f?: File) {
    if (!f || lock.current) return;
    const token = ++ticket.current;
    setBusy(true);
    setPhase(t("ui.validating.local.preview"));
    setError("");
    setReady(false);
    try {
      const info = await inspectFile(f);
      if (token !== ticket.current) return;
      setFile(f);
      setAsset({
        id: crypto.randomUUID(),
        file: f,
        ...info,
        filename: f.name,
        name: f.name.replace(/\.[^.]+$/, "").slice(0, 100),
        description: "",
        tags: "",
        source: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!form.name)
        setForm((v) => ({
          ...v,
          name: f.name.replace(/\.[^.]+$/, "").slice(0, 100),
        }));
    } catch (e) {
      setError(
        "Could not preview this file. Use PNG/WebP/JPEG ≤8 MiB or GLB/embedded glTF ≤16 MiB.",
      );
      setFile(null);
      setAsset(null);
    } finally {
      setBusy(false);
      setPhase("");
    }
  }
  function close() {
    if (lock.current) return;
    ticket.current++;
    setEditing(undefined);
    setAsset(null);
    setFile(null);
    setPreview(null);
    setReady(false);
    setError("");
  }
  async function edit(row: CentralCharacter | null) {
    setForm(
      row
        ? {
            name: row.name,
            description: row.description,
            type: row.type,
            tags: row.tags,
            source: row.source,
            active: row.active,
          }
        : blank(),
    );
    setEditing(row);
    setAsset(null);
    setFile(null);
    setPreview(null);
    setReady(false);
    setError("");
    setNotice("");
    if (row) {
      const token = ++ticket.current;
      setBusy(true);
      try {
        const response = await fetch(row.fileUrl, { cache: "no-store" });
        if (!response.ok) throw Error(t("ui.stored.file.could.not.be.loaded"));
        const f = new File([await response.blob()], `character.${row.format}`);
        const info = await inspectFile(f);
        if (token === ticket.current)
          setAsset({
            id: row.id,
            file: f,
            ...info,
            filename: f.name,
            name: row.name,
            description: row.description,
            tags: row.tags,
            source: row.source,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current || busy || !ready || (!editing && !file)) return;
    lock.current = true;
    setBusy(true);
    setPhase(t("ui.uploading.and.validating.on.the.server"));
    setError("");
    try {
      const body = {
        ...form,
        ...(editing ? { version: editing.version } : {}),
        ...(file ? { file: await filePayload(file) } : {}),
        ...(preview ? { preview: await filePayload(preview) } : {}),
      };
      await request(
        "library/characters" + (editing ? "/" + editing.id : ""),
        editing ? t("ui.put") : t("ui.post"),
        body,
      );
      setNotice(
        editing
          ? t(
              "ui.central.character.updated.existing.world.snapshots.were.preserved",
            )
          : t("ui.character.uploaded.to.the.central.library"),
      );
      setEditing(undefined);
      setAsset(null);
      setFile(null);
      setPreview(null);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
      setPhase("");
    }
  }
  return (
    <section className="admin-central">
      <div className="admin-toolbar">
        <div>
          <h2>{t("ui.central.character.library")}</h2>
          <p>
            {t(
              "ui.published.originals.for.everyone.personal.browser.uploads.remain.separat",
            )}{" "}
          </p>
        </div>
        <button className="admin-primary" onClick={() => void edit(null)}>
          {t("ui.upload.character")}{" "}
        </button>
      </div>
      <div className="admin-toolbar">
        <label>
          {t("ui.search.central.library")}{" "}
          <input
            value={search}
            type="search"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          {t("ui.central.status")}{" "}
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("ui.active.and.inactive")}</option>
            <option value="active">{t("ui.active")}</option>
            <option value="inactive">{t("ui.inactive")}</option>
            <option value="archived">{t("ui.archived")}</option>
          </select>
        </label>
      </div>
      {notice && (
        <p
          role="status"
          aria-label={t("ui.central.library.result")}
          className="admin-notice"
        >
          {notice}
        </p>
      )}
      {error && editing === undefined && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {loading && <p role="status">{t("ui.loading.central.characters")}</p>}
      {!loading && (
        <div className="admin-character-grid">
          {items.map((row) => (
            <article className="cosmic-panel character-card" key={row.id}>
              {row.previewUrl ? (
                <img
                  className="admin-central-thumb"
                  src={row.previewUrl}
                  alt={row.name}
                />
              ) : (
                <span className="cosmic-model-placeholder" aria-hidden="true">
                  {t("symbol.model")}{" "}
                </span>
              )}
              <h3>{row.name}</h3>
              <p>{row.description}</p>
              <small>
                {row.type}
                {t("separator.dot")} {row.format.toUpperCase()}
                {t("ui.v")}
                {row.version}
                {t("separator.dot")}{" "}
                {row.deleted
                  ? t("ui.archived")
                  : row.active
                    ? t("ui.active")
                    : t("ui.inactive")}
              </small>
              <div className="admin-actions">
                <button className="admin-primary" disabled={row.deleted} onClick={() => void edit(row)}>
                  {t("ui.edit.character")}{" "}
                </button>
                <button
                  disabled={row.deleted || busy}
                  onClick={async () => {
                    if (
                      !confirm(
                        t(
                          "ui.archive.this.central.character.it.will.disappear.from.the.public.library",
                        ),
                      )
                    )
                      return;
                    try {
                      await request("library/characters/" + row.id, "DELETE", {
                        version: row.version,
                        confirm: "ARCHIVE",
                      });
                      setNotice(
                        t(
                          "ui.character.archived.existing.local.world.snapshots.and.source.files.were.",
                        ),
                      );
                      setRefresh((v) => v + 1);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {t("ui.archive.character")}{" "}
                </button>
              </div>
              <div className="character-card-danger">
                <PermanentDelete
                  kind="character"
                  id={row.id}
                  name={row.name}
                  version={row.version}
                  request={request}
                  onDeleted={() => {
                    setNotice(t("deleted"));
                    setRefresh((v) => v + 1);
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && !items.length && (
        <p>{t("ui.no.central.characters.match.upload.an.original.to.begin")}</p>
      )}
      <div className="admin-pagination">
        <span>
          {t("ui.total")} {total}
        </span>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t("ui.previous")}{" "}
        </button>
        <span>
          {t("ui.page")} {page}
          {t("ui.of")} {pages}
        </span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          {t("ui.next")}{" "}
        </button>
      </div>
      <p className="admin-muted">
        {t(
          "ui.physical.deletion.is.unavailable.because.anonymous.browser.world.referen",
        )}{" "}
      </p>
      {editing !== undefined && (
        <Overlay
          title={
            editing
              ? t("ui.edit.central.character")
              : t("ui.upload.central.character")
          }
          closeLabel="Cancel character upload"
          onClose={close}
        >
          <form className="central-admin-form" onSubmit={save}>
            <label>
              {t("ui.character.file")}{" "}
              <input
                ref={input}
                type="file"
                accept=".png,.webp,.jpg,.jpeg,.glb,.gltf"
                disabled={busy}
                onChange={(e) => void receive(e.target.files?.[0])}
              />
            </label>
            <div
              className="central-admin-drop"
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
                {t("ui.choose.or.drop.character.file")}{" "}
              </button>
              <small>
                {t("ui.png.webp.jpeg.8.mib.glb.embedded.gltf.16.mib")}
              </small>
            </div>
            {asset && (
              <AssetPreview asset={asset} es={false} onReady={setReady} />
            )}
            {(["name", "description", "tags", "source"] as const).map((key) => (
              <label key={key}>
                {
                  {
                    name: t("ui.character.name"),
                    description: t("ui.character.description"),
                    tags: t("ui.character.tags"),
                    source: t("ui.source.url"),
                  }[key]
                }
                {key === "description" ? (
                  <textarea
                    maxLength={2000}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, [key]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    required={key === "name"}
                    type={key === "source" ? "url" : "text"}
                    maxLength={
                      key === "name" ? 100 : key === "tags" ? 300 : 2048
                    }
                    value={form[key]}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, [key]: e.target.value }))
                    }
                  />
                )}
              </label>
            ))}
            <label>
              {t("ui.character.type")}{" "}
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((v) => ({ ...v, type: e.target.value }))
                }
              >
                {characterTypes.map((t, i) => (
                  <option key={t} value={t}>
                    {characterNames.en[i]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("ui.preview.image.optional.2.mib")}{" "}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 2 * 1024 * 1024) throw 0;
                    const info = await inspectFile(f);
                    if (info.kind !== "image") throw 0;
                    setPreview(f);
                  } catch {
                    setError(
                      t("ui.use.a.valid.preview.png.jpeg.or.webp.up.to.2.mib"),
                    );
                    setPreview(null);
                  }
                }}
              />
            </label>
            {previewURL && (
              <img
                className="admin-central-thumb"
                src={previewURL}
                alt="Selected preview"
              />
            )}
            <label className="admin-publish">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((v) => ({ ...v, active: e.target.checked }))
                }
              />
              {t("ui.publish.in.the.public.central.library")}{" "}
            </label>
            <p>
              {t(
                "ui.users.add.independent.local.snapshots.updating.this.original.never.moves",
              )}{" "}
            </p>
            {phase && <p role="status">{phase}</p>}
            {error && (
              <p role="alert" className="admin-error">
                {error}
              </p>
            )}
            <div className="admin-actions">
              <button type="button" disabled={busy} onClick={close}>
                {t("ui.cancel")}{" "}
              </button>
              <button
                className="admin-primary"
                disabled={busy || !ready || !form.name.trim()}
                type="submit"
              >
                {busy ? t("ui.saving") : t("ui.save.central.character")}
              </button>
            </div>
          </form>
          {editing&&<CharacterIdentityEditor key={editing.id} characterId={editing.id} request={request}/>}
        </Overlay>
      )}
    </section>
  );
}
