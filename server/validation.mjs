export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new Problem(status, message);
};
const states = ["draft", "review", "published", "archived"],
  themes = ["archive", "elsewhere", "unsolved", "natural"];
function text(v, max = 20000) {
  if (typeof v !== "string" || v.length > max)
    fail(400, "Invalid or oversized text field.");
  return v.trim();
}
function localized(v, max) {
  if (!v || typeof v !== "object") fail(400, "English content is required.");
  return { en: text(v.en ?? "", max), es: text(v.es ?? "", max) };
}
function slug(v) {
  v = text(v, 90);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v))
    fail(400, "Use a lowercase slug with letters, numbers and hyphens.");
  return v;
}
export function safeURL(v, local = false) {
  v = text(v, 2048);
  if (local && /^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(v) && !v.includes(".."))
    return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && !u.username && !u.password) return u.href;
  } catch {}
  fail(400, "Use a valid HTTPS URL or supported local image path.");
}
export function validateWorld(input, old) {
  const name = localized(input.name, 160),
    description = localized(input.description, 2000);
  if (!name.en) fail(400, "An English world name is required.");
  const status = input.status ?? "draft";
  if (!states.includes(status) || !themes.includes(input.theme))
    fail(400, "Invalid publication state or presentation theme.");
  if (status === "published" && !description.en)
    fail(400, "A published world requires an English description.");
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color))
    fail(400, "Use a six-digit hex color.");
  const order = Number(input.order ?? 0);
  if (!Number.isInteger(order) || order < 0 || order > 999)
    fail(400, "World order must be 0–999.");
  let hubPosition = old?.hubPosition;
  if (old?.hubKey) {
    hubPosition = input.hubPosition || old.hubPosition;
    if (
      !Array.isArray(hubPosition) ||
      hubPosition.length !== 3 ||
      hubPosition[1] !== 0 ||
      hubPosition.some(
        (n) => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 60,
      )
    )
      fail(400, "Hub placement requires X/Z within ±60 and Y=0.");
  }
  return {
    hubKey: old?.hubKey,
    hubPosition,
    name,
    description,
    slug: slug(input.slug),
    theme: input.theme,
    color: input.color,
    symbol: String(input.symbol || "05").slice(0, 3),
    order,
    status,
    aliases: old?.aliases || [],
  };
}
export function validateDiscovery(input, db, old) {
  const title = localized(input.title, 200),
    summary = localized(input.summary, 500);
  if (!title.en) fail(400, "An English title is required.");
  const status = input.status ?? "draft";
  if (!states.includes(status)) fail(400, "Invalid publication state.");
  const world = db
    .prepare("SELECT status,data FROM worlds WHERE id=?")
    .get(input.worldId);
  if (!world) fail(400, "Choose an existing world.");
  if (!Array.isArray(input.body) || input.body.length > 30)
    fail(400, "Body must contain up to 30 paragraphs.");
  const body = input.body.map((p) => localized(p, 10000));
  const sources = input.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 20)
    fail(400, "Use up to 20 sources.");
  const normalized = sources.map((s) => ({
    url: safeURL(s.url),
    description: text(s.description ?? "", 500),
    verification: s.verification === "verified" ? "verified" : "unverified",
  }));
  const position = input.position;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    position.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 100,
    )
  )
    fail(400, "Position requires three numbers between -100 and 100.");
  if (
    JSON.parse(world.data).hubKey &&
    (Math.abs(position[0]) > 4 ||
      Math.abs(position[2]) > 4 ||
      position[1] < 0 ||
      position[1] > 6)
  )
    fail(
      400,
      "Hub discovery placement requires local X/Z within ±4 and Y within 0–6.",
    );
  if (!["article", "question"].includes(input.contentType))
    fail(400, "Invalid content type.");
  if (
    status === "published" &&
    (world.status !== "published" ||
      !summary.en ||
      !body.some((p) => p.en) ||
      (input.truthType !== "fictional" && !normalized.length) ||
      normalized.some((s) => !s.description))
  )
    fail(
      400,
      "Publication requires a published world, hint, English body and described sources.",
    );
  const truthType = input.truthType || "factual";
  const verificationStatus = input.verificationStatus || "needs_review";
  if (
    !["factual", "hypothesis", "fictional"].includes(truthType) ||
    !["needs_review", "verified", "hypothetical", "rejected"].includes(
      verificationStatus,
    )
  )
    fail(400, "Invalid content classification or editorial status.");
  const uncertainty = text(input.uncertainty ?? "", 3000);
  const sameLegacy =
    old?.legacyPublished === true &&
    old.status === "published" &&
    status === "published" &&
    JSON.stringify({
      title,
      summary,
      body,
      sources: normalized,
      worldId: input.worldId,
    }) ===
      JSON.stringify({
        title: old.title,
        summary: old.summary,
        body: old.body,
        sources: old.sources,
        worldId: old.worldId,
      });
  if (status === "published" && verificationStatus === "rejected")
    fail(400, "Rejected content cannot be published.");
  if (
    status === "published" &&
    truthType === "factual" &&
    verificationStatus !== "verified" &&
    !sameLegacy
  )
    fail(
      400,
      "An authorized editor must verify factual content before publication.",
    );
  if (
    status === "published" &&
    truthType !== "factual" &&
    (verificationStatus !== "hypothetical" || !uncertainty)
  )
    fail(
      400,
      "Hypotheses and fictional scenarios require a hypothetical label and uncertainty note.",
    );
  return {
    truthType,
    verificationStatus,
    uncertainty,
    legacyPublished: sameLegacy,
    title,
    summary,
    body,
    slug: slug(input.slug),
    worldId: input.worldId,
    contentType: input.contentType,
    sources: normalized,
    position,
    evidence: text(input.evidence ?? "", 10000),
    interpretation: text(input.interpretation ?? "", 10000),
    questions: text(input.questions ?? "", 10000),
    media: input.media ? safeURL(input.media, true) : "",
    fictionLabel: false,
    shareImage: "/og.svg",
    status,
    aliases: old?.aliases || [],
  };
}
