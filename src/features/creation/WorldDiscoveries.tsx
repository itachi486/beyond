import {captureAccountContext,assertAccountContext} from '../account/sessionScope';
import WorldCompanion from "./WorldCompanion";
import {sidecarKey,persistSidecar} from "../account/cloudWorlds";
import {currentUserId} from "../account/sessionScope";
import {starterAsset} from "./starterWorlds";
import type {CreatedWorld} from "./worldStore";
import WorldAdventure from "./WorldAdventure";
import {
  type DiscoveryPoint as Point,
  canDiscover,
  readProgress,
} from "./worldDiscoveryProgress";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { centralRequest, type CentralCharacter } from "./centralLibrary";
import { inspectFile, type ImportedAsset } from "./uploadAssets";
import AssetPreview from "./AssetPreview";
import "./world-discoveries.css";

function valid(value: unknown): value is { version: 1; points: Point[] } {
  if (!value || typeof value !== "object") return false;
  const v = value as { version: number; points: Point[] };
  return (
    v.version === 1 &&
    Array.isArray(v.points) &&
    v.points.length <= 12 &&
    new Set(v.points.map((p) => p?.id)).size === v.points.length &&
    v.points.every(
      (p, index) =>
        p &&
        typeof p.id === "string" &&
        /^[a-f0-9-]{36}$/.test(p.id) &&
        typeof p.characterId === "string" &&
        /^[a-f0-9-]{36}$/.test(p.characterId) &&
        Number.isFinite(p.x) &&
        p.x >= 5 &&
        p.x <= 95 &&
        Number.isFinite(p.y) &&
        p.y >= 5 &&
        p.y <= 95 &&
        (p.objective === undefined ||
          (typeof p.objective === "string" && p.objective.length <= 160)) &&
        (p.requires === undefined ||
          (Array.isArray(p.requires) &&
            p.requires.length <= 12 &&
            p.requires.every((id) =>
              v.points.slice(0, index).some((previous) => previous.id === id),
            ))),
    )
  );
}
export function LegacyWorldDiscoveries({
  worldId,
  name,
  es,
  onClose,
  initialPlaying = false,
  starter,
  lore = "",
}: {
  worldId: string;
  name: string;
  es: boolean;
  onClose: () => void;
  initialPlaying?: boolean;
  starter?:CreatedWorld["starter"];
  lore?: string;
}) {
  const [baseImage,setBaseImage]=useState<{url:string;format:string}|null|undefined>(starter?null:undefined);
  useEffect(()=>{let live=true,url='';if(starter)starterAsset(starter).then(a=>{if(a&&live){url=URL.createObjectURL(a.file);setBaseImage({url,format:a.format});}}).catch(()=>{});return()=>{live=false;if(url)URL.revokeObjectURL(url);};},[starter?.assetId]);
  const key = sidecarKey("discoveries",worldId);
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { points: [] as Point[], invalid: false };
      const data: unknown = JSON.parse(raw);
      return valid(data)
        ? { points: data.points, invalid: false }
        : { points: [], invalid: true };
    } catch {
      return { points: [], invalid: true };
    }
  });
  const [points, setPoints] = useState<Point[]>(initial.points),
    [playing, setPlaying] = useState(initialPlaying),
    [items, setItems] = useState<CentralCharacter[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [choice, setChoice] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(false),
    [found, setFound] = useState<string[]>([]),
    [revealed, setRevealed] = useState<{
      character: CentralCharacter;
      asset: ImportedAsset;
    } | null>(null),
    [ready, setReady] = useState(false),
    [activePoint, setActivePoint] = useState<string | null>(null);
  const accountScope = useRef(captureAccountContext()).current;
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    pointer = useRef({ x: -1000, y: -1000 }),
    alive = useRef(true),
    ticket = useRef(0),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    alive.current = true;
    const old = document.activeElement as HTMLElement;
    host.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          host.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,textarea,select",
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === host.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", escape, true);
    return () => {
      alive.current = false;
      ticket.current++;
      document.removeEventListener("keydown", escape, true);
      old?.focus();
    };
  }, []);
  useEffect(() => {
    if (playing) return;
    const controller = new AbortController();
    setLoading(true);
    centralRequest(`/api/public/characters?page=${page}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.items);
          setPages(data.totalPages);
          setChoice("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            es
              ? "No se pudo abrir la biblioteca pública."
              : "Published library unavailable.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, playing, es]);
  useEffect(() => {
    if (!playing) return;
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let raf = 0,
      w = innerWidth,
      h = innerHeight,
      last = -1000;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(now: number) {
      if (now - last < 40 && !motion.matches) return;
      last = now;
      ctx!.clearRect(0, 0, w, h);
      const t = motion.matches ? 0 : now * 0.0001;
      for (let i = 0; i < 65; i++) {
        const x = ((i * 0.618034) % 1) * w + Math.sin(t + i) * 4,
          y = ((i * 0.414214) % 1) * h + Math.cos(t * 0.7 + i) * 4,
          near = Math.max(
            0,
            1 - Math.hypot(pointer.current.x - x, pointer.current.y - y) / 140,
          );
        ctx!.fillStyle = `rgba(248,230,183,${0.15 + near * 0.35})`;
        ctx!.beginPath();
        ctx!.arc(
          x + near * (pointer.current.x - x) * 0.04,
          y + near * (pointer.current.y - y) * 0.04,
          i % 7 ? 0.7 : 1.3,
          0,
          Math.PI * 2,
        );
        ctx!.fill();
      }
      points.forEach((p) => {
        const x = (p.x / 100) * w,
          y = (p.y / 100) * h,
          near = Math.max(
            0,
            1 - Math.hypot(pointer.current.x - x, pointer.current.y - y) / 180,
          ),
          radius = 35 + near * 80;
        const light = ctx!.createRadialGradient(x, y, 0, x, y, radius);
        light.addColorStop(0, `rgba(255,237,199,${0.07 + near * 0.2})`);
        light.addColorStop(1, "rgba(213,193,174,0)");
        ctx!.fillStyle = light;
        ctx!.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      });
    }
    function tick(t: number) {
      if (!document.hidden) draw(t);
      raf = requestAnimationFrame(tick);
    }
    function resize() {
      w = innerWidth;
      h = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      element!.width = w * dpr;
      element!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }
    function start() {
      cancelAnimationFrame(raf);
      resize();
      if (!motion.matches) raf = requestAnimationFrame(tick);
    }
    const move = () => {
      if (motion.matches) draw(performance.now());
    };
    start();
    window.addEventListener("resize", resize);
    motion.addEventListener("change", start);
    host.current?.addEventListener("pointermove", move);
    const node = host.current;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      motion.removeEventListener("change", start);
      node?.removeEventListener("pointermove", move);
    };
  }, [playing, points]);
  async function save() {
    try {
      const data = { version: 1 as const, points };
      if (initial.invalid || !valid(data)) throw Error();
      if(currentUserId())await persistSidecar(worldId,"discoveries",JSON.stringify(data),accountScope);else throw Error("Sign in to save personal discoveries.");
      assertAccountContext(accountScope);setSaved(true);
      setError("");
    } catch {
      setError(
        es
          ? "No se guardó. Los datos anteriores se conservaron."
          : "Could not save. Existing data was preserved.",
      );
    }
  }
  async function reveal(point: Point) {
    const state = readProgress(sidecarKey("progress",worldId));
    if (state.invalid || !canDiscover(points, state.data, point.id)) {
      setError(
        es ? "Este lugar sigue bloqueado." : "This location is still locked.",
      );
      return;
    }
    setActivePoint(point.id);
    const serial = ++ticket.current;
    setLoading(true);
    setError("");
    setRevealed(null);
    setReady(false);
    try {
      const data = await centralRequest(
        `/api/public/characters/${point.characterId}`,
      );
      const character: CentralCharacter = data.item;
      if (
        !character ||
        character.id !== point.characterId ||
        !character.active ||
        character.deleted ||
        !character.fileUrl.startsWith(`/api/public/characters/${character.id}/`)
      )
        throw Error();
      const response = await fetch(character.fileUrl, { cache: "no-store" });
      if (!response.ok) throw Error();
      const file = new File(
          [await response.blob()],
          `discovery.${character.format}`,
        ),
        info = await inspectFile(file);
      if (!alive.current || serial !== ticket.current) return;
      setRevealed({
        character,
        asset: {
          id: character.id,
          file,
          filename: file.name,
          name: character.name,
          description: character.description,
          tags: character.tags,
          source: character.source,
          createdAt: character.createdAt,
          updatedAt: character.updatedAt,
          ...info,
        },
      });
      setFound((old) => (old.includes(point.id) ? old : [...old, point.id]));
    } catch {
      if (alive.current && serial === ticket.current)
        setError(
          es
            ? "Este personaje ya no está publicado o no está disponible. Puedes seguir explorando."
            : "This character is no longer published or is unavailable. You can keep exploring.",
        );
    } finally {
      if (alive.current && serial === ticket.current) setLoading(false);
    }
  }
  return createPortal(
    <div
      ref={host}
      className={`world-discoveries ${playing ? "is-experiencing" : "is-configuring"}`}
      role="dialog"
      aria-modal="true"
      aria-label={es ? "Descubrimientos de mi mundo" : "My World discoveries"}
      tabIndex={-1}
      onPointerMove={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerDown={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
      }}
    >
      <button
        className="world-discovery-close"
        aria-label={es ? "Volver a mi mundo" : "Back to My World"}
        onClick={onClose}
      >
        ×
      </button>
      {!playing ? (
        <section className="world-discovery-config">
          <h1>{name}</h1>
          <h2>{es ? "Lugares de descubrimiento" : "Hidden discoveries"}</h2>
          <p>
            {es
              ? "Vincula personajes publicados. Estas luces se guardan solo para este mundo, en este navegador."
              : "Link published characters. These lights are saved to your account after server confirmation."}
          </p>
          {initial.invalid && (
            <p role="alert">
              {es
                ? "Configuración ilegible; no se sobrescribirá."
                : "Existing configuration could not be read and will not be overwritten."}
            </p>
          )}
          {!loading && !items.length && (
            <p>
              {es
                ? "Aún no hay personajes publicados en esta página."
                : "No published characters on this page yet."}
            </p>
          )}
          <label>
            {es ? "Personaje publicado" : "Published character"}
            <select
              value={choice}
              disabled={loading}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">—</option>
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="world-discovery-actions">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              {es ? "Anterior" : "Previous"}
            </button>
            <button
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {es ? "Siguiente" : "Next"}
            </button>
            <button
              disabled={!choice || points.length >= 12 || initial.invalid}
              onClick={() => {
                setPoints((old) => [
                  ...old,
                  {
                    id: crypto.randomUUID(),
                    characterId: choice,
                    x: 20 + ((old.length * 17) % 65),
                    y: 30 + ((old.length * 19) % 50),
                  },
                ]);
                setSaved(false);
              }}
            >
              {es ? "Añadir luz" : "Add light"}
            </button>
          </div>
          {points.map((p, index) => (
            <fieldset key={p.id}>
              <legend>
                {es ? "Luz" : "Light"} {index + 1} —{" "}
                {items.find((c) => c.id === p.characterId)?.name ||
                  p.characterId}
              </legend>
              <label>
                {es ? "Conexión requerida" : "Required discovery"}
                <select
                  aria-label={`Requirement ${index + 1}`}
                  value={
                    p.requires?.[0] ??
                    (p.requires ? "" : points[index - 1]?.id || "")
                  }
                  onChange={(e) => {
                    setPoints((old) =>
                      old.map((item) =>
                        item.id === p.id
                          ? {
                              ...item,
                              requires: e.target.value ? [e.target.value] : [],
                            }
                          : item,
                      ),
                    );
                    setSaved(false);
                  }}
                >
                  <option value="">{es ? "Ninguna" : "None"}</option>
                  {points.slice(0, index).map((previous, i) => (
                    <option key={previous.id} value={previous.id}>
                      {es ? "Luz" : "Light"} {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Objetivo" : "Objective"}
                <input
                  maxLength={160}
                  value={p.objective || ""}
                  placeholder={
                    es
                      ? "Seguir el destello dorado"
                      : "Follow the golden glimmer"
                  }
                  onChange={(e) => {
                    setPoints((old) =>
                      old.map((item) =>
                        item.id === p.id
                          ? { ...item, objective: e.target.value }
                          : item,
                      ),
                    );
                    setSaved(false);
                  }}
                />
              </label>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()} %
                  <input
                    type="number"
                    min="5"
                    max="95"
                    value={p[axis]}
                    onChange={(e) => {
                      const n = e.target.valueAsNumber;
                      if (Number.isFinite(n)) {
                        setPoints((old) =>
                          old.map((item) =>
                            item.id === p.id
                              ? {
                                  ...item,
                                  [axis]: Math.max(5, Math.min(95, n)),
                                }
                              : item,
                          ),
                        );
                        setSaved(false);
                      }
                    }}
                  />
                </label>
              ))}
              <button
                onClick={() => {
                  setPoints((old) =>
                    old
                      .filter((item) => item.id !== p.id)
                      .map((item) =>
                        item.requires
                          ? {
                              ...item,
                              requires: item.requires.filter(
                                (id) => id !== p.id,
                              ),
                            }
                          : item,
                      ),
                  );
                  setSaved(false);
                }}
              >
                {es ? "Quitar luz" : "Remove light"}
              </button>
            </fieldset>
          ))}
          <div className="world-discovery-actions">
            <button disabled={initial.invalid} onClick={save}>
              {es ? "Guardar descubrimientos" : "Save discoveries"}
            </button>
            <button
              disabled={!points.length || initial.invalid}
              onClick={() => {
                setPlaying(true);
                setError("");
              }}
            >
              {es ? "Explorar luces" : "Explore lights"}
            </button>
          </div>
          <p>
            {es
              ? "Las conversaciones y el progreso se guardan solo en este navegador. El diálogo local no está conectado a una IA."
              : "Conversations and progress stay in this browser only. Local dialogue is not connected to AI."}
          </p>
          {saved && (
            <p role="status">
              {es ? "Descubrimientos guardados." : "Discoveries saved."}
            </p>
          )}
        </section>
      ) : (
        <>
          <canvas ref={canvas} aria-hidden="true" />
          <WorldAdventure
            worldId={worldId}
            name={name}
            lore={lore}
            baseImage={baseImage}
            onConfigure={() => setPlaying(false)}
            points={points}
            onReveal={(p) => void reveal(p)}
            revealed={revealed}
            activePoint={activePoint}
            es={es}
            ready={ready}
            onReady={setReady}
          />
        </>
      )}
      {loading && (
        <p className="world-discovery-message" role="status">
          {es ? "Buscando una presencia…" : "A presence is approaching…"}
        </p>
      )}
      {error && (
        <p className="world-discovery-message" role="alert">
          {error}
        </p>
      )}
    </div>,
    document.body,
  );
}

export default function WorldDiscoveries(props:Parameters<typeof LegacyWorldDiscoveries>[0]){return <WorldCompanion {...props}/>;}
