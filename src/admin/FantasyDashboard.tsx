import { useEffect, useState } from "react";
import type { AdminRequest } from "./AdminInventory";
import { CosmicIcon } from "./CosmicDashboard";
import { t, adminDate, adminNumber, type AdminMessageKey } from "./i18n";
type Snapshot = {
  generatedAt: string;
  memberAccounts?: boolean;
  publishedDiscoveries?: number;
  totals: {
    users: number;
    characters: number;
    worlds: number;
    connections: number;
    storageBytes: number | null;
  };
  days: { date: string; characters: number; worlds: number; content: number }[];
  characters: {
    id: string;
    name: string;
    type: string;
    format: string;
    createdAt: string;
    previewUrl: string | null;
  }[];
  worlds: {
    id: string;
    name: { en: string };
    createdAt: string;
    status: string;
  }[];
  activity: { id: string; action: string; name: string; createdAt: string }[];
  system: { database: boolean; api: boolean; lastBackup: string | null };
  scope: string;
};
export default function FantasyDashboard({
  request,
  navigate,
}: {
  request: AdminRequest;
  navigate: (path: string) => void;
  analytics?: boolean;
}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),[attempt,setAttempt]=useState(0);
  useEffect(() => {
    const c = new AbortController();
    setError("");setData(null);
    request("fantasy-overview", "GET", undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [request,attempt]);
  if (error)
    return (
      <p className="admin-error" role="alert">
        {error} <button onClick={()=>setAttempt(v=>v+1)}>Retry dashboard</button>
      </p>
    );
  if (!data) return <p role="status">{t("loading")}</p>;
  const max = Math.max(
    4,
    ...data.days.flatMap((d) => [d.content, d.characters, d.worlds]),
  );
  const heading = (title: AdminMessageKey, path: string) => (
    <div className="fantasy-section-heading">
      <h2>{t(title)}</h2>
      <button onClick={() => navigate("/admin/" + path)}>
        {t("viewAll")} →
      </button>
    </div>
  );
  const metrics: [AdminMessageKey, number | null, AdminMessageKey, string][] = [
    ["totalUsers", data.totals.users, "scopeUsers", "characters"],
    [
      "registeredCharacters",
      data.totals.characters,
      "scopeCharacters",
      "characters",
    ],
    ["totalWorlds", data.totals.worlds, "scopeWorlds", "worlds"],
    ["storage", data.totals.storageBytes, "noStorage", "connections"],
  ];
  return (
    <div className="fantasy-dashboard">
      <p className="admin-muted fantasy-scope">{data.scope}</p>
      <div className="fantasy-metrics">
        {metrics.map(([label, value, scope, icon]) => (
          <article className="fantasy-card fantasy-metric" key={label}>
            <span className="fantasy-metric-icon">
              <CosmicIcon kind={icon} />
            </span>
            <div>
              <span>{t(label)}</span>
              <strong>
                {value === null ? t("unavailable") : adminNumber(value)}
              </strong>
              <small>{t(scope)}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="fantasy-layout">
        <div className="fantasy-primary">
          <div className="fantasy-charts">
            <section className="fantasy-card fantasy-chart">
              <div className="fantasy-section-heading">
                <h2>{t("sevenDays")}</h2>
                <small>{t("recorded")}</small>
              </div>
              <div className="fantasy-legend">
                {(["content", "characters", "worlds"] as const).map(
                  (key, i) => (
                    <span key={key}>
                      <i
                        style={{
                          background: ["#398977", "#419cc9", "#dd9459"][i],
                        }}
                      />
                      {t(key)}
                    </span>
                  ),
                )}
              </div>
              <svg viewBox="0 0 620 235" role="img" aria-label={t("sevenDays")}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <g key={i}>
                    <path d={`M40 ${185 - i * 39}H600`} stroke="#e5e5db" />
                    <text x="5" y={189 - i * 39}>
                      {Math.round((max * i) / 4)}
                    </text>
                  </g>
                ))}
                {(["content", "characters", "worlds"] as const).map(
                  (key, i) => (
                    <g key={key}>
                      <polyline
                        fill="none"
                        stroke={["#398977", "#419cc9", "#dd9459"][i]}
                        strokeWidth="2"
                        points={data.days
                          .map(
                            (d, j) =>
                              `${42 + j * 92},${185 - (d[key] / max) * 156}`,
                          )
                          .join(" ")}
                      />
                      {data.days.map((d, j) => (
                        <circle
                          key={d.date}
                          cx={42 + j * 92}
                          cy={185 - (d[key] / max) * 156}
                          r="3"
                          fill={["#398977", "#419cc9", "#dd9459"][i]}
                        >
                          <title>{`${adminDate(d.date, true)}: ${t(key)} ${d[key]}`}</title>
                        </circle>
                      ))}
                    </g>
                  ),
                )}
                {data.days.map((d, j) => (
                  <text
                    key={d.date}
                    x={42 + j * 92}
                    y="220"
                    textAnchor="middle"
                  >
                    {adminDate(d.date, true)}
                  </text>
                ))}
              </svg>
            </section>
            <section className="fantasy-card">
              <h2>{t("statistics")}</h2>
              <dl className="fantasy-statistics">
                <div>
                  <dt>{t("connectionCount")}</dt>
                  <dd>{adminNumber(data.totals.connections)}</dd>
                </div>
                <div>
                  <dt>{t("visitorCount")}</dt>
                  <dd>{t("unavailable")}</dd>
                </div>
                <div>
                  <dt>{t("personalData")}</dt>
                  <dd>{data.memberAccounts?"Private account-owned data":t("notCentral")}</dd>
                </div>
              </dl>
              <div
                className="cosmic-donut fantasy-compass"
                role="img"
                aria-label="Compass decoration"
              >
                ✧
              </div>
            </section>
          </div>
          <div className="fantasy-recent">
            <section className="fantasy-card">
              {heading("recentCharacters", "characters")}
              <div className="fantasy-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>{t("type")}</th>
                      <th>{t("created")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.characters.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            className="fantasy-record"
                            onClick={() => navigate("/admin/characters")}
                          >
                            {c.previewUrl && <img src={c.previewUrl} alt="" />}
                            {c.name}
                          </button>
                        </td>
                        <td>
                          {c.format.toUpperCase()} · {c.type}
                        </td>
                        <td>
                          <time
                            dateTime={c.createdAt}
                            title={adminDate(c.createdAt)}
                          >
                            {adminDate(c.createdAt, true)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.characters.length && (
                <p className="admin-muted">{t("emptyCharacters")}</p>
              )}
            </section>
            <section className="fantasy-card">
              {heading("recentWorlds", "worlds")}
              <table>
                <thead>
                  <tr>
                    <th>{t("name")}</th>
                    <th>{t("status")}</th>
                    <th>{t("created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.worlds.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <button
                          className="fantasy-record"
                          onClick={() => navigate("/admin/worlds/" + w.id)}
                        >
                          {w.name.en}
                        </button>
                      </td>
                      <td>{w.status}</td>
                      <td>
                        <time
                          dateTime={w.createdAt}
                          title={adminDate(w.createdAt)}
                        >
                          {adminDate(w.createdAt, true)}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <div className="fantasy-recent">
            <section className="fantasy-card">
              <h2>{t("reports")}</h2>
              <p className="admin-muted">{t("noReports")}</p>
            </section>
            <section className="fantasy-card">
              {heading("logs", "activity")}
              {data.activity.length ? (
                <ul className="fantasy-events">
                  {data.activity.map((e) => (
                    <li key={e.id}>
                      <time>{adminDate(e.createdAt)}</time>
                      <strong>{e.action}</strong>
                      <span>{e.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("emptyEvents")}</p>
              )}
            </section>
          </div>
        </div>
        <aside className="fantasy-right">
          <section className="fantasy-card">
            <h2>{t("system")}</h2>
            <dl className="fantasy-system">
              <div>
                <dt>{t("database")}</dt>
                <dd>
                  {data.system.database ? t("healthy") : t("unavailable")}
                </dd>
              </div>
              <div>
                <dt>{t("api")}</dt>
                <dd>{data.system.api ? t("healthy") : t("unavailable")}</dd>
              </div>
              <div>
                <dt>{t("storage")}</dt>
                <dd>{t("unavailable")}</dd>
              </div>
              <div>
                <dt>{t("backup")}</dt>
                <dd>{t("unavailable")}</dd>
              </div>
            </dl>
            <small>{t("noBackup")}</small>
          </section>
          <section className="fantasy-card">
            <h2>{t("quick")}</h2>
            <div className="fantasy-quick">
              {(
                [
                  ["upload", "characters"],
                  ["manageWorlds", "worlds"],
                  ["manageContent", "content"],
                  ["reviewLogs", "activity"],
                  ["openSettings", "settings"],
                ] as const
              ).map(([label, path]) => (
                <button key={path} onClick={() => navigate("/admin/" + path)}>
                  <CosmicIcon kind={path} />
                  {t(label)}
                </button>
              ))}
            </div>
          </section>
          <section className="fantasy-card fantasy-about">
            <h2>{t("about")}</h2>
            <p>{t("aboutText")}</p>
          </section>
        </aside>
      </div>
      <div className="cosmic-editorial-shortcuts"><span>{t("ui.published.discoveries")} <strong>{data.publishedDiscoveries??t("unavailable")}</strong></span><button onClick={()=>navigate('/admin/discoveries/new')}>{t("ui.create.discovery")}</button><button onClick={()=>navigate('/admin/worlds')}>{t("ui.manage.worlds")}</button></div>
      <p className="fantasy-updated">{adminDate(data.generatedAt)}</p>
    </div>
  );
}
