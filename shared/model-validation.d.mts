export const uploadLimits: {
  imageBytes: number;
  modelBytes: number;
  vertices: number;
  triangles: number;
  nodes: number;
  textures: number;
};
export function validateGLTF(json: unknown): {
  vertices: number;
  triangles: number;
};
export function modelJSON(buffer: ArrayBuffer, format: "glb" | "gltf"): any;
