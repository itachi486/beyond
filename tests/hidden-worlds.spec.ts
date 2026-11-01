import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  test(`garden textures, approach, movement and panel return at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() =>
      localStorage.setItem("beyond:v1:tutorial", "true"),
    );
    const errors: string[] = [];
    const assets = new Set<string>();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.url().includes("/assets/hidden-worlds/") && r.status() === 200)
        assets.add(new URL(r.url()).pathname);
    });
    await page.goto("/explore?view=walk");
    await expect(page.locator(".hub-canvas canvas")).toBeVisible();
    await expect(page.locator(".hub-canvas")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect.poll(() => assets.size).toBe(width < 700 ? 2 : 3);
    const initial = await page.locator(".hub-coordinates").innerText();
    await page
      .getByRole("navigation", { name: "Universe destinations" })
      .getByRole("button", { name: "HIDDEN WORLDS", exact: true })
      .press("Enter");
    await expect(
      page.getByRole("heading", { name: "HIDDEN WORLDS", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.locator(".hub-coordinates").innerText())
      .not.toBe(initial);
    const before = await page.locator(".hub-coordinates").innerText();
    await page
      .getByRole("button", { name: "Open discoveries", exact: false })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "No discoveries published",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    expect(await page.locator(".hub-coordinates").innerText()).toBe(before);
    await page.screenshot({ path: `test-results/hidden-worlds-${width}.png` });
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await expect
      .poll(() => page.locator(".hub-coordinates").innerText())
      .not.toBe(before);
    await expect(page.locator(".hub-destinations button")).toHaveCount(6);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("missing texture maps retain navigable geometry and the accessible empty state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("beyond:v1:tutorial", "true");
    localStorage.setItem("beyond:v1:reduced", "true");
  });
  await page.route("**/assets/hidden-worlds/*.jpg", (r) => r.abort());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/explore?view=walk");
  await expect(page.locator(".hub-canvas canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "HIDDEN WORLDS", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "HIDDEN WORLDS", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open discoveries", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No discoveries published",
  );
  expect(errors).toEqual([]);
});

test("garden has rendered time-based motion and becomes static under reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/explore?view=walk");
  await page
    .getByRole("button", { name: "HIDDEN WORLDS", exact: true })
    .press("Enter");
  let previous = "",
    stable = 0;
  await expect
    .poll(
      async () => {
        const current = await page.locator(".hub-coordinates").innerText();
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable >= 3 && !current.startsWith("0.0 /");
      },
      { timeout: 20000, intervals: [400] },
    )
    .toBe(true);
  const coordinates = await page.locator(".hub-coordinates").innerText();
  const clip = { x: 700, y: 350, width: 350, height: 400 };
  const first = await page.screenshot({ clip });
  await page.waitForTimeout(1400);
  expect((await page.screenshot({ clip })).equals(first)).toBe(false);
  expect(await page.locator(".hub-coordinates").innerText()).toBe(coordinates);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("main")).toHaveClass(/low-motion/);
  await expect(page.locator(".hub-canvas")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForTimeout(1700);
  await page.waitForLoadState("networkidle");
  const reduced = await page.screenshot({
    clip,
    path: "/tmp/beyond-hidden-reduced-a.png",
  });
  await page.waitForTimeout(900);
  expect(
    (
      await page.screenshot({ clip, path: "/tmp/beyond-hidden-reduced-b.png" })
    ).equals(reduced),
  ).toBe(true);
});

test("reduced-motion hub stops GPU draws when idle and redraws for direct movement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("beyond:v1:tutorial", "true");
    (window as any).hubDrawCalls = 0;
    for (const name of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const prototype = WebGL2RenderingContext.prototype as any;
      const original = prototype[name];
      prototype[name] = function (...args: any[]) {
        (window as any).hubDrawCalls++;
        return original.apply(this, args);
      };
    }
  });
  await page.goto("/explore?view=walk");
  await expect(page.locator(".hub-canvas")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const draws = await page.evaluate(() => (window as any).hubDrawCalls);
  expect(draws).toBeGreaterThan(0);
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => (window as any).hubDrawCalls)).toBe(draws);
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => (window as any).hubDrawCalls))
    .toBeGreaterThan(draws);
  await page.keyboard.up("w");
  await page.waitForTimeout(400);
  const stopped = await page.evaluate(() => (window as any).hubDrawCalls);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).hubDrawCalls)).toBe(stopped);
});
