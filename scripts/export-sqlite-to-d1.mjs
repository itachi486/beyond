import { DatabaseSync } from "node:sqlite";
import { writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2] || ".local/beyond.sqlite";
const output = process.argv[3] || "beyond-data-export.sql";
const db = new DatabaseSync(resolve(input), { readOnly: true });
const tables = [
  ["schema_versions", ["version", "applied_at"]],
  ["admins", ["id", "email", "password_hash", "created_at"]],
  ["sessions", ["token_hash", "admin_id", "csrf", "expires_at"]],
  ["login_limits", ["key_hash", "attempts", "reset_at"]],
  ["worlds", ["id", "slug", "status", "data", "version", "created_at", "updated_at"]],
  ["discoveries", ["id", "slug", "world_id", "status", "data", "version", "created_at", "updated_at"]],
  ["connections", ["id", "from_id", "to_id", "explanation"]],
  ["revisions", ["id", "kind", "record_id", "actor", "snapshot", "created_at"]],
  ["settings", ["id", "data"]],
];

const quote = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return "'" + String(value).replaceAll("'", "''") + "'";
};

const lines = [
  "-- BEYOND SQLite export for Cloudflare D1.",
  "-- Contains admin password hashes and active session hashes; keep private.",
  "-- Apply only after migrations/0001_initial.sql has been applied.",
  "-- D1/Wrangler wraps file execution; do not emit SQLite transaction or PRAGMA statements.",
];

for (const [table, columns] of tables) {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!exists) continue;
  const rows = db.prepare(`SELECT ${columns.join(",")} FROM ${table}`).all();
  for (const row of rows) {
    lines.push(`INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${columns.map((c) => quote(row[c])).join(",")});`);
  }
}

// D1's SQL file executor manages the import transaction; no BEGIN/COMMIT is emitted.
writeFileSync(resolve(output), lines.join("\n") + "\n", { mode: 0o600 });
chmodSync(resolve(output), 0o600);
db.close();
console.log(`Exported BEYOND data to ${resolve(output)}. Keep this file private and delete it after secure import.`);
