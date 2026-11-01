import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
import {
  imagePolicy,
  classifyImageError,
  generateImage,
} from "../ai-images.mjs";
test("empty .env.local cannot configure a key; valid local assignment loads server-side in Vite and Node", () => {
  const dir = mkdtempSync(join(tmpdir(), "beyond-env-fixture-")),
    previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const local = join(dir, ".env.local");
    writeFileSync(local, " \n");
    assert.equal(
      Boolean(loadEnv("development", dir, ["OPENAI_API_KEY"]).OPENAI_API_KEY),
      false,
    );
    writeFileSync(local, "OPENAI_API_KEY=nonsecret_fixture_value\n");
    assert.equal(
      Boolean(loadEnv("development", dir, ["OPENAI_API_KEY"]).OPENAI_API_KEY),
      true,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--env-file=" + local,
        "-e",
        "process.stdout.write(JSON.stringify({present:Boolean(process.env.OPENAI_API_KEY)}))",
      ],
      { cwd: dir, env: { PATH: process.env.PATH }, encoding: "utf8" },
    );
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), { present: true });
    assert.equal(
      imagePolicy(loadEnv("development", dir, ["OPENAI_API_KEY"])).configured,
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
test("current SDK request uses documented image parameters; model permissions differ from invalid input", async () => {
  assert.equal(
    classifyImageError({ status: 400, code: "model_not_found" }),
    "provider_access_denied",
  );
  assert.equal(classifyImageError({ status: 403 }), "provider_access_denied");
  assert.equal(classifyImageError({ status: 400 }), "provider_invalid_request");
  assert.equal(
    classifyImageError({ status: 401 }),
    "provider_authentication_failed",
  );
  assert.equal(
    classifyImageError({ status: 429, code: "insufficient_quota" }),
    "billing_required",
  );
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=";
  let parameters;
  await generateImage(
    {
      name: "Fixture",
      type: "custom",
      personality: "",
      description: "",
      appearancePrompt: "Original guardian",
      abilities: "",
    },
    imagePolicy({ OPENAI_API_KEY: "nonsecret_fixture_value" }),
    fetch,
    {
      images: {
        generate: async (p) => {
          parameters = p;
          return { data: [{ b64_json: png }] };
        },
      },
    },
  );
  assert.equal(parameters.model, "gpt-image-2.5-sunburst");
  assert.equal(parameters.size, "1024x1024");
  assert.equal(parameters.background, "transparent");
  assert.equal(parameters.output_format, "png");
  assert.equal(parameters.n, 1);
  assert.equal(Object.hasOwn(parameters, "response_format"), false);
});

test("administrator allowlist loads privately from local env in Vite and Node; no client variable is introduced", async () => {
  const { adminAllowedEmail } = await import("../auth.mjs");
  const dir = mkdtempSync(join(tmpdir(), "beyond-admin-env-"));
  const previous = process.env.ADMIN_ALLOWED_EMAIL;
  delete process.env.ADMIN_ALLOWED_EMAIL;
  try {
    writeFileSync(
      join(dir, ".env.local"),
      "ADMIN_ALLOWED_EMAIL=editor@example.test\n",
    );
    const env = loadEnv("development", dir, ["ADMIN_ALLOWED_EMAIL"]);
    assert.equal(adminAllowedEmail(env), "editor@example.test");
    assert.ok(
      !Object.keys(loadEnv("development", dir, "VITE_")).includes(
        "VITE_ADMIN_ALLOWED_EMAIL",
      ),
    );
    const result = spawnSync(
      process.execPath,
      [
        "--env-file-if-exists=.env",
        "--env-file-if-exists=.env.local",
        "-e",
        "process.stdout.write(JSON.stringify({configured:Boolean(process.env.ADMIN_ALLOWED_EMAIL)}))",
      ],
      { cwd: dir, env: { PATH: process.env.PATH }, encoding: "utf8" },
    );
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), { configured: true });
  } finally {
    if (previous === undefined) delete process.env.ADMIN_ALLOWED_EMAIL;
    else process.env.ADMIN_ALLOWED_EMAIL = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
