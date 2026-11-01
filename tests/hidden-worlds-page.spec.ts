import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const route = "/explore?world=realm-hidden-worlds&arrival=direct";
test("exact original artwork and four independent regions with honest functional panels", async ({
  page,
  request,
}) => {
  await page.goto(route);
  await expect(page.locator(".hidden-artboard img")).toBeVisible();
  const res = await request.get("/hidden-worlds-reference.png");
  expect(
    createHash("sha256")
      .update(await res.body())
      .digest("hex"),
  ).toBe(
    createHash("sha256")
      .update(
        readFileSync(
          "/home/administrator/internet_project/img/Hidden Worlds_ Floating Realms.png",
        ),
      )
      .digest("hex"),
  );
  await expect(page.locator(".hidden-hit-map [role=button]")).toHaveCount(4);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill("Local test idea");
  await page
    .getByLabel("World Description")
    .fill("A private browser-only draft.");
  await page.getByRole("button", { name: "Create World" }).click();
  await expect(page.locator(".spirit-editor")).toBeVisible();
  await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
  await page.goto(route);
  await page
    .getByRole("button", { name: "MY WORLDS", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: /Local test idea/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "CONNECT", exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toContainText("not available yet");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "EXPLORE", exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toContainText(
    "published public content",
  );
});
for (const width of [375, 768, 1440])
  test(`responsive image regions and reduced motion at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await expect(page.locator(".hidden-artboard img")).toBeVisible();
    if (width < 900)
      await page.getByRole("button", { name: "View whole image" }).click();
    const box = (await page.locator(".hidden-artboard").boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1.5, 2);
    await page
      .getByRole("button", { name: "CREATE", exact: true })
      .press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("Canvas motion changes over time and reduced motion stops it", async ({
  page,
}) => {
  await page.goto(route);
  const c = page.locator(".hidden-artboard canvas");
  await expect(c).toBeVisible();
  await page.waitForTimeout(300);
  const pixels = () =>
    c.evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
      return hash >>> 0;
    });
  const first = await pixels();
  await page.waitForTimeout(500);
  expect(await pixels()).not.toBe(first);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  const still = await pixels();
  await page.waitForTimeout(500);
  expect(await pixels()).toBe(still);
});

test("blocked local storage reports a save error", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("disabled storage");
    };
  });
  await page.goto(route);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill("Not saved");
  await page.getByLabel("World Description").fill("Must not claim success");
  await page.getByRole("button", { name: "Create World" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await expect(page.getByRole("status")).toHaveCount(0);
});
