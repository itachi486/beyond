import { useEffect, useRef, useState } from "react";
import { useUniverse } from "../features/content/UniverseProvider";
import { createHub } from "./hub";
import { Overlay } from "../components/Overlay";
import type { Locale } from "../locales";
import "./hub.css";
export default function HubScene({
  locale,
  simple,
  reduced,
  blocked,
  selected,
  onWorld,
  onDiscovery,
}: {
  locale: Locale;
  simple: boolean;
  reduced: boolean;
  blocked: boolean;
  selected: string | null;
  onWorld: (id: string) => void;
  onDiscovery: (id: string) => void;
}) {
  const catalog = useUniverse();
  const actions = useRef({ onDiscovery });
  actions.current = { onDiscovery };
  const worlds = catalog.worlds.filter((w) => w.hubKey);
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
      });
      setReady(true);
    } catch {
      setFailed(true);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [catalog, simple, reduced]);
  useEffect(() => engine.current?.pause(blocked || list), [blocked, list]);
  useEffect(() => {
    if (selected) engine.current?.go(selected);
  }, [selected, ready]);
  const active = worlds.find((w) => w.id === (near || hover || selected));
  const records = active
    ? catalog.discoveries.filter((d) => d.worldId === active.id)
    : [];
  function choose(id: string) {
    setHover(id);
    setList(false);
    onWorld(id);
    engine.current?.go(id);
  }
  return (
    <>
      <div
        className="hub-canvas"
        ref={host}
        role="img"
        aria-label={
          locale === "es"
            ? "Seis destinos conectados en un entorno imaginario"
            : "Six connected destinations in an imaginary environment"
        }
      />
      <section className="hub-title">
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
      {active && !blocked && (
        <aside className="hub-context">
          <span>
            {locale === "es"
              ? near
                ? "ESTÁS AQUÍ"
                : "SIGUE TU CURIOSIDAD"
              : near
                ? "YOU ARE HERE"
                : "FOLLOW YOUR CURIOSITY"}
          </span>
          <h2>{active.name[locale]}</h2>
          <p>{active.description[locale]}</p>
          {!records.length && (
            <p className="hub-empty">
              {locale === "es"
                ? "Aún no hay descubrimientos publicados en este destino."
                : "No discoveries published in this destination yet."}
            </p>
          )}
          <button onClick={() => setList(true)}>
            {locale === "es" ? "Ver descubrimientos" : "Open discoveries"}{" "}
            <span>↗</span>
          </button>
        </aside>
      )}
      {!blocked && (
        <nav
          className="hub-destinations"
          aria-label={
            locale === "es" ? "Destinos del universo" : "Universe destinations"
          }
        >
          {worlds.map((w) => (
            <button
              key={w.id}
              aria-current={active?.id === w.id ? "location" : undefined}
              onClick={() => choose(w.id)}
            >
              <i style={{ background: w.color }} />
              {w.name[locale]}
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
            aria-label={
              locale === "es" ? "Controles de movimiento" : "Movement controls"
            }
          >
            {[
              ["w", "↑"],
              ["a", "←"],
              ["s", "↓"],
              ["d", "→"],
            ].map(([key, text]) => (
              <button
                key={key}
                aria-label={
                  (locale === "es" ? "Mover " : "Move ") +
                  { w: "forward", a: "left", s: "backward", d: "right" }[key]
                }
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  engine.current?.move(key, true);
                }}
                onPointerUp={() => engine.current?.move(key, false)}
                onPointerCancel={() => engine.current?.move(key, false)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter")
                    engine.current?.move(key, true);
                }}
                onKeyUp={() => engine.current?.move(key, false)}
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
