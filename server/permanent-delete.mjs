import * as fs from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { fail } from "./validation.mjs";
const keyPattern =
  /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:original\.(?:png|jpeg|webp|glb|gltf)|preview\.webp)$/;
// Synchronous, bounded filesystem operations avoid yielding with a SQLite transaction open.
// Quarantine + a durable purge receipt allow a failed post-commit purge to be retried.
export function permanentDelete(
  db,
  { kind, id, input, session, root, now = Date.now, authorized, files = fs },
) {
  if (
    !["world", "character"].includes(kind) ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(id)
  )
    fail(400, "Invalid deletion target.");
  if (
    input.confirm !== "DELETE PERMANENTLY" ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1
  )
    fail(
      400,
      "Explicit permanent deletion confirmation and version are required.",
    );
  if (!authorized()) fail(401, "Session expired. Sign in again.");
  db.exec(
    "CREATE TABLE IF NOT EXISTS permanent_deletion_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,target_id TEXT NOT NULL,version INTEGER NOT NULL,paths TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(kind,target_id))",
  );
  const prior = db
    .prepare(
      "SELECT * FROM permanent_deletion_jobs WHERE kind=? AND target_id=?",
    )
    .get(kind, id);
  if (prior) {
    if (prior.version !== input.version)
      fail(409, "Deletion version does not match.");
    purge(prior);
    return { deleted: true, id, retried: true };
  }
  const table = kind === "world" ? "worlds" : "central_characters";
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(table))
    fail(404, "Deletion target not found.");
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  if (!row) fail(404, "Deletion target not found.");
  if (row.version !== input.version)
    fail(409, "Record changed. Refresh before deleting.");
  const stamp = new Date(now()).toISOString(),
    job = randomUUID(),
    moves = [];
  let quarantine = null,
    shared = 0,
    removedConnections = 0,
    removedDiscoveries = 0;
  if (kind === "character") {
    if (!root) fail(503, "Private storage is unavailable.");
    const canonical = files.realpathSync(root);
    const publicRoots = [resolve("public"), resolve("dist")];
    if (
      publicRoots.some((p) => canonical === p || canonical.startsWith(p + sep))
    )
      fail(503, "Unsafe storage root.");
    const referenced = new Set(
      db
        .prepare(
          "SELECT file_key,preview_key FROM central_characters WHERE id<>?",
        )
        .all(id)
        .flatMap((r) => [r.file_key, r.preview_key])
        .filter(Boolean),
    );
    // Only this character owns this directory. Other records may share its files.
    const owned = join(canonical, id);
    // Recover a pre-commit interruption only for this target; never replay arbitrary paths.
    const staging = join(canonical, ".deletions");
    if (files.existsSync(staging)) {
      if (files.lstatSync(staging).isSymbolicLink())
        fail(409, "Unsafe cleanup directory.");
      const receipts = files.readdirSync(staging, { withFileTypes: true });
      if (receipts.length > 2048)
        fail(409, "Cleanup journal requires operator review.");
      for (const entry of receipts) {
        if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name))
          fail(409, "Unexpected cleanup journal.");
        const directory = join(staging, entry.name),
          file = join(directory, "journal.json");
        if (!files.existsSync(file)) continue;
        if (
          files.lstatSync(file).isSymbolicLink() ||
          files.statSync(file).size > 1048576
        )
          fail(409, "Invalid cleanup journal.");
        const journal = JSON.parse(files.readFileSync(file, "utf8"));
        if (journal.id !== id || journal.kind !== kind) continue;
        if (!Array.isArray(journal.moves) || journal.moves.length > 2048)
          fail(409, "Invalid cleanup journal.");
        for (const [index, move] of journal.moves.entries()) {
          const relative = move.from?.slice(canonical.length + 1);
          if (
            !move.from?.startsWith(owned + sep) ||
            !keyPattern.test(relative) ||
            move.to !== join(directory, String(index))
          )
            fail(409, "Unsafe recovery path.");
          if (files.existsSync(move.to)) {
            if (files.existsSync(move.from))
              fail(409, "Cleanup recovery conflicts with an existing file.");
            files.renameSync(move.to, move.from);
          }
        }
        files.rmSync(directory, { recursive: true, force: true });
      }
    }
    if (
      db
        .prepare(
          "SELECT 1 FROM worlds WHERE instr(data,?)>0 UNION ALL SELECT 1 FROM discoveries WHERE instr(data,?)>0 LIMIT 1",
        )
        .get("/characters/" + id + "/", "/characters/" + id + "/")
    )
      fail(
        409,
        "Server content still links to this central source. Remove those links before permanent deletion.",
      );
    if (files.existsSync(owned)) {
      if (files.lstatSync(owned).isSymbolicLink())
        fail(409, "Unsafe character directory. No data was deleted.");
      for (const rev of files.readdirSync(owned, { withFileTypes: true })) {
        if (!rev.isDirectory() || !/^[a-f0-9-]{36}$/.test(rev.name))
          fail(409, "Unexpected storage entry. Operator review required.");
        for (const entry of files.readdirSync(join(owned, rev.name), {
          withFileTypes: true,
        })) {
          const key = `${id}/${rev.name}/${entry.name}`;
          if (!entry.isFile() || !keyPattern.test(key))
            fail(409, "Unsafe character file. No data was deleted.");
          if (referenced.has(key)) {
            shared++;
            continue;
          }
          moves.push({ from: join(canonical, key), to: "" });
          if (moves.length > 2048)
            fail(409, "Too many revisions. Operator review required.");
        }
      }
    }
    // Do not erase another character's directory even if metadata shares its file.
    for (const key of [row.file_key, row.preview_key].filter(Boolean))
      if (!keyPattern.test(key))
        fail(409, "Invalid stored file path. No data was deleted.");
    quarantine = join(canonical, ".deletions", job);
    files.mkdirSync(quarantine, { recursive: true, mode: 0o700 });
    moves.forEach((m, i) => (m.to = join(quarantine, String(i))));
    // Private journal supports operator recovery after an abrupt process interruption.
    files.writeFileSync(
      join(quarantine, "journal.json"),
      JSON.stringify({ kind, id, moves }),
      { mode: 0o600 },
    );
  }
  let committed = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    if (!authorized()) fail(401, "Session expired. Sign in again.");
    if (
      db.prepare(`SELECT version FROM ${table} WHERE id=?`).get(id)?.version !==
      input.version
    )
      fail(409, "Record changed. Refresh before deleting.");
    for (const move of moves) files.renameSync(move.from, move.to);
    if (kind === "world") {
      removedConnections = db
        .prepare(
          "DELETE FROM connections WHERE from_id IN (SELECT id FROM discoveries WHERE world_id=?) OR to_id IN (SELECT id FROM discoveries WHERE world_id=?)",
        )
        .run(id, id).changes;
      removedDiscoveries = db
        .prepare("DELETE FROM discoveries WHERE world_id=?")
        .run(id).changes;
    }
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    db.prepare(
      "INSERT INTO revisions(kind,record_id,actor,snapshot,created_at) VALUES(?,?,?,?,?)",
    ).run(
      "permanent_deletion",
      id,
      session.admin_id,
      JSON.stringify({
        kind,
        name: kind === "world" ? JSON.parse(row.data).name : row.name,
        removedDiscoveries,
        removedConnections,
        sharedFilesRetained: shared,
      }),
      stamp,
    );
    if (kind === "character")
      db.prepare("INSERT INTO central_activity VALUES(?,?,?,?,?,?)").run(
        randomUUID(),
        "Permanently deleted character",
        id,
        row.name,
        session.admin_id,
        stamp,
      );
    if (quarantine)
      db.prepare("INSERT INTO permanent_deletion_jobs VALUES(?,?,?,?,?,?)").run(
        job,
        kind,
        id,
        input.version,
        JSON.stringify({ directory: quarantine }),
        stamp,
      );
    db.exec("COMMIT");
    committed = true;
  } catch (error) {
    if (!committed) {
      let restored = true;
      try {
        for (const move of [...moves].reverse())
          if (files.existsSync(move.to)) files.renameSync(move.to, move.from);
      } catch {
        restored = false;
      } finally {
        if (db.isTransaction) db.exec("ROLLBACK");
      }
      if (!restored)
        fail(
          503,
          "Deletion rolled back; file recovery is pending. Retry this same target or contact the operator.",
        );
      if (quarantine)
        files.rmSync(quarantine, { recursive: true, force: true });
    }
    throw error;
  }
  if (quarantine)
    purge(
      db.prepare("SELECT * FROM permanent_deletion_jobs WHERE id=?").get(job),
    );
  return {
    deleted: true,
    id,
    removedFiles: moves.length,
    sharedFilesRetained: shared,
    removedDiscoveries,
    removedConnections,
  };
  function purge(receipt) {
    const dir = JSON.parse(receipt.paths).directory;
    if (
      !root ||
      dir !== join(files.realpathSync(root), ".deletions", receipt.id)
    )
      fail(503, "Deletion receipt requires operator review.");
    try {
      files.rmSync(dir, { recursive: true, force: true });
    } catch {
      fail(
        503,
        "Metadata removed; private file cleanup is pending. Retry this same deletion to finish. No success is reported.",
      );
    }
    db.prepare("DELETE FROM permanent_deletion_jobs WHERE id=?").run(
      receipt.id,
    );
  }
}
