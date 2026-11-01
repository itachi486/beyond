import { authorizeLocalAuthor } from "./author-fixture";
import { test, expect } from "@playwright/test";
const route = "/explore?world=realm-hidden-worlds&arrival=direct";
async function create(
  page: import("@playwright/test").Page,
  name = "Spirit Sanctuary",
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authorizeLocalAuthor(page);
  await page.goto(route);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill(name);
  await page
    .getByLabel("World Description", { exact: true })
    .fill("A private constellation of ideas.");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Spirit editor" }),
  ).toBeVisible();
}
async function add(
  page: import("@playwright/test").Page,
  type: string,
  name: string,
) {
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: type, exact: true })
    .click();
  await expect(page.getByLabel("Spirit name", { exact: true })).toHaveValue(
    type,
  );
  await page.getByLabel("Spirit name", { exact: true }).fill(name);
}
function character(page: import("@playwright/test").Page, name: string) {
  return page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name, exact: true });
}
test("3D characters, editable directed paths, content, explore, save and reopen", async ({
  page,
}) => {
  await create(page);
  await expect(page.locator(".spirit-canvas canvas")).toBeVisible();
  await add(page, "World Spirit", "Origin");
  await add(page, "Creator Spirit", "Story Keeper");
  await page
    .getByRole("button", { name: "Connect spirits", exact: true })
    .click();
  await character(page, "Origin").press("Enter");
  await character(page, "Story Keeper").press("Enter");
  await page.getByLabel("Path name", { exact: true }).fill("A first story");
  await page.getByLabel("Path type", { exact: true }).selectOption("contains");
  await character(page, "Story Keeper").press("Enter");
  await page.getByRole("button", { name: "Add content", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("The first star");
  await page.getByLabel("Content type", { exact: true }).selectOption("story");
  await page
    .getByLabel("Text / description", { exact: true })
    .fill("A story kept in this spirit.");
  await page.getByRole("button", { name: "Save content", exact: true }).click();
  await expect(
    page.getByText("A story kept in this spirit.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate spirit", exact: true })
    .click();
  await expect(character(page, "Story Keeper copy")).toBeAttached();
  await expect(
    page.getByText("A story kept in this spirit.", { exact: true }),
  ).toBeVisible();
  await character(page, "Story Keeper").press("Enter");
  await page
    .getByLabel("Appearance", { exact: true })
    .selectOption("starlight");
  await page.getByLabel("Scale", { exact: true }).fill("1.4");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.reload();
  await character(page, "Story Keeper").press("Enter");
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue("1.4");
  await expect(page.getByText("The first star", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  await expect(page.locator(".spirit-library")).toHaveCount(0);
  await character(page, "Origin").press("Enter");
  await page
    .getByRole("button", { name: "A first story → Story Keeper", exact: true })
    .click();
  await expect(page.locator(".spirit-details h2")).toHaveText("Story Keeper");
  await expect(
    page.getByText("A story kept in this spirit.", { exact: true }),
  ).toBeVisible();
  await page.locator(".spirit-canvas").click({ button: "right" });
  await page.getByRole("button", { name: "Edit Mode", exact: true }).click();
  await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
  await page.getByRole("button", { name: /Spirit Sanctuary/ }).click();
  await expect(page.locator(".spirit-canvas canvas")).toBeVisible();
});
test("duplicate links are rejected, delete cascades and undo/redo restore graph", async ({
  page,
}) => {
  await create(page);
  await add(page, "Collector Spirit", "Collector");
  await add(page, "Custom Spirit", "Custom");
  await character(page, "Collector").press("Enter");
  await page
    .getByLabel("Path target", { exact: true })
    .selectOption({ label: "Custom" });
  await page
    .getByLabel("Path target", { exact: true })
    .selectOption({ label: "Custom" });
  await expect(page.getByRole("status")).toContainText("duplicate");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  let data = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
  );
  expect(data.graph.connections).toHaveLength(1);
  await character(page, "Custom").press("Enter");
  await page
    .getByRole("button", { name: "Delete spirit", exact: true })
    .click();
  await expect(character(page, "Custom")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(character(page, "Custom")).toBeAttached();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(character(page, "Custom")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  data = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
  );
  expect(data.graph.characters).toHaveLength(2);
  expect(data.graph.connections).toHaveLength(1);
  await page.locator(".spirit-edge-access summary").click();
  await page
    .locator(".spirit-edge-access")
    .getByRole("button", { name: "Collector → Custom", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete pathway", exact: true })
    .click();
  await expect(page.locator(".spirit-edge-access summary")).toContainText(
    "(0)",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".spirit-edge-access summary")).toContainText(
    "(1)",
  );
});
test("real canvas raycast drag, keyboard movement, duplication and type changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await create(page);
  await add(page, "Creator Spirit", "Mover");
  const button = character(page, "Mover");
  await expect
    .poll(() => button.evaluate((e) => e.style.getPropertyValue("--spirit-x")))
    .not.toBe("");
  const box = (await button.boundingBox())!,
    before = await page.getByLabel("X", { exact: true }).inputValue();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 45,
    box.y + box.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("X", { exact: true })).not.toHaveValue(before);
  await button.press("ArrowRight");
  await page.getByLabel("Type", { exact: true }).selectOption("custom");
  await page
    .getByLabel("Custom role", { exact: true })
    .fill("Personal observatory");
  await page
    .getByRole("button", { name: "Duplicate spirit", exact: true })
    .click();
  await expect(character(page, "Mover copy")).toBeAttached();
});
test("unsafe URLs are rejected, sources preserved, content can be edited and deleted", async ({
  page,
}) => {
  await create(page);
  await add(page, "Collector Spirit", "Links");
  await page.getByRole("button", { name: "Add content", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Reference");
  await page.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save content", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("http or https");
  await page.getByLabel("URL", { exact: true }).fill("https://example.com");
  await page
    .getByLabel("Source URL (optional)", { exact: true })
    .fill("https://example.com/source");
  await page.getByRole("button", { name: "Save content", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open original" }),
  ).toHaveAttribute("href", "https://example.com");
  await page.getByRole("button", { name: "Edit content", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Updated reference");
  await page.getByRole("button", { name: "Save content", exact: true }).click();
  await expect(
    page.getByText("Updated reference", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete content", exact: true })
    .click();
  await expect(page.getByRole("link", { name: "Open original" })).toHaveCount(
    0,
  );
});
test("portal only enters existing local worlds and rejects missing destination", async ({
  page,
}) => {
  await create(page, "Destination");
  const target = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0].id,
  );
  await create(page, "Home");
  await add(page, "Portal Spirit", "Gateway");
  await page
    .getByRole("button", { name: "Explore / execute", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Assign a local destination",
  );
  await page
    .getByLabel("Destination local world", { exact: true })
    .selectOption(target);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page
    .getByRole("button", { name: "Explore / execute", exact: true })
    .click();
  await expect(page.locator(".editor-header h1")).toHaveText("Destination");
});
test("WebGL failure still permits data editing without claiming 3D success", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.includes("webgl")) return null;
      return original.apply(this, [kind, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await create(page);
  await expect(
    page.getByText(
      "3D unavailable. Accessible controls still support editing and exploration.",
    ),
  ).toBeVisible();
  await add(page, "World Spirit", "Fallback");
  await character(page, "Fallback").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
});

test("mobile real touch drag, Spanish and reduced-motion data editing", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await create(page);
  await add(page, "Portal Spirit", "Touch gate");
  await page.locator(".spirit-canvas").scrollIntoViewIfNeeded();
  const anchor = character(page, "Touch gate");
  await expect
    .poll(() => anchor.evaluate((e) => e.style.getPropertyValue("--spirit-x")))
    .not.toBe("");
  const b = (await anchor.boundingBox())!,
    before = await page.getByLabel("X", { exact: true }).inputValue(),
    session = await context.newCDPSession(page),
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 22, y: y + 14 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByLabel("X", { exact: true })).not.toHaveValue(before);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    localStorage.setItem("beyond:v1:locale", JSON.stringify("es")),
  );
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Editor de espíritus" }),
  ).toBeVisible();
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "Espíritu creador", exact: true })
    .tap();
  await page
    .getByRole("button", { name: "Añadir contenido", exact: true })
    .click();
  await page.getByLabel("Título", { exact: true }).fill("Una idea");
  await page
    .getByLabel("Texto / descripción", { exact: true })
    .fill("Un texto local.");
  await page
    .getByRole("button", { name: "Guardar contenido", exact: true })
    .click();
  await expect(
    page.getByText("Un texto local.", { exact: true }),
  ).toBeVisible();
  await context.close();
});

test("real rendered animation changes and reduced motion stops GPU draws", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { spiritDraws: number };
    w.spiritDraws = 0;
    const elements = WebGL2RenderingContext.prototype.drawElements,
      arrays = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawElements = function (
      mode,
      count,
      type,
      offset,
    ) {
      w.spiritDraws++;
      elements.call(this, mode, count, type, offset);
    };
    WebGL2RenderingContext.prototype.drawArrays = function (
      mode,
      first,
      count,
    ) {
      w.spiritDraws++;
      arrays.call(this, mode, first, count);
    };
  });
  await create(page);
  await add(page, "World Spirit", "Motion");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const canvas = page.locator(".spirit-canvas canvas");
  await page.waitForTimeout(400);
  const a = await canvas.screenshot();
  await page.waitForTimeout(700);
  expect((await canvas.screenshot()).equals(a)).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(400);
  const count = () =>
    page.evaluate(
      () => (window as unknown as { spiritDraws: number }).spiritDraws,
    );
  const b = await count();
  expect(b).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  expect(await count()).toBe(b);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(count).toBeGreaterThan(b);
});

