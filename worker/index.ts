interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
}

const originalOrder = new Map([
  ["a-day-longer-than-a-year", 0],
  ["worlds-around-other-suns", 1],
  ["an-island-of-its-own", 2],
  ["cities-inside-stone", 3],
  ["the-invisible-scaffolding", 4],
  ["an-ocean-under-ice", 5],
  ["the-animals-that-build-reefs", 6],
  ["light-written-in-the-sky", 7],
]);

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}

function parseRow(row: Record<string, unknown>) {
  const data = JSON.parse(String(row.data));
  return {
    ...data,
    id: row.id,
    slug: row.slug,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function eligible(d: Record<string, any>): boolean {
  if (d.verificationStatus === "rejected") return false;
  if (d.truthType === "factual") {
    return d.verificationStatus === "verified" || d.legacyPublished === true;
  }
  return ["hypothesis", "fictional"].includes(d.truthType)
    && d.verificationStatus === "hypothetical";
}

async function publicUniverse(db: D1Database) {
  const [worldResult, discoveryResult, connectionResult, settingResult] = await Promise.all([
    db.prepare("SELECT id,slug,status,data,version,created_at,updated_at FROM worlds WHERE status='published'").all(),
    db.prepare("SELECT id,slug,world_id,status,data,version,created_at,updated_at FROM discoveries WHERE status='published'").all(),
    db.prepare("SELECT id,from_id,to_id,explanation FROM connections ORDER BY id").all(),
    db.prepare("SELECT data FROM settings WHERE id=1").first<{data:string}>(),
  ]);

  const worlds = (worldResult.results || [])
    .map(parseRow)
    .sort((a: any, b: any) => a.order - b.order)
    .map(({ status, version, createdAt, updatedAt, ...w }: any) => ({
      ...w,
      name: { en: w.name.en, es: w.name.es || w.name.en },
      description: { en: w.description.en, es: w.description.es || w.description.en },
    }));

  const visible = new Set(worlds.map((w: any) => w.id));
  const records = (discoveryResult.results || [])
    .map(parseRow)
    .filter((d: any) => visible.has(d.worldId) && eligible(d))
    .sort((a: any, b: any) =>
      (originalOrder.get(a.id) ?? 999999) - (originalOrder.get(b.id) ?? 999999)
      || a.createdAt.localeCompare(b.createdAt)
      || a.id.localeCompare(b.id));

  const ids = new Set(records.map((d: any) => d.id));
  const connections = (connectionResult.results || [])
    .filter((c: any) => ids.has(c.from_id) && ids.has(c.to_id));

  const discoveries = records.map((d: any) => ({
    id: d.id,
    slug: d.slug,
    aliases: d.aliases,
    title: { en: d.title.en, es: d.title.es || d.title.en },
    summary: { en: d.summary.en, es: d.summary.es || d.summary.en },
    body: d.body.map((p: any) => ({ en: p.en, es: p.es || p.en })),
    category: worlds.find((w: any) => w.id === d.worldId)?.name,
    worldId: d.worldId,
    position: d.position,
    relatedIds: connections.filter((c: any) => c.from_id === d.id).map((c: any) => c.to_id),
    sourceUrls: d.sources.map((s: any) => s.url),
    contentType: d.contentType,
    fictionLabel: d.truthType === "fictional",
    truthType: d.truthType,
    verificationStatus: d.verificationStatus,
    uncertainty: d.uncertainty,
    sources: d.sources,
    shareImage: d.shareImage || "/og.svg",
    createdAt: d.createdAt,
    evidence: d.evidence,
    interpretation: d.interpretation,
    questions: d.questions,
    media: d.media,
  }));

  return {
    worlds,
    discoveries,
    connections,
    defaultLanguage: settingResult?.data
      ? JSON.parse(settingResult.data).defaultLanguage
      : "en",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/public/universe" && request.method === "GET") {
      try {
        return json(await publicUniverse(env.DB));
      } catch {
        return json({ error: "The universe data is temporarily unavailable." }, 503);
      }
    }

    // Admin APIs are intentionally not enabled until the authentication and
    // editorial mutation handlers have been ported and tested in Workers.
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API endpoint not available." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
