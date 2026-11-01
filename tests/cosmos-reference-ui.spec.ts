import { test, expect } from "@playwright/test";
test("reference artwork and six real toolbar actions remain connected", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1672, height: 940 });
  await page.goto("/explore?world=realm-hidden-worlds&arrival=direct");
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page
    .getByLabel("World Name", { exact: true })
    .fill("Reference UI fixture");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Disposable toolbar verification");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(page.locator(".spirit-canvas canvas")).toHaveAttribute(
    "data-scenery",
    "ready",
  );
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  const toolbar = page.getByRole("navigation", { name: "Cosmos actions" });
  await expect(toolbar.getByRole("button")).toHaveCount(6);
  await expect(page.locator(".cosmos-explore-tip")).toHaveCount(0);
  await expect(page.locator(".editor-header")).toHaveCount(0);
  await expect(page.locator(".editor-footer")).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/beyond-cosmos-reference-ui.png" });
  await toolbar
    .getByRole("button", { name: "Central Library", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload Character", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close central library", exact: true })
    .click();
  await toolbar.getByRole("button", { name: "Save", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("beyond:v1:created-worlds") || "[]")
          .length,
    ),
  ).toBe(1);
  await toolbar.getByRole("button", { name: "Explore", exact: true }).click();
  await toolbar.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Mode", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await toolbar
    .getByRole("button", { name: "Add character", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Close central library", exact: true })
    .click();
  await toolbar
    .getByRole("button", { name: "Connect spirits", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Connect spirits", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
