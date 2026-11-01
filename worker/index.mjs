import { BackendError, supabase, verifyProductionDataset } from "./supabase.mjs";
import { universeFromRecords } from "./universe.mjs";
import { handleAdmin } from "./admin.mjs";
const json = (status, value) => Response.json(value, { status, headers: {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin",
} });
const idOK = value => /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export async function handle(request, env, transport = fetch) {
  const url = new URL(request.url), path = url.pathname;
  if (path !== '/api' && !path.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (path === '/api') return json(404, {error:'Endpoint not found.'});
  // This backend intentionally serves administrators and public content only.
  if (path === '/api/user/auth/session' && request.method === 'GET')
    return json(401, {error:'Member sign-in is not enabled on this backend.'});
  if (path === '/api/user/auth/status' && request.method === 'GET')
    return json(200, {memberAccountsEnabled:false,registrationEnabled:false,emailConfigured:false});
  if (path.startsWith('/api/user/'))
    return json(503, {error:'Member accounts are not enabled on this administrator backend.'});
  if (path.startsWith("/api/ai/"))
    return json(503, { error: "AI is not enabled on this administrator backend." });
  const admin = path === '/api/admin' || path.startsWith('/api/admin/');
  const publicRoute = path === '/api/public/universe' || /^\/api\/public\/characters(?:\/[^/]+\/(?:file|preview))?$/.test(path);
  if (!admin && !publicRoute) return json(404, {error:'Endpoint not found.'});
  if (!admin && request.method !== "GET") return json(405, { error: "Method not allowed." });
  try {
    const backend = supabase(env, transport);
    await verifyProductionDataset(backend,env);
    if (admin) return await handleAdmin(request,env,backend);
    if (path === "/api/public/universe") {
      const response = await backend("/rest/v1/rpc/beyond_public_records", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      return json(200, universeFromRecords(await response.json()));
    }
    const match = path.match(/^\/api\/public\/characters(?:\/([^/]+)\/(file|preview))?$/);
    if (match) {
      const page = Number(url.searchParams.get("page") || 1), search = (url.searchParams.get("search") || "").trim(), status = url.searchParams.get("status") || "";
      if (!Number.isInteger(page) || page < 1 || page > 100000 || search.length > 200 || !["", "active", "inactive", "archived"].includes(status)) throw new BackendError(400, "Invalid library filter or page.");
      const result = await backend("/rest/v1/rpc/beyond_public_characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requested_page: page, search_text: search, character_id: match[1] || null }) });
      const data = await result.json();
      const metadata = r => ({ id:r.id, name:r.name, description:r.description, type:r.type, tags:r.tags, source:r.source, active:true, deleted:false, version:r.version, kind:r.kind, format:r.format, bytes:r.bytes, createdAt:r.created_at, updatedAt:r.updated_at, previewUrl:r.preview_key ? `/api/public/characters/${r.id}/preview?v=${r.version}` : null, fileUrl:`/api/public/characters/${r.id}/file?v=${r.version}` });
      if (!match[1]) return json(200, { ...data, items: data.items.map(metadata) });
      const row = data.items[0];
      if (!idOK(match[1]) || !row) throw new BackendError(404, "Character is unavailable. Existing local copies are preserved.");
      if (url.searchParams.has("v") && Number(url.searchParams.get("v")) !== row.version) throw new BackendError(409, "Character changed. Refresh the library.");
      const key = match[2] === "preview" ? row.preview_key : row.file_key;
      if (!key || key.split("/").some(part => !part || part === "." || part === "..") || key.includes("\\")) throw new BackendError(404, "Character asset unavailable.");
      const bucket = env.SUPABASE_CHARACTER_BUCKET;
      if (!bucket || !/^[a-z0-9-]+$/.test(bucket)) throw new BackendError(503, "Private asset storage is not configured.");
      const file = await backend(`/storage/v1/object/authenticated/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
      const format = match[2] === "preview" ? "png" : row.format;
      const mime = {png:"image/png",webp:"image/webp",jpeg:"image/jpeg",glb:"model/gltf-binary",gltf:"model/gltf+json"}[format];
      if (!mime) throw new BackendError(503, "Unsupported stored asset.");
      return new Response(file.body, { headers: { "Content-Type":mime, "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" } });
    }
    return json(404, { error: "Endpoint not found." });
  } catch (error) {
    return json(error instanceof BackendError ? error.status : 503, { error: error instanceof BackendError ? error.message : "Cloud data is not ready. Existing local data has not been changed." });
  }
}
// Workers supplies ExecutionContext as argument 3; it is not a fetch transport.
export default { fetch(request, env) { return handle(request, env); } };
