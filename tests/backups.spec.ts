import { authorizeLocalAuthor } from "./author-fixture";
import { test, expect, type Page } from "@playwright/test";
const route = "/explore?world=realm-hidden-worlds&arrival=direct";
async function world(page: Page, name = "Upload world") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authorizeLocalAuthor(page);
  await page.goto(route);
  await page
    .getByRole("button", { name: "CREATE", exact: true })
    .press("Enter");
  await page.getByLabel("World Name", { exact: true }).fill(name);
  await page
    .getByLabel("World Description", { exact: true })
    .fill("Imported character test.");
  await page.getByRole("button", { name: "Create World", exact: true }).click();
  await expect(page.locator(".spirit-editor")).toBeVisible();
}
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Upload Character", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function image(page: Page, type = "image/png") {
  return Buffer.from(
    await page.evaluate((type) => {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 48;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#83d9de";
      ctx.fillRect(8, 8, 16, 32);
      return c.toDataURL(type).split(",")[1];
    }, type),
    "base64",
  );
}
function geometry() {
  const binary = Buffer.alloc(44);
  [-1, 0, 0, 1, 0, 0, 0, 2, 0].forEach((n, i) => binary.writeFloatLE(n, i * 4));
  [0, 1, 2].forEach((n, i) => binary.writeUInt16LE(n, 36 + i * 2));
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 2, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
    materials: [
      {
        pbrMetallicRoughness: { baseColorFactor: [0.2, 0.8, 0.7, 0.8] },
        alphaMode: "BLEND",
        doubleSided: true,
      },
    ],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  return { json, binary };
}
function glb(textured = false) {
  const fixture = geometry(),
    json = fixture.json;
  let binary = fixture.binary;
  if (textured) {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
      "base64",
    );
    const joined = Buffer.concat([binary, png]);
    binary = Buffer.alloc(Math.ceil(joined.length / 4) * 4);
    joined.copy(binary);
    json.buffers[0].byteLength = joined.length;
    json.bufferViews.push({
      buffer: 0,
      byteOffset: 44,
      byteLength: png.length,
      target: 34962,
    });
    Object.assign(json, {
      images: [{ bufferView: 2, mimeType: "image/png" }],
      textures: [{ source: 0 }],
    });
    Object.assign(json.materials[0].pbrMetallicRoughness, {
      baseColorTexture: { index: 0 },
    });
  }
  const raw = Buffer.from(JSON.stringify(json)),
    length = Math.ceil(raw.length / 4) * 4,
    j = Buffer.alloc(length, 32);
  raw.copy(j);
  const out = Buffer.alloc(12 + 8 + j.length + 8 + binary.length);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(j.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  j.copy(out, 20);
  out.writeUInt32LE(binary.length, 20 + j.length);
  out.writeUInt32LE(0x004e4942, 24 + j.length);
  binary.copy(out, 28 + j.length);
  return out;
}

