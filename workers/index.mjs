const ORIGINAL_DISCOVERY_ORDER = [
  "a-day-longer-than-a-year",
  "worlds-around-other-suns",
  "an-island-of-its-own",
  "cities-inside-stone",
  "the-invisible-scaffolding",
  "an-ocean-under-ice",
  "the-animals-that-build-reefs",
  "light-written-in-the-sky",
];
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    },
  });
const parse = (row) => ({
  ...JSON.parse(row.data),
  id: row.id,
  slug: row.slug,
  status: row.status,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
function eligible(item) {
  if (item.verificationStatus === "rejected") return false;
  if (item.truthType === "factual")
    return item.verificationStatus === "verified" || item.legacyPublished === true;
  return (
    ["hypothesis", "fictional"].includes(item.truthType) &&
    item.verificationStatus === "hypothetical"
  );
}
async function publicUniverse(db) {
  const [worldResult, discoveryResult, connectionResult, settingsRow] =
    await Promise.all([
      db.prepare("SELECT * FROM worlds WHERE status='published'").all(),
      db.prepare("SELECT * FROM discoveries WHERE status='published'").all(),
      db.prepare(
        "SELECT id,from_id,to_id,explanation FROM connections ORDER BY id",
      ).all(),
      db.prepare("SELECT data FROM settings WHERE id=1").first(),
    ]);
  const worlds = worldResult.results
    .map(parse)
    .sort((a, b) => a.order - b.order)
    .map(({ status, version, createdAt, updatedAt, ...world }) => ({
      ...world,
      name: { en: world.name.en, es: world.name.es || world.name.en },
      description: {
        en: world.description.en,
        es: world.description.es || world.description.en,
      },
    }));
  const visibleWorlds = new Map(worlds.map((world) => [world.id, world]));
  const order = new Map(ORIGINAL_DISCOVERY_ORDER.map((id, i) => [id, i]));
  const records = discoveryResult.results
    .map(parse)
    .filter((item) => visibleWorlds.has(item.worldId) && eligible(item))
    .sort(
      (a, b) =>
        (order.get(a.id) ?? 999999) - (order.get(b.id) ?? 999999) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const visibleIds = new Set(records.map((item) => item.id));
  const connections = connectionResult.results.filter(
    (edge) => visibleIds.has(edge.from_id) && visibleIds.has(edge.to_id),
  );
  const discoveries = records.map((item) => ({
    id: item.id,
    slug: item.slug,
    aliases: item.aliases,
    title: { en: item.title.en, es: item.title.es || item.title.en },
    summary: { en: item.summary.en, es: item.summary.es || item.summary.en },
    body: item.body.map((paragraph) => ({
      en: paragraph.en,
      es: paragraph.es || paragraph.en,
    })),
    category: visibleWorlds.get(item.worldId).name,
    worldId: item.worldId,
    position: item.position,
    relatedIds: connections
      .filter((edge) => edge.from_id === item.id)
      .map((edge) => edge.to_id),
    sourceUrls: item.sources.map((source) => source.url),
    contentType: item.contentType,
    fictionLabel: item.truthType === "fictional",
    truthType: item.truthType,
    verificationStatus: item.verificationStatus,
    uncertainty: item.uncertainty,
    sources: item.sources,
    shareImage: item.shareImage || "/og.svg",
    createdAt: item.createdAt,
    evidence: item.evidence,
    interpretation: item.interpretation,
    questions: item.questions,
    media: item.media,
  }));
  return {
    worlds,
    discoveries,
    connections,
    defaultLanguage: JSON.parse(settingsRow?.data || '{"defaultLanguage":"en"}')
      .defaultLanguage,
  };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/public/universe") {
      if (request.method !== "GET")
        return json({ error: "Method not allowed." }, 405);
      try {
        return json(await publicUniverse(env.DB));
      } catch {
        return json({ error: "The universe data is temporarily unavailable." }, 503);
      }
    }
    if (url.pathname.startsWith("/api/admin/")) {
      return json(
        { error: "The Cloudflare administrator API migration is not complete." },
        503,
      );
    }
    return env.ASSETS.fetch(request);
  },
};
