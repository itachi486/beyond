import { useEffect, useRef, useState } from "react";
import type { DialogueMessage } from "./worldDiscoveryProgress";
import type { ImportedAsset } from "./uploadAssets";
import "./character-chat.css";
export default function CharacterChat({
  aiConnected = false,
  name,
  description,
  asset,
  messages,
  draft,
  onDraft,
  onSend,
  onClose,
  busy,
  error,
  es,
}: {
  aiConnected?: boolean;
  name: string;
  description: string;
  asset: ImportedAsset;
  messages: DialogueMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: (event: React.FormEvent) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  es: boolean;
}) {
  const [minimized, setMinimized] = useState(false),
    [avatar, setAvatar] = useState("");
  const history = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (asset.kind !== "image") return;
    const url = URL.createObjectURL(asset.file);
    setAvatar(url);
    return () => URL.revokeObjectURL(url);
  }, [asset.id, asset.file, asset.kind]);
  useEffect(() => {
    setMinimized(false);
  }, [asset.id]);
  useEffect(() => {
    const element = history.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, busy, minimized]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      const bottom = Math.max(
        0,
        innerHeight - viewport.height - viewport.offsetTop,
      );
      panel.current?.style.setProperty("--chat-keyboard", `${bottom}px`);
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, []);
  return (
    <section
      ref={panel}
      className={`character-chat${minimized ? " is-minimized" : ""}`}
      aria-label={es ? `Conversación con ${name}` : `Conversation with ${name}`}
    >
      <header>
        {avatar ? (
          <img src={avatar} alt="" />
        ) : (
          <span className="character-chat-avatar" aria-hidden="true">
            ✧
          </span>
        )}
        <div>
          <h2>{name}</h2>
          <small>
            {aiConnected ? "Cloudflare Workers AI" : es
              ? "Respuesta local · IA no conectada"
              : "Local responses · AI not connected"}
          </small>
        </div>
        <button
          type="button"
          aria-label={
            minimized
              ? es
                ? "Restaurar conversación"
                : "Restore conversation"
              : es
                ? "Minimizar conversación"
                : "Minimize conversation"
          }
          onClick={() => setMinimized((v) => !v)}
        >
          {minimized ? "□" : "−"}
        </button>
        <button
          type="button"
          aria-label={es ? "Cerrar conversación" : "Close conversation"}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {!minimized && (
        <>
          <div
            ref={history}
            className="character-chat-history"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label={
              es ? "Mensajes de conversación" : "Conversation messages"
            }
          >
            {!messages.length && (
              <div className="character-chat-message from-character">
                <strong>{name}</strong>
                <p>
                  {es
                    ? `Hola, soy ${name}. ${description}`
                    : `Hello, I'm ${name}. ${description}`}
                </p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`character-chat-message ${message.role === "visitor" ? "from-visitor" : "from-character"}`}
              >
                <strong>
                  {message.role === "visitor" ? (es ? "Tú" : "You") : name}
                </strong>
                <p>{message.text}</p>
              </div>
            ))}
            {busy && (
              <p className="character-chat-thinking" role="status">
                {es ? `${name} está pensando…` : `${name} is thinking…`}
              </p>
            )}
          </div>
          {error && (
            <p className="character-chat-error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={onSend}>
            <label className="adventure-sr" htmlFor="character-chat-input">
              {es ? "Tu mensaje" : "Your message"}
            </label>
            <textarea
              id="character-chat-input"
              rows={2}
              maxLength={1000}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              placeholder={es ? "Habla con este mundo…" : "Talk to this world…"}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  if (!busy && draft.trim())
                    e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              aria-label={es ? "Enviar mensaje" : "Send message"}
              disabled={busy || !draft.trim()}
            >
              →
            </button>
          </form>
        </>
      )}
    </section>
  );
}
