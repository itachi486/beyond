import {decodeRaster,makeThumbnail} from "../images.mjs";
import {
  modelJSON,
  validateGLTF,
  uploadLimits,
} from "../../shared/model-validation.mjs";
import { fail, Problem } from "../../server/validation.mjs";
export const formats = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};
export function decodeBase64(value, max) {
  if (typeof value === "string" && value.length > Math.ceil(max / 3) * 4)
    fail(413, "File size exceeds the limit.");
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    fail(400, "Invalid file encoding.");
  const b = Buffer.from(value, "base64");
  if (!b.length || b.length > max) fail(413, "File size exceeds the limit.");
  return b;
}
export async function decodeImage(bytes, format) { return decodeRaster(bytes, format); }
async function validateModel(bytes, format) {
  let json;
  try {
    json = modelJSON(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      format,
    );
    validateGLTF(json);
  } catch {
    fail(
      400,
      "Invalid or unsupported model. Use a bounded GLB or self-contained glTF without compressed resources.",
    );
  }
  const nodes = json.nodes || [],
    scenes = json.scenes;
  if (
    !Array.isArray(scenes) ||
    !scenes.length ||
    scenes.length > 16 ||
    !Number.isInteger(json.scene ?? 0) ||
    !scenes[json.scene ?? 0] ||
    scenes.some(
      (s) =>
        !Array.isArray(s.nodes) ||
        s.nodes.length > 250 ||
        s.nodes.some((i) => !Number.isInteger(i) || !nodes[i]),
    )
  )
    fail(400, "Invalid model scenes.");
  if (
    (json.materials || []).length > 64 ||
    (json.skins || []).length > 16 ||
    (json.animations || []).length > 16
  )
    fail(400, "Model resource complexity exceeded.");
  for (const n of nodes)
    if (
      n.mesh !== undefined &&
      (!Number.isInteger(n.mesh) || !json.meshes?.[n.mesh])
    )
      fail(400, "Invalid model mesh reference.");
  for (const s of json.skins || [])
    if (
      !Array.isArray(s.joints) ||
      s.joints.length > 128 ||
      s.joints.some((i) => !Number.isInteger(i) || !nodes[i])
    )
      fail(400, "Invalid model skin.");
  for (const a of json.animations || [])
    if ((a.samplers || []).length > 64 || (a.channels || []).length > 128)
      fail(400, "Model animation complexity exceeded.");
  for (const m of json.meshes || [])
    for (const p of m.primitives || [])
      if (
        (p.targets || []).length > 8 ||
        Object.keys(p.attributes || {}).length > 12
      )
        fail(400, "Model target complexity exceeded.");
  const required = json.extensionsRequired || [];
  if (
    required.some(
      (e) => !["KHR_materials_unlit", "KHR_texture_transform"].includes(e),
    )
  )
    fail(400, "Unsupported required model extension.");
  const buffers = [];
  let binary = null,
    total = 0;
  if (format === "glb") {
    let offset = 12,
      sections = 0;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) fail(400, "Damaged GLB chunk.");
      const length = bytes.readUInt32LE(offset),
        type = bytes.readUInt32LE(offset + 4);
      if (length % 4 || offset + 8 + length > bytes.length)
        fail(400, "Damaged GLB chunk.");
      if (type === 0x004e4942) {
        if (binary) fail(400, "Duplicate GLB binary.");
        binary = bytes.subarray(offset + 8, offset + 8 + length);
      } else if (type !== 0x4e4f534a || sections !== 0)
        fail(400, "Unsupported GLB chunk.");
      offset += 8 + length;
      sections++;
    }
  }
  const embedded = (uri) => {
    if (
      typeof uri !== "string" ||
      !/^data:(?:image\/(?:png|jpeg|webp)|application\/(?:octet-stream|gltf-buffer));base64,/.test(
        uri,
      )
    )
      fail(400, "External model dependencies are not allowed.");
    return decodeBase64(
      uri.slice(uri.indexOf(",") + 1),
      uploadLimits.modelBytes,
    );
  };
  if (!Array.isArray(json.buffers) || json.buffers.length > 8)
    fail(400, "Invalid model buffers.");
  for (const [i, b] of json.buffers.entries()) {
    const data = b.uri ? embedded(b.uri) : i === 0 && binary;
    if (
      !data ||
      !Number.isInteger(b.byteLength) ||
      b.byteLength < 1 ||
      b.byteLength > data.length ||
      data.length - b.byteLength > 3
    )
      fail(400, "Invalid model buffer length.");
    total += data.length;
    if (total > uploadLimits.modelBytes)
      fail(413, "Embedded model resources exceed 16 MiB.");
    buffers.push(data);
  }
  const views = json.bufferViews || [],
    accessors = json.accessors || [];
  if (views.length > 512 || accessors.length > 512)
    fail(400, "Model has too many resource views.");
  const view = (i) => {
    const v = views[i],
      b = buffers[v?.buffer];
    if (
      !v ||
      !b ||
      !Number.isInteger(v.byteLength) ||
      !Number.isInteger(v.byteOffset || 0) ||
      (v.byteOffset || 0) < 0 ||
      v.byteLength < 1 ||
      (v.byteOffset || 0) + v.byteLength > b.length
    )
      fail(400, "Invalid model resource bounds.");
    return { v, b, offset: v.byteOffset || 0 };
  };
  views.forEach((_, i) => view(i));
  const elements = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT2: 4,
      MAT3: 9,
      MAT4: 16,
    },
    sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  for (const a of accessors) {
    if (a.sparse)
      fail(
        400,
        "Sparse accessors are not supported by the central library. Export a regular GLB.",
      );
    const { v } = view(a.bufferView),
      size = sizes[a.componentType],
      n = elements[a.type],
      offset = a.byteOffset || 0,
      stride = v.byteStride || size * n;
    if (
      !Number.isInteger(a.count) ||
      a.count < 1 ||
      a.count > 450000 ||
      !size ||
      !n ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset % size ||
      !Number.isInteger(stride) ||
      stride < size * n ||
      stride > 252 ||
      offset + (a.count - 1) * stride + size * n > v.byteLength
    )
      fail(400, "Invalid model accessor bounds.");
  }
  for (const mesh of json.meshes || [])
    for (const p of mesh.primitives || []) {
      const a = accessors[p.attributes.POSITION];
      if (a.componentType !== 5126 || a.type !== "VEC3")
        fail(400, "Invalid model position data.");
      const { v, b, offset } = view(a.bufferView),
        stride = v.byteStride || 12;
      for (let i = 0; i < a.count; i++)
        for (let j = 0; j < 3; j++) {
          const n = b.readFloatLE(
            offset + (a.byteOffset || 0) + i * stride + j * 4,
          );
          if (!Number.isFinite(n) || Math.abs(n) > 1e8)
            fail(400, "Nonfinite model geometry.");
        }
      if (p.indices !== undefined) {
        const idx = accessors[p.indices];
        if (
          !idx ||
          idx.type !== "SCALAR" ||
          ![5121, 5123, 5125].includes(idx.componentType)
        )
          fail(400, "Invalid model indices.");
        const data = view(idx.bufferView),
          size = sizes[idx.componentType];
        for (let i = 0; i < idx.count; i++) {
          const x = data.b.readUIntLE(
            data.offset +
              (idx.byteOffset || 0) +
              i * (data.v.byteStride || size),
            size,
          );
          if (x >= a.count) fail(400, "Model index outside vertex bounds.");
        }
      }
    }
  if ((json.images || []).length > 12) fail(400, "Too many embedded textures.");
  let pixels = 0;
  for (const image of json.images || []) {
    let data, mime;
    if (image.uri) {
      data = embedded(image.uri);
      mime = image.uri.slice(5, image.uri.indexOf(";"));
    } else {
      const resource = view(image.bufferView);
      data = resource.b.subarray(
        resource.offset,
        resource.offset + resource.v.byteLength,
      );
      mime = image.mimeType;
    }
    const fmt = Object.keys(formats).find((k) => formats[k] === mime);
    if (
      !["png", "jpeg", "webp"].includes(fmt) ||
      data.length > uploadLimits.imageBytes
    )
      fail(400, "Invalid embedded texture.");
    pixels += (await decodeImage(data, fmt)).pixels;
    if (pixels > 32 * 1024 * 1024) fail(400, "Model texture budget exceeded.");
  }
}
export async function validateUpload(file, maxOverride) {
  if (!file || typeof file.name !== "string" || file.name.length > 200)
    fail(400, "Choose a supported file.");
  const ext = file.name.split(".").pop()?.toLowerCase(),
    format = ext === "jpg" ? "jpeg" : ext;
  if (!formats[format])
    fail(400, "Unsupported file. Use PNG, WebP, JPEG, GLB or embedded glTF.");
  const model = ["glb", "gltf"].includes(format),
    bytes = decodeBase64(
      file.data,
      maxOverride ||
        (model ? uploadLimits.modelBytes : uploadLimits.imageBytes),
    );
  try {
    if (model) await validateModel(bytes, format);
    else await decodeImage(bytes, format);
  } catch (e) {
    if (e instanceof Problem) throw e;
    fail(400, "Damaged or unsupported character file.");
  }
  return {
    format,
    kind: model ? "model" : "image",
    bytes,
    mime: formats[format],
  };
}
export async function thumbnail(bytes) { return makeThumbnail(bytes); }
