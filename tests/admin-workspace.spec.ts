import { test, expect, type Browser } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
let child: ChildProcess;
let temp: string;
let password: string;
const base = "http://localhost:5191";
test.beforeAll(async () => {
  temp = mkdtempSync(join(tmpdir(), "beyond-admin-e2e-"));
  password = randomBytes(18).toString("base64url");
  const { bootstrapTestDatabase } =
    await import("../server/test-bootstrap.mjs");
  await bootstrapTestDatabase(join(temp, "test.sqlite"), password);
  child = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5191",
      "--strictPort",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BEYOND_DB_PATH: join(temp, "test.sqlite"),
        APP_ORIGIN: base,
      },
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Isolated test server did not start.");
});
test.beforeEach(async () => {
  const { openStore } = await import("../server/store.mjs");
  const db = openStore(join(temp, "test.sqlite"));
  db.prepare("DELETE FROM login_limits").run();
  db.close();
});
test.afterAll(async () => {
  if (child && !child.killed) {
    const done = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await done;
  }
  if (temp) rmSync(temp, { recursive: true, force: true });
});
async function login(page: import("@playwright/test").Page) {
  await page.goto(base + "/admin/login");
  await page.getByLabel("Email address").fill("editor@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(base + "/admin");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
for (const width of [375, 768, 1440])
  test(`private admin login and overview at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/admin");
    await expect(page).toHaveURL(base + "/admin/login");
    await login(page);
    await expect(
      page.getByText("Published discoveries", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Worlds", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(base + "/admin/login");
    expect(errors).toEqual([]);
  });
test("actual UI saves a draft, previews safely, publishes into exploration and archives without losing history", async ({
  page,
  browser,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Create discovery", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create discovery", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Title (English)", { exact: true })
    .fill("Isolated browser discovery");
  await page
    .getByLabel("Contextual hint (English)", { exact: true })
    .fill("An isolated UI test, not scientific evidence.");
  await page
    .getByLabel("Main content (English)", { exact: true })
    .fill("Test-only editorial body. <script>window.bad=true</script>");
  await page.getByLabel("Slug", { exact: true }).fill("browser-discovery");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/discoveries\/[a-z0-9-]+/);
  const id = page.url().split("/").pop();
  await expect(
    page.getByRole("heading", { name: "Edit discovery" }),
  ).toBeVisible();
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto(base + "/discoveries/browser-discovery");
  await expect(
    publicPage.getByRole("heading", {
      name: "This path has not been charted.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "<script>window.bad=true</script>",
  );
  expect(await page.evaluate(() => (window as any).bad)).toBeUndefined();
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("button", { name: "Add source", exact: true }).click();
  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://science.nasa.gov/dark-matter/");
  await page
    .getByLabel("Source description", { exact: true })
    .fill(
      "NASA reference entered for isolated testing; no automatic verification.",
    );
  await page.getByLabel("Content verification").selectOption("verified");
  await page.getByLabel("Publication state").selectOption("published");
  await page.getByLabel("X", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Changes saved.");
  await publicPage.reload();
  await publicPage
    .getByRole("button", { name: "Start exploring", exact: true })
    .click();
  await expect(
    publicPage.getByRole("heading", {
      name: "Isolated browser discovery",
      exact: true,
    }),
  ).toBeVisible();
  expect(await publicPage.evaluate(() => (window as any).bad)).toBeUndefined();
  await page.getByLabel("Publication state").selectOption("archived");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(/Revision \d/).first()).toBeVisible();
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", {
      name: "This path has not been charted.",
    }),
  ).toBeVisible();
  await page.getByLabel("Publication state").selectOption("draft");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Changes saved.");
  await visitor.close();
});
test("API guards, connection operations and raw data paths are protected", async ({
  page,
  request,
}) => {
  expect((await request.get(base + "/api/admin/dashboard")).status()).toBe(401);
  expect(
    (await request.post(base + "/api/admin/worlds", { data: {} })).status(),
  ).toBe(401);
  for (const path of [
    "/.local/beyond.sqlite",
    "/%2elocal/beyond.sqlite",
    "/server/seed.json",
    "/server/auth.mjs?raw",
  ])
    expect((await request.get(base + path)).status()).toBe(404);
  await login(page);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page
    .getByLabel("From discovery")
    .selectOption("a-day-longer-than-a-year");
  await page.getByLabel("To discovery").selectOption("cities-inside-stone");
  await page
    .getByLabel("Why are these discoveries related?")
    .fill("An isolated editorial comparison; no causal claim.");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Connection saved.");
  const row = page
    .locator(".admin-link")
    .filter({ hasText: "An isolated editorial comparison; no causal claim." });
  await row.getByRole("button", { name: "Edit explanation" }).click();
  await page
    .getByLabel("Why are these discoveries related?")
    .fill("Updated isolated comparison.");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(
    page
      .locator(".admin-link")
      .filter({ hasText: "Updated isolated comparison." }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".admin-link")
    .filter({ hasText: "Updated isolated comparison." })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(
    page
      .locator(".admin-link")
      .filter({ hasText: "Updated isolated comparison." }),
  ).toHaveCount(0);
});
test("world editor publishes, archives and restores a separate world through persisted data", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page.getByRole("button", { name: "Create world", exact: true }).click();
  await page
    .getByLabel("Name (English)", { exact: true })
    .fill("Isolated Browser World");
  await page
    .getByLabel("Description (English)", { exact: true })
    .fill("A disposable test environment.");
  await page.getByLabel("Slug", { exact: true }).fill("browser-world");
  await page.getByLabel("Presentation theme").selectOption("natural");
  await page.getByLabel("Publication state").selectOption("published");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit world", exact: true }),
  ).toBeVisible();
  const id = page.url().split("/").pop();
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto(base + "/worlds/" + id);
  await publicPage
    .getByRole("button", { name: "Start exploring", exact: true })
    .click();
  await expect(
    publicPage.getByRole("heading", {
      name: "Isolated Browser World",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Publication state").selectOption("archived");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Changes saved.");
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", {
      name: "This path has not been charted.",
    }),
  ).toBeVisible();
  await page.getByLabel("Publication state").selectOption("published");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Changes saved.");
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", {
      name: "Isolated Browser World",
      exact: true,
    }),
  ).toBeVisible();
  await visitor.close();
});
test("settings and password change remain connected to the current secure session", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Default language for new visitors").selectOption("es");
  await page
    .getByRole("button", { name: "Save defaults", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Application defaults saved.");
  await page.reload();
  await expect(
    page.getByLabel("Default language for new visitors"),
  ).toHaveValue("es");
  await page.getByLabel("Default language for new visitors").selectOption("en");
  await page
    .getByRole("button", { name: "Save defaults", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Application defaults saved.");
  const next = randomBytes(18).toString("base64url");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password", { exact: true }).fill(next);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Password changed.");
  password = next;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page);
});
test("authorized verification and publication feed the six-world hub through the same database", async ({
  page,
  browser,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Create discovery", exact: true })
    .click();
  await page
    .getByLabel("Title (English)", { exact: true })
    .fill("Isolated hub discovery");
  await page
    .getByLabel("Contextual hint (English)", { exact: true })
    .fill("A disposable hub integration test.");
  await page
    .getByLabel("Main content (English)", { exact: true })
    .fill("Isolated editorial fixture. Not a real scientific claim.");
  await page.getByLabel("Slug", { exact: true }).fill("isolated-hub-discovery");
  await page.getByLabel("World", { exact: true }).selectOption("realm-what-if");
  await page.getByRole("button", { name: "Add source", exact: true }).click();
  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://science.nasa.gov/dark-matter/");
  await page
    .getByLabel("Source description", { exact: true })
    .fill("Reference entered only in an isolated test.");
  await page.getByLabel("Publication state").selectOption("published");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("verify factual content");
  await page.getByLabel("Content verification").selectOption("verified");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit discovery", exact: true }),
  ).toBeVisible();
  const c = await browser.newContext({ reducedMotion: "reduce" });
  const visitor = await c.newPage();
  await visitor.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await visitor.goto(base + "/explore?world=realm-what-if");
  await visitor
    .getByRole("button", { name: "Open discoveries", exact: false })
    .click();
  await visitor.getByRole("button", { name: /Isolated hub discovery/ }).click();
  await expect(
    visitor.getByRole("heading", {
      name: "Isolated hub discovery",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    visitor.getByText("Factual content · Editor reviewed"),
  ).toBeVisible();
  await visitor.evaluate(() => {
    (window as any).__hubCanvas = document.querySelector(".hub-canvas canvas");
  });
  await visitor.getByRole("button", { name: "Close", exact: true }).click();
  expect(
    await visitor.evaluate(
      () =>
        (window as any).__hubCanvas ===
        document.querySelector(".hub-canvas canvas"),
    ),
  ).toBe(true);
  await page.getByLabel("Publication state").selectOption("draft");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Changes saved.");
  await visitor.reload();
  await visitor
    .getByRole("button", { name: "Open discoveries", exact: false })
    .click();
  await expect(visitor.getByRole("dialog")).toContainText(
    "No discoveries published in this destination yet.",
  );
  await c.close();
});
