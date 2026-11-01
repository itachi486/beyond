import {creationIntent} from "../account/creationIntent";
import {useAuthorAccess} from "./authorAccess";
import {useAccount} from "../account/AccountProvider";
import {Link} from "react-router-dom";
import PublishedImages from "./PublishedImages";
import {createStarterWorld,type PublishedImage} from "./starterWorlds";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../locales";
import { newWorld, saveWorld, type CreatedWorld } from "./worldStore";
import "./creation.css";
export default function CreateWorldModal({
  locale,
  onCancel,
  onCreated,
  initial,
}: {
  locale: Locale;
  onCancel: () => void;
  onCreated: (world: CreatedWorld) => void;
  initial?: { name: string; description: string };
}) {
  const account=useAccount(),author=useAuthorAccess();
  const pending=creationIntent();
  const [needsAccount,setNeedsAccount]=useState(false);
  const es = locale === "es",
    [name, setName] = useState(initial?.name || pending?.name || ""),
    [description, setDescription] = useState(initial?.description || pending?.description || ""),
    [submitted, setSubmitted] = useState(false),
    [error, setError] = useState(false),
    [starter,setStarter]=useState<PublishedImage|undefined>(pending?.starter?.category==="hidden-worlds"?pending.starter:undefined),
    [busy, setBusy] = useState(false),
    lock = useRef(false),
    dialog = useRef<HTMLDivElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    cancel = useRef(onCancel);
  cancel.current = onCancel;
  useLayoutEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    nameInput.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (document.querySelector("[data-starter-detail]")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel.current();
      }
      if (e.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      old?.focus();
    };
  }, []);
  return createPortal(
    <div className="creation-shade">
      <div
        ref={dialog}
        className="creation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creation-title"
      >
        <div className="creation-sparks" aria-hidden="true" />
        <button
          className="creation-close"
          aria-label={es ? "Cerrar" : "Close"}
          onClick={onCancel}
        >
          ×
        </button>
        <p className="creation-kicker">BEYOND / CREATE</p>
        <div className="creation-emblem" aria-hidden="true">
          ✧
        </div>
        <h1 id="creation-title">
          {es ? "Da vida a un mundo" : "Bring a world to life"}
        </h1>
        <p>
          {es
            ? "Cada universo comienza con una idea. Este mundo se guardará solo en tu navegador."
            : "Every universe begins with an idea. A free account keeps your world across devices."}
        </p>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current) return;
            setSubmitted(true);
            setError(false);
            if (!name.trim() || !description.trim()) {
              if (!name.trim()) nameInput.current?.focus();
              return;
            }
            if(!account.user&&!author){sessionStorage.setItem("beyond:creation-intent",JSON.stringify({name,description,starter}));setNeedsAccount(true);return;}
            lock.current = true;
            setBusy(true);
            try {const world=await createStarterWorld(name,description,starter);sessionStorage.removeItem("beyond:creation-intent");onCreated(world);}catch{setError(true);setBusy(false);lock.current=false;}
          }}
        >
          <label htmlFor="creation-name">
            {es ? "Nombre del mundo" : "World Name"}
          </label>
          <div className="creation-input">
            <span aria-hidden="true">✧</span>
            <input
              ref={nameInput}
              id="creation-name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                es ? "Dale un nombre a tu mundo…" : "Give your world a name..."
              }
              aria-invalid={submitted && !name.trim()}
              aria-describedby={
                submitted && !name.trim() ? "creation-name-error" : undefined
              }
            />
          </div>
          {submitted && !name.trim() && (
            <small role="alert" id="creation-name-error">
              {es ? "Escribe un nombre." : "Enter a world name."}
            </small>
          )}
          <label htmlFor="creation-description">
            {es ? "Descripción del mundo" : "World Description"}
          </label>
          <textarea
            id="creation-description"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              es
                ? "Describe los secretos de tu mundo…"
                : "Describe the secrets hidden in your world..."
            }
            aria-invalid={submitted && !description.trim()}
            aria-describedby={
              submitted && !description.trim()
                ? "creation-description-error"
                : undefined
            }
          />
          {submitted && !description.trim() && (
            <small role="alert" id="creation-description-error">
              {es ? "Describe tu mundo." : "Enter a world description."}
            </small>
          )}
          <PublishedImages category="hidden-worlds" selected={starter?.id} onSelect={setStarter}/>
          {needsAccount&&<p role="status">Your selection is kept. <Link to="/register">Create Free Account</Link> or <Link to="/login">Log In</Link> to save this personal world.</p>}
          {error && (
            <p role="alert">
              {es
                ? "No se pudo guardar. Revisa el almacenamiento o los datos locales existentes."
                : "Could not confirm cloud save. Your original data and selection are retained. Retry after checking your connection."}
            </p>
          )}
          <div className="creation-actions">
            <button type="button" onClick={onCancel}>
              {es ? "Cancelar" : "Cancel"}
            </button>
            <button className="creation-primary" disabled={busy} type="submit">
              {busy
                ? es
                  ? "Creando…"
                  : "Creating…"
                : es
                  ? "Crear mundo"
                  : "Create World"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
