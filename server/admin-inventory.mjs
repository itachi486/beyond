// Invoked only AFTER the common administrator session/origin/CSRF gate.
import { adminAllowedEmail } from "./auth.mjs";
import { fail } from "./validation.mjs";
export function readInventory(
  db,
  path,
  params,
  { now, session, authEnv, aiEnv },
) {
  const tableExists = (name) =>
    !!db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
  const numericPage = Number(params.get("page") || 1);
  const search = (params.get("search") || "").trim();
  if (
    search.length > 200 ||
    !Number.isInteger(numericPage) ||
    numericPage < 1 ||
    numericPage > 100000
  )
    fail(400, "Invalid search or page.");
  const paginate = (total, query, args = []) => {
    const totalPages = Math.max(1, Math.ceil(total / 10)),
      page = Math.min(numericPage, totalPages);
    return {
      items: db
        .prepare(query + " LIMIT 10 OFFSET ?")
        .all(...args, (page - 1) * 10),
      total,
      page,
      totalPages,
    };
  };
  if (path === "/api/admin/system")
    return {
      database: "Connected",
      administratorPolicy: "Single allowed email",
      administratorConfigured: !!adminAllowedEmail(authEnv),
      sessionExpiresAt: session.expires_at,
      csrfProtection: true,
      imageServiceConfigured: !!(
        aiEnv.OPENAI_API_KEY?.trim() || aiEnv.AI_IMAGE_API_KEY?.trim()
      ),
      publicUserAccounts: "Not implemented",
      localCharacters: "Not centrally stored",
      localWorlds: "Not centrally stored",
      storage:
        "SQLite editorial content / browser IndexedDB assets and localStorage worlds",
    };
  if (path === "/api/admin/users") {
    const status = params.get("status") || "";
    if (!["", "allowed", "blocked"].includes(status))
      fail(400, "Invalid account status.");
    const where =
      " WHERE (instr(lower(email),lower(?))>0 OR instr(id,?)>0) AND (?='' OR CASE WHEN email=? THEN 'allowed' ELSE 'blocked' END=?)";
    const args = [search, search, status, adminAllowedEmail(authEnv), status];
    const total = db
      .prepare("SELECT COUNT(*) n FROM admins" + where)
      .get(...args).n;
    const result = paginate(
      total,
      "SELECT id,email,created_at AS createdAt,CASE WHEN email=? THEN 'allowed' ELSE 'blocked' END AS status,(SELECT COUNT(*) FROM sessions s WHERE s.admin_id=admins.id AND s.expires_at>?) AS activeSessions FROM admins" +
        where +
        " ORDER BY created_at DESC",
      [adminAllowedEmail(authEnv), now, ...args],
    );
    return {
      ...result,
      scope:
        "Server administrator accounts only. Public visitor accounts are not implemented.",
    };
  }
  const user = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9-]+)$/);
  if (user) {
    const record = db
      .prepare("SELECT id,email,created_at AS createdAt FROM admins WHERE id=?")
      .get(user[1]);
    if (!record) fail(404, "Account not found.");
    return {
      item: {
        ...record,
        status:
          record.email === adminAllowedEmail(authEnv) ? "allowed" : "blocked",
        role: "Administrator",
        activeSessions: db
          .prepare(
            "SELECT COUNT(*) n FROM sessions WHERE admin_id=? AND expires_at>?",
          )
          .get(record.id, now).n,
      },
      editable: false,
    };
  }
  if (path === "/api/admin/characters") {
    if (!tableExists("ai_character_assets"))
      return {
        items: [],
        total: 0,
        page: 1,
        totalPages: 1,
        scope:
          "No server-generated image assets stored. Uploaded character libraries are not centrally stored.",
      };
    const where =
      " WHERE (instr(a.id,?)>0 OR instr(lower(COALESCE(u.email,'')),lower(?))>0)";
    const total = db
      .prepare(
        "SELECT COUNT(*) n FROM ai_character_assets a LEFT JOIN admins u ON u.id=a.creator_id" +
          where,
      )
      .get(search, search).n;
    const result = paginate(
      total,
      "SELECT a.id,a.creator_id AS creatorId,u.email AS creator,a.mime,length(a.bytes) AS bytes,a.created_at AS createdAt FROM ai_character_assets a LEFT JOIN admins u ON u.id=a.creator_id" +
        where +
        " ORDER BY a.created_at DESC,a.id",
      [search, search],
    );
    return {
      ...result,
      items: result.items.map((a) => ({
        ...a,
        previewUrl:
          a.creatorId === session.admin_id ? "/api/ai/assets/" + a.id : null,
        worldUsage: null,
      })),
      scope:
        "Server-generated image assets only. Character names, placements and browser uploads are not centrally stored.",
    };
  }
  return null;
}
