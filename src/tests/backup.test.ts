import { expect, it } from "vitest";
import { crc32, writeZip, readZip } from "../features/creation/backupZip";
import { remapWorld, type PackagePlan } from "../features/creation/worldBackup";
import {
  newWorld,
  validWorld,
  newObject,
} from "../features/creation/worldStore";
import { makeCharacter, addConnection } from "../features/creation/spiritModel";
it("ZIP preserves original bytes and rejects CRC corruption, compression and traversal", () => {
  const original = new TextEncoder().encode("original bytes");
  const zip = writeZip(
    new Map([
      ["world.json", original],
      ["manifest.json", original],
    ]),
  );
  expect(readZip(zip).get("world.json")).toEqual(original);
  expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  const corrupt = zip.slice();
  corrupt[40] ^= 1;
  expect(() => readZip(corrupt)).toThrow();
  const compressed = zip.slice();
  compressed[8] = 8;
  expect(() => readZip(compressed)).toThrow();
  expect(() => writeZip(new Map([["../escape", original]]))).toThrow();
  expect(() => readZip(new Uint8Array(5))).toThrow();
});
it("remaps every graph reference while preserving placement, appearance, content and relationship type", () => {
  const w = newWorld("Original", "Keep me"),
    a = makeCharacter(w.id, "world", 0),
    b = makeCharacter(w.id, "portal", 1);
  a.uploadedAssetId = crypto.randomUUID();
  a.uploadedKind = "image";
  a.contentIds = ["note"];
  b.portalWorldId = w.id;
  w.graph = {
    characters: [a, b],
    connections: [
      {
        ...addConnection(
          { characters: [a, b], connections: [], contents: [] },
          w.id,
          a.id,
          b.id,
        )!,
        type: "portal_to",
      },
    ],
    contents: [
      {
        id: "note",
        worldId: w.id,
        characterId: a.id,
        type: "reference",
        title: "Relation",
        body: "Keep",
        url: "",
        sourceUrl: "https://example.com",
        referenceId: b.id,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      },
    ],
  };
  const copy = remapWorld(
    { world: w } as PackagePlan,
    "Restored",
    new Map([[a.uploadedAssetId, crypto.randomUUID()]]),
  );
  expect(validWorld(copy)).toBe(true);
  expect(copy.id).not.toBe(w.id);
  expect(copy.graph!.characters[0].position).toEqual(a.position);
  expect(copy.graph!.characters[0].appearance).toEqual(a.appearance);
  expect(copy.graph!.contents[0].referenceId).toBe(
    copy.graph!.characters[1].id,
  );
  expect(copy.graph!.connections[0].sourceCharacterId).toBe(
    copy.graph!.characters[0].id,
  );
  expect(copy.graph!.connections[0].type).toBe("portal_to");
  expect(copy.graph!.characters[1].portalWorldId).toBe(copy.id);
  expect(w.name).toBe("Original");
});
it("legacy V1 world backup remaps object IDs without changing coordinates", () => {
  const w = {
    ...newWorld("Old", "Legacy"),
    version: 1 as const,
    graph: undefined,
    objects: [newObject("tree", "Tree")],
  };
  const copy = remapWorld({ world: w } as PackagePlan, "New", new Map());
  expect(validWorld(copy)).toBe(true);
  expect(copy.objects[0].id).not.toBe(w.objects[0].id);
  expect(copy.objects[0].x).toBe(w.objects[0].x);
});
it('starter snapshots use independent asset IDs during restore and reject malformed references',()=>{
 const w=newWorld('Starter fixture','Original description'),assetId=crypto.randomUUID(),replacement=crypto.randomUUID();w.starter={imageId:crypto.randomUUID(),version:2,assetId,hash:'a'.repeat(64)};expect(validWorld(w)).toBe(true);const plan={world:w,fingerprint:'b'.repeat(64)} as PackagePlan;const restored=remapWorld(plan,'Independent copy',new Map([[assetId,replacement]]));expect(restored.starter?.assetId).toBe(replacement);expect(w.starter.assetId).toBe(assetId);expect(restored.starter?.imageId).toBe(w.starter.imageId);expect(restored.description).toBe(w.description);expect(validWorld({...w,starter:{...w.starter,hash:'broken'}})).toBe(false);
});
