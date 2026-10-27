import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Overlay } from "../components/Overlay";
import "./admin.css";
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
  ["", "Overview"],
  ["worlds", "Worlds"],
  ["discoveries", "Discoveries"],
  ["connections", "Connections"],
  ["settings", "Settings"],
];
export default function AdminApp() {
  const location = useLocation(),
    navigate = useNavigate();
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
        signal,
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
      const data = await res.json();
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
    fetch("/api/admin/session", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (res.ok) {
          setSession(await res.json());
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
    setPage(1);
    setSearch("");
    setFilter("");
    setError("");
  }, [section]);
  useEffect(() => {
    if (!session || isLogin) return;
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
    : "Overview";
  if (boot)
    return (
      <main className="admin-loading" role="status">
        Opening private workspace…
      </main>
    );
  if (isLogin || !session)
    return (
      <main className="admin-login">
        <section>
          <span className="admin-brand">BEYOND</span>
          <p className="admin-eyebrow">PRIVATE EDITORIAL WORKSPACE</p>
          <h1>
            A universe worth discovering.
            <br />
            Carefully made.
          </h1>
          <p>Create worlds, refine discoveries and connect meaningful ideas.</p>
          <a href="/">Return to BEYOND</a>
        </section>
        <form onSubmit={login}>
          <h2>Administrator sign in</h2>
          <p>No public administrator registration.</p>
          <label>
            Email address
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor="admin-password">Password</label>
          <div className="admin-password">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              required
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
        </form>
      </main>
    );
  return (
    <main className="admin-workspace">
      <aside>
        <a className="admin-brand" href="/">
          BEYOND
        </a>
        <p className="admin-eyebrow">EDITORIAL WORKSPACE</p>
        <nav aria-label="Administrator navigation">
          {navigation.map(([key, label]) => (
            <button
              key={key}
              aria-current={section === key ? "page" : undefined}
              onClick={() => navigate("/admin" + (key ? "/" + key : ""))}
            >
              {label}
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
          Sign out
        </button>
      </aside>
      <section className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">PRIVATE OPERATIONS / BEYOND</p>
            <h1>
              {isEditor
                ? (id === "new" ? "Create " : "Edit ") +
                  (section === "worlds" ? "world" : "discovery")
                : title}
            </h1>
          </div>
          <a href="/">Open public universe ↗</a>
        </header>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" aria-label="Action result" className="admin-notice">
            {notice}
          </p>
        )}
        {loading && <p role="status">Loading persisted content…</p>}
        {!section && dashboard && (
          <>
            <div className="admin-stats">
              {[
                ["Worlds", dashboard.worlds],
                ["Total discoveries", dashboard.totalDiscoveries],
                ["Needs verification", dashboard.needsReview],
                ["Published discoveries", dashboard.published],
                ["Drafts", dashboard.drafts],
                ["Under review", dashboard.review],
              ].map(([label, value]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <div className="admin-actions">
              <button
                className="admin-primary"
                onClick={() => navigate("/admin/discoveries/new")}
              >
                Create discovery
              </button>
              <button onClick={() => navigate("/admin/worlds")}>
                Manage worlds
              </button>
            </div>
            <section className="admin-panel">
              <h2>Recently edited</h2>
              {dashboard.recent.length ? (
                dashboard.recent.map((r) => (
                  <button
                    className="admin-recent"
                    key={r.kind + r.id}
                    onClick={() =>
                      navigate(
                        "/admin/" +
                          (r.kind === "world" ? "worlds" : "discoveries") +
                          "/" +
                          r.id,
                      )
                    }
                  >
                    <span>{r.title?.en || r.name?.en}</span>
                    <span className={"admin-status " + r.status}>
                      {r.status}
                    </span>
                    <time>{new Date(r.updatedAt!).toLocaleString()}</time>
                  </button>
                ))
              ) : (
                <p>No content has been created yet.</p>
              )}
            </section>
          </>
        )}
        {(section === "worlds" || section === "discoveries") && !isEditor && (
          <>
            <div className="admin-toolbar">
              <label>
                Search
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
                Status
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All states</option>
                  {["draft", "review", "published", "archived"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button
                className="admin-primary"
                onClick={() => navigate("/admin/" + section + "/new")}
              >
                Create {section === "worlds" ? "world" : "discovery"}
              </button>
            </div>
            <div className="admin-panel">
              <table>
                <thead>
                  <tr>
                    <th>Title / name</th>
                    <th>Status</th>
                    <th>Last updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Title / name">
                        {r.title?.en || r.name?.en}
                        <small>/{r.slug}</small>
                      </td>
                      <td data-label="Status">
                        <span className={"admin-status " + r.status}>
                          {r.status}
                        </span>
                      </td>
                      <td data-label="Updated">
                        {new Date(r.updatedAt!).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            navigate("/admin/" + section + "/" + r.id)
                          }
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length && !loading && (
                <p>
                  No matching records. Create content or adjust the filters.
                </p>
              )}
              <div className="admin-pagination">
                <span>Total {total}</span>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
        {isEditor && !loading && (
          <form className="admin-editor" onSubmit={save}>
            <section className="admin-panel">
              <h2>
                {section === "worlds" ? "World identity" : "Discovery content"}
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
                  Slug
                  <input
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={record.slug}
                    onChange={(e) => update("slug", e.target.value)}
                  />
                </label>
                <label>
                  Publication state
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
                Drafts, review and archived content are private. Publishing
                requires complete content and sources. Source URLs are not
                automatically verified.
              </p>
              {section === "worlds" ? (
                <>
                  <div className="admin-field-pair">
                    <label>
                      Presentation theme
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
                      Accent color
                      <input
                        pattern="#[a-fA-F0-9]{6}"
                        value={record.color}
                        onChange={(e) => update("color", e.target.value)}
                      />
                    </label>
                    <label>
                      World label
                      <input
                        maxLength={3}
                        value={record.symbol}
                        onChange={(e) => update("symbol", e.target.value)}
                      />
                    </label>
                    <label>
                      Display order
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
                      <h3>Hub placement · {record.hubKey}</h3>
                      <p className="admin-muted">
                        Walkable plane Y=0. These coordinates position this
                        destination and its connecting path in the actual
                        six-world hub.
                      </p>
                      <div className="admin-coordinates">
                        {[0, 2].map((i) => (
                          <label key={i}>
                            Hub {i === 0 ? "X" : "Z"}
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
                      <h3>Associated discoveries</h3>
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
                            {d.title.en} · {d.status}
                          </button>
                        ))}
                      {!catalog.discoveries.some(
                        (d) => d.worldId === record.id,
                      ) && <p>No associated discoveries.</p>}
                    </section>
                  )}
                </>
              ) : (
                <>
                  <div className="admin-field-pair">
                    <label>
                      World
                      <select
                        required
                        aria-label="World"
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
                            {w.name.en} ({w.status})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Content type
                      <select
                        value={record.contentType}
                        onChange={(e) => update("contentType", e.target.value)}
                      >
                        <option value="article">article</option>
                        <option value="question">question</option>
                      </select>
                    </label>
                  </div>
                  <h3>World placement</h3>
                  <p className="admin-muted">
                    Coordinates configure actual discovery landmarks. Hub worlds
                    use local X/Z within ±4 and Y within 0–6; legacy worlds
                    retain their original coordinates. Existing movement and
                    portals are preserved.
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
                    Image reference (HTTPS or local path, optional)
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
                  <h2>Sources and review</h2>
                  <div className="admin-field-pair">
                    <label>
                      Claim classification
                      <select
                        value={record.truthType}
                        onChange={(e) => update("truthType", e.target.value)}
                      >
                        <option value="factual">Factual</option>
                        <option value="hypothesis">Hypothesis</option>
                        <option value="fictional">Fictional scenario</option>
                      </select>
                    </label>
                    <label>
                      Content verification
                      <select
                        value={record.verificationStatus}
                        onChange={(e) =>
                          update("verificationStatus", e.target.value)
                        }
                      >
                        <option value="needs_review">Requires review</option>
                        <option value="verified">
                          Verified by authorized editor
                        </option>
                        <option value="hypothetical">
                          Hypothetical — not established fact
                        </option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Uncertainty or scenario notes
                    <textarea
                      value={record.uncertainty}
                      onChange={(e) => update("uncertainty", e.target.value)}
                    />
                  </label>
                  <p className="admin-muted">
                    Only authorized editorial actions can change verification.
                    Entering a URL does not verify a claim. New factual content
                    needs verification before publication.
                  </p>
                  {record.sources.map((source, i) => (
                    <div className="admin-source" key={i}>
                      <label>
                        Source URL
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
                        Source description
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
                        Editorial verification
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
                          <option value="unverified">Unverified</option>
                          <option value="verified">
                            Manually reviewed by editor
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
                        Remove source
                      </button>
                    </div>
                  ))}
                  {!record.sources.length && (
                    <p>
                      No sources. Publication is blocked until described sources
                      are added.
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
                    Add source
                  </button>
                </section>
                <section className="admin-panel">
                  <h2>Evidence, interpretation and open questions</h2>
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
                    <h2>Incoming and outgoing connections</h2>
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
                          →{" "}
                          {
                            catalog.discoveries.find((d) => d.id === c.to_id)
                              ?.title.en
                          }
                          : {c.explanation}
                        </p>
                      ))}
                    <button
                      type="button"
                      onClick={() => navigate("/admin/connections")}
                    >
                      Manage connections
                    </button>
                  </section>
                )}
              </>
            )}
            <div className="admin-actions">
              <button className="admin-primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              {section === "discoveries" && (
                <button type="button" onClick={() => setPreview(true)}>
                  Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/admin/" + section)}
              >
                Back to list
              </button>
            </div>
            <section className="admin-panel">
              <h2>Preserved revision history</h2>
              {history.length ? (
                history.map((h) => (
                  <p key={h.id}>
                    Revision {h.id} · {new Date(h.created_at).toLocaleString()}
                  </p>
                ))
              ) : (
                <p>No earlier revisions.</p>
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
                    connection.id ? "PUT" : "POST",
                    connection,
                  );
                  setConnection({
                    id: "",
                    fromId: "",
                    toId: "",
                    explanation: "",
                  });
                  setNotice("Connection saved.");
                });
              }}
            >
              <h2>
                {connection.id
                  ? "Edit connection"
                  : "Connect meaningful discoveries"}
              </h2>
              <div className="admin-field-pair">
                {(["fromId", "toId"] as const).map((key) => (
                  <label key={key}>
                    {key === "fromId" ? "From discovery" : "To discovery"}
                    <select
                      required
                      disabled={!!connection.id}
                      value={connection[key]}
                      onChange={(e) =>
                        setConnection((c) => ({ ...c, [key]: e.target.value }))
                      }
                    >
                      <option value="">Choose a discovery</option>
                      {catalog.discoveries
                        .filter((d) => d.status !== "archived")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title.en} ({d.status})
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              <label>
                Why are these discoveries related?
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
                Save connection
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
                  Cancel edit
                </button>
              )}
            </form>
            <section className="admin-panel">
              <h2>Connections</h2>
              {catalog.connections.map((c) => (
                <article className="admin-link" key={c.id}>
                  <strong>
                    {
                      catalog.discoveries.find((d) => d.id === c.from_id)?.title
                        .en
                    }{" "}
                    →{" "}
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
                    Edit explanation
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Remove this connection? Its earlier value remains in revision history.",
                        )
                      )
                        void action(async () => {
                          await request("connections/" + c.id, "DELETE", {});
                          setNotice("Connection removed.");
                        });
                    }}
                  >
                    Remove
                  </button>
                </article>
              ))}
              {!catalog.connections.length && (
                <p>
                  No connections yet. Explain a meaningful relationship to
                  create one.
                </p>
              )}
            </section>
          </>
        )}
        {section === "settings" && (
          <>
            <section className="admin-panel">
              <h2>Administrator account</h2>
              <p>{session.email}</p>
              <p className="admin-muted">
                Session expires {new Date(session.expiresAt).toLocaleString()}.
                No public account registration.
              </p>
            </section>
            <form
              className="admin-panel"
              onSubmit={(e) => {
                e.preventDefault();
                if (newPassword !== confirmPassword) {
                  setError("New passwords do not match.");
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
                    "Password changed. Other sessions have been revoked.",
                  );
                });
              }}
            >
              <h2>Change password</h2>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label>
                New password
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
                Confirm new password
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
                Change password
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
                  setNotice("Application defaults saved.");
                });
              }}
            >
              <h2>Application defaults</h2>
              <label>
                Default language for new visitors
                <select
                  value={defaults}
                  onChange={(e) => setDefaults(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                </select>
              </label>
              <button disabled={busy}>Save defaults</button>
            </form>
          </>
        )}
        {preview && (
          <Overlay
            title="Private editorial preview"
            closeLabel="Close preview"
            onClose={() => setPreview(false)}
          >
            <article className="admin-preview">
              <p>UNPUBLISHED PREVIEW · {record.status}</p>
              <h1>{record.title.en}</h1>
              <p>{record.summary.en}</p>
              {record.body.map((p, i) => (
                <p key={i}>{p.en}</p>
              ))}
              <h2>Evidence</h2>
              <p>{record.evidence}</p>
              <h2>Interpretation</h2>
              <p>{record.interpretation}</p>
              <h2>Open questions</h2>
              <p>{record.questions}</p>
              <p>
                Sources entered: {record.sources.length}. Entry does not
                establish verification.
              </p>
            </article>
          </Overlay>
        )}
      </section>
    </main>
  );
}
