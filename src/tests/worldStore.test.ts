import { beforeEach, expect, it, vi } from "vitest";
import {
  loadWorlds,
  newWorld,
  newObject,
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
it("creates independent versioned worlds and roundtrips objects", () => {
  const a = newWorld(" One ", " first "),
    b = newWorld("Two", "second");
  a.objects = [newObject("portal", "Portal")];
  expect(saveWorld(a)).not.toBeNull();
  expect(saveWorld(b)).not.toBeNull();
  const loaded = loadWorlds();
  expect(loaded.error).toBe(false);
  expect(loaded.worlds).toHaveLength(2);
  expect(loaded.worlds.find((w) => w.id === a.id)?.objects[0].kind).toBe(
    "portal",
  );
  expect(a.id).not.toBe(b.id);
  expect(a.name).toBe("One");
  expect(a.version).toBe(2);
});
it("preserves malformed and unsupported stored data instead of overwriting", () => {
  for (const raw of ["broken", '[{"version":99}]']) {
    data.set(PREFIX + "created-worlds", raw);
    expect(loadWorlds().error).toBe(true);
    expect(saveWorld(newWorld("x", "y"))).toBeNull();
    expect(data.get(PREFIX + "created-worlds")).toBe(raw);
  }
});
it("rejects whitespace, invalid coordinates and stale saves", () => {
  expect(saveWorld(newWorld(" ", "x"))).toBeNull();
  const a = newWorld("x", "y");
  a.objects = [{ ...newObject("orb", "orb"), x: Infinity }];
  expect(saveWorld(a)).toBeNull();
  a.objects = [];
  const saved = saveWorld(a)!;
  expect(saveWorld({ ...saved, name: "bad overwrite" }, "stale")).toBeNull();
  expect(loadWorlds().worlds[0].name).toBe("x");
});
it("reports storage errors and leaves legacy draft intact", () => {
  data.set(
    PREFIX + "hidden-world-draft",
    '{"name":"old","description":"kept"}',
  );
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) || null,
    setItem: () => {
      throw Error("quota");
    },
  });
  expect(saveWorld(newWorld("x", "y"))).toBeNull();
  expect(data.get(PREFIX + "hidden-world-draft")).toContain("kept");
});
