import {captureAccountContext,assertAccountContext,scopedKeyFor,type AccountContext} from '../account/sessionScope';
import {persistWorld} from "../account/cloudWorlds";
import {scopedKey} from "../account/sessionScope";
import { readZip, writeZip, PACKAGE_LIMIT } from "./backupZip";
import {
  getAsset,
  inspectFile,
  type ImportedAsset,
  addAssetBatch,
  removeAsset,
  listAssets,
} from "./uploadAssets";
import {
  validWorld,
  loadWorlds,
  saveWorld,
  newWorld,
  type CreatedWorld,
} from "./worldStore";
import { makeCharacter, safeURL, type Character } from "./spiritModel";
export type Manifest = {
  format: "beyond-backup";
  version: 1;
  kind: "character" | "world";
  createdAt: string;
  assets: Array<
    Omit<ImportedAsset, "file"> & { path: string; size: number; sha256: string }
  >;
};
export type PackagePlan = {
  manifest: Manifest;
  world: CreatedWorld;
  assets: ImportedAsset[];
  fingerprint: string;
  bytes: number;
};
const idPattern = /^[a-f0-9-]{36}$/;
const json = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
export async function digest(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export function downloadPackage(bytes: Uint8Array, kind: string) {
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `beyond-${kind}-backup.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportPackage(
  world: CreatedWorld,
  kind: "character" | "world" = "world",
  ctx:AccountContext=captureAccountContext(),
) {
  assertAccountContext(ctx);
  if (!validWorld(world)) throw Error("package_invalid");
  const files = new Map<string, Uint8Array>(),
    entries: Manifest["assets"] = [];
  for (const c of world.graph?.characters || [])
    if (c.assetId || c.imageUrl) throw Error("private_asset");
  for (const id of new Set(
    [...(world.graph?.characters.map(c=>c.uploadedAssetId).filter((s):s is string=>!!s)||[]),...(world.starter?[world.starter.assetId]:[])],
  )) {
    const a = await getAsset(id,ctx);assertAccountContext(ctx);
    if (!a) throw Error("missing_asset");
    const b = new Uint8Array(await a.file.arrayBuffer()),
      { file: _file, ...meta } = a;
    const checked = await inspectFile(new File([b], `asset.${a.format}`));
    if (checked.kind !== a.kind || checked.format !== a.format)
      throw Error("package_invalid");
    const path = `assets/${id}.${a.format}`;
    files.set(path, b);
    delete meta.template;
    delete meta.backupFingerprint;
    entries.push({ ...meta, path, size: b.length, sha256: await digest(b) });
  }
  assertAccountContext(ctx);const manifest: Manifest = {
    format: "beyond-backup",
    version: 1,
    kind,
    createdAt: new Date().toISOString(),
    assets: entries,
  };
  files.set("manifest.json", json(manifest));
  files.set("world.json", json(world));
  return writeZip(files);
}
export function characterWorld(
  asset: ImportedAsset,
  character?: Character,
  world?: CreatedWorld,
) {
  const w = newWorld(asset.name, asset.description || "Imported character");
  const c = character
    ? structuredClone(character)
    : {
        ...makeCharacter(w.id, "custom", 0),
        name: asset.name,
        description: asset.description,
        tags: asset.tags,
        sourceUrl: asset.source,
        uploadedAssetId: asset.id,
        uploadedKind: asset.kind,
      };
  c.worldId = w.id;
  c.contentIds = [];
  const contents =
    world?.graph?.contents
      .filter((d) => d.characterId === c.id)
      .map((d) => ({ ...d, worldId: w.id })) || [];
  // A standalone character cannot carry dangling character-reference content.
  if (contents.some((d) => d.type === "reference" && d.referenceId !== c.id))
    throw Error("external_reference");
  c.contentIds = contents.map((d) => d.id);
  w.graph = { characters: [c], connections: [], contents };
  return w;
}
export async function inspectPackage(file: File): Promise<PackagePlan> {
  if (!file.size || file.size > PACKAGE_LIMIT) throw Error("package_large");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    files = readZip(bytes);
  let m: Manifest, w: CreatedWorld;
  try {
    m = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
    w = JSON.parse(new TextDecoder().decode(files.get("world.json")));
  } catch {
    throw Error("package_invalid");
  }
  if (m.format !== "beyond-backup" || m.version !== 1)
    throw Error("package_version");
  if (
    !["character", "world"].includes(m.kind) ||
    !Number.isFinite(Date.parse(m.createdAt)) ||
    !Array.isArray(m.assets) ||
    m.assets.length > 40 ||
    !validWorld(w) ||
    (m.kind === "character" && w.graph?.characters.length !== 1)
  )
    throw Error("package_invalid");
  if (w.graph) {
    const all = [
      ...w.graph.characters,
      ...w.graph.contents,
      ...w.graph.connections,
    ].map((v) => v.id);
    if (new Set(all).size !== all.length) throw Error("package_invalid");
  }
  const assets: ImportedAsset[] = [],
    seen = new Set<string>();
  for (const a of m.assets) {
    if (
      !a ||
      !idPattern.test(a.id) ||
      seen.has(a.id) ||
      !["png", "webp", "jpeg", "glb", "gltf"].includes(a.format) ||
      a.path !== `assets/${a.id}.${a.format}`
    )
      throw Error("package_invalid");
    seen.add(a.id);
    for (const [s, max] of [
      [a.name, 100],
      [a.description, 2000],
      [a.tags, 300],
      [a.source, 2048],
      [a.filename, 200],
    ] as const)
      if (typeof s !== "string" || s.length > max)
        throw Error("package_invalid");
    if (
      !a.name.trim() ||
      (a.source && !safeURL(a.source)) ||
      !Number.isFinite(Date.parse(a.createdAt)) ||
      !Number.isFinite(Date.parse(a.updatedAt))
    )
      throw Error("package_invalid");
    const data = files.get(a.path);
    if (!data || data.length !== a.size || (await digest(data)) !== a.sha256)
      throw Error("missing_asset");
    const f = new File([data as Uint8Array<ArrayBuffer>], `asset.${a.format}`),
      checked = await inspectFile(f);
    if (checked.kind !== a.kind || checked.format !== a.format)
      throw Error("package_invalid");
    assets.push({
      id: a.id,
      kind: a.kind,
      format: a.format,
      file: f,
      filename: a.filename,
      name: a.name,
      description: a.description,
      tags: a.tags,
      source: a.source,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      ...(a.purpose==='starter-world'?{purpose:a.purpose}:{}),
    });
  }
  const needed = new Set<string>();
  if(w.starter){const snapshot=assets.find(a=>a.id===w.starter!.assetId);if(!snapshot||snapshot.kind!=="image"||await digest(new Uint8Array(await snapshot.file.arrayBuffer()))!==w.starter.hash)throw Error("missing_asset");snapshot.purpose="starter-world";needed.add(snapshot.id);}
  for (const c of w.graph?.characters || []) {
    if (c.assetId || c.imageUrl) throw Error("private_asset");
    if (c.uploadedAssetId) {
      const a = assets.find((a) => a.id === c.uploadedAssetId);
      if (!a || a.kind !== c.uploadedKind) throw Error("missing_asset");
      needed.add(a.id);
    }
  }
  if (needed.size !== assets.length || files.size !== assets.length + 2)
    throw Error("package_invalid");
  return {
    manifest: m,
    world: w,
    assets,
    fingerprint: await digest(bytes),
    bytes: bytes.length,
  };
}
export function remapWorld(
  plan: PackagePlan,
  name: string,
  assetMap: Map<string, string>,
) {
  const w = structuredClone(plan.world),
    oldID = w.id;
  w.id = crypto.randomUUID();
  w.name = name.trim();
  w.backupFingerprint = plan.fingerprint;
  const ids = new Map<string, string>();
  for (const o of w.objects) {
    const old = o.id;
    o.id = crypto.randomUUID();
    ids.set(old, o.id);
  }
  if (w.graph) {
    for (const v of [
      ...w.graph.characters,
      ...w.graph.contents,
      ...w.graph.connections,
    ])
      ids.set(v.id, crypto.randomUUID());
    for (const c of w.graph.characters) {
      c.id = ids.get(c.id)!;
      c.worldId = w.id;
      c.contentIds = c.contentIds.map((id) => ids.get(id)!);
      if (c.uploadedAssetId)
        c.uploadedAssetId = assetMap.get(c.uploadedAssetId)!;
      if (c.portalWorldId === oldID) c.portalWorldId = w.id;
    }
    for (const d of w.graph.contents) {
      d.id = ids.get(d.id)!;
      d.worldId = w.id;
      d.characterId = ids.get(d.characterId)!;
      if (d.referenceId) d.referenceId = ids.get(d.referenceId)!;
    }
    for (const e of w.graph.connections) {
      e.id = ids.get(e.id)!;
      e.worldId = w.id;
      e.sourceCharacterId = ids.get(e.sourceCharacterId)!;
      e.targetCharacterId = ids.get(e.targetCharacterId)!;
    }
  }
  if(w.starter)w.starter.assetId=assetMap.get(w.starter.assetId)!;
  w.createdAt = w.updatedAt = new Date().toISOString();
  if (!validWorld(w)) throw Error("package_invalid");
  return w;
}
const receiptKey = "beyond:backup-receipts:v1";
function receipts(): Record<string, string> {
  try {
    const r = JSON.parse(localStorage.getItem(scopedKey(receiptKey)) || "{}");
    return r && typeof r === "object" && !Array.isArray(r) ? r : {};
  } catch {
    return {};
  }
}
async function restoreWorldUnlocked(
  plan: PackagePlan,
  name: string,ctx:AccountContext,
): Promise<CreatedWorld> {
  assertAccountContext(ctx);const state = loadWorlds();
  if (state.error) throw Error("existing_storage");
  const r = receipts(),
    existing = state.worlds.find(
      (w) =>
        w.backupFingerprint === plan.fingerprint ||
        w.id === r[plan.fingerprint],
    );
  if (existing) {
    if(existing.starter&&!(await getAsset(existing.starter.assetId,ctx)))throw Error("missing_asset");
    for (const c of existing.graph?.characters || [])
      if (c.uploadedAssetId && !(await getAsset(c.uploadedAssetId,ctx)))
        throw Error("missing_asset");
    return existing;
  }
  const estimate = await navigator.storage?.estimate?.();
  if (
    estimate?.quota &&
    estimate.quota - (estimate.usage || 0) < plan.bytes * 2
  )
    throw Error("storage_space");
  const map = new Map(plan.assets.map((a) => [a.id, crypto.randomUUID()])),
    w = remapWorld(plan, name, map),
    written: string[] = [];
  try {
    // New UUIDs only. Cross-store failure compensates new assets, never old records.
    await addAssetBatch(plan.assets.map((a) => ({ ...a, id: map.get(a.id)! })),ctx);
    written.push(...map.values());
    // Re-read store at commit, preserving worlds added while validation was in progress.
    const saved = await persistWorld(w,undefined,undefined,ctx);
    if (!saved) throw Error("storage_failed");
    try {
      localStorage.setItem(
        scopedKeyFor(ctx,receiptKey),
        JSON.stringify({ ...r, [plan.fingerprint]: saved.id }),
      );
    } catch {
      /* Embedded fingerprint also provides deduplication if the auxiliary receipt cannot be saved. */
    }
    return saved;
  } catch (e) {
    let failed = false;
    for (const id of written)
      try {
        await removeAsset(id,ctx);
      } catch {
        failed = true;
      }
    if (failed) throw Error("partial_restore");
    throw e;
  }
}

async function importCharacterUnlocked(
  plan: PackagePlan,
  name: string,ctx:AccountContext,
): Promise<ImportedAsset> {
  if (plan.manifest.kind !== "character" || plan.assets.length !== 1)
    throw Error("package_invalid");
  assertAccountContext(ctx);const r = receipts(),
    key = "asset:" + plan.fingerprint,
    existing =
      (await listAssets(ctx)).find(
        (a) => a.backupFingerprint === plan.fingerprint,
      ) ||
      (r[key] && (await getAsset(r[key],ctx)));
  if (existing) return existing;
  const estimate = await navigator.storage?.estimate?.();
  if (
    estimate?.quota &&
    estimate.quota - (estimate.usage || 0) < plan.bytes * 2
  )
    throw Error("storage_space");
  const a = plan.assets[0],
    id = crypto.randomUUID(),
    template = remapWorld(plan, name, new Map([[a.id, id]]));
  template.graph!.characters[0].name = name.trim();
  const saved = {
    ...a,
    id,
    name: name.trim(),
    description: template.graph!.characters[0].description,
    tags: template.graph!.characters[0].tags || a.tags,
    source: template.graph!.characters[0].sourceUrl || a.source,
    template,
    backupFingerprint: plan.fingerprint,
  };
  await addAssetBatch([saved],ctx);assertAccountContext(ctx);
  try {
    localStorage.setItem(scopedKeyFor(ctx,receiptKey), JSON.stringify({ ...r, [key]: id }));
  } catch {}
  return saved;
}

// Serialize restore commits across tabs when the Web Locks API is available.
export async function restorePackage(plan: PackagePlan, name: string,ctx:AccountContext=captureAccountContext()) {
  assertAccountContext(ctx);
  return navigator.locks
    ? navigator.locks.request("beyond-backup-restore", () =>
        restoreWorldUnlocked(plan, name,ctx),
      )
    : restoreWorldUnlocked(plan, name,ctx);
}
export async function importCharacterPackage(plan: PackagePlan, name: string,ctx:AccountContext=captureAccountContext()) {
  assertAccountContext(ctx);
  return navigator.locks
    ? navigator.locks.request("beyond-backup-restore", () =>
        importCharacterUnlocked(plan, name,ctx),
      )
    : importCharacterUnlocked(plan, name,ctx);
}
