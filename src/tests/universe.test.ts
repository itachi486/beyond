import { describe, it, expect, vi, afterEach } from "vitest";
import { discoveries, worlds, getDiscovery } from "../data/universe";
import { ids, read, remember, write, PREFIX } from "../lib/storage";
import { languageOptions, messages } from "../locales";
describe("curated universe integrity", () => {
  it("has four distinct worlds with at least two sourced discoveries each", () => {
    expect(worlds).toHaveLength(4);
    for (const w of worlds) {
      expect(
        discoveries.filter((d) => d.worldId === w.id).length,
      ).toBeGreaterThanOrEqual(2);
    }
  });
  it("has stable unique URLs, valid links and non-placeholder content", () => {
    const unique = new Set(discoveries.map((d) => d.slug));
    expect(unique.size).toBe(discoveries.length);
    for (const d of discoveries) {
      expect(d.fictionLabel).toBe(false);
      expect(d.sourceUrls.length).toBeGreaterThan(0);
      expect(d.body.length).toBeGreaterThan(1);
      for (const p of d.body) {
        expect(p.en.length).toBeGreaterThan(70);
        expect(p.es.length).toBeGreaterThan(70);
      }
      for (const id of d.relatedIds) {
        expect(getDiscovery(id)).toBeDefined();
        expect(id).not.toBe(d.id);
      }
      for (const url of d.sourceUrls)
        expect(new URL(url).protocol).toBe("https:");
    }
  });
  it("keeps uncertainty explicit in unresolved content", () => {
    expect(getDiscovery("the-invisible-scaffolding")?.body[0].en).toContain(
      "open scientific question",
    );
    expect(getDiscovery("an-ocean-under-ice")?.body[1].en).toContain(
      "remains unknown",
    );
  });
  it("only advertises fully translated languages", () => {
    expect(languageOptions.filter((l) => l[2]).map((l) => l[0])).toEqual([
      "en",
      "es",
    ]);
    expect(Object.keys(messages.es).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
    for (const val of Object.values(messages.es))
      expect(val.trim().length).toBeGreaterThan(0);
    for (const d of discoveries) {
      expect(d.title.es).toBeTruthy();
      expect(d.summary.es).toBeTruthy();
    }
  });
  it("returns undefined for unknown shared paths", () =>
    expect(getDiscovery("missing")).toBeUndefined());
});
describe("local persistence", () => {
  afterEach(() => vi.unstubAllGlobals());
  function storage(value: string | null) {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => value, setItem });
    return setItem;
  }
  it("rejects malformed JSON, wrong shapes and excessive data", () => {
    for (const value of ["{", "null", "42", "[1]"]) {
      storage(value);
      expect(read("bookmarks", [], ids)).toEqual([]);
    }
    expect(ids(new Array(101).fill("x"))).toBe(false);
  });
  it("restores valid data and namespaced saves", () => {
    const setItem = storage('["a"]');
    expect(read("bookmarks", [], ids)).toEqual(["a"]);
    expect(write("bookmarks", ["b"])).toBe(true);
    expect(setItem).toHaveBeenCalledWith(PREFIX + "bookmarks", '["b"]');
  });
  it("handles denied browser storage safely", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(read("x", [], ids)).toEqual([]);
    expect(write("x", [])).toBe(false);
  });
  it("deduplicates and bounds history", () => {
    expect(remember(["a", "b"], "b")).toEqual(["b", "a"]);
    expect(remember(new Array(100).fill("a"), "b")).toHaveLength(100);
  });
});
