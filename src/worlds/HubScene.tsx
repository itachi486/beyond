import PublishedImages from "../features/creation/PublishedImages";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUniverse } from "../features/content/UniverseProvider";
import { createHub } from "./hub";
import { Overlay } from "../components/Overlay";
import { messages, type Locale } from "../locales";
import "./hub.css";
export default function HubScene({
  locale,
  simple,
  reduced,
  blocked,
  selected,
  arriveImmediately = false,
  onWorld,
  onDiscovery,
}: {
  locale: Locale;
  simple: boolean;
  reduced: boolean;
  blocked: boolean;
  selected: string | null;
  arriveImmediately?: boolean;
  onWorld: (id: string) => void;
  onDiscovery: (id: string) => void;
}) {
  const catalog = useUniverse();
  const t = messages[locale];
  const actions = useRef({ onDiscovery });
  actions.current = { onDiscovery };
  const worlds = catalog.worlds.filter((w) => w.hubKey);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createHub> | null>(null);
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false),
    [hover, setHover] = useState<string | null>(null),
    [near, setNear] = useState<string | null>(null),
    [list, setList] = useState(false),
    [position, setPosition] = useState([0, 23]);
  useEffect(() => {
    if (!host.current) return;
    setFailed(false);
    setReady(false);
    try {
      engine.current = createHub(host.current, {
        worlds,
        discoveries: catalog.discoveries,
        onDiscovery: (id) => actions.current.onDiscovery(id),
        simple,
        reduced,
        onHover: setHover,
        onArrive: setNear,
        onPosition: (x, z) => setPosition([x, z]),
        onFail: () => setFailed(true),
        onReady: () => setReady(true),
        onAnchors: (anchors) =>
          anchors.forEach(({ id, x, y }) => {
            const button = buttons.current.get(id);
            button?.style.setProperty("--world-x", `${x}%`);
            button?.style.setProperty("--world-y", `${y}%`);
          }),
      });
    } catch {
      setFailed(true);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [catalog, simple, reduced]);
  useLayoutEffect(
    () => engine.current?.pause(blocked || list),
    [blocked, list, ready],
  );
  useEffect(() => {
    if (selected) engine.current?.go(selected, arriveImmediately);
  }, [selected, ready, arriveImmediately]);
  useEffect(() => engine.current?.setLocale(locale), [locale, ready]);
  const active = worlds.find((w) => w.id === (hover || near || selected));
  const records = active
    ? catalog.discoveries.filter((d) => d.worldId === active.id)
    : [];
  function choose(id: string) {
    setHover(id);
    setList(false);
    if (failed) setNear(id);
    onWorld(id);
    engine.current?.go(id);
  }
  return (
    <>
      <div
        className="hub-canvas"
        data-ready={ready ? "true" : "false"}
        data-active-title={hover || near || ""}
        aria-busy={!ready && !failed}
        ref={host}
        role="img"
        aria-label={
          locale === "es"
            ? "Seis destinos conectados en un entorno imaginario"
            : "Six connected destinations in an imaginary environment"
        }
      />
      <section
        className="hub-title"
        data-interacting={hover ? "true" : "false"}
      >
        <p>
          {locale === "es" ? "ELIGE TU CURIOSIDAD" : "CHOOSE YOUR CURIOSITY"}
        </p>
        <h1>
          {locale === "es"
            ? worlds.length === 6
              ? "Seis mundos. Nuevas conexiones."
              : `${worlds.length} destinos. Nuevas conexiones.`
            : worlds.length === 6
              ? "Six worlds. Unexpected connections."
              : `${worlds.length} destinations. Unexpected connections.`}
        </h1>
      </section>
      {!ready && !failed && (
        <p className="scene-loading" role="status">
          {locale === "es" ? "Abriendo el universo…" : "Opening the universe…"}
        </p>
      )}
      {failed && (
        <p className="hub-fallback" role="status">
          {locale === "es"
            ? "El modo 3D no está disponible. Elige un destino para explorar su contenido."
            : "3D is unavailable. Choose a destination to explore its content."}
        </p>
      )}
      <p
        className="world-title-announcement sr-only"
        role="status"
        aria-live="polite"
      >
        {active?.name[locale] || ""}
      </p>
      {active && near && !blocked && (
        <aside className="hub-context">
          <span className="sr-only">
            {locale === "es"
              ? near
                ? "ESTÁS AQUÍ"
                : "SIGUE TU CURIOSIDAD"
              : near
                ? "YOU ARE HERE"
                : "FOLLOW YOUR CURIOSITY"}
          </span>
          <h2 className="sr-only">{active.name[locale]}</h2>
          <p>{active.description[locale]}</p>
          {!records.length && (
            <p className="hub-empty">
              {locale === "es"
                ? "Aún no hay descubrimientos publicados en este destino."
                : "No discoveries published in this destination yet."}
            </p>
          )}
          <details><summary>World images</summary><PublishedImages category={active.hubKey!}/></details>
          <button onClick={() => setList(true)}>
            {locale === "es" ? "Ver descubrimientos" : "Open discoveries"}{" "}
            <span>↗</span>
          </button>
        </aside>
      )}
      {!blocked && (
        <nav
          className={`hub-destinations${failed ? " is-fallback" : ""}`}
          aria-label={
            locale === "es" ? "Destinos del universo" : "Universe destinations"
          }
        >
          {worlds.map((w) => (
            <button
              key={w.id}
              ref={(node) => {
                if (node) buttons.current.set(w.id, node);
                else buttons.current.delete(w.id);
              }}
              aria-label={w.name[locale]}
              onFocus={() => {
                setHover(w.id);
                engine.current?.emphasize(w.id);
              }}
              onBlur={() => {
                setHover(null);
                engine.current?.emphasize(null);
              }}
              aria-current={active?.id === w.id ? "location" : undefined}
              disabled={!ready && !failed}
              onClick={() => choose(w.id)}
            >
              <span className="hub-name">{w.name[locale]}</span>
            </button>
          ))}
          {!worlds.length && (
            <p>
              {locale === "es"
                ? "No hay destinos publicados."
                : "No destinations are published."}
            </p>
          )}
        </nav>
      )}
      <div className="hub-coordinates" aria-hidden="true">
        {position[0].toFixed(1)} / {position[1].toFixed(1)}
      </div>
      {!failed && !blocked && (
        <>
          <button
            className="hub-reset"
            onClick={() => {
              engine.current?.reset();
              setHover(null);
            }}
          >
            {locale === "es" ? "Volver al centro" : "Return to the hub"} ↺
          </button>
          <div
            className="movement-pad hub-movement"
            role="group"
            aria-label={t.controls}
          >
            {[
              ["w", "↑", t.forward],
              ["a", "←", t.left],
              ["s", "↓", t.backward],
              ["d", "→", t.right],
            ].map(([key, text, label]) => (
              <button
                key={key}
                disabled={!ready}
                aria-label={label}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  engine.current?.move(key, true);
                }}
                onPointerUp={() => engine.current?.move(key, false)}
                onPointerCancel={() => engine.current?.move(key, false)}
                onLostPointerCapture={() => engine.current?.move(key, false)}
                onBlur={() => engine.current?.move(key, false)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    engine.current?.move(key, true);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter")
                    engine.current?.move(key, false);
                }}
              >
                {text}
              </button>
            ))}
          </div>
        </>
      )}
      {list && active && (
        <Overlay
          title={active.name[locale]}
          closeLabel={locale === "es" ? "Cerrar" : "Close"}
          onClose={() => setList(false)}
        >
          <h1>{active.name[locale]}</h1>
          <p>{active.description[locale]}</p>
          {records.length ? (
            records.map((d) => (
              <button
                className="hub-discovery"
                key={d.id}
                onClick={() => {
                  setList(false);
                  onDiscovery(d.id);
                }}
              >
                <strong>{d.title[locale]}</strong>
                <span>{d.summary[locale]}</span>
              </button>
            ))
          ) : (
            <p>
              {locale === "es"
                ? "Aún no hay descubrimientos publicados en este destino."
                : "No discoveries published in this destination yet."}
            </p>
          )}
        </Overlay>
      )}
    </>
  );
}
