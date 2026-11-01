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
        ADMIN_ALLOWED_EMAIL: "editor@example.test",
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
  await expect(
    page.getByRole("heading", { name: "Welcome Back", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const img = new Image();
    img.src = "/admin-cosmic-reference.png";
    await img.decode();
  });
  await page.screenshot({
    path: `/tmp/beyond-cosmic-login-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  await page.getByLabel("Email address").fill("editor@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(base + "/admin");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
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
    if (width < 800)
      await page
        .getByRole("button", { name: "Toggle administrator navigation" })
        .click();
    await page.screenshot({
      path: `/tmp/beyond-fantasy-dashboard-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Worlds", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Worlds", exact: true }),
    ).toBeVisible();
    if (width < 800)
      await page
        .getByRole("button", { name: "Toggle administrator navigation" })
        .click();
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
  await page
    .getByRole("button", { name: "System Settings", exact: true })
    .click();
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
    page.getByRole("heading", { name: "System Settings", exact: true }),
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

test("users, character availability, content and system status use real server data and keep secrets out of UI", async ({
  page,
}) => {
  for (const path of ["users", "characters", "system"])
    expect((await page.request.get(base + "/api/admin/" + path)).status()).toBe(
      401,
    );
  await login(page);
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".admin-panel")).toContainText(["Server accounts"]);
  await page.getByLabel("Search accounts").fill("no-such-account");
  await expect(page.getByText("No matching server records.")).toBeVisible();
  await page.getByLabel("Search accounts").fill("editor@example.test");
  await expect(
    page.getByRole("button", { name: "View details" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View details" }).click();
  await expect(
    page.getByRole("dialog", { name: "Account details" }),
  ).toContainText("Read-only");
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByLabel("Account status").selectOption("blocked");
  await expect(page.getByText("No matching server records.")).toBeVisible();
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Characters", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Browser character libraries: Not centrally stored"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Manage connections", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "System Settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "System status", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".admin-detail")).toContainText(
    "Single allowed email",
  );
  expect(
    await page
      .locator(".admin-workspace")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(247, 246, 240)");
  await page.screenshot({
    path: "/tmp/beyond-admin-system.png",
    fullPage: true,
  });
});
for (const width of [375, 1440])
  test(`character server asset preview and private operations layout at ${width}`, async ({
    page,
  }) => {
    // An actual stored fixture PNG in an isolated SQLite DB, no image-generation request.
    await page.goto(base + "/admin/login");
    const fixturePNG = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 96;
      const x = c.getContext("2d")!;
      x.fillStyle = "#5da9af";
      x.beginPath();
      x.moveTo(32, 6);
      x.lineTo(57, 58);
      x.lineTo(43, 87);
      x.lineTo(17, 87);
      x.lineTo(7, 58);
      x.closePath();
      x.fill();
      x.fillStyle = "#f6d58c";
      x.fillRect(21, 43, 6, 6);
      x.fillRect(38, 43, 6, 6);
      return c.toDataURL("image/png").split(",")[1];
    });
    const { openStore } = await import("../server/store.mjs");
    const db = openStore(join(temp, "test.sqlite"));
    const id = "00000000-0000-0000-0000-000000000010";
    try {
      const owner = db.prepare("SELECT id FROM admins").get().id;
      db.exec(
        "CREATE TABLE IF NOT EXISTS ai_character_assets(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,created_at INTEGER NOT NULL)",
      );
      db.prepare(
        "INSERT OR IGNORE INTO ai_character_assets VALUES(?,?,?,?,?)",
      ).run(
        id,
        owner,
        "image/png",
        Buffer.from(fixturePNG, "base64"),
        Date.now(),
      );
    } finally {
      db.close();
    }
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.screenshot({
      path: `/tmp/beyond-admin-dashboard-${width}.png`,
      fullPage: true,
    });
    if (width < 800)
      await page
        .getByRole("button", { name: "Toggle administrator navigation" })
        .click();
    await page.getByRole("button", { name: "Characters", exact: true }).click();
    await page.getByLabel("Search assets").fill(id);
    await page.getByRole("button", { name: "View details" }).click();
    const d = page.getByRole("dialog", { name: "Character asset details" });
    await expect(d).toBeVisible();
    const img = d.getByRole("img", { name: "Stored character image" });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((i) => (i as HTMLImageElement).naturalWidth))
      .toBe(64);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/beyond-admin-character-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Close details" }).click();
    if (width < 800)
      await page
        .getByRole("button", { name: "Toggle administrator navigation" })
        .click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    expect(
      (await page.request.get(base + "/api/admin/characters")).status(),
    ).toBe(401);
  });

