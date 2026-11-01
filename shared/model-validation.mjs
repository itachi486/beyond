export const uploadLimits = {
  imageBytes: 8 * 1024 * 1024,
  modelBytes: 16 * 1024 * 1024,
  vertices: 150000,
  triangles: 100000,
  nodes: 250,
  textures: 12,
};
export function validateGLTF(json) {
  if (!json || typeof json !== "object") throw Error("invalid_model");
  const g = json;
  if (
    g.asset?.version !== "2.0" ||
    (g.nodes?.length || 0) > uploadLimits.nodes ||
    (g.textures?.length || 0) > uploadLimits.textures
  )
    throw Error("model_too_complex");
  if (
    [...(g.extensionsUsed || []), ...(g.extensionsRequired || [])].some((e) =>
      [
        "KHR_draco_mesh_compression",
        "EXT_meshopt_compression",
        "KHR_texture_basisu",
        "MSFT_texture_dds",
      ].includes(e),
    )
  )
    throw Error("unsupported_compression");
  if (
    g.images?.some(
      (image) =>
        image.bufferView !== undefined &&
        !["image/png", "image/jpeg", "image/webp"].includes(
          image.mimeType || "",
        ),
    )
  )
    throw Error("invalid_model");
  const nodes = g.nodes || [],
    visited = new Set(),
    visiting = new Set();
  function visit(i, depth = 0) {
    if (!Number.isInteger(i) || i < 0 || i >= nodes.length || visiting.has(i))
      throw Error("invalid_model");
    if (depth > 50) throw Error("model_too_complex");
    if (visited.has(i)) return;
    const node = nodes[i];
    if (!node || typeof node !== "object") throw Error("invalid_model");
    for (const [k, len] of [
      ["matrix", 16],
      ["translation", 3],
      ["rotation", 4],
      ["scale", 3],
    ]) {
      const values = node[k];
      if (
        values !== undefined &&
        (!Array.isArray(values) ||
          values.length !== len ||
          values.some((n) => !Number.isFinite(n)))
      )
        throw Error("invalid_model");
    }
    visiting.add(i);
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) throw Error("invalid_model");
      node.children.forEach((child) => visit(child, depth + 1));
    }
    visiting.delete(i);
    visited.add(i);
  }
  nodes.forEach((_, i) => visit(i));
  let vertices = 0,
    triangles = 0,
    primitives = 0;
  for (const mesh of g.meshes || [])
    for (const p of mesh.primitives || []) {
      const a = g.accessors?.[p.attributes?.POSITION ?? -1],
        indices = g.accessors?.[p.indices ?? -1];
      if (!a || !Number.isInteger(a.count) || a.count <= 0)
        throw Error("invalid_model");
      vertices += a.count;
      triangles += (indices?.count || a.count) / 3;
      primitives++;
      if (p.mode !== undefined && p.mode !== 4)
        throw Error("unsupported_topology");
    }
  if (
    !vertices ||
    vertices > uploadLimits.vertices ||
    triangles > uploadLimits.triangles ||
    primitives > 200
  )
    throw Error("model_too_complex");
  function walk(v) {
    if (!v || typeof v !== "object") return;
    for (const [k, value] of Object.entries(v)) {
      if (
        k === "uri" &&
        (typeof value !== "string" ||
          !/^data:(?:image\/(?:png|jpeg|webp)|application\/(?:octet-stream|gltf-buffer));base64,[A-Za-z0-9+/=]+$/.test(
            value,
          ))
      )
        throw Error("external_resources");
      walk(value);
    }
  }
  walk(json);
  return { vertices, triangles };
}
export function modelJSON(buffer, format) {
  if (format === "gltf") {
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      );
    } catch {
      throw Error("invalid_model");
    }
  }
  const v = new DataView(buffer);
  if (
    buffer.byteLength < 20 ||
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== buffer.byteLength ||
    v.getUint32(16, true) !== 0x4e4f534a
  )
    throw Error("invalid_model");
  const length = v.getUint32(12, true);
  if (length % 4 || 20 + length > buffer.byteLength)
    throw Error("invalid_model");
  try {
    return JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 20, length)).trim(),
    );
  } catch {
    throw Error("invalid_model");
  }
}
