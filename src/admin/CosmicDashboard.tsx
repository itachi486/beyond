import { t, adminDate } from "./i18n";
import { useEffect, useState } from "react";
import type { AdminRequest } from "./AdminInventory";
type World = {
  id: string;
  name: { en: string };
  status: string;
  hubKey?: string;
  hubPosition?: number[];
};
type Activity = { id: string; action: string; name: string; createdAt: string };
type Snapshot = {
  totals: {
    worlds: number;
    characters: number;
    connections: number;
    activeUsers: number;
  };
  scope: string;
  worlds: World[];
  edges: { source: string; target: string }[];
  distribution: { type: string; count: number }[];
  activity: Activity[];
};
export function CosmicIcon({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {kind === "email" ? (
        <>
          <rect x="3" y="6" width="26" height="20" rx="3" />
          <path d="m4 8 12 10L28 8" />
        </>
      ) : kind === "lock" ? (
        <>
          <rect x="7" y="14" width="18" height="15" rx="2" />
          <path d="M11 14V8a5 5 0 0 1 10 0v6M16 20v4" />
        </>
      ) : kind === "worlds" ? (
        <>
          <circle cx="16" cy="16" r="9" />
          <ellipse
            cx="16"
            cy="16"
            rx="15"
            ry="5"
            transform="rotate(-30 16 16)"
          />
        </>
      ) : kind === "characters" ? (
        <>
          <circle cx="16" cy="10" r="5" />
          <path d="M7 29v-5a9 9 0 0 1 18 0v5M11 22v7m10-7v7" />
        </>
      ) : kind === "connections" ? (
        <>
          <circle cx="7" cy="24" r="4" />
          <circle cx="25" cy="24" r="4" />
          <circle cx="16" cy="6" r="4" />
          <path d="m14 10-5 10m9-10 5 10M11 24h10" />
        </>
      ) : (
        <path d="m16 1 3 11 12 4-12 4-3 11-4-11-11-4 11-4Z" />
      )}
    </svg>
  );
}
export default function CosmicDashboard({
  request,
  navigate,
  analytics = false,
}: {
  request: AdminRequest;
  navigate: (path: string) => void;
  analytics?: boolean;
}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request("cosmic-overview", "GET", undefined, controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [request]);
  if (error)
    return (
      <p role="alert" className="admin-error">
        {error}
      </p>
    );
  if (!data) return <p role="status">Loading your persisted universe…</p>;
  const palette = ["#a77bff", "#54c3ff", "#62e2d1", "#eac882", "#e990e7"];
  const coords = new Map(
    data.worlds.map((w, i) => {
      const angle = (i / data.worlds.length) * Math.PI * 2;
      return [
        w.id,
        { x: 450 + Math.cos(angle) * 335, y: 140 + Math.sin(angle) * 93 },
      ];
    }),
  );
  const sum = data.distribution.reduce((s, x) => s + x.count, 0);
  let cumulative = 0;
  const stops = data.distribution.map((d, i) => {
    const start = cumulative;
    cumulative += (d.count / Math.max(sum, 1)) * 100;
    return `${palette[i % palette.length]} ${start}% ${cumulative}%`;
  });
  return (
    <div className="cosmic-dashboard">
      <p className="cosmic-greeting">
        {analytics
          ? "Your universe, measured honestly."
          : "Welcome back, Administrator"}
      </p>
      <p className="admin-muted">{data.scope}</p>
      <div className="cosmic-dashboard-grid">
        <div className="cosmic-main-column">
          <div className="cosmic-metrics">
            {(
              [
                ["Total Worlds", data.totals.worlds, "worlds"],
                ["Total Characters", data.totals.characters, "characters"],
                ["Total Connections", data.totals.connections, "connections"],
                ["Active Users", data.totals.activeUsers, "active"],
              ] as const
            ).map(([label, value, key]) => (
              <article
                className={"cosmic-panel cosmic-metric " + key}
                key={key}
              >
                <span className="cosmic-icon">
                  <CosmicIcon kind={key} />
                </span>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>
                    {key === "characters"
                      ? "Central originals only"
                      : key === "active"
                        ? "Active administrator accounts"
                        : key === "connections"
                          ? "Editorial connections"
                          : "Server editorial worlds"}
                  </small>
                </div>
              </article>
            ))}
          </div>
          <section className="cosmic-panel cosmic-world-overview">
            <div className="cosmic-section-heading">
              <h2>World Overview</h2>
              <button onClick={() => navigate("/admin/worlds")}>
                View All →
              </button>
            </div>
            <svg
              viewBox="0 0 900 285"
              role="img"
              aria-label="Persisted editorial worlds and connections"
            >
              <defs>
                <radialGradient id="cosmic-node">
                  <stop stopColor="#f3e4ff" />
                  <stop offset=".35" stopColor="#a18aff" />
                  <stop offset="1" stopColor="#456ac633" />
                </radialGradient>
              </defs>
              {data.edges.map((e, i) => {
                const a = coords.get(e.source),
                  b = coords.get(e.target);
                return a && b ? (
                  <path
                    key={i}
                    d={`M${a.x},${a.y} Q450,25 ${b.x},${b.y}`}
                    fill="none"
                    stroke="#65ddf688"
                  />
                ) : null;
              })}
              {data.worlds.map((w) => {
                const p = coords.get(w.id)!;
                return (
                  <g
                    key={w.id}
                    role="link"
                    tabIndex={0}
                    aria-label={"Edit " + w.name.en}
                    onClick={() => navigate("/admin/worlds/" + w.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate("/admin/worlds/" + w.id);
                    }}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={w.hubKey ? 23 : 15}
                      fill="url(#cosmic-node)"
                    />
                    <circle cx={p.x} cy={p.y} r="6" fill="#e1eaff" />
                    <text
                      x={p.x}
                      y={p.y + 35}
                      textAnchor="middle"
                      fill="#dbe8ff"
                      fontSize="10"
                    >
                      {w.name.en.slice(0, 23)}
                    </text>
                    <title>
                      {w.name.en} · {w.status}
                    </title>
                  </g>
                );
              })}
            </svg>
            <small>
              Abstract editorial layout · Lines represent persisted inter-world
              connections
            </small>
          </section>
          <div className="cosmic-bottom-grid">
            <section className="cosmic-panel">
              <div className="cosmic-section-heading">
                <h2>Worlds</h2>
                <button onClick={() => navigate("/admin/worlds")}>
                  View All
                </button>
              </div>
              <div className="cosmic-world-cards">
                {data.worlds.slice(0, 4).map((w, i) => (
                  <button
                    key={w.id}
                    style={{ backgroundPosition: `${i * 33}% center` }}
                    onClick={() => navigate("/admin/worlds/" + w.id)}
                  >
                    <strong>{w.name.en}</strong>
                    <small>{w.status} · illustrative scene</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="cosmic-panel">
              <h2>Character Distribution</h2>
              {sum ? (
                <div className="cosmic-distribution">
                  <div
                    className="cosmic-donut"
                    style={{ background: `conic-gradient(${stops.join(",")})` }}
                  >
                    <span>{sum}</span>
                  </div>
                  <ul>
                    {data.distribution.map((d, i) => (
                      <li key={d.type}>
                        <i
                          style={{ background: palette[i % palette.length] }}
                        />
                        {d.type}
                        <strong>{d.count}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>
                  No central characters yet. Upload an original to build the
                  library.
                </p>
              )}
            </section>
            <section className="cosmic-panel">
              <h2>Quick Actions</h2>
              <div className="cosmic-quick">
                {[
                  ["Explore", "/explore", "worlds"],
                  ["Create world", "/admin/worlds/new", "active"],
                  ["Connect", "/admin/connections", "connections"],
                  ["Upload", "/admin/characters", "characters"],
                ].map(([label, path, icon]) => (
                  <button key={path} onClick={() => navigate(path)}>
                    <span className="cosmic-icon">
                      <CosmicIcon kind={icon} />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
        <aside className="cosmic-panel cosmic-activity">
          <div className="cosmic-section-heading">
            <h2>Recent Activity</h2>
            <button onClick={() => navigate("/admin/activity")}>
              View All
            </button>
          </div>
          {data.activity.length ? (
            data.activity.slice(0, 6).map((a, i) => (
              <article key={a.id}>
                <span className="cosmic-icon">
                  <CosmicIcon kind={i % 2 ? "connections" : "characters"} />
                </span>
                <div>
                  <strong>{a.action}</strong>
                  <p>{a.name}</p>
                  <time>{adminDate(a.createdAt)}</time>
                </div>
              </article>
            ))
          ) : (
            <p>
              No recorded administrator activity yet. Uploads and saved
              editorial revisions will appear here.
            </p>
          )}
          <button onClick={() => navigate("/admin/discoveries")}>
            Manage discoveries
          </button>
          <small>
            Browser movements and private world saves are not collected.
          </small>
        </aside>
      </div>
      {analytics && (
        <section className="cosmic-panel">
          <h2>Available analytics</h2>
          <p>
            Only persisted server records and current administrator sessions are
            measured. Public visitor activity, personal world usage and
            week-over-week growth are unavailable.
          </p>
        </section>
      )}
    </div>
  );
}
export function ActivityLog({ request }: { request: AdminRequest }) {
  const [data, setData] = useState<{
      items: Activity[];
      total: number;
      page: number;
      totalPages: number;
    } | null>(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setError("");
    request(
      "activity?" + new URLSearchParams({ search, page: String(page) }),
      "GET",
      undefined,
      c.signal,
    )
      .then((v) => {
        if (!c.signal.aborted) {
          setData(v);
          setPage(v.page);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [request, page, search]);
  return (
    <section className="cosmic-panel">
      <h2>{t("ui.recorded.activity")}</h2>
      <label>
        {t("ui.search.activity")}{" "}
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {data ? (
        <>
          {data.items.map((a) => (
            <article className="cosmic-log-entry" key={a.id}>
              <strong>
                {a.action}
                {t("separator.dot")} {a.name}
              </strong>
              <time>{adminDate(a.createdAt)}</time>
            </article>
          ))}
          {!data.items.length && <p>{t("ui.no.recorded.actions.match")}</p>}
          <div className="admin-pagination">
            <span>
              {t("ui.total")} {data.total}
            </span>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("ui.previous")}{" "}
            </button>
            <span>
              {t("ui.page")} {page}
              {t("ui.of")} {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("ui.next")}{" "}
            </button>
          </div>
        </>
      ) : (
        <p role="status">{t("ui.loading")}</p>
      )}
    </section>
  );
}
