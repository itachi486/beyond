import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { openStore } from "../store.mjs";
import { createInitialAdmin, newSession, cookie } from "../auth.mjs";
import { createAPI } from "../api.mjs";
import {
  generateImage,
  imagePolicy,
  classifyImageError,
} from "../ai-images.mjs";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=";
const input = () => ({
  requestId: randomUUID(),
  name: "Fixture spirit",
  type: "custom",
  personality: "Calm",
  description: "A test purpose",
  appearancePrompt: "An original luminous guardian",
  abilities: "Memory",
});
async function fixture({
  configured = true,
  free = 3,
  premium = 20,
  transport = async () =>
    new Response(JSON.stringify({ data: [{ b64_json: png }] }), {
      headers: { "Content-Type": "application/json" },
    }),
  premiumOwner = false,
} = {}) {
  const db = openStore(":memory:");
  await createInitialAdmin(
    db,
    "fixture@example.test",
    randomBytes(20).toString("hex"),
    { ADMIN_ALLOWED_EMAIL: "fixture@example.test" },
  );
  const owner = db.prepare("SELECT id FROM admins").get().id,
    session = newSession(db, owner);
  let clock = Date.now();
  const env = configured
    ? {
        AI_IMAGE_API_KEY: "fixture-not-a-real-key",
        AI_IMAGE_MODEL: "fixture-model",
        AI_IMAGE_ENDPOINT: "http://127.0.0.1:9/images/generations",
        AI_IMAGE_FREE_DAILY_LIMIT: String(free),
        AI_IMAGE_PREMIUM_DAILY_LIMIT: String(premium),
        AI_IMAGE_PREMIUM_CREATOR_IDS: premiumOwner ? owner : "",
      }
    : {};
  const api = createAPI(db, {
    origin: "http://localhost",
    now: () => clock,
    aiEnv: env,
    authEnv: { ADMIN_ALLOWED_EMAIL: "fixture@example.test" },
    aiTransport: transport,
  });
  const server = createServer(
    (req, res) =>
      void api(req, res, () => {
        res.writeHead(404);
        res.end();
      }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  async function call(path, method = "GET", body, headers = {}) {
    const r = await fetch(base + path, {
      method,
      headers: {
        cookie: cookie(session.token, false),
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "X-CSRF-Token": session.csrf,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: r.headers.get("content-type")?.startsWith("image/")
        ? Buffer.from(await r.arrayBuffer())
        : await r.json(),
    };
  }
  return {
    db,
    call,
    env,
    owner,
    session,
    advance: (ms) => (clock += ms),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}
test("unconfigured service is explicit and unauthenticated generation is rejected", async () => {
  const f = await fixture({ configured: false });
  try {
    const s = await f.call("/api/ai/status", "GET", undefined, { cookie: "" });
    assert.equal(s.data.configured, false);
    assert.equal(s.data.authenticated, false);
    assert.equal(
      (await f.call("/api/ai/generations", "POST", input(), { cookie: "" }))
        .status,
      401,
    );
    assert.equal(
      (await f.call("/api/ai/generations", "POST", input())).status,
      503,
    );
    assert.equal(
      f.db
        .prepare("SELECT name FROM sqlite_master WHERE name='ai_generations'")
        .get(),
      undefined,
    );
  } finally {
    await f.close();
  }
});
test("real HTTP adapter flow with mocked provider reserves once, deduplicates and privately persists asset", async () => {
  let calls = 0;
  const f = await fixture({
    free: 1,
    transport: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 40));
      return new Response(JSON.stringify({ data: [{ b64_json: png }] }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  try {
    const request = input(),
      results = await Promise.all([
        f.call("/api/ai/generations", "POST", request),
        f.call("/api/ai/generations", "POST", request),
      ]);
    assert.equal(calls, 1);
    assert.ok(results.some((r) => r.status === 200));
    const again = await f.call("/api/ai/generations", "POST", request);
    assert.equal(again.status, 200);
    assert.equal(calls, 1);
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", {
          ...request,
          name: "Changed",
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.call("/api/ai/generations", "POST", input())).status,
      429,
    );
    const asset = await f.call(again.data.imageUrl);
    assert.deepEqual(asset.data, Buffer.from(png, "base64"));
    assert.equal(
      (await f.call(again.data.imageUrl, "GET", undefined, { cookie: "" }))
        .status,
      401,
    );
    const other = randomUUID();
    // Preserve private-asset ownership denial independently of single-admin enforcement.
    f.db
      .prepare("UPDATE ai_character_assets SET creator_id=? WHERE id=?")
      .run(other, again.data.assetId);
    assert.equal((await f.call(again.data.imageUrl)).status, 404);
    f.db
      .prepare("UPDATE ai_character_assets SET creator_id=? WHERE id=?")
      .run(f.db.prepare("SELECT id FROM admins").get().id, again.data.assetId);
    f.db
      .prepare(
        "INSERT INTO admins SELECT ?,?,password_hash,created_at FROM admins LIMIT 1",
      )
      .run(other, "other@example.test");
    const otherSession = newSession(f.db, other);
    assert.equal(
      (
        await f.call(again.data.imageUrl, "GET", undefined, {
          cookie: cookie(otherSession.token, false),
        })
      ).status,
      401, // Extra database admins are now denied by the single-email policy.
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM ai_generations").get().n,
      1,
    );
  } finally {
    await f.close();
  }
});
test("provider errors are sanitized, idempotent and do not consume successful-image quota", async () => {
  let fail = true,
    calls = 0;
  const f = await fixture({
    free: 1,
    transport: async () => {
      calls++;
      return fail
        ? new Response("secret-provider-message", { status: 500 })
        : new Response(JSON.stringify({ data: [{ b64_json: png }] }), {
            headers: { "Content-Type": "application/json" },
          });
    },
  });
  try {
    const request = input(),
      r = await f.call("/api/ai/generations", "POST", request);
    assert.equal(r.status, 502);
    assert.equal(r.data.error, "provider_server_error");
    assert.equal(JSON.stringify(r.data).includes("secret"), false);
    await f.call("/api/ai/generations", "POST", request);
    assert.equal(calls, 1);
    fail = false;
    assert.equal(
      (await f.call("/api/ai/generations", "POST", input())).status,
      200,
    );
    assert.equal(
      f.db
        .prepare("SELECT COUNT(*) n FROM ai_generations WHERE status='error'")
        .get().n,
      1,
    );
  } finally {
    await f.close();
  }
});
test("server tier configuration and UTC rollover enforce adjustable quotas", async () => {
  const f = await fixture({ free: 0, premium: 2, premiumOwner: true });
  try {
    const status = await f.call("/api/ai/status");
    assert.equal(status.data.usage.limit, 2);
    assert.equal(
      (await f.call("/api/ai/generations", "POST", input())).status,
      200,
    );
    assert.equal(
      (await f.call("/api/ai/generations", "POST", input())).status,
      200,
    );
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", {
          ...input(),
          tier: "premium",
          limit: 999,
        })
      ).status,
      429,
    );
    f.advance(86400000);
    const fresh = newSession(
      f.db,
      f.owner,
      8 * 60 * 60 * 1000,
      Date.now() + 86400000,
    );
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", input(), {
          cookie: cookie(fresh.token, false),
          "X-CSRF-Token": fresh.csrf,
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("origin, CSRF, bad input and client tier spoofing cannot invoke provider", async () => {
  let calls = 0;
  const f = await fixture({
    free: 0,
    transport: async () => {
      calls++;
      return new Response("{}");
    },
  });
  try {
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", input(), {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", input(), {
          "X-CSRF-Token": "wrong",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", {
          ...input(),
          appearancePrompt: "",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.call("/api/ai/generations", "POST", {
          ...input(),
          tier: "premium",
        })
      ).status,
      429,
    );
    assert.equal(calls, 0);
  } finally {
    await f.close();
  }
});
test("reference upload uses multipart edit endpoint; invalid PNG and invalid configuration fail safely", async () => {
  let seen;
  const policy = imagePolicy({
    AI_IMAGE_API_KEY: "fixture",
    AI_IMAGE_MODEL: "fixture",
    AI_IMAGE_ENDPOINT: "http://127.0.0.1/images/generations",
  });
  await generateImage(
    { ...input(), referenceImage: "data:image/png;base64," + png },
    policy,
    async (url, options) => {
      seen = { url, body: options.body };
      return new Response(JSON.stringify({ data: [{ b64_json: png }] }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  assert.ok(seen.url.endsWith("/images/edits"));
  assert.ok(seen.body instanceof FormData);
  assert.equal(
    (seen.body.get("image") || seen.body.get("image[]")).type,
    "image/png",
  );
  await assert.rejects(
    generateImage(
      input(),
      policy,
      async () =>
        new Response(
          JSON.stringify({ data: [{ b64_json: "bm90IGFuIGltYWdl" }] }),
        ),
    ),
    /invalid_image/,
  );
  assert.throws(() =>
    imagePolicy({ AI_IMAGE_ENDPOINT: "http://external.example" }),
  );
});

test("SDK errors distinguish authentication, billing, throttling, input, timeout, network and service failures", async () => {
  const { classifyImageError } = await import("../ai-images.mjs");
  const cases = [
    [{ status: 401 }, "provider_authentication_failed"],
    [{ status: 429, code: "insufficient_quota" }, "billing_required"],
    [{ status: 429 }, "provider_rate_limited"],
    [{ status: 400 }, "provider_invalid_request"],
    [{ status: 503 }, "provider_server_error"],
    [{ name: "APIConnectionTimeoutError" }, "generation_timeout"],
    [{ name: "APIConnectionError" }, "provider_network_error"],
  ];
  for (const [e, code] of cases) assert.equal(classifyImageError(e), code);
  let params;
  const bytes = await generateImage(
    input(),
    imagePolicy({ OPENAI_API_KEY: "fixture-only" }),
    fetch,
    {
      images: {
        generate: async (p) => {
          params = p;
          return { data: [{ b64_json: png }] };
        },
      },
    },
  );
  assert.equal(bytes.length, Buffer.from(png, "base64").length);
  assert.equal(params.model, "gpt-image-2.5-sunburst");
  assert.equal(params.background, "transparent");
});
