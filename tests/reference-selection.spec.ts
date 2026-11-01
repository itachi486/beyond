import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const landmarks = [
  ["realm-what-if", 0.12, 0.49],
  ["realm-human-mind", 0.326, 0.385],
  ["realm-unsolved", 0.491, 0.38],
  ["realm-hidden-worlds", 0.656, 0.45],
  ["realm-your-future", 0.869, 0.32],
  ["realm-never-knew", 0.867, 0.78],
] as const;
async function ready(page: import("@playwright/test").Page) {
  await page.goto("/explore");
  await expect(page.locator(".selection-reference")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".selection-reference")
        .evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth === 1672,
        ),
    )
    .toBe(true);
  await page.waitForLoadState("networkidle");
}
async function point(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
) {
  const b = (await page.locator(".selection-artboard").boundingBox())!;
  return { x: b.x + b.width * x, y: b.y + b.height * y };
}

test("exact supplied image and all six landmark hit areas, with hidden default names", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  const image = await request.get("/world-selection-reference.png");
  expect(
    createHash("sha256")
      .update(await image.body())
      .digest("hex"),
  ).toBe("d095af9596cf7113fda670a8e844d44f019d57dc47e46013108cb1c6b5794eee");
  await expect(page.locator(".hub-canvas")).toHaveCount(0);
  await expect(page.locator(".reference-selection")).toHaveAttribute(
    "data-active-world",
    "",
  );
  await expect(page.locator(".selection-hit-map [role=button]")).toHaveCount(6);
  await expect(page.locator(".selection-hit-map text")).toHaveCount(0);
  for (const [id, x, y] of landmarks) {
    const p = await point(page, x, y);
    await page.mouse.move(p.x, p.y);
    await expect(page.locator(".reference-selection")).toHaveAttribute(
      "data-active-world",
      id,
    );
  }
  await page.mouse.move(720, 65);
  await expect(page.locator(".reference-selection")).toHaveAttribute(
    "data-active-world",
    "",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("real ambient frames, stronger hover formation and graceful exit are rendered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  await page.waitForTimeout(500);
  const initial = await page.locator(".selection-effects").screenshot();
  await page.waitForTimeout(850);
  expect(
    (await page.locator(".selection-effects").screenshot()).equals(initial),
  ).toBe(false);
  for (const [id, x, y] of landmarks.filter((l) =>
    ["realm-hidden-worlds", "realm-human-mind", "realm-what-if"].includes(l[0]),
  )) {
    const p = await point(page, x, y);
    await page.mouse.move(p.x, p.y);
    await expect(page.locator(".reference-selection")).toHaveAttribute(
      "data-active-world",
      id,
    );
    await page.waitForTimeout(180);
    const forming = await page.locator(".selection-effects").screenshot();
    await page.waitForTimeout(1100);
    expect(
      (await page.locator(".selection-effects").screenshot()).equals(forming),
    ).toBe(false);
    await page.screenshot({ path: `test-results/reference-hover-${id}.png` });
  }
  await page.mouse.move(720, 65);
  await expect(page.locator(".reference-selection")).toHaveAttribute(
    "data-active-world",
    "",
  );
  await expect(page.locator(".hub-context")).toHaveCount(0);
});

test("click transition chooses an existing destination once despite repeated activation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await ready(page);
  const p = await point(page, 0.656, 0.45);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".reference-selection")).toHaveAttribute(
    "data-pending-world",
    "realm-hidden-worlds",
  );
  const second = await point(page, 0.326, 0.385);
  await page.mouse.click(second.x, second.y);
  await expect(page).toHaveURL(/\/explore\?world=realm-hidden-worlds/);
  await expect(page.locator(".hidden-artboard img")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "EXPLORE", exact: true }),
  ).toBeVisible();
});

test("keyboard names translate and reduced motion has stable frames without removing entry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  const canvas = page.locator(".selection-effects"),
    initial = await canvas.screenshot();
  await page.waitForTimeout(500);
  expect((await canvas.screenshot()).equals(initial)).toBe(true);
  const button = page.getByRole("button", {
    name: "THE HUMAN MIND",
    exact: true,
  });
  await button.focus();
  await expect(page.locator(".reference-selection")).toHaveAttribute(
    "data-active-world",
    "realm-human-mind",
  );
  const highlighted = await canvas.screenshot();
  expect(highlighted.equals(initial)).toBe(false);
  await page.waitForTimeout(600);
  expect((await canvas.screenshot()).equals(highlighted)).toBe(true);
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page
    .getByRole("button", { name: "LA MENTE HUMANA", exact: true })
    .focus();
  await page
    .getByRole("button", { name: "LA MENTE HUMANA", exact: true })
    .press("Enter");
  await expect(page).toHaveURL(/world=realm-human-mind/);
});

test("missing Canvas retains original art, SVG name fallback and navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("beyond:v1:tutorial", "true");
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      return type === "2d"
        ? null
        : (original as any).apply(this, [type, ...args]);
    } as any;
  });
  await ready(page);
  await page.getByRole("button", { name: "WHAT IF?", exact: true }).focus();
  await expect(page.locator(".selection-fallback-title")).toHaveText(
    "WHAT IF?",
  );
  await page
    .getByRole("button", { name: "WHAT IF?", exact: true })
    .press("Enter");
  await expect(page).toHaveURL(/world=realm-what-if/);
});

test.describe("mobile selection", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 900 } });
  test("panorama keeps image ratio and overview exposes all six before touch entry", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("beyond:v1:tutorial", "true"),
    );
    await ready(page);
    expect(
      await page
        .locator(".selection-panorama")
        .evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "View whole world" }).tap();
    const box = (await page.locator(".selection-artboard").boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1672 / 941, 2);
    const p = await point(page, 0.656, 0.45);
    await page.touchscreen.tap(p.x, p.y);
    await expect(page.locator(".reference-selection")).toHaveAttribute(
      "data-pending-world",
      "realm-hidden-worlds",
    );
    await page.screenshot({
      path: "test-results/reference-mobile-activation.png",
    });
    await expect(page).toHaveURL(/world=realm-hidden-worlds/);
  });
});

test("browser Back cancels a pending world activation instead of navigating later", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "ENTER THE UNKNOWN", exact: true })
    .click();
  await expect(page).toHaveURL("/explore");
  await expect(page.locator(".selection-reference")).toBeVisible();
  const p = await point(page, 0.12, 0.49);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".reference-selection")).toHaveAttribute(
    "data-pending-world",
    "realm-what-if",
  );
  await page.goBack();
  await expect(page).toHaveURL("/");
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL("/");
});

for (const [id, x, y] of landmarks) {
  test(`actual landmark click enters existing destination ${id}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() =>
      localStorage.setItem("beyond:v1:tutorial", "true"),
    );
    await ready(page);
    const p = await point(page, x, y);
    await page.mouse.click(p.x, p.y);
    await expect(page).toHaveURL(new RegExp(`world=${id}.*arrival=direct`));
    if (id === "realm-hidden-worlds") {
      await expect(page.locator(".hidden-artboard img")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "EXPLORE", exact: true }),
      ).toBeVisible();
    } else {
      await expect(page.locator(".hub-canvas canvas")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open discoveries", exact: false }),
      ).toBeVisible();
    }
  });
}
