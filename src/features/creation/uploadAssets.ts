import {captureAccountContext,assertAccountContext,type AccountContext} from "../account/sessionScope";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  uploadLimits,
  validateGLTF,
  modelJSON,
} from "../../../shared/model-validation.mjs";
export { uploadLimits, validateGLTF, modelJSON };
export type UploadKind = "image" | "model";
export type ImportedAsset = {
  purpose?: "starter-world";
  centralId?: string;
  centralVersion?: number;
  backupFingerprint?: string;
  template?: import("./worldStore").CreatedWorld;
  id: string;
  kind: UploadKind;
  format: "png" | "webp" | "jpeg" | "glb" | "gltf";
  file: Blob;
  filename: string;
  name: string;
  description: string;
  tags: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
export function disposeAsset(object: THREE.Object3D) {
  const geo = new Set<THREE.BufferGeometry>(),
    mats = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
    if (mesh.geometry) geo.add(mesh.geometry);
    if (mesh.material)
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (m) => {
          mats.add(m);
          for (const v of Object.values(m))
            if (v instanceof THREE.Texture) textures.add(v);
        },
      );
  });
  geo.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
export async function parseModel(file: Blob, format: "glb" | "gltf") {
  const buffer = await file.arrayBuffer();
  validateGLTF(modelJSON(buffer, format));
  const loader = new GLTFLoader(new THREE.LoadingManager());
  loader.manager.setURLModifier((url) => {
    if (!url.startsWith("data:") && !url.startsWith("blob:"))
      throw Error("external_resources");
    return url;
  });
  const gltf = await loader.parseAsync(
    format === "gltf" ? new TextDecoder().decode(buffer) : buffer,
    "",
  );
  const group = gltf.scene;
  let count = 0,
    pixels = 0;
  try {
    group.traverse((o) => {
      count++;
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) {
        const p = mesh.geometry.getAttribute("position");
        if (p) {
          for (let i = 0; i < p.count; i++)
            if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)))
              throw Error("invalid_model");
        }
      }
      if (mesh.material)
        for (const mat of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) {
              const img = value.image as
                { width: number; height: number } | undefined;
              if (img) {
                if (img.width > 4096 || img.height > 4096)
                  throw Error("model_too_complex");
                pixels += img.width * img.height;
              }
            }
    });
    if (count > 500 || pixels > 32 * 1024 * 1024)
      throw Error("model_too_complex");
    const box = new THREE.Box3().setFromObject(group),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length() < 0.000001)
      throw Error("invalid_model");
    group.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(group);
    wrapper.scale.setScalar(3 / Math.max(size.x, size.y, size.z));
    return wrapper;
  } catch (e) {
    disposeAsset(group);
    throw e;
  }
}
export async function inspectFile(
  file: File,
): Promise<{ kind: UploadKind; format: ImportedAsset["format"] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["png", "webp", "jpg", "jpeg", "glb", "gltf"].includes(ext || ""))
    throw Error("unsupported_file");
  const model = ext === "glb" || ext === "gltf";
  if (
    !file.size ||
    file.size > (model ? uploadLimits.modelBytes : uploadLimits.imageBytes)
  )
    throw Error("file_too_large");
  if (model) {
    const obj = await parseModel(file, ext as "glb" | "gltf");
    disposeAsset(obj);
    return { kind: "model", format: ext as "glb" | "gltf" };
  }
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    isPNG =
      b[0] === 137 &&
      b[1] === 80 &&
      b[2] === 78 &&
      b[3] === 71 &&
      b[4] === 13 &&
      b[5] === 10 &&
      b[6] === 26 &&
      b[7] === 10,
    isJPEG = b[0] === 255 && b[1] === 216 && b[2] === 255,
    isWebP =
      new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(b.slice(8, 12)) === "WEBP";
  if (
    (ext === "png" && !isPNG) ||
    (["jpg", "jpeg"].includes(ext || "") && !isJPEG) ||
    (ext === "webp" && !isWebP)
  )
    throw Error("invalid_image");
  try {
    const bitmap = await createImageBitmap(file);
    const large =
      bitmap.width > 4096 ||
      bitmap.height > 4096 ||
      bitmap.width * bitmap.height > 16 * 1024 * 1024;
    bitmap.close();
    if (large) throw Error("image_too_large");
  } catch {
    throw Error("invalid_image");
  }
  return {
    kind: "image",
    format: ext === "jpg" ? "jpeg" : (ext as "png" | "webp" | "jpeg"),
  };
}
function database(legacy = false,ctx:AccountContext=captureAccountContext()): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    assertAccountContext(ctx);
    const request = indexedDB.open("beyond-character-assets" + (!legacy && ctx.userId ? ":user:" + ctx.userId : ""), 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("assets", { keyPath: "id" });
    };
    request.onsuccess = () => {try{assertAccountContext(ctx);resolve(request.result);}catch(e){request.result.close();reject(e);}};
    request.onerror = () => reject(Error("storage_unavailable"));
    request.onblocked = () => reject(Error("storage_unavailable"));
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
  ctx:AccountContext=captureAccountContext(), legacy=false,
): Promise<T> {
  const db = await database(legacy,ctx);
  assertAccountContext(ctx);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", mode);
    const cancel=()=>{try{tx.abort();}catch{/* already committed; namespace remains captured */}};
    ctx.signal.addEventListener('abort',cancel,{once:true});
    let value: T;
    const request = fn(tx.objectStore("assets"));
    request.onsuccess = () => {
      if(ctx.signal.aborted){cancel();return;}value = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      ctx.signal.removeEventListener('abort',cancel);
      try{assertAccountContext(ctx);resolve(value);}catch(e){reject(e);}
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      ctx.signal.removeEventListener('abort',cancel);
      reject(Error(ctx.signal.aborted?'account_context_stale':'storage_failed'));
    };
  });
}
export const listAssets = (ctx:AccountContext=captureAccountContext()) =>
  operation<ImportedAsset[]>("readonly", (s) => s.getAll(),ctx);
