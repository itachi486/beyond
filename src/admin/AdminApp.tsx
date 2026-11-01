import {readAPIResponse} from "../lib/apiResponse";
import AdminMembers from "./AdminMembers";
import ImageManagement from "./ImageManagement";
import AdminNavIcon from "./AdminNavIcon";
import PendingDeletions from "./PendingDeletions";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Overlay } from "../components/Overlay";
import { ActivityLog, CosmicIcon } from "./CosmicDashboard";
import CentralCharacters from "./CentralCharacters";
import AdminInventory, { SystemStatus } from "./AdminInventory";
import FantasyDashboard from "./FantasyDashboard";
import PermanentDelete from "./PermanentDelete";
import { t, adminDate } from "./i18n";
import "./admin.css";
import "./cosmic-admin.css";
import "./fantasy-admin.css";
type Text = { en: string; es: string };
type Source = { url: string; description: string; verification: string };
type RecordData = {
  id?: string;
  version?: number;
  slug: string;
  status: string;
  name: Text;
  description: Text;
  title: Text;
  summary: Text;
  body: Text[];
  sources: Source[];
  worldId: string;
  theme: string;
  color: string;
  symbol: string;
  order: number;
  position: number[];
  contentType: string;
  evidence: string;
  interpretation: string;
  questions: string;
  media: string;
  updatedAt?: string;
  createdAt?: string;
  truthType: string;
  verificationStatus: string;
  uncertainty: string;
  hubKey?: string;
  hubPosition?: number[];
};
type Session = { email: string; csrf: string; expiresAt: number };
type Link = { id: string; from_id: string; to_id: string; explanation: string };
type Catalog = {
  worlds: { id: string; name: Text; status: string; hubKey?: string }[];
  discoveries: { id: string; title: Text; worldId: string; status: string }[];
  connections: Link[];
};
const blank = (): RecordData => ({
  slug: "",
  status: "draft",
  name: { en: "", es: "" },
  description: { en: "", es: "" },
  title: { en: "", es: "" },
  summary: { en: "", es: "" },
  body: [{ en: "", es: "" }],
  sources: [],
  worldId: "archive",
  theme: "unsolved",
  color: "#8eafff",
  symbol: "05",
  order: 5,
  position: [-7, 0, -12],
  contentType: "question",
  truthType: "factual",
  verificationStatus: "needs_review",
  uncertainty: "",
  evidence: "",
  interpretation: "",
  questions: "",
  media: "",
});
const navigation = [
  ["", t("dashboard")],
  ["worlds", t("worlds")],
  ["characters", t("characters")],
  ["connections", t("ui.connections")],
  ["analytics", t("ui.analytics")],
  ["settings", t("settings")],
  ["users", t("users")],
  ["content", t("content")],
  ["discoveries", t("ui.discoveries")],
  ["activity", t("activity")],
  ["images", "Image Management"],
];
export default function AdminApp() {
  const location = useLocation(),
    navigate = useNavigate();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [setupState, setSetupState] = useState("unknown");
  const [session, setSession] = useState<Session | null>(null),
    [boot, setBoot] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [catalog, setCatalog] = useState<Catalog>({
    worlds: [],
    discoveries: [],
    connections: [],
  });
  const [dashboard, setDashboard] = useState<{
    administratorAccounts: number;
    serverCharacterAssets: number;
    worlds: number;
    published: number;
    drafts: number;
    review: number;
    totalDiscoveries: number;
    needsReview: number;
    verified: number;
    recent: (RecordData & { kind: string })[];
  } | null>(null);
  const [items, setItems] = useState<RecordData[]>([]),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(1),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<RecordData>(blank),
    [history, setHistory] = useState<{ id: number; created_at: string }[]>([]),
    [preview, setPreview] = useState(false),
    [initialStatus, setInitialStatus] = useState("draft");
  const [connection, setConnection] = useState({
      id: "",
      fromId: "",
      toId: "",
      explanation: "",
    }),
    [defaults, setDefaults] = useState("en");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const parts = location.pathname.split("/").filter(Boolean),
    section = parts[1] || "",
    id = parts[2],
    isLogin = section === "login",
    isEditor = (section === "worlds" || section === "discoveries") && !!id;
  const request = useCallback(
    async (
      path: string,
      method = "GET",
      value?: unknown,
      signal?: AbortSignal,
    ) => {
      const res = await fetch("/api/admin/" + path, {
        method,
        signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
        cache: "no-store",
        headers:
          method === "GET"
            ? {}
            : {
                "Content-Type": "application/json",
                "X-CSRF-Token": session?.csrf || "",
              },
        body: value === undefined ? undefined : JSON.stringify(value),
      });
      if(res.status===401&&!path.startsWith("login")){setSession(null);navigate("/admin/login",{replace:true});}
      const data = await readAPIResponse(res,"/api/admin/"+path);
      if (!res.ok) {
        if (res.status === 401 && !path.startsWith("login")) {
          setSession(null);
          navigate("/admin/login", { replace: true });
        }
        throw Error(data.error || "The request failed.");
      }
      return data;
    },
    [session?.csrf, navigate],
  );
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/session", { cache: "no-store" }),
      fetch("/api/admin/setup-status", { cache: "no-store" }),
    ])
      .then(async ([res, setup]) => {
        if (!active) return;
        if (setup.ok) setSetupState((await readAPIResponse(setup,"/api/admin/setup-status")).state);
        else setSetupState("unavailable");
        if (res.ok) {
          setSession(await readAPIResponse(res,"/api/admin/session"));
          if (isLogin) navigate("/admin", { replace: true });
        } else if (!isLogin) navigate("/admin/login", { replace: true });
      })
      .catch(() => {
        if (active) setError("The server could not be reached.");
      })
      .finally(() => {
        if (active) setBoot(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      setSession(null);
      navigate("/admin/login", { replace: true });
    };
    const timer = window.setTimeout(
      expire,
      Math.max(0, Math.min(session.expiresAt - Date.now(), 2147483647)),
    );
    return () => window.clearTimeout(timer);
  }, [session?.expiresAt, navigate]);
  useEffect(() => {
    setPage(1);
    setSearch("");
    setFilter("");
    setError("");
  }, [section]);
  useEffect(() => {
    if (!session || isLogin) return;
    if(!section||section==='analytics'||['images','users'].includes(section)){setLoading(false);return;}
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const data = await request(
          "catalog",
          "GET",
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setCatalog(data);
        if (!section)
          setDashboard(
            await request("dashboard", "GET", undefined, controller.signal),
          );
        else if (section === "settings")
          setDefaults(
            (await request("settings", "GET", undefined, controller.signal))
              .defaultLanguage,
          );
        else if (isEditor) {
          if (id === "new") {
            const firstWorld = data.worlds.find(
              (w: { status: string }) => w.status === "published",
            );
            setRecord({
              ...blank(),
              worldId: firstWorld?.id || "",
              position: firstWorld?.hubKey ? [0, 1, 0] : [-7, 0, -12],
            });
            setHistory([]);
            setInitialStatus("draft");
          } else {
            const data = await request(
              section + "/" + id,
              "GET",
              undefined,
              controller.signal,
            );
            if (controller.signal.aborted) return;
            setRecord({ ...blank(), ...data.item });
            setInitialStatus(data.item.status);
            setHistory(data.history);
          }
        } else if (section === "worlds" || section === "discoveries") {
          const data = await request(
            section +
              "?" +
              new URLSearchParams({
                page: String(page),
                search,
                status: filter,
              }),
            "GET",
            undefined,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setItems(data.items);
          setTotal(data.total);
          setPages(data.totalPages);
          setPage(data.page);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [session?.csrf, section, id, page, search, filter, refresh]);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setRefresh((v) => v + 1);
      window.dispatchEvent(new Event("beyond:content-changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent) {
    e.preventDefault();
    await action(async () => {
      await request("login", "POST", { email, password });
      setPassword("");
      const data = await request("session");
      setSession(data);
      navigate("/admin", { replace: true });
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (
      record.status === "archived" &&
      initialStatus !== "archived" &&
      !confirm(
        "Archive this record? Its history will be retained and it will be hidden from public exploration.",
      )
    )
      return;
    await action(async () => {
      const data = await request(
        section + (id === "new" ? "" : "/" + id),
        id === "new" ? "POST" : "PUT",
        record,
      );
      setRecord({ ...blank(), ...data.item });
      setNotice("Changes saved.");
      if (id === "new") navigate("/admin/" + section + "/" + data.item.id);
    });
  }
  const update = (key: keyof RecordData, value: unknown) =>
    setRecord((r) => ({ ...r, [key]: value }));
  function localized(
    key: "name" | "description" | "title" | "summary",
    label: string,
  ) {
    return (
      <div className="admin-field-pair">
        <label>
          {label} (English)
          <input
            required={key === "name" || key === "title"}
            value={record[key].en}
            onChange={(e) =>
              update(key, { ...record[key], en: e.target.value })
            }
          />
        </label>
        <label>
          {label} (Spanish, optional)
          <input
            value={record[key].es}
            onChange={(e) =>
              update(key, { ...record[key], es: e.target.value })
            }
          />
        </label>
      </div>
    );
  }
  function bodyField(lang: "en" | "es") {
    return (
      <label>
        Main content ({lang === "en" ? "English" : "Spanish, optional"})
        <textarea
          rows={7}
          value={record.body.map((p) => p[lang]).join("\n\n")}
          onChange={(e) => {
            const paragraphs = e.target.value.split(/\n\s*\n/);
            update(
              "body",
              Array.from(
                { length: Math.max(paragraphs.length, record.body.length) },
                (_, i) => ({
                  ...(record.body[i] || { en: "", es: "" }),
                  [lang]: paragraphs[i] || "",
                }),
              ),
            );
          }}
        />
      </label>
    );
  }
  const title = section
    ? navigation.find(([key]) => key === section)?.[1] || "Workspace"
    : "Dashboard";
  if (boot)
    return (
      <main className="admin-loading" role="status">
        Opening private workspace…
      </main>
    );
  if (isLogin || !session)
    return (
      <main className="admin-login cosmic-login">
        <div className="cosmic-login-art" aria-hidden="true" />
        <a className="cosmic-login-logo" href="/">
          <CosmicIcon kind="active" />
          <span>
            BEYOND<small>INFINITE COSMOS</small>
          </span>
        </a>
        <section>
          <span className="admin-brand">BEYOND</span>
          <p className="admin-eyebrow">PRIVATE ADMINISTRATION</p>
          <h1>
            A universe worth discovering.
            <br />
            Carefully made.
          </h1>
          <p>Create worlds, refine discoveries and connect meaningful ideas.</p>
          <a href="/">Return to BEYOND</a>
        </section>
        {setupState !== "ready" ? (
          <section className="admin-setup" aria-labelledby="admin-setup-title">
            <h2 id="admin-setup-title">
              {setupState === "initial_setup_required"
                ? "Set your first administrator password"
                : setupState === "configuration_required"
                  ? "Administrator email configuration required"
                  : setupState === "operator_review_required"
                    ? "Administrator configuration needs review"
                    : "Administrator status unavailable"}
            </h2>
            {setupState === "initial_setup_required" ? (
              <>
                <p>
                  No administrator account or password has been registered. You
                  choose the first password; there is no default password.
                </p>
                <ol>
                  <li>Open a terminal in the BEYOND project directory.</li>
                  <li>
                    Run <code>npm run admin:setup</code>.
                  </li>
                  <li>
                    Enter your new password twice at the hidden prompts (at
                    least 12 characters, at most 256 bytes).
                  </li>
                  <li>
                    Refresh this page, then sign in with your configured email
                    and chosen password.
                  </li>
                </ol>
                <p>
                  The command uses only ADMIN_ALLOWED_EMAIL from your server
                  environment. Never paste passwords into chat or put them in
                  commands.
                </p>
              </>
            ) : setupState === "configuration_required" ? (
              <p>
                Set one valid ADMIN_ALLOWED_EMAIL in the ignored .env.local file
                and restart the server. Registration and login are blocked until
                configured.
              </p>
            ) : setupState === "operator_review_required" ? (
              <p>
                Existing accounts were preserved. The server operator must check
                that the single configured email matches the existing
                administrator. Initial setup cannot replace an account.
              </p>
            ) : (
              <p>
                Check that the local server is running, then refresh. No
                registration or authentication bypass is available.
              </p>
            )}
            {error && (
              <p role="alert" className="admin-error">
                {error}
              </p>
            )}
            <button type="button" onClick={() => window.location.reload()}>
              Check setup again
            </button>
          </section>
        ) : (
          <form onSubmit={login}>
            <h2>Welcome Back</h2>
            <p className="cosmic-login-context">Administrator sign in</p>
            <p className="admin-muted">
              Authorized administrator only · No public registration
            </p>
            <label>
              Email address
              <div className="cosmic-input">
                <CosmicIcon kind="email" />
                <input
                  type="email"
                  required
                  placeholder="Your administrator email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>
            <label htmlFor="admin-password">Password</label>
            <div className="admin-password">
              <CosmicIcon kind="lock" />
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {error && (
              <p role="alert" className="admin-error">
                {error}
              </p>
            )}
            <button className="admin-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="admin-muted">
              First installation? The server operator must run the documented
              private setup command.
            </p>
            <details className="admin-recovery">
              <summary>Forgot your password?</summary>
              <p>
                If you know the current password, change it in System Settings.
                Email reset is not configured. If it is lost, ask the server
                operator for a separately authorized recovery procedure; do not
                delete the database or rerun initial setup to replace the
                account.
              </p>
            </details>
          </form>
        )}
      </main>
    );
  return (
    <main className={"admin-workspace" + (menuOpen ? " admin-menu-open" : "")}>
      <header className="fantasy-topbar">
        <a href="/" className="fantasy-brand">
          <svg
            aria-hidden="true"
            viewBox="0 0 40 40"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 35V15M20 25C5 25 5 8 5 8s16 1 15 17ZM20 20C20 6 35 4 35 4s2 16-15 16ZM20 33C25 22 36 22 36 22s-1 14-16 11Z" />
          </svg>
          {t("ui.beyond")} <small>{t("ui.admin")}</small>
        </a>
        <button
          className="fantasy-menu-toggle"
          aria-label={t("menu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {t("symbol.menu")}{" "}
        </button>
        <time>{adminDate(clock)}</time>
        <span className="fantasy-account">{session.email}</span>
      </header>
      <aside>
        <a className="admin-brand" href="/">
          {t("ui.beyond")}{" "}
        </a>
        <p className="admin-eyebrow">{t("ui.infinite.cosmos")}</p>
        <nav aria-label={t("ui.administrator.navigation")}>
          {navigation.map(([key, label]) => (
            <button
              key={key}
              aria-label={label}
              aria-current={section === key ? "page" : undefined}
              onClick={() => {
                setMenuOpen(false);
                navigate("/admin" + (key ? "/" + key : ""));
              }}
            >
              <span className="cosmic-nav-icon">
                <AdminNavIcon section={key} />
              </span>
              {key === "settings" ? t("ui.settings") : label}
            </button>
          ))}
        </nav>
        <span className="admin-account">{session.email}</span>
        <button
          disabled={busy}
          onClick={() =>
            action(async () => {
              await request("logout", "POST", {});
              setSession(null);
              navigate("/admin/login", { replace: true });
            })
          }
        >
          {t("ui.sign.out")}{" "}
        </button>
      </aside>
      <section className="admin-main">
        <div className="cosmic-topbar">
          <span>{t("ui.private.administration")}</span>
          <time>{adminDate(clock)}</time>
          <span className="cosmic-avatar" aria-label={t("ui.administrator")}>
            {t("symbol.star")}{" "}
          </span>
        </div>
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">{t("ui.private.operations.beyond")}</p>
            <h1>
              {isEditor
                ? (id === "new" ? t("ui.create") : t("ui.edit")) +
                  (section === "worlds" ? "world" : "discovery")
                : title}
            </h1>
          </div>
          <a href="/">{t("ui.open.public.universe")}</a>
        </header>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            aria-label={t("ui.action.result")}
            className="admin-notice"
          >
            {notice}
          </p>
        )}
        {loading && <p role="status">{t("ui.loading.persisted.content")}</p>}
        {section === "images" && <ImageManagement request={request} category={id} />}
        {section === "characters" && <CentralCharacters request={request} />}
        {section === "characters" && (
          <h2 className="cosmic-secondary-heading">
            {t("ui.private.ai.asset.inventory.separate")}{" "}
          </h2>
        )}
        {(section === "users" || section === "characters") && (
          section === "users" ? <AdminMembers request={request}/> : <AdminInventory key={section} kind={section} request={request} />
        )}
        {section === "content" && (
          <section className="admin-panel">
            <h2>{t("ui.content.and.connections")}</h2>
            <p>
              {t(
                "ui.manage.real.sqlite.discoveries.and.their.explicit.connections.browser.ch",
              )}{" "}
            </p>
            <div className="admin-actions">
              <button onClick={() => navigate("/admin/discoveries")}>
                {t("ui.manage.discoveries")}{" "}
              </button>
              <button onClick={() => navigate("/admin/connections")}>
                {t("ui.manage.connections")}{" "}
              </button>
            </div>
            <p>
              {t("ui.server.discoveries")} {catalog.discoveries.length}
              {t("ui.server.connections")} {catalog.connections.length}
            </p>
          </section>
        )}
        {(!section || section === "analytics") && (
          <FantasyDashboard
            request={request}
            navigate={navigate}
            analytics={section === "analytics"}
          />
        )}
        {section === "activity" && <ActivityLog request={request} />}
        {!section && dashboard && (
          <div className="cosmic-editorial-shortcuts">
            <span>
              <span>{t("ui.published.discoveries")}</span>{" "}
              <strong>{dashboard.published}</strong>
            </span>
            <button onClick={() => navigate("/admin/discoveries/new")}>
              {t("ui.create.discovery")}{" "}
            </button>
            <button onClick={() => navigate("/admin/worlds")}>
              {t("ui.manage.worlds")}{" "}
            </button>
          </div>
        )}
        {(section === "worlds" || section === "discoveries") && !isEditor && (
          <>
            <div className="admin-toolbar">
              <label>
                {t("ui.search")}{" "}
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                {t("ui.status")}{" "}
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("ui.all.states")}</option>
                  {["draft", "review", "published", "archived"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button
                className="admin-primary"
                onClick={() => navigate("/admin/" + section + "/new")}
              >
                {t("ui.create.3")}{" "}
                {section === "worlds" ? "world" : "discovery"}
              </button>
            </div>
            <div className="admin-panel">
              <table>
                <thead>
                  <tr>
                    <th>{t("ui.title.name")}</th>
                    <th>{t("ui.status")}</th>
                    {section === "worlds" && (
                      <>
                        <th>{t("ui.owner")}</th>
                        <th>{t("ui.characters")}</th>
                        <th>{t("ui.created")}</th>
                      </>
                    )}
                    <th>{t("ui.last.updated")}</th>
                    <th>{t("ui.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td data-label={t("ui.title.name")}>
                        {r.title?.en || r.name?.en}
                        <small>
                          {t("separator.slash")}
                          {r.slug}
                        </small>
                      </td>
                      <td data-label={t("ui.status")}>
                        <span className={"admin-status " + r.status}>
                          {r.status}
                        </span>
                      </td>
                      {section === "worlds" && (
                        <>
                          <td data-label={t("ui.owner")}>
                            {t("ui.not.recorded")}
                          </td>
                          <td data-label={t("ui.characters")}>
                            {t("ui.not.centrally.stored")}
                          </td>
                          <td data-label={t("ui.created")}>
                            {r.createdAt
                              ? adminDate(r.createdAt)
                              : t("ui.unavailable")}
                          </td>
                        </>
                      )}
                      <td data-label={t("ui.updated")}>
                        {adminDate(r.updatedAt!)}
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            navigate("/admin/" + section + "/" + r.id)
                          }
                        >
                          {t("ui.edit.5")}{" "}
                        </button>
                        {section === "worlds" && r.id && (
                          <PermanentDelete
                            kind="world"
                            id={r.id}
                            name={r.name.en}
                            version={r.version!}
                            request={request}
                            onDeleted={() => {
                              setNotice(t("deleted"));
                              setRefresh((v) => v + 1);
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length && !loading && (
                <p>
                  {t(
                    "ui.no.matching.records.create.content.or.adjust.the.filters",
                  )}{" "}
                </p>
              )}
              <div className="admin-pagination">
                <span>
                  {t("ui.total")} {total}
                </span>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("ui.previous")}{" "}
                </button>
                <span>
                  {t("ui.page")} {page}
                  {t("ui.of")} {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("ui.next")}{" "}
                </button>
              </div>
            </div>
          </>
        )}
        {isEditor && !loading && (
          <form className="admin-editor" onSubmit={save}>
            <section className="admin-panel">
              <h2>
                {section === "worlds"
                  ? t("ui.world.identity")
                  : t("ui.discovery.content")}
              </h2>
              {section === "worlds" ? (
                <>
                  {localized("name", "Name")}
                  {localized("description", "Description")}
                </>
              ) : (
                <>
                  {localized("title", "Title")}
                  {localized("summary", "Contextual hint")}
                  {bodyField("en")}
                  {bodyField("es")}
                </>
              )}
              <div className="admin-field-pair">
                <label>
                  {t("ui.slug")}{" "}
                  <input
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={record.slug}
                    onChange={(e) => update("slug", e.target.value)}
                  />
                </label>
                <label>
                  {t("ui.publication.state")}{" "}
                  <select
                    value={record.status}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    {["draft", "review", "published", "archived"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="admin-muted">
                {t(
                  "ui.drafts.review.and.archived.content.are.private.publishing.requires.compl",
                )}{" "}
              </p>
              {section === "worlds" ? (
                <>
                  <div className="admin-field-pair">
                    <label>
                      {t("ui.presentation.theme")}{" "}
                      <select
                        value={record.theme}
                        onChange={(e) => update("theme", e.target.value)}
                      >
                        {["archive", "elsewhere", "unsolved", "natural"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      {t("ui.accent.color")}{" "}
                      <input
                        pattern="#[a-fA-F0-9]{6}"
                        value={record.color}
                        onChange={(e) => update("color", e.target.value)}
                      />
                    </label>
                    <label>
                      {t("ui.world.label")}{" "}
                      <input
                        maxLength={3}
                        value={record.symbol}
                        onChange={(e) => update("symbol", e.target.value)}
                      />
                    </label>
                    <label>
                      {t("ui.display.order")}{" "}
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={record.order}
                        onChange={(e) =>
                          update("order", Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  {record.hubKey && (
                    <section>
                      <h3>
                        {t("ui.hub.placement")} {record.hubKey}
                      </h3>
                      <p className="admin-muted">
                        {t(
                          "ui.walkable.plane.y.0.these.coordinates.position.this.destination.and.its.c",
                        )}{" "}
                      </p>
                      <div className="admin-coordinates">
                        {[0, 2].map((i) => (
                          <label key={i}>
                            {t("ui.hub")} {i === 0 ? t("ui.x") : t("ui.z")}
                            <input
                              type="number"
                              min={-60}
                              max={60}
                              value={record.hubPosition?.[i] || 0}
                              onChange={(e) =>
                                update(
                                  "hubPosition",
                                  (record.hubPosition || [0, 0, 0]).map(
                                    (v, j) =>
                                      i === j ? Number(e.target.value) : v,
                                  ),
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </section>
                  )}
                  {record.id && (
                    <section>
                      <h3>{t("ui.associated.discoveries")}</h3>
                      {catalog.discoveries
                        .filter((d) => d.worldId === record.id)
                        .map((d) => (
                          <button
                            type="button"
                            className="admin-related"
                            key={d.id}
                            onClick={() =>
                              navigate("/admin/discoveries/" + d.id)
                            }
                          >
                            {d.title.en}
                            {t("separator.dot")} {d.status}
                          </button>
                        ))}
                      {!catalog.discoveries.some(
                        (d) => d.worldId === record.id,
                      ) && <p>{t("ui.no.associated.discoveries")}</p>}
                    </section>
                  )}
                </>
              ) : (
                <>
                  <div className="admin-field-pair">
                    <label>
                      {t("ui.world")}{" "}
                      <select
                        required
                        aria-label={t("ui.world")}
                        value={record.worldId}
                        onChange={(e) => {
                          const worldId = e.target.value;
                          setRecord((r) => ({
                            ...r,
                            worldId,
                            position: catalog.worlds.find(
                              (w) => w.id === worldId,
                            )?.hubKey
                              ? [0, 1, 0]
                              : r.position,
                          }));
                        }}
                      >
                        {catalog.worlds.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name.en}
                            {t("separator.open")}
                            {w.status}
                            {t("separator.close")}{" "}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("ui.content.type")}{" "}
                      <select
                        value={record.contentType}
                        onChange={(e) => update("contentType", e.target.value)}
                      >
                        <option value="article">{t("ui.article")}</option>
                        <option value="question">{t("ui.question")}</option>
                      </select>
                    </label>
                  </div>
                  <h3>{t("ui.world.placement")}</h3>
                  <p className="admin-muted">
                    {t(
                      "ui.coordinates.configure.actual.discovery.landmarks.hub.worlds.use.local.x.",
                    )}{" "}
                  </p>
                  <div className="admin-coordinates">
                    {["X", "Y", "Z"].map((axis, i) => (
                      <label key={axis}>
                        {axis}
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          step="0.1"
                          value={record.position[i]}
                          onChange={(e) =>
                            update(
                              "position",
                              record.position.map((v, j) =>
                                j === i ? Number(e.target.value) : v,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    {t("ui.image.reference.https.or.local.path.optional")}{" "}
                    <input
                      value={record.media}
                      onChange={(e) => update("media", e.target.value)}
                    />
                  </label>
                </>
              )}
            </section>
            {section === "discoveries" && (
              <>
                <section className="admin-panel">
                  <h2>{t("ui.sources.and.review")}</h2>
                  <div className="admin-field-pair">
                    <label>
                      {t("ui.claim.classification")}{" "}
                      <select
                        value={record.truthType}
                        onChange={(e) => update("truthType", e.target.value)}
                      >
                        <option value="factual">{t("ui.factual")}</option>
                        <option value="hypothesis">{t("ui.hypothesis")}</option>
                        <option value="fictional">
                          {t("ui.fictional.scenario")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {t("ui.content.verification")}{" "}
                      <select
                        value={record.verificationStatus}
                        onChange={(e) =>
                          update("verificationStatus", e.target.value)
                        }
                      >
                        <option value="needs_review">
                          {t("ui.requires.review")}
                        </option>
                        <option value="verified">
                          {t("ui.verified.by.authorized.editor")}{" "}
                        </option>
                        <option value="hypothetical">
                          {t("ui.hypothetical.not.established.fact")}{" "}
                        </option>
                        <option value="rejected">{t("ui.rejected")}</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    {t("ui.uncertainty.or.scenario.notes")}{" "}
                    <textarea
                      value={record.uncertainty}
                      onChange={(e) => update("uncertainty", e.target.value)}
                    />
                  </label>
                  <p className="admin-muted">
                    {t(
                      "ui.only.authorized.editorial.actions.can.change.verification.entering.a.url",
                    )}{" "}
                  </p>
                  {record.sources.map((source, i) => (
                    <div className="admin-source" key={i}>
                      <label>
                        {t("ui.source.url")}{" "}
                        <input
                          type="url"
                          required
                          value={source.url}
                          onChange={(e) =>
                            update(
                              "sources",
                              record.sources.map((s, j) =>
                                j === i ? { ...s, url: e.target.value } : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        {t("ui.source.description")}{" "}
                        <input
                          required
                          value={source.description}
                          onChange={(e) =>
                            update(
                              "sources",
                              record.sources.map((s, j) =>
                                j === i
                                  ? { ...s, description: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        {t("ui.editorial.verification")}{" "}
                        <select
                          value={source.verification}
                          onChange={(e) =>
                            update(
                              "sources",
                              record.sources.map((s, j) =>
                                j === i
                                  ? { ...s, verification: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        >
                          <option value="unverified">
                            {t("ui.unverified")}
                          </option>
                          <option value="verified">
                            {t("ui.manually.reviewed.by.editor")}{" "}
                          </option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            "sources",
                            record.sources.filter((_, j) => j !== i),
                          )
                        }
                      >
                        {t("ui.remove.source")}{" "}
                      </button>
                    </div>
                  ))}
                  {!record.sources.length && (
                    <p>
                      {t(
                        "ui.no.sources.publication.is.blocked.until.described.sources.are.added",
                      )}{" "}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      update("sources", [
                        ...record.sources,
                        {
                          url: "",
                          description: "",
                          verification: "unverified",
                        },
                      ])
                    }
                  >
                    {t("ui.add.source")}{" "}
                  </button>
                </section>
                <section className="admin-panel">
                  <h2>{t("ui.evidence.interpretation.and.open.questions")}</h2>
                  {(["evidence", "interpretation", "questions"] as const).map(
                    (key) => (
                      <label key={key}>
                        {key}
                        <textarea
                          rows={3}
                          value={record[key]}
                          onChange={(e) => update(key, e.target.value)}
                        />
                      </label>
                    ),
                  )}
                </section>
                {record.id && (
                  <section className="admin-panel">
                    <h2>{t("ui.incoming.and.outgoing.connections")}</h2>
                    {catalog.connections
                      .filter(
                        (c) => c.from_id === record.id || c.to_id === record.id,
                      )
                      .map((c) => (
                        <p key={c.id}>
                          {
                            catalog.discoveries.find((d) => d.id === c.from_id)
                              ?.title.en
                          }{" "}
                          {t("symbol.arrow")}{" "}
                          {
                            catalog.discoveries.find((d) => d.id === c.to_id)
                              ?.title.en
                          }
                          {t("separator.colon")} {c.explanation}
                        </p>
                      ))}
                    <button
                      type="button"
                      onClick={() => navigate("/admin/connections")}
                    >
                      {t("ui.manage.connections")}{" "}
                    </button>
                  </section>
                )}
              </>
            )}
            <div className="admin-actions">
              <button className="admin-primary" disabled={busy}>
                {busy ? t("ui.saving") : t("ui.save.changes")}
              </button>
              {section === "discoveries" && (
                <button type="button" onClick={() => setPreview(true)}>
                  {t("ui.preview")}{" "}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/admin/" + section)}
              >
                {t("ui.back.to.list")}{" "}
              </button>
            </div>
            <section className="admin-panel">
              <h2>{t("ui.preserved.revision.history")}</h2>
              {history.length ? (
                history.map((h) => (
                  <p key={h.id}>
                    {t("ui.revision")} {h.id}
                    {t("separator.dot")} {adminDate(h.created_at)}
                  </p>
                ))
              ) : (
                <p>{t("ui.no.earlier.revisions")}</p>
              )}
            </section>
          </form>
        )}
        {section === "connections" && (
          <>
            <form
              className="admin-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await request(
                    "connections" + (connection.id ? "/" + connection.id : ""),
                    connection.id ? t("ui.put") : t("ui.post"),
                    connection,
                  );
                  setConnection({
                    id: "",
                    fromId: "",
                    toId: "",
                    explanation: "",
                  });
                  setNotice(t("ui.connection.saved"));
                });
              }}
            >
              <h2>
                {connection.id
                  ? t("ui.edit.connection")
                  : t("ui.connect.meaningful.discoveries")}
              </h2>
              <div className="admin-field-pair">
                {(["fromId", "toId"] as const).map((key) => (
                  <label key={key}>
                    {key === "fromId"
                      ? t("ui.from.discovery")
                      : t("ui.to.discovery")}
                    <select
                      required
                      disabled={!!connection.id}
                      value={connection[key]}
                      onChange={(e) =>
                        setConnection((c) => ({ ...c, [key]: e.target.value }))
                      }
                    >
                      <option value="">{t("ui.choose.a.discovery")}</option>
                      {catalog.discoveries
                        .filter((d) => d.status !== "archived")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title.en}
                            {t("separator.open")}
                            {d.status}
                            {t("separator.close")}{" "}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              <label>
                {t("ui.why.are.these.discoveries.related")}{" "}
                <textarea
                  required
                  maxLength={1000}
                  value={connection.explanation}
                  onChange={(e) =>
                    setConnection((c) => ({
                      ...c,
                      explanation: e.target.value,
                    }))
                  }
                />
              </label>
              <button className="admin-primary" disabled={busy}>
                {t("ui.save.connection")}{" "}
              </button>
              {connection.id && (
                <button
                  type="button"
                  onClick={() =>
                    setConnection({
                      id: "",
                      fromId: "",
                      toId: "",
                      explanation: "",
                    })
                  }
                >
                  {t("ui.cancel.edit")}{" "}
                </button>
              )}
            </form>
            <section className="admin-panel">
              <h2>{t("ui.connections")}</h2>
              {catalog.connections.map((c) => (
                <article className="admin-link" key={c.id}>
                  <strong>
                    {
                      catalog.discoveries.find((d) => d.id === c.from_id)?.title
                        .en
                    }{" "}
                    {t("symbol.arrow")}{" "}
                    {
                      catalog.discoveries.find((d) => d.id === c.to_id)?.title
                        .en
                    }
                  </strong>
                  <p>{c.explanation}</p>
                  <button
                    onClick={() =>
                      setConnection({
                        id: c.id,
                        fromId: c.from_id,
                        toId: c.to_id,
                        explanation: c.explanation,
                      })
                    }
                  >
                    {t("ui.edit.explanation")}{" "}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "ui.remove.this.connection.its.earlier.value.remains.in.revision.history",
                          ),
                        )
                      )
                        void action(async () => {
                          await request("connections/" + c.id, "DELETE", {});
                          setNotice(t("ui.connection.removed"));
                        });
                    }}
                  >
                    {t("ui.remove")}{" "}
                  </button>
                </article>
              ))}
              {!catalog.connections.length && (
                <p>
                  {t(
                    "ui.no.connections.yet.explain.a.meaningful.relationship.to.create.one",
                  )}{" "}
                </p>
              )}
            </section>
          </>
        )}
        {section === "settings" && (
          <>
            <SystemStatus request={request} />
            <PendingDeletions request={request} />
            <section className="admin-panel">
              <h2>{t("ui.administrator.account")}</h2>
              <p>{session.email}</p>
              <p className="admin-muted">
                {t("ui.session.expires")}{" "}
                {adminDate(new Date(session.expiresAt))}
                {t("ui.no.public.account.registration")}{" "}
              </p>
            </section>
            <form
              className="admin-panel"
              onSubmit={(e) => {
                e.preventDefault();
                if (newPassword !== confirmPassword) {
                  setError(t("ui.new.passwords.do.not.match"));
                  return;
                }
                void action(async () => {
                  await request("password", "POST", {
                    currentPassword,
                    newPassword,
                  });
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setSession(await request("session"));
                  setNotice(
                    t("ui.password.changed.other.sessions.have.been.revoked"),
                  );
                });
              }}
            >
              <h2>{t("ui.change.password")}</h2>
              <label>
                {t("ui.current.password")}{" "}
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label>
                {t("ui.new.password")}{" "}
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label>
                {t("ui.confirm.new.password")}{" "}
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <button disabled={busy} className="admin-primary">
                {t("ui.change.password")}{" "}
              </button>
            </form>
            <form
              className="admin-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await request("settings", "PUT", {
                    defaultLanguage: defaults,
                  });
                  setNotice(t("ui.application.defaults.saved"));
                });
              }}
            >
              <h2>{t("ui.application.defaults")}</h2>
              <label>
                {t("ui.default.language.for.new.visitors")}{" "}
                <select
                  value={defaults}
                  disabled={loading || busy}
                  onChange={(e) => setDefaults(e.target.value)}
                >
                  <option value="en">{t("ui.english")}</option>
                  <option value="es">{t("ui.spanish")}</option>
                </select>
              </label>
              <button disabled={busy || loading}>
                {t("ui.save.defaults")}
              </button>
            </form>
          </>
        )}
        {preview && (
          <Overlay
            title={t("ui.private.editorial.preview")}
            closeLabel="Close preview"
            onClose={() => setPreview(false)}
          >
            <article className="admin-preview">
              <p>
                {t("ui.unpublished.preview")} {record.status}
              </p>
              <h1>{record.title.en}</h1>
              <p>{record.summary.en}</p>
              {record.body.map((p, i) => (
                <p key={i}>{p.en}</p>
              ))}
              <h2>{t("ui.evidence")}</h2>
              <p>{record.evidence}</p>
              <h2>{t("ui.interpretation")}</h2>
              <p>{record.interpretation}</p>
              <h2>{t("ui.open.questions")}</h2>
              <p>{record.questions}</p>
              <p>
                {t("ui.sources.entered")} {record.sources.length}
                {t("ui.entry.does.not.establish.verification")}{" "}
              </p>
            </article>
          </Overlay>
        )}
        <footer className="fantasy-footer">
          <span>{t("ui.beyond.admin.v1.0.0")}</span>
          <span>
            {t("symbol.copyright")} {new Date().getFullYear()}
            {t("ui.beyond.12")} {t("footer")}
          </span>
        </footer>
      </section>
    </main>
  );
}
