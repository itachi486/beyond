import { test, expect } from "@playwright/test";

test("actual canvas hover reveals world lettering without a menu/card or camera movement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/explore?view=walk");
  await expect(page.locator(".hub-canvas")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const canvas = page.locator(".hub-canvas canvas"),
    before = await canvas.screenshot({ path: "/tmp/beyond-native-before.png" });
  const coordinates = await page.locator(".hub-coordinates").innerText();
  await page.mouse.move(335, 430);
  await expect(page.locator(".hub-canvas")).toHaveAttribute(
    "data-active-title",
    "realm-what-if",
  );
  await expect(page.locator(".world-title-announcement")).toHaveText(
    "WHAT IF?",
  );
  await page.waitForTimeout(500);
  expect(
    (
      await canvas.screenshot({ path: "test-results/world-title-hover.png" })
    ).equals(before),
  ).toBe(false);
  expect(await page.locator(".hub-coordinates").innerText()).toBe(coordinates);
  await expect(page.locator(".hub-context")).toHaveCount(0);
  expect(
    await page
      .locator(".hub-destinations")
      .evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe("none");
  await page.mouse.move(1400, 150);
  await expect(page.locator(".hub-canvas")).toHaveAttribute(
    "data-active-title",
    "",
  );
  await page.waitForTimeout(500);
  const returned = await canvas.screenshot({
    path: "/tmp/beyond-native-return.png",
  });
  // GPU light-uniform restoration can quantize channels by 1–2 levels; compare decoded pixels.
  const restorationError = await page.evaluate(
    async ({ a, b }) => {
      const decode = async (data: string) => {
        const image = new Image();
        image.src = "data:image/png;base64," + data;
        await image.decode();
        return image;
      };
      const one = await decode(a),
        two = await decode(b),
        c = document.createElement("canvas");
      c.width = one.width;
      c.height = one.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(one, 0, 0);
      const old = ctx.getImageData(0, 0, c.width, c.height).data;
      ctx.drawImage(two, 0, 0);
      const next = ctx.getImageData(0, 0, c.width, c.height).data;
      let error = 0;
      for (let i = 0; i < old.length; i++)
        error = Math.max(error, Math.abs(old[i] - next[i]));
      return error;
    },
    { a: before.toString("base64"), b: returned.toString("base64") },
  );
  expect(restorationError).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("all six world-native names have keyboard focus equivalents and preserve EN/ES", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/explore?view=walk");
  await expect(page.locator(".hub-canvas")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const data = await (await page.request.get("/api/public/universe")).json();
  const coords = await page.locator(".hub-coordinates").innerText();
  for (const world of data.worlds.filter((w: any) => w.hubKey)) {
    await page
      .getByRole("navigation", { name: "Universe destinations" })
      .getByRole("button", { name: world.name.en, exact: true })
      .focus();
    await expect(page.locator(".world-title-announcement")).toHaveText(
      world.name.en,
    );
    await expect(page.locator(".hub-canvas")).toHaveAttribute(
      "data-active-title",
      world.id,
    );
    expect(await page.locator(".hub-coordinates").innerText()).toBe(coords);
  }
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page
    .getByRole("navigation", { name: "Destinos del universo" })
    .getByRole("button", { name: "LA MENTE HUMANA", exact: true })
    .focus();
  await expect(page.locator(".world-title-announcement")).toHaveText(
    "LA MENTE HUMANA",
  );
  await page.screenshot({ path: "test-results/world-title-spanish.png" });
  expect(await page.locator(".hub-coordinates").innerText()).toBe(coords);
});

test.describe("touch world lettering", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 900 } });
  test("tapping an actual landmark reveals its name and retains destination entry", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() =>
      localStorage.setItem("beyond:v1:tutorial", "true"),
    );
    await page.goto("/explore?view=walk");
    await expect(page.locator(".hub-canvas")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.waitForTimeout(400);
    const hotspot = page
      .getByRole("navigation", { name: "Universe destinations" })
      .getByRole("button", { name: "HIDDEN WORLDS", exact: true });
    const b = await hotspot.boundingBox();
    expect(b).not.toBeNull();
    // Hotspots are keyboard-only (pointer-events:none); touch goes to the WebGL canvas.
    await page.touchscreen.tap(b!.x + b!.width / 2, b!.y + b!.height / 2);
    await expect(page.locator(".world-title-announcement")).toHaveText(
      "HIDDEN WORLDS",
    );
    await expect(
      page.getByRole("button", { name: "Open discoveries", exact: false }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/world-title-touch.png" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});
