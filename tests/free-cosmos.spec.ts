import { test, expect } from "@playwright/test";
import { authorizeLocalAuthor } from "./author-fixture";
async function open(page: import("@playwright/test").Page) {
  await authorizeLocalAuthor(page);
  await page.goto("/explore?world=realm-hidden-worlds&arrival=direct");
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page
    .getByLabel("World Name", { exact: true })
    .fill("3D flight fixture");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Isolated 3D verification");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await page.getByLabel("Rotation Z", { exact: true }).fill("35");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  await expect(page.locator(".spirit-canvas canvas")).toHaveAttribute(
    "data-projection",
    "perspective",
  );
}
test("real perspective flight rotates/translates without modifying saved placement; six actions and selection survive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 810 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const canvas = page.locator(".spirit-canvas canvas"),
    toolbar = page.getByRole("navigation", { name: "Cosmos actions" });
  await expect(toolbar.getByRole("button")).toHaveCount(6);
  await expect(page.locator("button:visible")).toHaveCount(6);
  await expect(
    page.locator(".site-header, .spirit-details, .spirit-anchors"),
  ).toHaveCount(0);
  const before = await page.evaluate(() =>
    localStorage.getItem("beyond:v1:created-worlds"),
  );
  const initial = (await canvas.getAttribute("data-flight"))!
    .split(",")
    .map(Number);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 400, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 530, box.y + 430, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number((await canvas.getAttribute("data-flight"))!.split(",")[3]),
    )
    .not.toBe(initial[3]);
  const turned = await canvas.getAttribute("data-flight");
  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");
  await expect.poll(() => canvas.getAttribute("data-flight")).not.toBe(turned);
  const moved = await canvas.getAttribute("data-flight");
  await page.keyboard.down("e");
  await page.waitForTimeout(250);
  await page.keyboard.up("e");
  await expect.poll(() => canvas.getAttribute("data-flight")).not.toBe(moved);
  await toolbar.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator("button:visible")).toHaveCount(6);
  await page.screenshot({ path: "/tmp/beyond-only-six-buttons.png" });
  await toolbar.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name: "World Spirit", exact: true })
    .press("Enter");
  await expect(page.locator(".spirit-details h2")).toHaveText("World Spirit");
  expect(
    await page.evaluate(() => localStorage.getItem("beyond:v1:created-worlds")),
  ).toBe(before);
  expect(
    Number(await canvas.getAttribute("data-space-objects")),
  ).toBeGreaterThan(15);
  expect(errors).toEqual([]);
});
test("375px touch look and two-finger travel work with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const canvas = page.locator(".spirit-canvas canvas"),
    cdp = await page.context().newCDPSession(page);
  const before = await canvas.getAttribute("data-flight");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 160, y: 400 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 220, y: 430 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(() => canvas.getAttribute("data-flight")).not.toBe(before);
  const looked = await canvas.getAttribute("data-flight");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 100, y: 400 },
      { x: 250, y: 400 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 90, y: 400 },
      { x: 260, y: 400 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 60, y: 400 },
      { x: 290, y: 400 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(() => canvas.getAttribute("data-flight")).not.toBe(looked);
  await page.screenshot({ path: "/tmp/beyond-free-cosmos-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await cdp.detach();
});
