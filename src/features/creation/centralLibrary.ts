import type { CharacterType } from "./spiritModel";
export type CentralCharacter = {
  id: string;
  name: string;
  description: string;
  type: CharacterType;
  tags: string;
  source: string;
  active: boolean;
  deleted: boolean;
  version: number;
  kind: "image" | "model";
  format: "png" | "webp" | "jpeg" | "glb" | "gltf";
  bytes: number;
  createdAt: string;
  updatedAt: string;
  previewUrl: string | null;
  fileUrl: string;
  usage?: string;
};
export async function centralRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Character library unavailable.");
  return data;
}
export async function filePayload(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { name: file.name, data: btoa(raw) };
}
