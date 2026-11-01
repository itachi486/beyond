import { permanentDelete } from "./permanent-delete.mjs";
import { randomUUID } from "node:crypto";
import { dirname, resolve, join, sep } from "node:path";
import {
  mkdir,
  writeFile,
  rm,
  readFile,
  rmdir,
  realpath,
} from "node:fs/promises";
import { validateUpload, thumbnail, formats } from "./character-files.mjs";
import { fail } from "./validation.mjs";
const types = ["world", "collector", "creator", "portal", "custom"];
const idPattern = /^[a-f0-9-]{36}$/;
let uploads = 0;
export function createCentralLibrary(db, { root, now = Date.now, authorized }) {
  const location = db
    .prepare("PRAGMA database_list")
    .all()
    .find((x) => x.name === "main")?.file;
  const assetRoot = root
    ? resolve(root)
    : location
      ? join(dirname(location), "character-assets")
      : null;
  const staticRoots = [resolve("public"), resolve("dist")];
  const projectRoot = resolve("."),
    protectedLocal = resolve(".local");
  const within = (a, b) => a === b || a.startsWith(b + sep);
  async function guardRoot(create = false) {
    if (!assetRoot || staticRoots.some((p) => within(assetRoot, p)))
      fail(
        503,
        "Character storage must be outside public and dist directories.",
      );
    if (within(assetRoot, projectRoot) && !within(assetRoot, protectedLocal))
      fail(
        503,
        "Store character files outside the project or inside protected .local storage.",
      );
    if (create) await mkdir(assetRoot, { recursive: true, mode: 0o700 });
    const actual = await realpath(assetRoot);
    const canonicalProject = await realpath(projectRoot),
      canonicalLocal = await realpath(protectedLocal).catch(
        () => protectedLocal,
      );
    if (within(actual, canonicalProject) && !within(actual, canonicalLocal))
      fail(
        503,
        "Character storage resolves into source files served by development tools.",
      );
    for (const p of staticRoots) {
      const canonical = await realpath(p).catch(() => p);
      if (within(actual, canonical))
        fail(
          503,
          "Character storage resolves into a public directory. Choose private persistent storage.",
        );
    }
  }
  const exists = () =>
    !!db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='central_characters'",
      )
      .get();
  const ensure = () =>
    db.exec(
      `CREATE TABLE IF NOT EXISTS central_characters(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,type TEXT NOT NULL,tags TEXT NOT NULL,source TEXT NOT NULL,active INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL,kind TEXT NOT NULL,format TEXT NOT NULL,bytes INTEGER NOT NULL,file_key TEXT NOT NULL,preview_key TEXT,creator_id TEXT NOT NULL REFERENCES admins(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS central_activity(id TEXT PRIMARY KEY,action TEXT NOT NULL,record_id TEXT NOT NULL,name TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES admins(id),created_at TEXT NOT NULL);`,
    );
  const metadata = (r, admin = false) =>
    r && {
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      tags: r.tags,
      source: r.source,
      active: !!r.active,
      deleted: !!r.deleted,
      version: r.version,
      kind: r.kind,
      format: r.format,
      bytes: r.bytes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      previewUrl: r.preview_key
        ? `/api/${admin ? "admin/library" : "public"}/characters/${r.id}/preview?v=${r.version}`
        : null,
      fileUrl: `/api/${admin ? "admin/library" : "public"}/characters/${r.id}/file?v=${r.version}`,
      ...(admin
        ? {
            creatorId: r.creator_id,
            usage:
              "Browser placements are not centrally tracked; source files are retained.",
          }
        : {}),
    };
  function get(id, admin) {
    if (!idPattern.test(id) || !exists()) fail(404, "Character not found.");
    const row = db
      .prepare(
        "SELECT * FROM central_characters WHERE id=?" +
          (admin ? "" : " AND active=1 AND deleted=0"),
      )
      .get(id);
    if (!row)
      fail(
        404,
        "Character is unavailable. Existing local copies are preserved.",
      );
    return row;
  }
  function list(params, admin) {
    const search = (params.get("search") || "").trim(),
      status = params.get("status") || "",
      requested = Number(params.get("page") || 1);
    if (
      search.length > 200 ||
      !Number.isInteger(requested) ||
      requested < 1 ||
      requested > 100000 ||
      !["", "active", "inactive", "archived"].includes(status)
    )
      fail(400, "Invalid library filter or page.");
    if (!exists()) return { items: [], total: 0, page: 1, totalPages: 1 };
    const clauses = [
        "(instr(lower(name),lower(?))>0 OR instr(lower(tags),lower(?))>0)",
      ],
      args = [search, search];
    if (!admin) clauses.push("active=1 AND deleted=0");
    else if (status === "archived") clauses.push("deleted=1");
    else {
      clauses.push("deleted=0");
      if (status) clauses.push(status === "active" ? "active=1" : "active=0");
    }
    const where = " WHERE " + clauses.join(" AND "),
      total = db
        .prepare("SELECT COUNT(*) n FROM central_characters" + where)
        .get(...args).n,
      totalPages = Math.max(1, Math.ceil(total / 10)),
      page = Math.min(requested, totalPages);
    return {
      items: db
        .prepare(
          "SELECT * FROM central_characters" +
            where +
            " ORDER BY updated_at DESC,id LIMIT 10 OFFSET ?",
        )
        .all(...args, (page - 1) * 10)
        .map((r) => metadata(r, admin)),
      total,
      page,
      totalPages,
    };
  }
  async function serve(id, role, admin, version, res) {
    const r = get(id, admin);
    if (version !== null && Number(version) !== r.version)
      fail(409, "Character changed. Refresh the library.");
    const key = role === "preview" ? r.preview_key : r.file_key;
    if (
      !assetRoot ||
      !key ||
      !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:original\.(?:png|jpeg|webp|glb|gltf)|preview\.webp)$/.test(
        key,
      )
    )
      fail(404, "Character file unavailable.");
    let bytes;
    try {
      await guardRoot();
      bytes = await readFile(join(assetRoot, key));
    } catch {
      fail(404, "Character file unavailable.");
    }
    res.writeHead(200, {
      "Content-Type": role === "preview" ? "image/webp" : formats[r.format],
      "Content-Length": bytes.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition": "inline",
    });
    res.end(bytes);
  }
  function inputMeta(input) {
    for (const [name, max] of [
      ["name", 100],
      ["description", 2000],
      ["tags", 300],
      ["source", 2048],
    ])
      if (typeof input[name] !== "string" || input[name].length > max)
        fail(400, "Invalid character " + name + ".");
    if (
      !input.name.trim() ||
      !types.includes(input.type) ||
      typeof input.active !== "boolean"
    )
      fail(400, "Enter a name, supported type and active state.");
    if (input.source) {
      try {
        const u = new URL(input.source);
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          throw 0;
      } catch {
        fail(400, "Use a safe http or https source URL.");
      }
    }
  }
  async function mutate(method, id, input, session) {
    if (!assetRoot)
      fail(503, "Persistent character storage is not configured.");
    if (uploads >= 2)
      fail(429, "Another upload is being processed. Try again shortly.");
    uploads++;
    let newDir = null;
    try {
      const old = id ? get(id, true) : null;
      if (old && input.version !== old.version)
        fail(409, "Character changed. Refresh before editing.");
      if (old?.deleted)
        fail(409, "Archived characters cannot be changed. Files are retained.");
      if (method === "DELETE") {
        if (input.confirm !== "ARCHIVE")
          fail(400, "Explicit ARCHIVE confirmation is required.");
      } else {
        inputMeta(input);
        if (!old && !input.file) fail(400, "Choose a character file.");
      }
      let original = null,
        preview = null;
      if (method !== "DELETE" && input.file)
        original = await validateUpload(input.file);
      if (method !== "DELETE" && input.preview) {
        const p = await validateUpload(input.preview, 2 * 1024 * 1024);
        if (p.kind !== "image") fail(400, "Preview must be an image.");
        preview = await thumbnail(p.bytes);
      } else if (original?.kind === "image")
        preview = await thumbnail(original.bytes);
      if (!authorized()) fail(401, "Administrator session expired.");
      await guardRoot(true);
      ensure();
      const characterId = id || randomUUID(),
        revision = randomUUID(),
        stamp = new Date(now()).toISOString();
      let fileKey = old?.file_key || null,
        previewKey = old?.preview_key || null;
      if (original || preview) {
        newDir = join(assetRoot, characterId, revision);
        await mkdir(newDir, { recursive: true, mode: 0o700 });
        if (original) {
          fileKey = `${characterId}/${revision}/original.${original.format}`;
          await writeFile(join(assetRoot, fileKey), original.bytes, {
            flag: "wx",
            mode: 0o600,
          });
          if (original.kind === "model" && !input.preview) previewKey = null;
        }
        if (preview) {
          previewKey = `${characterId}/${revision}/preview.webp`;
          await writeFile(join(assetRoot, previewKey), preview, {
            flag: "wx",
            mode: 0o600,
          });
        }
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        if (!authorized()) fail(401, "Administrator session expired.");
        if (
          old &&
          db
            .prepare("SELECT version FROM central_characters WHERE id=?")
            .get(id)?.version !== old.version
        )
          fail(409, "Character changed. Refresh before editing.");
        if (method === "DELETE")
          db.prepare(
            "UPDATE central_characters SET active=0,deleted=1,version=version+1,updated_at=? WHERE id=?",
          ).run(stamp, id);
        else if (old)
          db.prepare(
            "UPDATE central_characters SET name=?,description=?,type=?,tags=?,source=?,active=?,version=version+1,kind=?,format=?,bytes=?,file_key=?,preview_key=?,updated_at=? WHERE id=?",
          ).run(
            input.name.trim(),
            input.description,
            input.type,
            input.tags,
            input.source,
            +input.active,
            original?.kind || old.kind,
            original?.format || old.format,
            original?.bytes.length || old.bytes,
            fileKey,
            previewKey,
            stamp,
            id,
          );
        else
          db.prepare(
            "INSERT INTO central_characters VALUES(?,?,?,?,?,?,?,0,1,?,?,?,?,?,?,?,?)",
          ).run(
            characterId,
            input.name.trim(),
            input.description,
            input.type,
            input.tags,
            input.source,
            +input.active,
            original.kind,
            original.format,
            original.bytes.length,
            fileKey,
            previewKey,
            session.admin_id,
            stamp,
            stamp,
          );
        db.prepare("INSERT INTO central_activity VALUES(?,?,?,?,?,?)").run(
          randomUUID(),
          method === "DELETE"
            ? "Archived character"
            : old
              ? "Updated character"
              : "Uploaded character",
          characterId,
          method === "DELETE" ? old.name : input.name.trim(),
          session.admin_id,
          stamp,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return metadata(get(characterId, true), true);
    } catch (e) {
      if (newDir) {
        try {
          await rm(newDir, { recursive: true, force: true });
        } catch {
          fail(
            500,
            "Upload was not registered. Operator storage cleanup may be required.",
          );
        }
        await rmdir(dirname(newDir)).catch(() => {});
      }
      throw e;
    } finally {
      uploads--;
    }
  }
  async function handle(path, method, params, input, session, res, send) {
    const deletion = path.match(
      /^\/api\/admin\/library\/characters\/([a-f0-9-]{36})\/permanent-delete$/,
    );
    if (deletion) {
      if (!session) fail(401, "Administrator sign-in required.");
      if (method !== "POST") fail(405, "Method not allowed.");
      const targetExists =
        exists() &&
        db
          .prepare("SELECT 1 FROM central_characters WHERE id=?")
          .get(deletion[1]);
      const jobsExist = db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE name='permanent_deletion_jobs'",
        )
        .get();
      const pending =
        jobsExist &&
        db
          .prepare(
            "SELECT 1 FROM permanent_deletion_jobs WHERE kind='character' AND target_id=?",
          )
          .get(deletion[1]);
      if (!targetExists && !pending) fail(404, "Character not found.");
      await guardRoot();
      send(
        res,
        200,
        permanentDelete(db, {
          kind: "character",
          id: deletion[1],
          input,
          session,
          root: assetRoot,
          now,
          authorized,
        }),
      );
      return true;
    }
    const match = path.match(
      /^\/api\/(public|admin\/library)\/characters(?:\/([a-f0-9-]{36})(?:\/(file|preview))?)?$/,
    );
    if (!match) return false;
    const admin = match[1] !== "public",
      id = match[2],
      role = match[3];
    if (!admin && method !== "GET")
      fail(405, "Public character library is read-only.");
    if (method === "GET") {
      if (role) {
        await serve(id, role, admin, params.get("v"), res);
        return true;
      }
      send(
        res,
        200,
        id ? { item: metadata(get(id, admin), admin) } : list(params, admin),
      );
      return true;
    }
    if (!admin || !session) fail(401, "Administrator sign-in required.");
    if (
      (method === "POST" && !id) ||
      (method === "PUT" && id && !role) ||
      (method === "DELETE" && id && !role)
    ) {
      send(res, method === "POST" ? 201 : 200, {
        item: await mutate(method, id, input, session),
      });
      return true;
    }
    fail(405, "Method not allowed.");
  }
  return { handle, exists, assetRoot };
}
