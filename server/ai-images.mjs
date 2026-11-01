import OpenAI, { toFile } from "openai";
import { randomUUID, createHash } from "node:crypto";
import { findSession } from "./auth.mjs";
const hash = (v) => createHash("sha256").update(v).digest("hex");
export function imagePolicy(env = process.env) {
  const integer = (name, fallback, max) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isInteger(n) || n < 0 || n > max)
      throw Error("Invalid image generation policy.");
    return n;
  };
  const endpoint =
    env.AI_IMAGE_ENDPOINT || "https://api.openai.com/v1/images/generations";
  const u = new URL(endpoint);
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    )
  )
    throw Error("Image endpoint must use HTTPS.");
  const editEndpoint =
    env.AI_IMAGE_EDIT_ENDPOINT || endpoint.replace(/\/generations$/, "/edits");
  const editURL = new URL(editEndpoint);
  if (
    editURL.protocol !== "https:" &&
    !(
      editURL.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(editURL.hostname)
    )
  )
    throw Error("Image edit endpoint must use HTTPS.");
  return {
    configured: !!(env.OPENAI_API_KEY?.trim() || env.AI_IMAGE_API_KEY?.trim()),
    key: env.OPENAI_API_KEY?.trim() || env.AI_IMAGE_API_KEY?.trim(),
    endpoint,
    model: env.AI_IMAGE_MODEL || "gpt-image-2.5-sunburst",
    editEndpoint:
      env.AI_IMAGE_EDIT_ENDPOINT ||
      endpoint.replace(/\/generations$/, "/edits"),
    free: integer("AI_IMAGE_FREE_DAILY_LIMIT", 3, 100),
    premium: integer("AI_IMAGE_PREMIUM_DAILY_LIMIT", 20, 1000),
    maxAttempts: integer("AI_IMAGE_DAILY_ATTEMPT_LIMIT", 60, 2000),
    premiumIds: new Set(
      (env.AI_IMAGE_PREMIUM_CREATOR_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    timeout: 120000,
  };
}
export function classifyImageError(e) {
  if (["invalid_image", "invalid_reference"].includes(e?.message))
    return e.message;
  if (e?.status === 401) return "provider_authentication_failed";
  if (
    [
      "insufficient_quota",
      "billing_hard_limit_reached",
      "billing_not_active",
    ].includes(e?.code) ||
    e?.status === 402
  )
    return "billing_required";
  if (
    [
      "model_not_found",
      "model_not_supported",
      "permission_denied",
      "organization_verification_required",
    ].includes(e?.code)
  )
    return "provider_access_denied";
  if (e?.status === 429) return "provider_rate_limited";
  if (e?.status === 400 || e?.status === 422) return "provider_invalid_request";
  if (e?.status === 403 || e?.status === 404) return "provider_access_denied";
  if (e?.status >= 500) return "provider_server_error";
  if (
    ["APIConnectionTimeoutError", "TimeoutError", "AbortError"].includes(
      e?.name,
    )
  )
    return "generation_timeout";
  if (e?.name === "APIConnectionError") return "provider_network_error";
  return "generation_failed";
}
export async function generateImage(
  input,
  policy,
  transport = fetch,
  providedClient,
) {
  const prompt = [
    "Create one original premium fantasy character, full-body isolated silhouette, expressive face, rich layered materials and cinematic light. No text, logos or character sheet. Transparent background; do not copy existing characters.",
    `Name: ${input.name}`,
    `Spirit type: ${input.type}`,
    `Personality: ${input.personality}`,
    `Story and purpose: ${input.description}`,
    `Appearance: ${input.appearancePrompt}`,
    `Abilities: ${input.abilities}`,
  ].join("\n");
  const client =
    providedClient ||
    new OpenAI({
      apiKey: policy.key,
      baseURL: policy.endpoint.replace(/\/images\/generations\/?$/, ""),
      fetch: transport,
      maxRetries: 0,
      timeout: policy.timeout,
      logLevel: "off",
    });
  const parameters = {
    model: policy.model,
    prompt,
    n: 1,
    size: "1024x1024",
    output_format: "png",
    background: "transparent",
  };
  let result;
  try {
    if (input.referenceImage) {
      const match =
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          input.referenceImage,
        );
      if (!match) throw Error("invalid_reference");
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length > 512 * 1024) throw Error("invalid_reference");
      const image = await toFile(bytes, `reference.${match[1]}`, {
        type: `image/${match[1]}`,
      });
      result = await client.images.edit(
        { ...parameters, image },
        { signal: AbortSignal.timeout(policy.timeout) },
      );
    } else
      result = await client.images.generate(parameters, {
        signal: AbortSignal.timeout(policy.timeout),
      });
  } catch (e) {
    throw Error(classifyImageError(e));
  }
  const b64 = result.data?.[0]?.b64_json;
  if (
    typeof b64 !== "string" ||
    b64.length > 12 * 1024 * 1024 ||
    !/^[A-Za-z0-9+/=]+$/.test(b64)
  )
    throw Error("invalid_image");
  const bytes = Buffer.from(b64, "base64");
  if (
    bytes.length < 24 ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.readUInt32BE(16) > 2048 ||
    bytes.readUInt32BE(20) > 2048
  )
    throw Error("invalid_image");
  return bytes;
}
export function createImageAPI(
  db,
  {
    origin,
    production = false,
    now = Date.now,
    env = process.env,
    authEnv = process.env,
    transport = fetch,
  } = {},
) {
  let policy, configurationIssue;
  try {
    policy = imagePolicy(env);
    configurationIssue = policy.configured ? null : "missing_api_key";
  } catch {
    policy = { ...imagePolicy({}), configured: false };
    configurationIssue = "invalid_configuration";
  }
  const expected = new URL(origin).origin;
  function tables() {
    db.exec(
      `CREATE TABLE IF NOT EXISTS ai_generations(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL,request_hash TEXT NOT NULL,day TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','success','error')),asset_id TEXT,error_code TEXT,created_at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS ai_generation_quota ON ai_generations(creator_id,day,status);CREATE TABLE IF NOT EXISTS ai_character_assets(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,created_at INTEGER NOT NULL);`,
    );
  }
  function send(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  }
  const day = () => new Date(now()).toISOString().slice(0, 10);
  function quota(id) {
    const used = db
      .prepare(
        "SELECT COUNT(*) n FROM ai_generations WHERE creator_id=? AND day=? AND status IN ('success','pending')",
      )
      .get(id, day()).n;
    return {
      used,
      limit: policy.premiumIds.has(id) ? policy.premium : policy.free,
      tier: policy.premiumIds.has(id) ? "premium" : "free",
      resetAt: Date.parse(day()) + 86400000,
    };
  }
  function result(res, row) {
    if (row.status === "pending")
      send(res, 202, { status: "pending", requestId: row.id });
    else if (row.status === "error")
      send(res, 502, { error: row.error_code, requestId: row.id });
    else
      send(res, 200, {
        status: "success",
        requestId: row.id,
        assetId: row.asset_id,
        imageUrl: "/api/ai/assets/" + row.asset_id,
        creatorId: row.creator_id,
      });
  }
  return async (req, res) => {
    const path = new URL(req.url, "http://local").pathname;
    if (!path.startsWith("/api/ai/")) return false;
    try {
      const session = findSession(db, req, production, now(), authEnv);
      if (path === "/api/ai/status" && req.method === "GET") {
        let usage = null;
        if (policy.configured && session) {
          tables();
          usage = quota(session.admin_id);
        }
        send(res, 200, {
          configured: policy.configured,
          configurationIssue,
          authenticated: !!session,
          csrf: session?.csrf,
          creatorId: session?.admin_id,
          usage,
          requiresExistingSession: true,
        });
        return true;
      }
      if (!session) {
        send(res, 401, { error: "sign_in_required" });
        return true;
      }
      if (path.startsWith("/api/ai/assets/") && req.method === "GET") {
        tables();
        const asset = db
          .prepare(
            "SELECT * FROM ai_character_assets WHERE id=? AND creator_id=?",
          )
          .get(path.slice(15), session.admin_id);
        if (!asset) {
          send(res, 404, { error: "asset_not_found" });
          return true;
        }
        res.writeHead(200, {
          "Content-Type": asset.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(asset.bytes);
        return true;
      }
      if (path !== "/api/ai/generations" || req.method !== "POST") {
        send(res, 404, { error: "not_found" });
        return true;
      }
      if (
        req.headers.origin !== expected ||
        req.headers["x-csrf-token"] !== session.csrf
      ) {
        send(res, 403, { error: "request_verification_failed" });
        return true;
      }
      if (
        !String(req.headers["content-type"] || "").startsWith(
          "application/json",
        )
      ) {
        send(res, 415, { error: "use_json" });
        return true;
      }
      if (!policy.configured) {
        send(res, 503, { error: "image_service_not_configured" });
        return true;
      }
      let size = 0,
        chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 800 * 1024) {
          send(res, 413, { error: "request_too_large" });
          return true;
        }
        chunks.push(chunk);
      }
      let input;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        send(res, 400, { error: "invalid_input" });
        return true;
      }
      const fields = {
        name: 100,
        type: 30,
        personality: 2000,
        description: 2000,
        appearancePrompt: 3000,
        abilities: 2000,
      };
      if (
        !input ||
        typeof input !== "object" ||
        !/^[-a-zA-Z0-9_]{16,80}$/.test(input.requestId || "") ||
        Object.entries(fields).some(
          ([key, max]) =>
            typeof input[key] !== "string" || input[key].length > max,
        ) ||
        !input.name.trim() ||
        !input.appearancePrompt.trim() ||
        !["world", "collector", "creator", "portal", "custom"].includes(
          input.type,
        ) ||
        (input.referenceImage !== undefined &&
          (typeof input.referenceImage !== "string" ||
            !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
              input.referenceImage,
            ) ||
            input.referenceImage.length > 710000))
      ) {
        send(res, 400, { error: "invalid_input" });
        return true;
      }
      if (!findSession(db, req, production, now(), authEnv)) {
        send(res, 401, { error: "sign_in_required" });
        return true;
      }
      tables();
      db.prepare(
        "UPDATE ai_generations SET status='error',error_code='interrupted' WHERE status='pending' AND created_at<?",
      ).run(now() - policy.timeout - 30000);
      const digest = hash(
        JSON.stringify(
          Object.fromEntries(
            [...Object.keys(fields), "referenceImage"].map((k) => [
              k,
              input[k] || "",
            ]),
          ),
        ),
      );
      let existing, limit;
      db.exec("BEGIN IMMEDIATE");
      try {
        existing = db
          .prepare("SELECT * FROM ai_generations WHERE id=?")
          .get(input.requestId);
        if (existing) {
          db.exec("COMMIT");
          if (
            existing.creator_id !== session.admin_id ||
            existing.request_hash !== digest
          ) {
            send(res, 409, { error: "request_conflict" });
            return true;
          }
          result(res, existing);
          return true;
        }
        limit = quota(session.admin_id);
        const attempts = db
          .prepare(
            "SELECT COUNT(*) n FROM ai_generations WHERE creator_id=? AND day=?",
          )
          .get(session.admin_id, day()).n;
        if (limit.used >= limit.limit || attempts >= policy.maxAttempts) {
          db.exec("COMMIT");
          send(res, 429, { error: "daily_limit_reached", usage: limit });
          return true;
        }
        db.prepare(
          "INSERT INTO ai_generations(id,creator_id,request_hash,day,status,created_at) VALUES(?,?,?,?,?,?)",
        ).run(
          input.requestId,
          session.admin_id,
          digest,
          day(),
          "pending",
          now(),
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      try {
        const bytes = await generateImage(input, policy, transport),
          asset = randomUUID();
        db.exec("BEGIN IMMEDIATE");
        try {
          db.prepare("INSERT INTO ai_character_assets VALUES(?,?,?,?,?)").run(
            asset,
            session.admin_id,
            "image/png",
            bytes,
            now(),
          );
          db.prepare(
            "UPDATE ai_generations SET status='success',asset_id=? WHERE id=?",
          ).run(asset, input.requestId);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        result(
          res,
          db
            .prepare("SELECT * FROM ai_generations WHERE id=?")
            .get(input.requestId),
        );
      } catch (e) {
        const code = [
          "invalid_image",
          "invalid_reference",
          "provider_authentication_failed",
          "billing_required",
          "provider_rate_limited",
          "provider_invalid_request",
          "provider_access_denied",
          "provider_server_error",
          "generation_timeout",
          "provider_network_error",
          "generation_failed",
        ].includes(e.message)
          ? e.message
          : "generation_failed";
        db.prepare(
          "UPDATE ai_generations SET status='error',error_code=? WHERE id=?",
        ).run(code, input.requestId);
        send(res, 502, { error: code, requestId: input.requestId });
      }
    } catch {
      if (!res.headersSent) send(res, 500, { error: "image_service_error" });
      else res.end();
    }
    return true;
  };
}
