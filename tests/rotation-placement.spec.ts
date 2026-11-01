import { test, expect } from "@playwright/test";
import { authorizeLocalAuthor } from "./author-fixture";
test("legacy placement gains independent Euler rotation and restores it after save/reopen", async ({
  page,
}) => {
  await authorizeLocalAuthor(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore?world=realm-hidden-worlds&arrival=direct");
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill("Rotation fixture");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Disposable placement test");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await expect(page.getByLabel("Rotation X", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Rotation Y", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Rotation Z", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0].graph
            .characters.length,
      ),
    )
    .toBe(1);
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
  );
  // A second legacy fixture has its own graph/placement; neither is an actual user record.
  const other = structuredClone(original);
  other.id = "rotation-other-fixture";
  other.name = "Other unchanged world";
  other.graph.characters[0].worldId = other.id;
  other.graph.characters[0].id = crypto.randomUUID();
  await page.evaluate((w) => {
    const worlds = JSON.parse(
      localStorage.getItem("beyond:v1:created-worlds")!,
    );
    worlds.push(w);
    localStorage.setItem("beyond:v1:created-worlds", JSON.stringify(worlds));
  }, other);
  for (const [axis, value] of [
    ["X", "30"],
    ["Y", "-45"],
    ["Z", "60"],
  ])
    await page.getByLabel(`Rotation ${axis}`, { exact: true }).fill(value);
  await expect(page.locator(".spirit-canvas canvas")).toHaveAttribute(
    "data-selected-rotation",
    "0.5236,-0.7854,1.0472",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.reload();
  await page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name: "World Spirit", exact: true })
    .press("Enter");
  for (const [axis, value] of [
    ["X", "30"],
    ["Y", "-45"],
    ["Z", "60"],
  ])
    await expect(
      page.getByLabel(`Rotation ${axis}`, { exact: true }),
    ).toHaveValue(value);
  await expect(page.locator(".spirit-canvas canvas")).toHaveAttribute(
    "data-selected-rotation",
    "0.5236,-0.7854,1.0472",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!),
  );
  const restored = saved.find((w: { id: string }) => w.id === original.id);
  expect(restored.graph.characters[0].position).toEqual(
    original.graph.characters[0].position,
  );
  expect(restored.graph.characters[0].appearance.scale).toBe(
    original.graph.characters[0].appearance.scale,
  );
  expect(saved.find((w: { id: string }) => w.id === other.id)).toEqual(other);
});
