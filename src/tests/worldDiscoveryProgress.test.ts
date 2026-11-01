import { describe, it, expect, vi, afterEach } from "vitest";
import {
  emptyProgress,
  canDiscover,
  completeObjective,
  localDialogue,
  readProgress,
  conversationKey,
  conversationMessages,
  type DiscoveryProgress,
  type DiscoveryPoint,
} from "../features/creation/worldDiscoveryProgress";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const points: DiscoveryPoint[] = [
  { id: a, characterId: a, x: 20, y: 30 },
  { id: b, characterId: b, x: 40, y: 50 },
];
afterEach(() => vi.unstubAllGlobals());
describe("world progression guards", () => {
  it("blocks unknown and locked discoveries in logic", () => {
    expect(canDiscover(points, emptyProgress(), a)).toBe(true);
    expect(canDiscover(points, emptyProgress(), b)).toBe(false);
    expect(canDiscover(points, emptyProgress(), "unknown")).toBe(false);
  });
  it("requires a successful discovery and an earned clue", () => {
    expect(completeObjective(points, emptyProgress(), a)).toBeNull();
    expect(
      completeObjective(points, { ...emptyProgress(), found: [a] }, a),
    ).toBeNull();
    expect(
      completeObjective(
        points,
        { ...emptyProgress(), found: [b], clues: [b] },
        b,
      ),
    ).toBeNull();
  });
  it("explicit clue state cannot be bypassed by words in a normal response", () => {
    expect(
      completeObjective(
        points,
        {
          ...emptyProgress(),
          found: [a],
          clues: [],
          conversations: {
            [a]: [
              {
                role: "character",
                text: "A golden glimmer is part of my name.",
              },
            ],
          },
        },
        a,
      ),
    ).toBeNull();
  });
  it("unlocks through guarded completion and is idempotent", () => {
    const next = completeObjective(
      points,
      { ...emptyProgress(), found: [a], clues: [a] },
      a,
    )!;
    expect(canDiscover(points, next, b)).toBe(true);
    expect(completeObjective(points, next, a)).toBe(next);
    expect(next.completed).toEqual([a]);
  });
  it("supports explicit root links, and rejects backward/cyclic dependencies", () => {
    expect(
      canDiscover(
        [points[0], { ...points[1], requires: [] }],
        emptyProgress(),
        b,
      ),
    ).toBe(true);
    expect(
      canDiscover(
        [{ ...points[0], requires: [b] }, points[1]],
        { ...emptyProgress(), completed: [a, b] },
        a,
      ),
    ).toBe(false);
  });
  it("reads legacy progress and refuses malformed current-point state", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(emptyProgress()),
    });
    expect(readProgress("fixture").invalid).toBe(false);
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({ ...emptyProgress(), currentPoint: "invalid" }),
    });
    expect(readProgress("fixture").invalid).toBe(true);
  });
  it("local greeting does not automatically push a quest", async () => {
    const text = await localDialogue.reply({
      message: "Hello",
      description: "A guardian.",
      es: false,
      character: { id: a, name: "Lumi" },
    });
    expect(text).toContain("Lumi");
    expect(text).not.toContain("golden glimmer");
  });
  it("local world questions use actual lore, and explicit clue requests give an objective", async () => {
    expect(
      await localDialogue.reply({
        message: "Where is this world?",
        description: "",
        es: false,
        world: { id: a, name: "My Garden", lore: "A quiet floating garden." },
      }),
    ).toContain("My Garden");
    expect(
      await localDialogue.reply({
        message: "A clue please",
        description: "",
        es: false,
      }),
    ).toContain("golden glimmer");
  });
});

describe("character conversation storage", () => {
  it("keeps two characters in the same encounter separate", () => {
    const p: DiscoveryProgress = {
      ...emptyProgress(),
      conversations: {
        [conversationKey(a, a)]: [
          { role: "visitor" as const, text: "First guardian message" },
        ],
      },
    };
    expect(conversationMessages(p, a, a)[0].text).toBe(
      "First guardian message",
    );
    expect(conversationMessages(p, a, b)).toEqual([]);
  });
  it("preserves legacy history but never leaks it to a newly bound character", () => {
    const p: DiscoveryProgress = {
      ...emptyProgress(),
      conversations: { [a]: [{ role: "visitor" as const, text: "Legacy" }] },
    };
    expect(conversationMessages(p, a, a)).toHaveLength(1);
    p.conversations[conversationKey(a, a)] = [
      { role: "visitor", text: "Bound" },
    ];
    expect(conversationMessages(p, a, b)).toEqual([]);
    expect(p.conversations[a][0].text).toBe("Legacy");
  });
  it("restores composite keys and bounded longer history", () => {
    const data = {
      ...emptyProgress(),
      conversations: {
        [conversationKey(a, b)]: Array.from({ length: 22 }, () => ({
          role: "visitor",
          text: "Stored",
        })),
      },
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(data) });
    expect(readProgress("world-fixture").invalid).toBe(false);
    expect(
      conversationMessages(readProgress("world-fixture").data, a, b),
    ).toHaveLength(22);
  });
  it("uses actual saved history rather than inventing memory", async () => {
    expect(
      await localDialogue.reply({
        message: "Do you remember?",
        description: "",
        es: false,
        history: [],
      }),
    ).toContain("no earlier saved");
    expect(
      await localDialogue.reply({
        message: "Do you remember?",
        description: "",
        es: false,
        history: [{ role: "visitor", text: "A real earlier thought" }],
      }),
    ).toContain("A real earlier thought");
  });
});
