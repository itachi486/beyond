import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { openStore, publicUniverse, seed } from "../store.mjs";
import { createAPI } from "../api.mjs";
import { createInitialAdmin, cookie } from "../auth.mjs";
async function fixture(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "beyond-admin-test-")),
    file = join(dir, "test.sqlite"),
    db = openStore(file);
  const password = randomBytes(16).toString("base64url");
  if (!options.emptyAdmin)
    await createInitialAdmin(db, "owner@example.test", password, {
      ADMIN_ALLOWED_EMAIL: "owner@example.test",
    });
  let time = Date.now();
  const api = createAPI(db, {
    origin: "http://localhost",
    authEnv: { ADMIN_ALLOWED_EMAIL: "owner@example.test" },
    now: () => time,
    ...options,
  });
  const server = createServer((req, res) => {
    void api(req, res, () => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("Public shell");
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  let cookieHeader = "",
    csrf = "";
  const call = async (path, method = "GET", data, headers = {}) => {
    const r = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        Origin: "http://localhost",
        ...(method !== "GET"
          ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
          : {}),
        Cookie: cookieHeader,
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    let body;
    try {
      body = await r.json();
    } catch {
      body = null;
    }
    return { status: r.status, body, headers: r.headers };
  };
  const login = async () => {
    const r = await call("/api/admin/login", "POST", {
      email: "owner@example.test",
      password,
    });
    assert.equal(r.status, 200);
    cookieHeader = r.headers.get("set-cookie").split(";")[0];
    csrf = (await call("/api/admin/session")).body.csrf;
    return r;
  };
  return {
    dir,
    file,
    base,
    db,
    password,
    call,
    login,
    expire: () => (time += 9 * 60 * 60 * 1000),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
const discovery = () => ({
  title: { en: "Isolated editorial content", es: "Contenido de prueba" },
  summary: { en: "A test hint", es: "Una pista" },
  body: [
    { en: "Clearly labeled isolated test content.", es: "Contenido aislado." },
  ],
  slug: "isolated-test",
  worldId: "archive",
  status: "draft",
  truthType: "factual",
  verificationStatus: "verified",
  uncertainty: "",
  position: [3, 1, -18],
  contentType: "question",
  sources: [
    {
      url: "https://science.nasa.gov/dark-matter/",
      description:
        "NASA dark matter overview; entered source, not automatically verified.",
      verification: "unverified",
    },
  ],
  evidence: "An observation field.",
  interpretation: "An interpretation field.",
  questions: "An open question.",
  media: "",
});
test("initial migration preserves original public IDs, data and connections; Signal stays draft", async () => {
  const f = await fixture();
  try {
    const data = publicUniverse(f.db);
    assert.deepEqual(
      data.worlds.filter((w) => !w.hubKey).map((w) => w.id),
      seed.worlds.map((w) => w.id),
    );
    assert.equal(data.discoveries.length, 8);
    for (const original of seed.discoveries) {
      const d = data.discoveries.find((d) => d.id === original.id);
      for (const key of [
        "slug",
        "title",
        "summary",
        "body",
        "position",
        "relatedIds",
      ])
        assert.deepEqual(d[key], original[key]);
    }
    assert.ok(!data.worlds.some((w) => w.id === "signal"));
    assert.ok(!data.discoveries.some((d) => d.id === "signal-introduction"));
    assert.equal(statSync(f.file).mode & 0o777, 0o600);
    const again = openStore(f.file);
    assert.equal(again.prepare("SELECT count(*) n FROM worlds").get().n, 11);
    again.close();
  } finally {
    await f.close();
  }
});
test("unauthenticated pages, APIs and mutations remain protected; no public registration", async () => {
  const f = await fixture();
  try {
    for (const path of ["/admin", "/admin/worlds", "/admin/discoveries/new"]) {
      const r = await f.call(path);
      assert.equal(r.status, 302);
      assert.equal(r.headers.get("location"), "/admin/login");
    }
    for (const path of [
      "/api/admin/session",
      "/api/admin/dashboard",
      "/api/admin/worlds",
      "/api/admin/discoveries",
      "/api/admin/connections",
      "/api/admin/settings",
      "/api/admin/register",
    ])
      assert.equal((await f.call(path, "POST", {})).status, 401);
    assert.equal((await f.call("/api/public/universe")).status, 200);
  } finally {
    await f.close();
  }
});
test("login errors, secure cookie flags, CSRF, origin, expiry and logout", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.call("/api/admin/login", "POST", {
          email: "owner@example.test",
          password: "incorrect",
        })
      ).status,
      401,
    );
    const login = await f.login();
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    assert.match(cookie("x", true), /Secure/);
    assert.match(cookie("x", true), /^__Host-/);
    assert.equal(
      (await f.call("/api/admin/worlds", "POST", {}, { "X-CSRF-Token": "bad" }))
        .status,
      403,
    );
    assert.equal(
      (
        await f.call(
          "/api/admin/worlds",
          "POST",
          {},
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    f.expire();
    assert.equal((await f.call("/api/admin/session")).status, 401);
    await f.login();
    assert.equal((await f.call("/api/admin/logout", "POST", {})).status, 200);
    assert.equal((await f.call("/api/admin/session")).status, 401);
  } finally {
    await f.close();
  }
});
test("login attempts are rate limited across persisted requests", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 6; i++)
      assert.equal(
        (
          await f.call("/api/admin/login", "POST", {
            email: "owner@example.test",
            password: "wrong",
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await f.call("/api/admin/login", "POST", {
          email: "owner@example.test",
          password: "wrong",
        })
      ).status,
      429,
    );
    assert.equal(
      f.db.prepare("SELECT count(*) n FROM login_limits").get().n,
      2,
    );
  } finally {
    await f.close();
  }
});
test("draft/review/publication visibility, safe text, alias URLs, concurrency and archive history", async () => {
  const f = await fixture();
  try {
    await f.login();
    const input = discovery();
    input.title.en = "<script>alert(1)</script>";
    let r = await f.call("/api/admin/discoveries", "POST", input);
    assert.equal(r.status, 201);
    const id = r.body.item.id;
    let current = r.body.item;
    assert.ok(!publicUniverse(f.db).discoveries.some((d) => d.id === id));
    current = { ...current, status: "review" };
    current = (await f.call("/api/admin/discoveries/" + id, "PUT", current))
      .body.item;
    assert.ok(!publicUniverse(f.db).discoveries.some((d) => d.id === id));
    current = (
      await f.call("/api/admin/discoveries/" + id, "PUT", {
        ...current,
        status: "published",
      })
    ).body.item;
    assert.equal(
      publicUniverse(f.db).discoveries.find((d) => d.id === id).title.en,
      input.title.en,
    );
    assert.deepEqual(
      publicUniverse(f.db).discoveries.find((d) => d.id === id).position,
      input.position,
    );
    assert.equal(
      (
        await f.call("/api/admin/discoveries/" + id, "PUT", {
          ...current,
          version: 1,
        })
      ).status,
      409,
    );
    current = (
      await f.call("/api/admin/discoveries/" + id, "PUT", {
        ...current,
        slug: "changed-test",
        status: "draft",
      })
    ).body.item;
    assert.ok(current.aliases.includes("isolated-test"));
    assert.ok(!publicUniverse(f.db).discoveries.some((d) => d.id === id));
    current = (
      await f.call("/api/admin/discoveries/" + id, "PUT", {
        ...current,
        status: "archived",
      })
    ).body.item;
    const detail = await f.call("/api/admin/discoveries/" + id);
    assert.ok(detail.body.history.length >= 4);
    assert.ok(f.db.prepare("SELECT 1 FROM discoveries WHERE id=?").get(id));
    assert.equal(
      (await f.call("/api/admin/discoveries/" + id, "DELETE", {})).status,
      405,
    );
  } finally {
    await f.close();
  }
});
test("publication rejects missing sources, invalid URLs and non-finite placement", async () => {
  const f = await fixture();
  try {
    await f.login();
    for (const change of [
      { status: "published", sources: [] },
      { status: "published", worldId: "signal" },
      { sources: [{ url: "javascript:alert(1)", description: "bad" }] },
      { position: [101, 0, 0] },
    ])
      assert.equal(
        (
          await f.call("/api/admin/discoveries", "POST", {
            ...discovery(),
            ...change,
          })
        ).status,
        400,
      );
  } finally {
    await f.close();
  }
});
test("world lifecycle persists, hides associated content and restores without deleting", async () => {
  const f = await fixture();
  try {
    await f.login();
    const world = {
      name: { en: "Isolated world", es: "" },
      description: { en: "A test world", es: "" },
      slug: "isolated-world",
      theme: "natural",
      color: "#78D9CC",
      symbol: "06",
      order: 6,
      status: "draft",
    };
    let r = await f.call("/api/admin/worlds", "POST", world);
    assert.equal(r.status, 201);
    let w = r.body.item;
    w = (
      await f.call("/api/admin/worlds/" + w.id, "PUT", {
        ...w,
        status: "published",
      })
    ).body.item;
    assert.ok(publicUniverse(f.db).worlds.some((x) => x.id === w.id));
    const d = (
      await f.call("/api/admin/discoveries", "POST", {
        ...discovery(),
        worldId: w.id,
        status: "published",
      })
    ).body.item;
    assert.ok(publicUniverse(f.db).discoveries.some((x) => x.id === d.id));
    w = (
      await f.call("/api/admin/worlds/" + w.id, "PUT", {
        ...w,
        status: "archived",
      })
    ).body.item;
    assert.ok(!publicUniverse(f.db).discoveries.some((x) => x.id === d.id));
    w = (
      await f.call("/api/admin/worlds/" + w.id, "PUT", {
        ...w,
        status: "published",
      })
    ).body.item;
    assert.ok(publicUniverse(f.db).discoveries.some((x) => x.id === d.id));
    assert.equal(
      (await f.call("/api/admin/worlds/" + w.id, "DELETE", {})).status,
      405,
    );
  } finally {
    await f.close();
  }
});
test("connections validate references/self-links, persist explanations and hide archived targets", async () => {
  const f = await fixture();
  try {
    await f.login();
    const a = (
      await f.call("/api/admin/discoveries", "POST", {
        ...discovery(),
        status: "published",
      })
    ).body.item;
    const b = (
      await f.call("/api/admin/discoveries", "POST", {
        ...discovery(),
        slug: "second-test",
        status: "published",
      })
    ).body.item;
    assert.equal(
      (
        await f.call("/api/admin/connections", "POST", {
          fromId: a.id,
          toId: a.id,
          explanation: "self",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.call("/api/admin/connections", "POST", {
          fromId: a.id,
          toId: "missing",
          explanation: "bad",
        })
      ).status,
      400,
    );
    let r = await f.call("/api/admin/connections", "POST", {
      fromId: a.id,
      toId: b.id,
      explanation: "A shared test question.",
    });
    assert.equal(r.status, 201);
    const id = r.body.id;
    assert.ok(
      publicUniverse(f.db)
        .discoveries.find((d) => d.id === a.id)
        .relatedIds.includes(b.id),
    );
    assert.equal(
      (
        await f.call("/api/admin/connections/" + id, "PUT", {
          explanation: "An edited meaning.",
        })
      ).status,
      200,
    );
    assert.ok(
      publicUniverse(f.db).connections.some(
        (c) => c.id === id && c.explanation === "An edited meaning.",
      ),
    );
    await f.call("/api/admin/discoveries/" + b.id, "PUT", {
      ...b,
      status: "archived",
    });
    assert.ok(
      !publicUniverse(f.db)
        .discoveries.find((d) => d.id === a.id)
        .relatedIds.includes(b.id),
    );
    assert.equal(
      (await f.call("/api/admin/connections/" + id, "DELETE", {})).status,
      200,
    );
    assert.ok(!f.db.prepare("SELECT 1 FROM connections WHERE id=?").get(id));
  } finally {
    await f.close();
  }
});
test("password changes revoke other sessions and bootstrap cannot overwrite an account", async () => {
  const f = await fixture();
  try {
    await f.login();
    const stored = f.db
      .prepare("SELECT password_hash FROM admins")
      .get().password_hash;
    assert.ok(!stored.includes(f.password));
    await assert.rejects(
      createInitialAdmin(f.db, "other@example.test", "a-long-test-password", {
        ADMIN_ALLOWED_EMAIL: "other@example.test",
      }),
    );
    assert.equal(
      (
        await f.call("/api/admin/password", "POST", {
          currentPassword: "incorrect",
          newPassword: "replacement-password",
        })
      ).status,
      400,
    );
    const r = await f.call("/api/admin/password", "POST", {
      currentPassword: f.password,
      newPassword: "replacement-password",
    });
    assert.equal(r.status, 200);
    assert.equal((await f.call("/api/admin/session")).status, 401);
    assert.equal(f.db.prepare("SELECT count(*) n FROM sessions").get().n, 1);
  } finally {
    await f.close();
  }
});
test("saved data and revisions survive a separate database connection without reseeding", async () => {
  const f = await fixture();
  try {
    await f.login();
    let d = (
      await f.call("/api/admin/discoveries", "POST", {
        ...discovery(),
        status: "published",
      })
    ).body.item;
    d = (
      await f.call("/api/admin/discoveries/" + d.id, "PUT", {
        ...d,
        title: { en: "Persisted replacement title", es: "" },
      })
    ).body.item;
    const second = openStore(f.file);
    assert.equal(
      publicUniverse(second).discoveries.find((x) => x.id === d.id).title.en,
      "Persisted replacement title",
    );
    assert.equal(
      second
        .prepare("SELECT count(*) n FROM revisions WHERE record_id=?")
        .get(d.id).n,
      1,
    );
    assert.equal(second.prepare("SELECT count(*) n FROM admins").get().n, 1);
    second.close();
  } finally {
    await f.close();
  }
});
test("production login requires HTTPS origin and emits a Secure host-only cookie", async () => {
  const f = await fixture({
    production: true,
    origin: "https://beyond.example",
  });
  try {
    const rejected = await f.call("/api/admin/login", "POST", {
      email: "owner@example.test",
      password: f.password,
    });
    assert.equal(rejected.status, 403);
    const r = await f.call(
      "/api/admin/login",
      "POST",
      { email: "owner@example.test", password: f.password },
      { Origin: "https://beyond.example" },
    );
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie"), /^__Host-beyond_admin=/);
    assert.match(r.headers.get("set-cookie"), /; Secure/);
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  } finally {
    await f.close();
  }
});
test("distribution server serves built SPA with protected admin routes and no source/database access", async () => {
  const f = await fixture();
  const { startServer } = await import("../index.mjs");
  const server = startServer({ db: f.db, port: 0, origin: "http://localhost" });
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type"), /text\/html/);
    const stone = await fetch(
      base + "/assets/hidden-worlds/mossy-rock-diff-1k.jpg",
    );
    assert.equal(stone.status, 200);
    assert.equal(stone.headers.get("content-type"), "image/jpeg");
    const bytes = new Uint8Array(await stone.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 2)), [255, 216]);
    assert.match(
      home.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    const privatePage = await fetch(base + "/admin/worlds", {
      redirect: "manual",
    });
    assert.equal(privatePage.status, 302);
    assert.equal((await fetch(base + "/.local/beyond.sqlite")).status, 404);
    assert.equal((await fetch(base + "/server/auth.mjs")).status, 404);
    assert.equal((await fetch(base + "/api/public/universe")).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await f.close();
  }
});
test("six destination migration is idempotent and preserves legacy identities without pretending content is verified", async () => {
  const f = await fixture();
  try {
    const hubs = publicUniverse(f.db).worlds.filter((w) => w.hubKey);
    assert.equal(hubs.length, 6);
    assert.equal(new Set(hubs.map((w) => w.id)).size, 6);
    assert.equal(new Set(hubs.map((w) => w.hubKey)).size, 6);
    assert.ok(hubs.every((w) => w.hubPosition.length === 3));
    assert.equal(
      f.db.prepare("SELECT count(*) n FROM schema_versions").get().n,
      2,
    );
    const second = openStore(f.file);
    assert.equal(
      publicUniverse(second).worlds.filter((w) => w.hubKey).length,
      6,
    );
    assert.equal(publicUniverse(second).discoveries.length, 8);
    assert.ok(
      publicUniverse(second).discoveries.every(
        (d) => d.verificationStatus === "needs_review",
      ),
    );
    second.close();
  } finally {
    await f.close();
  }
});
test("publication verification is an authorized editorial action and unsupported factual claims fail closed", async () => {
  const f = await fixture();
  try {
    const input = {
      ...discovery(),
      verificationStatus: "needs_review",
      status: "published",
      legacyPublished: true,
    };
    assert.equal(
      (
        await f.call("/api/admin/discoveries", "POST", {
          ...input,
          verificationStatus: "verified",
        })
      ).status,
      401,
    );
    await f.login();
    assert.equal(
      (await f.call("/api/admin/discoveries", "POST", input)).status,
      400,
    );
    assert.equal(
      (
        await f.call("/api/admin/discoveries", "POST", {
          ...input,
          verificationStatus: "rejected",
        })
      ).status,
      400,
    );
    const draft = (
      await f.call("/api/admin/discoveries", "POST", {
        ...input,
        status: "review",
      })
    ).body.item;
    assert.ok(!publicUniverse(f.db).discoveries.some((d) => d.id === draft.id));
    const approved = (
      await f.call("/api/admin/discoveries/" + draft.id, "PUT", {
        ...draft,
        status: "published",
        verificationStatus: "verified",
      })
    ).body.item;
    assert.equal(
      publicUniverse(f.db).discoveries.find((d) => d.id === approved.id)
        .verificationStatus,
      "verified",
    );
    const old = JSON.parse(
      f.db
        .prepare("SELECT data FROM discoveries WHERE id=?")
        .get("a-day-longer-than-a-year").data,
    );
    const legacy = (
      await f.call("/api/admin/discoveries/a-day-longer-than-a-year")
    ).body.item;
    const unpublish = (
      await f.call("/api/admin/discoveries/" + legacy.id, "PUT", {
        ...legacy,
        status: "draft",
      })
    ).body.item;
    assert.equal(
      (
        await f.call("/api/admin/discoveries/" + legacy.id, "PUT", {
          ...unpublish,
          status: "published",
        })
      ).status,
      400,
    );
    assert.ok(old.legacyPublished);
  } finally {
    await f.close();
  }
});
test("hypotheses and fictional scenarios remain explicitly labeled and rejected content stays private", async () => {
  const f = await fixture();
  try {
    await f.login();
    for (const truthType of ["hypothesis", "fictional"]) {
      assert.equal(
        (
          await f.call("/api/admin/discoveries", "POST", {
            ...discovery(),
            slug: truthType,
            truthType,
            verificationStatus: "hypothetical",
            status: "published",
          })
        ).status,
        400,
      );
      const r = await f.call("/api/admin/discoveries", "POST", {
        ...discovery(),
        slug: truthType,
        truthType,
        verificationStatus: "hypothetical",
        uncertainty:
          "This is a deliberately hypothetical test scenario, not established fact.",
        status: "published",
        sources: truthType === "fictional" ? [] : discovery().sources,
      });
      assert.equal(r.status, 201);
      const item = publicUniverse(f.db).discoveries.find(
        (d) => d.id === r.body.item.id,
      );
      assert.equal(item.truthType, truthType);
      assert.equal(item.fictionLabel, truthType === "fictional");
      await f.call("/api/admin/discoveries/" + r.body.item.id, "PUT", {
        ...r.body.item,
        status: "draft",
        verificationStatus: "rejected",
      });
      assert.ok(
        !publicUniverse(f.db).discoveries.some((d) => d.id === r.body.item.id),
      );
    }
  } finally {
    await f.close();
  }
});

test("hub discovery coordinates validate locally and persist into the public catalog", async () => {
  const f = await fixture();
  try {
    await f.login();
    const catalog = (await f.call("/api/admin/catalog")).body;
    const world = catalog.worlds.find((w) => w.hubKey === "what-if");
    assert.ok(world);
    const data = {
      ...discovery(),
      worldId: world.id,
      status: "published",
      position: [0, 1, 0],
    };
    for (const position of [
      [5, 1, 0],
      [0, -1, 0],
      [0, 7, 0],
      [0, 1, -5],
    ]) {
      assert.equal(
        (await f.call("/api/admin/discoveries", "POST", { ...data, position }))
          .status,
        400,
      );
    }
    const created = await f.call("/api/admin/discoveries", "POST", data);
    assert.equal(created.status, 201);
    const published = publicUniverse(f.db).discoveries.find(
      (d) => d.id === created.body.item.id,
    );
    assert.deepEqual(published.position, [0, 1, 0]);
    assert.equal(published.worldId, world.id);
  } finally {
    await f.close();
  }
});

test("single-email policy fails closed for absent, malformed and multiple-email configuration at bootstrap and every protected route", async () => {
  for (const value of [
    undefined,
    "",
    "not-an-email",
    "a@example.test,b@example.test",
    "a@example.test;other@example.test",
    "a@example.test\nother@example.test",
  ]) {
    const db = openStore(":memory:");
    try {
      await assert.rejects(
        createInitialAdmin(db, "owner@example.test", "isolated-test-password", {
          ADMIN_ALLOWED_EMAIL: value,
        }),
      );
      assert.equal(db.prepare("SELECT COUNT(*) n FROM admins").get().n, 0);
    } finally {
      db.close();
    }
  }
  const f = await fixture({ authEnv: {} });
  try {
    assert.equal(
      (
        await f.call("/api/admin/login", "POST", {
          email: "owner@example.test",
          password: f.password,
        })
      ).status,
      503,
    );
    for (const path of [
      "dashboard",
      "users",
      "characters",
      "system",
      "catalog",
      "worlds",
      "discoveries",
      "settings",
      "users/fake",
    ])
      assert.equal((await f.call("/api/admin/" + path)).status, 401, path);
    assert.equal(
      (
        await f.call("/api/admin/register", "POST", {
          email: "owner@example.test",
          password: f.password,
          role: "admin",
        })
      ).status,
      401,
    );
    assert.equal(
      (await f.call("/api/ai/assets/00000000-0000-0000-0000-000000000000"))
        .status,
      401,
    );
    assert.equal((await f.call("/api/ai/status")).body.authenticated, false);
    assert.equal((await f.call("/api/public/universe")).status, 200);
  } finally {
    await f.close();
  }
});
test("bootstrap permits only configured email and concurrent setup cannot create two administrators", async () => {
  const db = openStore(":memory:");
  const env = { ADMIN_ALLOWED_EMAIL: "OWNER@example.test" };
  try {
    await assert.rejects(
      createInitialAdmin(
        db,
        "other@example.test",
        "isolated-test-password",
        env,
      ),
    );
    const results = await Promise.allSettled([
      createInitialAdmin(
        db,
        "owner@example.test",
        "isolated-test-password",
        env,
      ),
      createInitialAdmin(
        db,
        "owner@example.test",
        "another-test-password",
        env,
      ),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM admins").get().n, 1);
  } finally {
    db.close();
  }
});
test("allowed email is rechecked on existing session, AI assets, direct writes and password operations; expiry remains enforced", async () => {
  const env = { ADMIN_ALLOWED_EMAIL: "owner@example.test" },
    f = await fixture({ authEnv: env });
  try {
    await f.login();
    assert.equal((await f.call("/api/admin/system")).status, 200);
    env.ADMIN_ALLOWED_EMAIL = "other@example.test";
    for (const path of [
      "session",
      "dashboard",
      "users",
      "characters",
      "system",
    ])
      assert.equal((await f.call("/api/admin/" + path)).status, 401);
    assert.equal(
      (await f.call("/api/admin/settings", "PUT", { defaultLanguage: "es" }))
        .status,
      401,
    );
    assert.equal(
      (
        await f.call("/api/admin/password", "POST", {
          currentPassword: f.password,
          newPassword: "new-fixture-password",
        })
      ).status,
      401,
    );
    assert.equal(
      (await f.call("/api/ai/assets/00000000-0000-0000-0000-000000000000"))
        .status,
      401,
    );
    assert.equal(
      (
        await f.call("/api/admin/login", "POST", {
          email: "owner@example.test",
          password: f.password,
        })
      ).status,
      401,
    );
    for (const invalid of [
      "",
      "not-an-email",
      "a@example.test,b@example.test",
    ]) {
      env.ADMIN_ALLOWED_EMAIL = invalid;
      assert.equal((await f.call("/api/admin/session")).status, 401);
      assert.equal(
        (
          await f.call("/api/admin/login", "POST", {
            email: "owner@example.test",
            password: f.password,
          })
        ).status,
        503,
      );
    }
    env.ADMIN_ALLOWED_EMAIL = "owner@example.test";
    await f.login();
    f.expire();
    assert.equal((await f.call("/api/admin/session")).status, 401);
    assert.equal(
      (
        await f.call("/api/admin/users", "GET", undefined, {
          Cookie: "beyond_admin=" + "a".repeat(43),
          "X-Admin-Email": "owner@example.test",
        })
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("inventory returns actual limited server data without hashes, session tokens or invented browser counts", async () => {
  const f = await fixture();
  try {
    await f.login();
    const users = await f.call("/api/admin/users");
    assert.equal(users.status, 200);
    assert.equal(users.body.total, 1);
    assert.equal(users.body.items[0].email, "owner@example.test");
    assert.equal(users.body.items[0].status, "allowed");
    const details = await f.call("/api/admin/users/" + users.body.items[0].id);
    assert.equal(details.body.item.activeSessions, 1);
    assert.equal(details.body.editable, false);
    assert.doesNotMatch(
      JSON.stringify(users.body),
      /password_hash|token_hash|csrf/,
    );
    assert.equal(
      (await f.call("/api/admin/users?search=nomatch")).body.total,
      0,
    );
    assert.equal(
      (await f.call("/api/admin/users?status=blocked")).body.total,
      0,
    );
    assert.equal((await f.call("/api/admin/users?page=-1")).status, 400);
    assert.equal((await f.call("/api/admin/users?status=bogus")).status, 400);
    assert.equal((await f.call("/api/admin/characters")).body.total, 0);
    assert.match(
      (await f.call("/api/admin/characters")).body.scope,
      /not centrally stored/,
    );
    assert.ok(
      !f.db
        .prepare("SELECT 1 FROM sqlite_master WHERE name='ai_character_assets'")
        .get(),
    );
    const status = (await f.call("/api/admin/system")).body;
    assert.equal(status.localCharacters, "Not centrally stored");
    assert.equal(status.administratorConfigured, true);
    assert.ok(!JSON.stringify(status).includes(f.password));
    const dash = (await f.call("/api/admin/dashboard")).body;
    assert.equal(dash.browserCharacters, null);
    assert.equal(dash.browserWorlds, null);
    // Authenticated fixture asset bytes, never a paid generation call.
    const id = "00000000-0000-0000-0000-000000000001",
      owner = users.body.items[0].id;
    f.db.exec(
      "CREATE TABLE ai_character_assets(id TEXT PRIMARY KEY,creator_id TEXT,mime TEXT,bytes BLOB,created_at INTEGER)",
    );
    f.db
      .prepare("INSERT INTO ai_character_assets VALUES(?,?,?,?,?)")
      .run(id, owner, "image/png", Buffer.from("fixture"), Date.now());
    const a = (await f.call("/api/admin/characters")).body;
    assert.equal(a.total, 1);
    assert.equal(a.items[0].bytes, 7);
    assert.equal(a.items[0].worldUsage, null);
    assert.equal(a.items[0].previewUrl, "/api/ai/assets/" + id);
    assert.ok(!JSON.stringify(a).includes("fixture"));
    assert.equal(
      (await f.call("/api/admin/characters?search=no-match")).body.total,
      0,
    );
    const insert = f.db.prepare(
      "INSERT INTO ai_character_assets VALUES(?,?,?,?,?)",
    );
    for (let i = 2; i <= 21; i++)
      insert.run(
        "fixture-asset-" + i,
        owner,
        "image/png",
        Buffer.from("fixture"),
        Date.now(),
      );
    const second = (await f.call("/api/admin/characters?page=2")).body;
    assert.equal(second.items.length, 10);
    assert.equal(second.total, 21);
    assert.equal(second.page, 2);
    const last = (await f.call("/api/admin/characters?page=999")).body;
    assert.equal(last.page, 3);
    assert.equal(last.items.length, 1);

    assert.equal(
      (
        await f.call(
          "/api/admin/settings",
          "PUT",
          { defaultLanguage: "es" },
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.call("/api/admin/users", "POST", { email: "new@example.test" }))
        .status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("unexpected additional database administrators fail closed without deleting accounts", async () => {
  const f = await fixture();
  try {
    await f.login();
    const a = f.db.prepare("SELECT * FROM admins").get();
    f.db
      .prepare("INSERT INTO admins VALUES(?,?,?,?)")
      .run(
        "extra-fixture",
        "other@example.test",
        a.password_hash,
        a.created_at,
      );
    assert.equal((await f.call("/api/admin/session")).status, 401);
    assert.equal(
      (
        await f.call("/api/admin/login", "POST", {
          email: "owner@example.test",
          password: f.password,
        })
      ).status,
      401,
    );
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM admins").get().n, 2);
  } finally {
    await f.close();
  }
});

test("empty administrator database reports setup required but HTTP cannot register or assign a password", async () => {
  const f = await fixture({ emptyAdmin: true });
  try {
    const state = await f.call("/api/admin/setup-status");
    assert.equal(state.status, 200);
    assert.deepEqual(state.body, {
      state: "initial_setup_required",
      method: "local_command",
    });
    assert.match(state.headers.get("cache-control"), /no-store/);
    assert.equal(
      (
        await f.call("/api/admin/login", "POST", {
          email: "owner@example.test",
          password: f.password,
        })
      ).status,
      409,
    );
    for (const path of ["setup-status", "register", "setup"])
      assert.equal(
        (
          await f.call("/api/admin/" + path, "POST", {
            email: "owner@example.test",
            password: f.password,
          })
        ).status,
        401,
      );
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM admins").get().n, 0);
    await createInitialAdmin(f.db, "owner@example.test", f.password, {
      ADMIN_ALLOWED_EMAIL: "owner@example.test",
    });
    assert.equal((await f.call("/api/admin/setup-status")).body.state, "ready");
    await f.login();
    assert.equal((await f.call("/api/admin/dashboard")).status, 200);
  } finally {
    await f.close();
  }
});

async function centralImage(format = "png") {
  const sharp = (await import("sharp")).default;
  const bytes = await sharp({
    create: {
      width: 32,
      height: 48,
      channels: 4,
      background: { r: 80, g: 175, b: 200, alpha: 0.8 },
    },
  })
    [format]()
    .toBuffer();
  return {
    bytes,
    payload: {
      name: "../../external." + format,
      data: bytes.toString("base64"),
    },
  };
}
const centralMeta = () => ({
  name: "Central guardian",
  description: "An externally authored fixture.",
  type: "world",
  tags: "fixture,guardian",
  source: "https://example.test/credit",
  active: true,
});
function centralGLB() {
  const data = Buffer.alloc(44);
  [-1, 0, 0, 1, 0, 0, 0, 2, 0].forEach((n, i) => data.writeFloatLE(n, i * 4));
  [0, 1, 2].forEach((n, i) => data.writeUInt16LE(n, 36 + i * 2));
  const g = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 2, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const j = Buffer.from(
    JSON.stringify(g) +
      " ".repeat((4 - (Buffer.byteLength(JSON.stringify(g)) % 4)) % 4),
  );
  const b = Buffer.alloc(28 + j.length + data.length);
  b.writeUInt32LE(0x46546c67, 0);
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(j.length, 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  j.copy(b, 20);
  b.writeUInt32LE(data.length, 20 + j.length);
  b.writeUInt32LE(0x004e4942, 24 + j.length);
  data.copy(b, 28 + j.length);
  return { bytes: b, json: g, data };
}
test("central image originals persist outside SQLite/public, remain public without admin login and admin writes enforce CSRF", async () => {
  const f = await fixture();
  try {
    const image = await centralImage();
    assert.equal(
      (
        await f.call("/api/admin/library/characters", "POST", {
          ...centralMeta(),
          file: image.payload,
        })
      ).status,
      401,
    );
    await f.login();
    assert.equal(
      (
        await f.call(
          "/api/admin/library/characters",
          "POST",
          { ...centralMeta(), file: image.payload },
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
      403,
    );
    const created = await f.call("/api/admin/library/characters", "POST", {
      ...centralMeta(),
      file: image.payload,
    });
    assert.equal(created.status, 201);
    const c = created.body.item;
    assert.equal(c.active, true);
    assert.equal(c.name, "Central guardian");
    assert.ok(!JSON.stringify(c).includes("file_key"));
    const row = f.db
      .prepare("SELECT * FROM central_characters WHERE id=?")
      .get(c.id);
    assert.ok(!row.file_key.includes(".."));
    assert.ok(!Object.keys(row).includes("data"));
    const { readFile } = await import("node:fs/promises");
    assert.ok(
      (await readFile(join(f.dir, "character-assets", row.file_key))).equals(
        image.bytes,
      ),
    );
    const publicList = await f.call(
      "/api/public/characters",
      "GET",
      undefined,
      { Cookie: "" },
    );
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.total, 1);
    assert.ok(!JSON.stringify(publicList.body).includes("creatorId"));
    assert.ok(
      Buffer.from(
        await (
          await fetch(f.base + publicList.body.items[0].fileUrl)
        ).arrayBuffer(),
      ).equals(image.bytes),
    );
    const thumb = await fetch(f.base + publicList.body.items[0].previewUrl);
    assert.equal(thumb.status, 200);
    assert.equal(thumb.headers.get("content-type"), "image/webp");
    assert.equal(
      (
        await f.call("/api/public/characters", "POST", centralMeta(), {
          Cookie: "",
        })
      ).status,
      405,
    );
    assert.equal(
      (
        await f.call(
          "/api/admin/library/characters/" + c.id,
          "PUT",
          { ...centralMeta(), version: 1, active: false },
          { Cookie: "" },
        )
      ).status,
      401,
    );
    const overview = await f.call("/api/admin/cosmic-overview");
    assert.equal(overview.body.totals.characters, 1);
    assert.equal(overview.body.distribution[0].count, 1);
    assert.equal(overview.body.activity[0].action, "Uploaded character");
    assert.equal((await f.call("/api/admin/activity")).body.total, 1);
  } finally {
    await f.close();
  }
});
test("central metadata/version update, deactivation and archival retain originals and prevent stale writes", async () => {
  const f = await fixture();
  try {
    await f.login();
    const image = await centralImage();
    const first = (
      await f.call("/api/admin/library/characters", "POST", {
        ...centralMeta(),
        file: image.payload,
      })
    ).body.item;
    const row = f.db
      .prepare("SELECT file_key FROM central_characters WHERE id=?")
      .get(first.id);
    const update = await f.call(
      "/api/admin/library/characters/" + first.id,
      "PUT",
      { ...centralMeta(), name: "Revised guardian", active: false, version: 1 },
    );
    assert.equal(update.status, 200);
    assert.equal(update.body.item.version, 2);
    assert.equal((await f.call("/api/public/characters")).body.total, 0);
    assert.equal(
      (await fetch(f.base + "/api/public/characters/" + first.id + "/file?v=1"))
        .status,
      404,
    );
    assert.equal(
      (
        await f.call("/api/admin/library/characters/" + first.id, "PUT", {
          ...centralMeta(),
          version: 1,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.call("/api/admin/library/characters/" + first.id, "DELETE", {
          version: 2,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.call("/api/admin/library/characters/" + first.id, "DELETE", {
          version: 2,
          confirm: "ARCHIVE",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.call("/api/admin/library/characters?status=archived")).body
        .total,
      1,
    );
    assert.equal(
      (await f.call("/api/public/characters/" + first.id)).status,
      404,
    );
    const { readFile } = await import("node:fs/promises");
    assert.ok(
      (await readFile(join(f.dir, "character-assets", row.file_key))).equals(
        image.bytes,
      ),
    );
  } finally {
    await f.close();
  }
});
test("central PNG/WebP/JPEG and GLB/embedded glTF validate actual resources; corrupted/dependent files are rejected without records", async () => {
  const f = await fixture();
  try {
    await f.login();
    for (const format of ["png", "webp", "jpeg"]) {
      const img = await centralImage(format);
      assert.equal(
        (
          await f.call("/api/admin/library/characters", "POST", {
            ...centralMeta(),
            file: img.payload,
          })
        ).status,
        201,
      );
    }
    const g = centralGLB();
    assert.equal(
      (
        await f.call("/api/admin/library/characters", "POST", {
          ...centralMeta(),
          file: { name: "guardian.glb", data: g.bytes.toString("base64") },
        })
      ).status,
      201,
    );
    const embedded = {
      ...g.json,
      buffers: [
        {
          byteLength: g.data.length,
          uri:
            "data:application/octet-stream;base64," + g.data.toString("base64"),
        },
      ],
    };
    assert.equal(
      (
        await f.call("/api/admin/library/characters", "POST", {
          ...centralMeta(),
          file: {
            name: "guardian.gltf",
            data: Buffer.from(JSON.stringify(embedded)).toString("base64"),
          },
        })
      ).status,
      201,
    );
    const bad = [
      {
        name: "fake.png",
        data: Buffer.from('<svg onload="alert(1)"></svg>').toString("base64"),
      },
      { name: "broken.glb", data: g.bytes.subarray(0, 20).toString("base64") },
      {
        name: "external.gltf",
        data: Buffer.from(
          JSON.stringify({
            ...g.json,
            buffers: [{ byteLength: 42, uri: "https://example.test/data.bin" }],
          }),
        ).toString("base64"),
      },
      { name: "bad.obj", data: Buffer.from("fixture").toString("base64") },
    ];
    const img = await centralImage();
    bad.push({
      name: "truncated.png",
      data: img.bytes.subarray(0, 40).toString("base64"),
    });
    for (const file of bad)
      assert.equal(
        (
          await f.call("/api/admin/library/characters", "POST", {
            ...centralMeta(),
            file,
          })
        ).status,
        400,
        file.name,
      );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM central_characters").get().n,
      5,
    );
    assert.equal(
      (
        await f.call("/api/admin/library/characters", "POST", {
          ...centralMeta(),
          file: {
            name: "large.png",
            data: Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64"),
          },
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await f.call("/api/admin/library/characters", "POST", {
          ...centralMeta(),
          source: "javascript:alert(1)",
          file: img.payload,
        })
      ).status,
      400,
    );
  } finally {
    await f.close();
  }
});

test("central registration failure after file write rolls back rows and cleans new originals", async () => {
  const f = await fixture();
  try {
    const { createCentralLibrary } = await import("../central-library.mjs");
    const root = join(f.dir, "rollback-assets");
    let checks = 0;
    const library = createCentralLibrary(f.db, {
      root,
      authorized: () => ++checks === 1,
    });
    const image = await centralImage();
    await assert.rejects(
      library.handle(
        "/api/admin/library/characters",
        "POST",
        new URLSearchParams(),
        { ...centralMeta(), file: image.payload },
        { admin_id: f.db.prepare("SELECT id FROM admins").get().id },
        {},
        () => {},
      ),
      (e) => e.status === 401,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM central_characters").get().n,
      0,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM central_activity").get().n,
      0,
    );
    const { readdir } = await import("node:fs/promises");
    assert.equal((await readdir(root, { recursive: true })).length, 0);
  } finally {
    await f.close();
  }
});

test("central storage refuses public directory configuration before writing files", async () => {
  const f = await fixture();
  try {
    const { createCentralLibrary } = await import("../central-library.mjs");
    const { resolve } = await import("node:path");
    const { existsSync } = await import("node:fs");
    const unsafe = resolve("public", "forbidden-central-fixture-" + Date.now());
    const library = createCentralLibrary(f.db, {
      root: unsafe,
      authorized: () => true,
    });
    const image = await centralImage();
    await assert.rejects(
      library.handle(
        "/api/admin/library/characters",
        "POST",
        new URLSearchParams(),
        { ...centralMeta(), file: image.payload },
        { admin_id: f.db.prepare("SELECT id FROM admins").get().id },
        {},
        () => {},
      ),
      (e) => e.status === 503,
    );
    assert.equal(existsSync(unsafe), false);
    assert.equal(library.exists(), false);
  } finally {
    await f.close();
  }
});

test("permanent world deletion removes only owned discoveries and touching edges; auth, CSRF, versions and audit preserved", async () => {
  const f = await fixture();
  try {
    const path = "/api/admin/worlds/archive/permanent-delete",
      input = { version: 1, confirm: "DELETE PERMANENTLY" };
    assert.equal((await f.call(path, "POST", input)).status, 401);
    await f.login();
    assert.equal(
      (await f.call(path, "POST", input, { "X-CSRF-Token": "wrong" })).status,
      403,
    );
    assert.equal(
      (await f.call(path, "POST", { ...input, version: 999 })).status,
      409,
    );
    assert.equal((await f.call(path, "POST", { version: 1 })).status, 400);
    const owned = f.db
      .prepare("SELECT COUNT(*) n FROM discoveries WHERE world_id=?")
      .get("archive").n;
    const other = f.db
      .prepare("SELECT COUNT(*) n FROM discoveries WHERE world_id<>'archive'")
      .get().n;
    const beforeWorlds = f.db.prepare("SELECT COUNT(*) n FROM worlds").get().n;
    const result = await f.call(path, "POST", input);
    assert.equal(result.status, 200);
    assert.equal(result.body.deleted, true);
    assert.equal(result.body.removedDiscoveries, owned);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM worlds WHERE id='archive'").get().n,
      0,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM worlds").get().n,
      beforeWorlds - 1,
    );
    assert.equal(
      f.db
        .prepare("SELECT COUNT(*) n FROM discoveries WHERE world_id<>'archive'")
        .get().n,
      other,
    );
    assert.equal(f.db.prepare("PRAGMA foreign_key_check").all().length, 0);
    assert.equal(
      f.db
        .prepare(
          "SELECT COUNT(*) n FROM revisions WHERE kind='permanent_deletion'",
        )
        .get().n,
      1,
    );
    assert.equal((await f.call(path, "POST", input)).status, 404);
    assert.equal(
      (await f.call("/api/admin/fantasy-overview")).body.totals.worlds,
      beforeWorlds - 1,
    );
    assert.equal((await f.call("/api/public/universe")).status, 200);
  } finally {
    await f.close();
  }
});

test("permanent central deletion removes metadata and dedicated bytes, retains another record shared files and denies anonymous writes", async () => {
  const f = await fixture();
  try {
    await f.login();
    const image = await centralImage();
    const a = (
      await f.call("/api/admin/library/characters", "POST", {
        ...centralMeta(),
        file: image.payload,
      })
    ).body.item;
    const b = (
      await f.call("/api/admin/library/characters", "POST", {
        ...centralMeta(),
        name: "Unrelated guardian",
        file: image.payload,
      })
    ).body.item;
    const row = f.db
      .prepare("SELECT * FROM central_characters WHERE id=?")
      .get(a.id);
    const { existsSync } = await import("node:fs");
    const root = join(f.dir, "character-assets");
    assert.equal(existsSync(join(root, row.file_key)), true);
    // Another central record references the preview: original may be purged, shared preview must remain.
    f.db
      .prepare("UPDATE central_characters SET preview_key=? WHERE id=?")
      .run(row.preview_key, b.id);
    const path = "/api/admin/library/characters/" + a.id + "/permanent-delete",
      input = { version: 1, confirm: "DELETE PERMANENTLY" };
    assert.equal(
      (await f.call(path, "POST", input, { Cookie: "" })).status,
      401,
    );
    assert.equal(
      (await f.call(path, "POST", { ...input, version: 9 })).status,
      409,
    );
    const r = await f.call(path, "POST", input);
    assert.equal(r.status, 200);
    assert.equal(r.body.deleted, true);
    assert.equal(r.body.sharedFilesRetained, 1);
    assert.equal(existsSync(join(root, row.file_key)), false);
    assert.equal(existsSync(join(root, row.preview_key)), true);
    assert.equal(
      f.db.prepare("SELECT * FROM central_characters WHERE id=?").get(a.id),
      undefined,
    );
    assert.equal((await f.call("/api/public/characters/" + a.id)).status, 404);
    assert.equal(
      (await fetch(f.base + "/api/public/characters/" + b.id + "/preview"))
        .status,
      200,
    );
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM admins").get().n, 1);
  } finally {
    await f.close();
  }
});

test("deletion compensates failed database commit and supports retry after file purge failure", async () => {
  const f = await fixture();
  try {
    await f.login();
    const image = await centralImage();
    const a = (
      await f.call("/api/admin/library/characters", "POST", {
        ...centralMeta(),
        file: image.payload,
      })
    ).body.item;
    const row = f.db
      .prepare("SELECT * FROM central_characters WHERE id=?")
      .get(a.id);
    const { permanentDelete } = await import("../permanent-delete.mjs"),
      fs = await import("node:fs");
    const opts = {
      kind: "character",
      id: a.id,
      input: { version: 1, confirm: "DELETE PERMANENTLY" },
      session: { admin_id: row.creator_id },
      root: join(f.dir, "character-assets"),
      authorized: () => true,
    };
    f.db.exec(
      "CREATE TRIGGER block_delete BEFORE DELETE ON central_characters BEGIN SELECT RAISE(ABORT,'fixture database failure'); END",
    );
    assert.throws(() => permanentDelete(f.db, opts));
    assert.equal(fs.existsSync(join(opts.root, row.file_key)), true);
    assert.ok(
      f.db.prepare("SELECT * FROM central_characters WHERE id=?").get(a.id),
    );
    f.db.exec("DROP TRIGGER block_delete");
    assert.throws(
      () =>
        permanentDelete(f.db, {
          ...opts,
          files: {
            ...fs,
            rmSync() {
              throw Error("fixture storage failure");
            },
          },
        }),
      /cleanup is pending/,
    );
    assert.equal(
      f.db.prepare("SELECT * FROM central_characters WHERE id=?").get(a.id),
      undefined,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM permanent_deletion_jobs").get().n,
      1,
    );
    assert.equal(permanentDelete(f.db, opts).deleted, true);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM permanent_deletion_jobs").get().n,
      0,
    );
    assert.equal(fs.existsSync(join(opts.root, row.file_key)), false);
  } finally {
    await f.close();
  }
});

test("permanent deletion rejects unsafe stored paths and server content references; pre-commit crash journal can recover on retry", async () => {
  const f = await fixture();
  try {
    await f.login();
    const image = await centralImage();
    const a = (
      await f.call("/api/admin/library/characters", "POST", {
        ...centralMeta(),
        file: image.payload,
      })
    ).body.item;
    const row = f.db
      .prepare("SELECT * FROM central_characters WHERE id=?")
      .get(a.id);
    const path = "/api/admin/library/characters/" + a.id + "/permanent-delete",
      input = { version: 1, confirm: "DELETE PERMANENTLY" };
    f.db
      .prepare("UPDATE central_characters SET file_key=? WHERE id=?")
      .run("../../outside", a.id);
    assert.equal((await f.call(path, "POST", input)).status, 409);
    f.db
      .prepare("UPDATE central_characters SET file_key=? WHERE id=?")
      .run(row.file_key, a.id);
    const world = f.db.prepare("SELECT * FROM worlds WHERE id='archive'").get(),
      data = JSON.parse(world.data);
    f.db.prepare("UPDATE worlds SET data=? WHERE id=?").run(
      JSON.stringify({
        ...data,
        media: "/api/public/characters/" + a.id + "/file",
      }),
      "archive",
    );
    assert.equal((await f.call(path, "POST", input)).status, 409);
    f.db
      .prepare("UPDATE worlds SET data=? WHERE id=?")
      .run(world.data, "archive");
    const fs = await import("node:fs"),
      { randomUUID } = await import("node:crypto");
    const root = join(f.dir, "character-assets"),
      dir = join(root, ".deletions", randomUUID());
    fs.mkdirSync(dir, { recursive: true });
    const move = { from: join(root, row.file_key), to: join(dir, "0") };
    fs.writeFileSync(
      join(dir, "journal.json"),
      JSON.stringify({ kind: "character", id: a.id, moves: [move] }),
    );
    fs.renameSync(move.from, move.to);
    const result = await f.call(path, "POST", input);
    assert.equal(result.status, 200);
    assert.equal(result.body.deleted, true);
    assert.equal(fs.existsSync(dir), false);
    assert.equal(fs.existsSync(move.from), false);
    assert.equal(f.db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    await f.close();
  }
});

test("world deletion rolls back all dependent changes if final row deletion fails", async () => {
  const f = await fixture();
  try {
    await f.login();
    const before = {
      worlds: f.db.prepare("SELECT COUNT(*) n FROM worlds").get().n,
      discoveries: f.db.prepare("SELECT COUNT(*) n FROM discoveries").get().n,
      connections: f.db.prepare("SELECT COUNT(*) n FROM connections").get().n,
    };
    f.db.exec(
      "CREATE TRIGGER prevent_world_delete BEFORE DELETE ON worlds BEGIN SELECT RAISE(ABORT,'fixture failure'); END",
    );
    assert.equal(
      (
        await f.call("/api/admin/worlds/archive/permanent-delete", "POST", {
          version: 1,
          confirm: "DELETE PERMANENTLY",
        })
      ).status,
      500,
    );
    for (const [table, count] of Object.entries(before))
      assert.equal(
        f.db.prepare("SELECT COUNT(*) n FROM " + table).get().n,
        count,
      );
    assert.equal(f.db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    await f.close();
  }
});

test("unknown central permanent deletion is 404 even before storage has been initialized", async () => {
  const f = await fixture();
  try {
    await f.login();
    assert.equal(
      (
        await f.call(
          "/api/admin/library/characters/00000000-0000-0000-0000-000000000000/permanent-delete",
          "POST",
          { version: 1, confirm: "DELETE PERMANENTLY" },
        )
      ).status,
      404,
    );
    assert.equal(
      (await f.call("/api/admin/deletion-jobs")).body.items.length,
      0,
    );
  } finally {
    await f.close();
  }
});
