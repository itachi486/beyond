import { randomUUID } from "node:crypto";
import { rows, publicUniverse } from "./store.mjs";
import {
  digest,
  normalizeEmail,
  validEmail,
  verifyPassword,
  hashPassword,
  passwordPolicy,
  findSession,
  newSession,
  cookie,
} from "./auth.mjs";
import {
  Problem,
  fail,
  validateWorld,
  validateDiscovery,
} from "./validation.mjs";
export function createAPI(
  db,
  {
    production = false,
    origin,
    now = Date.now,
    sessionTTL = 8 * 60 * 60 * 1000,
  } = {},
) {
  if (!origin) throw Error("An explicit application origin is required.");
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
  async function body(req) {
    let size = 0,
      chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 128 * 1024) fail(413, "Request is too large.");
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
      const session = findSession(db, req, production, now());
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
        input = await body(req);
        if (!login && !findSession(db, req, production, now()))
          fail(401, "Administrator session expired.");
      }
      if (login) {
        if (req.method !== "POST") fail(405, "Method not allowed.");
        const email = normalizeEmail(input.email);
        attempt("ip:" + req.socket.remoteAddress, 20);
        attempt("account:" + email, 6);
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
        attempt("password:" + admin.id, 6);
        if (!(await verifyPassword(input.currentPassword, admin.password_hash)))
          fail(400, "Current password is incorrect.");
        if (!passwordPolicy(input.newPassword))
          fail(
            400,
            "Use a password of at least 12 characters and at most 256 bytes.",
          );
        const hash = await hashPassword(input.newPassword);
        transaction(() => {
          if (!findSession(db, req, production, now()))
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
      if (path === "/api/admin/dashboard" && req.method === "GET") {
        const worlds = rows(db, "worlds"),
          discoveries = rows(db, "discoveries");
        send(res, 200, {
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
