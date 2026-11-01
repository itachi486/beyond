import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PassThrough } from "node:stream";
import { openStore } from "../store.mjs";
import { verifyPassword, createInitialAdmin } from "../auth.mjs";
import { initialAdminState } from "../admin-setup-state.mjs";
import { readSetupPasswords } from "../setup-password.mjs";
const script = resolve("server/setup-admin.mjs");
function temp() {
  const dir = mkdtempSync(join(tmpdir(), "beyond-first-admin-"));
  return {
    dir,
    file: join(dir, "fixture.sqlite"),
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}
function run(f, input, extraArg, allowed = "owner@example.test") {
  const env = {
    PATH: process.env.PATH,
    BEYOND_DB_PATH: f.file,
    ...(allowed === undefined ? {} : { ADMIN_ALLOWED_EMAIL: allowed }),
  };
  return spawnSync(
    process.execPath,
    [script, ...(extraArg === undefined ? [] : [extraArg])],
    { cwd: f.dir, input, env, encoding: "utf8", timeout: 10000 },
  );
}
test("one-time CLI accepts configured email without argument, confirms password, stores only scrypt and preserves existing worlds", async () => {
  const f = temp(),
    password = randomBytes(18).toString("base64url");
  let db = openStore(f.file);
  const before = db.prepare("SELECT id,data FROM worlds ORDER BY id").all();
  db.close();
  try {
    const result = run(f, password + "\n" + password + "\n");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Initial administrator created/);
    assert.ok(
      !result.stdout.includes(password) && !result.stderr.includes(password),
    );
    assert.ok(
      !result.stdout.includes("scrypt$") && !result.stderr.includes("scrypt$"),
    );
    db = openStore(f.file);
    const row = db.prepare("SELECT * FROM admins").get();
    assert.equal(row.email, "owner@example.test");
    assert.ok(row.password_hash !== password);
    assert.ok(await verifyPassword(password, row.password_hash));
    assert.deepEqual(
      db.prepare("SELECT id,data FROM worlds ORDER BY id").all(),
      before,
    );
    const original = row.password_hash;
    db.close();
    const again = run(f, "different-password\ndifferent-password\n");
    assert.equal(again.status, 1);
    assert.match(again.stderr, /already exists/);
    assert.doesNotMatch(again.stdout, /password.*hidden/);
    db = openStore(f.file);
    assert.ok(
      db.prepare("SELECT password_hash FROM admins").get().password_hash ===
        original,
    );
    assert.equal(db.prepare("SELECT COUNT(*) n FROM admins").get().n, 1);
    db.close();
  } finally {
    f.close();
  }
});
test("CLI refuses missing config, disallowed email, mismatch, short/oversized password and missing confirmation without enrollment", () => {
  const cases = [
    { allowed: "", input: "" },
    { allowed: "bad-email", input: "" },
    { arg: "other@example.test", input: "" },
    { input: "valid-fixture-password\ndifferent-fixture-password\n" },
    { input: "short\nshort\n" },
    { input: "a".repeat(257) + "\n" + "a".repeat(257) + "\n" },
    { input: "valid-fixture-password\n" },
  ];
  for (const c of cases) {
    const f = temp();
    try {
      const r = run(
        f,
        c.input,
        c.arg,
        c.allowed === undefined ? "owner@example.test" : c.allowed,
      );
      assert.equal(r.status, 1);
      if (existsSync(f.file)) {
        const db = openStore(f.file);
        assert.equal(db.prepare("SELECT COUNT(*) n FROM admins").get().n, 0);
        db.close();
      }
      assert.ok(
        !r.stdout.includes("valid-fixture-password") &&
          !r.stderr.includes("valid-fixture-password"),
      );
    } finally {
      f.close();
    }
  }
});
test("coarse setup state exposes no email or password; configured account mismatch never enables setup", async () => {
  const db = openStore(":memory:"),
    env = { ADMIN_ALLOWED_EMAIL: "owner@example.test" };
  try {
    assert.deepEqual(initialAdminState(db, {}), {
      state: "configuration_required",
      method: "local_command",
    });
    assert.equal(initialAdminState(db, env).state, "initial_setup_required");
    await createInitialAdmin(
      db,
      "owner@example.test",
      "fixture-password-long",
      env,
    );
    assert.equal(initialAdminState(db, env).state, "ready");
    const state = initialAdminState(db, {
      ADMIN_ALLOWED_EMAIL: "different@example.test",
    });
    assert.equal(state.state, "operator_review_required");
    assert.ok(!JSON.stringify(state).includes("@"));
  } finally {
    db.close();
  }
});
test("hidden TTY reader handles pasted confirmation, Unicode, CRLF and cancellation without echoing secrets", async () => {
  async function simulated(text) {
    const input = new PassThrough(),
      output = new PassThrough();
    input.isTTY = true;
    let raw = false;
    input.setRawMode = (value) => {
      raw = value;
    };
    let printed = "";
    output.on("data", (b) => (printed += b.toString()));
    const result = readSetupPasswords(input, output);
    setImmediate(() => input.write(text));
    return { result, output: () => printed, raw: () => raw };
  }
  const secret = "安全-fixture-password";
  const f = await simulated(secret + "\r\n" + secret + "\r\n");
  const values = await f.result;
  assert.ok(values[0] === secret && values[1] === secret);
  assert.ok(!f.output().includes(secret));
  assert.equal(f.raw(), false);
  const cancel = await simulated("\u0003");
  await assert.rejects(cancel.result, /cancelled/);
  assert.equal(cancel.raw(), false);
});
test("Node setup command loads configured .env.local email without storing the password in that file", () => {
  const f = temp(),
    password = randomBytes(18).toString("base64url");
  try {
    writeFileSync(
      join(f.dir, ".env.local"),
      "ADMIN_ALLOWED_EMAIL=owner@example.test\nBEYOND_DB_PATH=" + f.file + "\n",
      { mode: 0o600 },
    );
    const result = spawnSync(
      process.execPath,
      ["--env-file-if-exists=.env.local", script],
      {
        cwd: f.dir,
        input: password + "\n" + password + "\n",
        env: { PATH: process.env.PATH },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.equal(result.status, 0);
    assert.ok(!result.stdout.includes(password));
    const db = openStore(f.file);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM admins").get().n, 1);
    db.close();
  } finally {
    f.close();
  }
});
