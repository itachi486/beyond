import { beforeEach, expect, it, vi } from "vitest";
import {
  addConnection,
  makeCharacter,
  removeCharacter,
  safeURL,
  validGraph,
  type Content,
} from "../features/creation/spiritModel";
import {
  loadWorlds,
  newWorld,
  saveWorld,
} from "../features/creation/worldStore";
import { PREFIX } from "../lib/storage";
let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
it("roundtrips version2 characters/connections/content alongside untouched version1", () => {
  const w = newWorld("A", "B"),
    g = w.graph!;
  const a = makeCharacter(w.id, "creator", 0),
    b = makeCharacter(w.id, "collector", 1);
  g.characters = [a, b];
  const content: Content = {
    id: crypto.randomUUID(),
    worldId: w.id,
    characterId: a.id,
    type: "note",
    title: "My idea",
    body: "Kept",
    url: "",
    sourceUrl: "",
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
  a.contentIds = [content.id];
  g.contents = [content];
  g.connections = [addConnection(g, w.id, a.id, b.id)!];
  const old = {
    ...newWorld("Legacy", "Preserved"),
    version: 1 as const,
    graph: undefined,
  };
  expect(saveWorld(old)).not.toBeNull();
  expect(saveWorld(w)).not.toBeNull();
  const out = loadWorlds();
  expect(out.error).toBe(false);
  expect(out.worlds.find((x) => x.id === w.id)?.graph).toEqual(g);
  expect(out.worlds.find((x) => x.id === old.id)?.version).toBe(1);
});
it("rejects duplicate/self/missing links and cascades character/reference removal", () => {
  const w = newWorld("A", "B"),
    g = w.graph!,
    a = makeCharacter(w.id, "world", 0),
    b = makeCharacter(w.id, "custom", 1);
  g.characters = [a, b];
  expect(addConnection(g, w.id, a.id, a.id)).toBeNull();
  expect(addConnection(g, w.id, a.id, "missing")).toBeNull();
  g.connections = [addConnection(g, w.id, a.id, b.id)!];
  expect(addConnection(g, w.id, a.id, b.id)).toBeNull();
  const c: Content = {
    id: "ref",
    worldId: w.id,
    characterId: a.id,
    type: "reference",
    title: "Ref",
    body: "",
    url: "",
    sourceUrl: "",
    referenceId: b.id,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
  a.contentIds = ["ref"];
  g.contents = [c];
  const removed = removeCharacter(g, b.id);
  expect(removed.connections).toEqual([]);
  expect(removed.contents).toEqual([]);
  expect(removed.characters[0].contentIds).toEqual([]);
  expect(validGraph(removed, w.id)).toBe(true);
});
it("blocks script/credential URLs, orphan content, invalid transforms and corrupt writes", () => {
  expect(safeURL("javascript:alert(1)")).toBe(false);
  expect(safeURL("https://user:pass@example.com")).toBe(false);
  expect(safeURL("https://example.com/a")).toBe(true);
  const w = newWorld("A", "B");
  w.graph!.characters = [makeCharacter(w.id, "world", 0)];
  w.graph!.characters[0].position.x = Infinity;
  expect(saveWorld(w)).toBeNull();
  data.set(PREFIX + "created-worlds", '[{"version":2,"graph":{}}]');
  expect(saveWorld(newWorld("New", "Not overwrite"))).toBeNull();
  expect(data.get(PREFIX + "created-worlds")).toBe(
    '[{"version":2,"graph":{}}]',
  );
});

it("roundtrips optional AI metadata and rejects unsafe asset paths without breaking older spirits", () => {
  const w = newWorld("Images", "Metadata"),
    c = makeCharacter(w.id, "custom", 0);
  w.graph!.characters = [c];
  expect(saveWorld(w)).not.toBeNull();
  c.creatorId = "fixture-owner";
  c.assetId = "12345678-1234-4234-8234-123456789abc";
  c.imageUrl = "/api/ai/assets/" + c.assetId;
  c.personality = "Curious";
  c.appearancePrompt = "Branching crystal wings";
  c.abilities = "Memory";
  c.visibility = "local";
  c.animationPreset = "ribbon";
  expect(saveWorld(w)).not.toBeNull();
  expect(loadWorlds().worlds[0].graph!.characters[0].personality).toBe(
    "Curious",
  );
  c.imageUrl = "javascript:alert(1)";
  expect(saveWorld(w)).toBeNull();
});