export const getAsset = (id: string,ctx:AccountContext=captureAccountContext()) =>
  operation<ImportedAsset | undefined>("readonly", (s) => s.get(id),ctx);
export async function saveAsset(asset: ImportedAsset,ctx:AccountContext=captureAccountContext()) {
  await operation("readwrite", (s) => s.put(asset),ctx);
}
export async function removeAsset(id: string,ctx:AccountContext=captureAccountContext()) {
  await operation("readwrite", (s) => s.delete(id),ctx);
}
export async function assetObject(asset: ImportedAsset) {
  if (asset.kind === "model")
    return parseModel(asset.file, asset.format as "glb" | "gltf");
  const url = URL.createObjectURL(asset.file);
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    const image = texture.image as { width: number; height: number };
    const aspect = image.width / image.height;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(
        aspect >= 1 ? 3 : 3 * aspect,
        aspect >= 1 ? 3 / aspect : 3,
      ),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.01,
        side: THREE.DoubleSide,
      }),
    );
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  } finally {
    URL.revokeObjectURL(url);
  }
}
// One transaction for all newly restored binaries; add never overwrites an asset.
export async function addAssetBatch(assets: ImportedAsset[],ctx:AccountContext=captureAccountContext()) {
  const db = await database(false,ctx);
  assertAccountContext(ctx);
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    const cancel=()=>{try{tx.abort();}catch{}};ctx.signal.addEventListener('abort',cancel,{once:true});
    for (const a of assets) tx.objectStore("assets").add(a);
    tx.oncomplete = () => {
      db.close();
      ctx.signal.removeEventListener('abort',cancel);try{assertAccountContext(ctx);resolve();}catch(e){reject(e);}
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      ctx.signal.removeEventListener('abort',cancel);reject(Error(ctx.signal.aborted?'account_context_stale':'storage_failed'));
    };
  });
}

export async function getLegacyAsset(id:string,ctx:AccountContext=captureAccountContext()):Promise<ImportedAsset|undefined>{return operation("readonly",s=>s.get(id),ctx,true);}
