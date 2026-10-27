import { useEffect, useRef, useState } from "react";
import { createUniverse } from "./engine";
import type { WorldId } from "../data/universe";
import { useUniverse } from "../features/content/UniverseProvider";
import { messages, type Locale } from "../locales";
export default function WorldScene({
  world,
  locale,
  simple,
  reduced,
  blocked,
  onSelect,
  onPortal,
}: {
  world: WorldId;
  locale: Locale;
  simple: boolean;
  reduced: boolean;
  blocked: boolean;
  onSelect: (id: string) => void;
  onPortal: (id: WorldId) => void;
}) {
  const catalog = useUniverse();
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createUniverse> | null>(null);
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false),
    [pos, setPos] = useState([0, 19]);
  const t = messages[locale];
  const callbacks = useRef({ onSelect, onPortal });
  callbacks.current = { onSelect, onPortal };
  useEffect(() => {
    setFailed(false);
    setReady(false);
    if (!host.current) return;
    try {
      engine.current = createUniverse(host.current, {
        world,
        catalog,
        simple,
        reduced,
        onSelect: (id) => callbacks.current.onSelect(id),
        onPortal: (id) => callbacks.current.onPortal(id),
        onFailure: () => setFailed(true),
        onReady: () => setReady(true),
        onPosition: (x, z) => setPos([x, z]),
      });
    } catch {
      setFailed(true);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [world, simple, reduced, catalog]);
  useEffect(() => {
    engine.current?.pause(blocked);
  }, [blocked]);
  return (
    <>
      <div
        className="world-canvas"
        ref={host}
        role="img"
        aria-label={t.fiction}
      />
      {failed ? (
        <div className="fallback-note" role="status">
          {t.fallback}
        </div>
      ) : !ready ? (
        <div className="scene-loading" role="status">
          {t.loading}
        </div>
      ) : null}
      <div className="coordinates" aria-hidden="true">
        {pos[0].toFixed(0)}° / {pos[1].toFixed(0)}° <span>✧</span>
      </div>
      {!failed && (
        <>
          <button
            className="reset-view"
            onClick={() => engine.current?.reset()}
          >
            {t.reset} ↺
          </button>
          <div className="movement-pad" role="group" aria-label={t.controls}>
            {[
              ["w", "↑", t.forward],
              ["a", "←", t.left],
              ["s", "↓", t.backward],
              ["d", "→", t.right],
            ].map(([key, symbol, label]) => (
              <button
                key={key}
                aria-label={label}
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
                {symbol}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
