import {fetchWorld} from '../features/account/cloudWorlds';
import {useAuthorAccess} from "../features/creation/authorAccess";
import {useAccount} from "../features/account/AccountProvider";
import {Link} from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Locale } from "../locales";
import { useUniverse } from "../features/content/UniverseProvider";
import { Overlay } from "../components/Overlay";
import { read } from "../lib/storage";
import "./hidden-worlds-page.css";
import { useSearchParams } from "react-router-dom";
import BackupImport, {
  ExportBackup,
} from "../features/creation/BackupControls";
import CreateWorldModal from "../features/creation/CreateWorldModal";
const ConnectHub = lazy(()=>import('../features/connect/ConnectHub'));
const SpiritEditor = lazy(() => import("../features/creation/SpiritEditor"));
import WorldEditor from "../features/creation/WorldEditor";
import { loadWorlds, type CreatedWorld } from "../features/creation/worldStore";
const areas = [
  {
    id: "explore",
    name: "EXPLORE",
    x: 0.16,
    y: 0.49,
    color: "#64fff0",
    polygon: "2,29 26,26 30,77 3,81",
  },
  {
    id: "create",
    name: "CREATE",
    x: 0.41,
    y: 0.52,
    color: "#ffcd75",
    polygon: "31,37 49,37 52,79 30,79",
  },
  {
    id: "connect",
    name: "CONNECT",
    x: 0.65,
    y: 0.54,
    color: "#79dfff",
    polygon: "53,38 78,37 80,80 54,83",
  },
  {
    id: "saved",
    name: "MY WORLDS",
    x: 0.89,
    y: 0.55,
    color: "#ffe5ac",
    polygon: "81,28 100,24 100,83 81,83",
  },
];
type Draft = { name: string; description: string };
const validDraft = (v: unknown): v is Draft =>
  !!v &&
  typeof v === "object" &&
  "name" in v &&
  typeof v.name === "string" &&
  "description" in v &&
  typeof v.description === "string";
