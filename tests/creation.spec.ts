import { authorizeLocalAuthor } from "./author-fixture";
import { test, expect } from "@playwright/test";
const route = "/explore?world=realm-hidden-worlds&arrival=direct";
async function modal(page: import("@playwright/test").Page) {
  await authorizeLocalAuthor(page);
  await page.goto(route);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function create(
  page: import("@playwright/test").Page,
  name = "Moon Garden",
) {
  await authorizeLocalAuthor(page);
  await page.goto(route);
  const id = await page.evaluate((name) => {
    const key = "beyond:v1:created-worlds",
      worlds = JSON.parse(localStorage.getItem(key) || "[]"),
      now = new Date().toISOString(),
      id = crypto.randomUUID();
    worlds.push({
      version: 1,
      id,
      name,
      description: "A quiet realm of luminous gardens.",
      createdAt: now,
      updatedAt: now,
      theme: "celestial",
      objects: [],
    });
    localStorage.setItem(key, JSON.stringify(worlds));
    return id;
  }, name);
  await page.goto(route + "&creation=" + id);
  await expect(
    page.getByRole("region", { name: "World editor" }),
  ).toBeVisible();
}
test("modal validates whitespace, preserves textarea Enter, backdrop and cancel create nothing", async ({
  page,
}) => {
  await modal(page);
  await expect(page.getByLabel("World Name", { exact: true })).toBeFocused();
  await page.getByLabel("World Name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(
    page.getByText("Enter a world name.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Enter a world description.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("World Description", { exact: true }).fill("line one");
  await page.getByLabel("World Description", { exact: true }).press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator(".creation-shade").click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "CREATE", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem("beyond:v1:created-worlds")),
  ).toBeNull();
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("create, manipulate, undo/redo, save, refresh and reopen through MY WORLDS", async ({
  page,
}) => {
  await create(page);
  await page
    .getByRole("button", { name: "Glowing crystal", exact: true })
    .click();
  await expect(page.locator(".world-object")).toHaveCount(1);
  await page.getByLabel("X", { exact: true }).fill("420");
  await page.getByLabel("Size", { exact: true }).fill("1.5");
  await page.getByLabel("Rotation", { exact: true }).fill("45");
  await page.getByLabel("Layer", { exact: true }).fill("4");
  await expect(page.locator(".world-object")).toHaveAttribute(
    "transform",
    /translate\(420 .*rotate\(45\).*scale\(1.5\)/,
  );
  await page
    .getByRole("button", { name: "Delete object", exact: true })
    .click();
  await expect(page.locator(".world-object")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".world-object")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".world-object")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved in this browser.");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Moon Garden", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".world-object")).toHaveAttribute(
    "transform",
    /rotate\(45\).*scale\(1.5\)/,
  );
  await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
  await page.getByRole("button", { name: /Moon Garden/ }).click();
  await expect(
    page.getByLabel("World description", { exact: true }),
  ).toHaveValue("A quiet realm of luminous gardens.");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".object-library")).toHaveCount(0);
  await expect(page.locator(".world-object")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
});
test("drag, keyboard placement, zoom reset and independent multiple worlds", async ({
  page,
}) => {
  await create(page, "First");
  await page.getByRole("button", { name: "Light orb", exact: true }).click();
  const object = page.locator(".world-object"),
    box = (await object.boundingBox())!;
  const before = await object.getAttribute("transform");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 45,
    box.y + box.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(object).not.toHaveAttribute("transform", before!);
  const moved = await object.getAttribute("transform");
  await object.focus();
  await page.keyboard.press("ArrowRight");
  await expect(object).not.toHaveAttribute("transform", moved!);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("120%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await create(page, "Second");
  await expect(page.locator(".world-object")).toHaveCount(0);
  const worlds = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!),
  );
  expect(worlds).toHaveLength(2);
  expect(
    worlds.find((w: { name: string }) => w.name === "First").objects,
  ).toHaveLength(1);
});
test("failed storage cannot enter editor or claim creation success", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await modal(page);
  await page.getByLabel("World Name", { exact: true }).fill("No save");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Not stored");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/Could not (save|confirm cloud save)/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".world-editor")).toHaveCount(0);
});
test("legacy draft remains available without deletion or automatic world creation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "beyond:v1:hidden-world-draft",
      JSON.stringify({ name: "Old draft", description: "Original concept" }),
    ),
  );
  await authorizeLocalAuthor(page);
  await page.goto(route);
  await page
    .getByRole("button", { name: "MY WORLDS", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Old draft", exact: true }).click();
  await expect(page.getByLabel("World Name", { exact: true })).toHaveValue(
    "Old draft",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("beyond:v1:hidden-world-draft"),
    ),
  ).toContain("Original concept");
});
test("mobile touch, Spanish and reduced motion support", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await create(page);
  await page
    .getByRole("button", { name: "Floating island", exact: true })
    .tap();
  await expect(page.locator(".world-object")).toHaveCount(1);
  const object = page.locator(".world-object");
  await object.scrollIntoViewIfNeeded();
  const box = (await object.boundingBox())!;
  const before = await object.getAttribute("transform");
  const session = await context.newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 24, y: y + 18 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(object).not.toHaveAttribute("transform", before!);
  await page.getByLabel("X", { exact: true }).fill("350");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("Spanish modal/editor and focus trap respect reduced motion", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:locale", JSON.stringify("es")),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await modal(page);
  await expect(
    page.getByLabel("Nombre del mundo", { exact: true }),
  ).toBeFocused();
  expect(
    await page
      .locator(".creation-modal")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "Crear mundo", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Crear mundo", exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Nombre del mundo", { exact: true })
    .fill("Jardín lunar");
  await page
    .getByLabel("Descripción del mundo", { exact: true })
    .fill("Un jardín privado entre estrellas.");
  await page
    .locator(".creation-modal form")
    .evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
  await expect(
    page.getByRole("region", { name: "Editor de espíritus" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Espíritu creador", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Guardado en este navegador.",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!).length,
    ),
  ).toBe(1);
});
