// Stable destination identities; no scientific discoveries are fabricated here.
export const realms = [
  {
    key: "what-if",
    name: { en: "WHAT IF?", es: "¿Y SI…?" },
    description: {
      en: "Alternate choices and unexpected possibilities.",
      es: "Decisiones alternativas y posibilidades inesperadas.",
    },
    theme: "elsewhere",
    color: "#E6C58B",
    position: [-26, 0, -13],
  },
  {
    key: "human-mind",
    name: { en: "THE HUMAN MIND", es: "LA MENTE HUMANA" },
    description: {
      en: "Emotion, memory and the worlds inside us.",
      es: "Emoción, memoria y nuestros mundos interiores.",
    },
    theme: "unsolved",
    color: "#b9a0df",
    position: [-15, 0, -30],
  },
  {
    key: "unsolved",
    name: { en: "UNSOLVED", es: "SIN RESOLVER" },
    description: {
      en: "Real mysteries. Questions still open.",
      es: "Misterios reales. Preguntas aún abiertas.",
    },
    theme: "unsolved",
    color: "#8eafff",
    position: [-2, 0, -47],
  },
  {
    key: "hidden-worlds",
    name: { en: "HIDDEN WORLDS", es: "MUNDOS OCULTOS" },
    description: {
      en: "Secret gardens and unexpected places.",
      es: "Jardines secretos y lugares inesperados.",
    },
    theme: "natural",
    color: "#78D9CC",
    position: [10, 0, -23],
  },
  {
    key: "your-future",
    name: { en: "YOUR FUTURE", es: "TU FUTURO" },
    description: {
      en: "Science, technology and possible tomorrows.",
      es: "Ciencia, tecnología y futuros posibles.",
    },
    theme: "unsolved",
    color: "#99caff",
    position: [25, 0, -37],
  },
  {
    key: "never-knew",
    name: { en: "THINGS YOU NEVER KNEW", es: "COSAS QUE NO SABÍAS" },
    description: {
      en: "Surprising facts and stories waiting to be found.",
      es: "Hechos sorprendentes e historias por descubrir.",
    },
    theme: "archive",
    color: "#d7ac72",
    position: [29, 0, -6],
  },
];
export function migrateRealms(db) {
  if (db.prepare("SELECT 1 FROM schema_versions WHERE version=2").get()) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    const now = new Date().toISOString();
    for (const [i, r] of realms.entries()) {
      const id = "realm-" + r.key;
      if (db.prepare("SELECT 1 FROM worlds WHERE id=?").get(id)) continue;
      let slug = r.key;
      let suffix = 0;
      while (db.prepare("SELECT 1 FROM worlds WHERE slug=?").get(slug)) {
        slug = "realm-" + r.key + (suffix ? "-" + suffix : "");
        suffix++;
      }
      const data = {
        id,
        slug,
        name: r.name,
        description: r.description,
        theme: r.theme,
        color: r.color,
        symbol: String(i + 1).padStart(2, "0"),
        order: 10 + i,
        hubKey: r.key,
        hubPosition: r.position,
        aliases: [],
      };
      db.prepare(
        "INSERT INTO worlds(id,slug,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).run(id, slug, "published", JSON.stringify(data), now, now);
    }
    // Preserve original records and visibility without inventing verification.
    for (const row of db
      .prepare("SELECT id,status,data FROM discoveries")
      .all()) {
      const d = JSON.parse(row.data);
      if (!d.truthType) {
        d.truthType = "factual";
        d.verificationStatus = "needs_review";
        d.uncertainty = "";
        d.legacyPublished = row.status === "published";
        db.prepare("UPDATE discoveries SET data=? WHERE id=?").run(
          JSON.stringify(d),
          row.id,
        );
      }
    }
    db.prepare("INSERT INTO schema_versions VALUES(2,?)").run(now);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function eligible(d) {
  if (d.verificationStatus === "rejected") return false;
  if (d.truthType === "factual")
    return d.verificationStatus === "verified" || d.legacyPublished === true;
  return (
    ["hypothesis", "fictional"].includes(d.truthType) &&
    d.verificationStatus === "hypothetical"
  );
}
