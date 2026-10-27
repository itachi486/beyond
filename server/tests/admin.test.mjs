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
  await createInitialAdmin(db, "owner@example.test", password);
  let time = Date.now();
  const api = createAPI(db, {
    origin: "http://localhost",
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
      createInitialAdmin(f.db, "other@example.test", "a-long-test-password"),
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
