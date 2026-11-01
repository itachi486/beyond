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
test("PNG import previews, persists in IndexedDB, places/connects/reopens and blocks referenced asset deletion", async ({
  page,
}) => {
  await world(page);
  await open(page);
  await page.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "guardian.png",
    mimeType: "image/png",
    buffer: await image(page),
  });
  await expect(page.locator(".upload-preview img")).toBeVisible();
  await page
    .getByLabel("Character name", { exact: true })
    .fill("Imported guardian");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Outside-made character.");
  await page
    .getByRole("button", { name: "Save and place", exact: true })
    .click();
  await expect(page.getByLabel("Spirit name", { exact: true })).toHaveValue(
    "Imported guardian",
  );
  await expect(page.locator(".spirit-canvas")).not.toHaveAttribute(
    "data-loaded-assets",
    "",
  );
  await page
    .locator(".spirit-library")
    .getByRole("button", { name: "World Spirit", exact: true })
    .click();
  await page.getByLabel("Spirit name", { exact: true }).fill("Related spirit");
  await page
    .getByLabel("Path target", { exact: true })
    .selectOption({ label: "Imported guardian" });
  await page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name: "Imported guardian", exact: true })
    .press("Enter");
  await page.getByLabel("X", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.reload();
  await expect(
    page
      .getByRole("navigation", { name: "World characters" })
      .getByRole("button", { name: "Imported guardian", exact: true }),
  ).toBeAttached();
  await open(page);
  await page
    .getByRole("button", { name: "Delete original asset", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("in use");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("navigation", { name: "World characters" })
    .getByRole("button", { name: "Imported guardian", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Delete spirit", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await open(page);
  await page
    .getByRole("button", { name: "Delete original asset", exact: true })
    .click();
  await expect(
    page.getByText("No saved assets yet.", { exact: true }),
  ).toBeVisible();
});
for (const [type, ext] of [
  ["image/webp", "webp"],
  ["image/jpeg", "jpeg"],
])
  test(`${ext} import decodes before library registration`, async ({
    page,
  }) => {
    await world(page);
    await open(page);
    await page.getByLabel("Character file", { exact: true }).setInputFiles({
      name: "outside." + ext,
      mimeType: type,
      buffer: await image(page, type),
    });
    await expect(
      page.getByRole("button", { name: "Save to library", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Save to library", exact: true })
      .click();
    await expect(
      page.getByText("File saved in this browser.", { exact: true }),
    ).toBeVisible();
  });
test("GLB and embedded glTF have real 3D preview, place and persist", async ({
  page,
}) => {
  await world(page);
  await open(page);
  await page.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "sculpture.glb",
    mimeType: "model/gltf-binary",
    buffer: glb(true),
  });
  await expect(page.locator(".upload-preview canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save and place", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Save and place", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await page.reload();
  await expect(page.locator(".spirit-canvas canvas")).toBeVisible();
  await expect(page.locator(".spirit-canvas")).not.toHaveAttribute(
    "data-loaded-assets",
    "",
  );
  await open(page);
  const { json, binary } = geometry();
  const embedded = {
    ...json,
    buffers: [
      {
        byteLength: 42,
        uri:
          "data:application/octet-stream;base64," +
          binary.subarray(0, 42).toString("base64"),
      },
    ],
  };
  await page.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "embedded.gltf",
    mimeType: "model/gltf+json",
    buffer: Buffer.from(JSON.stringify(embedded)),
  });
  await expect(
    page.getByRole("button", { name: "Save to library", exact: true }),
  ).toBeEnabled();
});
test("corrupt/unsupported/oversized files and external glTF resources are refused", async ({
  page,
}) => {
  await world(page);
  await open(page);
  for (const [name, mime, buffer] of [
    ["bad.obj", "text/plain", Buffer.from("mesh")],
    ["bad.png", "image/png", Buffer.from("not png")],
    ["bad.glb", "model/gltf-binary", Buffer.alloc(32)],
    ["large.png", "image/png", Buffer.alloc(9 * 1024 * 1024)],
  ] as const) {
    await page
      .getByLabel("Character file", { exact: true })
      .setInputFiles({ name, mimeType: mime, buffer });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save and place", exact: true }),
    ).toHaveCount(0);
  }
  const { json } = geometry();
  await page.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "external.gltf",
    mimeType: "model/gltf+json",
    buffer: Buffer.from(
      JSON.stringify({
        ...json,
        buffers: [{ byteLength: 42, uri: "remote.bin" }],
      }),
    ),
  });
  await expect(page.getByRole("alert")).toContainText("external resources");
});
test("375px upload and same asset reuse across worlds preserves original", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await world(page, "First upload");
  await open(page);
  await page.getByLabel("Character file", { exact: true }).setInputFiles({
    name: "shared.png",
    mimeType: "image/png",
    buffer: await image(page),
  });
  await page
    .getByRole("button", { name: "Save and place", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  await world(page, "Second upload");
  await open(page);
  await page.getByRole("button", { name: "shared · PNG", exact: true }).click();
  await page
    .getByRole("button", { name: "Save and place", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".editor-footer [role=status]")).toHaveText(
    "Saved in this browser.",
  );
  const worlds = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("beyond:v1:created-worlds")!),
  );
  expect(worlds[0].graph.characters[0].uploadedAssetId).toBe(
    worlds[1].graph.characters[0].uploadedAssetId,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("drag-and-drop import and library metadata/duplication work without a paid API", async ({
  page,
}) => {
  let paid = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/ai/generations")) paid++;
  });
  await world(page);
  await open(page);
  const bytes = [...(await image(page))];
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(
      new File([new Uint8Array(bytes)], "dropped.png", { type: "image/png" }),
    );
    return data;
  }, bytes);
  await page
    .locator(".upload-drop-zone")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(
    page.getByRole("button", { name: "Save to library", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Character name", { exact: true })
    .fill("Renamed import");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Source credit in the description.");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Renamed import · PNG", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate asset", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Renamed import copy · PNG",
      exact: true,
    }),
  ).toBeVisible();
  expect(paid).toBe(0);
});
