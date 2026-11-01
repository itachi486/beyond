import { test, expect } from "@playwright/test";

for (const [route, coordinates] of [
  ["/explore?view=walk", ".hub-coordinates"],
  ["/worlds/archive", ".coordinates"],
]) {
  test(`movement pad stops when keyboard focus leaves ${route}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() =>
      localStorage.setItem("beyond:v1:tutorial", "true"),
    );
    await page.goto(route);
    await expect(page.locator("canvas")).toBeVisible();
    if (route.startsWith("/explore"))
      await expect(page.locator(".hub-canvas")).toHaveAttribute(
        "data-ready",
        "true",
      );
    const forward = page.getByRole("button", {
      name: "Move forward",
      exact: true,
    });
    await forward.focus();
    const before = await page.locator(coordinates).innerText();
    await page.keyboard.down("Enter");
    await expect
      .poll(() => page.locator(coordinates).innerText())
      .not.toBe(before);
    // Release occurs on the next control after Tab, not on the original button.
    await page.keyboard.press("Tab");
    await page.keyboard.up("Enter");
    await page.waitForTimeout(450);
    const stopped = await page.locator(coordinates).innerText();
    await page.waitForTimeout(650);
    expect(await page.locator(coordinates).innerText()).toBe(stopped);
  });
}

test("Spanish hub movement labels reuse the translated controls at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("beyond:v1:tutorial", "true");
    localStorage.setItem("beyond:v1:locale", JSON.stringify("es"));
  });
  await page.goto("/explore?view=walk");
  const controls = page.getByRole("group", { name: "Controles de movimiento" });
  for (const name of [
    "Avanzar",
    "Mover a la izquierda",
    "Retroceder",
    "Mover a la derecha",
  ])
    await expect(
      controls.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
