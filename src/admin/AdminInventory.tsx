import { t, adminDate } from "./i18n";
import { useEffect, useState } from "react";
import { Overlay } from "../components/Overlay";
type User = {
  id: string;
  email: string;
  createdAt: string;
  status: string;
  activeSessions: number;
  role?: string;
};
type Asset = {
  id: string;
  creatorId: string;
  creator: string | null;
  mime: string;
  bytes: number;
  createdAt: number;
  previewUrl: string | null;
  worldUsage: null;
};
type Result = {
  items: (User | Asset)[];
  total: number;
  page: number;
  totalPages: number;
  scope: string;
};
export type AdminRequest = (
  path: string,
  method?: string,
  value?: unknown,
  signal?: AbortSignal,
) => Promise<any>;
export default function AdminInventory({
  kind,
  request,
}: {
  kind: "users" | "characters";
  request: AdminRequest;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<User | Asset | null>(null),
    [imageError, setImageError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setDetail(null);
    void request(
      kind + "?" + new URLSearchParams({ search, status, page: String(page) }),
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data);
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
  }, [kind, search, status, page, request]);
  return (
    <>
      <section className="admin-panel admin-scope">
        <h2>
          {kind === "users"
            ? t("ui.server.accounts")
            : t("ui.server.image.assets")}
        </h2>
        <p>
          {kind === "users"
            ? t(
                "ui.public.visitor.accounts.are.not.implemented.this.list.contains.real.serv",
              )
            : t(
                "ui.uploaded.characters.their.names.and.world.placements.remain.in.each.brow",
              )}
        </p>
        <strong>
          {t("ui.browser")}{" "}
          {kind === "users" ? "visitors" : "character libraries"}
          {t("ui.not.centrally.stored.14")}{" "}
        </strong>
      </section>
      <div className="admin-toolbar">
        <label>
          {t("ui.search")} {kind === "users" ? "accounts" : "assets"}
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {kind === "users" && (
          <label>
            {t("ui.account.status")}{" "}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("ui.all.states")}</option>
              <option value="allowed">{t("ui.allowed")}</option>
              <option value="blocked">{t("ui.blocked")}</option>
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {loading && <p role="status">{t("ui.loading.server.records")}</p>}
      {!loading && !error && result && (
        <section className="admin-panel">
          <p className="admin-muted">{result.scope}</p>
          <table>
            <thead>
              <tr>
                <th>{kind === "users" ? t("ui.email") : t("ui.asset.id")}</th>
                <th>
                  {kind === "users" ? "Access / sessions" : "Format / size"}
                </th>
                <th>{t("ui.created")}</th>
                <th>{t("ui.details")}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  <td
                    data-label={
                      kind === "users" ? t("ui.email") : t("ui.asset.id")
                    }
                  >
                    {"email" in row ? row.email : row.id}
                  </td>
                  <td
                    data-label={
                      kind === "users" ? "Access / sessions" : "Format / size"
                    }
                  >
                    {"email" in row
                      ? `${row.status} / ${row.activeSessions} active`
                      : `${row.mime} / ${Math.ceil(row.bytes / 1024)} KiB`}
                  </td>
                  <td data-label={t("ui.created")}>
                    {adminDate(new Date(row.createdAt))}
                  </td>
                  <td>
                    <button
                      onClick={async () => {
                        setImageError(false);
                        if (kind === "users") {
                          try {
                            setDetail((await request("users/" + row.id)).item);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        } else setDetail(row);
                      }}
                    >
                      {t("ui.view.details")}{" "}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.items.length && <p>{t("ui.no.matching.server.records")}</p>}
          <div className="admin-pagination">
            <span>
              {t("ui.total")} {result.total}
            </span>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              {t("ui.previous")}{" "}
            </button>
            <span>
              {t("ui.page")} {page}
              {t("ui.of")} {result.totalPages}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("ui.next")}{" "}
            </button>
          </div>
        </section>
      )}
      {detail && (
        <Overlay
          title={
            kind === "users"
              ? t("ui.account.details")
              : t("ui.character.asset.details")
          }
          closeLabel="Close details"
          onClose={() => setDetail(null)}
        >
          <dl className="admin-detail">
            <dt>{t("ui.id")}</dt>
            <dd>{detail.id}</dd>
            {"email" in detail ? (
              <>
                <dt>{t("ui.email")}</dt>
                <dd>{detail.email}</dd>
                <dt>{t("ui.role")}</dt>
                <dd>{t("ui.administrator")}</dd>
                <dt>{t("ui.access")}</dt>
                <dd>{detail.status}</dd>
                <dt>{t("ui.active.sessions")}</dt>
                <dd>{detail.activeSessions}</dd>
                <dt>{t("ui.account.changes")}</dt>
                <dd>
                  {t(
                    "ui.read.only.configure.the.single.allowed.email.on.the.server.no.public.enr",
                  )}{" "}
                </dd>
              </>
            ) : (
              <>
                <dt>{t("ui.creator")}</dt>
                <dd>{detail.creator || "Not recorded"}</dd>
                <dt>{t("ui.format")}</dt>
                <dd>{detail.mime}</dd>
                <dt>{t("ui.size")}</dt>
                <dd>
                  {detail.bytes}
                  {t("ui.bytes")}
                </dd>
                <dt>{t("ui.world.usage")}</dt>
                <dd>{t("ui.not.centrally.stored")}</dd>
                <dt>{t("ui.preview")}</dt>
                <dd>
                  {detail.previewUrl && !imageError ? (
                    <img
                      className="admin-asset-preview"
                      src={detail.previewUrl}
                      alt="Stored character image"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <p>
                      {t(
                        "ui.unavailable.no.preview.is.accessible.for.this.session",
                      )}{" "}
                    </p>
                  )}
                </dd>
                <dt>{t("ui.deletion")}</dt>
                <dd>
                  {t(
                    "ui.unavailable.browser.world.references.cannot.be.checked.centrally",
                  )}{" "}
                </dd>
              </>
            )}
            <dt>{t("ui.created")}</dt>
            <dd>{adminDate(new Date(detail.createdAt))}</dd>
          </dl>
        </Overlay>
      )}
    </>
  );
}
export function SystemStatus({ request }: { request: AdminRequest }) {
  const [state, setState] = useState<Record<
      string,
      string | number | boolean
    > | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void request("system", "GET", undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [request]);
  return (
    <section className="admin-panel">
      <h2>{t("ui.system.status")}</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !state ? (
        <p role="status">{t("ui.loading.system.status")}</p>
      ) : (
        <dl className="admin-detail">
          {Object.entries(state).map(([key, value]) => (
            <div key={key}>
              <dt>
                {(
                  {
                    database: "Database",
                    administratorPolicy: "Administrator policy",
                    administratorConfigured: "Allowed email configured",
                    sessionExpiresAt: "Session expires",
                    csrfProtection: "CSRF protection",
                    imageServiceConfigured: "Image service configured",
                    publicUserAccounts: "Visitor accounts",
                    localCharacters: "Uploaded characters",
                    localWorlds: "Local worlds",
                    storage: "Storage",
                  } as Record<string, string>
                )[key] || key}
              </dt>
              <dd>
                {key === "sessionExpiresAt"
                  ? adminDate(new Date(value as number))
                  : typeof value === "boolean"
                    ? value
                      ? t("ui.yes")
                      : t("ui.no")
                    : value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p>
        {t(
          "ui.admin.allowed.email.is.server.only.this.screen.cannot.change.allowed.ide",
        )}{" "}
      </p>
    </section>
  );
}
