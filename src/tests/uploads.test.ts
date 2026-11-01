import { it, expect } from "vitest";
import { modelJSON, validateGLTF } from "../features/creation/uploadAssets";
const model = () => ({
  asset: { version: "2.0" },
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [{ count: 3, componentType: 5126, type: "VEC3" }],
});
it("accepts bounded embedded glTF and rejects external or compressed dependencies", () => {
  const good = model();
  expect(validateGLTF(good).vertices).toBe(3);
  expect(() =>
    validateGLTF({
      ...good,
      buffers: [{ uri: "https://example.com/model.bin" }],
    }),
  ).toThrow("external_resources");
  expect(() =>
    validateGLTF({ ...good, buffers: [{ uri: "../model.bin" }] }),
  ).toThrow("external_resources");
  expect(() =>
    validateGLTF({ ...good, extensionsUsed: ["KHR_draco_mesh_compression"] }),
  ).toThrow("unsupported_compression");
  expect(() =>
    validateGLTF({
      ...good,
      images: [{ bufferView: 0, mimeType: "image/svg+xml" }],
    }),
  ).toThrow("invalid_model");
});
it("rejects excessive geometry and corrupted model containers", () => {
  const heavy = model();
  heavy.accessors[0].count = 999999;
  expect(() => validateGLTF(heavy)).toThrow("model_too_complex");
  expect(() => modelJSON(new ArrayBuffer(24), "glb")).toThrow("invalid_model");
  expect(() =>
    modelJSON(new TextEncoder().encode("not json").buffer, "gltf"),
  ).toThrow("invalid_model");
  expect(() => validateGLTF({ asset: { version: "1.0" } })).toThrow();
});

it("rejects cyclic and non-finite model graphs before invoking a loader", () => {
  const base = model();
  expect(() => validateGLTF({ ...base, nodes: [{ children: [0] }] })).toThrow(
    "invalid_model",
  );
  expect(() =>
    validateGLTF({ ...base, nodes: [{ translation: [Infinity, 0, 0] }] }),
  ).toThrow("invalid_model");
});
