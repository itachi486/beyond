export const characterTypes = [
  "world",
  "collector",
  "creator",
  "portal",
  "custom",
] as const;
export type CharacterType = (typeof characterTypes)[number];
export const presets = ["crystal", "starlight", "ember"] as const;
export const connectionTypes = [
  "related",
  "contains",
  "leads_to",
  "created_from",
  "portal_to",
] as const;
export type Character = {
  id: string;
  worldId: string;
  type: CharacterType;
  name: string;
  description: string;
  position: { x: number; y: number; z: number };
  appearance: {
    preset: (typeof presets)[number];
    color: string;
    scale: number;
    rotation?: { x: number; y: number; z: number };
  };
  contentIds: string[];
  createdAt: string;
  updatedAt: string;
  portalWorldId?: string;
  role?: string;
  centralCharacterId?: string;
  centralVersion?: number;
  uploadedAssetId?: string;
  uploadedKind?: "image" | "model";
  tags?: string;
  sourceUrl?: string;
  creatorId?: string;
  personality?: string;
  appearancePrompt?: string;
  abilities?: string;
  visibility?: "local";
  assetId?: string;
  imageUrl?: string;
  animationPreset?: "float" | "orbit" | "flutter" | "pulse" | "ribbon";
};
export type Connection = {
  id: string;
  worldId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: (typeof connectionTypes)[number];
  label: string;
  description: string;
  visibility: "local";
};
export type Content = {
  id: string;
  worldId: string;
  characterId: string;
  type: "url" | "note" | "story" | "idea" | "image" | "reference";
  title: string;
  body: string;
  url: string;
  sourceUrl: string;
  referenceId?: string;
  createdAt: string;
  updatedAt: string;
};
export type SpiritGraph = {
  characters: Character[];
  connections: Connection[];
  contents: Content[];
};
export function safeURL(value: string) {
  try {
    const u = new URL(value);
    return (
      ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}
const text = (s: unknown, max: number): s is string =>
  typeof s === "string" && s.length <= max;
const num = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
export function validGraph(
  value: unknown,
  worldId: string,
): value is SpiritGraph {
  if (!value || typeof value !== "object") return false;
  const g = value as SpiritGraph;
  if (
    !Array.isArray(g.characters) ||
    !Array.isArray(g.connections) ||
    !Array.isArray(g.contents) ||
    g.characters.length > 40 ||
    g.connections.length > 120 ||
    g.contents.length > 200
  )
    return false;
  const cs = new Set(g.characters.map((c) => c?.id)),
    es = new Set(g.connections.map((c) => c?.id)),
    ds = new Set(g.contents.map((c) => c?.id));
  if (
    cs.size !== g.characters.length ||
    es.size !== g.connections.length ||
    ds.size !== g.contents.length
  )
    return false;
  if (
    !g.characters.every(
      (c) =>
        c &&
        text(c.id, 100) &&
        !!c.id &&
        c.worldId === worldId &&
        characterTypes.includes(c.type) &&
        text(c.name, 100) &&
        !!c.name.trim() &&
        text(c.description, 2000) &&
        c.position &&
        num(c.position.x, -16, 16) &&
        num(c.position.y, -10, 10) &&
        num(c.position.z, -3, 3) &&
        c.appearance &&
        presets.includes(c.appearance.preset) &&
        /^#[0-9a-fA-F]{6}$/.test(c.appearance.color) &&
        num(c.appearance.scale, 0.4, 2) &&
        (c.appearance.rotation === undefined ||
          (c.appearance.rotation !== null &&
            typeof c.appearance.rotation === "object" &&
            ["x", "y", "z"].every((axis) =>
              num(c.appearance.rotation![axis as "x" | "y" | "z"], -180, 180),
            ))) &&
        Array.isArray(c.contentIds) &&
        new Set(c.contentIds).size === c.contentIds.length &&
        c.contentIds.every((id) => ds.has(id)) &&
        date(c.createdAt) &&
        date(c.updatedAt) &&
        (c.portalWorldId === undefined || text(c.portalWorldId, 100)) &&
        (c.role === undefined || text(c.role, 200)) &&
        (c.centralCharacterId === undefined ||
          /^[a-f0-9-]{36}$/.test(c.centralCharacterId)) &&
        (c.centralVersion === undefined ||
          (Number.isInteger(c.centralVersion) &&
            c.centralVersion > 0 &&
            c.centralVersion < 1000000000)) &&
        (c.uploadedAssetId === undefined ||
          /^[a-f0-9-]{36}$/.test(c.uploadedAssetId)) &&
        (c.uploadedKind === undefined ||
          ["image", "model"].includes(c.uploadedKind)) &&
        (c.tags === undefined || text(c.tags, 300)) &&
        (c.sourceUrl === undefined || !c.sourceUrl || safeURL(c.sourceUrl)) &&
        (c.creatorId === undefined || text(c.creatorId, 100)) &&
        (c.personality === undefined || text(c.personality, 2000)) &&
        (c.appearancePrompt === undefined || text(c.appearancePrompt, 3000)) &&
        (c.abilities === undefined || text(c.abilities, 2000)) &&
        (c.visibility === undefined || c.visibility === "local") &&
        (c.assetId === undefined || /^[a-f0-9-]{36}$/.test(c.assetId)) &&
        (c.imageUrl === undefined ||
          /^\/api\/ai\/assets\/[a-f0-9-]{36}$/.test(c.imageUrl)) &&
        (c.animationPreset === undefined ||
          ["float", "orbit", "flutter", "pulse", "ribbon"].includes(
            c.animationPreset,
          )),
    )
  )
    return false;
  const pairs = new Set<string>();
  if (
    !g.connections.every((e) => {
      if (
        !e ||
        !text(e.id, 100) ||
        !e.id ||
        e.worldId !== worldId ||
        !cs.has(e.sourceCharacterId) ||
        !cs.has(e.targetCharacterId) ||
        e.sourceCharacterId === e.targetCharacterId ||
        !connectionTypes.includes(e.type) ||
        !text(e.label, 100) ||
        !text(e.description, 1000) ||
        e.visibility !== "local"
      )
        return false;
      const pair = [e.sourceCharacterId, e.targetCharacterId].join("|");
      if (pairs.has(pair)) return false;
      pairs.add(pair);
      return true;
    })
  )
    return false;
  return g.contents.every(
    (d) =>
      d &&
      text(d.id, 100) &&
      !!d.id &&
      d.worldId === worldId &&
      cs.has(d.characterId) &&
      ["url", "note", "story", "idea", "image", "reference"].includes(d.type) &&
      text(d.title, 150) &&
      !!d.title.trim() &&
      text(d.body, 12000) &&
      text(d.url, 2048) &&
      text(d.sourceUrl, 2048) &&
      (!d.url || safeURL(d.url)) &&
      (!d.sourceUrl || safeURL(d.sourceUrl)) &&
      (!["url", "image"].includes(d.type) || !!d.url) &&
      (d.type !== "reference" || cs.has(d.referenceId || "")) &&
      date(d.createdAt) &&
      date(d.updatedAt) &&
      g.characters
        .find((c) => c.id === d.characterId)!
        .contentIds.includes(d.id) &&
      g.characters.every(
        (c) => !c.contentIds.includes(d.id) || c.id === d.characterId,
      ),
  );
}
export const characterNames = {
  en: [
    "World Spirit",
    "Collector Spirit",
    "Creator Spirit",
    "Portal Spirit",
    "Custom Spirit",
  ],
  es: [
    "Espíritu del mundo",
    "Espíritu coleccionista",
    "Espíritu creador",
    "Espíritu portal",
    "Espíritu personal",
  ],
};
export const colors = ["#76e4de", "#baa1f6", "#ffd28c", "#83beff", "#f0a6cd"];
export function makeCharacter(
  worldId: string,
  type: CharacterType,
  index: number,
): Character {
  const now = new Date().toISOString(),
    i = characterTypes.indexOf(type);
  return {
    id: crypto.randomUUID(),
    worldId,
    type,
    name: characterNames.en[i],
    description: "",
    position: {
      x: Math.max(
        -14,
        Math.min(14, Math.cos(index * 2.4) * 2.8 * Math.sqrt(index + 1) * 0.9),
      ),
      y: Math.max(
        -9,
        Math.min(9, Math.sin(index * 2.4) * 2.8 * Math.sqrt(index + 1) * 0.55),
      ),
      z: 0,
    },
    appearance: { preset: "crystal", color: colors[i], scale: 1 },
    contentIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function addConnection(
  g: SpiritGraph,
  worldId: string,
  source: string,
  target: string,
): Connection | null {
  if (
    source === target ||
    !g.characters.some((c) => c.id === source) ||
    !g.characters.some((c) => c.id === target) ||
    g.connections.some(
      (e) => e.sourceCharacterId === source && e.targetCharacterId === target,
    ) ||
    g.connections.length >= 120
  )
    return null;
  return {
    id: crypto.randomUUID(),
    worldId,
    sourceCharacterId: source,
    targetCharacterId: target,
    type: "related",
    label: "",
    description: "",
    visibility: "local",
  };
}
export function removeCharacter(g: SpiritGraph, id: string): SpiritGraph {
  return {
    characters: g.characters
      .filter((c) => c.id !== id)
      .map((c) => ({
        ...c,
        contentIds: c.contentIds.filter(
          (did) =>
            !g.contents.some(
              (d) =>
                d.id === did && (d.characterId === id || d.referenceId === id),
            ),
        ),
      })),
    contents: g.contents.filter(
      (d) => d.characterId !== id && d.referenceId !== id,
    ),
    connections: g.connections.filter(
      (e) => e.sourceCharacterId !== id && e.targetCharacterId !== id,
    ),
  };
}
