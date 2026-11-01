import {captureAccountContext,isAccountContextCurrent} from '../account/sessionScope';
import {persistWorld} from "../account/cloudWorlds";
import AIWorldPlan from "./AIWorldPlan";
import WorldDiscoveries from "./WorldDiscoveries";
import CosmosInterface from "./CosmosInterface";
import { useAuthorAccess, requireAuthor } from "./authorAccess";
import DiscoveryPreview from "./DiscoveryPreview";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../locales";
import { loadWorlds, saveWorld, type CreatedWorld } from "./worldStore";
import {
  addConnection,
  characterNames,
  characterTypes,
  connectionTypes,
  makeCharacter,
  presets,
  removeCharacter,
  type Character,
  type Connection,
  type Content,
  type SpiritGraph,
} from "./spiritModel";
import { createSpiritScene } from "./spiritScene";
import { ExportBackup } from "./BackupControls";
import { characterWorld } from "./worldBackup";
import { getAsset } from "./uploadAssets";
import CentralLibrary from "./CentralLibrary";
import UploadCharacterModal from "./UploadCharacterModal";
import AICharacterModal from "./AICharacterModal";
import SpiritContentModal from "./SpiritContentModal";
import "./creation.css";
import "./spirit-editor.css";
export default function SpiritEditor({
  initial,
  locale,
  reduced,
  onExit,
  onWorld,
  onExploreChange,
}: {
  initial: CreatedWorld;
  locale: Locale;
  reduced: boolean;
  onExit: () => void;
  onWorld: (world: CreatedWorld) => void;
  onExploreChange?: (exploring: boolean) => void;
}) {
  const canAuthor = useAuthorAccess();
  const [authoring, setAuthoring] = useState(false);
  const [sceneControls, setSceneControls] = useState(false);
  const [worldDiscoveriesOpen, setWorldDiscoveriesOpen] = useState(true);
  const [discoveryPreview, setDiscoveryPreview] = useState(!!initial.starter);
  const hold = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  function cancelHold() {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  }
  useEffect(() => cancelHold, []);
  const es = locale === "es",
    empty: SpiritGraph = { characters: [], connections: [], contents: [] };
  const [world, setWorld] = useState(initial),
    current = useRef(initial),
    [past, setPast] = useState<CreatedWorld[]>([]),
    [future, setFuture] = useState<CreatedWorld[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [edge, setEdge] = useState<string | null>(null),
    [explore, setExplore] = useState(false),
    [trail, setTrail] = useState<string[]>([]),
    [connecting, setConnecting] = useState(false),
    [source, setSource] = useState<string | null>(null),
    [status, setStatus] = useState(""),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [failed, setFailed] = useState(false),
    [sceneryFailed, setSceneryFailed] = useState(false),
    [zoom, setZoom] = useState(1),
    [content, setContent] = useState<{ initial?: Content } | null>(null),
    [highlight, setHighlight] = useState<string[]>([]);
  useEffect(() => {
    onExploreChange?.(explore);
    return () => onExploreChange?.(false);
  }, [explore, onExploreChange]);
  const [loadedImports, setLoadedImports] = useState<string[]>([]);
  const [centralModal, setCentralModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [aiModal, setAIModal] = useState(false),
    [assetError, setAssetError] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createSpiritScene> | null>(null),
    buttons = useRef(new Map<string, HTMLButtonElement>()),
    savedVersion = useRef(initial.updatedAt),
    savingLock = useRef(false),
    actions = useRef({
      select: (_id: string, _edge?: boolean) => {},
      move: (_id: string, _p: Character["position"]) => {},
    });
  current.current = world;
  const graph = world.graph || empty,
    active = graph.characters.find((c) => c.id === selected),
    activeEdge = graph.connections.find((e) => e.id === edge),
    outgoing = active
      ? graph.connections.filter((e) => e.sourceCharacterId === active.id)
      : [],
    ownContent = active
      ? graph.contents.filter((d) => d.characterId === active.id)
      : [];
  function commit(next: CreatedWorld) {
    const before = current.current;
    setPast((p) => [...p.slice(-49), before]);
    setFuture([]);
    current.current = next;
    setWorld(next);
    setDirty(true);
    setStatus("");
  }
  function graphChange(next: SpiritGraph) {
    commit({ ...world, graph: next });
  }
  function patchCharacter(patch: Partial<Character>) {
    if (!active) return;
    graphChange({
      ...graph,
      characters: graph.characters.map((c) =>
        c.id === active.id
          ? { ...c, ...patch, updatedAt: new Date().toISOString() }
          : c,
      ),
    });
  }
  function choose(id: string, isEdge = false) {
    if (isEdge) {
      setEdge(id);
      setSelected(null);
      return;
    }
    if (id && !graph.characters.some((c) => c.id === id)) {
      setSelected(null);
      setEdge(null);
      return;
    }
    if (explore && id) {
      if (selected && selected !== id)
        setTrail((t) => [...t.slice(-19), selected]);
      engine.current?.focus(id);
    }
    setEdge(null);
    setSelected(id || null);
    if (connecting && id) {
      if (!source) {
        setSource(id);
        setStatus(
          es ? "Elige el segundo espíritu." : "Choose the second spirit.",
        );
      } else {
        const next = addConnection(graph, world.id, source, id);
        if (next) {
          graphChange({ ...graph, connections: [...graph.connections, next] });
          setEdge(next.id);
          setStatus(es ? "Camino creado." : "Path created.");
        } else
          setStatus(
            es
              ? "No se permite un destino igual, inexistente o duplicado."
              : "Self-links, missing targets or duplicate paths are not allowed.",
          );
        setConnecting(false);
        setSource(null);
      }
    }
  }
  actions.current = {
    select: choose,
    move: (id, position) => {
      const w = current.current;
      commit({
        ...w,
        graph: {
          ...w.graph!,
          characters: w.graph!.characters.map((c) =>
            c.id === id
              ? { ...c, position, updatedAt: new Date().toISOString() }
              : c,
          ),
        },
      });
    },
  };
  useEffect(() => {
    if (!host.current) return;
    try {
      engine.current = createSpiritScene(host.current, {
        select: (id, isEdge) => actions.current.select(id, isEdge),
        move: (id, p) => actions.current.move(id, p),
        anchors: (points) =>
          points.forEach((p) => {
            const b = buttons.current.get(p.id);
            b?.style.setProperty("--spirit-x", p.x + "%");
            b?.style.setProperty("--spirit-y", p.y + "%");
            b?.style.setProperty("--spirit-offset", p.offset + "px");
          }),
        fail: () => setFailed(true),
        sceneryError: () => setSceneryFailed(true),
        assetError: (id) => setAssetError(id),
        assetReady: (id) =>
          setLoadedImports((ids) => (ids.includes(id) ? ids : [...ids, id])),
      });
    } catch {
      setFailed(true);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => engine.current?.update(graph), [world.graph]);
  useEffect(() => engine.current?.select(selected, edge), [selected, edge]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !content &&
        !aiModal &&
        !uploadModal &&
        !centralModal
      ) {
        setSelected(null);
        setEdge(null);
        setSceneControls(false);
        engine.current?.stop();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [content, aiModal, uploadModal, centralModal]);
  useEffect(() => {
    if (selected && !graph.characters.some((c) => c.id === selected))
      setSelected(null);
    if (edge && !graph.connections.some((e) => e.id === edge)) setEdge(null);
  }, [graph, selected, edge]);
  useEffect(
    () =>
      engine.current?.mode(
        reduced || !!content || aiModal || uploadModal,
        explore || connecting || !!content || aiModal || uploadModal,
        explore,
      ),
    [reduced, explore, connecting, content, aiModal, uploadModal],
  );
  useEffect(() => engine.current?.zoom(zoom), [zoom]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  function undo() {
    if (!past.length) return;
    const before = current.current;
    setFuture((f) => [before, ...f].slice(0, 50));
    setWorld(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setDirty(true);
    setStatus("");
  }
  function redo() {
    if (!future.length) return;
    const before = current.current;
    setPast((p) => [...p.slice(-49), before]);
    setWorld(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
    setStatus("");
  }
  const accountScope = useRef(captureAccountContext()).current;
  async function save() {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
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
          ? "No se pudo guardar. Revisa el almacenamiento o cambios en otra pestaña."
          : "Could not save. Check storage or changes in another tab."),
      );
    setSaving(false);
    savingLock.current = false;
  }
  function mayLeave() {
    return (
      !dirty ||
      window.confirm(
        es ? "¿Salir sin guardar?" : "Leave without saving changes?",
      )
    );
  }
  function focus(id: string) {
    if (!graph.characters.some((c) => c.id === id)) return;
    choose(id);
    if (!explore) engine.current?.focus(id);
  }
  function execute() {
    if (!active) return;
    if (active.type === "portal") {
      if (active.portalWorldId) {
        const target = loadWorlds().worlds.find(
          (w) => w.id === active.portalWorldId,
        );
        if (!target) {
          setStatus(
            es
              ? "Destino local no disponible. No tienes acceso a datos remotos."
              : "Local destination unavailable. No remote data access is granted.",
          );
          return;
        }
        if (target.id === world.id) {
          setStatus(es ? "Elige otro mundo." : "Choose another world.");
          return;
        }
        if (mayLeave()) onWorld(target);
      } else {
        const path = outgoing.find(
          (e) => e.type === "portal_to" || e.type === "leads_to",
        );
        if (path) focus(path.targetCharacterId);
        else
          setStatus(
            es
              ? "Asigna un destino local o un camino al portal."
              : "Assign a local destination or an outgoing portal path.",
          );
      }
    } else if (active.type === "world") {
      const ids = outgoing.map((e) => e.targetCharacterId);
      setHighlight(ids);
      if (ids.length) focus(ids[0]);
      else
        setStatus(
          es
            ? "Este espíritu no tiene caminos salientes."
            : "This spirit has no outgoing paths yet.",
        );
    } else if (active.type === "creator") {
      if (!explore)
        setContent({
          initial: ownContent.find((d) =>
            ["note", "story", "idea"].includes(d.type),
          ),
        });
      else
        setStatus(
          es
            ? "Abre un texto de la lista de contenidos."
            : "Open a text in the content list.",
        );
    } else
      setStatus(
        es
          ? "Consulta los contenidos de este espíritu."
          : "Browse this spirit’s content below.",
      );
  }
  const relationNames = es
    ? [
        "Relacionado con",
        "Contiene",
        "Lleva a",
        "Creado a partir de",
        "Portal a",
      ]
    : ["Related To", "Contains", "Leads To", "Created From", "Portal To"];
  return (
    <section
      className={`world-editor spirit-editor${explore ? " spirit-exploring" : ""}${!active && !activeEdge ? " spirit-no-selection" : ""}`}
      aria-label={es ? "Editor de espíritus" : "Spirit editor"}
      inert={
        aiModal ||
        uploadModal ||
        centralModal ||
        worldDiscoveriesOpen ||
        !!content
      }
    >
      {(!explore || sceneControls) && (
        <header className="editor-header">
          <div>
            <p className="creation-kicker">
              BEYOND / {es ? "ESPÍRITUS LOCALES" : "LOCAL SPIRITS"}
            </p>
            <h1>{world.name}</h1>
          </div>
          <div className="editor-tools">
            <button disabled={!past.length || explore} onClick={undo}>
              {es ? "Deshacer" : "Undo"}
            </button>
            <button disabled={!future.length || explore} onClick={redo}>
              {es ? "Rehacer" : "Redo"}
            </button>
            <button
              aria-pressed={connecting}
              disabled={explore}
              onClick={() => {
                setConnecting((v) => !v);
                setSource(null);
                setStatus(
                  es
                    ? "Selecciona dos espíritus para crear un camino."
                    : "Select two spirits to create a path.",
                );
              }}
            >
              {es ? "Conectar espíritus" : "Connect spirits"}
            </button>
            <button
              aria-label={
                explore
                  ? es
                    ? "Modo de edición"
                    : "Edit Mode"
                  : es
                    ? "Modo de exploración"
                    : "Explore Mode"
              }
              title={
                explore
                  ? es
                    ? "Modo de edición"
                    : "Edit Mode"
                  : es
                    ? "Modo de exploración"
                    : "Explore Mode"
              }
              data-explore-action={explore ? "edit" : undefined}
              onClick={() => {
                if (!explore) {
                  setDiscoveryPreview(true);
                  setWorldDiscoveriesOpen(true);
                  return;
                }
                setExplore(false);
                setSelected(null);
                setEdge(null);
                setSceneControls(false);
                setConnecting(false);
                setSource(null);
              }}
            >
              {explore
                ? es
                  ? "Modo de edición"
                  : "Edit Mode"
                : es
                  ? "Modo de exploración"
                  : "Explore Mode"}
            </button>
            <button
              className="creation-primary"
              data-explore-action={explore ? "save" : undefined}
              aria-label={
                saving
                  ? es
                    ? "Guardando…"
                    : "Saving…"
                  : es
                    ? "Guardar"
                    : "Save"
              }
              title={es ? "Guardar" : "Save"}
              disabled={saving}
              onClick={save}
            >
              {saving
                ? es
                  ? "Guardando…"
                  : "Saving…"
                : es
                  ? "Guardar"
                  : "Save"}
            </button>
            {!explore && (
              <button
                onClick={() => {
                  setExplore(true);
                  setConnecting(false);
                  setSource(null);
                  setSelected(null);
                  setEdge(null);
                  setSceneControls(false);
                }}
              >
                {es ? "Exploración 3D" : "3D flight"}
              </button>
            )}
            <ExportBackup world={{ ...world, graph }} es={es} />
            {active?.uploadedAssetId && (
              <button
                onClick={async () => {
                  try {
                    const asset = await getAsset(active.uploadedAssetId!);
                    if (!asset) throw Error("missing_asset");
                    const { exportPackage, downloadPackage } =
                      await import("./worldBackup");
                    downloadPackage(
                      await exportPackage(
                        characterWorld(asset, active, { ...world, graph }),
                        "character",
                      ),
                      "character",
                    );
                    setStatus(
                      es ? "Descarga preparada." : "Download prepared.",
                    );
                  } catch {
                    setStatus(
                      es
                        ? "No se pudo exportar. Exporta el mundo completo si contiene referencias a otros personajes."
                        : "Could not export. Export the full world if this character references others.",
                    );
                  }
                }}
              >
                {es ? "Exportar personaje" : "Export Character"}
              </button>
            )}
            <button
              data-explore-action={explore ? "worlds" : undefined}
              aria-label="MY WORLDS"
              title="MY WORLDS"
              onClick={() => mayLeave() && onExit()}
            >
              MY WORLDS
            </button>
          </div>
        </header>
      )}
      {explore && (
        <CosmosInterface
          es={es}
          author={canAuthor}
          busy={saving}
          actions={[
            () => {
              engine.current?.reset();
              setSelected(null);
              setEdge(null);
            },
            () => setCentralModal(true),
            () => {
              setExplore(false);
              setConnecting(true);
              setSource(null);
            },
            save,
            () => (canAuthor ? setUploadModal(true) : setCentralModal(true)),
            () => setSceneControls((v) => !v),
          ]}
        />
      )}
      <div className="spirit-layout">
        {!explore && (
          <aside className="spirit-library">
            <h2>{es ? "Invoca una presencia" : "Summon a presence"}</h2>
            <button
              onClick={() => {
                setDiscoveryPreview(false);
                setWorldDiscoveriesOpen(true);
              }}
            >
              {es ? "Descubrimientos de mi mundo" : "My World discoveries"}
            </button>
            <button
              disabled={graph.characters.length >= 40}
              onClick={() => setCentralModal(true)}
            >
              {es ? "Biblioteca central" : "Central Library"}
            </button>
            {canAuthor && (
              <>
                <button
                  className="upload-primary-trigger"
                  disabled={graph.characters.length >= 40}
                  onClick={() => setUploadModal(true)}
                >
                  {es ? "Subir personaje" : "Upload Character"}
                </button>
                <button
                  className="ai-create-trigger"
                  disabled={graph.characters.length >= 40}
                  onClick={() => setAIModal(true)}
                >
                  CREATE A CHARACTER —{" "}
                  {es ? "Crear personaje" : "캐릭터 만들기"}
                </button>
                <AIWorldPlan es={es} name={world.name} />
                {characterTypes.map((type, i) => (
                  <button
                    className={`spirit-template template-${type}`}
                    key={type}
                    disabled={authoring || graph.characters.length >= 40}
                    onClick={async () => {
                      setAuthoring(true);
                      try {
                        await requireAuthor();
                      } catch {
                        setStatus(
                          es
                            ? "Se requiere acceso de administrador."
                            : "Administrator access is required.",
                        );
                        setAuthoring(false);
                        return;
                      }
                      const c = makeCharacter(
                        world.id,
                        type,
                        graph.characters.length,
                      );
                      c.name = characterNames[locale][i];
                      graphChange({
                        ...graph,
                        characters: [...graph.characters, c],
                      });
                      setSelected(c.id);
                      setEdge(null);
                      setAuthoring(false);
                    }}
                  >
                    <span className="spirit-template-sigil" aria-hidden="true">
                      {["✧", "❖", "✦", "◈", "✺"][i]}
                    </span>
                    {characterNames[locale][i]}
                  </button>
                ))}
                <p>
                  {es
                    ? "Los personajes son mundos. Los caminos les dan sentido."
                    : "Characters are worlds. Pathways give them purpose."}
                </p>
              </>
            )}
            {!canAuthor && (
              <p>
                {es
                  ? "Elige personajes publicados por administradores. Tus personajes guardados se conservan."
                  : "Choose administrator-published characters. Your existing saved characters are preserved."}
              </p>
            )}
            <details>
              <summary>{es ? "Ajustes del mundo" : "World settings"}</summary>
              <label>
                {es ? "Nombre del mundo" : "World name"}
                <input
                  value={world.name}
                  maxLength={100}
                  onChange={(e) => commit({ ...world, name: e.target.value })}
                />
              </label>
              <label>
                {es ? "Descripción del mundo" : "World description"}
                <textarea
                  aria-label={
                    es ? "Descripción del mundo" : "World description"
                  }
                  value={world.description}
                  maxLength={2000}
                  onChange={(e) =>
                    commit({ ...world, description: e.target.value })
                  }
                />
              </label>
            </details>
          </aside>
        )}
        <div
          className="spirit-viewport"
          inert={!!content}
          onPointerDown={(event) => {
            cancelHold();
            if (explore && event.pointerType === "touch") {
              hold.current = {
                x: event.clientX,
                y: event.clientY,
                timer: setTimeout(() => {
                  setSceneControls(true);
                  hold.current = null;
                }, 650),
              };
            }
          }}
          onPointerMove={(event) => {
            if (
              hold.current &&
              Math.hypot(
                event.clientX - hold.current.x,
                event.clientY - hold.current.y,
              ) > 8
            )
              cancelHold();
          }}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={
            explore
              ? (event) => {
                  event.preventDefault();
                  setSceneControls((v) =>
                    (event.nativeEvent as PointerEvent).pointerType === "touch"
                      ? true
                      : !v,
                  );
                }
              : undefined
          }
        >
          <div
            ref={host}
            className="spirit-canvas"
            data-loaded-assets={loadedImports
              .filter((id) => graph.characters.some((c) => c.id === id))
              .join(" ")}
            role="img"
            aria-label={es ? "Universo de espíritus 3D" : "3D spirit universe"}
          />
          {(!explore || sceneControls) && (
            <div className="spirit-view-tools">
              <button
                aria-label={es ? "Alejar" : "Zoom out"}
                onClick={() =>
                  setZoom((z) =>
                    Math.max(0.6, (engine.current?.getZoom() ?? z) - 0.2),
                  )
                }
              >
                −
              </button>
              <button
                aria-label={es ? "Acercar" : "Zoom in"}
                onClick={() =>
                  setZoom((z) =>
                    Math.min(2, (engine.current?.getZoom() ?? z) + 0.2),
                  )
                }
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  engine.current?.reset();
                }}
              >
                {es ? "Restablecer vista" : "Reset view"}
              </button>
            </div>
          )}
          {!graph.characters.length && (
            <p className="spirit-empty">
              {es
                ? "Tu universo comienza con un espíritu."
                : "Your universe begins with a spirit."}
            </p>
          )}
          {explore && sceneryFailed && (
            <p className="hybrid-scenery-error" role="status">
              {es
                ? "La ilustración no está disponible. Puedes seguir explorando."
                : "Scenery unavailable. Character exploration is still available."}
            </p>
          )}
          {failed && (
            <p className="spirit-fallback" role="status">
              {es
                ? "3D no disponible. Puedes editar y explorar con los controles accesibles."
                : "3D unavailable. Accessible controls still support editing and exploration."}
            </p>
          )}
          {(!explore || sceneControls || failed) && (
            <nav
              className={`spirit-anchors${failed ? " spirit-fallback-list" : ""}`}
              aria-label={es ? "Personajes del mundo" : "World characters"}
            >
              {graph.characters.map((c) => (
                <button
                  key={c.id}
                  ref={(b) => {
                    if (b) buttons.current.set(c.id, b);
                    else buttons.current.delete(c.id);
                  }}
                  aria-label={c.name}
                  title={c.name}
                  aria-pressed={selected === c.id}
                  className={`${selected === c.id ? "is-selected" : ""}${highlight.includes(c.id) ? " is-related" : ""}`}
                  onClick={() => choose(c.id)}
                  onKeyDown={(e) => {
                    if (explore) return;
                    const shifts: Record<string, [number, number]> = {
                      ArrowLeft: [-0.2, 0],
                      ArrowRight: [0.2, 0],
                      ArrowUp: [0, 0.2],
                      ArrowDown: [0, -0.2],
                    };
                    if (shifts[e.key]) {
                      e.preventDefault();
                      const [dx, dy] = shifts[e.key];
                      graphChange({
                        ...graph,
                        characters: graph.characters.map((item) =>
                          item.id === c.id
                            ? {
                                ...item,
                                position: {
                                  ...item.position,
                                  x: Math.max(
                                    -16,
                                    Math.min(16, item.position.x + dx),
                                  ),
                                  y: Math.max(
                                    -10,
                                    Math.min(10, item.position.y + dy),
                                  ),
                                },
                              }
                            : item,
                        ),
                      });
                    }
                  }}
                >
                  <span>{c.name}</span>
                </button>
              ))}
            </nav>
          )}
          {!explore && (
            <div className="spirit-edge-access">
              <details>
                <summary>
                  {es ? "Caminos" : "Pathways"} ({graph.connections.length})
                </summary>
                {graph.connections.map((e) => (
                  <button key={e.id} onClick={() => choose(e.id, true)}>
                    {e.label ||
                      graph.characters.find((c) => c.id === e.sourceCharacterId)
                        ?.name +
                        " → " +
                        graph.characters.find(
                          (c) => c.id === e.targetCharacterId,
                        )?.name}
                  </button>
                ))}
              </details>
            </div>
          )}
        </div>
        {(!explore || active || activeEdge) && (
          <aside className="spirit-details" inert={!!content || authoring}>
            {explore && (active || activeEdge) && (
              <div className="discovery-panel-tools">
                <button
                  aria-label={es ? "Cerrar descubrimiento" : "Close discovery"}
                  onClick={() => {
                    setSelected(null);
                    setEdge(null);
                    engine.current?.stop();
                  }}
                >
                  ×
                </button>
                <button
                  disabled={
                    !trail.some((id) =>
                      graph.characters.some((c) => c.id === id),
                    )
                  }
                  onClick={() => {
                    const valid = trail.filter((id) =>
                      graph.characters.some((c) => c.id === id),
                    );
                    const previous = valid.pop();
                    setTrail(valid);
                    if (previous) {
                      setSelected(previous);
                      setEdge(null);
                      engine.current?.focus(previous);
                    }
                  }}
                >
                  {es
                    ? "Volver al descubrimiento anterior"
                    : "Back to previous discovery"}
                </button>
              </div>
            )}
            {activeEdge ? (
              <>
                <h2>{es ? "Camino seleccionado" : "Selected pathway"}</h2>
                {explore ? (
                  <>
                    <p>
                      {activeEdge.label ||
                        relationNames[connectionTypes.indexOf(activeEdge.type)]}
                    </p>
                    <p>{activeEdge.description}</p>
                    <button onClick={() => focus(activeEdge.targetCharacterId)}>
                      {es ? "Seguir camino" : "Follow pathway"}
                    </button>
                  </>
                ) : (
                  <>
                    <label>
                      {es ? "Nombre del camino" : "Path name"}
                      <input
                        maxLength={100}
                        value={activeEdge.label}
                        onChange={(e) =>
                          graphChange({
                            ...graph,
                            connections: graph.connections.map((item) =>
                              item.id === activeEdge.id
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      {es ? "Destino del camino" : "Path target"}
                      <select
                        aria-label={es ? "Destino del camino" : "Path target"}
                        value={activeEdge.targetCharacterId}
                        onChange={(e) => {
                          const target = e.target.value;
                          if (
                            target === activeEdge.sourceCharacterId ||
                            graph.connections.some(
                              (item) =>
                                item.id !== activeEdge.id &&
                                item.sourceCharacterId ===
                                  activeEdge.sourceCharacterId &&
                                item.targetCharacterId === target,
                            )
                          ) {
                            setStatus(
                              es
                                ? "Destino no válido o duplicado."
                                : "Invalid or duplicate target.",
                            );
                            return;
                          }
                          graphChange({
                            ...graph,
                            connections: graph.connections.map((item) =>
                              item.id === activeEdge.id
                                ? { ...item, targetCharacterId: target }
                                : item,
                            ),
                          });
                        }}
                      >
                        {graph.characters
                          .filter((c) => c.id !== activeEdge.sourceCharacterId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {es ? "Tipo de camino" : "Path type"}
                      <select
                        aria-label={es ? "Tipo de camino" : "Path type"}
                        value={activeEdge.type}
                        onChange={(e) =>
                          graphChange({
                            ...graph,
                            connections: graph.connections.map((item) =>
                              item.id === activeEdge.id
                                ? {
                                    ...item,
                                    type: e.target.value as Connection["type"],
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        {connectionTypes.map((type, i) => (
                          <option key={type} value={type}>
                            {relationNames[i]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {es ? "Descripción del camino" : "Path description"}
                      <textarea
                        aria-label={
                          es ? "Descripción del camino" : "Path description"
                        }
                        maxLength={1000}
                        value={activeEdge.description}
                        onChange={(e) =>
                          graphChange({
                            ...graph,
                            connections: graph.connections.map((item) =>
                              item.id === activeEdge.id
                                ? { ...item, description: e.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      onClick={() => {
                        graphChange({
                          ...graph,
                          connections: graph.connections.filter(
                            (e) => e.id !== activeEdge.id,
                          ),
                        });
                        setEdge(null);
                      }}
                    >
                      {es ? "Eliminar camino" : "Delete pathway"}
                    </button>
                  </>
                )}
              </>
            ) : active ? (
              <>
                <p className="creation-kicker">
                  {characterNames[locale][characterTypes.indexOf(active.type)]}
                </p>
                <h2>{active.name}</h2>
                {explore && active.uploadedAssetId && (
                  <DiscoveryPreview id={active.uploadedAssetId} es={es} />
                )}
                {active.centralCharacterId && (
                  <p>
                    {es
                      ? "Copia de biblioteca central"
                      : "Central library snapshot"}{" "}
                    · v{active.centralVersion}.{" "}
                    {es
                      ? "La copia local conserva su aspecto y sus conexiones."
                      : "Local appearance and connections remain independent of central updates."}
                  </p>
                )}
                {active.uploadedAssetId && (
                  <p>
                    {es
                      ? "Archivo importado · Eliminar este espíritu no elimina el archivo original."
                      : "Imported asset · Removing this spirit does not delete its original file."}
                    {!loadedImports.includes(active.id) &&
                      assetError !== active.id &&
                      (es ? " Cargando archivo…" : " Loading asset…")}
                    {assetError === active.id &&
                      (es
                        ? " El archivo no está disponible en este navegador."
                        : " File unavailable in this browser.")}
                  </p>
                )}
                {active.sourceUrl && (
                  <a
                    href={active.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {es ? "Fuente / creador" : "Source / creator"}
                  </a>
                )}
                {active.imageUrl && (
                  <div className="ai-character-info">
                    <img
                      src={active.imageUrl}
                      alt={active.name}
                      onError={() => setAssetError(active.id)}
                    />
                    {assetError === active.id && (
                      <p role="alert">
                        {es
                          ? "Imagen privada no disponible. Inicia sesión para recargarla; no se regenerará automáticamente."
                          : "Private image unavailable. Sign in to reload it; it will not regenerate automatically."}
                      </p>
                    )}
                    <p>
                      {es
                        ? "Imagen generada en 2.5D; no es un modelo articulado."
                        : "Generated image in 2.5D; not a rigged model."}
                    </p>
                    <p>{active.personality}</p>
                    <p>{active.abilities}</p>
                  </div>
                )}
                <p className="spirit-description">{active.description}</p>
                {active.type === "custom" && active.role && (
                  <p>{active.role}</p>
                )}
                <button className="creation-primary" onClick={execute}>
                  {es ? "Explorar / ejecutar" : "Explore / execute"}
                </button>
                {!explore && (
                  <details open>
                    <summary>{es ? "Editar espíritu" : "Edit spirit"}</summary>
                    <label>
                      {es ? "Nombre del espíritu" : "Spirit name"}
                      <input
                        maxLength={100}
                        value={active.name}
                        onChange={(e) =>
                          patchCharacter({ name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {es ? "Descripción" : "Description"}
                      <textarea
                        aria-label={es ? "Descripción" : "Description"}
                        maxLength={2000}
                        value={active.description}
                        onChange={(e) =>
                          patchCharacter({ description: e.target.value })
                        }
                      />
                    </label>
                    {active.assetId && (
                      <>
                        {(
                          [
                            [
                              es ? "Personalidad" : "Personality",
                              "personality",
                              2000,
                            ],
                            [
                              es
                                ? "Descripción de la apariencia"
                                : "Appearance description",
                              "appearancePrompt",
                              3000,
                            ],
                            [
                              es ? "Habilidades" : "Abilities",
                              "abilities",
                              2000,
                            ],
                          ] as const
                        ).map(([label, key, max]) => (
                          <label key={key}>
                            {label}
                            <textarea
                              aria-label={label}
                              maxLength={max}
                              value={active[key] || ""}
                              onChange={(e) =>
                                patchCharacter({ [key]: e.target.value })
                              }
                            />
                          </label>
                        ))}
                        <p>
                          {es
                            ? "Editar estos datos no regenera ni cambia la imagen guardada."
                            : "Editing this information does not regenerate or replace the saved image."}
                        </p>
                      </>
                    )}
                    <label>
                      {es ? "Tipo" : "Type"}
                      <select
                        aria-label={es ? "Tipo" : "Type"}
                        value={active.type}
                        onChange={(e) =>
                          patchCharacter({
                            type: e.target.value as Character["type"],
                          })
                        }
                      >
                        <AIWorldPlan es={es} name={world.name} />
                {characterTypes.map((type, i) => (
                          <option key={type} value={type}>
                            {characterNames[locale][i]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {es ? "Aspecto" : "Appearance"}
                      <select
                        aria-label={es ? "Aspecto" : "Appearance"}
                        value={active.appearance.preset}
                        onChange={(e) =>
                          patchCharacter({
                            appearance: {
                              ...active.appearance,
                              preset: e.target
                                .value as (typeof presets)[number],
                            },
                          })
                        }
                      >
                        {presets.map((p) => (
                          <option key={p} value={p}>
                            {es
                              ? {
                                  crystal: "Cristal",
                                  starlight: "Luz estelar",
                                  ember: "Ámbar",
                                }[p]
                              : p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {es ? "Color" : "Color"}
                      <input
                        type="color"
                        value={active.appearance.color}
                        onChange={(e) =>
                          patchCharacter({
                            appearance: {
                              ...active.appearance,
                              color: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      {es ? "Escala" : "Scale"}
                      <input
                        type="number"
                        min=".4"
                        max="2"
                        step=".1"
                        value={active.appearance.scale}
                        onChange={(e) => {
                          if (Number.isFinite(e.target.valueAsNumber))
                            patchCharacter({
                              appearance: {
                                ...active.appearance,
                                scale: Math.max(
                                  0.4,
                                  Math.min(2, e.target.valueAsNumber),
                                ),
                              },
                            });
                        }}
                      />
                    </label>
                    {(["x", "y", "z"] as const).map((axis) => (
                      <label key={`rotation-${axis}`}>
                        {es ? "Rotación" : "Rotation"} {axis.toUpperCase()} (°)
                        <input
                          type="number"
                          min="-180"
                          max="180"
                          step="1"
                          aria-label={`${es ? "Rotación" : "Rotation"} ${axis.toUpperCase()}`}
                          value={active.appearance.rotation?.[axis] ?? 0}
                          onChange={(event) => {
                            const n = event.target.valueAsNumber;
                            if (Number.isFinite(n))
                              patchCharacter({
                                appearance: {
                                  ...active.appearance,
                                  rotation: {
                                    x: 0,
                                    y: 0,
                                    z: 0,
                                    ...active.appearance.rotation,
                                    [axis]: Math.max(-180, Math.min(180, n)),
                                  },
                                },
                              });
                          }}
                        />
                      </label>
                    ))}
                    {(["x", "y", "z"] as const).map((axis) => (
                      <label key={axis}>
                        {axis.toUpperCase()}
                        <input
                          type="number"
                          step=".1"
                          min={axis === "x" ? -16 : axis === "y" ? -10 : -3}
                          max={axis === "x" ? 16 : axis === "y" ? 10 : 3}
                          value={Math.round(active.position[axis] * 100) / 100}
                          onChange={(e) => {
                            const n = e.target.valueAsNumber,
                              limit = axis === "x" ? 16 : axis === "y" ? 10 : 3;
                            if (Number.isFinite(n))
                              patchCharacter({
                                position: {
                                  ...active.position,
                                  [axis]: Math.max(-limit, Math.min(limit, n)),
                                },
                              });
                          }}
                        />
                      </label>
                    ))}
                    {active.type === "custom" && (
                      <label>
                        {es ? "Rol personalizado" : "Custom role"}
                        <input
                          maxLength={200}
                          value={active.role || ""}
                          onChange={(e) =>
                            patchCharacter({ role: e.target.value })
                          }
                        />
                      </label>
                    )}
                    <button
                      onClick={() => {
                        if (
                          graph.characters.length >= 40 ||
                          graph.contents.length + ownContent.length > 200
                        ) {
                          setStatus(
                            es
                              ? "Límite de capacidad alcanzado."
                              : "Capacity limit reached.",
                          );
                          return;
                        }
                        const now = new Date().toISOString();
                        const clone = {
                          ...active,
                          id: crypto.randomUUID(),
                          name:
                            active.name.slice(0, 94) +
                            (es ? " copia" : " copy"),
                          position: {
                            ...active.position,
                            x:
                              active.position.x > 14.5
                                ? active.position.x - 1.5
                                : active.position.x + 1.5,
                          },
                          contentIds: [] as string[],
                          createdAt: now,
                          updatedAt: now,
                        };
                        const copies = ownContent.map((d) => ({
                          ...d,
                          id: crypto.randomUUID(),
                          characterId: clone.id,
                          createdAt: now,
                          updatedAt: now,
                        }));
                        clone.contentIds = copies.map((d) => d.id);
                        graphChange({
                          ...graph,
                          characters: [...graph.characters, clone],
                          contents: [...graph.contents, ...copies],
                        });
                        setSelected(clone.id);
                      }}
                    >
                      {es ? "Duplicar espíritu" : "Duplicate spirit"}
                    </button>
                    <button
                      onClick={() => {
                        graphChange(removeCharacter(graph, active.id));
                        setSelected(null);
                      }}
                    >
                      {es ? "Eliminar espíritu" : "Delete spirit"}
                    </button>
                  </details>
                )}
                <h3>{es ? "Caminos conectados" : "Connected pathways"}</h3>
                {outgoing.map((e) => (
                  <button
                    key={e.id}
                    className="spirit-path-action"
                    onClick={() => focus(e.targetCharacterId)}
                  >
                    {e.label || relationNames[connectionTypes.indexOf(e.type)]}{" "}
                    →{" "}
                    {
                      graph.characters.find((c) => c.id === e.targetCharacterId)
                        ?.name
                    }
                  </button>
                ))}
                {graph.connections
                  .filter((e) => e.targetCharacterId === active.id)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => focus(e.sourceCharacterId)}
                    >
                      {relationNames[connectionTypes.indexOf(e.type)]} ·{" "}
                      {es ? "Desde" : "From"}:{" "}
                      {
                        graph.characters.find(
                          (c) => c.id === e.sourceCharacterId,
                        )?.name
                      }
                    </button>
                  ))}
                {!outgoing.length && (
                  <p>{es ? "Sin caminos salientes." : "No outgoing paths."}</p>
                )}
                {!explore && (
                  <>
                    <button
                      onClick={() => {
                        setConnecting(true);
                        setSource(active.id);
                        setStatus(
                          es
                            ? "Elige el espíritu de destino."
                            : "Choose the target spirit.",
                        );
                      }}
                    >
                      {es ? "Añadir camino" : "Add pathway"}
                    </button>
                    <label>
                      {es ? "Destino del camino" : "Path target"}
                      <select
                        aria-label={es ? "Destino del camino" : "Path target"}
                        defaultValue=""
                        key={active.id}
                        onChange={(e) => {
                          const c = addConnection(
                            graph,
                            world.id,
                            active.id,
                            e.target.value,
                          );
                          if (c) {
                            graphChange({
                              ...graph,
                              connections: [...graph.connections, c],
                            });
                            setStatus(es ? "Camino creado." : "Path created.");
                          } else
                            setStatus(
                              es
                                ? "Destino no válido o camino duplicado."
                                : "Invalid target or duplicate path.",
                            );
                          e.target.value = "";
                        }}
                      >
                        <option value="">{es ? "Elegir…" : "Choose…"}</option>
                        {graph.characters
                          .filter((c) => c.id !== active.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {active.type === "portal" && !explore && (
                  <label>
                    {es ? "Mundo local de destino" : "Destination local world"}
                    <select
                      aria-label={
                        es
                          ? "Mundo local de destino"
                          : "Destination local world"
                      }
                      value={active.portalWorldId || ""}
                      onChange={(e) =>
                        patchCharacter({
                          portalWorldId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">
                        {es ? "Sin destino" : "No destination"}
                      </option>
                      {loadWorlds()
                        .worlds.filter((w) => w.id !== world.id)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <h3>
                  {es ? "Contenido" : "Content"} ({ownContent.length})
                </h3>
                {!explore && (
                  <button
                    disabled={graph.contents.length >= 200}
                    onClick={() => setContent({})}
                  >
                    {es ? "Añadir contenido" : "Add content"}
                  </button>
                )}
                {ownContent.map((d) => (
                  <article key={d.id} className="spirit-content">
                    <h4>{d.title}</h4>
                    <p>{d.body}</p>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noopener noreferrer">
                        {es ? "Abrir original" : "Open original"}
                      </a>
                    )}
                    {d.sourceUrl && (
                      <a
                        href={d.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {es ? "Fuente" : "Source"}
                      </a>
                    )}
                    {d.referenceId && (
                      <button onClick={() => focus(d.referenceId!)}>
                        {es ? "Visitar espíritu" : "Visit spirit"}
                      </button>
                    )}
                    {!explore && (
                      <>
                        <button onClick={() => setContent({ initial: d })}>
                          {es ? "Editar contenido" : "Edit content"}
                        </button>
                        <button
                          onClick={() =>
                            graphChange({
                              ...graph,
                              contents: graph.contents.filter(
                                (item) => item.id !== d.id,
                              ),
                              characters: graph.characters.map((c) => ({
                                ...c,
                                contentIds: c.contentIds.filter(
                                  (id) => id !== d.id,
                                ),
                              })),
                            })
                          }
                        >
                          {es ? "Eliminar contenido" : "Delete content"}
                        </button>
                      </>
                    )}
                  </article>
                ))}
              </>
            ) : (
              <>
                <h2>
                  {es
                    ? "Cada espíritu contiene un mundo"
                    : "Every spirit holds a world"}
                </h2>
                <p>
                  {es
                    ? "Selecciona un personaje para descubrir su propósito, contenido y caminos."
                    : "Select a character to discover its purpose, content and pathways."}
                </p>
              </>
            )}
          </aside>
        )}
      </div>
      {!explore && (
        <footer className="editor-footer">
          <span>
            {es
              ? "Solo en este navegador · Sin publicación ni sincronización"
              : "This browser only · No publishing or synchronization"}
          </span>
          <span role="status">
            {status ||
              (dirty ? (es ? "Cambios sin guardar" : "Unsaved changes") : "")}
          </span>
        </footer>
      )}
      {worldDiscoveriesOpen && (
        <WorldDiscoveries
          worldId={world.id}
          name={world.name}
          lore={world.description}
          starter={world.starter}
          initialPlaying={discoveryPreview}
          es={es}
          onClose={() => setWorldDiscoveriesOpen(false)}
        />
      )}
      {centralModal && (
        <CentralLibrary
          locale={locale}
          worldId={world.id}
          index={graph.characters.length}
          onClose={() => setCentralModal(false)}
          onPlace={(c) => {
            if (graph.characters.length >= 40) return;
            graphChange({ ...graph, characters: [...graph.characters, c] });
            setSelected(c.id);
            setEdge(null);
            setCentralModal(false);
          }}
        />
      )}
      {uploadModal && canAuthor && (
        <UploadCharacterModal
          locale={locale}
          worldId={world.id}
          worldName={world.name}
          index={graph.characters.length}
          currentCharacters={graph.characters}
          onClose={() => setUploadModal(false)}
          onPlace={(c, contents = []) => {
            if (
              graph.characters.length >= 40 ||
              graph.contents.length + contents.length > 200
            ) {
              setStatus(
                es
                  ? "Límite de contenido alcanzado."
                  : "Content limit reached.",
              );
              return;
            }
            graphChange({
              ...graph,
              characters: [...graph.characters, c],
              contents: [...graph.contents, ...contents],
            });
            setSelected(c.id);
            setEdge(null);
            setUploadModal(false);
          }}
        />
      )}
      {aiModal && canAuthor && (
        <AICharacterModal
          locale={locale}
          worldId={world.id}
          index={graph.characters.length}
          onClose={() => setAIModal(false)}
          onUse={(c, d) => {
            if (
              graph.characters.length >= 40 ||
              (d && graph.contents.length >= 200)
            ) {
              setStatus(
                es
                  ? "Límite de capacidad alcanzado."
                  : "Capacity limit reached.",
              );
              return;
            }
            graphChange({
              ...graph,
              characters: [...graph.characters, c],
              contents: d ? [...graph.contents, d] : graph.contents,
            });
            setSelected(c.id);
            setEdge(null);
            setAIModal(false);
          }}
        />
      )}
      {content && active && (
        <SpiritContentModal
          locale={locale}
          character={active}
          characters={graph.characters}
          initial={content.initial}
          onClose={() => setContent(null)}
          onSave={(d) => {
            const exists = graph.contents.some((item) => item.id === d.id);
            graphChange({
              ...graph,
              contents: exists
                ? graph.contents.map((item) => (item.id === d.id ? d : item))
                : [...graph.contents, d],
              characters: graph.characters.map((c) =>
                c.id === active.id
                  ? { ...c, contentIds: [...new Set([...c.contentIds, d.id])] }
                  : c,
              ),
            });
            setContent(null);
          }}
        />
      )}
    </section>
  );
}
