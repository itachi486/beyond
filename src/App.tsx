import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  discoveries,
  getDiscovery,
  worlds,
  type WorldId,
} from "./data/universe";
import { languageOptions, messages, type Locale } from "./locales";
import { ids, read, remember, write } from "./lib/storage";
import { Icon } from "./components/Icon";
import { Overlay } from "./components/Overlay";
import { SceneBoundary } from "./components/SceneBoundary";
const WorldScene = lazy(() => import("./worlds/WorldScene"));
type Panel = "bookmarks" | "history" | "settings" | "worlds" | null;
export default function App() {
  const location = useLocation(),
    navigate = useNavigate();
  const [locale, setLocale] = useState<Locale>(() =>
    read("locale", "en", (v): v is Locale => v === "en" || v === "es"),
  );
  const t = messages[locale];
  const [bookmarks, setBookmarks] = useState<string[]>(() =>
    read("bookmarks", [], ids).filter((id) => getDiscovery(id)),
  );
  const [history, setHistory] = useState<string[]>(() =>
    read("history", [], ids).filter((id) => getDiscovery(id)),
  );
  const [panel, setPanel] = useState<Panel>(null),
    [tutorial, setTutorial] = useState(false),
    [transition, setTransition] = useState(false),
    [shared, setShared] = useState("");
  const systemReduce = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [reduced, setReduced] = useState(() =>
    read(
      "reduced",
      systemReduce(),
      (v): v is boolean => typeof v === "boolean",
    ),
  );
  const [simple, setSimple] = useState(() =>
    read(
      "simple",
      window.innerWidth < 700,
      (v): v is boolean => typeof v === "boolean",
    ),
  );
  const discoverySlug = location.pathname.startsWith("/discoveries/")
    ? location.pathname.slice(13)
    : null;
  const discovery = discoverySlug ? getDiscovery(discoverySlug) : undefined;
  const worldSlug = location.pathname.startsWith("/worlds/")
    ? location.pathname.slice(8)
    : null;
  const world = worlds.find((w) => w.id === (discovery?.worldId || worldSlug));
  const home = location.pathname === "/";
  const invalid = !home && !world;
  useEffect(() => {
    document.documentElement.lang = locale;
    write("locale", locale);
  }, [locale]);
  useEffect(() => {
    if (!discovery) return;
    setHistory((h) => {
      const next = remember(h, discovery.id);
      write("history", next);
      return next;
    });
    document.title = discovery.title[locale] + " — BEYOND";
    return () => {
      document.title = "BEYOND — The Internet Within the Internet";
    };
  }, [discovery, locale]);
  useEffect(() => {
    if (
      world &&
      !read("tutorial", false, (v): v is boolean => typeof v === "boolean")
    )
      setTutorial(true);
  }, [!!world]);
  useEffect(() => {
    setShared("");
    setPanel(null);
  }, [location.pathname]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (mq.matches) setReduced(true);
    };
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  function travel(id: WorldId) {
    setPanel(null);
    setTransition(true);
    window.setTimeout(
      () => {
        navigate("/worlds/" + id);
        setTransition(false);
      },
      reduced ? 0 : 450,
    );
  }
  function open(id: string) {
    setPanel(null);
    navigate("/discoveries/" + id);
  }
  function toggleBookmark(id: string) {
    setBookmarks((items) => {
      const next = items.includes(id)
        ? items.filter((x) => x !== id)
        : remember(items, id);
      write("bookmarks", next);
      return next;
    });
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(t.copied);
    } catch {
      setShared(t.copyFail);
    }
  }
  const language = (
    <label className="language">
      <Icon name="globe" />
      <span className="sr-only">{t.language}</span>
      <select
        aria-label={t.language}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {languageOptions.map(([id, name, available]) => (
          <option key={id} value={id} disabled={!available}>
            {name}
            {available ? "" : ` — ${t.upcoming}`}
          </option>
        ))}
      </select>
    </label>
  );
  function destinationList(list: typeof discoveries) {
    return (
      <div className="destination-list">
        {list.length ? (
          list.map((d) => (
            <button key={d.id} onClick={() => open(d.id)}>
              <span className={"destination-sigil " + d.worldId}>✧</span>
              <span>
                <small>
                  {worlds.find((w) => w.id === d.worldId)!.name[locale]}
                </small>
                <strong>{d.title[locale]}</strong>
                <span>{d.summary[locale]}</span>
              </span>
              <Icon name="arrow" />
            </button>
          ))
        ) : (
          <p className="muted">{t.empty}</p>
        )}
      </div>
    );
  }
  return (
    <main className={home ? "app threshold" : "app exploring"}>
      {home && (
        <div className="hero-art" aria-hidden="true">
          <div className="hero-haze" />
          <div className="orbital orbital-one" />
          <div className="orbital orbital-two" />
          <div className="stardust" />
        </div>
      )}
      {world && (
        <SceneBoundary key={world.id} message={t.fallback}>
          <Suspense fallback={<p className="scene-loading">{t.loading}</p>}>
            <WorldScene
              world={world.id}
              locale={locale}
              simple={simple}
              reduced={reduced}
              blocked={!!(panel || discovery || tutorial)}
              onSelect={open}
              onPortal={travel}
            />
          </Suspense>
        </SceneBoundary>
      )}
      <header
        className="site-header"
        inert={!!(panel || tutorial || discovery)}
      >
        <button
          className="wordmark"
          aria-label="BEYOND"
          onClick={() => navigate("/")}
        >
          BEY<span className="word-orbit">O</span>ND
        </button>
        <nav aria-label={t.explore}>
          {language}
          <span className="header-divider" />
          <button
            className="icon-button"
            aria-label={t.explore}
            onClick={() => setPanel("worlds")}
          >
            <Icon name="compass" />
          </button>
          <button
            className="icon-button"
            aria-label={t.bookmarks}
            onClick={() => setPanel("bookmarks")}
          >
            <Icon name="bookmark" />
            {bookmarks.length > 0 && <i className="dot" />}
          </button>
          <button
            className="icon-button"
            aria-label={t.menu}
            onClick={() => setPanel("settings")}
          >
            <Icon name="menu" />
          </button>
        </nav>
      </header>
      {home && (
        <>
          <section className="hero-copy">
            <p className="eyebrow">{t.descriptor}</p>
            <h1>
              BEY<span className="word-orbit">O</span>ND
            </h1>
            <h2>{t.headline}</h2>
            <p className="hero-support">{t.support}</p>
            <button className="primary" onClick={() => travel("archive")}>
              {t.enter}
              <Icon name="arrow" />
            </button>
            <p className="atmosphere">{t.atmosphere}</p>
          </section>
          <footer className="threshold-footer">
            <button
              className="quiet scroll-hint"
              onClick={() => setPanel("worlds")}
            >
              <span className="scroll-icon">↓</span>
              {t.scroll}
            </button>
            <button className="world-pill" onClick={() => setPanel("worlds")}>
              <span className="world-mini" />
              <span>
                <small>{t.current}</small>
                <strong>{t.outer}</strong>
              </span>
              <Icon name="arrow" />
            </button>
          </footer>
        </>
      )}
      {world && !discovery && (
        <>
          <section className="world-title">
            <p className="eyebrow">
              {t.current} / {world.symbol}
            </p>
            <h1>{world.name[locale]}</h1>
            <p>{world.description[locale]}</p>
            <span className="fiction-note">{t.fiction}</span>
          </section>
          <div className="world-dock">
            <div className="dock-heading">
              <span className="eyebrow">{t.discoveries}</span>
              <button className="quiet" onClick={() => setPanel("history")}>
                <Icon name="trail" />
                {t.history}
              </button>
            </div>
            <div className="nearby">
              {discoveries
                .filter((d) => d.worldId === world.id)
                .map((d, i) => (
                  <button key={d.id} onClick={() => open(d.id)}>
                    <span className="node-index">0{i + 1}</span>
                    <span>
                      <strong>{d.title[locale]}</strong>
                      <small>
                        {history.includes(d.id) ? t.visited : d.summary[locale]}
                      </small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                ))}
            </div>
            <nav className="portal-nav" aria-label={t.worlds}>
              {worlds.map((w) => (
                <button
                  key={w.id}
                  aria-current={w.id === world.id ? "location" : undefined}
                  onClick={() => travel(w.id)}
                >
                  <i style={{ background: w.color }} />
                  {w.name[locale]}
                  <span>↗</span>
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
      {invalid && (
        <section className="not-found">
          <p className="eyebrow">BEYOND / 404</p>
          <h1>{t.notfound}</h1>
          <button className="primary" onClick={() => travel("archive")}>
            {t.findway}
            <Icon name="arrow" />
          </button>
        </section>
      )}
      {discovery && !tutorial && !panel && (
        <Overlay
          toolbar={language}
          title={t.panel}
          closeLabel={t.close}
          onClose={() => navigate("/worlds/" + discovery.worldId)}
        >
          <article className="discovery">
            <p className="eyebrow category">
              {discovery.category[locale]} /{" "}
              {discovery.contentType === "question" ? t.notKnown : t.original}
            </p>
            <h1>{discovery.title[locale]}</h1>
            <p className="lead">{discovery.summary[locale]}</p>
            <div
              className={"article-visual " + discovery.worldId}
              aria-hidden="true"
            >
              <span>✧</span>
              <div className="article-ring" />
            </div>
            {discovery.body.map((p, i) => (
              <p key={i}>{p[locale]}</p>
            ))}
            <div className="article-actions">
              <button
                onClick={() => toggleBookmark(discovery.id)}
                aria-pressed={bookmarks.includes(discovery.id)}
              >
                <Icon name="bookmark" />
                {bookmarks.includes(discovery.id) ? t.saved : t.save}
              </button>
              <button onClick={share}>
                <Icon name="arrow" />
                {t.share}
              </button>
            </div>
            <p className="status" role="status">
              {shared}
            </p>
            <div className="source-links">
              <span className="eyebrow">{t.sources}</span>
              {discovery.sourceUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {new URL(url).hostname} ↗
                </a>
              ))}
            </div>
            <h2 className="related-title">{t.connections}</h2>
            {destinationList(
              discoveries.filter((d) => discovery.relatedIds.includes(d.id)),
            )}
            <button
              className="quiet"
              onClick={() => navigate("/worlds/" + discovery.worldId)}
            >
              ← {t.back}
            </button>
          </article>
        </Overlay>
      )}
      {tutorial && world && (
        <Overlay
          toolbar={language}
          title={t.tutorial}
          closeLabel={t.close}
          onClose={() => {
            setTutorial(false);
            write("tutorial", true);
          }}
        >
          <div className="tutorial">
            <span className="tutorial-compass">✧</span>
            <h1>{t.welcome}</h1>
            <ol>
              {[t.look, t.move, t.select, t.follow].map((v, i) => (
                <li key={v}>
                  <span>0{i + 1}</span>
                  {v}
                </li>
              ))}
            </ol>
            <button
              className="primary"
              onClick={() => {
                setTutorial(false);
                write("tutorial", true);
              }}
            >
              {t.skip}
              <Icon name="arrow" />
            </button>
          </div>
        </Overlay>
      )}
      {panel && (
        <Overlay
          toolbar={language}
          title={
            panel === "worlds"
              ? t.choose
              : panel === "bookmarks"
                ? t.bookmarks
                : panel === "history"
                  ? t.history
                  : t.settings
          }
          closeLabel={t.close}
          onClose={() => setPanel(null)}
        >
          {panel === "worlds" ? (
            <div className="world-picker">
              <h1>{t.choose}</h1>
              {worlds.map((w) => (
                <button key={w.id} onClick={() => travel(w.id)}>
                  <div className={"world-preview " + w.id}>
                    <span>◯</span>
                  </div>
                  <span>
                    <small>{w.symbol}</small>
                    <strong>{w.name[locale]}</strong>
                    <p>{w.description[locale]}</p>
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          ) : panel === "settings" ? (
            <div className="settings">
              <h1>{t.about}</h1>
              <p>{t.aboutBody}</p>
              <label>
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => {
                    setReduced(e.target.checked);
                    write("reduced", e.target.checked);
                  }}
                />
                {t.reduce}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={simple}
                  onChange={(e) => {
                    setSimple(e.target.checked);
                    write("simple", e.target.checked);
                  }}
                />
                {t.quality}
              </label>
              <button onClick={() => setPanel("history")}>
                <Icon name="trail" />
                {t.history}
              </button>
              <button
                onClick={() => {
                  setPanel(null);
                  navigate("/");
                }}
              >
                {t.home}
              </button>
              <p className="muted">{t.privacy}</p>
              <p className="muted">{t.fiction}</p>
            </div>
          ) : (
            <>
              <h1 className="panel-title">
                {panel === "bookmarks" ? t.bookmarks : t.history}
              </h1>
              {destinationList(
                (panel === "bookmarks" ? bookmarks : history)
                  .map((id) => getDiscovery(id)!)
                  .filter(Boolean),
              )}
            </>
          )}
        </Overlay>
      )}
      {transition && (
        <div className="portal-transition" role="status">
          <span />
          {t.loading}
        </div>
      )}
    </main>
  );
}