export default function HiddenWorldsPage({
  locale,
  reduced,
  simple,
  blocked,
  onDiscovery,
  onSaved,
  onBack,
  onExploreChange,
}: {
  locale: Locale;
  reduced: boolean;
  simple: boolean;
  blocked: boolean;
  onDiscovery: (id: string) => void;
  onSaved: () => void;
  onBack: () => void;
  onExploreChange?: (exploring: boolean) => void;
}) {
  const account=useAccount(),author=useAuthorAccess();
  const { discoveries } = useUniverse(),
    es = locale === "es";
  const [active, setActive] = useState<string | null>(null),
    [panel, setPanel] = useState<string | null>(()=>new URLSearchParams(location.search).get("create")||sessionStorage.getItem("beyond:creation-intent")?"create":null),
    [overview, setOverview] = useState(false),
    [failed, setFailed] = useState(false);
  const [draft] = useState<Draft>(() =>
    read("hidden-world-draft", { name: "", description: "" }, validDraft),
  );
  const [legacy, setLegacy] = useState(false);
  const [stored, setStored] = useState(loadWorlds);
  const [params, setParams] = useSearchParams();
  const editorId = params.get("creation");
  const [worldError,setWorldError]=useState(''),[worldReading,setWorldReading]=useState(false),[worldRetry,setWorldRetry]=useState(0);
  const [hydratedWorld,setHydratedWorld]=useState<{id:string;epoch:number}|null>(null);
  useEffect(()=>{
    setWorldReading(false);setWorldError('');setHydratedWorld(null);
    if(!editorId||!account.user||account.loading)return;
    let live=true;
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(editorId)){setWorldError('Invalid world link.');return;}
    setWorldReading(true);
    fetchWorld(editorId).then(()=>{
      if(live){setStored(loadWorlds());setHydratedWorld({id:editorId,epoch:account.epoch});}
    }).catch(e=>{if(live)setWorldError(e instanceof Error?e.message:'World data could not load. Saved data is preserved.');})
      .finally(()=>{if(live)setWorldReading(false);});
    return()=>{live=false;};
  },[editorId,account.user?.id,account.loading,account.epoch,worldRetry]);
  const mediaReady=hydratedWorld?.id===editorId&&hydratedWorld.epoch===account.epoch;
  const openingWorld=account.loading||worldReading||!!(account.user&&!mediaReady&&!worldError);
  const editorWorld = (account.user?mediaReady:author) && !account.loading ? stored.worlds.find((w) => w.id === editorId) : undefined;
  function openWorld(world: CreatedWorld) {
    setPanel(null);
    setStored(loadWorlds());
    const next = new URLSearchParams(params);
    next.set("creation", world.id);
    setParams(next);
  }
  function closeEditor() {
    setStored(loadWorlds());
    const next = new URLSearchParams(params);
    next.delete("creation");
    setParams(next);
    setPanel("saved");
  }
  useEffect(() => {
    const refresh = () => setStored(loadWorlds());
    window.addEventListener("storage", refresh);
    window.addEventListener("beyond-worlds", refresh);
    return () => {window.removeEventListener("storage", refresh);window.removeEventListener("beyond-worlds", refresh);};
  }, []);
  useEffect(()=>setStored(loadWorlds()),[account.loading,account.user]);
  const creationTrigger = useRef<SVGGElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    mode = useRef({ active, reduced, simple, blocked: blocked || !!panel });
  mode.current = { active, reduced, simple, blocked: blocked || !!panel };
  useEffect(() => {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let frame = 0,
      last = 0,
      old = "",
      width = 1,
      height = 1;
    const resize = () => {
      const r = c.getBoundingClientRect();
      width = r.width;
      height = r.height;
      const d = Math.min(devicePixelRatio, 1.25);
      c.width = width * d;
      c.height = height * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      old = "";
    };
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    resize();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const m = mode.current,
        key = `${m.active}|${m.blocked}|${width}|${height}`;
      if (
        document.hidden ||
        (m.reduced && key === old) ||
        (!m.reduced && now - last < 1000 / 30)
      )
        return;
      old = key;
      last = now;
      const time = m.reduced || m.blocked ? 0 : now / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";
      areas.forEach((a, index) => {
        const x = a.x * width,
          y = a.y * height,
          selected = m.active === a.id && !m.blocked;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, width * 0.09);
        glow.addColorStop(0, a.color + (selected ? "80" : "22"));
        glow.addColorStop(1, a.color + "00");
        ctx.fillStyle = glow;
        ctx.fillRect(
          x - width * 0.1,
          y - width * 0.1,
          width * 0.2,
          width * 0.2,
        );
        ctx.strokeStyle = a.color;
        ctx.shadowColor = a.color;
        ctx.shadowBlur = selected ? 18 : 8;
        for (let ring = 0; ring < 3; ring++) {
          ctx.globalAlpha = (selected ? 0.65 : 0.2) * (1 - ring * 0.2);
          ctx.lineWidth = selected ? 2 : 1;
          ctx.beginPath();
          ctx.ellipse(
            x,
            y,
            width * (0.025 + ring * 0.015),
            height * (0.036 + ring * 0.012),
            time * (index % 2 ? -0.22 : 0.18) + ring,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        if (!m.reduced)
          for (let i = 0; i < (m.simple ? 16 : 35); i++) {
            const phase = (time * 0.12 + i * 0.618) % 1,
              angle = i * 2.4 + time * (index % 2 ? -0.3 : 0.3),
              radius = width * (0.008 + phase * 0.07);
            ctx.globalAlpha = (1 - phase) * (selected ? 0.9 : 0.38);
            ctx.fillStyle = a.color;
            ctx.beginPath();
            ctx.arc(
              x + Math.cos(angle) * radius,
              y + Math.sin(angle) * radius * 0.6,
              selected ? 1.8 : 1.1,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#a8e8ff";
      ctx.lineWidth = 1;
      // Shared energy flows, staying over the painted island connections.
      for (let lane = 0; lane < 3; lane++) {
        ctx.beginPath();
        for (let j = 0; j < 45; j++) {
          const t = j / 44,
            x = width * (0.56 + t * 0.17),
            y =
              height * (0.52 + Math.sin(t * Math.PI * 2 + time + lane) * 0.012);
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [editorId]);
  function choose(id: string) {
    setActive(id);
    setLegacy(false);
    setStored(loadWorlds());
    if(id==='connect'){const next=new URLSearchParams(params);next.set('connect','1');setParams(next);return;}
    setPanel(id);
  }
  if (editorWorld?.version === 2)
    return (
      <Suspense
        fallback={
          <p className="scene-loading">
            {es ? "Abriendo espíritus…" : "Opening spirits…"}
          </p>
        }
      >
        <SpiritEditor
          key={editorWorld.id}
          initial={editorWorld}
          onExploreChange={onExploreChange}
          locale={locale}
          reduced={reduced}
          onExit={closeEditor}
          onWorld={openWorld}
        />
      </Suspense>
    );
  if (editorWorld)
    return (
      <WorldEditor
        key={editorWorld.id}
        initial={editorWorld}
        locale={locale}
        onExit={closeEditor}
      />
    );
  if(params.get('connect')==='1')return <Suspense fallback={<p className="scene-loading">Opening CONNECT…</p>}><ConnectHub es={es} key={account.epoch+':'+(account.user?.id||'guest')} onBack={()=>{const next=new URLSearchParams(params);next.delete('connect');next.delete('connectGroup');setParams(next);}} onCreate={()=>{const next=new URLSearchParams(params);next.delete('connect');next.delete('connectGroup');setParams(next);setPanel('create');}}/></Suspense>;
  return (
    <section
      className={`hidden-world-page${overview ? " hidden-overview" : ""}`}
      aria-label="Hidden Worlds"
    >
      <div className="hidden-panorama" inert={blocked || !!panel}>
        <div className="hidden-artboard">
          <img
            src="/hidden-worlds-reference.png"
            width="1536"
            height="1024"
            alt={
              es
                ? "Mundos flotantes: portal, cristal, arcos conectados y biblioteca"
                : "Floating realms: portal, crystal, connected arches and library"
            }
            onError={() => setFailed(true)}
            draggable="false"
          />
          <canvas ref={canvas} aria-hidden="true" />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="hidden-hit-map"
            aria-label={es ? "Elige una experiencia" : "Choose an experience"}
          >
            {areas.map((a) => (
              <g
                key={a.id}
                ref={a.id === "create" ? creationTrigger : undefined}
                role="button"
                tabIndex={0}
                aria-label={a.name}
                onPointerEnter={() => setActive(a.id)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(a.id)}
                onBlur={() => setActive(null)}
                onClick={(e) => {
                  e.currentTarget.focus();
                  choose(a.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(a.id);
                  }
                }}
              >
                <polygon
                  points={a.polygon}
                  style={{ "--area-color": a.color } as React.CSSProperties}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="hidden-controls" inert={blocked || !!panel}>
        <button onClick={onBack}>
          {es ? "Volver a los seis mundos" : "Back to six worlds"}
        </button>
        <button
          className="hidden-overview-toggle"
          onClick={() => setOverview((v) => !v)}
        >
          {es
            ? overview
              ? "Explorar panorama"
              : "Ver imagen completa"
            : overview
              ? "Explore panorama"
              : "View whole image"}
        </button>
      </div>
      {failed && (
        <p className="hidden-load-error" role="alert">
          {es
            ? "No se pudo cargar la imagen. Recarga la página."
            : "Image could not load. Reload the page."}
        </p>
      )}
      {editorId && !editorWorld && <div className="hidden-load-error" role={openingWorld?'status':'alert'}>
        {openingWorld?'Opening your saved world…':account.error?'Account/world service is temporarily unavailable. Your saved world has not been deleted.':!account.user&&!author?'Sign in to open your saved world.':worldError||'This world is unavailable in this account or browser. No saved data was deleted.'}
        {!openingWorld&&<><button onClick={()=>{if(account.error)void account.reload();else setWorldRetry(v=>v+1);}}>Retry world</button>{!account.user&&!author&&<Link to="/login">Log In</Link>}<button onClick={closeEditor}>Go back</button></>}
      </div>}
      {panel === "create" && (
        <CreateWorldModal
          locale={locale}
          initial={legacy ? draft : undefined}
          onCancel={() => {
            setPanel(null);
            requestAnimationFrame(() => creationTrigger.current?.focus());
          }}
          onCreated={openWorld}
        />
      )}
      {panel && panel !== "create" && (
        <Overlay
          title={areas.find((a) => a.id === panel)!.name}
          closeLabel={es ? "Cerrar" : "Close"}
          onClose={() => setPanel(null)}
        >
          {panel === "explore" ? (
            <>
              <p>
                {es
                  ? "Descubre el contenido público publicado en BEYOND. La publicación de mundos de visitantes aún no está disponible."
                  : "Discover BEYOND’s published public content. Visitor-created world publishing is not available yet."}
              </p>
              <div className="hidden-discoveries">
                {discoveries.length ? (
                  discoveries.map((d) => (
                    <button key={d.id} onClick={() => onDiscovery(d.id)}>
                      {d.title[locale]}
                    </button>
                  ))
                ) : (
                  <p>
                    {es
                      ? "Aún no hay descubrimientos publicados."
                      : "No published discoveries yet."}
                  </p>
                )}
              </div>
            </>
          ) : panel === "saved" ? (
            <>
              <p>
                {es
                  ? "Tus borradores locales y descubrimientos guardados."
                  : "Your local drafts and saved discoveries."}
              </p>
              {stored.error && (
                <p role="alert">
                  {es
                    ? "No se pueden leer los mundos guardados. Los datos existentes se han conservado."
                    : "Could not read saved worlds. Existing data has been preserved."}
                </p>
              )}
              <BackupImport locale={locale} kind="world" onWorld={openWorld} />
              <p>
                {es
                  ? "La copia incluye archivos, notas y URL personales. Guarda el ZIP en un lugar privado."
                  : "Backups include original files, personal notes and URLs. Store ZIP files privately."}
              </p>
              <div className="creation-world-list">
                {(account.user||author) && stored.worlds.map((w) => (
                  <div key={w.id}>
                    <button onClick={() => openWorld(w)}>
                      <strong>{w.name}</strong>
                      <small>{w.description}</small>
                      <small>
                        {w.version === 2
                          ? w.graph?.characters.length
                          : w.objects.length}{" "}
                        {w.version === 2
                          ? es
                            ? "espíritus"
                            : "spirits"
                          : es
                            ? "objetos"
                            : "objects"}
                      </small>
                    </button>
                    <ExportBackup world={w} es={es} />
                  </div>
                ))}
              </div>
              {!account.user&&!author&&<p>Your local worlds are preserved. <Link to="/login">Log In</Link> to access account worlds, or <Link to="/register">Create Free Account</Link>.</p>}
              {!stored.worlds.length && !stored.error && (
                <p>
                  {es
                    ? "Crea tu primer mundo desde el cristal."
                    : "Create your first world at the crystal."}
                </p>
              )}
              {draft.name ? (
                <button
                  onClick={() => {
                    setLegacy(true);
                    setPanel("create");
                  }}
                >
                  {draft.name}
                </button>
              ) : (
                <p>{es ? "Aún no hay borradores." : "No local drafts yet."}</p>
              )}
              <button
                onClick={() => {
                  setPanel(null);
                  onSaved();
                }}
              >
                {es
                  ? "Abrir descubrimientos guardados"
                  : "Open saved discoveries"}
              </button>
            </>
          ) : (
            <p>
              {es
                ? "La conexión entre mundos de usuarios requiere permisos del servidor. Esta función aún no está disponible; no se ha creado ninguna conexión."
                : "Connecting user worlds requires server-managed permissions. This feature is not available yet; no connection has been created."}
            </p>
          )}
        </Overlay>
      )}
    </section>
  );
}
