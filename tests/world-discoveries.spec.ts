import { test, expect } from "@playwright/test";
import { authorizeLocalAuthor } from "./author-fixture";
test("My World lights persist independently and reveal only an existing published character", async ({
  page,
}) => {
  test.setTimeout(90000);
  await authorizeLocalAuthor(page);
  await page.goto("/explore?world=realm-hidden-worlds&arrival=direct");
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 240;
    const x = c.getContext("2d")!;
    x.fillStyle = "#f5e3bf";
    x.beginPath();
    x.ellipse(80, 120, 45, 100, 0, 0, Math.PI * 2);
    x.fill();
    return c.toDataURL("image/png").split(",")[1];
  });
  const session = await (await page.request.get("/api/admin/session")).json();
  const response = await page.request.post("/api/admin/library/characters", {
    headers: { Origin: "http://127.0.0.1:5178", "X-CSRF-Token": session.csrf },
    data: {
      name: "Warm guardian fixture",
      description: "Published fixture character.",
      type: "world",
      tags: "",
      source: "",
      active: true,
      file: { name: "guardian.png", data: image },
    },
  });
  expect(response.status()).toBe(201);
  const character = (await response.json()).item;
  const secondResponse = await page.request.post(
    "/api/admin/library/characters",
    {
      headers: {
        Origin: "http://127.0.0.1:5178",
        "X-CSRF-Token": session.csrf,
      },
      data: {
        name: "Second guardian fixture",
        description: "An existing collector fixture.",
        type: "collector",
        tags: "",
        source: "",
        active: true,
        file: { name: "guardian-two.png", data: image },
      },
    },
  );
  expect(secondResponse.status()).toBe(201);
  const second = (await secondResponse.json()).item;

  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page
    .getByLabel("World Name", { exact: true })
    .fill("Warm discovery fixture");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Isolated discovery configuration");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  const original = await page.evaluate(() =>
    localStorage.getItem("beyond:v1:created-worlds"),
  );
  await page
    .getByRole("button", { name: "My World discoveries", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "My World discoveries" });
  await dialog.getByLabel("Published character").selectOption(character.id);
  await dialog.getByRole("button", { name: "Add light", exact: true }).click();
  await dialog.getByLabel("Published character").selectOption(second.id);
  await dialog.getByRole("button", { name: "Add light", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save discoveries", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText("Discoveries saved.");
  await dialog.getByRole("button", { name: "Back to My World" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "My World discoveries", exact: true })
    .click();
  await expect(dialog.locator("fieldset")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Explore lights", exact: true })
    .click();
  await expect(dialog.locator(".world-discovery-config")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Discover light 1", exact: true })
    .click();
  await expect(dialog.locator(".adventure-character h1")).toHaveText(
    "Warm guardian fixture",
  );
  await expect(dialog.locator(".adventure-character img")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("beyond:v1:created-worlds")),
  ).toBe(original);
  await expect(
    dialog.getByRole("button", { name: "Discover light 2", exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator(".character-chat")).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Your message", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('textbox',{name:'Your message',exact:true}).fill('   ');
  await dialog.getByRole('textbox',{name:'Your message',exact:true}).press('Enter');
  await expect(dialog.locator('.character-chat .from-visitor')).toHaveCount(0);

  await expect(
    dialog.getByRole("textbox", { name: "Your message", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .fill("Where is this world?");
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .press("Enter");
  await expect(
    dialog.getByRole("textbox", { name: "Your message", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".character-chat")).toContainText(
    "AI not connected",
  );
  await expect(dialog.locator(".character-chat")).toContainText(
    "Warm discovery fixture",
  );
  await expect(
    dialog.getByRole("button", {
      name: "Follow the golden glimmer",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("textbox", { name: "Your message", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .fill("Could you offer me a clue?");
  await dialog
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(dialog.locator(".character-chat")).toContainText(
    "golden glimmer",
  );
  await dialog
    .getByRole("button", { name: "Follow the golden glimmer", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Discover light 2", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/beyond-adventure-desktop.png" });
  await dialog
    .getByRole("button", { name: "Back to My World", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  await expect(dialog.locator(".world-discovery-config")).toHaveCount(0);
  await expect(dialog.locator(".adventure-character h1")).toHaveText(
    "Warm guardian fixture",
  );
  await expect(
    dialog.getByRole("button", { name: "Discover light 2", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Discover light 1", exact: true })
    .click();
  await expect(dialog.locator(".adventure-character h1")).toHaveText(
    "Warm guardian fixture",
  );
  await expect(dialog.locator(".character-chat")).toContainText(
    "golden glimmer",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/beyond-adventure-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const chatPanel = dialog.locator(".character-chat");
  await dialog
    .getByRole("button", { name: "Minimize conversation", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Your message", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Restore conversation", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Close conversation", exact: true })
    .click();
  await expect(chatPanel).toHaveCount(0);
  await dialog.getByRole("button", { name: "Talk", exact: true }).click();
  await expect(chatPanel).toContainText("Could you offer me a clue?");
  // Module replacement is confined to this disposable browser: simulate an actual handler failure.
  await page.evaluate(async () => {
    const mod =
      await import("/src/features/creation/worldDiscoveryProgress.ts");
    (window as any).__reply = mod.localDialogue.reply;
    mod.localDialogue.reply = async () => {
      throw Error("fixture response failure");
    };
  });
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .fill("Please keep this unsent message.");
  await dialog
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(chatPanel.getByRole("alert")).toContainText("AI could not respond");
  await expect(
    dialog.getByRole("textbox", { name: "Your message", exact: true }),
  ).toHaveValue("Please keep this unsent message.");
  await expect(chatPanel).toContainText("Could you offer me a clue?");
  await page.evaluate(async () => {
    const mod =
      await import("/src/features/creation/worldDiscoveryProgress.ts");
    mod.localDialogue.reply = (input: any) =>
      new Promise((resolve) => {
        (window as any).__finish = () =>
          resolve((window as any).__reply(input));
      });
  });
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .fill("Hello from the mobile world");
  await dialog
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(chatPanel.getByRole("status")).toContainText("thinking");
  await expect(
    dialog.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .press("Enter");
  await page.waitForFunction(() => typeof (window as any).__finish === "function");
  await page.evaluate(() => (window as any).__finish());
  await expect(chatPanel.getByRole("log")).toContainText(
    "Hello from the mobile world",
  );
  await expect(
    chatPanel
      .locator(".from-visitor")
      .filter({ hasText: "Hello from the mobile world" }),
  ).toHaveCount(1);
  await page.evaluate(async () => {
    const mod =
      await import("/src/features/creation/worldDiscoveryProgress.ts");
    mod.localDialogue.reply = (window as any).__reply;
  });
  await dialog
    .getByRole("button", { name: "Discover light 2", exact: true })
    .click();
  await expect(chatPanel.locator("h2")).toHaveText("Second guardian fixture");
  await expect(chatPanel).not.toContainText("Hello from the mobile world");
  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .fill("Who are you?");
  await dialog.getByRole('textbox',{name:'Your message',exact:true}).press('Shift+Enter');
  await dialog.getByRole('textbox',{name:'Your message',exact:true}).pressSequentially('Tell me about your role.');

  await dialog
    .getByRole("textbox", { name: "Your message", exact: true })
    .press("Enter");
  await expect(chatPanel.getByRole("log")).toContainText(
    "Second guardian fixture (collector)",
  );
  await dialog
    .getByRole("button", { name: "Discover light 1", exact: true })
    .click();
  await expect(chatPanel.locator("h2")).toHaveText("Warm guardian fixture");
  await expect(chatPanel).toContainText("Hello from the mobile world");
  await expect(chatPanel).not.toContainText("Who are you?");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "/tmp/beyond-character-chat-desktop.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "/tmp/beyond-character-chat-mobile.png" });
  // A later protected lookup must deny an unpublished/missing original, never use its old local preview.
  await page.route(`**/api/public/characters/${character.id}`, (r) =>
    r.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "unavailable" }),
    }),
  );
  await dialog
    .getByRole("button", { name: "Discover light 1", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("no longer published");
  await expect(dialog.locator(".adventure-character")).toHaveCount(0);
});

test("Explore Mode opens the current world adventure and offers an honest empty state", async ({
  page,
}) => {
  await page.goto("/explore?world=realm-hidden-worlds&arrival=direct");
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page
    .getByLabel("World Name", { exact: true })
    .fill("Uncharted fixture");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("A world with no configured discoveries.");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "My World discoveries" });
  await expect(dialog.locator(".adventure-heading")).toContainText(
    "Uncharted fixture",
  );
  await expect(dialog.locator(".world-discovery-config")).toHaveCount(0);
  await expect(dialog.locator(".adventure-empty")).toContainText(
    "no discovery locations",
  );
  await dialog
    .getByRole("button", { name: "Create a discovery", exact: true })
    .click();
  await expect(dialog.locator(".world-discovery-config")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to My World", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "3D flight", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3D flight", exact: true }).click();
  await expect(page.locator(".spirit-canvas canvas")).toHaveAttribute(
    "data-projection",
    "perspective",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Cosmos actions" })
      .getByRole("button"),
  ).toHaveCount(6);
});
