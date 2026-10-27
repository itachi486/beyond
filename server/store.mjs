import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { migrateRealms, eligible } from "./realms.mjs";
export const seed = JSON.parse(
  readFileSync(new URL("./seed.json", import.meta.url), "utf8"),
);
export function openStore(
  file = process.env.BEYOND_DB_PATH || resolve(".local/beyond.sqlite"),
) {
  if (file !== ":memory:") {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    if (!existsSync(file)) writeFileSync(file, "", { mode: 0o600, flag: "wx" });
    chmodSync(file, 0o600);
  }
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  if (!db.prepare("SELECT 1 FROM schema_versions WHERE version=1").get()) {
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const [i, w] of seed.worlds.entries()) {
        const data = { ...w, theme: w.id, slug: w.id, order: i, aliases: [] };
        db.prepare(
          "INSERT INTO worlds(id,slug,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        ).run(w.id, w.id, "published", JSON.stringify(data), now, now);
      }
      for (const d of seed.discoveries) {
        const data = {
          ...d,
          aliases: [],
          sources: d.sourceUrls.map((url) => ({
            url,
            description: new URL(url).hostname,
            verification: "unverified",
          })),
          evidence: "",
          interpretation: "",
          questions: "",
          media: "",
        };
        db.prepare(
          "INSERT INTO discoveries(id,slug,world_id,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        ).run(
          d.id,
          d.slug,
          d.worldId,
          "published",
          JSON.stringify(data),
          d.createdAt,
          now,
        );
      }
      for (const d of seed.discoveries)
        for (const id of d.relatedIds)
          db.prepare("INSERT OR IGNORE INTO connections VALUES(?,?,?,?)").run(
            randomUUID(),
            d.id,
            id,
            "Editorially curated connection from the original BEYOND catalog.",
          );
      const signal = {
        id: "signal",
        slug: "the-signal",
        name: { en: "The Signal", es: "" },
        description: {
          en: "An editorial space for strange signals in space.",
          es: "",
        },
        theme: "unsolved",
        color: "#8eafff",
        symbol: "05",
        order: 4,
        aliases: [],
      };
      db.prepare(
        "INSERT INTO worlds(id,slug,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).run("signal", "the-signal", "draft", JSON.stringify(signal), now, now);
      const first = {
        id: "signal-introduction",
        slug: "the-signal",
        worldId: "signal",
        title: { en: "The Signal", es: "" },
        summary: {
          en: "Strange signals in space: an editorial investigation.",
          es: "",
        },
        body: [
          {
            en: "Editorial draft. Add sourced observations before publication. Separate evidence, interpretations and unanswered questions. No scientific claim or causal relationship is established by this draft.",
            es: "",
          },
        ],
        position: [-7, 0, -12],
        sources: [],
        evidence: "",
        interpretation: "",
        questions: "",
        contentType: "question",
        fictionLabel: false,
        shareImage: "/og.svg",
        media: "",
        aliases: [],
      };
      db.prepare(
        "INSERT INTO discoveries(id,slug,world_id,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      ).run(
        first.id,
        first.slug,
        "signal",
        "draft",
        JSON.stringify(first),
        now,
        now,
      );
      db.prepare("INSERT INTO settings VALUES(1,?)").run(
        JSON.stringify({ defaultLanguage: "en" }),
      );
      db.prepare("INSERT INTO schema_versions VALUES(1,?)").run(now);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  migrateRealms(db);
  return db;
}
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