async function uploaded(
  page: Page,
  name = "portable.png",
  mime = "image/png",
  buffer?: Buffer,
) {
  await open(page);
  await page.getByLabel("Character file", { exact: true }).setInputFiles({
    name,
    mimeType: mime,
    buffer: buffer || (await image(page, mime)),
  });
  await page
    .getByLabel("Character name", { exact: true })
    .fill("Portable guardian");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Original description");
  await page
    .getByRole("button", { name: "Save and place", exact: true })
    .click();
  await expect(page.getByLabel("Spirit name", { exact: true })).toHaveValue(
    "Portable guardian",
  );
}
async function captureDownload(page: Page, name: string) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name, exact: true }).first().click(),
  ]);
  expect(download.suggestedFilename()).toContain(".zip");
  const path = await download.path();
  expect(path).toBeTruthy();
  return path!;
}
for (const [ext, mime] of [
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["jpeg", "image/jpeg"],
  ["glb", "model/gltf-binary"],
]) {
  test(`${ext} character export/import preserves original bytes, metadata, duplicate import and preview`, async ({
    page,
  }) => {
    await world(page);
    await uploaded(
      page,
      `guardian.${ext}`,
      mime,
      ext === "glb" ? glb(true) : undefined,
    );
    const path = await captureDownload(page, "Export Character");
    await open(page);
    await page
      .getByRole("button", { name: "Import Character", exact: true })
      .click();
    const dialog = page.getByRole("dialog").last();
    await dialog.getByLabel("Backup ZIP package").setInputFiles(path);
    await expect(dialog.getByLabel("Restored name")).toHaveValue(
      "Portable guardian",
    );
    await expect(
      dialog.getByRole("button", { name: "Confirm Import" }),
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Confirm Import" }).click();
    await expect(dialog.getByRole("status")).toContainText("saved to library");
    await dialog.getByLabel("Backup ZIP package").setInputFiles(path);
    await dialog.getByRole("button", { name: "Confirm Import" }).click();
    const data = await page.evaluate(async () => {
      const { listAssets } =
        await import("/src/features/creation/uploadAssets.ts");
      const { digest } = await import("/src/features/creation/worldBackup.ts");
      const items = await listAssets();
      return Promise.all(
        items.map(async (a: any) => ({
          name: a.name,
          description: a.description,
          hash: await digest(new Uint8Array(await a.file.arrayBuffer())),
        })),
      );
    });
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual(data[1]);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  });
}
test("world ZIP download restores new IDs, relationships, content, placement and survives reload without overwriting original", async ({
  page,
}) => {
  await world(page);
  await uploaded(page);
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await page
    .getByLabel("Spirit name", { exact: true })
    .fill("Connected friend");
  await page
    .getByLabel("Path target", { exact: true })
    .selectOption({ label: "Portable guardian" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  // Exercise same real package UI but retain only isolated test browser storage.
  const path = await captureDownload(page, "Export World Backup");
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
  );
  await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore World", exact: true })
    .click();
  const dialog = page.getByRole("dialog").last();
  await dialog.getByLabel("Backup ZIP package").setInputFiles(path);
  await dialog.getByLabel("Restored name").fill("Restored adventure");
  await dialog.getByRole("button", { name: "Confirm Import" }).click();
  await expect(
    page.getByRole("heading", { name: "Restored adventure" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".spirit-canvas")).not.toHaveAttribute(
    "data-loaded-assets",
    "",
  );
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!),
  );
  expect(after).toHaveLength(2);
  expect(after.find((w: any) => w.id === before.id)).toEqual(before);
  const copy = after.find((w: any) => w.id !== before.id);
  expect(copy.graph.characters[0].id).not.toBe(before.graph.characters[0].id);
  expect(copy.graph.characters[0].uploadedAssetId).not.toBe(
    before.graph.characters[0].uploadedAssetId,
  );
  expect(copy.graph.characters.map((c: any) => c.position)).toEqual(
    before.graph.characters.map((c: any) => c.position),
  );
  expect(copy.graph.connections[0].type).toBe(before.graph.connections[0].type);
  expect(copy.graph.connections[0].sourceCharacterId).toBe(
    copy.graph.characters[1].id,
  );
  await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore World", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .last()
    .getByLabel("Backup ZIP package")
    .setInputFiles(path);
  await page.getByRole("button", { name: "Confirm Import" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!).length,
    ),
  ).toBe(2);
  await expect(page.locator(".spirit-canvas")).not.toHaveAttribute(
    "data-loaded-assets",
    "",
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/beyond-backup-restored.png" });
});
test("invalid versions, tampering, missing assets, quota failure preserve existing storage; 375px import UI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await world(page);
  await uploaded(page);
  const result = await page.evaluate(async () => {
    const backup = await import("/src/features/creation/worldBackup.ts"),
      zip = await import("/src/features/creation/backupZip.ts"),
      assets = await import("/src/features/creation/uploadAssets.ts");
    const raw = localStorage.getItem("beyond:v1:created-worlds")!;
    // Save current fixture graph before exercising import rejection paths.
    const w = JSON.parse(raw)[0];
    const originalAssets = await assets.listAssets();
    // Existing editor has not saved its new character yet: construct a valid asset reference fixture.
    const { makeCharacter } =
      await import("/src/features/creation/spiritModel.ts");
    const c = makeCharacter(w.id, "custom", 0);
    c.uploadedAssetId = originalAssets[0].id;
    c.uploadedKind = "image";
    w.graph.characters = [c];
    const bytes = await backup.exportPackage(w);
    const file = () => new File([bytes], "backup.zip");
    const plan = await backup.inspectPackage(file());
    const errors = [];
    for (const type of ["version", "missing", "hash", "path"]) {
      const entries = zip.readZip(bytes);
      const m = JSON.parse(
        new TextDecoder().decode(entries.get("manifest.json")),
      );
      if (type === "version") m.version = 99;
      if (type === "missing") entries.delete(m.assets[0].path);
      if (type === "hash") m.assets[0].sha256 = "00";
      if (type === "path") {
        const bad = bytes.slice();
        bad[30] = 46;
        try {
          zip.readZip(bad);
        } catch {
          errors.push(type);
        }
        continue;
      }
      entries.set("manifest.json", new TextEncoder().encode(JSON.stringify(m)));
      try {
        await backup.inspectPackage(
          new File([zip.writeZip(entries)], "bad.zip"),
        );
      } catch {
        errors.push(type);
      }
    }
    const originalSet = Storage.prototype.setItem;
    const native = localStorage.setItem.bind(localStorage);
    Storage.prototype.setItem = function (key, value) {
      if (key === "beyond:v1:created-worlds")
        throw new DOMException("quota", "QuotaExceededError");
      native(key, value);
    };
    try {
      await backup.restorePackage(plan, "Failure test");
    } catch {
      errors.push("quota");
    }
    Storage.prototype.setItem = originalSet;
    return {
      errors,
      before: raw,
      after: localStorage.getItem("beyond:v1:created-worlds"),
      assetsBefore: originalAssets.length,
      assetsAfter: (await assets.listAssets()).length,
    };
  });
  expect(result.errors).toEqual([
    "version",
    "missing",
    "hash",
    "path",
    "quota",
  ]);
  expect(result.after).toBe(result.before);
  expect(result.assetsAfter).toBe(result.assetsBefore);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.getByRole("button", { name: "MY WORLDS", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore World", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Restore World", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/beyond-backup-mobile.png" });
});

test("a clean browser restores all assets and character content without source storage", async ({
  page,
  browser,
}) => {
  await world(page);
  await uploaded(page);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  // Attach an authored fixture note to the saved test world before exporting it through UI.
  const source = await page.evaluate(() => {
    const key = "beyond:v1:created-worlds",
      data = JSON.parse(localStorage.getItem(key)!);
    const w = data[0],
      c = w.graph.characters[0],
      id = crypto.randomUUID();
    c.contentIds = [id];
    w.graph.contents = [
      {
        id,
        worldId: w.id,
        characterId: c.id,
        type: "note",
        title: "Source note",
        body: "Preserve this content",
        url: "",
        sourceUrl: "https://example.com/source",
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      },
    ];
    localStorage.setItem(key, JSON.stringify(data));
    return w;
  });
  await page.reload();
  const path = await captureDownload(page, "Export World Backup");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5178",
    reducedMotion: "reduce",
  });
  const other = await context.newPage();
  try {
    await authorizeLocalAuthor(other);
    await other.goto(route);
    await other
      .getByRole("button", { name: "MY WORLDS", exact: true })
      .press("Enter");
    await other
      .getByRole("button", { name: "Restore World", exact: true })
      .click();
    const d = other.getByRole("dialog").last();
    await d.getByLabel("Backup ZIP package").setInputFiles(path);
    await d.getByRole("button", { name: "Confirm Import" }).click();
    await expect(
      other.getByRole("heading", { name: source.name, exact: true }),
    ).toBeVisible();
    await other.reload();
    await expect(other.locator(".spirit-canvas")).not.toHaveAttribute(
      "data-loaded-assets",
      "",
    );
    const copy = await other.evaluate(
      () => JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!)[0],
    );
    expect(copy.id).not.toBe(source.id);
    expect(copy.graph.contents[0].body).toBe("Preserve this content");
    expect(copy.graph.contents[0].characterId).toBe(
      copy.graph.characters[0].id,
    );
    expect(copy.graph.characters[0].contentIds).toEqual([
      copy.graph.contents[0].id,
    ]);
    await other.screenshot({ path: "/tmp/beyond-backup-clean-browser.png" });
  } finally {
    await context.close();
  }
});