async function centralRaster(
  page: import("@playwright/test").Page,
  type = "image/png",
) {
  return Buffer.from(
    await page.evaluate((type) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 96;
      const x = c.getContext("2d")!;
      x.fillStyle = "#9c7fee";
      x.beginPath();
      x.moveTo(32, 5);
      x.lineTo(57, 63);
      x.lineTo(43, 91);
      x.lineTo(18, 91);
      x.lineTo(7, 63);
      x.closePath();
      x.fill();
      x.fillStyle = "#aaf6f5";
      x.fillRect(21, 46, 6, 6);
      x.fillRect(38, 46, 6, 6);
      return c.toDataURL(type).split(",")[1];
    }, type),
    "base64",
  );
}
async function centralUserWorld(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.goto(base + "/explore?world=realm-hidden-worlds&arrival=direct");
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill(name);
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Central library integration test world.");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(page.locator(".spirit-editor")).toBeVisible();
}
test("administrator central upload reaches anonymous CREATE, preserves layout/connections after update, deactivation and archive", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  await page
    .getByRole("button", { name: "Upload Character", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Upload central character" });
  await dialog.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "nebula.png",
    mimeType: "image/png",
    buffer: await centralRaster(page),
  });
  await dialog
    .getByLabel("Character name", { exact: true })
    .fill("Nebula guide");
  await dialog
    .getByLabel("Character description", { exact: true })
    .fill("Original central fixture, created elsewhere.");
  await dialog.getByRole("button", { name: "Save central character" }).click();
  await expect(
    page.getByRole("status", { name: "Central library result" }),
  ).toContainText("Character uploaded to the central library");
  const row = (
    await (
      await page.request.get(base + "/api/public/characters?search=Nebula")
    ).json()
  ).items[0];
  expect(row.name).toBe("Nebula guide");
  expect(
    (
      await page.request.get(
        base + "/character-assets/" + row.id + "/original.png",
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(base + "/@fs/" + temp + "/character-assets")
    ).status(),
  ).toBe(404);
  const visitor = await browser.newContext({
      baseURL: base,
      reducedMotion: "reduce",
    }),
    user = await visitor.newPage();
  try {
    expect(
      (
        await user.request.post(base + "/api/admin/library/characters", {
          data: { name: "unauthorized" },
        })
      ).status(),
    ).toBe(401);
    await centralUserWorld(user, "Public central universe");
    await user
      .getByRole("button", { name: "Central Library", exact: true })
      .click();
    await user
      .getByRole("dialog")
      .getByRole("button", { name: /Nebula guide/ })
      .click();
    await user.getByLabel("Placement scale").fill("1.2");
    await user
      .getByRole("button", { name: "Add to world", exact: true })
      .click();
    await expect(user.getByLabel("Spirit name", { exact: true })).toHaveValue(
      "Nebula guide",
    );
    await expect(
      user.getByRole("button", { name: "Upload Character", exact: true }),
    ).toHaveCount(0);
    await expect(
      user.getByRole("button", { name: "World Spirit", exact: true }),
    ).toHaveCount(0);
    await user
      .getByRole("button", { name: "Central Library", exact: true })
      .click();
    await user
      .getByRole("dialog")
      .getByRole("button", { name: /Nebula guide/ })
      .click();
    await user
      .getByRole("button", { name: "Add to world", exact: true })
      .click();
    await expect(
      user.getByRole("dialog", {
        name: "Central Library",
        exact: true,
      }),
    ).toHaveCount(0);
    await user
      .getByLabel("Spirit name", { exact: true })
      .fill("Linked traveler");
    await user
      .getByLabel("Path target", { exact: true })
      .selectOption({ label: "Nebula guide" });
    await user.getByRole("button", { name: "Save", exact: true }).click();
    await expect(user.locator(".editor-footer [role=status]")).toHaveText(
      "Saved in this browser.",
    );
    const before = await user.evaluate(
      () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
    );
    expect(before.graph.characters[0].centralCharacterId).toBe(row.id);
    expect(before.graph.characters[0].centralVersion).toBe(1);
    expect(before.graph.connections).toHaveLength(1);
    expect(before.graph.characters[0].appearance.scale).toBe(1.2);
    await page.getByLabel("Search central library").fill("Nebula");
    await page
      .getByRole("button", { name: "Edit character", exact: true })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit central character" });
    await edit
      .getByLabel("Character name", { exact: true })
      .fill("Nebula guide revised");
    await edit.getByLabel("Publish in the public central library").uncheck();
    await edit.getByRole("button", { name: "Save central character" }).click();
    await expect(
      page.getByRole("status", { name: "Central library result" }),
    ).toContainText("Central character updated");
    expect(
      (
        await user.request.get(base + "/api/public/characters/" + row.id)
      ).status(),
    ).toBe(404);
    await user.reload();
    await expect(user.locator(".spirit-canvas")).not.toHaveAttribute(
      "data-loaded-assets",
      "",
    );
    const after = await user.evaluate(
      () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
    );
    expect(after).toEqual(before);
    await user
      .getByRole("button", { name: "Central Library", exact: true })
      .click();
    await user.getByLabel("Search central characters").fill("Nebula");
    await expect(
      user.getByText(/No active central characters yet/),
    ).toBeVisible();
    await user.getByRole("button", { name: "Close central library" }).click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Archive character", exact: true })
      .click();
    await expect(
      page.getByRole("status", { name: "Central library result" }),
    ).toContainText("Character archived");
    await user.reload();
    await expect(user.locator(".spirit-canvas")).not.toHaveAttribute(
      "data-loaded-assets",
      "",
    );
    await user.screenshot({ path: "/tmp/beyond-central-world-snapshot.png" });
    await page.getByLabel("Central status").selectOption("archived");
    await page
      .getByRole("button", { name: /Permanently Delete Nebula/ })
      .click();
    await page
      .getByRole("dialog", { name: "Permanent deletion" })
      .getByRole("button", { name: "Delete Permanently", exact: true })
      .click();
    await expect(
      page.getByRole("status", { name: "Central library result" }),
    ).toContainText("Permanent deletion completed.");
    await user.reload();
    await expect(user.locator(".spirit-canvas")).not.toHaveAttribute(
      "data-loaded-assets",
      "",
    );
    expect(
      await user.evaluate(() =>
        localStorage.getItem("beyond:v1:created-worlds"),
      ),
    ).toBeTruthy();

    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(
      page.getByText("Latest System Logs", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Archived character", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/beyond-cosmic-dashboard.png",
      fullPage: true,
    });
  } finally {
    await visitor.close();
  }
});
function centralModelFixture() {
  const bin = Buffer.alloc(44);
  [-1, 0, 0, 1, 0, 0, 0, 2, 0].forEach((n, i) => bin.writeFloatLE(n, i * 4));
  [0, 1, 2].forEach((n, i) => bin.writeUInt16LE(n, 36 + i * 2));
  const obj = {
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
  let json = JSON.stringify(obj);
  json += " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4);
  const b = Buffer.alloc(28 + Buffer.byteLength(json) + bin.length);
  b.writeUInt32LE(0x46546c67, 0);
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(Buffer.byteLength(json), 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  b.write(json, 20);
  b.writeUInt32LE(bin.length, 20 + Buffer.byteLength(json));
  b.writeUInt32LE(0x004e4942, 24 + Buffer.byteLength(json));
  bin.copy(b, 28 + Buffer.byteLength(json));
  return b;
}
test("GLB central upload previews in administrator and anonymous editor at 375px; invalid local file cannot save", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  await page
    .getByRole("button", { name: "Upload Character", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Upload central character" });
  await d.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(d.getByRole("alert")).toContainText("Could not preview");
  await expect(
    d.getByRole("button", { name: "Save central character" }),
  ).toBeDisabled();
  await d.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "crystal.glb",
    mimeType: "model/gltf-binary",
    buffer: centralModelFixture(),
  });
  await d
    .getByLabel("Character name", { exact: true })
    .fill("Central crystal GLB");
  await expect(d.locator(".upload-preview canvas")).toBeVisible();
  await d.getByLabel("Preview image (optional, ≤2 MiB)").setInputFiles({
    name: "preview.png",
    mimeType: "image/png",
    buffer: await centralRaster(page),
  });
  await d.getByRole("button", { name: "Save central character" }).click();
  await expect(
    page.getByRole("status", { name: "Central library result" }),
  ).toContainText("Character uploaded");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "/tmp/beyond-central-admin-library.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.locator(".cosmic-donut")).toBeVisible();
  await page.screenshot({
    path: "/tmp/beyond-cosmic-dashboard-populated.png",
    fullPage: true,
  });
  const visitor = await browser.newContext({
      baseURL: base,
      viewport: { width: 375, height: 812 },
      reducedMotion: "reduce",
    }),
    user = await visitor.newPage();
  try {
    await centralUserWorld(user, "Mobile central model");
    await user
      .getByRole("button", { name: "Central Library", exact: true })
      .click();
    await user.getByRole("button", { name: /Central crystal GLB/ }).click();
    await expect(
      user.getByRole("dialog").locator(".upload-preview canvas"),
    ).toBeVisible();
    await user.screenshot({
      path: "/tmp/beyond-central-mobile-preview.png",
      fullPage: true,
    });
    await user
      .getByRole("button", { name: "Add to world", exact: true })
      .click();
    await user.getByRole("button", { name: "Save", exact: true }).click();
    await expect(user.locator(".editor-footer [role=status]")).toHaveText(
      "Saved in this browser.",
    );
    await user.reload();
    await expect(user.locator(".spirit-canvas")).not.toHaveAttribute(
      "data-loaded-assets",
      "",
    );
    expect(
      await user.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await visitor.close();
  }
});

test("fantasy dashboard permanent world and central character deletion requires confirmation and persists after refresh", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByText("Total Users", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Storage metering and quota are not configured."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .getByRole("button", { name: "Permanently Delete WHAT IF?", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Permanent deletion",
    exact: true,
  });
  await expect(dialog).toContainText("WHAT IF?");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Permanently Delete WHAT IF?", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Action result" }),
  ).toContainText("Permanent deletion completed.");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Permanently Delete WHAT IF?",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  await page
    .getByRole("button", { name: "Upload Character", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Character name", { exact: true })
    .fill("Permanent fixture guardian");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "delete.png",
      mimeType: "image/png",
      buffer: await centralRaster(page),
    });
  await expect(
    page.getByRole("button", { name: "Save central character", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Save central character", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Central library result" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Permanently Delete Permanent fixture guardian",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Central library result" }),
  ).toContainText("Permanent deletion completed.");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Permanently Delete Permanent fixture guardian",
      exact: true,
    }),
  ).toHaveCount(0);
});