test("discovery camera gestures, following a real relationship, back and Escape preserve the saved graph", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await create(page, "Discovery Journey");
  await add(page, "World Spirit", "First Presence");
  await add(page, "Portal Spirit", "Second Presence");
  await page
    .getByRole("button", { name: "Connect spirits", exact: true })
    .click();
  await character(page, "First Presence").press("Enter");
  await character(page, "Second Presence").press("Enter");
  await page
    .getByLabel("Path name", { exact: true })
    .fill("Across the constellation");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  const before = await page.evaluate(() =>
    localStorage.getItem("beyond:v1:created-worlds"),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  await character(page, "First Presence").press("Enter");
  await page
    .getByRole("button", {
      name: "Across the constellation → Second Presence",
      exact: true,
    })
    .click();
  await expect(page.locator(".spirit-details h2")).toHaveText(
    "Second Presence",
  );
  await page
    .getByRole("button", { name: "Back to previous discovery", exact: true })
    .click();
  await expect(page.locator(".spirit-details h2")).toHaveText("First Presence");
  const canvas = page.locator(".spirit-canvas canvas");
  await expect(canvas).toHaveAttribute("data-camera", /.+/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".spirit-details")).not.toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  const camera = await canvas.getAttribute("data-camera");
  await page.mouse.wheel(0, -250);
  await expect.poll(() => canvas.getAttribute("data-camera")).not.toBe(camera);
  const zoomed = await canvas.getAttribute("data-camera");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.3 + 70,
    box.y + box.height * 0.4 + 30,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect.poll(() => canvas.getAttribute("data-camera")).not.toBe(zoomed);
  expect(
    await page.evaluate(() => localStorage.getItem("beyond:v1:created-worlds")),
  ).toBe(before);
  await page.screenshot({ path: "/tmp/beyond-discovery-1440.png" });
  await page.locator(".spirit-canvas").click({ button: "right" });
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect
    .poll(async () =>
      Number((await canvas.getAttribute("data-camera"))?.split(",")[2]),
    )
    .toBe(1);
  await page.screenshot({ path: "/tmp/beyond-discovery-overview-1440.png" });
  await character(page, "Second Presence").press("Enter");
  await expect(page.locator(".spirit-details h2")).toHaveText(
    "Second Presence",
  );
  // Allow the real eased camera/render loop to settle before visual evidence.
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/beyond-discovery-detail-1440.png" });
  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem("beyond:v1:created-worlds")),
  ).toBe(before);
});

