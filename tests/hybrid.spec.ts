import { test, expect, type Page } from "@playwright/test";
import { authorizeLocalAuthor } from "./author-fixture";
const route = "/explore?world=realm-hidden-worlds&arrival=direct";
async function emptyWorld(
  page: Page,
  motion: "reduce" | "no-preference" = "reduce",
) {
  await page.bringToFront();
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(route);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page
    .getByLabel("World Name", { exact: true })
    .fill("Published Constellation");
  await page
    .getByLabel("World Description", { exact: true })
    .fill("An isolated hybrid exploration fixture.");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(page.locator(".spirit-editor")).toBeVisible({ timeout: 15000 });
}
async function acquire(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Central Library", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: new RegExp(name) }).click();
  await expect(dialog.locator(".upload-preview img")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Add to world", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
test("published-only acquisition, genuine PNG alpha and hybrid exploration survive save/reopen on desktop and mobile", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage();
  try {
    await authorizeLocalAuthor(admin);
    await admin.goto(route);
    const source = await admin.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 240;
      const x = c.getContext("2d")!;
      const gradient = x.createLinearGradient(30, 30, 130, 210);
      gradient.addColorStop(0, "#c3edff");
      gradient.addColorStop(0.45, "#9264dd");
      gradient.addColorStop(1, "#264d9f");
      x.fillStyle = gradient;
      x.beginPath();
      x.moveTo(80, 10);
      x.bezierCurveTo(140, 60, 120, 90, 145, 130);
      x.lineTo(110, 214);
      x.lineTo(80, 230);
      x.lineTo(43, 210);
      x.lineTo(18, 130);
      x.bezierCurveTo(45, 80, 24, 65, 80, 10);
      x.fill();
      x.fillStyle = "#fff8db";
      x.fillRect(55, 94, 12, 8);
      x.fillRect(92, 94, 12, 8);
      return c.toDataURL("image/png").split(",")[1];
    });
    const session = await (
      await admin.request.get("/api/admin/session")
    ).json();
    const publish = async (name: string, active: boolean) => {
      const r = await admin.request.post("/api/admin/library/characters", {
        headers: {
          Origin: "http://127.0.0.1:5178",
          "X-CSRF-Token": session.csrf,
        },
        data: {
          name,
          description: "Isolated published character fixture.",
          type: "portal",
          tags: "fixture",
          source: "",
          active,
          file: { name: "spirit.png", data: source },
        },
      });
      expect(r.status()).toBe(201);
      return (await r.json()).item;
    };
    const published = await publish("Published Aurora", true),
      draft = await publish("Private Aurora", false);
    expect(
      (await page.request.get("/api/public/characters/" + draft.id)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/admin/library/characters", {
          data: { name: "denied" },
        })
      ).status(),
    ).toBe(401);
    await adminContext.close();
    await emptyWorld(page, "no-preference");
    await expect(
      page.getByRole("button", { name: "Upload Character", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "World Spirit", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /CREATE A CHARACTER/ }),
    ).toHaveCount(0);
    await acquire(page, "Published Aurora");
    await acquire(page, "Published Aurora");
    await page.getByLabel("Spirit name", { exact: true }).fill("Second Aurora");
    await page
      .getByLabel("Path target", { exact: true })
      .selectOption({ label: "Published Aurora" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".editor-footer [role=status]")).toHaveText(
      "Saved in this browser.",
    );
    const saved = await page.evaluate(() =>
      localStorage.getItem("beyond:v1:created-worlds"),
    );
    const alpha = await page.evaluate(
      async (url) => {
        const r = await fetch(url),
          bitmap = await createImageBitmap(await r.blob()),
          c = document.createElement("canvas");
        c.width = bitmap.width;
        c.height = bitmap.height;
        const x = c.getContext("2d")!;
        x.drawImage(bitmap, 0, 0);
        const result = [
          x.getImageData(0, 0, 1, 1).data[3],
          x.getImageData(80, 120, 1, 1).data[3],
        ];
        bitmap.close();
        return result;
      },
      published.fileUrl.replace("/admin/library/", "/public/"),
    );
    expect(alpha).toEqual([0, 255]);
    await page
      .getByRole("button", { name: "Explore Mode", exact: true })
      .click();
    const canvas = page.locator(".spirit-canvas canvas");
    await expect(canvas).toHaveAttribute("data-scenery", "ready");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.screenshot({ path: "/tmp/beyond-hybrid-published-1440.png" });
    await page
      .getByRole("navigation", { name: "World characters" })
      .getByRole("button", { name: "Second Aurora", exact: true })
      .press("Enter");
    await page
      .getByRole("button", {
        name: "Related To → Published Aurora",
        exact: true,
      })
      .click();
    await expect(page.locator(".spirit-details h2")).toHaveText(
      "Published Aurora",
    );
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: "/tmp/beyond-hybrid-published-375.png" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("beyond:v1:created-worlds"),
      ),
    ).toBe(saved);
    await expect(page.locator(".spirit-canvas")).not.toHaveAttribute(
      "data-loaded-assets",
      "",
    );
    await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Restore World", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Importing external backups requires administrator access. Existing saved worlds remain available.",
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await adminContext.close();
  }
});
test("unavailable artwork retains real character exploration and reports fallback", async ({
  page,
}) => {
  await authorizeLocalAuthor(page);
  await page.route("**/infinite-cosmos-clean.webp", (r) => r.abort());
  await emptyWorld(page);
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await expect(page.getByLabel("Spirit name", { exact: true })).toHaveValue(
    "World Spirit",
  );
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  await expect(
    page.getByText(
      "Scenery unavailable. Character exploration is still available.",
    ),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name: "World Spirit", exact: true })
    .press("Enter");
  await expect(page.locator(".spirit-details h2")).toHaveText("World Spirit");
});

test("clean reference composition fills desktop and mobile without persistent interface overlays", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await emptyWorld(page, "no-preference");
  await page.getByRole("button", { name: "Explore Mode", exact: true }).click();
  await expect(page.locator(".spirit-canvas canvas")).toHaveAttribute(
    "data-scenery",
    "ready",
  );
  await page.setViewportSize({ width: 1440, height: 810 });
  await expect(page.locator(".editor-header")).toHaveCount(0);
  await expect(page.locator(".editor-footer")).toHaveCount(0);
  await expect(page.locator(".spirit-view-tools")).toHaveCount(0);
  await expect(page.locator(".spirit-edge-access")).toHaveCount(0);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/beyond-cosmos-desktop-a.png" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "/tmp/beyond-cosmos-desktop-b.png" });
  await page.locator(".spirit-canvas").click({ button: "right" });
  await expect(
    page.getByRole("button", { name: "Edit Mode", exact: true }),
  ).toBeVisible();
  await page.locator(".spirit-canvas").click({ button: "right" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/beyond-cosmos-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 160, y: 320 }],
  });
  await page.waitForTimeout(750);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("button", { name: "Edit Mode", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-header")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Edit Mode", exact: true }),
  ).toBeVisible();
  await touch.detach();
  expect(errors).toEqual([]);
});
