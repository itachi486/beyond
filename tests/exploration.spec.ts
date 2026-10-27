import { test, expect } from "@playwright/test";
async function dismiss(page: import("@playwright/test").Page) {
  const start = page.getByRole("button", {
    name: "Start exploring",
    exact: true,
  });
  if (await start.isVisible()) await start.click();
}
test("English threshold enters real 3D, worlds and discovery connections", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "THE INTERNET IS BIGGER THAN YOU IMAGINE.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ENTER THE UNKNOWN" }).click();
  await expect(page).toHaveURL(/worlds\/archive/);
  await dismiss(page);
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: /01.*A day longer than a year/ })
    .click();
  await expect(page).toHaveURL(/discoveries\/a-day-longer-than-a-year/);
  await expect(
    page.getByRole("heading", {
      name: "A day longer than a year",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /The Archive.*Worlds around other suns/ })
    .click();
  await expect(page).toHaveURL(/worlds-around-other-suns/);
  await page.goBack();
  await expect(
    page.getByRole("heading", {
      name: "A day longer than a year",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/worlds\/archive/);
  for (const name of ["The Elsewhere", "The Unsolved", "The Natural World"]) {
    await page.getByRole("button", { name, exact: false }).last().click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("bookmarks, history, language and shared paths persist", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/discoveries/an-ocean-under-ice");
  await page.getByRole("button", { name: "Bookmark", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Bookmarks", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: /An ocean under ice/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Bookmarks", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /An ocean under ice/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Bookmarked", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/worlds\/unsolved/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await expect(
    page.getByRole("heading", { name: "Lo Inexplorado" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Idioma", { exact: true })).toHaveValue("es");
  await page.getByRole("button", { name: "Tu recorrido", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: /Un océano bajo el hielo/ }),
  ).toBeVisible();
});
test("keyboard movement is controlled and drag changes look without automatic rotation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/worlds/archive");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(700);
  const before = await page.locator(".coordinates").innerText();
  await page.keyboard.down("w");
  await page.waitForTimeout(1200);
  await page.keyboard.up("w");
  await page.waitForTimeout(600);
  expect(await page.locator(".coordinates").innerText()).not.toBe(before);
  const stable = await page.locator(".coordinates").innerText();
  await page.waitForTimeout(800);
  expect(await page.locator(".coordinates").innerText()).toBe(stable);
  const beforeDrag = await page.locator("canvas").screenshot();
  await page.waitForTimeout(300);
  expect((await page.locator("canvas").screenshot()).equals(beforeDrag)).toBe(
    true,
  );
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await page.mouse.move(850, 430, { steps: 8 });
  await page.mouse.up();
  expect((await page.locator("canvas").screenshot()).equals(beforeDrag)).toBe(
    false,
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Return to arrival point" }).click();
  await page.waitForTimeout(600);
  expect(await page.locator(".coordinates").innerText()).toContain("0° / 19°");
});
for (const width of [375, 768, 1440])
  test(`responsive ${width}, full translated UI and reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "ENTER THE UNKNOWN" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Language", { exact: true }).selectOption("es");
    await expect(
      page.getByRole("heading", {
        name: "INTERNET ES MÁS GRANDE DE LO QUE IMAGINAS.",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ENTRA EN LO DESCONOCIDO" }).click();
    await page
      .getByRole("button", { name: "Comenzar a explorar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "El Archivo", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/world-${width}.png` });
  });
test("WebGL failure and malformed storage still provide every discovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("beyond:v1:bookmarks", "{broken");
    localStorage.setItem("beyond:v1:tutorial", "true");
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (String(type).includes("webgl")) return null;
      return (orig as any).apply(this, [type, ...args]);
    } as any;
  });
  await page.goto("/worlds/natural");
  await expect(
    page.getByText("3D is unavailable.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /01.*The animals that build reefs/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "The animals that build reefs",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "The Elsewhere", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Elsewhere", exact: true }),
  ).toBeVisible();
});
test("unknown destination is recoverable and unsupported languages are honest", async ({
  page,
}) => {
  await page.goto("/discoveries/no-such-place");
  await expect(
    page.getByRole("heading", { name: "This path has not been charted." }),
  ).toBeVisible();
  await expect(page.locator('option[value="ja"]')).toHaveAttribute(
    "disabled",
    "",
  );
  await page.getByRole("button", { name: "Find another path" }).click();
  await expect(page).toHaveURL(/worlds\/archive/);
});
test("raycast discovery and world portals work on the actual canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/worlds/archive");
  await expect(page.locator("canvas")).toBeVisible();
  await page.mouse.click(550, 450);
  await expect(page).toHaveURL(/discoveries\/a-day-longer-than-a-year/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.mouse.click(720, 450);
  await expect(page).toHaveURL(/worlds\/unsolved/);
  await expect(
    page.getByRole("heading", { name: "The Unsolved", exact: true }),
  ).toBeVisible();
});
test("sharing copies the stable destination URL", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() =>
    localStorage.setItem("beyond:v1:tutorial", "true"),
  );
  await page.goto("/discoveries/cities-inside-stone");
  await page.getByRole("button", { name: "Copy discovery link" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Link copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "/discoveries/cities-inside-stone",
  );
  await page.getByRole("dialog").getByRole("combobox").selectOption("es");
  await expect(
    page.getByRole("heading", { name: "Ciudades dentro de la piedra" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/discoveries\/cities-inside-stone/);
});
test.describe("touch exploration", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
  test("touch controls, discovery panel and focus containment", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("beyond:v1:tutorial", "true"),
    );
    await page.goto("/worlds/natural");
    await expect(
      page.getByRole("button", { name: "Move forward" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /01.*The animals that build reefs/ })
      .tap();
    await expect(
      page.getByRole("heading", {
        name: "The animals that build reefs",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page).toHaveURL(/worlds\/natural/);
  });
});
