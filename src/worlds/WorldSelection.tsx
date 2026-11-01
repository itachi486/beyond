import { useEffect, useRef, useState } from "react";
import { useUniverse } from "../features/content/UniverseProvider";
import type { Locale } from "../locales";
import { selectionRegions } from "./selectionRegions";
import { startSelectionEffects } from "./selectionEffects";
import "./world-selection.css";
export default function WorldSelection({
  locale,
  reduced,
  simple,
  blocked,
  onSelect,
}: {
  locale: Locale;
  reduced: boolean;
  simple: boolean;
  blocked: boolean;
  onSelect: (id: string) => void;
}) {
  const catalog = useUniverse(),
    worlds = catalog.worlds.filter((w) => w.hubKey);
  const [active, setActive] = useState<string | null>(null),
    [clicked, setClicked] = useState<string | null>(null),
    [overview, setOverview] = useState(false),
    [failed, setFailed] = useState(false),
    [noCanvas, setNoCanvas] = useState(false);
  const panorama = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pending = useRef<string | null>(null),
    actions = useRef(onSelect);
  actions.current = onSelect;
  const mode = useRef({ active, clicked, locale, reduced, simple });
  mode.current = {
    active: blocked ? null : active,
    clicked,
    locale,
    reduced,
    simple,
  };
  useEffect(() => {
    if (!canvas.current) return;
    const effects = startSelectionEffects(
      canvas.current,
      worlds,
      () => mode.current,
    );
    setNoCanvas(!effects);
    return () => effects?.dispose();
  }, [catalog, simple]);
  useEffect(() => {
    const pan = panorama.current;
    if (pan && !overview)
      pan.scrollLeft = Math.max(0, (pan.scrollWidth - pan.clientWidth) / 2);
  }, [overview]);
  function finish() {
    const id = pending.current;
    if (!id) return;
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    actions.current(id);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current = null;
    },
    [],
  );
  useEffect(() => {
    if (reduced && pending.current) finish();
  }, [reduced]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) finish();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  function choose(id: string) {
    if (pending.current || blocked) return;
    pending.current = id;
    setActive(id);
    setClicked(id);
    timer.current = setTimeout(finish, reduced ? 0 : 720);
  }
  const current = worlds.find((w) => w.id === active);
  return (
    <section
      className={`reference-selection${overview ? " is-overview" : ""}${clicked ? " is-activating" : ""}`}
      data-active-world={active || ""}
      data-pending-world={clicked || ""}
      aria-label={
        locale === "es" ? "Elige tu curiosidad" : "Choose your curiosity"
      }
      inert={blocked}
    >
      <h1 className="sr-only">CHOOSE YOUR CURIOSITY</h1>
      <p className="sr-only">Six worlds. Endless discoveries.</p>
      <div
        className="selection-panorama"
        ref={panorama}
        tabIndex={0}
        aria-label={
          locale === "es"
            ? "Panorama: desliza para explorar los seis destinos"
            : "Panorama: swipe to explore all six destinations"
        }
      >
        <div className="selection-artboard">
          <img
            className="selection-reference"
            src="/world-selection-reference.png"
            width={1672}
            height={941}
            alt={
              locale === "es"
                ? "Seis reinos conectados: puertas doradas, esfera de cristal, castillo, jardín, ciudad y biblioteca"
                : "Six connected realms: golden doors, crystal sphere, castle, garden, city and library"
            }
            draggable={false}
            onError={() => setFailed(true)}
          />
          <canvas
            ref={canvas}
            className="selection-effects"
            aria-hidden="true"
          />
          <svg
            className="selection-hit-map"
            viewBox="0 0 1672 941"
            role="group"
            aria-label={
              locale === "es"
                ? "Destinos del universo"
                : "Universe destinations"
            }
          >
            {selectionRegions.map((region) => {
              const world = worlds.find((w) => w.hubKey === region.key);
              if (!world) return null;
              return (
                <g
                  key={world.id}
                  role="button"
                  tabIndex={clicked ? -1 : 0}
                  aria-label={world.name[locale]}
                  aria-disabled={!!clicked}
                  data-world={world.id}
                  onPointerEnter={() => !clicked && setActive(world.id)}
                  onPointerLeave={() => !clicked && setActive(null)}
                  onFocus={() => setActive(world.id)}
                  onBlur={() => !clicked && setActive(null)}
                  onClick={() => choose(world.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      choose(world.id);
                    }
                  }}
                >
                  <polygon
                    points={region.polygon
                      .map(([x, y]) => `${x * 1672},${y * 941}`)
                      .join(" ")}
                    style={
                      { "--region-color": region.color } as React.CSSProperties
                    }
                  />
                </g>
              );
            })}
            {noCanvas && current && (
              <text
                x={836}
                y={700}
                textAnchor="middle"
                className="selection-fallback-title"
              >
                {current.name[locale]}
              </text>
            )}
          </svg>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {current?.name[locale] || ""}
      </p>
      <button
        className="selection-overview"
        onClick={() => setOverview((v) => !v)}
      >
        {locale === "es"
          ? overview
            ? "Explorar panorama"
            : "Ver mundo completo"
          : overview
            ? "Explore panorama"
            : "View whole world"}
      </button>
      <p className="selection-touch-hint">
        {locale === "es"
          ? "Desliza para descubrir · Toca un destino"
          : "Swipe to discover · Tap a destination"}
      </p>
      {failed && (
        <p className="selection-error" role="alert">
          {locale === "es"
            ? "No se pudo cargar la imagen. Recarga la página para volver a intentarlo."
            : "The reference artwork could not load. Reload the page to retry."}
        </p>
      )}
    </section>
  );
}
