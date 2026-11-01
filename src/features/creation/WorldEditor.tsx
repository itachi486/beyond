import {captureAccountContext,isAccountContextCurrent} from '../account/sessionScope';
import {persistWorld} from "../account/cloudWorlds";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../locales";
import { ObjectArt } from "./ObjectArt";
import {
  kindNames,
  newObject,
  objectKinds,
  saveWorld,
  type CreatedWorld,
  type WorldObject,
} from "./worldStore";
import "./creation.css";
export default function WorldEditor({
  initial,
  locale,
  onExit,
}: {
  initial: CreatedWorld;
  locale: Locale;
  onExit: () => void;
}) {
  const es = locale === "es",
    [world, setWorld] = useState(initial),
    current = useRef(initial),
    [selected, setSelected] = useState<string | null>(null),
    [past, setPast] = useState<CreatedWorld[]>([]),
    [future, setFuture] = useState<CreatedWorld[]>([]),
    [preview, setPreview] = useState(false),
    [zoom, setZoom] = useState(1),
    [status, setStatus] = useState(""),
    [dirty, setDirty] = useState(false),
    savedVersion = useRef(initial.updatedAt),
    svg = useRef<SVGSVGElement>(null),
    drag = useRef<{
      id: string;
      before: CreatedWorld;
      startX: number;
      startY: number;
      x: number;
      y: number;
      moved: boolean;
    } | null>(null);
  current.current = world;
  const active = world.objects.find((o) => o.id === selected);
  function commit(next: CreatedWorld) {
    const snapshot = current.current;
    setPast((p) => [...p.slice(-49), snapshot]);
    setFuture([]);
    current.current = next;
    setWorld(next);
    setDirty(true);
    setStatus("");
  }
  function patchObject(update: Partial<WorldObject>) {
    if (!active) return;
    commit({
      ...world,
      objects: world.objects.map((o) =>
        o.id === active.id ? { ...o, ...update } : o,
      ),
    });
  }
  function undo() {
    if (!past.length) return;
    const before = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    const snapshot = current.current;
    setFuture((f) => [snapshot, ...f].slice(0, 50));
    setWorld(before);
    setDirty(true);
    setStatus("");
  }
  function redo() {
    if (!future.length) return;
    const snapshot = current.current;
    setPast((p) => [...p.slice(-49), snapshot]);
    setWorld(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
    setStatus("");
  }
  const accountScope = useRef(captureAccountContext()).current;
  async function save() {
    let failure="";
    const saved = await persistWorld(current.current, savedVersion.current,undefined,accountScope).catch(e=>{failure=e.message;return null;});
    if(!isAccountContextCurrent(accountScope))return;
    if (saved) {
      setWorld(saved);
      savedVersion.current = saved.updatedAt;
      setDirty(false);
      setStatus(saved.ownerId ? (es ? "Guardado en tu cuenta." : "Saved to your account.") : (es ? "Guardado en este navegador." : "Saved in this browser."));
    } else
      setStatus(
        failure || (es
          ? "No se pudo guardar. El almacenamiento puede estar lleno o el mundo cambió en otra pestaña."
          : "Could not save. Storage may be full, or this world changed in another tab."),
      );
  }
  function exit() {
    if (
      !dirty ||
      window.confirm(
        es
          ? "¿Salir sin guardar los cambios?"
          : "Leave without saving your changes?",
      )
    )
      onExit();
  }
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  function point(e: React.PointerEvent) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  }
  function endDrag() {
    const d = drag.current;
    if (d?.moved) {
      setPast((p) => [...p.slice(-49), d.before]);
      setFuture([]);
      setDirty(true);
      setStatus("");
    }
    drag.current = null;
  }
  return (
    <section
      className={`world-editor${preview ? " editor-preview" : ""}`}
      aria-label={es ? "Editor de mundos" : "World editor"}
    >
      <header className="editor-header">
        <div>
          <p className="creation-kicker">
            BEYOND / {es ? "CREACIÓN LOCAL" : "LOCAL CREATION"}
          </p>
          <h1>{world.name}</h1>
        </div>
        <div className="editor-tools">
          <button onClick={undo} disabled={!past.length || preview}>
            {es ? "Deshacer" : "Undo"}
          </button>
          <button onClick={redo} disabled={!future.length || preview}>
            {es ? "Rehacer" : "Redo"}
          </button>
          <button
            onClick={() => {
              setPreview((v) => !v);
              setSelected(null);
            }}
          >
            {preview
              ? es
                ? "Volver al editor"
                : "Back to editor"
              : es
                ? "Vista previa"
                : "Preview"}
          </button>
          <button
            className="creation-primary"
            aria-label={es ? "Guardar" : "Save"}
            onClick={save}
          >
            {es ? "Guardar" : "Save"}
            {dirty ? " •" : ""}
          </button>
          <button onClick={exit}>MY WORLDS</button>
        </div>
      </header>
      <div className="editor-layout">
        {!preview && (
          <aside className="object-library">
            <h2>{es ? "Invoca un objeto" : "Summon an object"}</h2>
            <div className="object-library-grid">
              {objectKinds.map((kind, i) => (
                <button
                  key={kind}
                  disabled={world.objects.length >= 200}
                  onClick={() => {
                    const o = newObject(kind, kindNames[locale][i]);
                    o.x = 450 + (world.objects.length % 4) * 35;
                    o.y = 300 + (world.objects.length % 3) * 35;
                    o.layer = Math.min(1000, world.objects.length);
                    commit({ ...world, objects: [...world.objects, o] });
                    setSelected(o.id);
                  }}
                >
                  <svg viewBox="-100 -90 200 210" aria-hidden="true">
                    <ObjectArt kind={kind} />
                  </svg>
                  <span>{kindNames[locale][i]}</span>
                </button>
              ))}
            </div>
            <p>
              {es
                ? "Hasta 200 objetos. Arrastra para mover; usa las flechas con un objeto enfocado."
                : "Up to 200 objects. Drag to move; use arrow keys with an object focused."}
            </p>
          </aside>
        )}
        <div className="editor-stage-wrap">
          <div className="editor-view-tools">
            <button
              aria-label={es ? "Alejar" : "Zoom out"}
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            >
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label={es ? "Acercar" : "Zoom in"}
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            >
              +
            </button>
            <button onClick={() => setZoom(1)}>
              {es ? "Restablecer vista" : "Reset view"}
            </button>
          </div>
          <svg
            ref={svg}
            className={`editor-stage theme-${world.theme}`}
            viewBox={`${500 - 500 / zoom} ${325 - 325 / zoom} ${1000 / zoom} ${650 / zoom}`}
            role="group"
            aria-label={es ? "Lienzo del mundo" : "World canvas"}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || preview) return;
              const p = point(e);
              d.moved = true;
              const next = {
                ...current.current,
                objects: current.current.objects.map((o) =>
                  o.id === d.id
                    ? {
                        ...o,
                        x: Math.max(0, Math.min(1000, d.x + p.x - d.startX)),
                        y: Math.max(0, Math.min(650, d.y + p.y - d.startY)),
                      }
                    : o,
                ),
              };
              current.current = next;
              setWorld(next);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          >
            <defs>
              <radialGradient id="creation-sky">
                <stop
                  stopColor={
                    world.theme === "forest"
                      ? "#224e4b"
                      : world.theme === "void"
                        ? "#28213b"
                        : "#29365e"
                  }
                />
                <stop offset="1" stopColor="#080e22" />
              </radialGradient>
            </defs>
            <rect
              x="-1000"
              y="-1000"
              width="3000"
              height="2650"
              fill="url(#creation-sky)"
              pointerEvents="none"
            />
            {Array.from({ length: 55 }, (_, i) => (
              <circle
                key={i}
                cx={(i * 163 + 51) % 1000}
                cy={(i * 79 + 21) % 650}
                r={i % 3 ? 1 : 2}
                fill={i % 3 ? "#adc7de" : "#dfc184"}
                opacity=".5"
                pointerEvents="none"
              />
            ))}
            <path
              d="M-100 570Q300 430 550 560T1100 530"
              fill="none"
              stroke="#7cc6c7"
              opacity=".18"
              pointerEvents="none"
            />
            {[...world.objects]
              .sort((a, b) => a.layer - b.layer)
              .map((o) => (
                <g
                  key={o.id}
                  role={preview ? undefined : "button"}
                  tabIndex={preview ? undefined : 0}
                  aria-label={o.name}
                  aria-pressed={preview ? undefined : selected === o.id}
                  className={`world-object${selected === o.id ? " object-selected" : ""}`}
                  transform={`translate(${o.x} ${o.y}) rotate(${o.rotation}) scale(${o.size})`}
                  onPointerDown={(e) => {
                    if (preview) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.focus();
                    setSelected(o.id);
                    const p = point(e);
                    drag.current = {
                      id: o.id,
                      before: world,
                      startX: p.x,
                      startY: p.y,
                      x: o.x,
                      y: o.y,
                      moved: false,
                    };
                    svg.current?.setPointerCapture(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    if (preview) return;
                    const step = e.shiftKey ? 10 : 2;
                    const offsets: Record<string, [number, number]> = {
                      ArrowLeft: [-step, 0],
                      ArrowRight: [step, 0],
                      ArrowUp: [0, -step],
                      ArrowDown: [0, step],
                    };
                    if (offsets[e.key]) {
                      e.preventDefault();
                      setSelected(o.id);
                      const [dx, dy] = offsets[e.key];
                      commit({
                        ...world,
                        objects: world.objects.map((item) =>
                          item.id === o.id
                            ? {
                                ...item,
                                x: Math.max(0, Math.min(1000, item.x + dx)),
                                y: Math.max(0, Math.min(650, item.y + dy)),
                              }
                            : item,
                        ),
                      });
                    }
                    if (e.key === "Delete" || e.key === "Backspace") {
                      e.preventDefault();
                      commit({
                        ...world,
                        objects: world.objects.filter(
                          (item) => item.id !== o.id,
                        ),
                      });
                      setSelected(null);
                    }
                    if (e.key === "Escape") setSelected(null);
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(o.id);
                    }
                  }}
                >
                  {selected === o.id && !preview && (
                    <rect
                      x="-95"
                      y="-85"
                      width="190"
                      height="200"
                      rx="8"
                      fill="#a2f9e60d"
                      stroke="#a2f9e6"
                      strokeWidth="1"
                      strokeDasharray="4 5"
                    />
                  )}
                  <ObjectArt kind={o.kind} />
                </g>
              ))}
          </svg>
          {!world.objects.length && (
            <p className="editor-empty">
              {es
                ? "Tu mundo está esperando. Invoca un objeto para comenzar."
                : "Your world is waiting. Summon an object to begin."}
            </p>
          )}
        </div>
        {!preview && (
          <aside className="editor-properties">
            <h2>{es ? "Tu mundo" : "Your world"}</h2>
            <label>
              {es ? "Nombre del mundo" : "World name"}
              <input
                maxLength={100}
                value={world.name}
                onChange={(e) => commit({ ...world, name: e.target.value })}
              />
            </label>
            <label>
              {es ? "Descripción del mundo" : "World description"}
              <textarea
                aria-label={es ? "Descripción del mundo" : "World description"}
                maxLength={2000}
                value={world.description}
                onChange={(e) =>
                  commit({ ...world, description: e.target.value })
                }
              />
            </label>
            <label>
              {es ? "Atmósfera" : "Atmosphere"}
              <select
                value={world.theme}
                onChange={(e) =>
                  commit({
                    ...world,
                    theme: e.target.value as CreatedWorld["theme"],
                  })
                }
              >
                <option value="celestial">
                  {es ? "Celestial" : "Celestial"}
                </option>
                <option value="forest">{es ? "Bosque" : "Forest"}</option>
                <option value="void">{es ? "Vacío" : "Void"}</option>
              </select>
            </label>
            <h2>{es ? "Objeto seleccionado" : "Selected object"}</h2>
            {active ? (
              <>
                <label>
                  {es ? "Nombre del objeto" : "Object name"}
                  <input
                    maxLength={100}
                    value={active.name}
                    onChange={(e) => patchObject({ name: e.target.value })}
                  />
                </label>
                {(
                  [
                    ["X", "x", 0, 1000, 1],
                    ["Y", "y", 0, 650, 1],
                    [es ? "Tamaño" : "Size", "size", 0.25, 3, 0.05],
                    [es ? "Rotación" : "Rotation", "rotation", -360, 360, 1],
                    [es ? "Capa" : "Layer", "layer", -1000, 1000, 1],
                  ] as const
                ).map(([label, key, min, max, step]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={Math.round(active[key] * 100) / 100}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        if (Number.isFinite(n))
                          patchObject({
                            [key]: Math.max(min, Math.min(max, n)),
                          });
                      }}
                    />
                  </label>
                ))}
                <button
                  onClick={() => {
                    commit({
                      ...world,
                      objects: world.objects.filter((o) => o.id !== active.id),
                    });
                    setSelected(null);
                  }}
                >
                  {es ? "Eliminar objeto" : "Delete object"}
                </button>
                <button onClick={() => setSelected(null)}>
                  {es ? "Quitar selección" : "Deselect"}
                </button>
              </>
            ) : (
              <p>
                {es
                  ? "Selecciona un objeto en el lienzo."
                  : "Select an object on the canvas."}
              </p>
            )}
          </aside>
        )}
      </div>
      <footer className="editor-footer">
        <span>
          {es
            ? "Solo en este navegador · Sin sincronización ni publicación"
            : "This browser only · No synchronization or publishing"}
        </span>
        <span role="status">
          {status ||
            (dirty ? (es ? "Cambios sin guardar" : "Unsaved changes") : "")}
        </span>
      </footer>
    </section>
  );
}
