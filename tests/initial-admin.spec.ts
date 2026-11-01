import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
const base = "http://127.0.0.1:5192";
async function fixture(allowed = "owner@example.test", existing = false) {
  const dir = mkdtempSync(join(tmpdir(), "beyond-initial-ui-")),
    file = join(dir, "test.sqlite");
  if (existing) {
    const { openStore } = await import("../server/store.mjs");
    const { createInitialAdmin } = await import("../server/auth.mjs");
    const db = openStore(file);
    try {
      await createInitialAdmin(
        db,
        "owner@example.test",
        randomBytes(20).toString("hex"),
        { ADMIN_ALLOWED_EMAIL: "owner@example.test" },
      );
    } finally {
      db.close();
    }
  }
  const env = {
    ...process.env,
    BEYOND_DB_PATH: file,
    APP_ORIGIN: base,
    ADMIN_ALLOWED_EMAIL: allowed,
  };
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5192",
      "--strictPort",
    ],
    { cwd: process.cwd(), env, stdio: "ignore" },
  );

  const close = async () => {
    if (server.exitCode === null) {
      const exited = new Promise((r) => server.once("exit", r));
      server.kill("SIGTERM");
      await exited;
    }
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok)
          return { file, env, setup: (pw: string) => setup(env, pw), close };
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Isolated first-admin server failed to start.");
  } catch (e) {
    await close();
    throw e;
  }
}
function setup(
  env: NodeJS.ProcessEnv,
  password: string,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server/setup-admin.mjs"], {
      cwd: process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (output += b));
    child.on("error", reject);
    child.once("close", (code) => resolve({ code, output }));
    child.stdin.end(password + "\n" + password + "\n");
  });
}
test("empty DB shows first-password instructions; local setup enables real login and cannot enroll again", async ({
  page,
}) => {
  const f = await fixture();
  const password = randomBytes(20).toString("base64url");
  try {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/admin");
      await expect(
        page.getByRole("heading", {
          name: "Set your first administrator password",
        }),
      ).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
      await expect(page.locator("code")).toHaveText("npm run admin:setup");
      await expect(
        page.getByText(/You choose the first password/),
      ).toBeVisible();
      await expect(
        page.getByText(/Never paste passwords into chat/),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/beyond-first-admin-${width}.png`,
        fullPage: true,
      });
    }
    const blocked = await page.request.post(base + "/api/admin/register", {
      data: { email: "owner@example.test", password },
    });
    expect(blocked.status()).toBe(401);
    const result = await f.setup(password);
    expect(result.code).toBe(0);
    expect(result.output.includes(password)).toBe(false);
    expect(result.output.includes("scrypt$")).toBe(false);
    await page.getByRole("button", { name: "Check setup again" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible();
    await page.getByLabel("Email address").fill("owner@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    const again = await f.setup(randomBytes(20).toString("base64url"));
    expect(again.code).toBe(1);
    expect(again.output).toContain("already exists");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    expect(
      (await page.request.get(base + "/api/admin/dashboard")).status(),
    ).toBe(401);
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible();
    await page.getByText("Forgot your password?", { exact: true }).click();
    await expect(page.getByText(/Email reset is not configured/)).toBeVisible();
  } finally {
    await f.close();
  }
});
test("missing email configuration blocks registration and login and provides configuration guidance", async ({
  page,
}) => {
  const f = await fixture("");
  try {
    await page.goto(base + "/admin");
    await expect(
      page.getByRole("heading", {
        name: "Administrator email configuration required",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
    expect(
      (
        await page.request.post(base + "/api/admin/login", {
          headers: { Origin: base },
          data: {
            email: "owner@example.test",
            password: "not-a-real-password",
          },
        })
      ).status(),
    ).toBe(503);
    expect((await f.setup("not-a-real-password")).code).toBe(1);
  } finally {
    await f.close();
  }
});
test("preexisting administrator with config mismatch gets review guidance rather than a reset or signup", async ({
  page,
}) => {
  const f = await fixture("other@example.test", true);
  try {
    await page.goto(base + "/admin");
    await expect(
      page.getByRole("heading", {
        name: "Administrator configuration needs review",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Existing accounts were preserved/),
    ).toBeVisible();
    expect((await f.setup("not-a-real-password")).code).toBe(1);
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(f.file, { readOnly: true });
    try {
      expect(db.prepare("SELECT COUNT(*) n FROM admins").get().n).toBe(1);
    } finally {
      db.close();
    }
  } finally {
    await f.close();
  }
});
