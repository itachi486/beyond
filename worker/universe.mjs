import seed from "../server/seed.json" with { type: "json" };
import { eligible } from "../server/realms.mjs";
export function rows(db, table) {
  return db
    .prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC,id`)
    .all()
    .map((row) => ({
      ...JSON.parse(row.data),
      id: row.id,
      slug: row.slug,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}
export function publicUniverse(db) {
  const worlds = rows(db, "worlds")
    .filter((w) => w.status === "published")
    .sort((a, b) => a.order - b.order)
    .map(({ status, version, createdAt, updatedAt, ...w }) => ({
      ...w,
      name: { en: w.name.en, es: w.name.es || w.name.en },
      description: {
        en: w.description.en,
        es: w.description.es || w.description.en,
      },
    }));
  const visible = new Set(worlds.map((w) => w.id));
  const originalOrder = new Map(seed.discoveries.map((d, i) => [d.id, i]));
  const records = rows(db, "discoveries")
    .filter(
      (d) => d.status === "published" && visible.has(d.worldId) && eligible(d),
    )
    .sort(
      (a, b) =>
        (originalOrder.get(a.id) ?? 999999) -
          (originalOrder.get(b.id) ?? 999999) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const ids = new Set(records.map((d) => d.id));
  const connections = db
    .prepare(
      "SELECT id,from_id,to_id,explanation FROM connections ORDER BY rowid",
    )
    .all()
    .filter((c) => ids.has(c.from_id) && ids.has(c.to_id));
  const discoveries = records.map((d) => ({
    id: d.id,
    slug: d.slug,
    aliases: d.aliases,
    title: { en: d.title.en, es: d.title.es || d.title.en },
    summary: { en: d.summary.en, es: d.summary.es || d.summary.en },
    body: d.body.map((p) => ({ en: p.en, es: p.es || p.en })),
    category: worlds.find((w) => w.id === d.worldId).name,
    worldId: d.worldId,
    position: d.position,
    relatedIds: connections
      .filter((c) => c.from_id === d.id)
      .map((c) => c.to_id),
    sourceUrls: d.sources.map((s) => s.url),
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
    defaultLanguage: JSON.parse(
      db.prepare("SELECT data FROM settings WHERE id=1").get().data,
    ).defaultLanguage,
  };
}

export function universeFromRecords(records) {
 const tables = Object.groupBy(records, r => r.collection);
 const db = { prepare(sql) { return { all() { if (sql.includes("FROM connections")) return (tables.connections || []).map(r => r.record); const table = sql.match(/FROM (worlds|discoveries)/)?.[1]; if (!table) throw Error("Unknown projection"); return (tables[table] || []).map(r => r.record).sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id)); }, get() { const row = (tables.settings || []).find(r => r.record.id === 1); if (!row) throw Error("Missing settings"); return row.record; } }; } };
 return publicUniverse(db);
}
