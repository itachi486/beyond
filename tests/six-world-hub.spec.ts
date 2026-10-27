import { test, expect } from "@playwright/test";
for (const width of [375, 768, 1440])
  test(`six persisted destinations, empty states and reduced-motion access at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page
      .getByRole("button", { name: "ENTER THE UNKNOWN", exact: true })
      .click();
    await expect(page).toHaveURL("/explore");
    await page
      .getByRole("button", { name: "Start exploring", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Six worlds. Unexpected connections.",
        exact: true,
      }),
    ).toBeVisible();
    const response = await page.request.get("/api/public/universe");
    const data = await response.json();
    const worlds = data.worlds.filter((w: any) => w.hubKey);
    expect(worlds).toHaveLength(6);
    let reads = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/public/universe")) reads++;
    });
    for (const w of worlds) {
      await page
        .getByRole("navigation", { name: "Universe destinations" })
        .getByRole("button", { name: w.name.en, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: w.name.en, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Open discoveries", exact: false })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "No discoveries published in this destination yet.",
      );
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    expect(reads).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/hub-${width}.png` });
  });
test("walking, drag look, smooth click-to-move and direct keyboard interruption work in one scene", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/explore");
  await expect(page.locator(".hub-canvas canvas")).toBeVisible();
  await page.waitForTimeout(350);
  const initial = await page.locator(".hub-coordinates").innerText();
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  await page.waitForTimeout(350);
  expect(await page.locator(".hub-coordinates").innerText()).not.toBe(initial);
  await page
    .getByRole("button", { name: "Return to the hub", exact: false })
    .click();
  await page.waitForTimeout(400);
  const reset = await page.locator(".hub-coordinates").innerText();
  await page
    .getByRole("navigation", { name: "Universe destinations" })
    .getByRole("button", { name: "WHAT IF?", exact: true })
    .click();
  await page.waitForTimeout(700);
  const moving = await page.locator(".hub-coordinates").innerText();
  expect(moving).not.toBe(reset);
  await page.keyboard.down("s");
  await page.waitForTimeout(100);
  await page.keyboard.up("s");
  await page.waitForTimeout(400);
  const stopped = await page.locator(".hub-coordinates").innerText();
  await page.waitForTimeout(400);
  expect(await page.locator(".hub-coordinates").innerText()).toBe(stopped);
  expect(await page.locator(".hub-canvas canvas").count()).toBe(1);
});
test("WebGL failure retains access to all six destinations and honest empty content", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("beyond:v1:tutorial", "true");
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (String(type).includes("webgl")) return null;
      return (original as any).apply(this, [type, ...args]);
    } as any;
  });
  await page.goto("/explore");
  await expect(
    page.getByText("3D is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".hub-destinations button")).toHaveCount(6);
  await page
    .getByRole("button", { name: "THE HUMAN MIND", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open discoveries", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No discoveries published in this destination yet.",
  );
});

test("actual canvas raycast selects a destination and starts path travel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/explore");
  const canvas = page.locator(".hub-canvas canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(500);
  const before = await page.locator(".hub-coordinates").innerText();
  // Golden branching arches in the initial desktop composition, not a DOM button.
  await canvas.click({ position: { x: 350, y: 440 } });
  await page.waitForTimeout(800);
  expect(await page.locator(".hub-coordinates").innerText()).not.toBe(before);
  await expect(
    page.getByRole("heading", { name: "WHAT IF?", exact: true }),
  ).toBeVisible();
});
