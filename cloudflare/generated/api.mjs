// Generated from server/api.mjs by cloudflare/generate-api.mjs. Do not edit by hand.
import { permanentDelete } from "../permanent-delete.mjs";
import { fantasyOverview } from "../../server/fantasy-overview.mjs";
import { createCentralLibrary } from "./central-library.mjs";
import { initialAdminState } from "../../server/admin-setup-state.mjs";
import { readInventory } from "./admin-inventory.mjs";
import { createImageAPI } from "./ai-images.mjs";
import { randomUUID } from "node:crypto";
import { rows, publicUniverse } from "../store.mjs";
import {
  digest,
  adminAllowedEmail,
  normalizeEmail,
  validEmail,
  verifyPassword,
  hashPassword,
  passwordPolicy,
  findSession,
  newSession,
  cookie,
} from "../../server/auth.mjs";
import {
  Problem,
  fail,
  validateWorld,
  validateDiscovery,
} from "../../server/validation.mjs";
export function createAPI(
  db,
  {
    production = false,
    origin,
    now = Date.now,
    sessionTTL = 8 * 60 * 60 * 1000,
    aiEnv = process.env,
    authEnv = process.env,
    assetRoot = authEnv.BEYOND_ASSET_DIR,
    aiTransport = fetch,
  } = {},
) {
  if (!origin) throw Error("An explicit application origin is required.");
  const imageAPI = createImageAPI(db, {
    origin,
    production,
    now,
    env: aiEnv,
    authEnv,
    transport: aiTransport,
  });
  const expectedOrigin = new URL(origin).origin;
  if (production && !expectedOrigin.startsWith("https://"))
    throw Error("Production requires an HTTPS application origin.");
  const send = (res, status, value, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    });
    res.end(JSON.stringify(value));
  };
  const revision = (kind, id, actor, snapshot) =>
    db
      .prepare(
        "INSERT INTO revisions(kind,record_id,actor,snapshot,created_at) VALUES(?,?,?,?,?)",
      )
      .run(
        kind,
        id,
        actor,
        JSON.stringify(snapshot),
        new Date(now()).toISOString(),
      );
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      db.exec("COMMIT");
      return r;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function attempt(key, maximum) {
    const t = now(),
      hash = digest(key);
    db.prepare("DELETE FROM login_limits WHERE reset_at<=?").run(t);
    const row = db
      .prepare("SELECT * FROM login_limits WHERE key_hash=?")
      .get(hash);
    if (row && row.reset_at > t && row.attempts >= maximum)
      fail(429, "Too many login attempts. Try again later.");
    db.prepare(
      "INSERT INTO login_limits VALUES(?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,reset_at=excluded.reset_at",
    ).run(
      hash,
      row && row.reset_at > t ? row.attempts + 1 : 1,
      row && row.reset_at > t ? row.reset_at : t + 15 * 60 * 1000,
    );
  }
  async function body(req, maximum = 128 * 1024) {
    if (Number(req.headers["content-length"] || 0) > maximum)
      fail(413, "Request is too large.");
    let size = 0,
      chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maximum) fail(413, "Request is too large.");
      chunks.push(chunk);
    }
    try {
      const b = JSON.parse(Buffer.concat(chunks).toString());
      if (!b || Array.isArray(b) || typeof b !== "object") throw Error();
      return b;
    } catch {
      fail(400, "Send a valid JSON object.");
    }
  }
  function list(kind, params) {
    const all = rows(db, kind);
    const search = (params.get("search") || "").toLowerCase(),
      state = params.get("status"),
      worldId = params.get("worldId");
    const filtered = all.filter(
      (r) =>
        (!state || r.status === state) &&
        (!worldId || r.worldId === worldId) &&
        (!search ||
          [r.title?.en, r.title?.es, r.name?.en, r.name?.es, r.slug].some((s) =>
            s?.toLowerCase().includes(search),
          )),
    );
    const limit = 10,
      requested = Number(params.get("page") || 1);
    if (!Number.isInteger(requested) || requested < 1 || requested > 100000)
      fail(400, "Invalid page number.");
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit)),
      page = Math.min(requested, totalPages);
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      totalPages,
    };
  }
  function item(table, id) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    if (!row) fail(404, "Record not found.");
    return {
      ...JSON.parse(row.data),
      id: row.id,
      slug: row.slug,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  return async function handle(req, res, next) {
    if (await imageAPI(req, res)) return true;
    const url = new URL(req.url, "http://local.invalid"),
      path = url.pathname;
    const isAPI = path.startsWith("/api/");
    const privatePage =
      path === "/admin" ||
      (path.startsWith("/admin/") && path !== "/admin/login");
    if (!isAPI && !privatePage) {
      next?.();
      return false;
    }
    try {
      const session = findSession(db, req, production, now(), authEnv);
      const library = createCentralLibrary(db, {
        root: assetRoot,
        now,
        authorized: () => !!findSession(db, req, production, now(), authEnv),
      });
      if (
        path.startsWith("/api/public/characters") &&
        (await library.handle(
          path,
          req.method,
          url.searchParams,
          {},
          null,
          res,
          send,
        ))
      )
        return true;
      if (privatePage) {
        if (!session) {
          res.writeHead(302, {
            Location: "/admin/login",
            "Cache-Control": "no-store",
          });
          res.end();
          return true;
        }
        res.setHeader("Cache-Control", "no-store");
        next?.();
        return false;
      }
      if (path === "/api/public/universe" && req.method === "GET") {
        send(res, 200, publicUniverse(db));
        return true;
      }
      if (!path.startsWith("/api/admin/")) fail(404, "Endpoint not found.");
      if (path === "/api/admin/setup-status" && req.method === "GET") {
        send(res, 200, initialAdminState(db, authEnv));
        return true;
      }
      const login = path === "/api/admin/login";
      if (!login && !session) fail(401, "Administrator sign-in required.");
      let input = {};
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers.origin !== expectedOrigin)
          fail(403, "Request origin rejected.");
        if (
          !String(req.headers["content-type"] || "").startsWith(
            "application/json",
          )
        )
          fail(415, "Use application/json.");
        if (!login && req.headers["x-csrf-token"] !== session.csrf)
          fail(403, "Request verification failed. Refresh and try again.");
        input = await body(
          req,
          path.startsWith("/api/admin/library/characters")
            ? 26 * 1024 * 1024
            : 128 * 1024,
        );
        if (!login && !findSession(db, req, production, now(), authEnv))
          fail(401, "Administrator session expired.");
      }
      if (login) {
        if (req.method !== "POST") fail(405, "Method not allowed.");
        if (!adminAllowedEmail(authEnv))
          fail(
            503,
            "Administrator access is not configured. Set one valid ADMIN_ALLOWED_EMAIL on the server.",
          );
        if (db.prepare("SELECT COUNT(*) n FROM admins").get().n === 0)
          fail(
            409,
            "The initial administrator password has not been set. Run npm run admin:setup in the project terminal.",
          );
        const email = normalizeEmail(input.email);
        attempt("ip:" + req.socket.remoteAddress, 20);
        attempt("account:" + email, 6); await db.flush();
        const admin = db
          .prepare("SELECT * FROM admins WHERE email=?")
          .get(email);
        const dummy =
          "scrypt$32768$8$1$" + "0".repeat(32) + "$" + "0".repeat(128);
        const valid = await verifyPassword(
          input.password,
          admin?.password_hash || dummy,
        );
        if (
          !validEmail(email) ||
          email !== adminAllowedEmail(authEnv) ||
          db.prepare("SELECT COUNT(*) AS n FROM admins").get().n !== 1 ||
          !admin ||
          !valid ||
          db
            .prepare("SELECT password_hash FROM admins WHERE id=?")
            .get(admin.id)?.password_hash !== admin.password_hash
        )
          fail(401, "Email or password is incorrect.");
        if (session)
          db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
            session.token_hash,
          );
        const created = newSession(db, admin.id, sessionTTL, now());
        send(
          res,
          200,
          { ok: true },
          {
            "Set-Cookie": cookie(
              created.token,
              production,
              Math.floor(sessionTTL / 1000),
            ),
          },
        );
        return true;
      }
      if (path === "/api/admin/session" && req.method === "GET") {
        send(res, 200, {
          email: session.email,
          csrf: session.csrf,
          expiresAt: session.expires_at,
        });
        return true;
      }
      if (path === "/api/admin/logout" && req.method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
          session.token_hash,
        );
        send(
          res,
          200,
          { ok: true },
          { "Set-Cookie": cookie("", production, 0) },
        );
        return true;
      }
      if (path === "/api/admin/password" && req.method === "POST") {
        const admin = db
          .prepare("SELECT * FROM admins WHERE id=?")
          .get(session.admin_id);
        attempt("password:" + admin.id, 6); await db.flush();
        if (!(await verifyPassword(input.currentPassword, admin.password_hash)))
          fail(400, "Current password is incorrect.");
        if (!passwordPolicy(input.newPassword))
          fail(
            400,
            "Use a password of at least 12 characters and at most 256 bytes.",
          );
        const hash = await hashPassword(input.newPassword);
        transaction(() => {
          if (!findSession(db, req, production, now(), authEnv))
            fail(401, "Administrator session expired.");
          if (
            db
              .prepare("SELECT password_hash FROM admins WHERE id=?")
              .get(admin.id)?.password_hash !== admin.password_hash
          )
            fail(
              409,
              "Credentials changed during this request. Sign in again.",
            );
          db.prepare("UPDATE admins SET password_hash=? WHERE id=?").run(
            hash,
            admin.id,
          );
          db.prepare("DELETE FROM sessions WHERE admin_id=?").run(admin.id);
        });
        const created = newSession(db, admin.id, sessionTTL, now());
        send(
          res,
          200,
          { ok: true },
          {
            "Set-Cookie": cookie(
              created.token,
              production,
              Math.floor(sessionTTL / 1000),
            ),
          },
        );
        return true;
      }
      if (
        path.startsWith("/api/admin/library/characters") &&
        (await library.handle(
          path,
          req.method,
          url.searchParams,
          input,
          session,
          res,
          send,
        ))
      )
        return true;
      if (path === "/api/admin/deletion-jobs" && req.method === "GET") {
        const exists = db
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE name='permanent_deletion_jobs'",
          )
          .get();
        send(res, 200, {
          items: exists
            ? db
                .prepare(
                  "SELECT kind,target_id id,version,created_at createdAt FROM permanent_deletion_jobs ORDER BY created_at LIMIT 100",
                )
                .all()
            : [],
        });
        return true;
      }
      if (path === "/api/admin/activity" && req.method === "GET") {
        const table = db
          .prepare("SELECT 1 FROM sqlite_master WHERE name='central_activity'")
          .get();
        const base =
          "SELECT 'revision-'||id AS id,'Edited '||kind AS action,'Saved revision' AS name,created_at AS createdAt FROM revisions" +
          (table
            ? " UNION ALL SELECT id,action,name,created_at AS createdAt FROM central_activity"
            : "");
        const search = (url.searchParams.get("search") || "").slice(0, 200),
          requested = Number(url.searchParams.get("page") || 1);
        if (!Number.isInteger(requested) || requested < 1 || requested > 100000)
          fail(400, "Invalid page.");
        const query =
          " FROM (" +
          base +
          ") WHERE instr(lower(action||' '||name),lower(?))>0";
        const total = db.prepare("SELECT COUNT(*) n" + query).get(search).n,
          totalPages = Math.max(1, Math.ceil(total / 10)),
          page = Math.min(requested, totalPages);
        send(res, 200, {
          items: db
            .prepare(
              "SELECT *" + query + " ORDER BY createdAt DESC LIMIT 10 OFFSET ?",
            )
            .all(search, (page - 1) * 10),
          total,
          page,
          totalPages,
        });
        return true;
      }
      if (path === "/api/admin/fantasy-overview" && req.method === "GET") {
        send(res, 200, fantasyOverview(db, now()));
        return true;
      }
      if (path === "/api/admin/cosmic-overview" && req.method === "GET") {
        const worlds = rows(db, "worlds");
        const has = library.exists();
        send(res, 200, {
          totals: {
            worlds: worlds.length,
            characters: has
              ? db
                  .prepare(
                    "SELECT COUNT(*) n FROM central_characters WHERE deleted=0",
                  )
                  .get().n
              : 0,
            connections: db.prepare("SELECT COUNT(*) n FROM connections").get()
              .n,
            activeUsers: db
              .prepare(
                "SELECT COUNT(DISTINCT s.admin_id) n FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.expires_at>? AND a.email=?",
              )
              .get(now(), adminAllowedEmail(authEnv)).n,
          },
          scope:
            "SQLite editorial worlds/connections, central characters and active administrator sessions only. Browser worlds/characters and public visitors are not counted.",
          worlds: worlds.map((w) => ({
            id: w.id,
            name: w.name,
            status: w.status,
            hubKey: w.hubKey,
            hubPosition: w.hubPosition,
            updatedAt: w.updatedAt,
          })),
          edges: db
            .prepare(
              "SELECT DISTINCT a.world_id AS source,b.world_id AS target FROM connections c JOIN discoveries a ON a.id=c.from_id JOIN discoveries b ON b.id=c.to_id WHERE a.world_id<>b.world_id",
            )
            .all(),
          distribution: has
            ? db
                .prepare(
                  "SELECT type,COUNT(*) count FROM central_characters WHERE deleted=0 GROUP BY type ORDER BY count DESC",
                )
                .all()
            : [],
          activity: [
            ...(has
              ? db
                  .prepare(
                    "SELECT id,action,name,created_at AS createdAt FROM central_activity ORDER BY created_at DESC LIMIT 20",
                  )
                  .all()
              : []),
            ...db
              .prepare(
                "SELECT id,kind,created_at AS createdAt FROM revisions ORDER BY id DESC LIMIT 20",
              )
              .all()
              .map((r) => ({
                id: "revision-" + r.id,
                action: "Edited " + r.kind,
                name: "Saved revision",
                createdAt: r.createdAt,
              })),
          ]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 20),
        });
        return true;
      }
      if (req.method === "GET") {
        const inventory = readInventory(db, path, url.searchParams, {
          now: now(),
          session,
          authEnv,
          aiEnv,
        });
        if (inventory) {
          send(res, 200, inventory);
          return true;
        }
      }
      if (path === "/api/admin/dashboard" && req.method === "GET") {
        const worlds = rows(db, "worlds"),
          discoveries = rows(db, "discoveries");
        send(res, 200, {
          administratorAccounts: db
            .prepare("SELECT COUNT(*) n FROM admins")
            .get().n,
          serverCharacterAssets: db
            .prepare(
              "SELECT 1 FROM sqlite_master WHERE name='ai_character_assets' AND type='table'",
            )
            .get()
            ? db.prepare("SELECT COUNT(*) n FROM ai_character_assets").get().n
            : 0,
          browserCharacters: null,
          browserWorlds: null,
          worlds: worlds.length,
          totalDiscoveries: discoveries.length,
          needsReview: discoveries.filter(
            (d) => d.verificationStatus === "needs_review",
          ).length,
          verified: discoveries.filter(
            (d) => d.verificationStatus === "verified",
          ).length,
          published: publicUniverse(db).discoveries.length,
          drafts: discoveries.filter((d) => d.status === "draft").length,
          review: discoveries.filter((d) => d.status === "review").length,
          recent: [
            ...worlds.map((w) => ({ ...w, kind: "world" })),
            ...discoveries.map((d) => ({ ...d, kind: "discovery" })),
          ]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 6),
        });
        return true;
      }
      if (path === "/api/admin/catalog" && req.method === "GET") {
        send(res, 200, {
          worlds: rows(db, "worlds").map((w) => ({
            id: w.id,
            name: w.name,
            status: w.status,
            hubKey: w.hubKey,
          })),
          discoveries: rows(db, "discoveries").map((d) => ({
            id: d.id,
            title: d.title,
            worldId: d.worldId,
            status: d.status,
          })),
          connections: db
            .prepare("SELECT * FROM connections ORDER BY id")
            .all(),
        });
        return true;
      }
      const deletion = path.match(
        /^\/api\/admin\/worlds\/([a-zA-Z0-9-]{1,80})\/permanent-delete$/,
      );
      if (deletion) {
        if (req.method !== "POST") fail(405, "Method not allowed.");
        send(
          res,
          200,
          await permanentDelete(db, {
            kind: "world",
            id: deletion[1],
            input,
            session,
            now,
            authorized: () =>
              !!findSession(db, req, production, now(), authEnv),
          }),
        );
        return true;
      }
      const recordMatch = path.match(
        /^\/api\/admin\/(worlds|discoveries)(?:\/([a-zA-Z0-9-]+))?$/,
      );
      if (recordMatch) {
        const [, table, id] = recordMatch;
        if (req.method === "GET") {
          send(
            res,
            200,
            id
              ? {
                  item: item(table, id),
                  history: db
                    .prepare(
                      "SELECT id,actor,snapshot,created_at FROM revisions WHERE kind=? AND record_id=? ORDER BY id DESC LIMIT 20",
                    )
                    .all(table, id),
                }
              : list(table, url.searchParams),
          );
          return true;
        }
        if (req.method !== "POST" && req.method !== "PUT")
          fail(405, "Use archive rather than deleting content.");
        if ((req.method === "POST" && id) || (req.method === "PUT" && !id))
          fail(405, "Method not allowed.");
        const old = id ? item(table, id) : null;
        const data =
          table === "worlds"
            ? validateWorld(input, old)
            : validateDiscovery(input, db, old);
        if (old && input.version !== old.version)
          fail(409, "This record changed. Reload before saving.");
        const recordId = id || randomUUID(),
          timestamp = new Date(now()).toISOString();
        if (old && old.slug !== data.slug)
          data.aliases = [...new Set([...(old.aliases || []), old.slug])];
        // A historical slug may not be reused for another record of the same kind.
        if (
          rows(db, table).some(
            (r) =>
              r.id !== recordId &&
              (r.slug === data.slug || (r.aliases || []).includes(data.slug)),
          )
        )
          fail(409, "This slug is already used.");
        transaction(() => {
          if (old) {
            revision(table, recordId, session.admin_id, old);
            const statement =
              table === "worlds"
                ? "UPDATE worlds SET slug=?,status=?,data=?,version=version+1,updated_at=? WHERE id=? AND version=?"
                : "UPDATE discoveries SET slug=?,status=?,data=?,version=version+1,updated_at=?,world_id=? WHERE id=? AND version=?";
            const args = [
              data.slug,
              data.status,
              JSON.stringify(data),
              timestamp,
              ...(table === "discoveries" ? [data.worldId] : []),
              recordId,
              old.version,
            ];
            if (db.prepare(statement).run(...args).changes !== 1)
              fail(409, "This record changed. Reload before saving.");
          } else if (table === "worlds")
            db.prepare(
              "INSERT INTO worlds(id,slug,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)",
            ).run(
              recordId,
              data.slug,
              data.status,
              JSON.stringify(data),
              timestamp,
              timestamp,
            );
          else
            db.prepare(
              "INSERT INTO discoveries(id,slug,world_id,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
            ).run(
              recordId,
              data.slug,
              data.worldId,
              data.status,
              JSON.stringify(data),
              timestamp,
              timestamp,
            );
        });
        send(res, old ? 200 : 201, { item: item(table, recordId) });
        return true;
      }
      if (path === "/api/admin/connections" && req.method === "POST") {
        if (input.fromId === input.toId)
          fail(400, "A discovery cannot link to itself.");
        for (const id of [input.fromId, input.toId]) {
          const r = db
            .prepare("SELECT status FROM discoveries WHERE id=?")
            .get(id);
          if (!r || r.status === "archived")
            fail(400, "Choose existing, non-archived discoveries.");
        }
        if (
          typeof input.explanation !== "string" ||
          !input.explanation.trim() ||
          input.explanation.length > 1000
        )
          fail(400, "Explain this connection in 1–1000 characters.");
        const id = randomUUID();
        db.prepare("INSERT INTO connections VALUES(?,?,?,?)").run(
          id,
          input.fromId,
          input.toId,
          input.explanation.trim(),
        );
        send(res, 201, { id });
        return true;
      }
      const link = path.match(/^\/api\/admin\/connections\/([a-zA-Z0-9-]+)$/);
      if (link) {
        const old = db
          .prepare("SELECT * FROM connections WHERE id=?")
          .get(link[1]);
        if (!old) fail(404, "Connection not found.");
        if (req.method === "PUT") {
          if (
            typeof input.explanation !== "string" ||
            !input.explanation.trim() ||
            input.explanation.length > 1000
          )
            fail(400, "Explain this connection in 1–1000 characters.");
          transaction(() => {
            revision("connections", old.id, session.admin_id, old);
            db.prepare("UPDATE connections SET explanation=? WHERE id=?").run(
              input.explanation.trim(),
              old.id,
            );
          });
          send(res, 200, { ok: true });
          return true;
        }
        if (req.method === "DELETE") {
          transaction(() => {
            revision("connections", old.id, session.admin_id, old);
            db.prepare("DELETE FROM connections WHERE id=?").run(old.id);
          });
          send(res, 200, { ok: true });
          return true;
        }
        fail(405, "Method not allowed.");
      }
      if (path === "/api/admin/settings") {
        if (req.method === "GET") {
          send(
            res,
            200,
            JSON.parse(
              db.prepare("SELECT data FROM settings WHERE id=1").get().data,
            ),
          );
          return true;
        }
        if (req.method === "PUT") {
          if (!["en", "es"].includes(input.defaultLanguage))
            fail(400, "Choose English or Spanish.");
          db.prepare("UPDATE settings SET data=? WHERE id=1").run(
            JSON.stringify({ defaultLanguage: input.defaultLanguage }),
          );
          send(res, 200, { ok: true });
          return true;
        }
      }
      fail(404, "Endpoint not found.");
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return true;
      }
      if (e instanceof Problem) send(res, e.status, { error: e.message });
      else if (String(e?.message).includes("UNIQUE constraint"))
        send(res, 409, { error: "That slug or connection already exists." });
      else send(res, 500, { error: "The request could not be completed." });
      return true;
    }
  };
}
