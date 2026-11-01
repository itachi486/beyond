import {aiErrors,readAIResponse} from './aiErrors';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../locales";
import {
  characterNames,
  characterTypes,
  makeCharacter,
  safeURL,
  type Character,
  type Content,
} from "./spiritModel";
import "./ai-character.css";
type Capabilities = {
  configured: boolean;
  configurationIssue?: "missing_api_key" | "missing_ai_binding" | "invalid_configuration" | null;
  authenticated: boolean;
  csrf?: string;
  creatorId?: string;
  usage?: { used: number; limit: number; tier: string; resetAt: number };
};
type Result = { assetId: string; imageUrl: string; creatorId: string };
export default function AICharacterModal({
  locale,
  worldId,
  index,
  onClose,
  onUse,
}: {
  locale: Locale;
  worldId: string;
  index: number;
  onClose: () => void;
  onUse: (character: Character, content?: Content) => void;
}) {
  const es = locale === "es",
    [name, setName] = useState(""),
    [type, setType] = useState<Character["type"]>("custom"),
    [personality, setPersonality] = useState(""),
    [description, setDescription] = useState(""),
    [appearance, setAppearance] = useState(""),
    [abilities, setAbilities] = useState(""),
    [website, setWebsite] = useState(""),
    [reference, setReference] = useState<string | undefined>(),
    [referenceName, setReferenceName] = useState(""),
    [cap, setCap] = useState<Capabilities | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    [loaded, setLoaded] = useState(false),
    [phase, setPhase] = useState(""),
    dialog = useRef<HTMLDivElement>(null),
    request = useRef<string | null>(null),
    abort = useRef<AbortController | null>(null),
    close = useRef(onClose),
    mounted = useRef(true),
    lock = useRef(false);
  close.current = onClose;
  async function capabilities() {
    const r = await fetch("/api/ai/status");
    if (!r.ok) throw Error("status_failed");
    const data = (await r.json()) as Capabilities;
    if (mounted.current) setCap(data);
    return data;
  }
  useEffect(() => {
    mounted.current = true;
    void capabilities().catch(() =>
      setError(
        es
          ? "No se pudo consultar el servicio."
          : "Could not check the service.",
      ),
    );
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  useLayoutEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector("input")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea,select,a[href]",
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
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      requestAnimationFrame(() => old?.isConnected && old.focus());
    };
  }, []);
  function changed() {
    setResult(null);
    setLoaded(false);
    request.current = null;
    setError("");
  }
  const message = (code: string) =>
    aiErrors[code] || ({
      unsupported_reference: es ? "Workers AI Schnell no edita imágenes de referencia. El original se conserva; elimina la referencia para crear un recurso nuevo." : "Workers AI Schnell cannot edit a reference image. The original is preserved; remove the reference to create a new asset.",
      daily_limit_reached: es
        ? "Límite diario alcanzado. La edición manual sigue disponible."
        : "Daily limit reached. Manual editing remains available.",
      sign_in_required: es
        ? "Inicia sesión con una cuenta existente autorizada."
        : "Sign in with an existing authorized account.",
      missing_ai_binding: es ? "Falta el enlace Workers AI en el servidor Preview." : "The Preview server Workers AI binding is missing.",
      missing_api_key: es
        ? "Falta OPENAI_API_KEY en el servidor. Configura .env.local y reinicia el servidor; nunca pegues la clave aquí."
        : "Server OPENAI_API_KEY is missing or empty. Set it in .env.local and restart the server; never paste the key here.",
      invalid_configuration: es
        ? "La configuración del servidor de imágenes no es válida. Revisa el modelo, el endpoint y las cuotas."
        : "Image server configuration is invalid. Check the model, endpoint and quota settings.",
      image_service_not_configured: es
        ? "Configura el servicio de imágenes en el servidor."
        : "Configure the image service on the server.",
      provider_authentication_failed: es
        ? "La clave del servidor no es válida. Revisa OPENAI_API_KEY."
        : "The server API key was rejected. Check OPENAI_API_KEY.",
      billing_required: es
        ? "El proveedor requiere créditos o facturación. No se generó ninguna imagen."
        : "The provider requires credits or billing setup. No image was generated.",
      provider_rate_limited: es
        ? "El proveedor limita las solicitudes. Inténtalo más tarde."
        : "The provider is rate limiting requests. Try again later.",
      provider_invalid_request: es
        ? "El proveedor rechazó la solicitud. Revisa la descripción y el modelo."
        : "The provider rejected the request. Check the description and configured model.",
      provider_access_denied: es
        ? "La cuenta no puede usar este modelo. Revisa los permisos."
        : "The account cannot access this model. Check provider permissions.",
      provider_server_error: es
        ? "El servicio de imágenes tuvo un error. Reintenta más tarde."
        : "The image service encountered a server error. Retry later.",
      provider_network_error: es
        ? "No se pudo conectar con el proveedor."
        : "Could not connect to the image provider.",
      generation_timeout: es
        ? "La generación agotó el tiempo de espera."
        : "Image generation timed out. No character has been added.",
      invalid_reference: es
        ? "La referencia no es compatible. Usa PNG, JPEG o WebP de hasta 512 KB."
        : "Unsupported reference. Use PNG, JPEG or WebP up to 512 KB.",
    })[code] ||
    (es
      ? "No se pudo generar. Puedes reintentar; no se ha añadido ningún personaje."
      : "Generation failed. You can retry; no character has been added.");
  async function generate(fresh = false) {
    if (lock.current) return;
    setError("");
    if (!name.trim() || !appearance.trim()) {
      setError(
        es
          ? "Escribe un nombre y describe la apariencia."
          : "Enter a name and appearance description.",
      );
      return;
    }
    if (website && !safeURL(website)) {
      setError(
        es
          ? "Usa una URL http o https válida."
          : "Use a valid http or https URL.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setResult(null);
    setLoaded(false);
    if (fresh) request.current = null;
    request.current ||= crypto.randomUUID();
    abort.current = new AbortController();
    try {
      const status = await capabilities();
      if (!status.configured)
        throw Error(
          status.configurationIssue || "image_service_not_configured",
        );
      if (!status.authenticated) throw Error("sign_in_required");
      setPhase(es ? "Solicitando una imagen…" : "Requesting an image…");
      const start = Date.now();
      while (mounted.current) {
        const r = await fetch("/api/ai/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": status.csrf || "",
          },
          body: JSON.stringify({
            requestId: request.current,
            name,
            type,
            personality,
            description,
            appearancePrompt: appearance,
            abilities,
            referenceImage: reference,
          }),
          signal: abort.current.signal,
        });
        const data = await readAIResponse(r);
        if (r.status === 202) {
          setPhase(
            es
              ? "El servicio sigue generando…"
              : "The service is still generating…",
          );
          if (Date.now() - start > 135000) throw Error("still_pending");
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        if (!r.ok) {
          if (r.status !== 409) request.current = null;
          throw Error(data.error || "generation_failed");
        }
        if (mounted.current) {
          setResult(data);
          setPhase(es ? "Cargando vista previa…" : "Loading preview…");
        }
        break;
      }
      await capabilities();
    } catch (e) {
      if (mounted.current)
        setError(
          (e as Error).name === "AbortError"
            ? es
              ? "Solicitud interrumpida."
              : "Request interrupted."
            : message((e as Error).message),
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function useCharacter() {
    if (!result || !loaded || lock.current) return;
    lock.current = true;
    const c: Character = {
      ...makeCharacter(worldId, type, index),
      name: name.trim(),
      description,
      personality,
      appearancePrompt: appearance,
      abilities,
      creatorId: result.creatorId,
      assetId: result.assetId,
      imageUrl: result.imageUrl,
      visibility: "local",
      animationPreset: (
        {
          world: "float",
          collector: "orbit",
          creator: "flutter",
          portal: "pulse",
          custom: "ribbon",
        } as const
      )[type],
    };
    let content: Content | undefined;
    if (website) {
      const now = new Date().toISOString();
      content = {
        id: crypto.randomUUID(),
        worldId,
        characterId: c.id,
        type: "url",
        title: es ? "Sitio relacionado" : "Related website",
        body: "",
        url: website,
        sourceUrl: website,
        createdAt: now,
        updatedAt: now,
      };
      c.contentIds = [content.id];
    }
    onUse(c, content);
  }
  return createPortal(
    <div className="creation-shade">
      <div
        ref={dialog}
        className="creation-modal ai-character-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-character-title"
      >
        <div className="creation-sparks" aria-hidden="true" />
        <button
          className="creation-close"
          onClick={onClose}
          aria-label={es ? "Cerrar" : "Close"}
        >
          ×
        </button>
        <p className="creation-kicker">BEYOND / CHARACTER STUDIO</p>
        <h1 id="ai-character-title">
          {es ? "Dale vida a tu imaginación" : "Give imagination a presence"}
        </h1>
        <p>
          {es
            ? "Una imagen original en un espacio 2.5D, no un modelo 3D articulado."
            : "An original image in 2.5D space, not a rigged 3D model."}
        </p>
        {!cap ? (
          <p role="status">
            {es ? "Consultando servicio…" : "Checking service…"}
          </p>
        ) : !cap.configured ? (
          <p className="ai-service-notice">
            {cap.configurationIssue
              ? message(cap.configurationIssue)
              : es
                ? "El servicio de imágenes necesita configuración del servidor. Los espíritus manuales siguen disponibles."
                : "Image generation needs server configuration. Manual spirits remain available."}
          </p>
        ) : !cap.authenticated ? (
          <p className="ai-service-notice">
            {es
              ? "Se requiere una sesión autorizada existente para generar imágenes."
              : "An existing authorized session is required for image generation."}{" "}
            <a href="/admin/login" target="_blank" rel="noopener noreferrer">
              {es ? "Abrir inicio de sesión" : "Open sign in"}
            </a>
            <button onClick={() => void capabilities()}>
              {es ? "Actualizar estado" : "Refresh status"}
            </button>
          </p>
        ) : (
          <p>
            {cap.usage?.used} / {cap.usage?.limit}{" "}
            {es
              ? "generaciones reservadas o completadas hoy (UTC). Sin pagos integrados."
              : "reserved or completed generations today (UTC). No payment integration."}
          </p>
        )}
        <p className="ai-service-notice">
          {es
            ? "Al generar, el texto y la referencia se envían al proveedor configurado. Las imágenes privadas se guardan en este servidor y requieren iniciar sesión al volver a abrirlas."
            : "Generating sends your description and optional reference to the configured provider. Private images are saved on this server and require sign-in when reopened. Workers AI Schnell does not guarantee transparency; reference editing is unavailable."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <fieldset disabled={busy}>
            <label htmlFor="ai-name">
              {es ? "Nombre del personaje" : "Character name"}
            </label>
            <input
              id="ai-name"
              maxLength={100}
              value={name}
              onChange={(e) => {
                changed();
                setName(e.target.value);
              }}
            />
            <label>
              {es ? "Tipo de personaje" : "Character type"}
              <select
                aria-label={es ? "Tipo de personaje" : "Character type"}
                value={type}
                onChange={(e) => {
                  changed();
                  setType(e.target.value as Character["type"]);
                }}
              >
                {characterTypes.map((t, i) => (
                  <option key={t} value={t}>
                    {characterNames[locale][i]}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                [
                  es ? "Personalidad" : "Personality",
                  personality,
                  setPersonality,
                  2000,
                ],
                [
                  es ? "Historia y propósito" : "Story and purpose",
                  description,
                  setDescription,
                  2000,
                ],
                [
                  es
                    ? "Descripción de la apariencia"
                    : "Appearance description",
                  appearance,
                  setAppearance,
                  3000,
                ],
                [
                  es ? "Habilidades especiales" : "Special abilities",
                  abilities,
                  setAbilities,
                  2000,
                ],
              ] as const
            ).map(([label, value, set, max], i) => (
              <label key={i}>
                {label}
                <textarea
                  aria-label={label}
                  maxLength={max}
                  value={value}
                  onChange={(e) => {
                    changed();
                    set(e.target.value);
                  }}
                />
              </label>
            ))}
            <label htmlFor="ai-reference">
              {es
                ? "Imagen de referencia opcional (máx. 512 KB)"
                : "Optional reference image (max. 512 KB)"}
            </label>
            <input
              id="ai-reference"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                changed();
                const file = e.target.files?.[0];
                setReference(undefined);
                setReferenceName("");
                if (!file) return;
                if (
                  file.size > 512 * 1024 ||
                  !["image/png", "image/jpeg", "image/webp"].includes(file.type)
                ) {
                  setError(message("invalid_reference"));
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  if (mounted.current) {
                    setReference(String(reader.result));
                    setReferenceName(file.name);
                  }
                };
                reader.onerror = () => setError(message("invalid_reference"));
                reader.readAsDataURL(file);
              }}
            />
            {referenceName && <small>{referenceName}</small>}
            <label htmlFor="ai-website">
              {es
                ? "Sitio web relacionado (opcional)"
                : "Related website (optional)"}
            </label>
            <input
              id="ai-website"
              value={website}
              maxLength={2048}
              placeholder="https://"
              onChange={(e) => {
                changed();
                setWebsite(e.target.value);
              }}
            />
          </fieldset>
          {error && <p role="alert">{error}</p>}
          {busy && (
            <div className="ai-generation-progress" role="status">
              <span className="ai-generation-orbit" aria-hidden="true" />
              {phase}
              <progress
                aria-label={es ? "Generando imagen" : "Generating image"}
              />
            </div>
          )}
          {result && (
            <div className="ai-preview">
              <img
                src={result.imageUrl}
                alt={name}
                onLoad={() => {
                  setLoaded(true);
                  setPhase("");
                }}
                onError={() => {
                  setLoaded(false);
                  setError(
                    es
                      ? "La imagen no se pudo cargar. Inicia sesión de nuevo; no se ha añadido el personaje."
                      : "Image could not load. Sign in again; no character has been added.",
                  );
                }}
              />
              <p>
                {es
                  ? "Vista previa generada. Comprueba la imagen antes de usarla."
                  : "Generated preview. Review the image before using it."}
              </p>
              <button
                type="button"
                className="creation-primary"
                disabled={!loaded}
                onClick={useCharacter}
              >
                {es ? "Usar este personaje" : "Use this character"}
              </button>
              <button type="button" onClick={() => void generate(true)}>
                {es ? "Generar otra vez" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={() => {
                  changed();
                  dialog.current
                    ?.querySelector<HTMLTextAreaElement>(
                      'textarea[aria-label="Appearance description"],textarea[aria-label="Descripción de la apariencia"]',
                    )
                    ?.focus();
                }}
              >
                {es ? "Editar descripción" : "Edit description"}
              </button>
            </div>
          )}
          <div className="creation-actions">
            <button type="button" onClick={onClose}>
              {es ? "Volver a espíritus manuales" : "Back to manual spirits"}
            </button>
            <button
              type="submit"
              className="creation-primary"
              disabled={
                busy ||
                !cap?.configured ||
                !cap?.authenticated ||
                !!(cap.usage && cap.usage.used >= cap.usage.limit)
              }
            >
              {busy
                ? es
                  ? "Generando…"
                  : "Generating…"
                : error
                  ? es
                    ? "Reintentar"
                    : "Retry"
                  : es
                    ? "Generar personaje"
                    : "Generate character"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
