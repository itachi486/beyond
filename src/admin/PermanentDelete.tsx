import { useRef, useState } from "react";
import { Overlay } from "../components/Overlay";
import type { AdminRequest } from "./AdminInventory";
import { t } from "./i18n";
export default function PermanentDelete({
  kind,
  id,
  name,
  version,
  request,
  onDeleted,
}: {
  kind: "world" | "character";
  id: string;
  name: string;
  version: number;
  request: AdminRequest;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request(
        (kind === "world" ? "worlds/" : "library/characters/") +
          id +
          "/permanent-delete",
        "POST",
        { version, confirm: "DELETE PERMANENTLY" },
      );
      if (result.deleted !== true) throw Error(t("deleteFailed"));
      setOpen(false);
      onDeleted();
      window.dispatchEvent(new Event("beyond:content-changed"));
    } catch (e) {
      setError((e as Error).message || t("deleteFailed"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="admin-danger"
        title={t("delete")}
        aria-label={`${t("delete")} ${name}`}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <span aria-hidden="true">×</span> {t("delete")}
      </button>
      {open && (
        <div className="admin-delete-dialog">
          <Overlay
            title={t("deleteTitle")}
            closeLabel={t("closeDelete")}
            onClose={() => {
              if (!lock.current) setOpen(false);
            }}
          >
            <h2>{name}</h2>
            <code>{id}</code>
            <p>{t("deleteWarning")}</p>
            <p>{t(kind === "world" ? "worldWarning" : "characterWarning")}</p>
            {error && (
              <p role="alert" className="admin-error">
                {error}
              </p>
            )}
            <div className="admin-actions">
              <button disabled={busy} onClick={() => setOpen(false)}>
                {t("cancel")}
              </button>
              <button
                className="admin-danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {t(busy ? "deleting" : "deleteConfirm")}
              </button>
            </div>
          </Overlay>
        </div>
      )}
    </>
  );
}
