import {captureAccountContext,assertAccountContext} from '../account/sessionScope';
import {sidecarKey,persistSidecar} from "../account/cloudWorlds";
import {currentUserId} from "../account/sessionScope";
import WorldImageEditor from "./WorldImageEditor";
import {workersDialogue,workersCapabilities,aiMessage} from "./workersDialogue";
import CharacterChat from "./CharacterChat";
import { useEffect, useRef, useState } from "react";
import type { CentralCharacter } from "./centralLibrary";
import type { ImportedAsset } from "./uploadAssets";
import AssetPreview from "./AssetPreview";
import {
  readProgress,
  type DiscoveryProgress,
  type DiscoveryPoint as Point,
  canDiscover,
  completeObjective,
  hasObjectiveClue,
  conversationKey,
  conversationMessages,
} from "./worldDiscoveryProgress";
import "./world-adventure.css";

export default function WorldAdventure({
  worldId,
  name,
  points,
  onReveal,
  revealed,
  activePoint,
  es,
  onReady,
  ready,
  lore = "",
  onConfigure,
  baseImage,
}: {
  worldId: string;
  name: string;
  points: Point[];
  onReveal: (p: Point) => void;
  revealed: { character: CentralCharacter; asset: ImportedAsset } | null;
  activePoint: string | null;
  es: boolean;
  onReady: (value: boolean) => void;
  ready: boolean;
  lore?: string;
  onConfigure: () => void;
  baseImage?:{url:string;format:string}|null;
}) {
  const [aiConnected,setAIConnected]=useState(false);
  useEffect(()=>{let alive=true;workersCapabilities().then(c=>{if(alive)setAIConnected(!!c?.configured);}).catch(()=>{});return()=>{alive=false;};},[]);
  const key = sidecarKey("progress",worldId);
  const [initial] = useState(() => readProgress(key)),
    [progress, setProgress] = useState(initial.data),
    [nearby, setNearby] = useState(false),
    [chat, setChat] = useState(false),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const accountScope = useRef(captureAccountContext()).current;
  const root = useRef<HTMLDivElement>(null),
    lock = useRef(false),
    alive = useRef(true),
    restored = useRef(false),
    sequence = useRef(0),
    currentProgress = useRef(progress);
  currentProgress.current = progress;
  const current = activePoint && points.find((p) => p.id === activePoint),
    messages =
      activePoint && revealed
        ? conversationMessages(progress, activePoint, revealed.character.id)
        : [],
    hasClue = !!activePoint && hasObjectiveClue(progress, activePoint);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    sequence.current++;
    setChat(false);
    setDraft("");
    setBusy(false);
    lock.current = false;
  }, [activePoint, revealed?.character.id]);
  useEffect(() => {
    if (ready && revealed && activePoint) setChat(true);
  }, [ready, activePoint, revealed?.character.id]);
  async function persist(next: DiscoveryProgress) {
    try {
      assertAccountContext(accountScope);if (initial.invalid) throw Error();
      if(currentUserId())await persistSidecar(worldId,"progress",JSON.stringify(next),accountScope);else localStorage.setItem(key, JSON.stringify(next));
      assertAccountContext(accountScope);currentProgress.current = next;
      setProgress(next);
      setError("");
      return true;
    } catch {
      setError(
        es
          ? "No se pudo guardar el progreso; los datos anteriores se conservaron."
          : "Progress could not be saved; existing data was preserved.",
      );
      return false;
    }
  }
  useEffect(() => {
    if (
      ready &&
      activePoint &&
      (!progress.found.includes(activePoint) ||
        progress.currentPoint !== activePoint)
    )
      persist({
        ...progress,
        currentPoint: activePoint,
        found: [...new Set([...progress.found, activePoint])].slice(-100),
      });
  }, [ready, activePoint]);
  const unlocked = (i: number) => canDiscover(points, progress, points[i].id);
  function visit(point: Point) {
    if (!canDiscover(points, currentProgress.current, point.id)) {
      setError(
        es ? "Este lugar sigue bloqueado." : "This location is still locked.",
      );
      return;
    }
    root.current?.style.setProperty("--travel-x", `${(50 - point.x) * 0.16}px`);
    root.current?.style.setProperty("--travel-y", `${(50 - point.y) * 0.1}px`);
    onReveal(point);
  }
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const point = points.find((p) => p.id === initial.data.currentPoint);
    const timer = window.setTimeout(() => {
      if (point && !initial.invalid) visit(point);
    }, 0);
    return () => {
      clearTimeout(timer);
      restored.current = false;
    };
  }, []);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (
      !current ||
      !revealed ||
      !ready ||
      !canDiscover(points, currentProgress.current, current.id) ||
      !draft.trim() ||
      lock.current
    )
      return;
    if (
      messages.length >= 200 ||
      (Object.keys(currentProgress.current.conversations).length >= 100 &&
        !currentProgress.current.conversations[
          conversationKey(current.id, revealed.character.id)
        ])
    ) {
      setError(
        es
          ? "El historial está lleno. Los mensajes existentes se conservaron."
          : "Conversation history is full. Existing messages were preserved.",
      );
      return;
    }
    setError("");
    lock.current = true;
    setBusy(true);
    const id = current.id,
      message = draft.trim().slice(0, 1000),
      description = revealed.character.description,
      serial = sequence.current;
    try {
      const wantsClue = /\b(?:hint|clue|mission|quest|help)\b|pista|misión|ayuda/i.test(
        message,
      );
      const reply = await workersDialogue.reply({
        message,
        description,
        es,
        character: {
          id: revealed.character.id,
          name: revealed.character.name,
          role: revealed.character.type,
        },
        world: { id: worldId, name, lore },
        discovery: {
          id,
          objective:
            current.objective ||
            (es
              ? "Toca el destello dorado para continuar."
              : "Touch the golden glimmer to continue."),
          completed: progress.completed.includes(id),
          hasClue: hasObjectiveClue(progress, id),
        },
        history: conversationMessages(progress, id, revealed.character.id),
        completedObjectives: progress.completed,
      });
      if (!alive.current || serial !== sequence.current) return;
      const latest = currentProgress.current;
      const previous = conversationMessages(latest, id, revealed.character.id);
      const chatKey = conversationKey(id, revealed.character.id);
      if (
        await persist({
          ...latest,
          clues: wantsClue || hasObjectiveClue(latest,id)
            ? [...new Set([...(latest.clues || []), id])]
            : latest.clues || [],
          conversations: {
            ...latest.conversations,
            [chatKey]: [
              ...previous,
              { role: "visitor" as const, text: message },
              { role: "character" as const, text: reply },
            ],
          },
        })
      ) {
        setDraft((value) => (value.trim() === message ? "" : value));
      }
    } catch (e) {
      if (alive.current && serial === sequence.current)
        setError(aiMessage(e instanceof Error ? e.message : "",es));
    } finally {
      if (serial === sequence.current) {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    }
  }
  return (
    <div
      ref={root}
      className={`world-adventure${baseImage!==undefined?" has-starter":""}${progress.completed.length ? " has-progress" : ""}`}
      onPointerMove={(e) => {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const x = (e.clientX / innerWidth - 0.5) * 2,
          y = (e.clientY / innerHeight - 0.5) * 2;
        root.current?.style.setProperty("--drift-x", `${x * 9}px`);
        root.current?.style.setProperty("--drift-y", `${y * 6}px`);
      }}
    >
      <div className="adventure-environment" aria-hidden="true">
        <div className="adventure-distance" />
        <div className="adventure-midground" />
        <div className="adventure-foreground" />
        <div className="adventure-cloud" />
        <div className="adventure-portal" />
      </div>
      <WorldImageEditor baseImage={baseImage} worldId={worldId} lore={lore} character={revealed?.character.name} characterId={revealed?.character.id} />
      <header className="adventure-heading">
        <span>BEYOND</span>
        <small>{name}</small>
      </header>
      {!points.length && (
        <section className="adventure-empty">
          <h1>
            {es ? "Un mundo por descubrir" : "A world waiting to be discovered"}
          </h1>
          <p>
            {es
              ? "Este mundo todavía no tiene lugares de descubrimiento."
              : "This world has no discovery locations yet."}
          </p>
          <button onClick={onConfigure}>
            {es ? "Crear un descubrimiento" : "Create a discovery"}
          </button>
        </section>
      )}
      {points.length > 1 && (
        <button
          className="adventure-nearby-toggle"
          aria-expanded={nearby}
          onClick={() => setNearby((v) => !v)}
        >
          {es ? "Descubrimientos cercanos" : "Nearby discoveries"} ·{" "}
          {
            progress.found.filter((id) => points.some((p) => p.id === id))
              .length
          }
          /{points.length}
        </button>
      )}
      {nearby && points.length > 1 && (
        <nav
          className="adventure-nearby"
          aria-label={es ? "Lugares de descubrimiento" : "Discovery locations"}
        >
          {points.map((p, i) => (
            <button key={p.id} disabled={!unlocked(i)} onClick={() => visit(p)}>
              <span>✧</span>
              {es ? "Destello" : "Glimmer"} {i + 1}
              <small>
                {!unlocked(i)
                  ? es
                    ? "Bloqueado"
                    : "Locked"
                  : progress.found.includes(p.id)
                    ? es
                      ? "Descubierto"
                      : "Discovered"
                    : es
                      ? "Por descubrir"
                      : "Undiscovered"}
              </small>
            </button>
          ))}
        </nav>
      )}
      {points.map((p, i) => (
        <button
          key={p.id}
          className={`adventure-discovery${progress.found.includes(p.id) ? " is-found" : ""}`}
          disabled={!unlocked(i)}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          aria-label={`${es ? "Descubrir luz" : "Discover light"} ${i + 1}`}
          onClick={() => visit(p)}
        >
          ✧
        </button>
      ))}
      {revealed && (
        <section
          className="adventure-character"
          aria-label={es ? "Personaje descubierto" : "Discovered character"}
        >
          <AssetPreview
            asset={revealed.asset}
            es={es}
            onReady={onReady}
            transparent
          />
          {ready && (
            <>
              <h1>{revealed.character.name}</h1>
              {!chat && (
                <button onClick={() => setChat(true)}>
                  {es ? "Conversar" : "Talk"}
                </button>
              )}
            </>
          )}
        </section>
      )}
      {revealed && ready && chat && (
        <CharacterChat
          key={`${activePoint}:${revealed.character.id}`}
          aiConnected={aiConnected}
          name={revealed.character.name}
          description={revealed.character.description}
          asset={revealed.asset}
          messages={messages}
          draft={draft}
          onDraft={setDraft}
          onSend={send}
          onClose={() => setChat(false)}
          busy={busy}
          error={error}
          es={es}
        />
      )}
      {!revealed && (
        <p className="adventure-chat-hint">
          {es
            ? "Descubre un personaje para empezar una conversación."
            : "Discover a character to begin a conversation."}
        </p>
      )}
      {current &&
        ready &&
        hasClue &&
        !progress.completed.includes(current.id) && (
          <button
            className="adventure-objective"
            aria-label={
              es ? "Seguir el destello dorado" : "Follow the golden glimmer"
            }
            onClick={() => {
              const next = completeObjective(
                points,
                currentProgress.current,
                current.id,
              );
              if (next && next !== currentProgress.current) persist(next);
            }}
          >
            <span>✦</span>
            <small>{es ? "Seguir el destello" : "Follow the glimmer"}</small>
          </button>
        )}
      {current && progress.completed.includes(current.id) && (
        <p className="adventure-unlocked" role="status">
          {points.findIndex((p) => p.id === current.id) < points.length - 1
            ? es
              ? "Un nuevo lugar se ha abierto."
              : "A new location has opened."
            : es
              ? "Has seguido todas las luces de este mundo."
              : "You have followed every light in this world."}
        </p>
      )}
      {error && (
        <p className="adventure-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
