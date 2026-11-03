import { scopedKey } from "../account/sessionScope";
import { validGraph, type SpiritGraph } from "./spiritModel";
import { PREFIX, write } from "../../lib/storage";
export const objectKinds = [
  "crystal",
  "portal",
  "tree",
  "ruin",
  "island",
  "door",
  "orb",
  "building",
] as const;
export type ObjectKind = (typeof objectKinds)[number];
export type WorldObject = {
  id: string;
  kind: ObjectKind;
  name: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  layer: number;
};
export type CreatedWorld = {
  cloudVersion?: number;
  ownerId?: string;
  starter?: {imageId:string;version:number;assetId:string;hash:string};
  version: 1 | 2;
  backupFingerprint?: string;
  graph?: SpiritGraph;
  id: string;
  name: string;
  description: string;
  introduction?: string;
  visibility?: "private";
  createdAt: string;
  updatedAt: string;
  theme: "celestial" | "forest" | "void";
  objects: WorldObject[];
};
const key = "created-worlds";
const bounded = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
export function validWorld(v: unknown): v is CreatedWorld {
  if (!v || typeof v !== "object") return false;
  const w = v as CreatedWorld;
  return (
    (w.version === 1 || (w.version === 2 && validGraph(w.graph, w.id))) &&
    (w.backupFingerprint === undefined ||
      /^[a-f0-9]{64}$/.test(w.backupFingerprint)) &&
    (w.starter===undefined || (w.starter && /^[a-f0-9-]{36}$/.test(w.starter.imageId) && /^[a-f0-9-]{36}$/.test(w.starter.assetId) && Number.isInteger(w.starter.version) && w.starter.version>0 && /^[a-f0-9]{64}$/.test(w.starter.hash))) &&
    (w.introduction===undefined || (typeof w.introduction==="string" && w.introduction.length<=2000)) &&
    (w.visibility===undefined || w.visibility==="private") &&
    typeof w.id === "string" &&
    w.id.length <= 100 &&
    typeof w.name === "string" &&
    !!w.name.trim() &&
    w.name.length <= 100 &&
    typeof w.description === "string" &&
    !!w.description.trim() &&
    w.description.length <= 2000 &&
    typeof w.createdAt === "string" &&
    Number.isFinite(Date.parse(w.createdAt)) &&
    typeof w.updatedAt === "string" &&
    Number.isFinite(Date.parse(w.updatedAt)) &&
    ["celestial", "forest", "void"].includes(w.theme) &&
    Array.isArray(w.objects) &&
    w.objects.length <= 200 &&
    new Set(w.objects.map((o) => o?.id)).size === w.objects.length &&
    w.objects.every(
      (o) =>
        o &&
        typeof o.id === "string" &&
        o.id.length <= 100 &&
        objectKinds.includes(o.kind) &&
        typeof o.name === "string" &&
        o.name.length <= 100 &&
        bounded(o.x, 0, 1000) &&
        bounded(o.y, 0, 650) &&
        bounded(o.size, 0.25, 3) &&
        bounded(o.rotation, -360, 360) &&
        bounded(o.layer, -1000, 1000),
    )
  );
}
export function loadWorlds(): { worlds: CreatedWorld[]; error: boolean } {
  try {
    const raw = localStorage.getItem(PREFIX + scopedKey(key));
    if (!raw) return { worlds: [], error: false };
    const data: unknown = JSON.parse(raw);
    if (
      !Array.isArray(data) ||
      !data.every(validWorld) ||
      new Set(data.map((w) => w.id)).size !== data.length
    )
      return { worlds: [], error: true };
    return { worlds: data, error: false };
  } catch {
    return { worlds: [], error: true };
  }
}
export function saveWorld(
  world: CreatedWorld,
  expected?: string,
): CreatedWorld | null {
  const state = loadWorlds();
  if (state.error || !validWorld(world)) return null;
  const old = state.worlds.find((w) => w.id === world.id);
  if (expected !== undefined && old?.updatedAt !== expected) return null;
  const saved = { ...world, updatedAt: new Date().toISOString() };
  return write(scopedKey(key), [saved, ...state.worlds.filter((w) => w.id !== saved.id)])
    ? saved
    : null;
}
export function newWorld(name: string, description: string): CreatedWorld {
  const now = new Date().toISOString();
  return {
    version: 2,
    graph: { characters: [], connections: [], contents: [] },
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    theme: "celestial",
    objects: [],
  };
}
export function newObject(kind: ObjectKind, name: string): WorldObject {
  return {
    id: crypto.randomUUID(),
    kind,
    name,
    x: 500,
    y: 350,
    size: 1,
    rotation: 0,
    layer: 0,
  };
}
export const kindNames = {
  en: [
    "Glowing crystal",
    "Magic portal",
    "Mystic tree",
    "Ancient ruins",
    "Floating island",
    "Magic door",
    "Light orb",
    "Sanctuary",
  ],
  es: [
    "Cristal luminoso",
    "Portal mágico",
    "Árbol místico",
    "Ruinas antiguas",
    "Isla flotante",
    "Puerta mágica",
    "Orbe de luz",
    "Santuario",
  ],
};