for (const width of [375, 768])
  test(`touch discovery pan/pinch, selected details and return at ${width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: true,
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    try {
      await create(page, "Touch Discovery");
      await add(page, "Collector Spirit", "Touch Presence");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".editor-footer [role=status]")).toHaveText(
        "Saved in this browser.",
      );
      const stored = await page.evaluate(() =>
        localStorage.getItem("beyond:v1:created-worlds"),
      );
      await page
        .getByRole("button", { name: "Explore Mode", exact: true })
        .click();
      await character(page, "Touch Presence").press("Enter");
      await expect(page.locator(".spirit-details h2")).toHaveText(
        "Touch Presence",
      );
      await page
        .getByRole("button", { name: "Close discovery", exact: true })
        .click();
      const canvas = page.locator(".spirit-canvas canvas");
      await canvas.scrollIntoViewIfNeeded();
      const r = (await canvas.boundingBox())!,
        x = r.x + r.width * 0.5,
        y = r.y + Math.min(r.height * 0.5, 200),
        session = await context.newCDPSession(page);
      const before = await canvas.getAttribute("data-camera");
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: x - 30, y, id: 1 },
          { x: x + 30, y, id: 2 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - 55, y, id: 1 },
          { x: x + 55, y, id: 2 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() => canvas.getAttribute("data-camera"))
        .not.toBe(before);
      const pinched = await canvas.getAttribute("data-camera");
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 35, y: y + 20, id: 1 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() => canvas.getAttribute("data-camera"))
        .not.toBe(pinched);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("beyond:v1:created-worlds"),
        ),
      ).toBe(stored);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 375)
        expect((await canvas.boundingBox())!.height).toBeGreaterThan(600);
      await page.screenshot({
        path: `/tmp/beyond-discovery-${width}.png`,
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  });
