import { test, expect, type Page } from "@playwright/test";

async function renderedRegions(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ({ a, b }) => {
      const decode = async (s: string) => {
        const im = new Image();
        im.src = "data:image/png;base64," + s;
        await im.decode();
        return im;
      };
      const first = await decode(a),
        last = await decode(b);
      const canvas = document.createElement("canvas");
      canvas.width = first.width;
      canvas.height = first.height;
      const c = canvas.getContext("2d")!;
      c.drawImage(first, 0, 0);
      const old = c.getImageData(0, 0, canvas.width, canvas.height).data;
      c.drawImage(last, 0, 0);
      const next = c.getImageData(0, 0, canvas.width, canvas.height).data;
      const regions = [];
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) {
          let count = 0,
            changed = 0;
          for (
            let y = Math.floor((row * canvas.height) / 3);
            y < Math.floor(((row + 1) * canvas.height) / 3);
            y++
          )
            for (
              let x = Math.floor((col * canvas.width) / 3);
              x < Math.floor(((col + 1) * canvas.width) / 3);
              x++
            ) {
              const k = (y * canvas.width + x) * 4;
              count++;
              if (
                Math.max(
                  Math.abs(old[k] - next[k]),
                  Math.abs(old[k + 1] - next[k + 1]),
                  Math.abs(old[k + 2] - next[k + 2]),
                ) > 3
              )
                changed++;
            }
          regions.push({ name: `${row},${col}`, ratio: changed / count });
        }
      return regions;
    },
    { a: a.toString("base64"), b: b.toString("base64") },
  );
}
for (const width of [375, 768, 1440])
  test(`composited movement spans all nine regions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    const before = await page.screenshot({ animations: "allow" });
    await page.waitForTimeout(6000);
    const after = await page.screenshot({ animations: "allow" });
    for (const region of await renderedRegions(page, before, after))
      expect(
        region.ratio,
        `region ${region.name} should visibly change, not just the portal`,
      ).toBeGreaterThan(0.01);
    await expect(
      page.getByRole("button", { name: "ENTER THE UNKNOWN", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });

test("depth layers respond by distinct amounts without moving the typography", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForTimeout(1800);
  const initial = await page.locator(".hero-copy").boundingBox();
  await page.mouse.move(50, 50);
  await page.waitForTimeout(500);
  const values = await page.evaluate(() =>
    Object.fromEntries(
      [".hero-art", ".nebula-west", ".nebula-floor"].map((selector) => {
        const matrix = new DOMMatrixReadOnly(
          getComputedStyle(document.querySelector(selector)!).transform,
        );
        return [selector, matrix.m41];
      }),
    ),
  );
  expect(Math.abs(values[".nebula-floor"])).toBeGreaterThan(
    Math.abs(values[".hero-art"]) * 3,
  );
  expect(Math.sign(values[".nebula-west"])).not.toBe(
    Math.sign(values[".hero-art"]),
  );
  expect(await page.locator(".hero-copy").boundingBox()).toEqual(initial);
});

test("unavailable Canvas yields static atmosphere and still permits entry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (type === "2d") return null;
      return (original as any).apply(this, [type, ...args]);
    } as any;
  });
  await page.goto("/");
  await page.waitForTimeout(1800);
  await expect(page.locator(".hero-environment")).toHaveAttribute(
    "data-canvas-unavailable",
    "true",
  );
  expect(
    await page
      .locator(".hero-environment")
      .evaluate((e) => e.getAnimations({ subtree: true }).length),
  ).toBe(0);
  const a = await page.screenshot();
  await page.waitForTimeout(400);
  expect((await page.screenshot()).equals(a)).toBe(true);
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await expect(page).toHaveURL("/explore");
});

test("resize retains one bounded Canvas drawing loop", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__heroDraws = 0;
    const original = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (
      ...args: Parameters<typeof original>
    ) {
      if (this.canvas.className === "living-stars")
        (window as any).__heroDraws++;
      return original.apply(this, args);
    };
  });
  await page.goto("/");
  for (const width of [768, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    expect(
      await page
        .locator(".living-stars")
        .evaluate((el) => (el as HTMLCanvasElement).width),
    ).toBe(width);
  }
  const start = await page.evaluate(() => (window as any).__heroDraws);
  await page.waitForTimeout(1000);
  const frames =
    (await page.evaluate(() => (window as any).__heroDraws)) - start;
  expect(frames).toBeGreaterThan(5);
  expect(frames).toBeLessThan(45);
});
