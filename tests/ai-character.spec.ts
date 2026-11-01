import { authorizeLocalAuthor } from "./author-fixture";
import { test, expect } from "@playwright/test";
const route = "/explore?world=realm-hidden-worlds&arrival=direct",
  asset = "12345678-1234-4234-8234-123456789abc";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
async function create(page: import("@playwright/test").Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authorizeLocalAuthor(page);
  await page.goto(route);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill("AI fixture world");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Isolated browser test.");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(page.locator(".spirit-editor")).toBeVisible();
}
async function mock(
  page: import("@playwright/test").Page,
  { configured = true, authenticated = true, limit = 3 } = {},
) {
  let calls = 0,
    used = 0;
  const ids: string[] = [];
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({
      json: {
        configured,
        authenticated,
        csrf: "fixture-csrf",
        creatorId: "fixture-owner",
        usage: { used, limit, tier: "free" },
      },
    }),
  );
  await page.route("**/api/ai/generations", async (r) => {
    calls++;
    ids.push(r.request().postDataJSON().requestId);
    await new Promise((resolve) => setTimeout(resolve, 150));
    used++;
    await r.fulfill({
      json: {
        status: "success",
        assetId: asset,
        imageUrl: "/api/ai/assets/" + asset,
        creatorId: "fixture-owner",
      },
    });
  });
  await page.route("**/api/ai/assets/*", (r) =>
    r.fulfill({ body: png, contentType: "image/png" }),
  );
  return { calls: () => calls, ids };
}
async function open(page: import("@playwright/test").Page) {
  await page.locator(".ai-create-trigger").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Character name", { exact: true }).fill("Aurora");
  await page
    .getByLabel("Appearance description", { exact: true })
    .fill("An original crystalline guardian with branching translucent wings.");
}
test("unconfigured service and sign-in requirements never disable manual editing", async ({
  page,
}) => {
  const provider = await mock(page, {
    configured: false,
    authenticated: false,
  });
  await create(page);
  await open(page);
  await expect(
    page.getByText(
      "Image generation needs server configuration. Manual spirits remain available.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate character", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Back to manual spirits", exact: true })
    .click();
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await expect(page.getByLabel("Spirit name", { exact: true })).toBeVisible();
  expect(provider.calls()).toBe(0);
});
test("mocked provider: generate preview, confirm, connect, save/reload and reuse asset without regenerating", async ({
  page,
}) => {
  const provider = await mock(page);
  await create(page);
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await page.getByLabel("Spirit name", { exact: true }).fill("Anchor");
  await open(page);
  await page
    .getByLabel("Personality", { exact: true })
    .fill("Curious and calm");
  await page
    .getByLabel("Special abilities", { exact: true })
    .fill("Remembering pathways");
  await page
    .getByLabel("Related website (optional)", { exact: true })
    .fill("https://example.com");
  await page
    .getByRole("button", { name: "Generate character", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use this character", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".ai-preview img")).toBeVisible();
  await page
    .getByRole("button", { name: "Use this character", exact: true })
    .click();
  await expect(page.getByLabel("Spirit name", { exact: true })).toHaveValue(
    "Aurora",
  );
  await expect(page.locator(".ai-character-info img")).toBeVisible();
  await page
    .getByLabel("Path target", { exact: true })
    .selectOption({ label: "Anchor" });
  await page.getByLabel("X", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.reload();
  await page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name: "Aurora", exact: true })
    .press("Enter");
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("4");
  await expect(page.locator(".ai-character-info img")).toBeVisible();
  expect(provider.calls()).toBe(1);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
  );
  expect(
    saved.graph.characters.find((c: { name: string }) => c.name === "Aurora")
      .personality,
  ).toBe("Curious and calm");
  expect(saved.graph.connections).toHaveLength(1);
  expect(saved.graph.contents).toHaveLength(1);
});
test("regenerate creates a new request; edit clears preview and stale result cannot be confirmed", async ({
  page,
}) => {
  const provider = await mock(page);
  await create(page);
  await open(page);
  await page
    .getByRole("button", { name: "Generate character", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use this character", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use this character", exact: true }),
  ).toBeEnabled();
  expect(provider.calls()).toBe(2);
  expect(new Set(provider.ids).size).toBe(2);
  await page
    .getByRole("button", { name: "Edit description", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use this character", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Appearance description", { exact: true }),
  ).toBeFocused();
});
test("billing and daily quota errors are honest; failed generation does not add a character", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/ai/generations", (r) =>
    r.fulfill({ status: 502, json: { error: "billing_required" } }),
  );
  await create(page);
  await open(page);
  await page
    .getByRole("button", { name: "Generate character", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("credits or billing");
  await expect(
    page.getByRole("button", { name: "Use this character", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/ai/generations", (r) =>
    r.fulfill({ status: 429, json: { error: "daily_limit_reached" } }),
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Daily limit");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
  );
  expect(saved.graph.characters).toHaveLength(0);
});
test("small-screen reduced-motion form validates inputs and optional reference limit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await mock(page);
  await create(page);
  await page.locator(".ai-create-trigger").click();
  await page
    .getByRole("button", { name: "Generate character", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Enter a name");
  await page
    .getByLabel("Optional reference image (max. 512 KB)", { exact: true })
    .setInputFiles({
      name: "large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(513 * 1024),
    });
  await expect(page.getByRole("alert")).toContainText("512 KB");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("missing server key is distinguished from generic configuration and authentication", async ({
  page,
}) => {
  await mock(page, { configured: false, authenticated: false });
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({
      json: {
        configured: false,
        configurationIssue: "missing_api_key",
        authenticated: false,
      },
    }),
  );
  await create(page);
  await open(page);
  await expect(
    page.getByText(
      "Server OPENAI_API_KEY is missing or empty. Set it in .env.local and restart the server; never paste the key here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate character", exact: true }),
  ).toBeDisabled();
});
