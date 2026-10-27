import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1440])
  test(`one entry at ${width}: no hidden menu world picker`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "ENTER THE UNKNOWN", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Explore", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Bookmarks", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(".world-picker,.world-pill,.scroll-hint,.portal-nav"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Choose a world" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Your trail", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("dialog")
        .locator("button")
        .filter({
          hasText: /The Archive|The Elsewhere|The Unsolved|The Natural World/,
        }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page).toHaveURL("/");
  });

test("living stars, portal energy, pointer depth and keyboard single entry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.waitForTimeout(1300);
  const first = await page.locator(".living-stars").screenshot();
  await page.waitForTimeout(800);
  expect((await page.locator(".living-stars").screenshot()).equals(first)).toBe(
    false,
  );
  const animations = await page.locator(".hero-environment").evaluate((el) =>
    el.getAnimations({ subtree: true }).map((a) => ({
      state: a.playState,
      duration: a.effect?.getTiming().duration,
    })),
  );
  expect(
    animations.filter((a) => a.state === "running").length,
  ).toBeGreaterThanOrEqual(5);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(300);
  expect(
    await page
      .locator(".hero-environment")
      .evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue("--depth-x")),
      ),
  ).not.toBe(0);
  const cta = page.getByRole("button", {
    name: "ENTER THE UNKNOWN",
    exact: true,
  });
  await cta.focus();
  const initial = await page.evaluate(() => history.length);
  await page.keyboard.press("Enter");
  await expect(cta).toBeDisabled();
  await page.evaluate(() => {
    const b = document.querySelector<HTMLButtonElement>(".entrance-cta");
    b?.click();
    b?.click();
  });
  await expect(page).toHaveURL("/explore");
  await expect(
    page.getByRole("button", { name: "Start exploring", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);
  await page.goBack();
  await expect(page).toHaveURL("/");
  await page.waitForTimeout(1100);
  await expect(page).toHaveURL("/");
});

test("static reduced-motion and saved preference still enter even with animations unavailable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stars = await page.locator(".living-stars").screenshot();
  await page.waitForTimeout(450);
  expect((await page.locator(".living-stars").screenshot()).equals(stars)).toBe(
    true,
  );
  expect(
    await page
      .locator(".hero-environment")
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.addStyleTag({
    content: "*{animation:none!important;transition:none!important}",
  });
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await expect(page).toHaveURL("/explore");
  await page
    .getByRole("button", { name: "Start exploring", exact: true })
    .click();
  await page.getByRole("button", { name: "BEYOND", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByLabel("Reduce motion").check();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.locator("main")).toHaveClass(/low-motion/);
  await expect(
    page.getByRole("button", { name: "ENTER THE UNKNOWN" }),
  ).toBeEnabled();
});

test("Back interrupts entry without delayed reroute and disabled CSS is not a dead end", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/worlds/natural");
  await page.getByRole("button", { name: "BEYOND", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await page.goBack();
  await expect(page).toHaveURL("/worlds/natural");
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL("/worlds/natural");
  await page.getByRole("button", { name: "BEYOND", exact: true }).click();
  await page.addStyleTag({
    content: "*{animation:none!important;transition:none!important}",
  });
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await expect(page).toHaveURL("/explore");
});

test("Canvas/WebGL failure and hidden-tab interruption preserve access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (type === "2d" || String(type).includes("webgl")) return null;
      return (orig as any).apply(this, [type, ...args]);
    } as any;
    localStorage.setItem("beyond:v1:tutorial", "true");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page).toHaveURL("/explore");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  await expect(
    page.getByText("3D is unavailable.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /The Archive/ })
    .click();
  await page
    .getByRole("button", { name: /01.*A day longer than a year/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A day longer than a year",
      exact: true,
    }),
  ).toBeVisible();
});

test("landing frame loop stops on unmount and restarts on return", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__heroDraws = 0;
    const orig = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (
      ...args: Parameters<typeof orig>
    ) {
      if (this.canvas.className === "living-stars")
        (window as any).__heroDraws++;
      return orig.apply(this, args);
    };
    localStorage.setItem("beyond:v1:tutorial", "true");
  });
  await page.goto("/");
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => (window as any).__heroDraws),
  ).toBeGreaterThan(1);
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await expect(page).toHaveURL("/explore");
  await page.waitForTimeout(250);
  const count = await page.evaluate(() => (window as any).__heroDraws);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).__heroDraws)).toBe(count);
  await page.getByRole("button", { name: "BEYOND", exact: true }).click();
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => (window as any).__heroDraws),
  ).toBeGreaterThan(count);
});

test.describe("landing touch", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
  test("Spanish touch entry keeps the single entry policy", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("es");
    await expect(
      page.getByRole("button", { name: "Explorar", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "ENTRA EN LO DESCONOCIDO", exact: true })
      .tap();
    await expect(page).toHaveURL("/explore");
    await page
      .getByRole("button", { name: "Comenzar a explorar", exact: true })
      .tap();
    await expect(
      page.getByRole("heading", {
        name: "Seis mundos. Nuevas conexiones.",
        exact: true,
      }),
    ).toBeVisible();
  });
});

test("system reduced motion overrides an older saved false setting and interrupts an active entrance", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:reduced", "false"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveClass(/low-motion/);
  const still = await page.locator(".living-stars").screenshot();
  await page.waitForTimeout(200);
  expect((await page.locator(".living-stars").screenshot()).equals(still)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByLabel("Reduce motion")).toBeChecked();
  await expect(page.getByLabel("Reduce motion")).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("main")).not.toHaveClass(/low-motion/);
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page).toHaveURL("/explore", { timeout: 600 });
});

test("system motion can resume without reload when no explicit saved preference exists", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveClass(/low-motion/);
  expect(
    await page.evaluate(() => localStorage.getItem("beyond:v1:reduced")),
  ).toBe(null);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("main")).not.toHaveClass(/low-motion/);
  expect(
    await page
      .locator(".hero-environment")
      .evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
  ).toBeGreaterThan(0);
  const still = await page.locator(".living-stars").screenshot();
  await page.waitForTimeout(450);
  expect((await page.locator(".living-stars").screenshot()).equals(still)).toBe(
    false,
  );
});

test("explicit saved reduced motion stays enabled after system motion resumes", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:reduced", "true"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("main")).toHaveClass(/low-motion/);
  expect(
    await page
      .locator(".hero-environment")
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
});
